/**
 * QGuard Web Scanner — Scan Orchestrator
 * Coordinates all scanner modules and streams results via SSE
 */

import type {
  WebScanTargetType,
  WebScanCompleteResult,
  WebScanFinding,
  TlsAnalysisResult,
  CertificateInfo,
  GitRepoScanResult,
  WebCryptoScanResult,
  ApiSecurityResult,
  SSEEvent,
  ThreatLevel,
  DetectionRuleResult,
  CipherSuiteDetail,
  PQCMigrationDetail,
  WebScanRiskBreakdown,
} from './types'
import { parseTarget, analyzeTls } from './tls-analyzer'
import { analyzeCipherSuites } from './cipher-suite-analyzer'
import { scanGitHubRepo } from './github-scanner'
import { scanWebCrypto } from './web-crypto-scanner'
import { scanApiSecurity } from './api-security-scanner'
import { evaluateDetectionRules } from './detection-rules'
import { calculateRiskScore, calculateNistComplianceScore, calculateConfidenceScore } from './risk-scoring'
import { generatePqcRecommendations } from './pqc-recommendations'
import { getScannerRuntimeHealth } from './runtime-health'

const SCAN_TIMEOUT = 120_000 // 120 seconds max for enterprise scans
const MODULE_TIMEOUT = 15_000 // 15 seconds per individual module
const MAX_RETRIES = 2 // Retry failed modules up to 2 times
const RETRY_DELAY = 500 // 500ms between retries

// ─── Module Retry Wrapper ───────────────────────────────────────────────────

/**
 * Execute a scanner module with retry logic and timeout
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  moduleName: string,
  retries: number = MAX_RETRIES,
  timeout: number = MODULE_TIMEOUT
): Promise<{ result: T | null; attempts: number; error: string | null }> {
  let lastError: string | null = null
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${moduleName} timed out after ${timeout}ms`)), timeout)
        ),
      ])
      return { result, attempts: attempt, error: null }
    } catch (err) {
      lastError = (err as Error).message
      if (attempt <= retries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt))
      }
    }
  }
  return { result: null, attempts: retries + 1, error: lastError }
}

/**
 * Calculate HNDL (Harvest Now, Decrypt Later) risk timeline
 */
function calculateHndlTimeline(
  keyExchange: string,
  certAlg: string,
  keySize: number
): { yearsToQuantumThreat: number; dataShelfLife: string; urgency: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW' } {
  // Estimate years until CRQC can break the algorithm
  let yearsToBreak = 15 // default conservative estimate

  if (keyExchange.includes('RSA') || certAlg.includes('RSA')) {
    if (keySize <= 1024) yearsToBreak = 3
    else if (keySize <= 2048) yearsToBreak = 7
    else if (keySize <= 4096) yearsToBreak = 10
    else yearsToBreak = 12
  }

  if (keyExchange.includes('ECDHE') || certAlg.includes('EC')) {
    yearsToBreak = 8 // ECC is more efficient for quantum attacks
  }

  if (keyExchange.includes('Kyber') || keyExchange.includes('ML-KEM')) {
    yearsToBreak = 50 // PQC is safe for foreseeable future
  }

  let urgency: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
  let dataShelfLife = '< 1 year'

  if (yearsToBreak <= 5) {
    urgency = 'IMMEDIATE'
    dataShelfLife = 'Data with >5 year confidentiality at risk NOW'
  } else if (yearsToBreak <= 8) {
    urgency = 'HIGH'
    dataShelfLife = 'Data with >8 year confidentiality at risk'
  } else if (yearsToBreak <= 12) {
    urgency = 'MEDIUM'
    dataShelfLife = 'Plan migration within 2-3 years'
  } else {
    dataShelfLife = 'Low immediate risk — monitor quantum computing progress'
  }

  return { yearsToQuantumThreat: yearsToBreak, dataShelfLife, urgency }
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

/**
 * Execute a full web scan and stream results via the onEvent callback
 */
export async function executeWebScan(
  target: string,
  targetType: WebScanTargetType,
  onEvent: (event: SSEEvent) => void
): Promise<WebScanCompleteResult> {
  const scanId = crypto.randomUUID()
  const startTime = Date.now()
  const findings: WebScanFinding[] = []
  let findingCounter = 0

  let tlsResult: TlsAnalysisResult | null = null
  let certInfo: CertificateInfo | null = null
  let repoResult: GitRepoScanResult | null = null
  let webCryptoResult: WebCryptoScanResult | null = null
  let apiResult: ApiSecurityResult | null = null
  let cipherSuiteBreakdown: CipherSuiteDetail[] = []
  let ruleResults: DetectionRuleResult[] = []
  let pqcRecommendations: PQCMigrationDetail[] = []
  const runtimeHealth = getScannerRuntimeHealth()

  // Helper to emit events
  function emit(data: Partial<SSEEvent> & { type: SSEEvent['type'] }) {
    onEvent({
      scanId,
      timestamp: new Date().toISOString(),
      ...data,
    } as SSEEvent)
  }

  // Helper to add a finding and emit it
  function addFinding(finding: Omit<WebScanFinding, 'id'>): WebScanFinding {
    findingCounter++
    const f: WebScanFinding = { ...finding, id: `ws-finding-${findingCounter}` }
    findings.push(f)
    emit({
      type: 'finding',
      phase: finding.phase,
      finding: f,
      metrics: buildLiveMetrics(findings, startTime),
    })
    return f
  }

  // Helper for phase events
  function phaseStart(phase: string, label: string, progress: number) {
    emit({ type: 'phase-start', phase, label, progress, metrics: buildLiveMetrics(findings, startTime, progress) })
  }

  function phaseComplete(phase: string, label: string, progress: number) {
    emit({ type: 'phase-complete', phase, label, progress, metrics: buildLiveMetrics(findings, startTime, progress) })
  }

  function moduleStart(moduleId: string, moduleName: string, targetName: string, progress: number) {
    emit({
      type: 'module-start',
      moduleId,
      moduleName,
      target: targetName,
      progress,
      queueState: 'running',
      metrics: buildLiveMetrics(findings, startTime, progress),
    })
  }

  function moduleComplete(moduleId: string, moduleName: string, targetName: string, progress: number, findingCount: number, error?: string | null) {
    emit({
      type: 'module-complete',
      moduleId,
      moduleName,
      target: targetName,
      progress,
      findingCount,
      queueState: 'running',
      error: error || undefined,
      metrics: buildLiveMetrics(findings, startTime, progress),
    })
  }

  const isGitHub = targetType === 'github'

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Scan timeout exceeded')), SCAN_TIMEOUT)
    })

    const scanPromise = (async () => {
      // ─── Phase 1: Initialization ────────────────────────────────────
      emit({
        type: 'scan-start',
        target,
        targetType,
        totalPhases: isGitHub ? 5 : 9,
        queueState: 'accepted',
      })

      emit({
        type: 'engine-status',
        status: runtimeHealth.status,
        engines: runtimeHealth.components,
        enterpriseEngines: runtimeHealth.enterpriseEngines,
        modulesLoaded: runtimeHealth.enterpriseScanner.modules,
        webModulesLoaded: runtimeHealth.webScanner.modules,
        detectionRulesLoaded: runtimeHealth.enterpriseScanner.detectionRules,
        webDetectionRulesLoaded: runtimeHealth.webScanner.detectionRules,
        fingerprintsLoaded: runtimeHealth.enterpriseScanner.cryptoFingerprints,
        cryptoPatternsLoaded: runtimeHealth.webScanner.cryptoPatterns,
        payloadPacksLoaded: runtimeHealth.payloadSystem.packs,
        payloadsLoaded: runtimeHealth.payloadSystem.payloads,
        templatesLoaded: runtimeHealth.templateSystem.templates,
        issues: runtimeHealth.issues,
      })

      phaseStart('initializing', 'Initializing Scanner Engine', 5)
      moduleStart('target-parser', 'Target Parser', target, 5)
      const { hostname, port } = parseTarget(target, targetType)
      moduleComplete('target-parser', 'Target Parser', target, 10, 0)
      phaseComplete('initializing', 'Scanner Engine Initialized', 10)

      if (!isGitHub) {
        // ─── Phase 2: DNS Resolution ──────────────────────────────────
        phaseStart('dns-resolution', 'DNS Resolution & Target Validation', 12)
        // DNS resolution happens inside TLS analyzer
        phaseComplete('dns-resolution', 'Target Validated', 15)

        // ─── Phase 3: TLS Handshake Analysis ──────────────────────────
        phaseStart('tls-handshake', 'TLS Handshake Analysis', 18)
        moduleStart('tls-analyzer', 'TLS Analyzer', `${hostname}:${port}`, 18)
        const tlsFindingStart = findings.length
        try {
          const tlsAttempt = await withRetry(
            () => analyzeTls(hostname, port),
            'TLS Analyzer'
          )
          tlsResult = tlsAttempt.result

          if (tlsAttempt.attempts > 1 && tlsResult) {
            addFinding({
              phase: 'tls-handshake',
              algorithm: 'TLS Connection Retry',
              location: `${hostname}:${port}`,
              threatLevel: 'LOW',
              category: 'Connectivity',
              description: `TLS handshake succeeded after ${tlsAttempt.attempts} attempt(s) — may indicate intermittent connectivity`,
              recommendation: 'Monitor server TLS stability',
              quantumBreakTime: 'N/A',
              classicalBreakTime: 'N/A',
            })
          }

          // Generate findings from TLS analysis
          if (tlsResult) {
            // Key exchange finding
            if (tlsResult.keyExchange && tlsResult.keyExchange !== 'unknown') {
              const kexThreat = getKeyExchangeThreat(tlsResult.keyExchange)
              addFinding({
                phase: 'tls-handshake',
                algorithm: tlsResult.keyExchange,
                location: `TLS Handshake — ${target}`,
                threatLevel: kexThreat,
                category: 'Key Exchange',
                description: getKeyExchangeDescription(tlsResult.keyExchange, kexThreat),
                recommendation: getKeyExchangeRecommendation(kexThreat),
                quantumBreakTime: kexThreat === 'SAFE' ? 'N/A' : '~2-8 hours (CRQC)',
                classicalBreakTime: '> 10^28 years',
              })
            }

            // TLS version finding
            addFinding({
              phase: 'tls-handshake',
              algorithm: tlsResult.tlsVersion,
              location: `Protocol — ${target}`,
              threatLevel: getTlsVersionThreat(tlsResult.tlsVersion),
              category: 'Protocol',
              description: getTlsVersionDescription(tlsResult.tlsVersion),
              recommendation: tlsResult.tlsVersion.includes('1.3')
                ? 'Enable PQC hybrid cipher suites for TLS 1.3'
                : 'Upgrade to TLS 1.3 with PQC hybrid cipher suites',
              quantumBreakTime: 'N/A (protocol level)',
              classicalBreakTime: 'N/A',
            })

            for (const protocolProbe of tlsResult.protocolSupport) {
              if (!protocolProbe.supported) continue
              const protocolThreat = getTlsVersionThreat(protocolProbe.protocol)
              if (protocolThreat === 'CRITICAL' || protocolProbe.protocol !== tlsResult.tlsVersion) {
                addFinding({
                  phase: 'tls-handshake',
                  algorithm: protocolProbe.protocol,
                  location: `Supported Protocol â€” ${target}`,
                  threatLevel: protocolThreat,
                  category: 'Protocol Support',
                  description: `${protocolProbe.protocol} is supported by the endpoint${protocolProbe.cipherSuite ? ` with ${protocolProbe.cipherSuite}` : ''}`,
                  recommendation: protocolProbe.protocol.includes('1.3')
                    ? 'Enable hybrid PQC key exchange for TLS 1.3'
                    : 'Disable deprecated protocol support and require TLS 1.3',
                  quantumBreakTime: 'N/A (protocol level)',
                  classicalBreakTime: protocolThreat === 'CRITICAL' ? 'Deprecated protocol' : 'N/A',
                })
              }
            }

            // Certificate info from TLS
            certInfo = tlsResult.peerCertificate

            // HNDL Timeline Analysis (runs after certInfo is assigned)
            const hndlTimeline = calculateHndlTimeline(
              tlsResult.keyExchange,
              certInfo?.publicKeyAlgorithm || '',
              certInfo?.publicKeySize || 2048
            )
            if (hndlTimeline.urgency === 'IMMEDIATE' || hndlTimeline.urgency === 'HIGH') {
              addFinding({
                phase: 'tls-handshake',
                algorithm: `HNDL Risk: ${hndlTimeline.urgency}`,
                location: `Traffic — ${target}`,
                threatLevel: hndlTimeline.urgency === 'IMMEDIATE' ? 'CRITICAL' : 'HIGH',
                category: 'Harvest Now Decrypt Later',
                description: `${hndlTimeline.dataShelfLife}. Estimated ${hndlTimeline.yearsToQuantumThreat} years until CRQC threat materializes.`,
                recommendation: 'Deploy hybrid PQC key exchange (X25519Kyber768) immediately to protect data in transit',
                quantumBreakTime: `~${hndlTimeline.yearsToQuantumThreat} years (estimated)`,
                classicalBreakTime: '> 10^28 years',
              })
            }
          }
          moduleComplete('tls-analyzer', 'TLS Analyzer', `${hostname}:${port}`, 28, findings.length - tlsFindingStart, tlsAttempt.error)
        } catch (err) {
          moduleComplete('tls-analyzer', 'TLS Analyzer', `${hostname}:${port}`, 28, findings.length - tlsFindingStart, (err as Error).message)
          addFinding({
            phase: 'tls-handshake',
            algorithm: 'TLS Connection Failed',
            location: `${hostname}:${port}`,
            threatLevel: 'MEDIUM',
            category: 'Connectivity',
            description: `TLS handshake failed: ${(err as Error).message}`,
            recommendation: 'Verify target is accessible and supports TLS',
            quantumBreakTime: 'N/A',
            classicalBreakTime: 'N/A',
          })
        }
        phaseComplete('tls-handshake', 'TLS Analysis Complete', 30)

        // ─── Phase 4: Certificate Analysis ────────────────────────────
        phaseStart('cert-analysis', 'Certificate Chain Inspection', 32)
        moduleStart('certificate-parser', 'Certificate Chain Audit', target, 32)
        const certFindingStart = findings.length
        if (certInfo) {
          // Public key algorithm finding
          addFinding({
            phase: 'cert-analysis',
            algorithm: `${certInfo.publicKeyAlgorithm} (Certificate)`,
            location: `Certificate — ${target}`,
            threatLevel: getCertAlgorithmThreat(certInfo.publicKeyAlgorithm),
            category: 'Certificate',
            description: getCertAlgorithmDescription(certInfo),
            recommendation: getCertRecommendation(certInfo.publicKeyAlgorithm),
            quantumBreakTime: certInfo.publicKeyAlgorithm.includes('RSA') ? '~4-8 hours (CRQC)' : '~2-4 hours (CRQC)',
            classicalBreakTime: '> 300 trillion years',
            oid: certInfo.signatureOid || undefined,
          })

          // Signature algorithm finding
          if (certInfo.signatureAlgorithm && certInfo.signatureAlgorithm !== 'unknown') {
            addFinding({
              phase: 'cert-analysis',
              algorithm: `${certInfo.signatureAlgorithm} (Signature)`,
              location: `Certificate Signature — ${target}`,
              threatLevel: getSignatureThreat(certInfo.signatureAlgorithm),
              category: 'Certificate Signature',
              description: `Certificate signed with ${certInfo.signatureAlgorithm}`,
              recommendation: 'Migrate to ML-DSA (FIPS 204) certificate signatures',
              quantumBreakTime: '~4-8 hours (CRQC)',
              classicalBreakTime: '> 10^28 years',
              oid: certInfo.signatureOid || undefined,
            })
          }

          // Expiry finding
          if (certInfo.isExpired) {
            addFinding({
              phase: 'cert-analysis',
              algorithm: 'Expired Certificate',
              location: `Certificate — ${target}`,
              threatLevel: 'CRITICAL',
              category: 'Certificate',
              description: `Certificate expired on ${certInfo.validTo}`,
              recommendation: 'Renew certificate immediately with PQC-ready CA',
              quantumBreakTime: 'N/A',
              classicalBreakTime: 'N/A',
            })
          }

          // OID-based findings
          for (const oid of certInfo.detectedOids) {
            if (oid.quantumVulnerable && oid.category !== 'extension' && oid.category !== 'ca-identifier') {
              addFinding({
                phase: 'cert-analysis',
                algorithm: oid.name,
                location: `OID ${oid.oid} — ${target}`,
                threatLevel: oid.quantumThreat === 'shor' ? 'HIGH' : (oid.quantumThreat === 'classical-broken' ? 'CRITICAL' : 'MEDIUM'),
                category: `OID (${oid.category.toUpperCase()})`,
                description: oid.description,
                recommendation: oid.pqcReplacement ? `Migrate to ${oid.pqcReplacement}` : 'Upgrade to quantum-safe algorithm',
                quantumBreakTime: oid.quantumThreat === 'shor' ? '~2-8 hours (CRQC)' : 'N/A',
                classicalBreakTime: oid.quantumThreat === 'classical-broken' ? 'Already broken' : '> 10^20 years',
                oid: oid.oid,
              })
            }
          }
        }
        moduleComplete(
          'certificate-parser',
          'Certificate Chain Audit',
          target,
          44,
          findings.length - certFindingStart,
          certInfo ? null : 'Skipped: certificate metadata unavailable because the TLS handshake did not return a peer certificate'
        )
        phaseComplete('cert-analysis', 'Certificate Inspection Complete', 45)

        // ─── Phase 5: Cipher Suite Enumeration ────────────────────────
        phaseStart('cipher-enum', 'Cipher Suite Enumeration', 48)
        moduleStart('cipher-suite-analyzer', 'Cipher Suite Enumeration', target, 48)
        const cipherFindingStart = findings.length
        if (tlsResult) {
          const cipherNames = tlsResult.cipherSuites.length > 0
            ? tlsResult.cipherSuites.map((suite) => suite.standardName)
            : [tlsResult.cipherSuite]
          cipherSuiteBreakdown = analyzeCipherSuites(cipherNames, tlsResult.tlsVersion)

          for (const suite of cipherSuiteBreakdown) {
            addFinding({
              phase: 'cipher-enum',
              algorithm: suite.standardName,
              location: `Cipher Suite — ${target}`,
              threatLevel: suite.riskLevel,
              category: 'Cipher Suite',
              description: suite.description,
              recommendation: suite.quantumVulnerable
                ? 'Migrate to PQC hybrid cipher suites'
                : 'No action required',
              quantumBreakTime: suite.quantumVulnerable ? 'Vulnerable (Shor\'s)' : 'Quantum-safe',
              classicalBreakTime: 'Classically secure',
              cipherSuiteDetail: suite,
            })
          }
        }
        moduleComplete(
          'cipher-suite-analyzer',
          'Cipher Suite Enumeration',
          target,
          54,
          findings.length - cipherFindingStart,
          tlsResult ? null : 'Skipped: cipher suite enumeration requires a completed TLS handshake'
        )
        phaseComplete('cipher-enum', 'Cipher Suite Analysis Complete', 55)

        // ─── Phase 6: Security Header & API Analysis ──────────────────
        phaseStart('header-inspection', 'Security Header & API Analysis', 58)
        moduleStart('api-security-scanner', 'Security Header & API Scanner', hostname, 58)
        const apiFindingStart = findings.length
        try {
          const apiAttempt = await withRetry(
            () => scanApiSecurity(hostname),
            'API Security Scanner'
          )
          apiResult = apiAttempt.result

          // Security header findings
          if (!apiResult) throw new Error(apiAttempt.error || 'API scan failed')
          for (const header of apiResult.securityHeaders) {
            if (header.required && !header.present) {
              addFinding({
                phase: 'header-inspection',
                algorithm: `Missing: ${header.name}`,
                location: `HTTP Headers — ${target}`,
                threatLevel: 'MEDIUM',
                category: 'Security Headers',
                description: `Required security header "${header.name}" is not present`,
                recommendation: header.recommendation,
                quantumBreakTime: 'N/A',
                classicalBreakTime: 'N/A',
              })
            }
          }

          // API-specific findings
          for (const apiFinding of apiResult.apiFindings) {
            addFinding({
              phase: 'header-inspection',
              algorithm: apiFinding.algorithm,
              location: `API ${apiFinding.endpoint} — ${target}`,
              threatLevel: apiFinding.threatLevel,
              category: 'API Security',
              description: apiFinding.description,
              recommendation: apiFinding.recommendation,
              quantumBreakTime: apiFinding.threatLevel === 'HIGH' ? '~4-8 hours (CRQC)' : 'N/A',
              classicalBreakTime: 'N/A',
            })
          }
          moduleComplete('api-security-scanner', 'Security Header & API Scanner', hostname, 64, findings.length - apiFindingStart, apiAttempt.error)
        } catch (err) {
          moduleComplete(
            'api-security-scanner',
            'Security Header & API Scanner',
            hostname,
            64,
            findings.length - apiFindingStart,
            `Skipped: API/header scan unavailable (${(err as Error).message || 'request failed'})`
          )
          // API scan failed — non-critical, continue
        }
        phaseComplete('header-inspection', 'Header & API Analysis Complete', 65)

        // ─── Phase 7: Deep Cryptographic Pattern Scan ─────────────────
        phaseStart('deep-scan', 'Deep Cryptographic Pattern Scan', 68)
        moduleStart('web-crypto-scanner', 'Web Crypto Scanner', target, 68)
        const webCryptoFindingStart = findings.length
        try {
          // Only scan web crypto for URL targets
          if (targetType === 'url') {
            const cryptoAttempt = await withRetry(
              () => scanWebCrypto(target),
              'Web Crypto Scanner'
            )
            webCryptoResult = cryptoAttempt.result

            if (webCryptoResult) for (const pattern of webCryptoResult.patterns) {
              addFinding({
                phase: 'deep-scan',
                algorithm: pattern.algorithm,
                location: `${pattern.source} (line ${pattern.line})`,
                threatLevel: pattern.threatLevel,
                category: `Web Crypto (${pattern.category})`,
                description: pattern.description,
                recommendation: 'Migrate client-side cryptography to PQC algorithms',
                quantumBreakTime: pattern.threatLevel === 'CRITICAL' ? '~4-8 hours (CRQC)' : 'N/A',
                classicalBreakTime: 'N/A',
              })
            }
          }
          moduleComplete('web-crypto-scanner', 'Web Crypto Scanner', target, 74, findings.length - webCryptoFindingStart, targetType === 'url' ? null : 'Skipped for non-URL target')
        } catch {
          moduleComplete('web-crypto-scanner', 'Web Crypto Scanner', target, 74, findings.length - webCryptoFindingStart, 'Web crypto scan failed')
          // Web crypto scan failed — non-critical
        }

        // Add AES-256-GCM as a safe finding if detected
        if (tlsResult?.cipherSuite.includes('AES_256_GCM') || tlsResult?.cipherSuite.includes('AES-256-GCM')) {
          addFinding({
            phase: 'deep-scan',
            algorithm: 'AES-256-GCM',
            location: `Cipher Suite — ${target}`,
            threatLevel: 'SAFE',
            category: 'Symmetric Encryption',
            description: 'AES-256-GCM provides 128-bit quantum security — meets PQC threshold',
            recommendation: 'No action required. AES-256 is quantum-safe for symmetric encryption.',
            quantumBreakTime: '~2^128 (Grover)',
            classicalBreakTime: '> 2^256 operations',
          })
        }

        phaseComplete('deep-scan', 'Deep Scan Complete', 75)
      } else {
        // ─── GitHub Repository Scan Path ──────────────────────────────
        phaseStart('repo-scan', 'Repository Cryptography Analysis', 20)
        moduleStart('github-scanner', 'GitHub Repository Scanner', target, 20)
        const repoFindingStart = findings.length
        try {
          const repoAttempt = await withRetry(
            () => scanGitHubRepo(target),
            'GitHub Repository Scanner',
            1, // Only 1 retry for repo scans (rate limiting)
            30_000 // 30s timeout for repo scans
          )
          repoResult = repoAttempt.result
          if (!repoResult) throw new Error(repoAttempt.error || 'Repository scan failed')

          for (const pattern of repoResult.patterns) {
            addFinding({
              phase: 'repo-scan',
              algorithm: pattern.algorithm,
              location: `${pattern.file}:${pattern.line}`,
              threatLevel: pattern.threatLevel,
              category: `Source Code (${pattern.category})`,
              description: pattern.description,
              recommendation: 'Migrate to post-quantum cryptographic algorithms',
              quantumBreakTime: pattern.threatLevel === 'CRITICAL' ? '~4-8 hours (CRQC)' : 'Varies',
              classicalBreakTime: '> 10^20 years',
              repoFilePath: pattern.file,
              lineNumber: pattern.line,
            })
          }
          moduleComplete('github-scanner', 'GitHub Repository Scanner', target, 64, findings.length - repoFindingStart, repoAttempt.error)
        } catch (err) {
          moduleComplete('github-scanner', 'GitHub Repository Scanner', target, 64, findings.length - repoFindingStart, (err as Error).message)
          addFinding({
            phase: 'repo-scan',
            algorithm: 'Repository Scan Failed',
            location: target,
            threatLevel: 'LOW',
            category: 'Scan Error',
            description: `Repository scan failed: ${(err as Error).message}`,
            recommendation: 'Verify repository URL and accessibility',
            quantumBreakTime: 'N/A',
            classicalBreakTime: 'N/A',
          })
        }
        phaseComplete('repo-scan', 'Repository Analysis Complete', 65)
      }

      // ─── Phase 8: Detection Rules ─────────────────────────────────
      phaseStart('risk-calculation', 'Quantum Vulnerability Detection & Risk Scoring', 78)
      moduleStart('detection-rules', 'Detection Rules Engine', target, 78)
      const ruleFindingStart = findings.length
      ruleResults = evaluateDetectionRules({
        findings,
        tlsResult,
        certInfo,
        apiResult,
        repoResult,
        webCryptoResult,
      })

      // Add rule-triggered findings
      for (const rule of ruleResults) {
        addFinding({
          phase: 'risk-calculation',
          algorithm: rule.ruleName,
          location: `Detection Rule ${rule.ruleId}`,
          threatLevel: rule.severity,
          category: `Rule (${formatCategory(rule.category)})`,
          description: rule.details,
          recommendation: rule.remediation,
          quantumBreakTime: 'N/A (rule-based)',
          classicalBreakTime: 'N/A',
        })
      }
      moduleComplete('detection-rules', 'Detection Rules Engine', target, 86, findings.length - ruleFindingStart)

      // ─── Phase 9: Risk Scoring & Recommendations ──────────────────
      moduleStart('risk-scoring-engine', 'Risk Scoring Engine', target, 87)
      const riskScore = calculateRiskScore(
        findings, tlsResult, certInfo, apiResult, repoResult, webCryptoResult, ruleResults
      )

      moduleStart('pqc-recommendations', 'PQC Recommendation Engine', target, 89)
      pqcRecommendations = generatePqcRecommendations(findings)

      // Calculate NIST compliance score
      const nistCompliance = calculateNistComplianceScore(findings, tlsResult, certInfo, ruleResults)

      // Calculate scan confidence score
      const scanConfidence = calculateConfidenceScore(tlsResult, certInfo, apiResult, repoResult, webCryptoResult)

      // Add NIST compliance finding if gaps detected
      if (nistCompliance.gaps.length > 0 && nistCompliance.score < 70) {
        addFinding({
          phase: 'risk-calculation',
          algorithm: `NIST Compliance: Grade ${nistCompliance.grade}`,
          location: `Compliance Assessment — ${target}`,
          threatLevel: nistCompliance.score < 40 ? 'CRITICAL' : nistCompliance.score < 60 ? 'HIGH' : 'MEDIUM',
          category: 'NIST Compliance',
          description: `NIST compliance score: ${nistCompliance.score}/100 (Grade ${nistCompliance.grade}). Gaps: ${nistCompliance.gaps.slice(0, 3).join('; ')}`,
          recommendation: 'Address NIST SP 800-57 and SP 800-52r2 compliance gaps — prioritize key sizes and TLS configuration',
          quantumBreakTime: 'N/A (compliance)',
          classicalBreakTime: 'N/A',
        })
      }

      // Attach PQC recommendations to relevant findings
      for (const finding of findings) {
        const rec = pqcRecommendations.find(r =>
          finding.algorithm.includes(r.currentAlgorithm) ||
          r.currentAlgorithm.includes(finding.algorithm.split(' ')[0])
        )
        if (rec) {
          finding.pqcRecommendation = rec
        }
      }

      moduleComplete('pqc-recommendations', 'PQC Recommendation Engine', target, 94, pqcRecommendations.length)
      moduleComplete('risk-scoring-engine', 'Risk Scoring Engine', target, 95, 0)
      phaseComplete('risk-calculation', 'Risk Score Calculated', 95)

      // ─── Phase 10: Report Generation ──────────────────────────────
      phaseStart('report-generation', 'Generating Vulnerability Report', 96)
      moduleStart('report-generator', 'Structured Report Generator', target, 96)

      const duration = (Date.now() - startTime) / 1000
      const criticalCount = findings.filter(f => f.threatLevel === 'CRITICAL').length
      const highCount = findings.filter(f => f.threatLevel === 'HIGH').length
      const mediumCount = findings.filter(f => f.threatLevel === 'MEDIUM').length
      const lowCount = findings.filter(f => f.threatLevel === 'LOW').length
      const safeCount = findings.filter(f => f.threatLevel === 'SAFE').length

      const result: WebScanCompleteResult = {
        scanId,
        target,
        targetType,
        scanDuration: duration,
        totalFindings: findings.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        safeCount,
        overallRiskScore: riskScore.overallScore,
        riskLevel: riskScore.riskLevel,
        quantumReadinessScore: riskScore.quantumReadinessScore,
        quantumReadinessLevel: riskScore.quantumReadinessLevel,
        legacyQScore: riskScore.legacyQScore,
        findings,
        tlsAnalysis: tlsResult,
        certificateInfo: certInfo,
        cipherSuiteBreakdown,
        repoScanResult: repoResult,
        webCryptoResult,
        apiSecurityResult: apiResult,
        pqcRecommendations,
        riskBreakdown: riskScore.breakdown,
        detectionRuleResults: ruleResults,
        runtimeHealth,
        scanConfidence,
      }

      moduleComplete('report-generator', 'Structured Report Generator', target, 100, findings.length)
      phaseComplete('report-generation', 'Report Generated', 100)

      // Emit scan-complete with full result
      emit({
        type: 'scan-complete',
        target,
        targetType,
        progress: 100,
        result,
      })

      return result
    })()

    // Race scan against timeout
    return await Promise.race([scanPromise, timeoutPromise])
  } catch (err) {
    const duration = (Date.now() - startTime) / 1000

    emit({
      type: 'error',
      message: (err as Error).message || 'Scan failed',
    })

    // Return partial results on error
    const criticalCount = findings.filter(f => f.threatLevel === 'CRITICAL').length
    const highCount = findings.filter(f => f.threatLevel === 'HIGH').length
    const mediumCount = findings.filter(f => f.threatLevel === 'MEDIUM').length
    const lowCount = findings.filter(f => f.threatLevel === 'LOW').length
    const safeCount = findings.filter(f => f.threatLevel === 'SAFE').length

    const partialResult: WebScanCompleteResult = {
      scanId,
      target,
      targetType,
      scanDuration: duration,
      totalFindings: findings.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      safeCount,
      overallRiskScore: 0,
      riskLevel: 'MEDIUM',
      quantumReadinessScore: 0,
      quantumReadinessLevel: 'critical-risk',
      legacyQScore: 0,
      findings,
      tlsAnalysis: tlsResult,
      certificateInfo: certInfo,
      cipherSuiteBreakdown,
      repoScanResult: repoResult,
      webCryptoResult,
      apiSecurityResult: apiResult,
      pqcRecommendations,
      riskBreakdown: { certificateRisk: 0, tlsConfigRisk: 0, cipherSuiteRisk: 0, appCryptoRisk: 0, pqcReadiness: 0 },
      detectionRuleResults: ruleResults,
      runtimeHealth,
    }

    emit({
      type: 'scan-complete',
      target,
      targetType,
      progress: 100,
      result: partialResult,
    })

    return partialResult
  }
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function buildLiveMetrics(findings: WebScanFinding[], startTime: number, progress = 0) {
  const critical = findings.filter(f => f.threatLevel === 'CRITICAL').length
  const high = findings.filter(f => f.threatLevel === 'HIGH').length
  const medium = findings.filter(f => f.threatLevel === 'MEDIUM').length
  const low = findings.filter(f => f.threatLevel === 'LOW').length
  const safe = findings.filter(f => f.threatLevel === 'SAFE').length
  const penalty = Math.min(1000, critical * 180 + high * 110 + medium * 55 + low * 20 - safe * 10)
  const quantumReadinessScore = Math.max(0, Math.min(1000, 1000 - penalty))
  const elapsedSeconds = Math.max(0, (Date.now() - startTime) / 1000)
  const etaSeconds = progress > 0 && progress < 100
    ? Math.max(1, Math.round((elapsedSeconds / progress) * (100 - progress)))
    : 0

  return {
    findingsCount: findings.length,
    critical,
    high,
    medium,
    low,
    safe,
    quantumReadinessScore,
    legacyQScore: Math.round(quantumReadinessScore / 10),
    elapsedSeconds,
    etaSeconds,
  }
}

function getKeyExchangeThreat(kex: string): ThreatLevel {
  if (kex.includes('Kyber') || kex.includes('ML-KEM')) return 'SAFE'
  if (kex === 'RSA' || kex === 'unknown') return 'CRITICAL'
  if (kex.includes('ECDHE') || kex.includes('ECDH')) return 'HIGH'
  if (kex.includes('DHE') || kex.includes('DH')) return 'HIGH'
  return 'MEDIUM'
}

function getKeyExchangeDescription(kex: string, threat: ThreatLevel): string {
  if (threat === 'SAFE') return `${kex} — post-quantum key exchange detected`
  if (kex.includes('ECDHE')) return `${kex} — quantum-vulnerable via Shor's algorithm on ECDLP`
  if (kex.includes('DHE')) return `${kex} — quantum-vulnerable via Shor's algorithm on DLP`
  if (kex === 'RSA') return 'Static RSA key exchange — no forward secrecy + quantum-vulnerable'
  return `${kex} — evaluate quantum resistance`
}

function getKeyExchangeRecommendation(threat: ThreatLevel): string {
  if (threat === 'SAFE') return 'No action required — PQC key exchange is active'
  return 'Enable X25519Kyber768 hybrid key exchange for post-quantum resistance'
}

function getTlsVersionThreat(version: string): ThreatLevel {
  if (version === 'TLSv1' || version === 'TLSv1.1') return 'CRITICAL'
  if (version === 'TLSv1.2') return 'MEDIUM'
  if (version === 'TLSv1.3') return 'LOW'
  return 'MEDIUM'
}

function getTlsVersionDescription(version: string): string {
  if (version === 'TLSv1' || version === 'TLSv1.1') return `${version} — deprecated, classically insecure`
  if (version === 'TLSv1.2') return `${version} — lacks native PQC cipher suite support`
  if (version === 'TLSv1.3') return `${version} — supports PQC hybrid extensions, recommended protocol`
  return `${version} — evaluate protocol security`
}

function getCertAlgorithmThreat(alg: string): ThreatLevel {
  if (alg.includes('ML-KEM') || alg.includes('ML-DSA') || alg.includes('Kyber')) return 'SAFE'
  const lower = alg.toLowerCase()
  if (lower.includes('rsa') && parseInt(alg.match(/\d+/)?.[0] || '2048') <= 1024) return 'CRITICAL'
  if (lower.includes('rsa')) return 'HIGH'
  if (lower.includes('ec') || lower.includes('ecdsa')) return 'HIGH'
  if (lower.includes('dsa')) return 'HIGH'
  return 'MEDIUM'
}

function getCertAlgorithmDescription(cert: CertificateInfo): string {
  const alg = cert.publicKeyAlgorithm
  if (alg.includes('RSA')) {
    return `Certificate uses ${alg} — breakable by Shor's algorithm on CRQC (${cert.publicKeySize}-bit key)`
  }
  if (alg.includes('EC') || alg.includes('ECDSA')) {
    return `Certificate uses ${alg} — ECDLP breakable by Shor's algorithm`
  }
  return `Certificate uses ${alg} — evaluate quantum resistance`
}

function getCertRecommendation(alg: string): string {
  if (alg.includes('RSA')) return 'Migrate to ML-KEM-768 (FIPS 203) hybrid certificate'
  if (alg.includes('EC') || alg.includes('ECDSA')) return 'Migrate to ML-DSA-65 (FIPS 204) certificate'
  return 'Evaluate PQC certificate alternatives'
}

function getSignatureThreat(sigAlg: string): ThreatLevel {
  const lower = sigAlg.toLowerCase()
  if (lower.includes('md5') || lower.includes('md2')) return 'CRITICAL'
  if (lower.includes('sha1') || lower.includes('sha-1')) return 'CRITICAL'
  if (lower.includes('rsa') || lower.includes('ecdsa')) return 'HIGH'
  return 'MEDIUM'
}

function formatCategory(category: string): string {
  return category.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
