import { Router, Request, Response, NextFunction } from 'express'
import net from 'node:net'
import { getToken, getServerUser, createAuthClient, getServiceClient } from '@/lib/supabase-server'
import { validateAsset } from '@/lib/scanner/asset-validator'
import { executeWebScan } from '@/lib/scanner/web-scanner/scan-orchestrator'
import type {
  CertificateInfo,
  SSEEvent,
  ThreatLevel,
  WebScanCompleteResult,
  WebScanFinding,
  WebScanTargetType,
} from '@/lib/scanner/web-scanner/types'
import { getScannerRuntimeHealth } from '@/lib/scanner/web-scanner/runtime-health'
import { SCAN_MODULES } from '@/lib/scanner/scanner_2/modules'
import { DETECTION_RULES as ENTERPRISE_DETECTION_RULES } from '@/lib/scanner/scanner_2/rules/detection-rules'
import { CRYPTO_FINGERPRINTS } from '@/lib/scanner/scanner_2/fingerprints'
import { matchFingerprints } from '@/lib/scanner/scanner_2/engine/fingerprint-matcher'
import { calculateQuantumRiskScore } from '@/lib/scanner/scanner_2/engine/risk-scoring'
import { evaluateFindings } from '@/lib/scanner/scanner_2/rules/detection-rules'
import { analyzeHNDLRisks } from '@/lib/scanner/scanner_2/hndl-analyzer'
import { buildQuantumRiskAssessment } from '@/lib/scanner/scanner_2/correlation-engine'
import { calculateQuantumReadiness, getMigrationRecommendation } from '@/lib/scanner/scanner_2/pqc-migration-engine'
import { buildEvidenceForTarget, buildRemediationModel } from '@/lib/scanner/scanner_2/remediation-model'
import type { ClassicalAlgorithm, QuantumThreatLevel, QuantumThreatType } from '@/types/quantum.types'
import type { ScanFinding, ScanTarget, ScanTargetType } from '@/types/scanner.types'

const router = Router()

type ScanStatus = 'idle' | 'queued' | 'running' | 'analyzing' | 'completed' | 'failed' | 'cancelled'
type DefensiveTargetType = WebScanTargetType | 'ssh'
type PersistenceMode = 'database' | 'memory' | 'none'
type ScannerModuleStatus = 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Skipped' | 'No findings'

interface AuthorizedTarget {
  raw: string
  normalized: string
  host: string
  port: number
  type: DefensiveTargetType
  displayName: string
  protocol: 'https' | 'http' | 'ssh' | 'git'
}

interface DefensiveFinding {
  id: string
  algorithm: string
  category: string
  location: string
  threatLevel: ThreatLevel
  status: 'PQC-ready' | 'Quantum-vulnerable' | 'Legacy/deprecated' | 'Misconfigured' | 'Unknown / requires manual review'
  description: string
  recommendation: string
  pqcReplacement: string | null
  keySize: number | null
  evidence: string
  detectionMethod: string
  source: string
  raw?: unknown
}

interface DefensiveResult {
  scanId: string
  target: string
  targetType: DefensiveTargetType
  startedAt: string
  completedAt: string
  durationMs: number
  status: ScanStatus
  riskScore: number
  qScore: number
  riskLevel: ThreatLevel
  findings: DefensiveFinding[]
  certificateInfo?: CertificateInfo | null
  tlsVersion?: string | null
  metadata: Record<string, unknown>
}

interface EnterpriseScanner2Result {
  observedFindings: ScanFinding[]
  enrichedFindings: ScanFinding[]
  ruleResults: ReturnType<typeof evaluateFindings>
  hndlRisks: ReturnType<typeof analyzeHNDLRisks>
  attackAssessment: ReturnType<typeof buildQuantumRiskAssessment>
  quantumRiskScore: ReturnType<typeof calculateQuantumRiskScore>
  quantumReadiness: ReturnType<typeof calculateQuantumReadiness>
  migrationRecommendations: Array<ReturnType<typeof getMigrationRecommendation>>
}

interface MemorySession {
  id: string
  user_id: string
  status: string
  target_scope: string
  progress: number
  total_assets: number
  scanned_assets: number
  findings_count: number
  metadata: Record<string, unknown>
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface MemoryAsset {
  id: string
  user_id: string
  name: string
  type: string
  ip_address: string | null
  criticality: string
  status: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface MemoryInventory {
  id: string
  user_id: string
  asset_id: string
  item_type: string
  name: string
  algorithm: string | null
  key_size: number | null
  protocol: string | null
  exposure_level: string
  is_vulnerable: boolean
  is_quantum_safe: boolean
  metadata: Record<string, unknown>
  discovered_at: string
  created_at: string
}

interface MemoryExposure {
  id: string
  user_id: string
  asset_id: string
  exposure_type: string
  severity: string
  description: string
  detected_value: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface MemoryScanResult {
  id: string
  user_id: string
  scan_session_id: string
  asset_id: string
  finding_type: string
  algorithm: string | null
  threat_level: string
  description: string
  remediation: string
  metadata: Record<string, unknown>
  created_at: string
}

interface ScannerModuleState {
  id: string
  name: string
  status: ScannerModuleStatus
  target?: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  findingsCount: number
  severityCounts: {
    critical: number
    high: number
    medium: number
    low: number
    safe: number
  }
  error: string | null
}

const SCANNER_MODULE_CATALOG: Array<{ id: string; name: string }> = [
  { id: 'target-validation', name: 'Target Authorization & Validation' },
  { id: 'tls-protocol-scanner', name: 'TLS protocol scanner' },
  { id: 'certificate-scanner', name: 'Certificate scanner' },
  { id: 'cipher-suite-scanner', name: 'Cipher suite scanner' },
  { id: 'key-exchange-scanner', name: 'Key exchange scanner' },
  { id: 'signature-algorithm-scanner', name: 'Signature algorithm scanner' },
  { id: 'hash-algorithm-scanner', name: 'Hash algorithm scanner' },
  { id: 'ssh-host-key-scanner', name: 'SSH host key scanner' },
  { id: 'jwt-signing-scanner', name: 'JWT signing algorithm scanner' },
  { id: 'dependency-crypto-scanner', name: 'Dependency crypto scanner' },
  { id: 'cbom-generator', name: 'CBOM generator' },
  { id: 'scanner2-module-registry', name: 'Scanner_2 module registry' },
  { id: 'scanner2-fingerprint-matcher', name: 'Scanner_2 fingerprint matcher' },
  { id: 'scanner2-detection-rules', name: 'Scanner_2 detection rules engine' },
  { id: 'scanner2-hndl-analyzer', name: 'Scanner_2 HNDL analyzer' },
  { id: 'scanner2-correlation-engine', name: 'Scanner_2 correlation engine' },
  { id: 'scanner2-pqc-migration-engine', name: 'Scanner_2 PQC migration engine' },
  { id: 'scanner2-risk-qscore-engine', name: 'Scanner_2 risk/Q-score engine' },
  { id: 'risk-scoring-engine', name: 'Risk scoring engine' },
  { id: 'crypto-exposure-graph-builder', name: 'Crypto exposure graph builder' },
  { id: 'asset-inventory-synchronizer', name: 'Asset inventory synchronizer' },
  { id: 'audit-history-logger', name: 'Audit/history logger' },
]

const activeJobs = new Map<string, { cancelled: boolean }>()

const memoryStore = (() => {
  const g = globalThis as typeof globalThis & {
    __qguard_authorized_scanner_store__?: {
      sessions: MemorySession[]
      assets: MemoryAsset[]
      inventory: MemoryInventory[]
      exposures: MemoryExposure[]
      results: MemoryScanResult[]
    }
  }
  if (!g.__qguard_authorized_scanner_store__) {
    g.__qguard_authorized_scanner_store__ = {
      sessions: [],
      assets: [],
      inventory: [],
      exposures: [],
      results: [],
    }
  }
  return g.__qguard_authorized_scanner_store__
})()

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getToken(req)
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
    return
  }

  const user = await getServerUser(token)
  if (!user) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })
    return
  }

  ;(req as any).user = user
  ;(req as any).token = token
  next()
}

router.use(requireAuth)

function randomId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function createModuleStates(): ScannerModuleState[] {
  return SCANNER_MODULE_CATALOG.map((module) => ({
    id: module.id,
    name: module.name,
    status: 'Queued',
    startedAt: null,
    completedAt: null,
    durationMs: null,
    findingsCount: 0,
    severityCounts: { critical: 0, high: 0, medium: 0, low: 0, safe: 0 },
    error: null,
  }))
}

function countFindingSeverities(findings: DefensiveFinding[]) {
  return {
    critical: findings.filter((finding) => finding.threatLevel === 'CRITICAL').length,
    high: findings.filter((finding) => finding.threatLevel === 'HIGH').length,
    medium: findings.filter((finding) => finding.threatLevel === 'MEDIUM').length,
    low: findings.filter((finding) => finding.threatLevel === 'LOW').length,
    safe: findings.filter((finding) => finding.threatLevel === 'SAFE').length,
  }
}

function mapWebModule(moduleId?: unknown, moduleName?: unknown, phase?: unknown) {
  const id = String(moduleId || '').toLowerCase()
  const name = String(moduleName || '').toLowerCase()
  const p = String(phase || '').toLowerCase()
  if (id.includes('target-parser') || p.includes('dns')) return 'target-validation'
  if (id.includes('tls') || name.includes('tls') || p.includes('tls')) return 'tls-protocol-scanner'
  if (id.includes('certificate') || name.includes('certificate') || p.includes('cert')) return 'certificate-scanner'
  if (id.includes('cipher') || name.includes('cipher') || p.includes('cipher')) return 'cipher-suite-scanner'
  if (name.includes('key exchange') || p.includes('handshake')) return 'key-exchange-scanner'
  if (name.includes('signature')) return 'signature-algorithm-scanner'
  if (name.includes('hash')) return 'hash-algorithm-scanner'
  if (id.includes('api-security') || name.includes('api')) return 'jwt-signing-scanner'
  if (id.includes('web-crypto') || id.includes('github') || name.includes('repository') || p.includes('repo')) return 'dependency-crypto-scanner'
  if (id.includes('detection-rules')) return 'hash-algorithm-scanner'
  if (id.includes('risk-scoring')) return 'risk-scoring-engine'
  if (id.includes('pqc-recommendations')) return 'risk-scoring-engine'
  if (id.includes('report')) return 'audit-history-logger'
  return null
}

function moduleIdForFinding(finding: DefensiveFinding) {
  const category = finding.category.toLowerCase()
  const method = finding.detectionMethod.toLowerCase()
  const algorithm = finding.algorithm.toLowerCase()
  if (category.includes('ssh')) return 'ssh-host-key-scanner'
  if (category.includes('certificate')) {
    if (algorithm.includes('sha') || algorithm.includes('md5')) return 'hash-algorithm-scanner'
    if (algorithm.includes('signature')) return 'signature-algorithm-scanner'
    return 'certificate-scanner'
  }
  if (category.includes('cipher')) return 'cipher-suite-scanner'
  if (category.includes('key exchange') || category.includes('hndl')) return 'key-exchange-scanner'
  if (category.includes('hash') || algorithm.includes('sha') || algorithm.includes('md5')) return 'hash-algorithm-scanner'
  if (category.includes('api') || algorithm.includes('jwt')) return 'jwt-signing-scanner'
  if (category.includes('source') || category.includes('web crypto') || method.includes('repo') || method.includes('deep')) return 'dependency-crypto-scanner'
  if (category.includes('protocol')) return 'tls-protocol-scanner'
  return 'risk-scoring-engine'
}

function terminalSeverity(threatLevel: ThreatLevel) {
  if (threatLevel === 'CRITICAL') return 'Critical'
  if (threatLevel === 'HIGH') return 'High'
  if (threatLevel === 'MEDIUM') return 'Medium'
  if (threatLevel === 'LOW') return 'Low'
  return 'Secure'
}

function targetTypeToScanner2(target: AuthorizedTarget): ScanTargetType {
  if (target.type === 'github') return 'developer-platform'
  if (target.type === 'ssh') return 'ssh-directory'
  if (target.type === 'url') return 'app'
  if (target.type === 'domain' || target.type === 'ip') return 'cloud-infrastructure'
  return 'app'
}

function threatToScanner2Threat(threat: ThreatLevel): QuantumThreatLevel {
  if (threat === 'CRITICAL') return 'critical'
  if (threat === 'HIGH') return 'high'
  if (threat === 'MEDIUM') return 'medium'
  if (threat === 'LOW') return 'low'
  return 'safe'
}

function riskScoreToScanner2Severity(score: number): ScanFinding['severity'] {
  if (score >= 85) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 30) return 'moderate'
  return 'low'
}

function inferQuantumThreat(algorithm: ClassicalAlgorithm): QuantumThreatType {
  if (algorithm === 'SHA-1' || algorithm === 'MD5' || algorithm === 'TLS-1.0') return 'classical-broken'
  if (algorithm === 'AES-128' || algorithm === 'AES-256' || algorithm === 'SHA-256') return 'grover'
  if (algorithm === '3DES' || algorithm === 'TLS-1.1') return 'both'
  return 'shor'
}

function algorithmCategoryForScanner2(algorithm: ClassicalAlgorithm): ScanFinding['algorithmCategory'] {
  if (algorithm.startsWith('TLS')) return 'protocol'
  if (algorithm.startsWith('SHA') || algorithm === 'MD5') return 'hash'
  if (algorithm.startsWith('AES') || algorithm === '3DES') return 'symmetric'
  if (algorithm.startsWith('ECDSA') || algorithm.startsWith('DSA') || algorithm === 'Ed25519') return 'signature'
  return 'public-key'
}

function normalizeToScanner2Algorithm(value: string): ClassicalAlgorithm | null {
  const lower = value.toLowerCase()
  const bits = Number(value.match(/(?:rsa|dh|aes|p-?|nistp|secp)?[-_ ]?(\d{3,4}|\d{2,3})/i)?.[1])
  if (lower.includes('rsa')) {
    if (bits && bits <= 1024) return 'RSA-1024'
    if (bits && bits >= 4096) return 'RSA-4096'
    return 'RSA-2048'
  }
  if (lower.includes('ecdsa') || lower.includes('secp')) {
    if (lower.includes('384') || lower.includes('p384')) return 'ECDSA-P384'
    if (lower.includes('secp256k1')) return 'ECC-secp256k1'
    return 'ECDSA-P256'
  }
  if (lower.includes('ecdh') || lower.includes('p-256') || lower.includes('prime256') || lower.includes('nistp256')) return 'ECC-P256'
  if (lower.includes('p-384') || lower.includes('nistp384')) return 'ECC-P384'
  if (lower.includes('x25519') || lower.includes('curve25519')) return 'X25519'
  if (lower.includes('ed25519')) return 'Ed25519'
  if (lower.includes('diffie') || lower.includes('dhe') || lower.includes('dh-')) {
    if (bits && bits <= 1024) return 'DH-1024'
    return 'DH-2048'
  }
  if (lower.includes('tls') || lower.includes('tlsv')) {
    if (lower.includes('1.0')) return 'TLS-1.0'
    if (lower.includes('1.1')) return 'TLS-1.1'
    if (lower.includes('1.2')) return 'TLS-1.2'
    if (lower.includes('1.3')) return 'TLS-1.3'
  }
  if (lower.includes('sha-1') || lower.includes('sha1')) return 'SHA-1'
  if (lower.includes('sha-256') || lower.includes('sha256')) return 'SHA-256'
  if (lower.includes('md5')) return 'MD5'
  if (lower.includes('aes-128') || lower.includes('aes_128')) return 'AES-128'
  if (lower.includes('aes-256') || lower.includes('aes_256')) return 'AES-256'
  if (lower.includes('3des') || lower.includes('triple-des')) return '3DES'
  if (lower.includes('pgp') && lower.includes('rsa')) return 'PGP-RSA'
  if (lower.includes('pgp') && (lower.includes('ecc') || lower.includes('ec'))) return 'PGP-ECC'
  if (lower.includes('s/mime') && lower.includes('rsa')) return 'S/MIME-RSA'
  return null
}

function scanner2ModuleForFinding(finding: DefensiveFinding) {
  const category = finding.category.toLowerCase()
  const source = finding.source.toLowerCase()
  if (category.includes('ssh') || source.includes('ssh')) return 'ssh-security-scanner'
  if (category.includes('certificate')) return 'certificate-authority-trust-scanner'
  if (category.includes('cipher') || category.includes('protocol') || category.includes('key exchange')) return 'tls-cipher-suite-scanner'
  if (category.includes('api') || finding.algorithm.toLowerCase().includes('jwt')) return 'cloud-api-security-scanner'
  if (category.includes('source') || category.includes('web crypto') || source.includes('github')) return 'app-crypto-library-scanner'
  return 'app-crypto-library-scanner'
}

function toObservedScanner2Finding(
  finding: DefensiveFinding,
  result: DefensiveResult,
  target: AuthorizedTarget
): ScanFinding | null {
  const detectedAlgorithm = normalizeToScanner2Algorithm(finding.algorithm)
  if (!detectedAlgorithm) return null
  const scannerTarget: ScanTarget = {
    id: result.scanId,
    name: target.displayName || result.target,
    type: targetTypeToScanner2(target),
    provider: target.protocol,
    metadata: {
      authorizedTarget: target.normalized,
      observedLocation: finding.location,
      source: finding.source,
      detectionMethod: finding.detectionMethod,
    },
  }
  const riskScore = Math.max(0, Math.min(100, finding.threatLevel === 'CRITICAL' ? 95 : finding.threatLevel === 'HIGH' ? 82 : finding.threatLevel === 'MEDIUM' ? 55 : finding.threatLevel === 'LOW' ? 20 : 5))
  const quantumThreat = inferQuantumThreat(detectedAlgorithm)
  return {
    id: `scanner2-${finding.id}`,
    scanId: result.scanId,
    moduleId: scanner2ModuleForFinding(finding),
    target: scannerTarget,
    detectedAlgorithm,
    algorithmCategory: algorithmCategoryForScanner2(detectedAlgorithm),
    threatLevel: threatToScanner2Threat(finding.threatLevel),
    quantumThreat,
    isHNDLRisk: quantumThreat === 'shor' || quantumThreat === 'both' || detectedAlgorithm.startsWith('TLS'),
    description: finding.description,
    recommendation: finding.recommendation,
    quantumBreakTime: finding.threatLevel === 'SAFE' ? 'N/A' : 'Estimated by scanner_2 from observed algorithm class',
    classicalBreakTime: 'Derived from observed cryptographic metadata',
    riskScore,
    severity: riskScoreToScanner2Severity(riskScore),
    pqcReplacement: finding.pqcReplacement || replacementFor(finding.algorithm) || 'Review against NIST PQC migration policy',
    evidence: buildEvidenceForTarget(scannerTarget, {
      kind: target.type === 'ssh' ? 'ssh' : finding.category.toLowerCase().includes('certificate') ? 'certificate' : finding.detectionMethod.toLowerCase().includes('tls') ? 'tls' : 'observed',
      confidence: 'high',
      source: finding.source,
      detail: finding.evidence,
      moduleId: scanner2ModuleForFinding(finding),
    }),
    remediation: buildRemediationModel(scannerTarget),
    detectionContext: `Observed by ${finding.source}: ${finding.detectionMethod}`,
    timestamp: new Date().toISOString(),
  }
}

function isTruthy(value: unknown) {
  return value === true || value === 'true' || value === '1' || value === 'yes'
}

function parseTargetsParam(value: unknown): string[] {
  if (!value || typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => typeof item === 'string' ? item : item?.normalized || item?.raw || item?.target)
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    }
  } catch {
    // Fall through to delimiter parsing.
  }

  return trimmed
    .split(/[\n,;]+/)
    .map((target) => target.trim())
    .filter(Boolean)
}

function isPrivateOrReservedHost(host: string) {
  const lower = host.toLowerCase()
  if (lower === 'localhost' || lower.endsWith('.local')) return true
  if (lower === '0.0.0.0' || lower === '::1') return true

  const ipv4 = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false
  const [a, b] = ipv4.slice(1).map(Number)
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 168 ||
    a >= 224
  )
}

function parseSshTarget(raw: string): AuthorizedTarget | null {
  if (!raw.toLowerCase().startsWith('ssh://')) return null
  try {
    const url = new URL(raw)
    if (!url.hostname) return null
    return {
      raw,
      normalized: `ssh://${url.hostname}:${url.port || '22'}`,
      host: url.hostname.toLowerCase(),
      port: url.port ? Number(url.port) : 22,
      type: 'ssh',
      displayName: url.hostname.toLowerCase(),
      protocol: 'ssh',
    }
  } catch {
    return null
  }
}

function normalizeTarget(raw: string): { ok: true; target: AuthorizedTarget } | { ok: false; message: string } {
  const ssh = parseSshTarget(raw)
  if (ssh) {
    if (isPrivateOrReservedHost(ssh.host)) {
      return { ok: false, message: `Target "${raw}" resolves to a private/reserved host. Use a verified internal scanner agent for private assets.` }
    }
    return { ok: true, target: ssh }
  }

  const validated = validateAsset(raw)
  if (!validated.valid) return { ok: false, message: validated.error || `Invalid target: ${raw}` }

  if (validated.type === 'subnet') {
    return { ok: false, message: `CIDR range "${raw}" requires an authorized internal inventory connector or local scanner agent.` }
  }
  if (validated.type === 'hostname') {
    return { ok: false, message: `Internal hostname "${raw}" requires a verified internal scanner agent.` }
  }
  if (isPrivateOrReservedHost(validated.host)) {
    return { ok: false, message: `Target "${raw}" is private/reserved. Use a verified internal scanner agent for private assets.` }
  }

  const isGithub = /^https?:\/\/(www\.)?github\.com\/[^/\s]+\/[^/\s]+/i.test(validated.normalized)
  const port = validated.port || 443
  const targetType: DefensiveTargetType = isGithub
    ? 'github'
    : validated.type === 'url'
      ? 'url'
      : validated.type === 'ipv4' || validated.type === 'ipv6'
        ? 'ip'
        : 'domain'

  return {
    ok: true,
    target: {
      raw,
      normalized: validated.normalized,
      host: validated.host,
      port,
      type: port === 22 ? 'ssh' : targetType,
      displayName: validated.host,
      protocol: port === 22 ? 'ssh' : isGithub ? 'git' : validated.protocol === 'http' ? 'http' : 'https',
    },
  }
}

function targetToScannerInput(target: AuthorizedTarget) {
  if (target.type === 'url' || target.type === 'github') return target.normalized
  if (target.port && target.port !== 443) return `${target.host}:${target.port}`
  return target.host
}

function severityFromThreat(threat: ThreatLevel) {
  if (threat === 'CRITICAL') return 'critical'
  if (threat === 'HIGH') return 'high'
  if (threat === 'MEDIUM') return 'moderate'
  if (threat === 'LOW') return 'low'
  return 'safe'
}

function statusFromThreat(threat: ThreatLevel, algorithm: string): DefensiveFinding['status'] {
  const lower = algorithm.toLowerCase()
  if (threat === 'SAFE') return 'PQC-ready'
  if (lower.includes('unknown') || lower.includes('manual')) return 'Unknown / requires manual review'
  if (lower.includes('tlsv1') || lower.includes('sha-1') || lower.includes('md5') || lower.includes('expired')) return 'Legacy/deprecated'
  if (lower.includes('missing') || lower.includes('self-signed') || lower.includes('failed')) return 'Misconfigured'
  return 'Quantum-vulnerable'
}

function keySizeFromAlgorithm(algorithm: string, cert?: CertificateInfo | null) {
  const lower = algorithm.toLowerCase()
  if (lower.includes('rsa') && cert?.publicKeySize) return cert.publicKeySize
  const match = algorithm.match(/(?:rsa|dh|dhe|aes|p-?|nistp|ed)?[-_ ]?(\d{3,4}|\d{2,3})/i)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function replacementFor(algorithm: string) {
  const lower = algorithm.toLowerCase()
  if (lower.includes('rsa') || lower.includes('dh') || lower.includes('ecdh') || lower.includes('ecdhe') || lower.includes('x25519')) return 'ML-KEM-768 or ML-KEM hybrid key exchange'
  if (lower.includes('ecdsa') || lower.includes('ed25519') || lower.includes('dsa')) return 'ML-DSA-65'
  if (lower.includes('sha-1') || lower.includes('md5')) return 'SHA3-256'
  if (lower.includes('aes-128')) return 'AES-256-GCM'
  if (lower.includes('tls')) return 'TLS 1.3 with ML-KEM hybrid key exchange'
  if (lower.includes('ml-kem') || lower.includes('ml-dsa') || lower.includes('aes-256')) return null
  return 'Review against NIST PQC migration policy'
}

function normalizeWebFinding(finding: WebScanFinding, result: WebScanCompleteResult): DefensiveFinding {
  return {
    id: finding.id,
    algorithm: finding.algorithm,
    category: finding.category,
    location: finding.location,
    threatLevel: finding.threatLevel,
    status: statusFromThreat(finding.threatLevel, finding.algorithm),
    description: finding.description,
    recommendation: finding.recommendation,
    pqcReplacement: finding.pqcRecommendation?.recommendedPQC || replacementFor(finding.algorithm),
    keySize: keySizeFromAlgorithm(finding.algorithm, result.certificateInfo),
    evidence: `${finding.phase}: ${finding.location}`,
    detectionMethod: finding.phase,
    source: 'web-scanner',
    raw: finding,
  }
}

function normalizeWebResult(result: WebScanCompleteResult, startedAt: string): DefensiveResult {
  const completedAt = new Date().toISOString()
  return {
    scanId: result.scanId,
    target: result.target,
    targetType: result.targetType,
    startedAt,
    completedAt,
    durationMs: Math.round(result.scanDuration * 1000),
    status: 'completed',
    riskScore: result.overallRiskScore,
    qScore: result.legacyQScore,
    riskLevel: result.riskLevel,
    findings: result.findings.map((finding) => normalizeWebFinding(finding, result)),
    certificateInfo: result.certificateInfo,
    tlsVersion: result.tlsAnalysis?.tlsVersion || null,
    metadata: {
      targetType: result.targetType,
      tlsAnalysis: result.tlsAnalysis,
      cipherSuiteBreakdown: result.cipherSuiteBreakdown,
      repoScanResult: result.repoScanResult,
      webCryptoResult: result.webCryptoResult,
      apiSecurityResult: result.apiSecurityResult,
      pqcRecommendations: result.pqcRecommendations,
      riskBreakdown: result.riskBreakdown,
      detectionRuleResults: result.detectionRuleResults,
      runtimeHealth: result.runtimeHealth,
      scanConfidence: result.scanConfidence,
    },
  }
}

function sendSse(res: Response, event: Record<string, unknown>) {
  if (res.writableEnded) return
  res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n\n`)
}

function parseNameList(buffer: Buffer, offset: number) {
  if (offset + 4 > buffer.length) return { values: [] as string[], offset: buffer.length }
  const length = buffer.readUInt32BE(offset)
  const start = offset + 4
  const end = start + length
  if (end > buffer.length) return { values: [] as string[], offset: buffer.length }
  const values = buffer.toString('utf8', start, end).split(',').filter(Boolean)
  return { values, offset: end }
}

function parseSshKexInit(data: Buffer) {
  if (data.length < 6) return null
  const packetLength = data.readUInt32BE(0)
  const paddingLength = data.readUInt8(4)
  const payloadStart = 5
  const payloadEnd = 4 + packetLength - paddingLength
  if (payloadEnd <= payloadStart || payloadEnd > data.length) return null
  const payload = data.subarray(payloadStart, payloadEnd)
  if (payload[0] !== 20) return null

  let offset = 17
  const kex = parseNameList(payload, offset)
  offset = kex.offset
  const hostKey = parseNameList(payload, offset)

  return {
    kexAlgorithms: kex.values,
    hostKeyAlgorithms: hostKey.values,
  }
}

function sshThreatForAlgorithm(algorithm: string): ThreatLevel {
  const lower = algorithm.toLowerCase()
  if (lower.includes('sntrup') || lower.includes('ml-kem') || lower.includes('kyber')) return 'SAFE'
  if (lower.includes('group1') || lower.includes('sha1') || lower === 'ssh-rsa') return 'CRITICAL'
  if (lower.includes('diffie-hellman') || lower.includes('ecdh') || lower.includes('ecdsa') || lower.includes('ed25519') || lower.includes('rsa') || lower.includes('curve25519')) return 'HIGH'
  return 'MEDIUM'
}

function sshCategoryForAlgorithm(algorithm: string) {
  const lower = algorithm.toLowerCase()
  if (lower.includes('diffie') || lower.includes('ecdh') || lower.includes('curve25519') || lower.includes('sntrup')) return 'SSH Key Exchange'
  return 'SSH Host Key'
}

async function scanSshMetadata(target: AuthorizedTarget, emit: (event: Record<string, unknown>) => void): Promise<DefensiveResult> {
  const scanId = randomId('ssh-scan')
  const startedAt = new Date().toISOString()
  emit({ type: 'module-start', scanId, moduleName: 'SSH Metadata Scanner', target: target.normalized, progress: 20, message: 'Collecting SSH public metadata' })

  const metadata = await new Promise<{ banner: string | null; kexAlgorithms: string[]; hostKeyAlgorithms: string[] }>((resolve, reject) => {
    const socket = net.createConnection({ host: target.host, port: target.port })
    const chunks: Buffer[] = []
    let banner: string | null = null
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error('SSH metadata collection timed out'))
    }, 8000)

    socket.on('data', (chunk) => {
      chunks.push(chunk)
      const combined = Buffer.concat(chunks)
      const asText = combined.toString('utf8')
      if (!banner && asText.includes('\n')) {
        banner = asText.split(/\r?\n/)[0]
        socket.write('SSH-2.0-QGuard_Defensive_CryptoScanner\r\n')
        emit({ type: 'phase-complete', scanId, phase: 'ssh-banner', progress: 35, message: 'SSH server banner collected' })
      }

      const binaryStart = combined.findIndex((byte) => byte === 0 && banner !== null)
      const possiblePacket = binaryStart >= 0 ? combined.subarray(binaryStart) : Buffer.alloc(0)
      const parsed = parseSshKexInit(possiblePacket)
      if (parsed) {
        clearTimeout(timer)
        socket.end()
        resolve({ banner, ...parsed })
      }
    })

    socket.on('connect', () => emit({ type: 'phase-complete', scanId, phase: 'target-resolved', progress: 25, message: 'SSH target reachable' }))
    socket.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    socket.on('close', () => {
      if (!banner) return
      clearTimeout(timer)
      resolve({ banner, kexAlgorithms: [], hostKeyAlgorithms: [] })
    })
  })

  const findings: DefensiveFinding[] = []
  const observedAlgorithms = [
    ...metadata.kexAlgorithms.slice(0, 12).map((algorithm) => ({ algorithm, category: 'SSH Key Exchange' })),
    ...metadata.hostKeyAlgorithms.slice(0, 12).map((algorithm) => ({ algorithm, category: 'SSH Host Key' })),
  ]

  for (const observed of observedAlgorithms) {
    const threatLevel = sshThreatForAlgorithm(observed.algorithm)
    findings.push({
      id: randomId('ssh-finding'),
      algorithm: observed.algorithm,
      category: observed.category || sshCategoryForAlgorithm(observed.algorithm),
      location: `${target.host}:${target.port}`,
      threatLevel,
      status: statusFromThreat(threatLevel, observed.algorithm),
      description: `SSH endpoint advertises ${observed.algorithm} in ${observed.category.toLowerCase()} metadata.`,
      recommendation: threatLevel === 'SAFE'
        ? 'No immediate action required for this advertised PQC/hybrid algorithm.'
        : 'Prefer OpenSSH post-quantum hybrid key exchange where available and plan ML-DSA host key migration.',
      pqcReplacement: replacementFor(observed.algorithm),
      keySize: keySizeFromAlgorithm(observed.algorithm),
      evidence: `SSH banner "${metadata.banner || 'unknown'}"; advertised ${observed.category}: ${observed.algorithm}`,
      detectionMethod: 'ssh-public-metadata',
      source: 'ssh-metadata-scanner',
      raw: metadata,
    })
  }

  if (findings.length === 0) {
    findings.push({
      id: randomId('ssh-finding'),
      algorithm: 'SSH algorithms unavailable',
      category: 'SSH Metadata',
      location: `${target.host}:${target.port}`,
      threatLevel: 'LOW',
      status: 'Unknown / requires manual review',
      description: 'SSH banner was collected but the server did not expose KEXINIT metadata before timeout.',
      recommendation: 'Review SSH host key and key exchange configuration from the authorized server configuration or local agent.',
      pqcReplacement: 'Manual review',
      keySize: null,
      evidence: `SSH banner "${metadata.banner || 'unknown'}"`,
      detectionMethod: 'ssh-public-metadata',
      source: 'ssh-metadata-scanner',
      raw: metadata,
    })
  }

  const critical = findings.filter((finding) => finding.threatLevel === 'CRITICAL').length
  const high = findings.filter((finding) => finding.threatLevel === 'HIGH').length
  const medium = findings.filter((finding) => finding.threatLevel === 'MEDIUM').length
  const riskScore = Math.max(0, Math.min(100, critical * 40 + high * 25 + medium * 12 + findings.length * 2))
  const completedAt = new Date().toISOString()

  return {
    scanId,
    target: target.normalized,
    targetType: 'ssh',
    startedAt,
    completedAt,
    durationMs: Date.parse(completedAt) - Date.parse(startedAt),
    status: 'completed',
    riskScore,
    qScore: Math.max(0, 100 - riskScore),
    riskLevel: critical ? 'CRITICAL' : high ? 'HIGH' : medium ? 'MEDIUM' : 'LOW',
    findings,
    tlsVersion: null,
    metadata: {
      banner: metadata.banner,
      kexAlgorithms: metadata.kexAlgorithms,
      hostKeyAlgorithms: metadata.hostKeyAlgorithms,
    },
  }
}

function getDbClient(token: string) {
  return createAuthClient(token) || getServiceClient()
}

async function dbSelectUserAssets(client: any, userId: string) {
  if (!client) return []
  const { data, error } = await client.from('assets').select('*').eq('user_id', userId)
  if (error) throw error
  return data || []
}

async function createSession(client: any, userId: string, targets: AuthorizedTarget[], telemetry: unknown[]) {
  const now = new Date().toISOString()
  const base = {
    user_id: userId,
    status: 'running',
    target_scope: targets.map((target) => target.normalized).join(', '),
    progress: 0,
    total_assets: targets.length,
    scanned_assets: 0,
    findings_count: 0,
    metadata: {
      authorization: 'explicit-user-acknowledgement',
      scannerMode: 'defensive-cryptographic-inventory',
      targets,
      telemetry,
    },
    started_at: now,
    updated_at: now,
  }

  if (client) {
    const { data, error } = await client.from('pqc_scan_sessions').insert(base).select('id').single()
    if (!error && data?.id) return { id: data.id as string, mode: 'database' as PersistenceMode }
  }

  const memorySession: MemorySession = {
    id: randomId('session'),
    ...base,
    completed_at: null,
    created_at: now,
  }
  memoryStore.sessions.unshift(memorySession)
  return { id: memorySession.id, mode: 'memory' as PersistenceMode }
}

async function updateSession(client: any, sessionId: string, userId: string, patch: Record<string, unknown>, mode: PersistenceMode) {
  const nextPatch = { ...patch, updated_at: new Date().toISOString() }
  if (mode === 'database' && client) {
    const { error } = await client.from('pqc_scan_sessions').update(nextPatch).eq('id', sessionId).eq('user_id', userId)
    if (!error) return true
  }

  const session = memoryStore.sessions.find((item) => item.id === sessionId && item.user_id === userId)
  if (session) Object.assign(session, nextPatch)
  return false
}

function assetTypeFor(target: AuthorizedTarget) {
  if (target.type === 'github') return 'application'
  if (target.type === 'ssh') return 'ssh_endpoint'
  if (target.type === 'ip') return 'server'
  if (target.type === 'url') return 'web_application'
  return 'tls_endpoint'
}

function criticalityFromRisk(riskScore: number) {
  if (riskScore >= 80) return 'critical'
  if (riskScore >= 60) return 'high'
  if (riskScore >= 40) return 'medium'
  return 'low'
}

async function upsertAsset(client: any, userId: string, target: AuthorizedTarget, result: DefensiveResult, mode: PersistenceMode) {
  const now = new Date().toISOString()
  const assetName = target.displayName || result.target
  const metadata = {
    authorized_target: target.normalized,
    last_scanned_at: result.completedAt,
    last_scan_id: result.scanId,
    target_type: target.type,
    protocol: target.protocol,
    port: target.port,
    riskScore: result.riskScore,
    qScore: result.qScore,
    riskLevel: result.riskLevel,
    certificate: result.certificateInfo || null,
    tlsVersion: result.tlsVersion || null,
  }

  if (mode === 'database' && client) {
    const { data: existing } = await client
      .from('assets')
      .select('*')
      .eq('user_id', userId)
      .eq('name', assetName)
      .limit(1)

    if (existing?.[0]?.id) {
      const { data, error } = await client
        .from('assets')
        .update({
          type: assetTypeFor(target),
          ip_address: target.type === 'ip' ? target.host : null,
          criticality: criticalityFromRisk(result.riskScore),
          status: 'active',
          metadata: { ...(existing[0].metadata || {}), ...metadata },
          updated_at: now,
        })
        .eq('id', existing[0].id)
        .eq('user_id', userId)
        .select('id')
        .single()
      if (!error && data?.id) return data.id as string
      return existing[0].id as string
    }

    const { data, error } = await client
      .from('assets')
      .insert({
        user_id: userId,
        name: assetName,
        type: assetTypeFor(target),
        ip_address: target.type === 'ip' ? target.host : null,
        criticality: criticalityFromRisk(result.riskScore),
        status: 'active',
        metadata,
      })
      .select('id')
      .single()
    if (!error && data?.id) return data.id as string
  }

  const existingMemory = memoryStore.assets.find((asset) => asset.user_id === userId && asset.name === assetName)
  if (existingMemory) {
    existingMemory.type = assetTypeFor(target)
    existingMemory.ip_address = target.type === 'ip' ? target.host : null
    existingMemory.criticality = criticalityFromRisk(result.riskScore)
    existingMemory.metadata = { ...existingMemory.metadata, ...metadata }
    existingMemory.updated_at = now
    return existingMemory.id
  }

  const memoryAsset: MemoryAsset = {
    id: randomId('asset'),
    user_id: userId,
    name: assetName,
    type: assetTypeFor(target),
    ip_address: target.type === 'ip' ? target.host : null,
    criticality: criticalityFromRisk(result.riskScore),
    status: 'active',
    metadata,
    created_at: now,
    updated_at: now,
  }
  memoryStore.assets.unshift(memoryAsset)
  return memoryAsset.id
}

function itemTypeFor(finding: DefensiveFinding) {
  const category = finding.category.toLowerCase()
  if (category.includes('certificate')) return 'certificate'
  if (category.includes('key exchange')) return 'key-exchange'
  if (category.includes('hash')) return 'hash'
  if (category.includes('protocol') || category.includes('tls') || category.includes('ssh')) return 'protocol'
  if (category.includes('library') || category.includes('source code') || category.includes('web crypto')) return 'library'
  return 'algorithm'
}

function exposureTypeFor(finding: DefensiveFinding) {
  const algorithm = finding.algorithm.toLowerCase()
  if (algorithm.includes('rsa')) return 'rsa'
  if (algorithm.includes('ecdsa') || algorithm.includes('ecdh') || algorithm.includes('ecdhe') || algorithm.includes('ed25519') || algorithm.includes('x25519')) return 'ecc'
  if (algorithm.includes('diffie') || algorithm.includes('dh')) return 'dh'
  if (algorithm.includes('tls')) return 'weak_tls'
  if (algorithm.includes('sha-1')) return 'sha1'
  if (algorithm.includes('md5')) return 'md5'
  if (algorithm.includes('aes-128')) return 'symmetric_policy'
  if (finding.category.toLowerCase().includes('certificate')) return 'certificate'
  return 'crypto_review'
}

async function persistResult(client: any, userId: string, sessionId: string, target: AuthorizedTarget, result: DefensiveResult, mode: PersistenceMode) {
  const assetId = await upsertAsset(client, userId, target, result, mode)
  const now = new Date().toISOString()
  const cbomIds: string[] = []
  const exposureIds: string[] = []

  for (const finding of result.findings) {
    const isQuantumSafe = finding.threatLevel === 'SAFE'
    const isVulnerable = !isQuantumSafe && finding.status !== 'Unknown / requires manual review'
    const commonMetadata = {
      scanId: result.scanId,
      scanSessionId: sessionId,
      target: target.normalized,
      status: finding.status,
      pqcReplacement: finding.pqcReplacement,
      evidence: finding.evidence,
      detectionMethod: finding.detectionMethod,
      source: finding.source,
      recommendation: finding.recommendation,
      raw: finding.raw,
    }

    if (mode === 'database' && client) {
      const { data: inventoryData } = await client
        .from('crypto_inventory')
        .insert({
          user_id: userId,
          asset_id: assetId,
          item_type: itemTypeFor(finding),
          name: `${finding.category}: ${finding.algorithm}`,
          algorithm: finding.algorithm,
          key_size: finding.keySize,
          protocol: result.tlsVersion || (target.type === 'ssh' ? 'SSH' : target.protocol.toUpperCase()),
          exposure_level: severityFromThreat(finding.threatLevel),
          is_vulnerable: isVulnerable,
          is_quantum_safe: isQuantumSafe,
          metadata: commonMetadata,
          discovered_at: now,
        })
        .select('id')
        .single()
      if (inventoryData?.id) cbomIds.push(inventoryData.id)

      const { data: resultData } = await client
        .from('pqc_scan_results')
        .insert({
          user_id: userId,
          scan_session_id: sessionId,
          asset_id: assetId,
          finding_type: finding.category,
          algorithm: finding.algorithm,
          threat_level: severityFromThreat(finding.threatLevel),
          description: finding.description,
          remediation: finding.recommendation,
          metadata: commonMetadata,
        })
        .select('id')
        .single()
      if (resultData?.id) {
        // Result IDs are stored in session metadata; no separate array needed here.
      }

      if (isVulnerable) {
        const { data: exposureData } = await client
          .from('crypto_exposures')
          .insert({
            user_id: userId,
            asset_id: assetId,
            exposure_type: exposureTypeFor(finding),
            severity: severityFromThreat(finding.threatLevel),
            description: finding.description,
            detected_value: finding.algorithm,
            metadata: commonMetadata,
          })
          .select('id')
          .single()
        if (exposureData?.id) exposureIds.push(exposureData.id)

        await client.from('vulnerabilities').insert({
          user_id: userId,
          asset_id: assetId,
          title: `${finding.algorithm} ${finding.status}`,
          description: finding.description,
          severity: severityFromThreat(finding.threatLevel),
          status: 'open',
          source: 'authorized_crypto_scan',
          metadata: commonMetadata,
        })
      }
    } else {
      const inventoryId = randomId('cbom')
      memoryStore.inventory.unshift({
        id: inventoryId,
        user_id: userId,
        asset_id: assetId,
        item_type: itemTypeFor(finding),
        name: `${finding.category}: ${finding.algorithm}`,
        algorithm: finding.algorithm,
        key_size: finding.keySize,
        protocol: result.tlsVersion || (target.type === 'ssh' ? 'SSH' : target.protocol.toUpperCase()),
        exposure_level: severityFromThreat(finding.threatLevel),
        is_vulnerable: isVulnerable,
        is_quantum_safe: isQuantumSafe,
        metadata: commonMetadata,
        discovered_at: now,
        created_at: now,
      })
      cbomIds.push(inventoryId)

      memoryStore.results.unshift({
        id: randomId('result'),
        user_id: userId,
        scan_session_id: sessionId,
        asset_id: assetId,
        finding_type: finding.category,
        algorithm: finding.algorithm,
        threat_level: severityFromThreat(finding.threatLevel),
        description: finding.description,
        remediation: finding.recommendation,
        metadata: commonMetadata,
        created_at: now,
      })

      if (isVulnerable) {
        const exposureId = randomId('exposure')
        memoryStore.exposures.unshift({
          id: exposureId,
          user_id: userId,
          asset_id: assetId,
          exposure_type: exposureTypeFor(finding),
          severity: severityFromThreat(finding.threatLevel),
          description: finding.description,
          detected_value: finding.algorithm,
          metadata: commonMetadata,
          created_at: now,
          updated_at: now,
        })
        exposureIds.push(exposureId)
      }
    }
  }

  if (result.certificateInfo && mode === 'database' && client) {
    await client.from('certificates').insert({
      user_id: userId,
      asset_id: assetId,
      name: `TLS certificate for ${target.displayName}`,
      algorithm: result.certificateInfo.publicKeyAlgorithm,
      key_size: result.certificateInfo.publicKeySize,
      issuer: Object.values(result.certificateInfo.issuer || {}).join(', '),
      subject: Object.values(result.certificateInfo.subject || {}).join(', '),
      serial_number: result.certificateInfo.serialNumber,
      not_before: result.certificateInfo.validFrom,
      not_after: result.certificateInfo.validTo,
      is_quantum_safe: false,
      is_expiring_soon: Date.parse(result.certificateInfo.validTo) < Date.now() + 30 * 86400000,
      status: result.certificateInfo.isExpired ? 'expired' : 'active',
      metadata: { scanId: result.scanId, target: target.normalized, fingerprint: result.certificateInfo.fingerprint },
    })
  }

  if (mode === 'database' && client) {
    await client.from('security_events').insert({
      user_id: userId,
      event_type: 'authorized_crypto_scan_completed',
      severity: result.riskLevel === 'CRITICAL' || result.riskLevel === 'HIGH' ? 'warning' : 'success',
      message: `Authorized cryptographic inventory scan completed for ${target.normalized}`,
      asset_id: assetId,
      resource_name: target.displayName,
      resource_type: assetTypeFor(target),
      metadata: { scanId: result.scanId, scanSessionId: sessionId, findings: result.findings.length, riskScore: result.riskScore },
    })
    await client.from('audit_logs').insert({
      user_id: userId,
      action: 'authorized_crypto_scan_completed',
      entity_type: 'pqc_scan_session',
      entity_id: sessionId,
      details: { target: target.normalized, assetId, cbomIds, exposureIds, riskScore: result.riskScore },
    })
  }

  return { assetId, cbomIds, exposureIds }
}

function buildSummary(results: DefensiveResult[]) {
  const findings = results.flatMap((result) => result.findings)
  const critical = findings.filter((finding) => finding.threatLevel === 'CRITICAL').length
  const high = findings.filter((finding) => finding.threatLevel === 'HIGH').length
  const medium = findings.filter((finding) => finding.threatLevel === 'MEDIUM').length
  const low = findings.filter((finding) => finding.threatLevel === 'LOW').length
  const safe = findings.filter((finding) => finding.threatLevel === 'SAFE').length
  const riskScore = results.length
    ? Math.round(results.reduce((sum, result) => sum + result.riskScore, 0) / results.length)
    : 0
  return {
    targetsScanned: results.length,
    totalFindings: findings.length,
    critical,
    high,
    medium,
    low,
    safe,
    vulnerable: findings.filter((finding) => finding.status === 'Quantum-vulnerable' || finding.status === 'Legacy/deprecated' || finding.status === 'Misconfigured').length,
    pqcReady: safe,
    riskScore,
    qScore: Math.max(0, 100 - riskScore),
  }
}

function buildLiveSummary(results: DefensiveResult[], extraFindings: DefensiveFinding[] = []) {
  const committed = results.flatMap((result) => result.findings)
  const findings = committed.concat(extraFindings)
  const critical = findings.filter((finding) => finding.threatLevel === 'CRITICAL').length
  const high = findings.filter((finding) => finding.threatLevel === 'HIGH').length
  const medium = findings.filter((finding) => finding.threatLevel === 'MEDIUM').length
  const low = findings.filter((finding) => finding.threatLevel === 'LOW').length
  const safe = findings.filter((finding) => finding.threatLevel === 'SAFE').length
  const committedRisk = results.length ? results.reduce((sum, result) => sum + result.riskScore, 0) / results.length : 0
  const liveRisk = Math.min(100, committedRisk + critical * 10 + high * 6 + medium * 3 + low + extraFindings.length)
  return {
    targetsScanned: results.length,
    totalFindings: findings.length,
    critical,
    high,
    medium,
    low,
    safe,
    vulnerable: findings.filter((finding) => finding.status === 'Quantum-vulnerable' || finding.status === 'Legacy/deprecated' || finding.status === 'Misconfigured').length,
    pqcReady: safe,
    riskScore: Math.round(liveRisk),
    qScore: Math.max(0, 100 - Math.round(liveRisk)),
  }
}

function runEnterpriseScanner2Pass(items: Array<{ target: AuthorizedTarget; result: DefensiveResult }>): EnterpriseScanner2Result {
  const observedFindings = items.flatMap(({ target, result }) =>
    result.findings
      .map((finding) => toObservedScanner2Finding(finding, result, target))
      .filter((finding): finding is ScanFinding => Boolean(finding))
  )
  const enrichedFindings = matchFingerprints(observedFindings)
  const ruleResults = evaluateFindings(enrichedFindings)

  for (const ruleResult of ruleResults) {
    const finding = enrichedFindings.find((item) => item.id === ruleResult.finding.id)
    if (finding && ruleResult.adjustedRiskScore > finding.riskScore) {
      finding.riskScore = ruleResult.adjustedRiskScore
      finding.severity = ruleResult.severity
      finding.ruleId = ruleResult.ruleId
    }
  }

  const hndlRisks = analyzeHNDLRisks(enrichedFindings)
  const attackAssessment = buildQuantumRiskAssessment(enrichedFindings)
  const quantumRiskScore = calculateQuantumRiskScore(enrichedFindings)
  const quantumReadiness = calculateQuantumReadiness(enrichedFindings)
  const migrationRecommendations = Array.from(
    new Map(
      enrichedFindings
        .map((finding) => getMigrationRecommendation(finding.detectedAlgorithm))
        .filter(Boolean)
        .map((recommendation) => [recommendation!.classicalAlgorithm, recommendation])
    ).values()
  )

  return {
    observedFindings,
    enrichedFindings,
    ruleResults,
    hndlRisks,
    attackAssessment,
    quantumRiskScore,
    quantumReadiness,
    migrationRecommendations,
  }
}

router.get('/capabilities', (req, res) => {
  const runtimeHealth = getScannerRuntimeHealth()
  res.json({
    data: {
      mode: 'defensive-authorized-cryptographic-inventory',
      webScanner: runtimeHealth.webScanner,
      enterpriseScanner: {
        modules: SCAN_MODULES.length,
        detectionRules: ENTERPRISE_DETECTION_RULES.length,
        cryptoFingerprints: CRYPTO_FINGERPRINTS.length,
      },
      runtimeHealth,
      safety: {
        authorizationRequired: true,
        exploitPayloads: false,
        credentialCollection: false,
        stealthScanning: false,
        privateNetworkScanning: 'requires verified internal scanner agent',
      },
    },
  })
})

router.get('/stream', async (req, res) => {
  const user = (req as any).user
  const token = (req as any).token as string
  const explicitAuthorization = isTruthy(req.query.authorized)
  const rawTargets = parseTargetsParam(req.query.targets)

  if (!explicitAuthorization) {
    res.status(403).json({
      error: {
        code: 'AUTHORIZATION_ACK_REQUIRED',
        message: 'Confirm that every submitted target belongs to you or is explicitly authorized for defensive cryptographic inventory scanning.',
      },
    })
    return
  }

  if (rawTargets.length === 0) {
    res.status(400).json({ error: { code: 'INVALID_TARGET', message: 'At least one authorized target is required.' } })
    return
  }

  if (rawTargets.length > 25) {
    res.status(400).json({ error: { code: 'TARGET_LIMIT_EXCEEDED', message: 'Scan at most 25 authorized targets per job.' } })
    return
  }

  const normalized: AuthorizedTarget[] = []
  for (const raw of rawTargets) {
    const parsed = normalizeTarget(raw)
    if (parsed.ok === false) {
      res.status(400).json({ error: { code: 'INVALID_OR_UNAUTHORIZED_TARGET', message: parsed.message } })
      return
    }
    normalized.push(parsed.target)
  }

  const jobId = randomId('job')
  activeJobs.set(jobId, { cancelled: false })
  const telemetry: Record<string, unknown>[] = []
  const moduleStates = createModuleStates()
  const client = getDbClient(token)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const emit = (event: Record<string, unknown>) => {
    telemetry.push({ timestamp: new Date().toISOString(), ...event })
    sendSse(res, { jobId, ...event })
  }

  const updateModule = (
    moduleId: string,
    patch: Partial<Omit<ScannerModuleState, 'id' | 'name'>>,
    message?: string
  ) => {
    const state = moduleStates.find((module) => module.id === moduleId)
    if (!state) return
    const now = new Date().toISOString()
    if (patch.status === 'Running' && !state.startedAt) state.startedAt = now
    Object.assign(state, patch)
    if (patch.status && ['Completed', 'Failed', 'Skipped', 'No findings'].includes(patch.status)) {
      state.completedAt = patch.completedAt || now
      if (state.startedAt) state.durationMs = Math.max(0, Date.parse(state.completedAt) - Date.parse(state.startedAt))
    }
    emit({
      type: 'module-state',
      status: 'running',
      module: state,
      moduleId: state.id,
      moduleName: state.name,
      moduleStatus: state.status,
      message: message || `${state.name}: ${state.status}`,
    })
  }

  const emitFinding = (finding: DefensiveFinding, summary: ReturnType<typeof buildSummary>) => {
    const moduleId = moduleIdForFinding(finding)
    const state = moduleStates.find((module) => module.id === moduleId)
    if (state) {
      const relatedFindings = results.flatMap((result) => result.findings).concat(finding).filter((item) => moduleIdForFinding(item) === moduleId)
      state.findingsCount = relatedFindings.length
      state.severityCounts = countFindingSeverities(relatedFindings)
    }
    emit({
      type: 'finding-detected',
      status: 'running',
      finding,
      summary,
      moduleId,
      moduleName: state?.name,
      severity: finding.threatLevel,
      message: `${terminalSeverity(finding.threatLevel)}: ${finding.algorithm} detected on ${finding.location}`,
    })
  }

  req.on('close', () => {
    const state = activeJobs.get(jobId)
    if (state) state.cancelled = true
  })

  let session: { id: string; mode: PersistenceMode } | null = null
  const results: DefensiveResult[] = []
  const scanner2Inputs: Array<{ target: AuthorizedTarget; result: DefensiveResult }> = []
  const linkedAssetIds: string[] = []
  const linkedCbomIds: string[] = []
  const linkedExposureIds: string[] = []
  const errors: string[] = []

  try {
    emit({ type: 'scan-start', status: 'queued', progress: 0, message: 'Scan job created', targets: normalized, moduleCatalog: moduleStates })
    emit({ type: 'module-catalog', status: 'queued', progress: 0, message: 'Scanner module catalog queued', modules: moduleStates })
    session = await createSession(client, user.id, normalized, telemetry)
    updateModule('target-validation', { status: 'Running', target: normalized.map((target) => target.normalized).join(', ') }, 'Authorization validation running')
    emit({ type: 'authorization-validated', status: 'running', scanSessionId: session.id, persistence: session.mode, progress: 3, message: 'Authorization acknowledged and user scope validated' })
    updateModule('target-validation', { status: 'Completed', findingsCount: 0 }, 'Authorization validated and targets accepted')
    emit({ type: 'target-accepted', status: 'running', progress: 4, message: `${normalized.length} authorized target(s) accepted` })
    emit({ type: 'engine-status', status: 'running', progress: 5, message: 'Scanner modules initialized', modules: { web: getScannerRuntimeHealth().webScanner, enterprise: { modules: SCAN_MODULES.length, rules: ENTERPRISE_DETECTION_RULES.length, fingerprints: CRYPTO_FINGERPRINTS.length } } })
    updateModule('scanner2-module-registry', { status: 'Running' }, 'Scanner_2 module registry loading')
    updateModule('scanner2-module-registry', { status: 'Completed', findingsCount: SCAN_MODULES.length }, `${SCAN_MODULES.length} scanner_2 module definitions loaded for capability matching`)

    for (let index = 0; index < normalized.length; index++) {
      const target = normalized[index]
      const state = activeJobs.get(jobId)
      if (state?.cancelled) {
        emit({ type: 'scan-cancelled', status: 'cancelled', progress: Math.round((index / normalized.length) * 100), message: 'Scan cancellation requested by user' })
        await updateSession(client, session.id, user.id, { status: 'cancelled', completed_at: new Date().toISOString(), metadata: { targets: normalized, telemetry, moduleStates, results, errors } }, session.mode)
        res.end()
        return
      }

      const baseProgress = (index / normalized.length) * 100
      emit({ type: 'target-validated', status: 'running', target: target.normalized, progress: Math.round(baseProgress + 5), message: `Target validated: ${target.normalized}` })

      let result: DefensiveResult
      const targetStart = new Date().toISOString()
      if (target.type === 'ssh') {
        updateModule('ssh-host-key-scanner', { status: 'Running', target: target.normalized }, 'SSH host key scanner running')
        ;['tls-protocol-scanner', 'certificate-scanner', 'cipher-suite-scanner', 'key-exchange-scanner', 'signature-algorithm-scanner', 'hash-algorithm-scanner', 'jwt-signing-scanner', 'dependency-crypto-scanner'].forEach((moduleId) => {
          updateModule(moduleId, { status: 'Skipped', target: target.normalized }, `${SCANNER_MODULE_CATALOG.find((module) => module.id === moduleId)?.name || moduleId} skipped for SSH target`)
        })
        result = await scanSshMetadata(target, (event) => {
          const eventProgress = typeof event.progress === 'number' ? event.progress : 20
          emit({ ...event, status: 'running', target: target.normalized, progress: Math.round(baseProgress + eventProgress / normalized.length) })
        })
        updateModule('ssh-host-key-scanner', {
          status: result.findings.length > 0 ? 'Completed' : 'No findings',
          target: target.normalized,
          findingsCount: result.findings.length,
          severityCounts: countFindingSeverities(result.findings),
        }, 'SSH host key scanner completed')
        for (const finding of result.findings) {
          emitFinding(finding, buildLiveSummary(results, result.findings))
        }
      } else {
        updateModule('ssh-host-key-scanner', { status: 'Skipped', target: target.normalized }, 'SSH host key scanner skipped for non-SSH target')
        result = normalizeWebResult(
          await executeWebScan(targetToScannerInput(target), target.type as WebScanTargetType, (event: SSEEvent) => {
            const eventProgress = typeof event.progress === 'number' ? event.progress : 10
            const message = String(event.label || event.moduleName || event.message || event.type)
            const canonicalModuleId = mapWebModule(event.moduleId, event.moduleName, event.phase)
            if (canonicalModuleId && event.type === 'module-start') {
              updateModule(canonicalModuleId, { status: 'Running', target: target.normalized }, `${SCANNER_MODULE_CATALOG.find((module) => module.id === canonicalModuleId)?.name || event.moduleName} running`)
            }
            if (canonicalModuleId && event.type === 'module-complete') {
              const errorText = typeof event.error === 'string' ? event.error : null
              const findingCount = typeof event.findingCount === 'number' ? event.findingCount : 0
              const moduleStatus: ScannerModuleStatus = errorText?.toLowerCase().includes('skipped')
                ? 'Skipped'
                : errorText && !errorText.toLowerCase().includes('unavailable') && findingCount === 0
                  ? 'Failed'
                  : findingCount === 0
                    ? 'No findings'
                    : 'Completed'
              updateModule(canonicalModuleId, {
                status: moduleStatus,
                target: target.normalized,
                findingsCount: findingCount,
                error: errorText,
              }, `${SCANNER_MODULE_CATALOG.find((module) => module.id === canonicalModuleId)?.name || event.moduleName}: ${moduleStatus}`)
            }
            const normalizedFinding = event.finding ? normalizeWebFinding(event.finding as WebScanFinding, { certificateInfo: null } as WebScanCompleteResult) : undefined
            if (normalizedFinding) emitFinding(normalizedFinding, buildLiveSummary(results, [normalizedFinding]))
            emit({
              ...event,
              type: event.type,
              status: event.type === 'scan-complete' ? 'analyzing' : 'running',
              target: target.normalized,
              progress: Math.round(baseProgress + eventProgress / normalized.length),
              message,
              finding: normalizedFinding,
            })
          }),
          targetStart
        )
        const groupedByModule = new Map<string, DefensiveFinding[]>()
        for (const finding of result.findings) {
          const moduleId = moduleIdForFinding(finding)
          groupedByModule.set(moduleId, [...(groupedByModule.get(moduleId) || []), finding])
        }
        for (const [moduleId, moduleFindings] of groupedByModule) {
          const current = moduleStates.find((module) => module.id === moduleId)
          if (!current || current.status === 'Failed') continue
          updateModule(moduleId, {
            status: moduleFindings.length > 0 ? 'Completed' : 'No findings',
            target: target.normalized,
            findingsCount: moduleFindings.length,
            severityCounts: countFindingSeverities(moduleFindings),
          }, `${current.name}: ${moduleFindings.length} finding(s) synchronized`)
        }
      }

      emit({ type: 'crypto-components-identified', status: 'analyzing', target: target.normalized, progress: Math.round(baseProgress + 85 / normalized.length), message: `${result.findings.length} cryptographic component(s) identified` })
      updateModule('cbom-generator', { status: 'Running', target: target.normalized }, 'CBOM generator running')
      updateModule('crypto-exposure-graph-builder', { status: 'Running', target: target.normalized }, 'Crypto exposure mapper running')
      updateModule('asset-inventory-synchronizer', { status: 'Running', target: target.normalized }, 'Asset inventory synchronizer running')
      updateModule('audit-history-logger', { status: 'Running', target: target.normalized }, 'Audit/history logger running')
      const linked = await persistResult(client, user.id, session.id, target, result, session.mode)
      linkedAssetIds.push(linked.assetId)
      linkedCbomIds.push(...linked.cbomIds)
      linkedExposureIds.push(...linked.exposureIds)
      results.push(result)
      scanner2Inputs.push({ target, result })
      updateModule('cbom-generator', { status: linked.cbomIds.length > 0 ? 'Completed' : 'No findings', target: target.normalized, findingsCount: linked.cbomIds.length }, 'CBOM records updated')
      updateModule('crypto-exposure-graph-builder', { status: linked.exposureIds.length > 0 ? 'Completed' : 'No findings', target: target.normalized, findingsCount: linked.exposureIds.length }, 'Crypto exposure map updated')
      updateModule('asset-inventory-synchronizer', { status: 'Completed', target: target.normalized, findingsCount: 1 }, 'Asset inventory updated')
      updateModule('audit-history-logger', { status: 'Completed', target: target.normalized, findingsCount: 1 }, 'Audit/history records updated')
      emit({ type: 'cbom-generated', status: 'analyzing', target: target.normalized, progress: Math.round(baseProgress + 92 / normalized.length), message: `${linked.cbomIds.length} CBOM record(s) generated`, linkedCbomIds, moduleStates })
      emit({ type: 'asset-inventory-updated', status: 'analyzing', target: target.normalized, progress: Math.round(baseProgress + 96 / normalized.length), message: 'Asset inventory and exposure data updated', linkedAssetIds, linkedExposureIds, moduleStates })
      await updateSession(client, session.id, user.id, {
        progress: Math.round(((index + 1) / normalized.length) * 100),
        scanned_assets: index + 1,
        findings_count: results.reduce((sum, item) => sum + item.findings.length, 0),
      }, session.mode)
    }

    const summary = buildSummary(results)
    updateModule('scanner2-fingerprint-matcher', { status: 'Running' }, 'Scanner_2 fingerprint matcher running on observed findings')
    const enterpriseScanner2 = runEnterpriseScanner2Pass(scanner2Inputs)
    updateModule('scanner2-fingerprint-matcher', {
      status: enterpriseScanner2.enrichedFindings.length > 0 ? 'Completed' : 'No findings',
      findingsCount: enterpriseScanner2.enrichedFindings.filter((finding) => finding.fingerprintId).length,
    }, `${enterpriseScanner2.enrichedFindings.filter((finding) => finding.fingerprintId).length} fingerprint match(es) from observed evidence`)
    updateModule('scanner2-detection-rules', {
      status: enterpriseScanner2.ruleResults.length > 0 ? 'Completed' : 'No findings',
      findingsCount: enterpriseScanner2.ruleResults.length,
    }, `${enterpriseScanner2.ruleResults.length} scanner_2 detection rule(s) triggered`)
    updateModule('scanner2-hndl-analyzer', {
      status: enterpriseScanner2.hndlRisks.length > 0 ? 'Completed' : 'No findings',
      findingsCount: enterpriseScanner2.hndlRisks.length,
    }, `${enterpriseScanner2.hndlRisks.length} HNDL risk(s) identified from observed findings`)
    updateModule('scanner2-correlation-engine', {
      status: enterpriseScanner2.attackAssessment.attackCorrelations.length > 0 ? 'Completed' : 'No findings',
      findingsCount: enterpriseScanner2.attackAssessment.attackCorrelations.length,
    }, `${enterpriseScanner2.attackAssessment.attackCorrelations.length} attack correlation(s) built from observed findings`)
    updateModule('scanner2-pqc-migration-engine', {
      status: enterpriseScanner2.migrationRecommendations.length > 0 ? 'Completed' : 'No findings',
      findingsCount: enterpriseScanner2.migrationRecommendations.length,
    }, `${enterpriseScanner2.migrationRecommendations.length} PQC migration recommendation(s) generated`)
    updateModule('scanner2-risk-qscore-engine', {
      status: 'Completed',
      findingsCount: enterpriseScanner2.quantumRiskScore.totalFindings,
    }, `Scanner_2 risk/Q-score calculated: readiness ${enterpriseScanner2.quantumReadiness.score}/100`)

    await updateSession(client, session.id, user.id, {
      status: 'completed',
      progress: 100,
      scanned_assets: normalized.length,
      findings_count: summary.totalFindings,
      completed_at: new Date().toISOString(),
      metadata: {
        authorization: 'explicit-user-acknowledgement',
        scannerMode: 'defensive-cryptographic-inventory',
        targets: normalized,
        telemetry,
        moduleStates,
        scannerModulesUsed: moduleStates.filter((module) => module.status !== 'Queued' && module.status !== 'Skipped').map((module) => module.name),
        enterpriseScanner2,
        errors,
        summary,
        results,
        linkedAssetIds,
        linkedCbomIds,
        linkedExposureIds,
      },
    }, session.mode)

    updateModule('risk-scoring-engine', { status: 'Completed', findingsCount: summary.totalFindings, severityCounts: { critical: summary.critical, high: summary.high, medium: summary.medium, low: summary.low, safe: summary.safe } }, 'Risk scoring engine completed')
    emit({ type: 'risk-score-calculated', status: 'completed', progress: 99, message: `Risk score calculated: ${summary.riskScore}/100`, summary, enterpriseScanner2, moduleStates })
    emit({ type: 'scan-complete', status: 'completed', progress: 100, scanSessionId: session.id, persistence: session.mode, message: 'Authorized cryptographic inventory scan completed', summary, results, enterpriseScanner2, moduleStates, linkedAssetIds, linkedCbomIds, linkedExposureIds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scanner failure'
    errors.push(message)
    const runningModule = moduleStates.find((module) => module.status === 'Running')
    if (runningModule) updateModule(runningModule.id, { status: 'Failed', error: message }, `${runningModule.name} failed: ${message}`)
    if (session) {
      await updateSession(client, session.id, user.id, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: { targets: normalized, telemetry, moduleStates, errors, results, linkedAssetIds, linkedCbomIds, linkedExposureIds },
      }, session.mode)
    }
    emit({ type: 'scan-failed', status: 'failed', progress: 100, message, errors, moduleStates })
  } finally {
    activeJobs.delete(jobId)
    res.end()
  }
})

router.post('/jobs/:id/cancel', (req, res) => {
  const state = activeJobs.get(req.params.id)
  if (!state) {
    res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Active scan job not found' } })
    return
  }
  state.cancelled = true
  res.json({ data: { jobId: req.params.id, status: 'cancelled' } })
})

async function loadScannerTables(client: any, userId: string) {
  if (!client) {
    return {
      assets: memoryStore.assets.filter((item) => item.user_id === userId),
      inventory: memoryStore.inventory.filter((item) => item.user_id === userId),
      exposures: memoryStore.exposures.filter((item) => item.user_id === userId),
      results: memoryStore.results.filter((item) => item.user_id === userId),
      sessions: memoryStore.sessions.filter((item) => item.user_id === userId),
      mode: 'memory' as PersistenceMode,
    }
  }

  try {
    const [assets, inventory, exposures, results, sessions] = await Promise.all([
      client.from('assets').select('*').eq('user_id', userId).order('updated_at', { ascending: false }),
      client.from('crypto_inventory').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('crypto_exposures').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('pqc_scan_results').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      client.from('pqc_scan_sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    ])
    return {
      assets: assets.error ? [] : assets.data || [],
      inventory: inventory.error ? [] : inventory.data || [],
      exposures: exposures.error ? [] : exposures.data || [],
      results: results.error ? [] : results.data || [],
      sessions: sessions.error ? [] : sessions.data || [],
      mode: 'database' as PersistenceMode,
    }
  } catch {
    return {
      assets: memoryStore.assets.filter((item) => item.user_id === userId),
      inventory: memoryStore.inventory.filter((item) => item.user_id === userId),
      exposures: memoryStore.exposures.filter((item) => item.user_id === userId),
      results: memoryStore.results.filter((item) => item.user_id === userId),
      sessions: memoryStore.sessions.filter((item) => item.user_id === userId),
      mode: 'memory' as PersistenceMode,
    }
  }
}

router.get('/history', async (req, res) => {
  const user = (req as any).user
  const token = (req as any).token as string
  const client = getDbClient(token)
  const { sessions, results, mode } = await loadScannerTables(client, user.id)

  const history = sessions.map((session: any) => {
    const sessionResults = results.filter((result: any) => result.scan_session_id === session.id)
    const metadata = session.metadata || {}
    const started = session.started_at || session.created_at
    const completed = session.completed_at || metadata.completedAt || null
    return {
      scanId: session.id,
      userId: session.user_id,
      target: session.target_scope,
      scanType: metadata.scannerMode || 'defensive-cryptographic-inventory',
      startedAt: started,
      completedAt: completed,
      durationMs: started && completed ? Date.parse(completed) - Date.parse(started) : null,
      status: session.status,
      detectedComponents: sessionResults.length,
      scannerModulesUsed: metadata.scannerModulesUsed || (metadata.moduleStates || []).filter((module: any) => module.status !== 'Queued' && module.status !== 'Skipped').map((module: any) => module.name),
      vulnerableFindings: sessionResults.filter((result: any) => ['critical', 'high', 'moderate'].includes(result.threat_level)).length,
      pqcReadyFindings: sessionResults.filter((result: any) => result.metadata?.status === 'PQC-ready').length,
      riskScore: metadata.summary?.riskScore ?? null,
      qScore: metadata.summary?.qScore ?? null,
      telemetry: metadata.telemetry || [],
      moduleStates: metadata.moduleStates || [],
      enterpriseScanner2: metadata.enterpriseScanner2 || null,
      errorLogs: metadata.errors || [],
      summary: metadata.summary || null,
      findings: sessionResults,
      recommendations: sessionResults.map((result: any) => result.remediation).filter(Boolean),
      linkedCbomRecords: metadata.linkedCbomIds || [],
      linkedAssetRecords: metadata.linkedAssetIds || [],
      linkedExposureNodes: metadata.linkedExposureIds || [],
    }
  })

  res.json({ data: { mode, history } })
})

router.get('/cbom', async (req, res) => {
  const user = (req as any).user
  const token = (req as any).token as string
  const client = getDbClient(token)
  const { assets, inventory, mode } = await loadScannerTables(client, user.id)
  const assetById = new Map<string, any>((assets as any[]).map((asset) => [asset.id, asset]))
  const grouped = new Map<string, any>()

  for (const item of inventory as any[]) {
    const asset = assetById.get(item.asset_id)
    const key = `${item.asset_id}:${item.item_type}:${item.algorithm}:${item.name}`
    const existing = grouped.get(key)
    const discoveredAt = item.discovered_at || item.created_at
    if (existing) {
      existing.instances += 1
      if (Date.parse(discoveredAt) > Date.parse(existing.lastScannedDate)) existing.lastScannedDate = discoveredAt
      continue
    }
    grouped.set(key, {
      id: item.id,
      component: item.name,
      type: item.item_type,
      algorithm: item.algorithm || 'Unknown',
      keySize: item.key_size,
      status: item.is_quantum_safe ? 'PQC-ready' : item.is_vulnerable ? 'Quantum-vulnerable' : 'Unknown / requires manual review',
      isVulnerable: Boolean(item.is_vulnerable),
      isQuantumSafe: Boolean(item.is_quantum_safe),
      pqcReplacement: item.metadata?.pqcReplacement || replacementFor(item.algorithm || ''),
      instances: 1,
      sourceAsset: asset?.name || item.metadata?.target || 'Unknown asset',
      sourceAssetId: item.asset_id,
      detectionMethod: item.metadata?.detectionMethod || item.metadata?.source || 'scanner',
      lastScannedDate: discoveredAt,
      riskSeverity: item.exposure_level || 'low',
      evidence: item.metadata?.evidence || 'Stored scanner result',
      recommendation: item.metadata?.recommendation || null,
      metadata: item.metadata || {},
    })
  }

  const entries = Array.from(grouped.values())
  const stats = {
    totalComponents: entries.length,
    quantumVulnerableComponents: entries.filter((entry) => entry.isVulnerable).length,
    pqcReadyComponents: entries.filter((entry) => entry.isQuantumSafe).length,
    totalInstances: entries.reduce((sum, entry) => sum + entry.instances, 0),
  }

  res.json({ data: { mode, entries, stats } })
})

router.get('/assets', async (req, res) => {
  const user = (req as any).user
  const token = (req as any).token as string
  const client = getDbClient(token)
  const { assets, inventory, exposures, mode } = await loadScannerTables(client, user.id)

  const normalized = (assets as any[]).map((asset) => {
    const crypto = (inventory as any[]).filter((item) => item.asset_id === asset.id)
    const assetExposures = (exposures as any[]).filter((item) => item.asset_id === asset.id)
    const riskScore = asset.metadata?.riskScore ?? Math.min(100, assetExposures.length * 20)
    const algorithms = Array.from(new Set(crypto.map((item: any) => item.algorithm).filter(Boolean)))
    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      domain: asset.metadata?.authorized_target || asset.name,
      ipAddress: asset.ip_address,
      url: asset.metadata?.authorized_target || null,
      cryptography: algorithms,
      cryptoInventory: crypto,
      riskScore,
      qScore: asset.metadata?.qScore ?? Math.max(0, 100 - riskScore),
      riskLevel: asset.metadata?.riskLevel || (riskScore >= 80 ? 'CRITICAL' : riskScore >= 60 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW'),
      complianceStatus: crypto.some((item: any) => item.is_vulnerable) ? 'Action required' : crypto.length > 0 ? 'PQC ready / monitored' : 'Manual review',
      lastScanned: asset.metadata?.last_scanned_at || asset.updated_at || asset.created_at,
      status: asset.status,
      findingsCount: crypto.length,
      vulnerableCount: crypto.filter((item: any) => item.is_vulnerable).length,
      metadata: asset.metadata || {},
    }
  })

  res.json({ data: { mode, assets: normalized } })
})

router.get('/exposure-map', async (req, res) => {
  const user = (req as any).user
  const token = (req as any).token as string
  const client = getDbClient(token)
  const { assets, inventory, exposures, mode } = await loadScannerTables(client, user.id)
  const count = Math.max(1, (assets as any[]).length)

  const nodes = (assets as any[]).map((asset, index) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2
    const radius = count <= 2 ? 20 : 32
    const crypto = (inventory as any[]).filter((item) => item.asset_id === asset.id)
    const assetExposures = (exposures as any[]).filter((item) => item.asset_id === asset.id)
    const highest = crypto.find((item) => item.is_vulnerable) || crypto[0]
    const riskScore = asset.metadata?.riskScore ?? Math.min(100, assetExposures.length * 20)
    return {
      id: asset.id,
      label: asset.name,
      type: asset.type?.includes('ssh') ? 'network' : asset.type?.includes('web') || asset.type?.includes('tls') ? 'server' : 'endpoint',
      assetType: asset.type,
      x: Math.round(50 + Math.cos(angle) * radius),
      y: Math.round(50 + Math.sin(angle) * radius),
      size: Math.max(10, Math.min(22, 10 + crypto.length)),
      algorithm: highest?.algorithm || 'No crypto metadata',
      risk: riskScore,
      vulnerable: crypto.some((item) => item.is_vulnerable),
      pqcReadiness: crypto.length === 0 ? 'Unknown / requires manual review' : crypto.every((item) => item.is_quantum_safe) ? 'PQC-ready' : 'Quantum-vulnerable',
      linkedFindings: crypto.map((item) => ({
        id: item.id,
        algorithm: item.algorithm,
        category: item.item_type,
        status: item.is_quantum_safe ? 'PQC-ready' : item.is_vulnerable ? 'Quantum-vulnerable' : 'Unknown / requires manual review',
        evidence: item.metadata?.evidence,
      })),
      recommendedMigrationPath: highest?.metadata?.pqcReplacement || replacementFor(highest?.algorithm || ''),
      connections: [],
    }
  })

  const distribution = {
    critical: nodes.filter((node) => node.risk >= 80).length,
    high: nodes.filter((node) => node.risk >= 60 && node.risk < 80).length,
    medium: nodes.filter((node) => node.risk >= 40 && node.risk < 60).length,
    low: nodes.filter((node) => node.risk < 40).length,
  }

  res.json({ data: { mode, nodes, edges: [], distribution } })
})

export default router
