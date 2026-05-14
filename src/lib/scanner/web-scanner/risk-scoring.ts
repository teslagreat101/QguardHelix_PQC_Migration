/**
 * QGuard Web Scanner — Quantum Risk Scoring Engine
 * Calculates a quantum readiness score (0-100) based on detected vulnerabilities
 */

import type {
  WebScanFinding,
  TlsAnalysisResult,
  CertificateInfo,
  ApiSecurityResult,
  GitRepoScanResult,
  WebCryptoScanResult,
  WebScanRiskBreakdown,
  WebScanRiskScore,
  ThreatLevel,
  DetectionRuleResult,
  QuantumReadinessLevel,
} from './types'

// ─── Weight Configuration ───────────────────────────────────────────────────

const WEIGHTS = {
  certificateRisk: 0.25,
  tlsConfigRisk: 0.25,
  cipherSuiteRisk: 0.20,
  appCryptoRisk: 0.15,
  pqcReadiness: 0.15,
}

const THREAT_SCORES: Record<ThreatLevel, number> = {
  CRITICAL: 95,
  HIGH: 75,
  MEDIUM: 45,
  LOW: 20,
  SAFE: 0,
}

// ─── Risk Calculation Functions ─────────────────────────────────────────────

/**
 * Calculate certificate risk (0-100)
 */
function calculateCertificateRisk(certInfo: CertificateInfo | null): number {
  if (!certInfo) return 50 // Unknown cert = moderate risk

  let score = 0

  // Public key algorithm risk
  const alg = certInfo.publicKeyAlgorithm.toLowerCase()
  if (alg.includes('rsa')) {
    if (certInfo.publicKeySize <= 1024) score += 40
    else if (certInfo.publicKeySize <= 2048) score += 30
    else if (certInfo.publicKeySize <= 4096) score += 25
    else score += 20
  } else if (alg.includes('ec') || alg.includes('ecdsa')) {
    score += 28 // ECC is quantum-vulnerable
  } else if (alg.includes('dsa')) {
    score += 35
  } else if (alg.includes('ed25519') || alg.includes('ed448')) {
    score += 25 // EdDSA is still ECC-based
  }

  // Signature algorithm risk
  const sig = certInfo.signatureAlgorithm.toLowerCase()
  if (sig.includes('md5') || sig.includes('md2')) score += 25
  else if (sig.includes('sha1') || sig.includes('sha-1')) score += 20
  else if (sig.includes('sha256') || sig.includes('sha-256')) score += 5
  else if (sig.includes('sha384') || sig.includes('sha512')) score += 3

  // Certificate validity issues
  if (certInfo.isExpired) score += 15
  if (certInfo.isSelfSigned) score += 10

  // Quantum-vulnerable OIDs
  const vulnOids = certInfo.detectedOids.filter(o => o.quantumVulnerable)
  score += Math.min(vulnOids.length * 5, 20)

  return Math.min(100, score)
}

/**
 * Calculate TLS configuration risk (0-100)
 */
function calculateTlsConfigRisk(tlsResult: TlsAnalysisResult | null): number {
  if (!tlsResult) return 60 // No TLS = high risk

  let score = 0

  // TLS version risk
  const version = tlsResult.tlsVersion
  if (version === 'TLSv1' || version === 'TLSv1.1') score += 30
  else if (version === 'TLSv1.2') score += 15
  else if (version === 'TLSv1.3') score += 5

  // Key exchange risk
  const kex = tlsResult.keyExchange
  if (kex.includes('RSA') && !kex.includes('ECDHE') && !kex.includes('DHE')) {
    score += 30 // Static RSA = no forward secrecy
  } else if (kex.includes('ECDHE')) {
    score += 20 // ECDHE = forward secrecy but quantum-vulnerable
  } else if (kex.includes('DHE')) {
    score += 22 // DHE = quantum-vulnerable
    if (tlsResult.ephemeralKeySize && tlsResult.ephemeralKeySize < 2048) {
      score += 10 // Weak DH parameters
    }
  }

  // No PQC key exchange
  if (!kex.includes('Kyber') && !kex.includes('ML-KEM')) {
    score += 15
  }

  // Ephemeral key size risk
  if (tlsResult.ephemeralKeySize) {
    if (tlsResult.ephemeralKeyType === 'ECDH' && tlsResult.ephemeralKeySize < 384) {
      score += 5
    }
  }

  return Math.min(100, score)
}

/**
 * Calculate cipher suite risk (0-100)
 */
function calculateCipherSuiteRisk(
  tlsResult: TlsAnalysisResult | null,
  findings: WebScanFinding[]
): number {
  if (!tlsResult) return 50

  let score = 0

  // Negotiated cipher suite risk
  const cipher = tlsResult.cipherSuite
  if (cipher.includes('RSA_WITH')) score += 35
  else if (cipher.includes('CBC')) score += 15
  else if (cipher.includes('3DES') || cipher.includes('DES')) score += 40
  else if (cipher.includes('GCM') || cipher.includes('CHACHA20')) score += 5

  // Quantum-vulnerable key exchange in cipher
  if (cipher.includes('ECDHE') || cipher.includes('DHE')) score += 20
  else if (cipher.includes('RSA') && !cipher.includes('ECDHE')) score += 30

  // Count cipher-related findings
  const cipherFindings = findings.filter(f =>
    f.category === 'Cipher Suite' || f.category === 'Key Exchange'
  )
  score += Math.min(cipherFindings.length * 5, 20)

  // No AEAD
  if (!cipher.includes('GCM') && !cipher.includes('CHACHA20') && !cipher.includes('POLY1305')) {
    score += 10
  }

  return Math.min(100, score)
}

/**
 * Calculate application crypto risk (0-100)
 */
function calculateAppCryptoRisk(
  repoResult: GitRepoScanResult | null,
  webCryptoResult: WebCryptoScanResult | null,
  apiResult: ApiSecurityResult | null
): number {
  let score = 0
  let totalPatterns = 0

  // Repo scan findings
  if (repoResult) {
    const critical = repoResult.patterns.filter(p => p.threatLevel === 'CRITICAL').length
    const high = repoResult.patterns.filter(p => p.threatLevel === 'HIGH').length
    const medium = repoResult.patterns.filter(p => p.threatLevel === 'MEDIUM').length
    totalPatterns += repoResult.patterns.length

    score += Math.min(critical * 15, 40)
    score += Math.min(high * 8, 25)
    score += Math.min(medium * 3, 15)
  }

  // Web crypto findings
  if (webCryptoResult) {
    const critical = webCryptoResult.patterns.filter(p => p.threatLevel === 'CRITICAL').length
    const high = webCryptoResult.patterns.filter(p => p.threatLevel === 'HIGH').length
    totalPatterns += webCryptoResult.patterns.length

    score += Math.min(critical * 12, 30)
    score += Math.min(high * 6, 20)
  }

  // API security findings
  if (apiResult) {
    const apiVulns = apiResult.apiFindings.filter(f => f.threatLevel === 'HIGH' || f.threatLevel === 'CRITICAL')
    score += Math.min(apiVulns.length * 8, 20)

    // Missing security headers
    const missingHeaders = apiResult.securityHeaders.filter(h => h.required && !h.present)
    score += Math.min(missingHeaders.length * 5, 15)
  }

  // If no code was scanned, don't penalize
  if (totalPatterns === 0 && !apiResult) return 0

  return Math.min(100, score)
}

/**
 * Calculate PQC readiness (0-100, where 100 = not ready at all)
 */
function calculatePqcReadinessRisk(
  tlsResult: TlsAnalysisResult | null,
  certInfo: CertificateInfo | null,
  findings: WebScanFinding[],
  ruleResults: DetectionRuleResult[]
): number {
  let score = 0

  // Check PQC readiness rule results
  const pqcRules = ruleResults.filter(r => r.category === 'pqc-readiness')
  for (const rule of pqcRules) {
    if (rule.severity === 'HIGH') score += 20
    else if (rule.severity === 'MEDIUM') score += 12
    else if (rule.severity === 'LOW') score += 5
  }

  // No PQC key exchange
  if (tlsResult && !tlsResult.keyExchange.includes('Kyber') && !tlsResult.keyExchange.includes('ML-KEM')) {
    score += 15
  }

  // No PQC certificate
  if (certInfo) {
    const hasPqcOid = certInfo.detectedOids.some(o => o.category === 'pqc')
    if (!hasPqcOid) score += 10
  }

  // No PQC algorithms in findings
  const hasPqcAlg = findings.some(f =>
    f.algorithm.includes('ML-KEM') || f.algorithm.includes('Kyber') ||
    f.algorithm.includes('ML-DSA') || f.algorithm.includes('Dilithium')
  )
  if (!hasPqcAlg) score += 10

  // HNDL risk amplifier
  const hndlRules = ruleResults.filter(r => r.category === 'long-term-quantum-risk')
  score += Math.min(hndlRules.length * 5, 15)

  return Math.min(100, score)
}

// ─── Main Scoring Function ──────────────────────────────────────────────────

/**
 * Calculate the overall quantum risk score for a web scan
 */
export function calculateRiskScore(
  findings: WebScanFinding[],
  tlsResult: TlsAnalysisResult | null,
  certInfo: CertificateInfo | null,
  apiResult: ApiSecurityResult | null,
  repoResult: GitRepoScanResult | null,
  webCryptoResult: WebCryptoScanResult | null,
  ruleResults: DetectionRuleResult[]
): WebScanRiskScore {
  const breakdown: WebScanRiskBreakdown = {
    certificateRisk: calculateCertificateRisk(certInfo),
    tlsConfigRisk: calculateTlsConfigRisk(tlsResult),
    cipherSuiteRisk: calculateCipherSuiteRisk(tlsResult, findings),
    appCryptoRisk: calculateAppCryptoRisk(repoResult, webCryptoResult, apiResult),
    pqcReadiness: calculatePqcReadinessRisk(tlsResult, certInfo, findings, ruleResults),
  }

  // Weighted overall score
  const overallScore = Math.round(
    breakdown.certificateRisk * WEIGHTS.certificateRisk +
    breakdown.tlsConfigRisk * WEIGHTS.tlsConfigRisk +
    breakdown.cipherSuiteRisk * WEIGHTS.cipherSuiteRisk +
    breakdown.appCryptoRisk * WEIGHTS.appCryptoRisk +
    breakdown.pqcReadiness * WEIGHTS.pqcReadiness
  )

  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, overallScore))

  return {
    overallScore: clampedScore,
    riskLevel: scoreToRiskLevel(clampedScore),
    quantumReadinessScore: riskExposureToReadinessScore(clampedScore),
    quantumReadinessLevel: readinessScoreToLevel(riskExposureToReadinessScore(clampedScore)),
    legacyQScore: Math.round(riskExposureToReadinessScore(clampedScore) / 10),
    breakdown,
  }
}

/**
 * Convert the legacy web exposure score (0-100, higher = riskier)
 * into the platform quantum-readiness score (0-1000, higher = safer).
 */
function riskExposureToReadinessScore(exposureScore: number): number {
  return Math.max(0, Math.min(1000, Math.round((100 - exposureScore) * 10)))
}

/**
 * 900-1000: Quantum Safe
 * 700-899: Moderate Risk
 * 400-699: Vulnerable
 * 0-399: Critical Risk
 */
function readinessScoreToLevel(score: number): QuantumReadinessLevel {
  if (score >= 900) return 'quantum-safe'
  if (score >= 700) return 'moderate-risk'
  if (score >= 400) return 'vulnerable'
  return 'critical-risk'
}

/**
 * Convert a numeric score to a risk level
 */
function scoreToRiskLevel(score: number): ThreatLevel {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  if (score >= 20) return 'LOW'
  return 'SAFE'
}

/**
 * Calculate NIST SP 800-57 compliance score (0-100, where 100 = fully compliant)
 * This provides an additional dimension to the risk assessment
 */
export function calculateNistComplianceScore(
  findings: WebScanFinding[],
  tlsResult: TlsAnalysisResult | null,
  certInfo: CertificateInfo | null,
  ruleResults: DetectionRuleResult[]
): { score: number; grade: string; gaps: string[] } {
  let score = 100
  const gaps: string[] = []

  // Check TLS version compliance (NIST requires TLS 1.2+ with preference for 1.3)
  if (tlsResult) {
    if (tlsResult.tlsVersion === 'TLSv1' || tlsResult.tlsVersion === 'TLSv1.1') {
      score -= 25
      gaps.push('TLS 1.0/1.1 does not meet NIST SP 800-52r2 requirements')
    } else if (tlsResult.tlsVersion === 'TLSv1.2') {
      score -= 5
      gaps.push('TLS 1.2 meets minimum but TLS 1.3 is recommended')
    }

    // Check key exchange compliance
    if (tlsResult.keyExchange.includes('RSA') && !tlsResult.keyExchange.includes('ECDHE')) {
      score -= 15
      gaps.push('RSA key exchange without forward secrecy violates NIST recommendations')
    }

    // Check for AEAD cipher
    if (!tlsResult.cipherSuite.includes('GCM') && !tlsResult.cipherSuite.includes('CHACHA20') && !tlsResult.cipherSuite.includes('CCM')) {
      score -= 10
      gaps.push('Non-AEAD cipher suite does not meet NIST SP 800-52r2 preference')
    }
  }

  // Check certificate compliance
  if (certInfo) {
    const alg = certInfo.publicKeyAlgorithm.toLowerCase()
    if (alg.includes('rsa') && certInfo.publicKeySize < 2048) {
      score -= 20
      gaps.push(`RSA-${certInfo.publicKeySize} below NIST SP 800-57 minimum (2048-bit)`)
    }
    if (certInfo.signatureAlgorithm.toLowerCase().includes('sha1')) {
      score -= 15
      gaps.push('SHA-1 certificate signature violates NIST policy (deprecated since 2011)')
    }
    if (certInfo.signatureAlgorithm.toLowerCase().includes('md5')) {
      score -= 20
      gaps.push('MD5 certificate signature is classically broken — critical NIST violation')
    }
    if (certInfo.isExpired) {
      score -= 10
      gaps.push('Expired certificate violates basic security hygiene requirements')
    }
  }

  // Check PQC readiness (NIST IR 8413 guidance)
  const pqcRules = ruleResults.filter(r => r.category === 'pqc-readiness')
  if (pqcRules.length > 0) {
    score -= Math.min(pqcRules.length * 3, 15)
    gaps.push('No PQC adoption detected — NIST recommends beginning PQC transition')
  }

  // Check for critical findings (each one is a compliance gap)
  const criticalCount = findings.filter(f => f.threatLevel === 'CRITICAL').length
  score -= Math.min(criticalCount * 3, 15)

  // Clamp score
  score = Math.max(0, Math.min(100, score))

  // Grade assignment
  let grade = 'A+'
  if (score < 95) grade = 'A'
  if (score < 85) grade = 'B'
  if (score < 75) grade = 'C'
  if (score < 60) grade = 'D'
  if (score < 40) grade = 'F'

  return { score, grade, gaps }
}

/**
 * Calculate confidence interval for the risk score
 * Higher confidence when more scan data is available
 */
export function calculateConfidenceScore(
  tlsResult: TlsAnalysisResult | null,
  certInfo: CertificateInfo | null,
  apiResult: ApiSecurityResult | null,
  repoResult: GitRepoScanResult | null,
  webCryptoResult: WebCryptoScanResult | null
): { confidence: number; label: string; factors: string[] } {
  let confidence = 0
  const factors: string[] = []

  // TLS analysis completed
  if (tlsResult) {
    confidence += 25
    factors.push('TLS handshake analysis completed')
  } else {
    factors.push('TLS analysis unavailable — reduced confidence')
  }

  // Certificate parsed
  if (certInfo) {
    confidence += 25
    if (certInfo.chain.length > 1) {
      confidence += 5
      factors.push('Full certificate chain analyzed')
    } else {
      factors.push('Certificate parsed (single cert)')
    }
  }

  // API endpoints probed
  if (apiResult) {
    confidence += 15
    if (apiResult.endpointsProbed >= 3) {
      confidence += 5
      factors.push(`${apiResult.endpointsProbed} API endpoints probed`)
    }
  }

  // Repository scanned
  if (repoResult) {
    confidence += 15
    if (repoResult.filesScanned >= 10) {
      confidence += 5
      factors.push(`${repoResult.filesScanned} source files scanned`)
    }
  }

  // Web crypto scanned
  if (webCryptoResult) {
    confidence += 10
    if (webCryptoResult.scriptsAnalyzed > 0) {
      factors.push(`${webCryptoResult.scriptsAnalyzed} scripts analyzed`)
    }
  }

  confidence = Math.min(100, confidence)

  let label = 'Very High'
  if (confidence < 90) label = 'High'
  if (confidence < 70) label = 'Moderate'
  if (confidence < 50) label = 'Low'
  if (confidence < 30) label = 'Very Low'

  return { confidence, label, factors }
}
