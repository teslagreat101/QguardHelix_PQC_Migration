import type { ClassicalAlgorithm, QuantumThreatLevel, QuantumThreatType } from './quantum.types'

export type ScanTargetProvider = string

export type ScanTargetType =
  | 'local-file'
  | 'local-keystore'
  | 'device-certificate'
  | 'ssh-directory'
  | 'cloud-drive'
  | 'email'
  | 'developer-platform'
  | 'social-media'
  | 'messaging'
  | 'cloud-infrastructure'
  | 'endpoint-security'
  | 'password-vault'
  | 'crypto-wallet'
  | 'app'
  | 'certificate'

export interface ScanTarget {
  id: string
  name: string
  type: ScanTargetType
  provider?: ScanTargetProvider
  metadata?: Record<string, unknown>
}

export type ScannerEvidenceSourceType = 'local-agent' | 'connector' | 'scanner-api'
export type ScannerEvidenceType =
  | 'tls-certificate'
  | 'tls-protocol'
  | 'tls-cipher'
  | 'ssh-metadata'
  | 'package-manifest'
  | 'config-reference'
  | 'jwt-algorithm'
  | 'crypto-library'

export interface ScannerEvidenceRecord {
  id?: string
  userId?: string
  agentId?: string | null
  connectorAccountId?: string | null
  sourceType: ScannerEvidenceSourceType
  evidenceType: ScannerEvidenceType
  assetName: string
  assetType?: string | null
  target?: string | null
  host?: string | null
  port?: number | null
  protocol?: string | null
  observedAlgorithm?: string | null
  keySize?: number | null
  certificateFingerprint?: string | null
  filePath?: string | null
  packageName?: string | null
  packageVersion?: string | null
  confidence?: EvidenceConfidence
  rawEvidence?: Record<string, unknown>
  observedAt?: string
}

export type ScanModuleCategory =
  | 'device'
  | 'network'
  | 'cloud'
  | 'blockchain'
  | 'telecom'
  | 'infrastructure'

export type FindingSeverity = 'critical' | 'high' | 'moderate' | 'medium' | 'low' | 'safe'

export type EvidenceSourceKind = 'observed' | 'api' | 'certificate' | 'tls' | 'ssh' | 'configuration' | 'heuristic' | 'manual'
export type EvidenceConfidence = 'high' | 'medium' | 'low'

export interface ScanEvidence {
  kind: EvidenceSourceKind
  confidence: EvidenceConfidence
  source: string
  detail: string
}

export type RemediationAuthority =
  | 'qguard_controlled'
  | 'customer_admin_configurable'
  | 'provider_owned'
  | 'advisory_only'

export type ProtectionOutcome =
  | 'encrypted_locally'
  | 'endpoint_hardened'
  | 'provider_setting_changed'
  | 'ticket_created'
  | 'vendor_blocked'
  | 'monitoring_enabled'
  | 'advisory_only'

export interface RemediationModel {
  authority: RemediationAuthority
  protectionOutcome: ProtectionOutcome
  canDirectlyMigrate: boolean
  canProtectWithOverlay: boolean
  userActionRequired: boolean
  label: string
  summary: string
  nextStep: string
  residualRisk: string
  allowedActions: string[]
}

export interface ScanFinding {
  id: string
  scanId: string
  moduleId: string
  target: ScanTarget
  detectedAlgorithm: ClassicalAlgorithm
  algorithmCategory: 'public-key' | 'symmetric' | 'hash' | 'protocol' | 'signature'
  threatLevel: QuantumThreatLevel
  quantumThreat: QuantumThreatType
  isHNDLRisk: boolean
  description: string
  recommendation: string
  quantumBreakTime: string
  classicalBreakTime: string
  riskScore: number
  severity: FindingSeverity
  pqcReplacement: string
  evidence: ScanEvidence
  remediation: RemediationModel
  detectionContext?: string
  fingerprintId?: number
  ruleId?: string
  timestamp: string
}

export type ScanResult = ScanFinding

export interface ScanModule {
  id: string
  name: string
  category: ScanModuleCategory
  description: string
  supportedTargets: ScanTargetType[]
  scan: (target: ScanTarget, scanId: string) => ScanFinding[]
}

export type DetectionRuleCategory = string

export interface DetectionRule {
  id: string
  name: string
  category: DetectionRuleCategory
  description: string
  targetAlgorithms: ClassicalAlgorithm[]
  riskScore: number
  severity: FindingSeverity
  quantumThreat: QuantumThreatType
  recommendation: string
  evaluate: (finding: ScanFinding) => DetectionRuleResult | null
}

export interface DetectionRuleResult {
  ruleId: string
  ruleName: string
  matched: boolean
  finding: ScanFinding
  adjustedRiskScore: number
  severity: FindingSeverity
  remediation: string
}

export interface QScoreTrend {
  date: string
  score: number
}

export interface QuantumRiskScore {
  overall: number
  level: 'quantum-safe' | 'moderate-risk' | 'vulnerable' | 'critical-risk'
  breakdown: {
    devices: number
    networks: number
    cloud: number
    blockchain: number
    telecom: number
    applications: number
    infrastructure: number
  }
  criticalCount: number
  highCount: number
  moderateCount: number
  lowCount: number
  totalFindings: number
  hndlRiskCount: number
  lastScanAt: string
  trend: QScoreTrend[]
}

export interface QScore {
  overall: number
  breakdown: {
    encryption: number
    certificates: number
    passwords: number
    cloudStorage: number
    communications: number
  }
  level: QuantumThreatLevel
  trend: QScoreTrend[]
  lastScanAt: string
  totalVulnerabilities: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
}

export interface ScanTelemetry {
  eventType: string
  scanId: string
  timestamp: string
  message: string
  moduleId?: string
  moduleName?: string
  targetName?: string
  progress?: number
  finding?: ScanFinding
  ruleResult?: DetectionRuleResult
  metadata?: Record<string, unknown>
}

export interface ScanJob {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  targets: ScanTarget[]
  modules: string[]
  startedAt: string
  completedAt?: string
  progress: number
  findings: ScanFinding[]
  ruleResults: DetectionRuleResult[]
  telemetry: ScanTelemetry[]
  riskScore?: QuantumRiskScore
}

export type QuantumRiskClassification = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface AttackCorrelation {
  id: string
  source: string
  sourceType: string
  finding: string
  chain: string
  riskLevel: QuantumRiskClassification
}

export interface QuantumRiskAssessment {
  riskScore: number
  classification: QuantumRiskClassification
  detectedAssets: Record<string, number>
  estimatedBreakWindow: {
    earliest: number
    latest: number
  }
  attackCorrelations: AttackCorrelation[]
}
