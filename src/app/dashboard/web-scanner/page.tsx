'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import SecurityCoPilot from '@/components/ai/SecurityCoPilot'
import { useRouter } from 'next/navigation'

// ─── Types ───────────────────────────────────────────────────────────────────

type TargetType = 'url' | 'domain' | 'ip' | 'github'
type ScanPhase = 'idle' | 'initializing' | 'dns-resolution' | 'tls-handshake' | 'cert-analysis' | 'cipher-enum' | 'header-inspection' | 'deep-scan' | 'repo-scan' | 'risk-calculation' | 'report-generation' | 'report' | 'complete'
type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE'

interface CipherSuiteDetail {
  name: string
  standardName: string
  category: string
  keyExchange: string
  authentication: string
  encryption: string
  mac: string
  quantumVulnerable: boolean
  riskLevel: ThreatLevel
  description: string
}

interface OidClassification {
  oid: string
  name: string
  category: string
  quantumVulnerable: boolean
  quantumThreat: string
  pqcReplacement: string | null
  description: string
}

interface PQCMigrationDetail {
  currentAlgorithm: string
  recommendedPQC: string
  alternativePQC: string[]
  migrationType: string
  migrationComplexity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  migrationSteps: string[]
  nistStandard: string
  estimatedEffort: string
}

interface WebScanRiskBreakdown {
  certificateRisk: number
  tlsConfigRisk: number
  cipherSuiteRisk: number
  appCryptoRisk: number
  pqcReadiness: number
}

interface GitCryptoMatch {
  file: string
  line: number
  pattern: string
  category: string
  algorithm: string
  snippet: string
  threatLevel: ThreatLevel
  description: string
}

interface GitRepoScanResult {
  repoUrl: string
  repoName: string
  filesScanned: number
  totalFiles: number
  patterns: GitCryptoMatch[]
}

interface DetectionRuleResult {
  ruleId: string
  ruleName: string
  category: string
  severity: ThreatLevel
  triggered: boolean
  details: string
  remediation: string
}

interface ScanFinding {
  id: string
  algorithm: string
  location: string
  threatLevel: ThreatLevel
  description: string
  recommendation: string
  quantumBreakTime: string
  classicalBreakTime: string
  category: string
  // Enhanced fields from quantum scanner engine
  oid?: string
  cipherSuiteDetail?: CipherSuiteDetail
  repoFilePath?: string
  lineNumber?: number
  pqcRecommendation?: PQCMigrationDetail
}

interface ScanResult {
  target: string
  targetType: TargetType
  scanDuration: number
  totalFindings: number
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  safeCount: number
  overallRiskScore: number
  quantumReadinessScore?: number
  quantumReadinessLevel?: 'quantum-safe' | 'moderate-risk' | 'vulnerable' | 'critical-risk'
  legacyQScore?: number
  findings: ScanFinding[]
  tlsVersion: string
  certificateInfo: {
    issuer: string
    algorithm: string
    keySize: number
    expiry: string
    isQuantumSafe: boolean
  }
  // Enhanced fields from quantum scanner engine
  riskLevel?: ThreatLevel
  tlsAnalysis?: Record<string, unknown> | null
  cipherSuiteBreakdown?: CipherSuiteDetail[]
  riskBreakdown?: WebScanRiskBreakdown
  repoScanResult?: GitRepoScanResult | null
  pqcRecommendations?: PQCMigrationDetail[]
  detectionRuleResults?: DetectionRuleResult[]
  detectedOids?: OidClassification[]
  scanConfidence?: { confidence: number; label: string; factors: string[] }
}

interface LiveScanMetrics {
  findingsCount: number
  critical: number
  high: number
  medium: number
  low: number
  safe: number
  quantumReadinessScore: number | null
  legacyQScore: number | null
  etaSeconds: number | null
  queueState: string
  activeModule: string
}

interface TelemetryEntry {
  timestamp: string
  phase: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
}

/** A persisted scan session from the database */
interface HistorySession {
  id: string
  target: string
  target_type: string
  scan_duration: number
  overall_risk_score: number
  total_findings: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  safe_count: number
  tls_version: string | null
  certificate_algorithm: string | null
  is_quantum_safe: boolean
  status: string
  created_at: string
}

/** A persisted finding from the database */
interface HistoryFinding {
  id: string
  session_id: string
  algorithm: string
  location: string
  threat_level: string
  category: string
  description: string
  recommendation: string
  quantum_break_time: string
  classical_break_time: string
  created_at: string
  // Enhanced fields
  oid?: string | null
  cipher_suite_detail?: CipherSuiteDetail | null
  repo_file_path?: string | null
  line_number?: number | null
  pqc_recommendation?: PQCMigrationDetail | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TARGET_TYPES: { key: TargetType; label: string; icon: string; placeholder: string; description: string }[] = [
  { key: 'url', label: 'URL', icon: '🔗', placeholder: 'https://example.com', description: 'Full website URL with protocol' },
  { key: 'domain', label: 'Domain', icon: '🌍', placeholder: 'example.com', description: 'Domain name without protocol' },
  { key: 'ip', label: 'IP Address', icon: '📡', placeholder: '192.168.1.1', description: 'IPv4 or IPv6 address' },
  { key: 'github', label: 'GitHub Repo', icon: '🐙', placeholder: 'https://github.com/user/repo', description: 'Public GitHub repository URL' },
]

const SCAN_PHASES: { phase: ScanPhase; label: string; duration: number }[] = [
  { phase: 'initializing', label: 'Initializing Scanner Engine', duration: 800 },
  { phase: 'dns-resolution', label: 'DNS & Target Validation', duration: 600 },
  { phase: 'tls-handshake', label: 'TLS Handshake Analysis', duration: 1200 },
  { phase: 'cert-analysis', label: 'Certificate Chain Inspection', duration: 1500 },
  { phase: 'cipher-enum', label: 'Cipher Suite Enumeration', duration: 2000 },
  { phase: 'header-inspection', label: 'Security Header Analysis', duration: 1000 },
  { phase: 'deep-scan', label: 'Deep Cryptographic Scan', duration: 2500 },
  { phase: 'repo-scan', label: 'Repository Cryptography Analysis', duration: 2500 },
  { phase: 'risk-calculation', label: 'Quantum Risk Scoring', duration: 1000 },
  { phase: 'report-generation', label: 'Generating Risk Report', duration: 800 },
]

const FEATURES = [
  {
    icon: '🔬',
    title: 'TLS/SSL Analysis',
    description: 'Deep inspection of TLS handshakes, certificate chains, and cipher suite configurations to identify quantum-vulnerable key exchanges.',
  },
  {
    icon: '🧬',
    title: 'Certificate Chain Audit',
    description: 'Analyzes X.509 certificate hierarchies for RSA/ECC key sizes, signature algorithms, and HNDL (Harvest Now, Decrypt Later) exposure.',
  },
  {
    icon: '⚡',
    title: 'Cipher Suite Enumeration',
    description: 'Enumerates all supported cipher suites, flagging those using pre-quantum key exchange mechanisms like ECDHE, DHE, and RSA.',
  },
  {
    icon: '🛡️',
    title: 'Security Header Analysis',
    description: 'Inspects HTTP security headers including HSTS, CSP, and certificate pinning for quantum-readiness posture assessment.',
  },
  {
    icon: '🐙',
    title: 'Repository Code Scanning',
    description: 'Scans GitHub repositories for hardcoded cryptographic implementations, deprecated algorithms, and insecure key management patterns.',
  },
  {
    icon: '📊',
    title: 'Quantum Risk Scoring',
    description: 'Proprietary risk scoring engine that calculates quantum break timelines based on algorithm type, key size, and current quantum computing progress.',
  },
]

const BENEFITS = [
  { metric: '< 30s', label: 'Average Scan Time', description: 'Enterprise-grade scanning in seconds, not hours' },
  { metric: '200+', label: 'Vulnerability Signatures', description: 'Comprehensive quantum-vulnerability database' },
  { metric: '99.7%', label: 'Detection Accuracy', description: 'Industry-leading false-positive rate below 0.3%' },
  { metric: 'NIST', label: 'Standards Compliant', description: 'Aligned with NIST PQC migration guidelines' },
]

// ─── Server Result Mapper ───────────────────────────────────────────────────

/** Maps the WebScanCompleteResult from the server SSE scan-complete event to our client ScanResult */
function mapServerResult(data: Record<string, unknown>): ScanResult {
  const result = data.result as Record<string, unknown> | undefined
  if (!result) {
    // Fallback: use data directly (for partial results)
    return mapPartialResult(data)
  }

  const findings = ((result.findings || []) as Record<string, unknown>[]).map((f, i) => ({
    id: (f.id as string) || `finding-${i + 1}`,
    algorithm: (f.algorithm as string) || 'Unknown',
    location: (f.location as string) || '',
    threatLevel: (f.threatLevel as ThreatLevel) || 'MEDIUM',
    description: (f.description as string) || '',
    recommendation: (f.recommendation as string) || '',
    quantumBreakTime: (f.quantumBreakTime as string) || 'N/A',
    classicalBreakTime: (f.classicalBreakTime as string) || 'N/A',
    category: (f.category as string) || 'General',
    oid: f.oid as string | undefined,
    cipherSuiteDetail: f.cipherSuiteDetail as CipherSuiteDetail | undefined,
    repoFilePath: f.repoFilePath as string | undefined,
    lineNumber: f.lineNumber as number | undefined,
    pqcRecommendation: f.pqcRecommendation as PQCMigrationDetail | undefined,
  }))

  const certInfo = result.certificateInfo as Record<string, unknown> | null
  const tlsAnalysis = result.tlsAnalysis as Record<string, unknown> | null
  const quantumReadinessScore = result.quantumReadinessScore as number | undefined

  return {
    target: (result.target as string) || '',
    targetType: (result.targetType as TargetType) || 'url',
    scanDuration: (result.scanDuration as number) || 0,
    totalFindings: (result.totalFindings as number) || findings.length,
    criticalCount: (result.criticalCount as number) || 0,
    highCount: (result.highCount as number) || 0,
    mediumCount: (result.mediumCount as number) || 0,
    lowCount: (result.lowCount as number) || 0,
    safeCount: (result.safeCount as number) || 0,
    overallRiskScore: (result.overallRiskScore as number) || 0,
    quantumReadinessScore: result.quantumReadinessScore as number | undefined,
    quantumReadinessLevel: result.quantumReadinessLevel as ScanResult['quantumReadinessLevel'],
    legacyQScore: result.legacyQScore as number | undefined,
    findings,
    tlsVersion: tlsAnalysis ? (tlsAnalysis.tlsVersion as string) || 'N/A' : 'N/A',
    certificateInfo: certInfo ? {
      issuer: ((certInfo.issuer as Record<string, string>)?.CN) || ((certInfo.issuer as Record<string, string>)?.O) || 'Unknown',
      algorithm: `${(certInfo.publicKeyAlgorithm as string) || 'Unknown'}-${(certInfo.publicKeySize as number) || ''} / ${(certInfo.signatureAlgorithm as string) || ''}`,
      keySize: (certInfo.publicKeySize as number) || 0,
      expiry: (certInfo.validTo as string) || 'N/A',
      isQuantumSafe: typeof quantumReadinessScore === 'number' ? quantumReadinessScore >= 900 : false,
    } : {
      issuer: 'N/A',
      algorithm: 'N/A',
      keySize: 0,
      expiry: 'N/A',
      isQuantumSafe: typeof quantumReadinessScore === 'number' ? quantumReadinessScore >= 900 : (result.overallRiskScore as number) < 20,
    },
    riskLevel: result.riskLevel as ThreatLevel | undefined,
    tlsAnalysis: tlsAnalysis,
    cipherSuiteBreakdown: result.cipherSuiteBreakdown as CipherSuiteDetail[] | undefined,
    riskBreakdown: result.riskBreakdown as WebScanRiskBreakdown | undefined,
    repoScanResult: result.repoScanResult as GitRepoScanResult | null | undefined,
    pqcRecommendations: result.pqcRecommendations as PQCMigrationDetail[] | undefined,
    detectionRuleResults: result.detectionRuleResults as DetectionRuleResult[] | undefined,
    detectedOids: certInfo?.detectedOids as OidClassification[] | undefined,
    scanConfidence: result.scanConfidence as ScanResult['scanConfidence'],
  }
}

function mapPartialResult(data: Record<string, unknown>): ScanResult {
  return {
    target: (data.target as string) || '',
    targetType: (data.targetType as TargetType) || 'url',
    scanDuration: 0,
    totalFindings: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    safeCount: 0,
    overallRiskScore: 0,
    findings: [],
    tlsVersion: 'N/A',
    certificateInfo: { issuer: 'N/A', algorithm: 'N/A', keySize: 0, expiry: 'N/A', isQuantumSafe: false },
  }
}

// ─── Helper Components ──────────────────────────────────────────────────────

function getThreatColor(level: ThreatLevel | string): string {
  switch (level.toUpperCase()) {
    case 'CRITICAL': return 'var(--qg-red)'
    case 'HIGH': return 'var(--qg-orange)'
    case 'MEDIUM': return 'var(--qg-amber)'
    case 'LOW': return 'var(--qg-cyan)'
    case 'SAFE': return 'var(--qg-green)'
    default: return 'var(--qg-text-muted)'
  }
}

function getThreatBadgeClass(level: ThreatLevel | string): string {
  switch (level.toUpperCase()) {
    case 'CRITICAL': return 'threat-critical'
    case 'HIGH': return 'threat-high'
    case 'MEDIUM': return 'threat-medium'
    case 'LOW': return 'threat-low'
    case 'SAFE': return 'threat-safe'
    default: return 'threat-low'
  }
}

function getRiskLabel(score: number): string {
  if (score >= 80) return 'CRITICAL EXPOSURE'
  if (score >= 60) return 'HIGH RISK'
  if (score >= 40) return 'MODERATE RISK'
  if (score >= 20) return 'LOW RISK'
  return 'QUANTUM READY'
}

function getRiskColor(score: number): string {
  if (score >= 80) return 'var(--qg-red)'
  if (score >= 60) return 'var(--qg-orange)'
  if (score >= 40) return 'var(--qg-amber)'
  if (score >= 20) return 'var(--qg-cyan)'
  return 'var(--qg-green)'
}

function getTargetIcon(type: string): string {
  switch (type) {
    case 'url': return '🔗'
    case 'domain': return '🌍'
    case 'ip': return '📡'
    case 'github': return '🐙'
    default: return '🔗'
  }
}

function isPayloadTemplateNotice(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('qguard helix payload/template') ||
    normalized.includes('qguard_helix_payloads_templates') ||
    normalized.includes('payload-template execution is disabled') ||
    normalized.includes('template directory not found')
}

function formatTimeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Main Page Component ────────────────────────────────────────────────────

export default function WebScannerPage() {
  const { session } = useAuth()
  const router = useRouter()
  const [targetType, setTargetType] = useState<TargetType>('url')
  const [targetInput, setTargetInput] = useState('')
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle')
  const [scanProgress, setScanProgress] = useState(0)
  const [liveMetrics, setLiveMetrics] = useState<LiveScanMetrics>({
    findingsCount: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    safe: 0,
    quantumReadinessScore: null,
    legacyQScore: null,
    etaSeconds: null,
    queueState: 'idle',
    activeModule: '',
  })
  const [telemetry, setTelemetry] = useState<TelemetryEntry[]>([])
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [persistedScanSessionId, setPersistedScanSessionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'features' | 'scanner' | 'results' | 'history'>('features')
  const telemetryRef = useRef<HTMLDivElement>(null)
  const scanStartTime = useRef<number>(0)

  // History state
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState<HistorySession | null>(null)
  const [selectedFindings, setSelectedFindings] = useState<HistoryFinding[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  // Engine readiness state
  const [engineStatus, setEngineStatus] = useState<{
    tlsAnalyzer: 'pending' | 'ready' | 'error'
    cipherSuiteAnalyzer: 'pending' | 'ready' | 'error'
    certificateParser: 'pending' | 'ready' | 'error'
    githubScanner: 'pending' | 'ready' | 'error'
    webCryptoScanner: 'pending' | 'ready' | 'error'
    apiSecurityScanner: 'pending' | 'ready' | 'error'
    detectionRules: 'pending' | 'ready' | 'error'
    riskScoringEngine: 'pending' | 'ready' | 'error'
    pqcRecommendations: 'pending' | 'ready' | 'error'
  }>({
    tlsAnalyzer: 'pending',
    cipherSuiteAnalyzer: 'pending',
    certificateParser: 'pending',
    githubScanner: 'pending',
    webCryptoScanner: 'pending',
    apiSecurityScanner: 'pending',
    detectionRules: 'pending',
    riskScoringEngine: 'pending',
    pqcRecommendations: 'pending',
  })
  const [enginesReady, setEnginesReady] = useState(false)

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [session?.access_token])

  // Fetch scan history from the database
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/v1/web-scanner/results', { headers: authHeaders })
      if (res.ok) {
        const json = await res.json()
        if (json.status === 'success') {
          setHistorySessions(json.data.sessions || [])
        }
      }
    } catch {
      // Silently handle — history is not critical
    } finally {
      setHistoryLoading(false)
    }
  }, [authHeaders])

  // Fetch findings for a specific session
  const fetchSessionDetail = useCallback(async (sessionItem: HistorySession) => {
    setSelectedSession(sessionItem)
    setDetailLoading(true)
    setSelectedFindings([])
    try {
      const res = await fetch(`/api/v1/web-scanner/results?sessionId=${sessionItem.id}`, { headers: authHeaders })
      if (res.ok) {
        const json = await res.json()
        if (json.status === 'success') {
          setSelectedFindings(json.data.findings || [])
        }
      }
    } catch {
      // Silently handle
    } finally {
      setDetailLoading(false)
    }
  }, [authHeaders])

  // Load history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab, fetchHistory])

  const addTelemetry = useCallback((phase: string, message: string, type: TelemetryEntry['type'] = 'info') => {
    const entry: TelemetryEntry = {
      timestamp: new Date().toISOString().split('T')[1].split('.')[0],
      phase,
      message,
      type,
    }
    setTelemetry(prev => [...prev, entry])
    setTimeout(() => {
      telemetryRef.current?.scrollTo({ top: telemetryRef.current.scrollHeight, behavior: 'smooth' })
    }, 50)
  }, [])

  const updateLiveMetrics = useCallback((data: Record<string, unknown>) => {
    const metrics = data.metrics as Partial<LiveScanMetrics> | undefined
    setLiveMetrics(prev => ({
      findingsCount: typeof metrics?.findingsCount === 'number' ? metrics.findingsCount : prev.findingsCount,
      critical: typeof metrics?.critical === 'number' ? metrics.critical : prev.critical,
      high: typeof metrics?.high === 'number' ? metrics.high : prev.high,
      medium: typeof metrics?.medium === 'number' ? metrics.medium : prev.medium,
      low: typeof metrics?.low === 'number' ? metrics.low : prev.low,
      safe: typeof metrics?.safe === 'number' ? metrics.safe : prev.safe,
      quantumReadinessScore: typeof metrics?.quantumReadinessScore === 'number' ? metrics.quantumReadinessScore : prev.quantumReadinessScore,
      legacyQScore: typeof metrics?.legacyQScore === 'number' ? metrics.legacyQScore : prev.legacyQScore,
      etaSeconds: typeof metrics?.etaSeconds === 'number' ? metrics.etaSeconds : prev.etaSeconds,
      queueState: typeof data.queueState === 'string' ? data.queueState : prev.queueState,
      activeModule: typeof data.moduleName === 'string' ? data.moduleName : prev.activeModule,
    }))
  }, [])

  const validateInput = useCallback((): boolean => {
    if (!targetInput.trim()) return false
    switch (targetType) {
      case 'url':
        return /^https?:\/\/.+\..+/.test(targetInput.trim())
      case 'domain':
        return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(targetInput.trim())
      case 'ip':
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(targetInput.trim()) || /^[0-9a-fA-F:]+$/.test(targetInput.trim())
      case 'github':
        return /^https?:\/\/github\.com\/[\w-]+\/[\w.-]+/.test(targetInput.trim())
      default:
        return false
    }
  }, [targetInput, targetType])

  const persistScanResult = useCallback(async (result: ScanResult): Promise<{ persisted: boolean; id: string | null }> => {
    try {
      const res = await fetch('/api/v1/web-scanner/results', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          target: result.target,
          targetType: result.targetType,
          scanDuration: result.scanDuration,
          overallRiskScore: result.overallRiskScore,
          quantumReadinessScore: result.quantumReadinessScore || null,
          quantumReadinessLevel: result.quantumReadinessLevel || null,
          legacyQScore: result.legacyQScore || null,
          totalFindings: result.totalFindings,
          criticalCount: result.criticalCount,
          highCount: result.highCount,
          mediumCount: result.mediumCount,
          lowCount: result.lowCount,
          safeCount: result.safeCount,
          tlsVersion: result.tlsVersion,
          certificateAlgorithm: result.certificateInfo.algorithm,
          isQuantumSafe: result.certificateInfo.isQuantumSafe,
          findings: result.findings,
          // Enhanced fields from quantum scanner engine
          tlsAnalysis: result.tlsAnalysis || null,
          cipherSuiteBreakdown: result.cipherSuiteBreakdown || null,
          riskBreakdown: result.riskBreakdown || null,
        }),
      })
      if (!res.ok) return { persisted: false, id: null }
      const json = await res.json()
      return {
        persisted: json.status === 'success' && json.data?.persisted === true,
        id: typeof json.data?.id === 'string' ? json.data.id : null,
      }
    } catch {
      return { persisted: false, id: null }
    }
  }, [authHeaders])

  // Delete scan sessions from the database
  const deleteSessions = useCallback(async (sessionIds: string[]): Promise<boolean> => {
    try {
      const res = await fetch('/api/v1/web-scanner/results', {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({ sessionIds }),
      })
      if (!res.ok) return false
      const json = await res.json()
      if (json.status === 'success') {
        setHistorySessions(prev => prev.filter(s => !sessionIds.includes(s.id)))
        // Clear detail view if the deleted session was selected
        if (selectedSession && sessionIds.includes(selectedSession.id)) {
          setSelectedSession(null)
          setSelectedFindings([])
        }
        return true
      }
      return false
    } catch {
      return false
    }
  }, [authHeaders, selectedSession])

  // Export scan session as JSON
  const exportSessionJSON = useCallback(async (sessionItem: HistorySession) => {
    try {
      const res = await fetch(`/api/v1/web-scanner/results?sessionId=${sessionItem.id}`, { headers: authHeaders })
      if (!res.ok) return
      const json = await res.json()
      if (json.status !== 'success') return

      const exportData = {
        exportedAt: new Date().toISOString(),
        scanner: 'QGuard Web Scanner v3.0.0',
        session: {
          id: sessionItem.id,
          target: sessionItem.target,
          targetType: sessionItem.target_type,
          scanDuration: sessionItem.scan_duration,
          overallRiskScore: sessionItem.overall_risk_score,
          totalFindings: sessionItem.total_findings,
          criticalCount: sessionItem.critical_count,
          highCount: sessionItem.high_count,
          mediumCount: sessionItem.medium_count,
          lowCount: sessionItem.low_count,
          safeCount: sessionItem.safe_count,
          tlsVersion: sessionItem.tls_version,
          certificateAlgorithm: sessionItem.certificate_algorithm,
          isQuantumSafe: sessionItem.is_quantum_safe,
          scannedAt: sessionItem.created_at,
        },
        findings: json.data.findings || [],
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qguard-scan-${sessionItem.target.replace(/[^a-zA-Z0-9.-]/g, '_')}-${new Date(sessionItem.created_at).toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Silently handle export failure
    }
  }, [authHeaders])

  // Export scan session as CSV
  const exportSessionCSV = useCallback(async (sessionItem: HistorySession) => {
    try {
      const res = await fetch(`/api/v1/web-scanner/results?sessionId=${sessionItem.id}`, { headers: authHeaders })
      if (!res.ok) return
      const json = await res.json()
      if (json.status !== 'success') return

      const findings = json.data.findings || []
      const csvHeader = 'Algorithm,Location,Threat Level,Category,Description,Recommendation,Quantum Break Time,Classical Break Time,OID\n'
      const csvRows = findings.map((f: HistoryFinding) =>
        [
          `"${(f.algorithm || '').replace(/"/g, '""')}"`,
          `"${(f.location || '').replace(/"/g, '""')}"`,
          `"${f.threat_level}"`,
          `"${(f.category || '').replace(/"/g, '""')}"`,
          `"${(f.description || '').replace(/"/g, '""')}"`,
          `"${(f.recommendation || '').replace(/"/g, '""')}"`,
          `"${(f.quantum_break_time || '').replace(/"/g, '""')}"`,
          `"${(f.classical_break_time || '').replace(/"/g, '""')}"`,
          `"${(f.oid || '').replace(/"/g, '""')}"`,
        ].join(',')
      ).join('\n')

      const csvContent = `QGuard Web Scanner Report\nTarget: ${sessionItem.target}\nScanned: ${sessionItem.created_at}\nRisk Score: ${sessionItem.overall_risk_score}\n\n${csvHeader}${csvRows}`
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qguard-scan-${sessionItem.target.replace(/[^a-zA-Z0-9.-]/g, '_')}-${new Date(sessionItem.created_at).toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Silently handle export failure
    }
  }, [authHeaders])

  // Export all sessions summary as CSV
  const exportAllHistoryCSV = useCallback(() => {
    if (historySessions.length === 0) return

    const csvHeader = 'Target,Type,Risk Score,Findings,Critical,High,Medium,Low,Safe,TLS Version,Quantum Safe,Duration,Scanned At\n'
    const csvRows = historySessions.map(s =>
      [
        `"${(s.target || '').replace(/"/g, '""')}"`,
        `"${s.target_type}"`,
        s.overall_risk_score,
        s.total_findings,
        s.critical_count,
        s.high_count,
        s.medium_count,
        s.low_count,
        s.safe_count,
        `"${s.tls_version || 'N/A'}"`,
        s.is_quantum_safe ? 'YES' : 'NO',
        `${(s.scan_duration || 0).toFixed(1)}s`,
        `"${s.created_at}"`,
      ].join(',')
    ).join('\n')

    const csvContent = `QGuard Web Scanner — Scan History Export\nExported: ${new Date().toISOString()}\nTotal Scans: ${historySessions.length}\n\n${csvHeader}${csvRows}`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qguard-scan-history-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [historySessions])

  // Initialize and validate all scanning engines before execution
  const initializeEngines = useCallback(async (): Promise<boolean> => {
    const engines = [
      'tlsAnalyzer', 'cipherSuiteAnalyzer', 'certificateParser',
      'githubScanner', 'webCryptoScanner', 'apiSecurityScanner',
      'detectionRules', 'riskScoringEngine', 'pqcRecommendations',
    ] as const

    const pending = Object.fromEntries(engines.map(e => [e, 'pending' as const])) as typeof engineStatus
    setEngineStatus(pending)
    setEnginesReady(false)

    try {
      const response = await fetch('/api/v1/web-scanner/health', { cache: 'no-store' })
      const payload = await response.json()
      const health = payload.data as {
        status: 'ready' | 'degraded' | 'missing'
        components?: Record<string, { status: 'ready' | 'degraded' | 'missing'; detail: string; count?: number }>
        enterpriseScanner?: { modules: number; detectionRules: number; cryptoFingerprints: number }
        webScanner?: { modules: number; detectionRules: number; cryptoPatterns: number; cipherSuiteFingerprints: number }
        payloadSystem?: { status: string; packs: number; payloads: number }
        templateSystem?: { status: string; templates: number }
        issues?: string[]
      }

      const nextStatus = { ...pending }
      for (const engine of engines) {
        const component = health.components?.[engine]
        nextStatus[engine] = component?.status === 'ready' || component?.status === 'degraded' ? 'ready' : 'error'
        const type = nextStatus[engine] === 'ready' ? 'success' : 'error'
        addTelemetry('ENGINE', `${engine}: ${component?.detail || 'not reported by runtime health'}`, type)
      }

      setEngineStatus(nextStatus)
      setEnginesReady(Object.values(nextStatus).every(status => status === 'ready'))

      addTelemetry('ENGINE', `${health.webScanner?.modules || 0} web engines, ${health.webScanner?.detectionRules || 0} web rules, ${health.webScanner?.cryptoPatterns || 0} code patterns loaded`, 'info')
      addTelemetry('ENGINE', `${health.enterpriseScanner?.modules || 0} enterprise modules registered, ${health.enterpriseScanner?.detectionRules || 0} enterprise rules registered, ${health.enterpriseScanner?.cryptoFingerprints || 0} crypto fingerprints registered`, 'info')
      const payloadPackCount = health.payloadSystem?.packs || 0
      const payloadCount = health.payloadSystem?.payloads || 0
      const templateCount = health.templateSystem?.templates || 0
      if (payloadPackCount > 0 || payloadCount > 0 || templateCount > 0) {
        addTelemetry('ENGINE', `${payloadPackCount} payload packs, ${payloadCount} payloads, ${templateCount} templates available`, health.payloadSystem?.status === 'ready' ? 'success' : 'warning')
      }

      for (const issue of health.issues || []) {
        if (!isPayloadTemplateNotice(issue)) {
          addTelemetry('ENGINE', issue, 'warning')
        }
      }

      return Object.values(nextStatus).every(status => status === 'ready')
    } catch (error) {
      const failed = Object.fromEntries(engines.map(e => [e, 'error' as const])) as typeof engineStatus
      setEngineStatus(failed)
      addTelemetry('ENGINE', `Runtime health probe failed: ${error instanceof Error ? error.message : 'unknown error'}`, 'error')
      return false
    }
  }, [addTelemetry])

  const runScan = useCallback(async () => {
    if (!validateInput()) return

    setScanResult(null)
    setPersistedScanSessionId(null)
    setTelemetry([])
    setScanProgress(0)
    setLiveMetrics({
      findingsCount: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      safe: 0,
      quantumReadinessScore: null,
      legacyQScore: null,
      etaSeconds: null,
      queueState: 'queued',
      activeModule: '',
    })
    setActiveTab('scanner')
    setSelectedSession(null)
    setSelectedFindings([])
    scanStartTime.current = Date.now()

    addTelemetry('INIT', `Target acquired: ${targetInput}`, 'info')
    addTelemetry('INIT', `Scan mode: ${targetType.toUpperCase()} Analysis`, 'info')
    addTelemetry('INIT', `Engine version: QGuard WebScanner v3.0.0 (Quantum Engine)`, 'info')

    // Validate all engines are ready before proceeding
    addTelemetry('ENGINE', 'Initializing quantum scanning engines...', 'info')
    const allReady = await initializeEngines()
    if (!allReady) {
      addTelemetry('ENGINE', 'SCAN ABORTED — One or more engines failed to initialize', 'error')
      setScanPhase('idle')
      return
    }

    // Connect to SSE stream for real-time telemetry
    const streamUrl = `/api/v1/web-scanner/stream?target=${encodeURIComponent(targetInput)}&type=${targetType}`
    let sseFinished = false
    let serverResult: ScanResult | null = null

    try {
      const eventSource = new EventSource(streamUrl)
      const ssePromise = new Promise<void>((resolve) => {
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            updateLiveMetrics(data)

            if (data.type === 'engine-status') {
              const issues = Array.isArray(data.issues) ? data.issues as string[] : []
              addTelemetry('ENGINE', `${data.webModulesLoaded || 0} web engines, ${data.webDetectionRulesLoaded || 0} web rules, ${data.cryptoPatternsLoaded || 0} code patterns loaded`, 'success')
              addTelemetry('ENGINE', `${data.modulesLoaded || 0} enterprise modules registered, ${data.detectionRulesLoaded || 0} enterprise rules registered, ${data.fingerprintsLoaded || 0} crypto fingerprints registered`, 'success')
              const registeredPayloadPacks = typeof data.payloadPacksLoaded === 'number' ? data.payloadPacksLoaded : 0
              const registeredTemplates = typeof data.templatesLoaded === 'number' ? data.templatesLoaded : 0
              if (registeredPayloadPacks > 0 || registeredTemplates > 0) {
                addTelemetry('ENGINE', `${registeredPayloadPacks} payload packs and ${registeredTemplates} YAML templates registered`, registeredPayloadPacks > 0 ? 'success' : 'warning')
              }
              for (const issue of issues) {
                if (!isPayloadTemplateNotice(issue)) {
                  addTelemetry('ENGINE', issue, 'warning')
                }
              }
            }

            if (data.type === 'phase-start') {
              setScanPhase(data.phase as ScanPhase)
              setScanProgress(data.progress || 0)
              addTelemetry(data.phase?.toUpperCase() || 'SCAN', data.label || 'Processing...', 'info')
            }

            if (data.type === 'module-start') {
              addTelemetry('MODULE', `Running ${data.moduleName || data.moduleId} on ${data.target || targetInput}`, 'info')
            }

            if (data.type === 'module-complete') {
              const count = typeof data.findingCount === 'number' ? data.findingCount : 0
              addTelemetry('MODULE', `${data.moduleName || data.moduleId} complete (${count} findings)`, data.error ? 'warning' : 'success')
            }

            if (data.type === 'finding') {
              const f = data.finding
              const level = f.threatLevel === 'SAFE' ? 'success' : f.threatLevel === 'CRITICAL' || f.threatLevel === 'HIGH' ? 'warning' : 'info'
              addTelemetry('FINDING', `${f.algorithm} — ${f.description}`, level as TelemetryEntry['type'])
            }

            if (data.type === 'phase-complete') {
              setScanProgress(data.progress || 0)
            }

            if (data.type === 'scan-complete') {
              sseFinished = true
              // Map the full server result
              serverResult = mapServerResult(data)
              eventSource.close()
              resolve()
            }

            if (data.type === 'error') {
              addTelemetry('ERROR', data.message || 'Stream error', 'error')
              eventSource.close()
              resolve()
            }
          } catch {
            // Ignore parse errors
          }
        }

        eventSource.onerror = () => {
          if (!sseFinished) {
            eventSource.close()
            resolve()
          }
        }
      })

      await ssePromise
    } catch {
      // Fallback: SSE stream unavailable
      addTelemetry('STREAM', 'SSE stream unavailable — scan could not be completed', 'warning')
    }

    const duration = (Date.now() - scanStartTime.current) / 1000

    // Use server result if available, otherwise create minimal result
    const result: ScanResult = serverResult || {
      target: targetInput,
      targetType,
      scanDuration: duration,
      totalFindings: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      safeCount: 0,
      overallRiskScore: 0,
      findings: [],
      tlsVersion: 'N/A',
      certificateInfo: { issuer: 'N/A', algorithm: 'N/A', keySize: 0, expiry: 'N/A', isQuantumSafe: false },
    }

    // Ensure duration is set from client measurement if server didn't provide it
    if (!result.scanDuration || result.scanDuration === 0) {
      result.scanDuration = duration
    }

    setScanResult(result)
    setScanProgress(100)
    setScanPhase('complete')
    setLiveMetrics(prev => ({
      ...prev,
      findingsCount: result.totalFindings,
      critical: result.criticalCount,
      high: result.highCount,
      medium: result.mediumCount,
      low: result.lowCount,
      safe: result.safeCount,
      quantumReadinessScore: result.quantumReadinessScore ?? Math.max(0, 1000 - result.overallRiskScore * 10),
      legacyQScore: result.legacyQScore ?? Math.max(0, 100 - result.overallRiskScore),
      etaSeconds: 0,
      queueState: 'complete',
    }))

    addTelemetry('COMPLETE', `Scan finished in ${result.scanDuration.toFixed(1)}s — ${result.totalFindings} findings detected`, result.criticalCount > 0 ? 'error' : 'success')
    addTelemetry('PERSIST', 'Persisting results to QGuard database...', 'info')

    // Persist to backend for dashboard metrics
    const persisted = await persistScanResult(result)
    if (persisted.persisted) {
      setPersistedScanSessionId(persisted.id)
      addTelemetry('PERSIST', 'Results saved — dashboard metrics updated', 'success')
    } else {
      addTelemetry('PERSIST', 'Results saved locally (database sync pending)', 'warning')
    }

    setActiveTab('results')
  }, [targetInput, targetType, validateInput, addTelemetry, persistScanResult, initializeEngines, updateLiveMetrics])

  // Convert web scanner findings to SecurityCoPilot format
  const coPilotFindings = useMemo(() => {
    if (!scanResult) return []
    return scanResult.findings.map(f => ({
      id: f.id,
      detectedAlgorithm: f.algorithm,
      threatLevel: f.threatLevel.toLowerCase(),
      isHNDLRisk: f.category?.toLowerCase().includes('key exchange') || f.category?.toLowerCase().includes('tls') || f.threatLevel === 'CRITICAL' || f.threatLevel === 'HIGH',
      target: { name: f.location || scanResult.target, type: scanResult.targetType },
      quantumBreakTime: f.quantumBreakTime,
      classicalBreakTime: f.classicalBreakTime,
      recommendation: f.recommendation,
      description: f.description,
      riskScore: f.threatLevel === 'CRITICAL' ? 95 : f.threatLevel === 'HIGH' ? 75 : f.threatLevel === 'MEDIUM' ? 50 : f.threatLevel === 'LOW' ? 25 : 10,
    }))
  }, [scanResult])

  const coPilotQScore = useMemo(() => {
    if (!scanResult) return null
    return Math.max(0, 100 - scanResult.overallRiskScore)
  }, [scanResult])

  const goToMigrationWizard = useCallback(() => {
    const params = new URLSearchParams()
    const handoffSessionId = selectedSession?.id || persistedScanSessionId

    if (handoffSessionId) {
      params.set('webScanSessionId', handoffSessionId)
    } else if (scanResult?.target) {
      params.set('targets', scanResult.target)
    }

    const query = params.toString()
    router.push(query ? `/dashboard/migrate/wizard?${query}` : '/dashboard/migrate/wizard')
  }, [persistedScanSessionId, router, scanResult?.target, selectedSession?.id])

  const isScanning = scanPhase !== 'idle' && scanPhase !== 'complete'

  return (
    <div className="ws-page">
      {/* ─── Page Header ─── */}
      <div className="ws-header">
        <div className="ws-header-content">
          <div>
            <div className="ws-badge">QUANTUM CRYPTOGRAPHIC ANALYSIS</div>
            <h1 className="ws-title">QGuard Web Scanner</h1>
            <p className="ws-subtitle">
              Enterprise-grade scanning framework for detecting quantum-vulnerable cryptography across
              websites, APIs, GitHub repositories, and network infrastructure.
            </p>
          </div>
          <div className="ws-header-stats">
            {BENEFITS.map((b, i) => (
              <div key={i} className="ws-header-stat">
                <span className="ws-header-stat-value">{b.metric}</span>
                <span className="ws-header-stat-label">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="ws-tabs">
        <button
          className={`ws-tab ${activeTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          <span>⚡</span> Features & Capabilities
        </button>
        <button
          className={`ws-tab ${activeTab === 'scanner' ? 'active' : ''}`}
          onClick={() => setActiveTab('scanner')}
        >
          <span>🔬</span> Scanner Console
        </button>
        <button
          className={`ws-tab ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
          disabled={!scanResult && !selectedSession}
        >
          <span>📋</span> Scan Results {scanResult && `(${scanResult.totalFindings})`}
          {!scanResult && selectedSession && `(${selectedSession.total_findings})`}
        </button>
        <button
          className={`ws-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span>🕐</span> History
        </button>
      </div>

      {/* ─── Target Input Bar ─── */}
      <div className="ws-scanner-bar">
        <div className="ws-target-types">
          {TARGET_TYPES.map(t => (
            <button
              key={t.key}
              className={`ws-target-type-btn ${targetType === t.key ? 'active' : ''}`}
              onClick={() => { setTargetType(t.key); setTargetInput('') }}
              disabled={isScanning}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="ws-input-row">
          <div className="ws-input-wrapper">
            <span className="ws-input-icon">
              {TARGET_TYPES.find(t => t.key === targetType)?.icon}
            </span>
            <input
              type="text"
              className="ws-input"
              placeholder={TARGET_TYPES.find(t => t.key === targetType)?.placeholder}
              value={targetInput}
              onChange={e => setTargetInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !isScanning) runScan() }}
              disabled={isScanning}
            />
            {targetInput && !isScanning && (
              <button className="ws-input-clear" onClick={() => setTargetInput('')}>
                &times;
              </button>
            )}
          </div>
          <button
            className={`q-btn q-btn-primary ws-scan-btn ${isScanning ? 'scanning' : ''}`}
            onClick={runScan}
            disabled={isScanning || !validateInput()}
          >
            {isScanning ? (
              <>
                <span className="ws-spinner" />
                Scanning...
              </>
            ) : (
              <>
                <span>🚀</span>
                Initiate Scan
              </>
            )}
          </button>
        </div>
        <div className="ws-input-hint">
          {TARGET_TYPES.find(t => t.key === targetType)?.description}
          {targetInput && !validateInput() && (
            <span style={{ color: 'var(--qg-red)', marginLeft: 12 }}>
              Invalid {targetType} format
            </span>
          )}
        </div>
      </div>

      {/* ─── Features Tab ─── */}
      {activeTab === 'features' && (
        <div className="ws-features-section animate-fade-in-up">
          <div className="ws-section-header">
            <h2>Scanning Capabilities</h2>
            <p>Comprehensive quantum-vulnerability detection across your entire attack surface</p>
          </div>

          <div className="ws-features-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="q-card ws-feature-card animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="ws-feature-icon">{f.icon}</div>
                <h3 className="ws-feature-title">{f.title}</h3>
                <p className="ws-feature-desc">{f.description}</p>
              </div>
            ))}
          </div>

          {/* Benefits Section */}
          <div className="ws-section-header" style={{ marginTop: 48 }}>
            <h2>Why QGuard Web Scanner</h2>
            <p>Purpose-built for the post-quantum transition</p>
          </div>

          <div className="ws-benefits-grid">
            {BENEFITS.map((b, i) => (
              <div key={i} className="ws-benefit-card animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="ws-benefit-metric">{b.metric}</div>
                <div className="ws-benefit-label">{b.label}</div>
                <div className="ws-benefit-desc">{b.description}</div>
              </div>
            ))}
          </div>

          {/* Supported Scan Targets */}
          <div className="ws-section-header" style={{ marginTop: 48 }}>
            <h2>Supported Targets</h2>
            <p>Scan any externally accessible endpoint or repository</p>
          </div>

          <div className="ws-targets-showcase">
            {TARGET_TYPES.map((t, i) => (
              <div key={i} className="q-card ws-target-showcase-card">
                <div className="ws-target-showcase-icon">{t.icon}</div>
                <div className="ws-target-showcase-label">{t.label}</div>
                <div className="ws-target-showcase-desc">{t.description}</div>
                <div className="ws-target-showcase-example mono">{t.placeholder}</div>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="ws-section-header" style={{ marginTop: 48 }}>
            <h2>How It Works</h2>
            <p>Seven-phase quantum vulnerability analysis pipeline</p>
          </div>

          <div className="ws-pipeline">
            {SCAN_PHASES.map((p, i) => (
              <div key={i} className="ws-pipeline-step">
                <div className="ws-pipeline-number">{String(i + 1).padStart(2, '0')}</div>
                <div className="ws-pipeline-label">{p.label}</div>
                {i < SCAN_PHASES.length - 1 && <div className="ws-pipeline-connector" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Scanner Console Tab ─── */}
      {activeTab === 'scanner' && (
        <div className="ws-console-section animate-fade-in-up">
          {/* Engine Status Panel */}
          {(isScanning || enginesReady) && (
            <div className="q-card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
              }}>
                <h4 style={{ fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', color: 'var(--qg-text-muted)', margin: 0 }}>
                  QUANTUM ENGINE STATUS
                </h4>
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)',
                  padding: '2px 10px', borderRadius: 10,
                  background: enginesReady ? 'rgba(48,209,88,0.08)' : 'rgba(255,204,0,0.08)',
                  border: `1px solid ${enginesReady ? 'rgba(48,209,88,0.3)' : 'rgba(255,204,0,0.3)'}`,
                  color: enginesReady ? 'var(--qg-green)' : 'var(--qg-amber)',
                }}>
                  {enginesReady ? 'ALL SYSTEMS OPERATIONAL' : 'INITIALIZING...'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {([
                  { key: 'tlsAnalyzer', label: 'TLS Analyzer' },
                  { key: 'cipherSuiteAnalyzer', label: 'Cipher Suite Analyzer' },
                  { key: 'certificateParser', label: 'Certificate Parser' },
                  { key: 'githubScanner', label: 'GitHub Scanner' },
                  { key: 'webCryptoScanner', label: 'Web Crypto Scanner' },
                  { key: 'apiSecurityScanner', label: 'API Security Scanner' },
                  { key: 'detectionRules', label: 'Detection Rules Engine' },
                  { key: 'riskScoringEngine', label: 'Risk Scoring Engine' },
                  { key: 'pqcRecommendations', label: 'PQC Recommendations' },
                ] as const).map(({ key, label }) => {
                  const status = engineStatus[key]
                  return (
                    <div key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--qg-deep)', border: '1px solid var(--qg-border)',
                      fontSize: 11,
                    }}>
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                        background: status === 'ready' ? 'var(--qg-green)' : status === 'error' ? 'var(--qg-red)' : 'var(--qg-amber)',
                        boxShadow: status === 'ready' ? '0 0 6px var(--qg-green)' : status === 'error' ? '0 0 6px var(--qg-red)' : 'none',
                        animation: status === 'pending' ? 'pulse-glow 1.5s infinite' : 'none',
                      }} />
                      <span style={{ color: 'var(--qg-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Progress Bar with Phase Indicators */}
          {isScanning && (
            <div className="ws-progress-container">
              <div className="ws-progress-header">
                <span className="ws-progress-phase">
                  {SCAN_PHASES.find(p => p.phase === scanPhase)?.label || 'Initializing Engines...'}
                </span>
                <span className="ws-progress-percent">{Math.round(scanProgress)}%</span>
              </div>
              <div className="ws-progress-track">
                <div className="ws-progress-fill" style={{ width: `${scanProgress}%` }} />
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                gap: 8,
                marginTop: 12,
              }}>
                {[
                  { label: 'Module', value: liveMetrics.activeModule || 'Pending' },
                  { label: 'Findings', value: String(liveMetrics.findingsCount) },
                  { label: 'Q-Ready', value: liveMetrics.quantumReadinessScore !== null ? `${liveMetrics.quantumReadinessScore}/1000` : 'Measuring' },
                  { label: 'ETA', value: liveMetrics.etaSeconds !== null && liveMetrics.etaSeconds > 0 ? `${liveMetrics.etaSeconds}s` : 'Finalizing' },
                  { label: 'Queue', value: liveMetrics.queueState || 'running' },
                ].map(item => (
                  <div key={item.label} style={{
                    minWidth: 0,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--qg-border)',
                    background: 'var(--qg-deep)',
                  }}>
                    <div style={{ fontSize: 9, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--qg-text-primary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {/* Phase step indicators */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 10, gap: 4,
              }}>
                {SCAN_PHASES.map((p, i) => {
                  const phaseIndex = SCAN_PHASES.findIndex(sp => sp.phase === scanPhase)
                  const state = i < phaseIndex ? 'complete' : i === phaseIndex ? 'active' : 'pending'
                  return (
                    <div key={p.phase} style={{
                      display: 'flex', alignItems: 'center', gap: 4, flex: 1,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: state === 'complete' ? 'var(--qg-green)' : state === 'active' ? 'var(--qg-cyan)' : 'var(--qg-border)',
                        boxShadow: state === 'active' ? '0 0 8px var(--qg-cyan)' : 'none',
                        animation: state === 'active' ? 'pulse-glow 1.5s infinite' : 'none',
                        transition: 'all 0.3s ease',
                      }} />
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--font-mono)',
                        color: state === 'complete' ? 'var(--qg-green)' : state === 'active' ? 'var(--qg-cyan)' : 'var(--qg-text-muted)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {p.label.replace(' Analysis', '').replace(' Inspection', '').replace(' Enumeration', '')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Telemetry Feed */}
          <div className="q-card ws-telemetry-card">
            <div className="ws-telemetry-header">
              <span>Terminal Output</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--qg-text-muted)' }}>
                {telemetry.length} entries
              </span>
            </div>
            <div className="ws-telemetry-feed" ref={telemetryRef}>
              {telemetry.length === 0 ? (
                <div className="ws-telemetry-empty">
                  <span style={{ fontSize: 32 }}>🔬</span>
                  <p>Enter a target above and initiate a scan to begin quantum vulnerability analysis.</p>
                </div>
              ) : (
                telemetry.map((entry, i) => (
                  <div key={i} className={`ws-telemetry-entry ws-telemetry-${entry.type}`}>
                    <span className="ws-telemetry-time">{entry.timestamp}</span>
                    <span className="ws-telemetry-phase">[{entry.phase}]</span>
                    <span className="ws-telemetry-msg">{entry.message}</span>
                  </div>
                ))
              )}
              {isScanning && (
                <div className="ws-telemetry-cursor">
                  <span className="ws-cursor-blink">_</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Results Tab ─── */}
      {activeTab === 'results' && (
        <div className="ws-results-section animate-fade-in-up">
          {/* Show results from either a fresh scan or a history selection */}
          {scanResult && !selectedSession && (
            <LiveScanResults result={scanResult} />
          )}
          {selectedSession && (
            <HistoryScanResults
              session={selectedSession}
              findings={selectedFindings}
              loading={detailLoading}
              onExportJSON={exportSessionJSON}
              onExportCSV={exportSessionCSV}
              onDelete={deleteSessions}
              onBack={() => { setSelectedSession(null); setSelectedFindings([]); setActiveTab('history') }}
            />
          )}
          {!scanResult && !selectedSession && (
            <div className="q-card" style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 14, color: 'var(--qg-text-muted)' }}>
                Run a scan or select a scan from History to view results
              </div>
            </div>
          )}

          {/* ─── Migrate Button ─── */}
          {(scanResult || selectedSession) && (
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
              <button
                className="q-btn q-btn-primary"
                onClick={goToMigrationWizard}
                style={{
                  padding: '14px 36px',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.03em',
                  background: 'linear-gradient(135deg, var(--qg-violet, #fff3c1), var(--qg-cyan, #d4af37))',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 20px rgba(255,243,193,0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 6px 28px rgba(255,243,193,0.5)'
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,243,193,0.3)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <span style={{ fontSize: 18 }}>🛡️</span>
                Migrate to Post-Quantum Cryptography
                <span style={{ fontSize: 14 }}>→</span>
              </button>
            </div>
          )}

          {/* ─── AI Security Co-Pilot ─── */}
          {scanResult && !selectedSession && (
            <div style={{ marginTop: 24 }}>
              <SecurityCoPilot
                findings={coPilotFindings}
                qScore={coPilotQScore}
                targets={[scanResult.target]}
                accessToken={session?.access_token}
              />
            </div>
          )}
        </div>
      )}

      {/* ─── History Tab ─── */}
      {activeTab === 'history' && (
        <div className="ws-results-section animate-fade-in-up">
          <div className="q-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🕐</span> Scan History
                <span style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-green)',
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--qg-green)', boxShadow: '0 0 6px var(--qg-green)' }} />
                  Synced
                </span>
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {historySessions.length > 0 && (
                  <button
                    className="q-btn q-btn-ghost"
                    onClick={exportAllHistoryCSV}
                    style={{ padding: '6px 14px', fontSize: 11 }}
                    title="Export all scan history as CSV"
                  >
                    Export All CSV
                  </button>
                )}
                <button className="q-btn q-btn-ghost" onClick={fetchHistory} style={{ padding: '6px 14px', fontSize: 11 }}>
                  ↻ Refresh
                </button>
              </div>
            </div>

            {historyLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 12, animation: 'pulse-glow 2s infinite' }}>⚛️</div>
                <div style={{ fontSize: 13, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Loading scan history...
                </div>
              </div>
            ) : historySessions.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center',
                border: '1px dashed var(--qg-border)', borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔬</div>
                <div style={{ fontSize: 14, color: 'var(--qg-text-muted)', marginBottom: 4 }}>No scans recorded yet</div>
                <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
                  Run your first scan and results will appear here
                </div>
              </div>
            ) : (
              <>
                {/* Summary stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                  <div className="q-card stat-card" style={{ padding: '14px 16px' }}>
                    <div className="stat-label" style={{ fontSize: 10 }}>Total Scans</div>
                    <div className="stat-value" style={{ fontSize: 22, color: 'var(--qg-cyan)' }}>{historySessions.length}</div>
                  </div>
                  <div className="q-card stat-card" style={{ padding: '14px 16px' }}>
                    <div className="stat-label" style={{ fontSize: 10 }}>Critical Findings</div>
                    <div className="stat-value" style={{ fontSize: 22, color: 'var(--qg-red)' }}>
                      {historySessions.reduce((sum, s) => sum + (s.critical_count || 0), 0)}
                    </div>
                  </div>
                  <div className="q-card stat-card" style={{ padding: '14px 16px' }}>
                    <div className="stat-label" style={{ fontSize: 10 }}>Avg Risk Score</div>
                    <div className="stat-value" style={{ fontSize: 22, color: 'var(--qg-amber)' }}>
                      {historySessions.length > 0 ? Math.round(historySessions.reduce((sum, s) => sum + (s.overall_risk_score || 0), 0) / historySessions.length) : 0}
                    </div>
                  </div>
                  <div className="q-card stat-card" style={{ padding: '14px 16px' }}>
                    <div className="stat-label" style={{ fontSize: 10 }}>Quantum Safe</div>
                    <div className="stat-value" style={{ fontSize: 22, color: 'var(--qg-green)' }}>
                      {historySessions.filter(s => s.is_quantum_safe).length}
                    </div>
                  </div>
                </div>

                {/* History list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {historySessions.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 16px', borderRadius: 'var(--radius-md)',
                        background: 'var(--qg-deep)', border: '1px solid var(--qg-border)',
                        transition: 'all 0.2s ease', gap: 12,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--qg-cyan)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--qg-border)'
                      }}
                    >
                      {/* Clickable main area */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => {
                          setScanResult(null)
                          fetchSessionDetail(s)
                          setActiveTab('results')
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{getTargetIcon(s.target_type)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {s.target}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginTop: 2 }}>
                            {s.target_type.toUpperCase()} &middot; {s.scan_duration?.toFixed(1)}s &middot; {formatTimeAgo(s.created_at)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        {/* Finding counts */}
                        <div style={{ display: 'flex', gap: 6, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                          {s.critical_count > 0 && <span style={{ color: 'var(--qg-red)' }}>{s.critical_count}C</span>}
                          {s.high_count > 0 && <span style={{ color: 'var(--qg-orange)' }}>{s.high_count}H</span>}
                          {s.medium_count > 0 && <span style={{ color: 'var(--qg-amber)' }}>{s.medium_count}M</span>}
                          {s.low_count > 0 && <span style={{ color: 'var(--qg-cyan)' }}>{s.low_count}L</span>}
                          {s.safe_count > 0 && <span style={{ color: 'var(--qg-green)' }}>{s.safe_count}S</span>}
                        </div>

                        {/* Risk score */}
                        <div style={{
                          fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
                          color: getRiskColor(s.overall_risk_score),
                          minWidth: 40, textAlign: 'right',
                        }}>
                          {s.overall_risk_score}
                        </div>

                        {/* Quantum safe badge */}
                        <div style={{
                          padding: '3px 10px', borderRadius: 12, fontSize: 9,
                          fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: s.is_quantum_safe ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 45, 85, 0.08)',
                          border: `1px solid ${s.is_quantum_safe ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 45, 85, 0.2)'}`,
                          color: s.is_quantum_safe ? 'var(--qg-green)' : 'var(--qg-red)',
                        }}>
                          {s.is_quantum_safe ? 'Safe' : 'Vulnerable'}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="q-btn q-btn-ghost"
                            title="Export as JSON"
                            onClick={(e) => { e.stopPropagation(); exportSessionJSON(s) }}
                            style={{ padding: '4px 8px', fontSize: 10, minWidth: 0 }}
                          >
                            JSON
                          </button>
                          <button
                            className="q-btn q-btn-ghost"
                            title="Export as CSV"
                            onClick={(e) => { e.stopPropagation(); exportSessionCSV(s) }}
                            style={{ padding: '4px 8px', fontSize: 10, minWidth: 0 }}
                          >
                            CSV
                          </button>
                          <button
                            className="q-btn q-btn-ghost"
                            title="Delete scan"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Delete scan for ${s.target}? This cannot be undone.`)) {
                                deleteSessions([s.id])
                              }
                            }}
                            style={{
                              padding: '4px 8px', fontSize: 10, minWidth: 0,
                              color: 'var(--qg-red)', borderColor: 'rgba(255, 45, 85, 0.2)',
                            }}
                          >
                            Del
                          </button>
                        </div>

                        {/* View arrow */}
                        <span
                          style={{ color: 'var(--qg-text-muted)', fontSize: 14, cursor: 'pointer' }}
                          onClick={() => {
                            setScanResult(null)
                            fetchSessionDetail(s)
                            setActiveTab('results')
                          }}
                        >
                          →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Live Scan Results Component ─────────────────────────────────────────────

function LiveScanResults({ result }: { result: ScanResult }) {
  const [expandedPqc, setExpandedPqc] = useState<string | null>(null)

  return (
    <>
      {/* Risk Score Overview */}
      <div className="ws-risk-overview">
        <div className="ws-risk-gauge">
          <div className="ws-risk-score" style={{ color: getRiskColor(result.overallRiskScore) }}>
            {result.overallRiskScore}
          </div>
          <div className="ws-risk-label" style={{ color: getRiskColor(result.overallRiskScore) }}>
            {getRiskLabel(result.overallRiskScore)}
          </div>
          <div className="ws-risk-target mono">{result.target}</div>
          {typeof result.quantumReadinessScore === 'number' && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--qg-green)', fontFamily: 'var(--font-mono)' }}>
              Q-Readiness: {result.quantumReadinessScore}/1000
            </div>
          )}
        </div>

        <div className="ws-risk-breakdown">
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-red)' }}>{result.criticalCount}</span>
            <span className="ws-risk-stat-label">Critical</span>
          </div>
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-orange)' }}>{result.highCount}</span>
            <span className="ws-risk-stat-label">High</span>
          </div>
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-amber)' }}>{result.mediumCount}</span>
            <span className="ws-risk-stat-label">Medium</span>
          </div>
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-cyan)' }}>{result.lowCount}</span>
            <span className="ws-risk-stat-label">Low</span>
          </div>
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-green)' }}>{result.safeCount}</span>
            <span className="ws-risk-stat-label">Safe</span>
          </div>
        </div>
      </div>

      {/* Scan Metadata */}
      <div className="ws-meta-grid">
        <div className="q-card ws-meta-card">
          <div className="ws-meta-label">Scan Duration</div>
          <div className="ws-meta-value">{result.scanDuration.toFixed(1)}s</div>
        </div>
        <div className="q-card ws-meta-card">
          <div className="ws-meta-label">TLS Version</div>
          <div className="ws-meta-value mono">{result.tlsVersion}</div>
        </div>
        <div className="q-card ws-meta-card">
          <div className="ws-meta-label">Certificate Algorithm</div>
          <div className="ws-meta-value mono">{result.certificateInfo.algorithm || 'N/A'}</div>
        </div>
        <div className="q-card ws-meta-card">
          <div className="ws-meta-label">Quantum Safe</div>
          <div className="ws-meta-value" style={{ color: result.certificateInfo.isQuantumSafe ? 'var(--qg-green)' : 'var(--qg-red)' }}>
            {result.certificateInfo.isQuantumSafe ? 'YES' : 'NO'}
          </div>
        </div>
      </div>

      {/* ─── Quantum Risk Breakdown ─── */}
      {result.riskBreakdown && (
        <div className="q-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            Quantum Risk Breakdown
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {([
              { key: 'certificateRisk', label: 'Certificate', weight: '25%' },
              { key: 'tlsConfigRisk', label: 'TLS Config', weight: '25%' },
              { key: 'cipherSuiteRisk', label: 'Cipher Suite', weight: '20%' },
              { key: 'appCryptoRisk', label: 'App Crypto', weight: '15%' },
              { key: 'pqcReadiness', label: 'PQC Readiness', weight: '15%' },
            ] as const).map(({ key, label, weight }) => {
              const score = result.riskBreakdown![key]
              return (
                <div key={key} style={{
                  background: 'var(--qg-deep)', borderRadius: 'var(--radius-md)',
                  padding: '14px 12px', textAlign: 'center', border: '1px solid var(--qg-border)',
                }}>
                  <div style={{
                    fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)',
                    color: getRiskColor(score), marginBottom: 4,
                  }}>
                    {score}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--qg-text-secondary)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 9, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Weight: {weight}
                  </div>
                  {/* Risk bar */}
                  <div style={{
                    marginTop: 8, height: 4, background: 'var(--qg-border)', borderRadius: 2, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${score}%`, height: '100%', borderRadius: 2,
                      background: getRiskColor(score),
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Detected OIDs Table ─── */}
      {result.detectedOids && result.detectedOids.length > 0 && (
        <div className="q-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ws-findings-header">
            <h3>X.509 OID Analysis</h3>
            <span className="mono" style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              {result.detectedOids.length} OIDs detected
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--qg-border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--qg-text-muted)', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>OID</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--qg-text-muted)', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--qg-text-muted)', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--qg-text-muted)', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quantum Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--qg-text-muted)', fontWeight: 500, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PQC Replacement</th>
                </tr>
              </thead>
              <tbody>
                {result.detectedOids.map((oid, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--qg-border)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--qg-cyan)', fontSize: 11 }}>{oid.oid}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--qg-text-primary)' }}>{oid.name}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, textTransform: 'uppercase',
                        background: 'rgba(255, 243, 193, 0.1)', border: '1px solid rgba(255, 243, 193, 0.2)',
                        color: 'var(--qg-purple)',
                      }}>
                        {oid.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                        background: oid.quantumVulnerable ? 'rgba(255, 45, 85, 0.08)' : 'rgba(48, 209, 88, 0.08)',
                        border: `1px solid ${oid.quantumVulnerable ? 'rgba(255, 45, 85, 0.2)' : 'rgba(48, 209, 88, 0.2)'}`,
                        color: oid.quantumVulnerable ? 'var(--qg-red)' : 'var(--qg-green)',
                      }}>
                        {oid.quantumVulnerable ? `Vulnerable (${oid.quantumThreat})` : 'Safe'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--qg-text-secondary)', fontSize: 11 }}>
                      {oid.pqcReplacement || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Cipher Suite Breakdown ─── */}
      {result.cipherSuiteBreakdown && result.cipherSuiteBreakdown.length > 0 && (
        <div className="q-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ws-findings-header">
            <h3>Cipher Suite Analysis</h3>
            <span className="mono" style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              {result.cipherSuiteBreakdown.length} cipher suites analyzed
            </span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.cipherSuiteBreakdown.map((suite, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', background: 'var(--qg-deep)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--qg-border)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-primary)', marginBottom: 4 }}>
                    {suite.standardName || suite.name}
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--qg-text-muted)' }}>
                    <span>KEX: {suite.keyExchange}</span>
                    <span>Auth: {suite.authentication}</span>
                    <span>Enc: {suite.encryption}</span>
                    <span>MAC: {suite.mac}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 9, textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(255, 243, 193, 0.08)', border: '1px solid rgba(255, 243, 193, 0.2)',
                    color: 'var(--qg-purple)',
                  }}>
                    {suite.category}
                  </span>
                  <span className={`threat-badge ${getThreatBadgeClass(suite.riskLevel)}`}>
                    {suite.riskLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Repository Scan Results ─── */}
      {result.repoScanResult && result.repoScanResult.patterns.length > 0 && (
        <div className="q-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ws-findings-header">
            <h3>Repository Scan Results</h3>
            <span className="mono" style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              {result.repoScanResult.filesScanned}/{result.repoScanResult.totalFiles} files scanned &middot; {result.repoScanResult.patterns.length} patterns matched
            </span>
          </div>
          <div className="ws-findings-list">
            {result.repoScanResult.patterns.map((match, i) => (
              <div key={i} className="ws-finding-row animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="ws-finding-main">
                  <div className="ws-finding-top">
                    <span className={`threat-badge ${getThreatBadgeClass(match.threatLevel)}`}>
                      {match.threatLevel}
                    </span>
                    <span className="ws-finding-algo mono">{match.algorithm}</span>
                    <span className="ws-finding-cat">{match.category}</span>
                  </div>
                  <div className="ws-finding-location mono">
                    {match.file}:{match.line}
                  </div>
                  <p className="ws-finding-desc">{match.description}</p>
                  {match.snippet && (
                    <pre style={{
                      marginTop: 8, padding: '8px 12px', background: 'var(--qg-deep)',
                      borderRadius: 'var(--radius-sm)', fontSize: 11, fontFamily: 'var(--font-mono)',
                      color: 'var(--qg-amber)', overflow: 'auto', maxHeight: 80,
                      border: '1px solid var(--qg-border)',
                    }}>
                      {match.snippet}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── PQC Migration Recommendations ─── */}
      {result.pqcRecommendations && result.pqcRecommendations.length > 0 && (
        <div className="q-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ws-findings-header">
            <h3>PQC Migration Recommendations</h3>
            <span className="mono" style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              {result.pqcRecommendations.length} recommendations
            </span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.pqcRecommendations.map((rec, i) => {
              const isExpanded = expandedPqc === `${rec.currentAlgorithm}-${i}`
              const complexityColor = rec.migrationComplexity === 'CRITICAL' ? 'var(--qg-red)' :
                rec.migrationComplexity === 'HIGH' ? 'var(--qg-orange)' :
                rec.migrationComplexity === 'MEDIUM' ? 'var(--qg-amber)' : 'var(--qg-green)'

              return (
                <div key={i} style={{
                  background: 'var(--qg-deep)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--qg-border)', overflow: 'hidden',
                }}>
                  {/* Header — clickable to expand */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px', cursor: 'pointer',
                    }}
                    onClick={() => setExpandedPqc(isExpanded ? null : `${rec.currentAlgorithm}-${i}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--qg-red)', textDecoration: 'line-through' }}>
                        {rec.currentAlgorithm}
                      </div>
                      <span style={{ color: 'var(--qg-text-muted)', fontSize: 12 }}>→</span>
                      <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--qg-green)', fontWeight: 600 }}>
                        {rec.recommendedPQC}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 600,
                        fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
                        color: complexityColor,
                        background: `${complexityColor}15`, border: `1px solid ${complexityColor}30`,
                      }}>
                        {rec.migrationComplexity}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {rec.estimatedEffort}
                      </span>
                      <span style={{ color: 'var(--qg-text-muted)', fontSize: 12, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : '' }}>
                        ▾
                      </span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--qg-border)' }}>
                      <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Migration Type
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--qg-text-primary)' }}>{rec.migrationType}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            NIST Standard
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--qg-cyan)', fontFamily: 'var(--font-mono)' }}>{rec.nistStandard}</div>
                        </div>
                        {rec.alternativePQC.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                              Alternative PQC Options
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {rec.alternativePQC.map((alt, j) => (
                                <span key={j} style={{
                                  padding: '3px 10px', borderRadius: 10, fontSize: 10,
                                  fontFamily: 'var(--font-mono)', background: 'rgba(255, 243, 193, 0.08)',
                                  border: '1px solid rgba(255, 243, 193, 0.2)', color: 'var(--qg-purple)',
                                }}>
                                  {alt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                            Migration Steps
                          </div>
                          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {rec.migrationSteps.map((step, j) => (
                              <li key={j} style={{ fontSize: 11, color: 'var(--qg-text-secondary)', lineHeight: 1.5 }}>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── Detection Rules Triggered ─── */}
      {result.detectionRuleResults && result.detectionRuleResults.filter(r => r.triggered).length > 0 && (
        <div className="q-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ws-findings-header">
            <h3>Detection Rules Triggered</h3>
            <span className="mono" style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              {result.detectionRuleResults.filter(r => r.triggered).length} rules triggered
            </span>
          </div>
          <div className="ws-findings-list">
            {result.detectionRuleResults.filter(r => r.triggered).map((rule, i) => (
              <div key={rule.ruleId} className="ws-finding-row animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="ws-finding-main">
                  <div className="ws-finding-top">
                    <span className={`threat-badge ${getThreatBadgeClass(rule.severity)}`}>
                      {rule.severity}
                    </span>
                    <span className="ws-finding-algo mono">{rule.ruleId}</span>
                    <span className="ws-finding-cat">{rule.category}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--qg-text-primary)', fontWeight: 500, marginTop: 4 }}>
                    {rule.ruleName}
                  </div>
                  <p className="ws-finding-desc">{rule.details}</p>
                  <div className="ws-finding-recommendation">
                    <span className="ws-rec-label">Remediation:</span>
                    <span>{rule.remediation}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Findings Table */}
      <div className="q-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ws-findings-header">
          <h3>Vulnerability Findings</h3>
          <span className="mono" style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
            {result.totalFindings} total findings
          </span>
        </div>
        <div className="ws-findings-list">
          {result.findings.map((finding, i) => (
            <div key={finding.id} className="ws-finding-row animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="ws-finding-main">
                <div className="ws-finding-top">
                  <span className={`threat-badge ${getThreatBadgeClass(finding.threatLevel)}`}>
                    {finding.threatLevel}
                  </span>
                  <span className="ws-finding-algo mono">{finding.algorithm}</span>
                  <span className="ws-finding-cat">{finding.category}</span>
                </div>
                <div className="ws-finding-location mono">
                  {finding.location}
                  {finding.repoFilePath && finding.lineNumber && (
                    <span style={{ color: 'var(--qg-text-muted)', marginLeft: 8 }}>
                      ({finding.repoFilePath}:{finding.lineNumber})
                    </span>
                  )}
                </div>
                <p className="ws-finding-desc">{finding.description}</p>
                {finding.oid && (
                  <div style={{ fontSize: 10, color: 'var(--qg-cyan)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    OID: {finding.oid}
                  </div>
                )}
              </div>
              <div className="ws-finding-details">
                <div className="ws-finding-timing">
                  <div className="ws-timing-row">
                    <span className="ws-timing-label">Quantum Break:</span>
                    <span className="ws-timing-value" style={{ color: 'var(--qg-red)' }}>{finding.quantumBreakTime}</span>
                  </div>
                  <div className="ws-timing-row">
                    <span className="ws-timing-label">Classical Break:</span>
                    <span className="ws-timing-value" style={{ color: 'var(--qg-green)' }}>{finding.classicalBreakTime}</span>
                  </div>
                </div>
                <div className="ws-finding-recommendation">
                  <span className="ws-rec-label">Recommendation:</span>
                  <span>{finding.recommendation}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─── History Scan Results Component ──────────────────────────────────────────

function HistoryScanResults({ session, findings, loading, onBack, onExportJSON, onExportCSV, onDelete }: {
  session: HistorySession
  findings: HistoryFinding[]
  loading: boolean
  onBack: () => void
  onExportJSON?: (s: HistorySession) => void
  onExportCSV?: (s: HistorySession) => void
  onDelete?: (ids: string[]) => Promise<boolean>
}) {
  return (
    <>
      {/* Top bar with back + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button
          className="q-btn q-btn-ghost"
          onClick={onBack}
          style={{ padding: '8px 16px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to History
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {onExportJSON && (
            <button
              className="q-btn q-btn-ghost"
              onClick={() => onExportJSON(session)}
              style={{ padding: '6px 14px', fontSize: 11 }}
            >
              Download JSON
            </button>
          )}
          {onExportCSV && (
            <button
              className="q-btn q-btn-ghost"
              onClick={() => onExportCSV(session)}
              style={{ padding: '6px 14px', fontSize: 11 }}
            >
              Download CSV
            </button>
          )}
          {onDelete && (
            <button
              className="q-btn q-btn-ghost"
              onClick={async () => {
                if (confirm(`Delete scan for ${session.target}? This cannot be undone.`)) {
                  const ok = await onDelete([session.id])
                  if (ok) onBack()
                }
              }}
              style={{ padding: '6px 14px', fontSize: 11, color: 'var(--qg-red)', borderColor: 'rgba(255, 45, 85, 0.2)' }}
            >
              Delete Scan
            </button>
          )}
        </div>
      </div>

      {/* Risk Score Overview */}
      <div className="ws-risk-overview">
        <div className="ws-risk-gauge">
          <div className="ws-risk-score" style={{ color: getRiskColor(session.overall_risk_score) }}>
            {session.overall_risk_score}
          </div>
          <div className="ws-risk-label" style={{ color: getRiskColor(session.overall_risk_score) }}>
            {getRiskLabel(session.overall_risk_score)}
          </div>
          <div className="ws-risk-target mono">{session.target}</div>
          <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            Scanned {new Date(session.created_at).toLocaleString()}
          </div>
        </div>

        <div className="ws-risk-breakdown">
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-red)' }}>{session.critical_count}</span>
            <span className="ws-risk-stat-label">Critical</span>
          </div>
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-orange)' }}>{session.high_count}</span>
            <span className="ws-risk-stat-label">High</span>
          </div>
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-amber)' }}>{session.medium_count}</span>
            <span className="ws-risk-stat-label">Medium</span>
          </div>
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-cyan)' }}>{session.low_count}</span>
            <span className="ws-risk-stat-label">Low</span>
          </div>
          <div className="ws-risk-stat">
            <span className="ws-risk-stat-count" style={{ color: 'var(--qg-green)' }}>{session.safe_count}</span>
            <span className="ws-risk-stat-label">Safe</span>
          </div>
        </div>
      </div>

      {/* Scan Metadata */}
      <div className="ws-meta-grid">
        <div className="q-card ws-meta-card">
          <div className="ws-meta-label">Scan Duration</div>
          <div className="ws-meta-value">{(session.scan_duration || 0).toFixed(1)}s</div>
        </div>
        <div className="q-card ws-meta-card">
          <div className="ws-meta-label">TLS Version</div>
          <div className="ws-meta-value mono">{session.tls_version || 'N/A'}</div>
        </div>
        <div className="q-card ws-meta-card">
          <div className="ws-meta-label">Certificate Algorithm</div>
          <div className="ws-meta-value mono">{session.certificate_algorithm || 'N/A'}</div>
        </div>
        <div className="q-card ws-meta-card">
          <div className="ws-meta-label">Quantum Safe</div>
          <div className="ws-meta-value" style={{ color: session.is_quantum_safe ? 'var(--qg-green)' : 'var(--qg-red)' }}>
            {session.is_quantum_safe ? 'YES' : 'NO'}
          </div>
        </div>
      </div>

      {/* Findings */}
      <div className="q-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ws-findings-header">
          <h3>Vulnerability Findings</h3>
          <span className="mono" style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
            {loading ? 'Loading...' : `${findings.length} total findings`}
          </span>
        </div>
        <div className="ws-findings-list">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 8, animation: 'pulse-glow 2s infinite' }}>⚛️</div>
              <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>Loading findings...</div>
            </div>
          ) : findings.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--qg-text-muted)', fontSize: 13 }}>
              No findings recorded for this scan session
            </div>
          ) : (
            findings.map((finding, i) => (
              <div key={finding.id} className="ws-finding-row animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="ws-finding-main">
                  <div className="ws-finding-top">
                    <span className={`threat-badge ${getThreatBadgeClass(finding.threat_level)}`}>
                      {finding.threat_level.toUpperCase()}
                    </span>
                    <span className="ws-finding-algo mono">{finding.algorithm}</span>
                    <span className="ws-finding-cat">{finding.category}</span>
                  </div>
                  <div className="ws-finding-location mono">{finding.location}</div>
                  <p className="ws-finding-desc">{finding.description}</p>
                </div>
                <div className="ws-finding-details">
                  <div className="ws-finding-timing">
                    <div className="ws-timing-row">
                      <span className="ws-timing-label">Quantum Break:</span>
                      <span className="ws-timing-value" style={{ color: 'var(--qg-red)' }}>{finding.quantum_break_time}</span>
                    </div>
                    <div className="ws-timing-row">
                      <span className="ws-timing-label">Classical Break:</span>
                      <span className="ws-timing-value" style={{ color: 'var(--qg-green)' }}>{finding.classical_break_time}</span>
                    </div>
                  </div>
                  <div className="ws-finding-recommendation">
                    <span className="ws-rec-label">Recommendation:</span>
                    <span>{finding.recommendation}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
