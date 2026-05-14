/**
 * QGuard Web Scanner — Unified Type Definitions
 * Types for the Quantum Vulnerability Detection Engine
 */

// ─── Target Types ─────────────────────────────────────────────────────────────

export type WebScanTargetType = 'url' | 'domain' | 'ip' | 'github'
export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE'

// ─── TLS Analysis ─────────────────────────────────────────────────────────────

export interface TlsAnalysisResult {
  tlsVersion: string
  cipherSuite: string
  keyExchange: string
  signatureAlgorithm: string
  supportedProtocols: string[]
  protocolSupport: TlsProtocolProbe[]
  negotiatedCurve: string | null
  serverName: string
  peerCertificate: CertificateInfo | null
  cipherSuites: CipherSuiteDetail[]
  ephemeralKeyType: string | null
  ephemeralKeySize: number | null
}

export interface TlsProtocolProbe {
  protocol: string
  supported: boolean
  cipherSuite: string | null
  keyExchange: string | null
  error?: string
}

// ─── Certificate Parsing ──────────────────────────────────────────────────────

export interface CertificateInfo {
  subject: Record<string, string>
  issuer: Record<string, string>
  publicKeyAlgorithm: string
  publicKeySize: number
  signatureAlgorithm: string
  signatureOid: string
  validFrom: string
  validTo: string
  serialNumber: string
  fingerprint: string
  isExpired: boolean
  isSelfSigned: boolean
  chain: CertificateChainEntry[]
  detectedOids: OidClassification[]
}

export interface CertificateChainEntry {
  subject: string
  issuer: string
  signatureAlgorithm: string
  publicKeyAlgorithm: string
  publicKeySize: number
  validTo: string
  isExpired: boolean
}

// ─── OID Classification ──────────────────────────────────────────────────────

export type OidCategory =
  | 'rsa'
  | 'ecc'
  | 'dh'
  | 'dsa'
  | 'hash'
  | 'pqc'
  | 'symmetric'
  | 'legacy'
  | 'ca-identifier'
  | 'extension'

export type QuantumThreat = 'shor' | 'grover' | 'both' | 'classical-broken' | 'safe'

export interface OidClassification {
  oid: string
  name: string
  category: OidCategory
  quantumVulnerable: boolean
  quantumThreat: QuantumThreat
  pqcReplacement: string | null
  description: string
}

// ─── Cipher Suite Analysis ────────────────────────────────────────────────────

export type CipherSuiteCategory =
  | 'rsa-kex'
  | 'ecdhe-rsa'
  | 'ecdhe-ecdsa'
  | 'dhe-rsa'
  | 'dhe-dss'
  | 'tls13'
  | 'other'

export interface CipherSuiteDetail {
  name: string
  standardName: string
  category: CipherSuiteCategory
  keyExchange: string
  authentication: string
  encryption: string
  mac: string
  quantumVulnerable: boolean
  riskLevel: ThreatLevel
  description: string
}

// ─── GitHub Repo Scanning ─────────────────────────────────────────────────────

export interface GitRepoScanResult {
  repoUrl: string
  repoName: string
  filesScanned: number
  totalFiles: number
  patterns: GitCryptoMatch[]
}

export interface GitCryptoMatch {
  file: string
  line: number
  pattern: string
  category: string
  algorithm: string
  snippet: string
  threatLevel: ThreatLevel
  description: string
}

// ─── Web Crypto Scanning ──────────────────────────────────────────────────────

export interface WebCryptoScanResult {
  url: string
  pagesScanned: number
  scriptsAnalyzed: number
  patterns: WebCryptoMatch[]
}

export interface WebCryptoMatch {
  source: string
  line: number
  pattern: string
  category: string
  algorithm: string
  snippet: string
  threatLevel: ThreatLevel
  description: string
}

// ─── API Security Scanning ────────────────────────────────────────────────────

export interface ApiSecurityResult {
  hostname: string
  endpointsProbed: number
  securityHeaders: SecurityHeader[]
  apiFindings: ApiSecurityFinding[]
}

export interface SecurityHeader {
  name: string
  value: string | null
  present: boolean
  secure: boolean
  required?: boolean
  recommendation: string
}

export interface ApiSecurityFinding {
  endpoint: string
  findingType: string
  algorithm: string
  threatLevel: ThreatLevel
  description: string
  recommendation: string
}

// ─── Detection Rules ──────────────────────────────────────────────────────────

export type DetectionRuleCategory =
  | 'certificate-risk'
  | 'tls-config'
  | 'hashing'
  | 'app-crypto'
  | 'pqc-readiness'
  | 'long-term-quantum-risk'

export interface DetectionRule {
  id: string
  name: string
  category: DetectionRuleCategory
  severity: ThreatLevel
  description: string
  remediation: string
  evaluate: (context: DetectionContext) => DetectionRuleResult | null
}

export interface DetectionContext {
  findings: WebScanFinding[]
  tlsResult: TlsAnalysisResult | null
  certInfo: CertificateInfo | null
  apiResult: ApiSecurityResult | null
  repoResult: GitRepoScanResult | null
  webCryptoResult: WebCryptoScanResult | null
}

export interface DetectionRuleResult {
  ruleId: string
  ruleName: string
  category: DetectionRuleCategory
  severity: ThreatLevel
  triggered: boolean
  details: string
  remediation: string
}

// ─── PQC Recommendations ─────────────────────────────────────────────────────

export interface PQCMigrationDetail {
  currentAlgorithm: string
  recommendedPQC: string
  alternativePQC: string[]
  migrationType: string
  migrationComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  migrationSteps: string[]
  nistStandard: string
  estimatedEffort: string
}

// ─── Risk Scoring ─────────────────────────────────────────────────────────────

export interface WebScanRiskBreakdown {
  certificateRisk: number
  tlsConfigRisk: number
  cipherSuiteRisk: number
  appCryptoRisk: number
  pqcReadiness: number
}

export interface WebScanRiskScore {
  overallScore: number
  riskLevel: ThreatLevel
  quantumReadinessScore: number
  quantumReadinessLevel: QuantumReadinessLevel
  legacyQScore: number
  breakdown: WebScanRiskBreakdown
}

export type QuantumReadinessLevel =
  | 'quantum-safe'
  | 'moderate-risk'
  | 'vulnerable'
  | 'critical-risk'

// ─── Unified Finding ──────────────────────────────────────────────────────────

export interface WebScanFinding {
  id: string
  phase: string
  algorithm: string
  location: string
  threatLevel: ThreatLevel
  category: string
  description: string
  recommendation: string
  quantumBreakTime: string
  classicalBreakTime: string
  oid?: string
  cipherSuiteDetail?: CipherSuiteDetail
  repoFilePath?: string
  lineNumber?: number
  pqcRecommendation?: PQCMigrationDetail
}

// ─── Complete Scan Result ─────────────────────────────────────────────────────

export interface WebScanCompleteResult {
  scanId: string
  target: string
  targetType: WebScanTargetType
  scanDuration: number
  totalFindings: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  safeCount: number
  overallRiskScore: number
  riskLevel: ThreatLevel
  quantumReadinessScore: number
  quantumReadinessLevel: QuantumReadinessLevel
  legacyQScore: number
  findings: WebScanFinding[]
  tlsAnalysis: TlsAnalysisResult | null
  certificateInfo: CertificateInfo | null
  cipherSuiteBreakdown: CipherSuiteDetail[]
  repoScanResult: GitRepoScanResult | null
  webCryptoResult: WebCryptoScanResult | null
  apiSecurityResult: ApiSecurityResult | null
  pqcRecommendations: PQCMigrationDetail[]
  riskBreakdown: WebScanRiskBreakdown
  detectionRuleResults: DetectionRuleResult[]
  runtimeHealth?: unknown
  scanConfidence?: { confidence: number; label: string; factors: string[] }
}

// ─── SSE Event Types ──────────────────────────────────────────────────────────

export type SSEEventType =
  | 'scan-start'
  | 'engine-status'
  | 'phase-start'
  | 'phase-complete'
  | 'module-start'
  | 'module-complete'
  | 'scan-metrics'
  | 'finding'
  | 'scan-complete'
  | 'error'

export interface SSEEvent {
  type: SSEEventType
  scanId: string
  timestamp: string
  [key: string]: unknown
}

// ─── Crypto Pattern (for regex scanning) ──────────────────────────────────────

export interface CryptoPattern {
  id: number
  regex: RegExp
  label: string
  category: string
  algorithm: string
  threatLevel: ThreatLevel
  languages: string[]
  description: string
}
