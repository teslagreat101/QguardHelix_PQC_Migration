'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { getThreatLevelColor } from '@/lib/scanner/crypto-detector'
import { getMigrationRecommendation, calculateQuantumReadiness, type PQCRecommendation } from '@/lib/scanner/pqc-migration-engine'
import {
  INTEGRATION_PROVIDERS,
  getIntegrationCategories,
  getConnectionStats,
  type IntegrationProvider,
  type ConnectionStatus,
} from '@/lib/scanner/connection-manager'
import type { QuantumThreatLevel } from '@/types/quantum.types'
import type { QuantumRiskClassification, AttackCorrelation, RemediationModel, ScanEvidence } from '@/types/scanner.types'
import SecurityCoPilot from '@/components/ai/SecurityCoPilot'

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface ScanFinding {
  id: string
  detectedAlgorithm: string
  threatLevel: QuantumThreatLevel
  isHNDLRisk: boolean
  target: { name: string; type: string; provider?: string }
  quantumBreakTime: string
  classicalBreakTime: string
  recommendation: string
  description: string
  riskScore: number
  evidence?: ScanEvidence
  remediation?: RemediationModel
}

interface RiskAssessment {
  riskScore: number
  classification: QuantumRiskClassification
  detectedAssets: {
    rsaKeys: number
    eccKeys: number
    dhKeys: number
    ecdsaSignatures: number
    dsaKeys: number
    pgpKeys: number
    tlsCertificates: number
    smimeCertificates: number
    sshKeys: number
    walletKeys: number
    vaultParams: number
  }
  estimatedBreakWindow: { earliest: number; latest: number }
  attackCorrelations: AttackCorrelation[]
}

interface TelemetryLog {
  timestamp: string
  message: string
  type: string
}

function formatAuthority(authority?: RemediationModel['authority']): string {
  switch (authority) {
    case 'qguard_controlled': return 'QGuard controlled'
    case 'customer_admin_configurable': return 'Admin configurable'
    case 'provider_owned': return 'Provider owned'
    case 'advisory_only': return 'Advisory only'
    default: return 'Unclassified'
  }
}

function formatEvidence(evidence?: ScanEvidence): string {
  if (!evidence) return 'Evidence not classified'
  return `${evidence.kind.toUpperCase()} / ${evidence.confidence.toUpperCase()} confidence`
}

// ─── Scan Target Categories ─────────────────────────────────────────────────

interface TargetItem {
  key: string
  icon: string
  label: string
  desc: string
}

interface TargetCategory {
  name: string
  icon: string
  targets: TargetItem[]
}

const SCAN_CATEGORIES: TargetCategory[] = [
  {
    name: 'Local Assets',
    icon: '💻',
    targets: [
      { key: 'local-files', icon: '📁', label: 'Local Files', desc: 'Device storage' },
      { key: 'local-keystores', icon: '🔑', label: 'Local Key Stores', desc: 'Key containers' },
      { key: 'device-certificates', icon: '📜', label: 'Device Certificates', desc: 'X.509 certs' },
      { key: 'ssh-keys', icon: '🔐', label: 'SSH Key Directories', desc: '~/.ssh keys' },
    ],
  },
  {
    name: 'Email Platforms',
    icon: '📧',
    targets: [
      { key: 'gmail', icon: '✉️', label: 'Gmail', desc: 'S/MIME & PGP' },
      { key: 'outlook', icon: '📨', label: 'Outlook', desc: 'S/MIME & TLS' },
    ],
  },
  {
    name: 'Developer Platforms',
    icon: '🛠️',
    targets: [
      { key: 'github', icon: '🐙', label: 'GitHub', desc: 'Code repos' },
      { key: 'gitlab', icon: '🦊', label: 'GitLab', desc: 'DevOps platform' },
      { key: 'bitbucket', icon: '🪣', label: 'Bitbucket', desc: 'Atlassian repos' },
      { key: 'docker-hub', icon: '🐳', label: 'Docker Hub', desc: 'Container images' },
    ],
  },
  {
    name: 'Cloud Storage',
    icon: '☁️',
    targets: [
      { key: 'google-drive', icon: '🟢', label: 'Google Drive', desc: 'Stored certs/keys' },
      { key: 'dropbox', icon: '📦', label: 'Dropbox', desc: 'Stored certs/keys' },
      { key: 'onedrive', icon: '🔵', label: 'OneDrive', desc: 'Stored certs/keys' },
    ],
  },
  {
    name: 'Cloud Infrastructure',
    icon: '🏗️',
    targets: [
      { key: 'aws', icon: '🟠', label: 'AWS', desc: 'ACM/KMS/TLS' },
      { key: 'azure', icon: '🔷', label: 'Microsoft Azure', desc: 'Key Vault/TLS' },
      { key: 'google-cloud', icon: '🌐', label: 'Google Cloud', desc: 'KMS/SSL certs' },
      { key: 'cloudflare', icon: '🟡', label: 'Cloudflare', desc: 'SSL/TLS config' },
      { key: 'apple', icon: '🍎', label: 'Apple', desc: 'MDM/APNs certs' },
    ],
  },
  {
    name: 'Collaboration & Identity',
    icon: '💬',
    targets: [
      { key: 'discord', icon: '🎮', label: 'Discord', desc: 'Servers & E2EE posture' },
      { key: 'linkedin', icon: '💼', label: 'LinkedIn', desc: 'Org auth posture' },
    ],
  },
  {
    name: 'Security Operations',
    icon: '🛡️',
    targets: [
      { key: 'fortinet', icon: '🏰', label: 'Fortinet', desc: 'VPN/TLS/IPsec' },
      { key: 'sentinelone', icon: '🛡️', label: 'SentinelOne', desc: 'Endpoint certs' },
      { key: 'trendmicro', icon: '🔴', label: 'Trend Micro', desc: 'Endpoint telemetry' },
      { key: 'paloalto', icon: '🔥', label: 'Palo Alto', desc: 'VPN/TLS/IPsec' },
      { key: 'microsoft-365', icon: '🟦', label: 'Microsoft', desc: 'Defender/Entra' },
    ],
  },
]

const EXTERNAL_SCAN_TARGET_IDS = new Set(INTEGRATION_PROVIDERS.map((provider) => provider.id))

// ─── Component ──────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const { session } = useAuth()

  // Scanner state
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ScanFinding[]>([])
  const [scanComplete, setScanComplete] = useState(false)
  const [selectedTarget, setSelectedTarget] = useState('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [qScore, setQScore] = useState<number | null>(null)
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null)
  const [telemetryLog, setTelemetryLog] = useState<TelemetryLog[]>([])
  const [currentTarget, setCurrentTarget] = useState<string>('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(
    new Set(['local-files', 'ssh-keys'])
  )

  // Connection status (read-only — management is at /dashboard/integrations)
  const [integrations, setIntegrations] = useState<IntegrationProvider[]>(
    () => INTEGRATION_PROVIDERS.map((p) => ({ ...p }))
  )

  // Migration detail view
  const [migrationDetail, setMigrationDetail] = useState<string | null>(null)

  // Scan history
  interface ScanHistoryEntry {
    id: string
    scan_id: string
    targets: string[]
    scan_type: string
    status: string
    total_findings: number
    critical_count: number
    high_count: number
    medium_count: number
    low_count: number
    q_score: number | null
    risk_level: string | null
    findings: ScanFinding[]
    started_at: string
    completed_at: string | null
  }
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchScanHistory = useCallback(async () => {
    if (!session?.access_token) return
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/v1/scan/history', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const json = await res.json()
        setScanHistory(json.data?.scans || [])
      }
    } catch { /* ignore */ }
    finally { setHistoryLoading(false) }
  }, [session?.access_token])

  useEffect(() => { fetchScanHistory() }, [fetchScanHistory])

  const abortRef = useRef<AbortController | null>(null)

  // ─── Load Connection Status from Integration Engine ────────────────────────
  // Reads from the UIE engine API (same source as /dashboard/integrations)
  // so connected platforms are reflected accurately in the scanner.

  useEffect(() => {
    async function loadConnections() {
      try {
        // Primary: fetch from UIE engine API (requires auth)
        if (session?.access_token) {
          const res = await fetch('/api/v1/integrations/engine', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          if (res.ok) {
            const json = await res.json()
            const connectors = json.data?.connectors
            if (Array.isArray(connectors)) {
              setIntegrations((prev) =>
                prev.map((p) => {
                  const uie = connectors.find(
                    (c: { id: string; isConnected?: boolean; connection?: { status: string; account_label?: string; connected_at?: string } }) =>
                      c.id === p.id
                  )
                  if (uie?.isConnected && uie.connection) {
                    return {
                      ...p,
                      status: 'connected' as ConnectionStatus,
                      connectedAt: uie.connection.connected_at || new Date().toISOString(),
                      accountLabel: uie.connection.account_label || p.name,
                    }
                  }
                  return p
                })
              )
              return // Success — skip fallback
            }
          }
        }

        // Fallback: fetch from legacy integrations API (no auth required)
        const res = await fetch('/api/v1/integrations')
        const data = await res.json()
        if (data.success && data.data?.connections) {
          setIntegrations((prev) =>
            prev.map((p) => {
              const stored = data.data.connections.find(
                (c: { providerId: string }) => c.providerId === p.id
              )
              if (stored && stored.status === 'connected') {
                return {
                  ...p,
                  status: stored.status as ConnectionStatus,
                  connectedAt: stored.connectedAt,
                  expiresAt: stored.expiresAt,
                  accountLabel: stored.accountLabel || p.name,
                }
              }
              return p
            })
          )
        }
      } catch {
        // Non-critical — use defaults
      }
    }
    loadConnections()
  }, [session?.access_token])

  // ─── Connection Status (read-only) ────────────────────────────────────────

  const connectionStats = getConnectionStats(integrations)
  const integrationCategories = getIntegrationCategories(integrations)

  // Auto-select connected integrations as scan targets
  useEffect(() => {
    const connectedIds = new Set(
      integrations.filter((p) => p.status === 'connected').map((p) => p.id)
    )
    setSelectedTargets((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => !EXTERNAL_SCAN_TARGET_IDS.has(id) || connectedIds.has(id))
      )
      connectedIds.forEach((id) => next.add(id))
      return next
    })
  }, [integrations])

  // ─── Scan Target Logic ─────────────────────────────────────────────────────

  const canScanTarget = useCallback((target: string) => {
    if (!EXTERNAL_SCAN_TARGET_IDS.has(target)) return true
    return integrations.some((integration) => integration.id === target && integration.status === 'connected')
  }, [integrations])

  const toggleTarget = (target: string) => {
    if (!canScanTarget(target)) return
    setSelectedTargets((prev) => {
      const next = new Set(prev)
      if (next.has(target)) next.delete(target)
      else next.add(target)
      return next
    })
  }

  const toggleCategory = (categoryName: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryName)) next.delete(categoryName)
      else next.add(categoryName)
      return next
    })
  }

  const selectAllInCategory = (category: TargetCategory) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev)
      const selectableTargets = category.targets.filter((target) => canScanTarget(target.key))
      const allSelected = selectableTargets.length > 0 && selectableTargets.every((t) => next.has(t.key))
      if (allSelected) {
        selectableTargets.forEach((t) => next.delete(t.key))
      } else {
        selectableTargets.forEach((t) => next.add(t.key))
      }
      return next
    })
  }

  const selectAll = () => {
    const allKeys = SCAN_CATEGORIES
      .flatMap((c) => c.targets.map((t) => t.key))
      .filter((key) => canScanTarget(key))
    setSelectedTargets((prev) => {
      if (prev.size === allKeys.length) return new Set()
      return new Set(allKeys)
    })
  }

  const addTelemetry = useCallback((entry: TelemetryLog) => {
    setTelemetryLog((prev) => [...prev.slice(-99), entry])
  }, [])

  // ─── SSE Streaming Scan ───────────────────────────────────────────────────

  const startScan = async () => {
    if (!session?.access_token) {
      setTelemetryLog([{
        timestamp: new Date().toISOString(),
        message: 'Authentication required to run scanner telemetry',
        type: 'error',
      }])
      setScanComplete(true)
      return
    }

    setIsScanning(true)
    setProgress(0)
    setResults([])
    setScanComplete(false)
    setRiskAssessment(null)
    setTelemetryLog([])
    setCurrentTarget('')
    setQScore(null)
    setMigrationDetail(null)

    const targets = Array.from(selectedTargets).join(',')
    const controller = new AbortController()
    abortRef.current = controller

    // Determine scan depth based on number of targets
    const depth = selectedTargets.size <= 2 ? 'quick' : selectedTargets.size <= 6 ? 'standard' : 'deep'

    try {
      const response = await fetch(`/api/v1/scan/stream?targets=${encodeURIComponent(targets)}&depth=${depth}`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error')
        throw new Error(`Scan API returned ${response.status}: ${errorBody}`)
      }

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))

            switch (event.type) {
              case 'phase':
                if (event.target) setCurrentTarget(event.target)
                setProgress(event.progress || 0)
                addTelemetry({ timestamp: event.timestamp, message: event.message, type: 'info' })
                break

              case 'target-start':
                setCurrentTarget(event.target || '')
                setProgress(event.progress || 0)
                addTelemetry({ timestamp: event.timestamp, message: event.message, type: 'info' })
                break

              case 'finding':
                if (event.finding) {
                  setResults((prev) => {
                    // Deduplicate by id
                    if (prev.some((r) => r.id === event.finding.id)) return prev
                    return [...prev, event.finding]
                  })
                }
                setProgress(event.progress || 0)
                addTelemetry({ timestamp: event.timestamp, message: event.message, type: 'finding' })
                break

              case 'target-complete':
                setProgress(event.progress || 0)
                addTelemetry({ timestamp: event.timestamp, message: event.message, type: 'success' })
                break

              case 'scan-complete': {
                setProgress(100)
                if (event.message) {
                  try {
                    const summary = JSON.parse(event.message)
                    setQScore(summary.qScore)
                    setRiskAssessment(summary.riskAssessment)
                  } catch { /* ignore parse error */ }
                }
                addTelemetry({ timestamp: event.timestamp, message: 'Scan complete', type: 'complete' })
                break
              }

              case 'error':
                addTelemetry({ timestamp: event.timestamp, message: event.message || 'Error', type: 'error' })
                break
            }
          } catch { /* ignore malformed event */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Scan stream failed:', err)
        addTelemetry({ timestamp: new Date().toISOString(), message: 'Scan failed — connection error', type: 'error' })
      }
    } finally {
      setIsScanning(false)
      setScanComplete(true)
      setCurrentTarget('')
      abortRef.current = null
    }
  }

  // Persist scan results whenever a scan completes so /dashboard/migrate can use them
  // Also save to scan history for the history panel
  useEffect(() => {
    if (!scanComplete || results.length === 0) return

    const authHeaders = {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    }

    // Save to scan results store (for migration page)
    fetch('/api/v1/scan/results', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        findings: results,
        targets: Array.from(selectedTargets),
        qScore,
      }),
    }).catch(() => {})

    // Save to scan history
    if (session?.access_token) {
      fetch('/api/v1/scan/history', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          targets: Array.from(selectedTargets),
          scanType: 'standard',
          status: 'completed',
          findings: results,
          qScore,
          riskLevel: riskAssessment?.classification || null,
          summary: {
            totalFindings: results.length,
            critical: results.filter(r => r.threatLevel === 'critical').length,
            high: results.filter(r => r.threatLevel === 'high').length,
            medium: results.filter(r => r.threatLevel === 'medium').length,
            low: results.filter(r => r.threatLevel === 'low').length,
          },
        }),
      }).then(() => {
        // Refresh scan history
        fetchScanHistory()
      }).catch(() => {})
    }
  }, [scanComplete]) // eslint-disable-line react-hooks/exhaustive-deps

  const stopScan = () => {
    abortRef.current?.abort()
  }

  // ─── Filtering & Computed Values ──────────────────────────────────────────

  const filterTypes = ['all', ...new Set(results.map((r) => r.target.type))]
  const filteredResults = selectedTarget === 'all'
    ? results
    : results.filter((r) => r.target.type === selectedTarget)

  const riskColor = (classification: QuantumRiskClassification) => {
    switch (classification) {
      case 'CRITICAL': return '#ff2d55'
      case 'HIGH': return '#ff6b35'
      case 'MEDIUM': return '#ffcc00'
      case 'LOW': return '#30d158'
    }
  }

  const allTargetKeys = SCAN_CATEGORIES
    .flatMap((c) => c.targets.map((t) => t.key))
    .filter((key) => canScanTarget(key))

  // Quantum Readiness Score
  const readiness = scanComplete && results.length > 0
    ? calculateQuantumReadiness(results)
    : null

  const statusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected': return 'var(--qg-green)'
      case 'connecting': return 'var(--qg-cyan)'
      case 'expired': return 'var(--qg-orange)'
      case 'error': return 'var(--qg-red)'
      default: return 'var(--qg-text-muted)'
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="page-title animate-fade-in-up">Quantum Security Scanner</h1>
      <p className="page-subtitle animate-fade-in-up delay-100">
        Connect external assets, scan cryptographic infrastructure, and generate quantum risk analysis with post-quantum migration guidance
      </p>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Connected Assets (read-only status — manage at /integrations)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="q-card animate-fade-in-up delay-150" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>Connected Assets</h3>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              <span style={{ color: 'var(--qg-green)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {connectionStats.connected}
              </span>
              {' '}connected
              <span style={{ margin: '0 8px', color: 'var(--qg-border-bright)' }}>|</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{connectionStats.total}</span> scannable platforms
              {connectionStats.expired > 0 && (
                <>
                  <span style={{ margin: '0 8px', color: 'var(--qg-border-bright)' }}>|</span>
                  <span style={{ color: 'var(--qg-orange)', fontFamily: 'var(--font-mono)' }}>
                    {connectionStats.expired} expired
                  </span>
                </>
              )}
            </div>
          </div>
          <Link
            href="/dashboard/integrations"
            className="q-btn q-btn-primary"
            style={{ padding: '6px 14px', fontSize: 11, textDecoration: 'none' }}
          >
            🔗 Manage Integrations
          </Link>
        </div>

        {/* Compact platform status grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {integrationCategories.map((group) => (
            <div key={group.category}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', marginBottom: 6, letterSpacing: '0.04em' }}>
                {group.icon} {group.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {group.providers.map((p) => (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                    background: p.status === 'connected' ? 'rgba(48, 209, 88, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${p.status === 'connected' ? 'rgba(48, 209, 88, 0.2)' : 'var(--qg-border)'}`,
                    fontSize: 11,
                  }}>
                    <span style={{ fontSize: 14 }}>{p.icon}</span>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: statusColor(p.status),
                      flexShrink: 0,
                    }} />
                    {p.status === 'connected' && p.accountLabel && (
                      <span style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {p.accountLabel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Prompt to connect if none connected */}
        {connectionStats.connected === 0 && (
          <div style={{
            marginTop: 16, padding: '14px 16px', borderRadius: 'var(--radius-md)',
            background: 'rgba(212, 175, 55, 0.04)', border: '1px solid rgba(212, 175, 55, 0.15)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 18 }}>💡</span>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--qg-text-secondary)', lineHeight: 1.5 }}>
              Connect your platforms in the{' '}
              <Link href="/dashboard/integrations" style={{ color: 'var(--qg-cyan)', textDecoration: 'underline' }}>
                Integrations Hub
              </Link>{' '}
              to enable external platform scanning. Local asset scans work without any connections.
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Scan Controls & Target Selection
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="q-card animate-fade-in-up delay-200" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, flex: 1 }}>Scan Targets</h3>
          <button
            className="q-btn q-btn-ghost"
            onClick={selectAll}
            style={{ padding: '6px 14px', fontSize: 11 }}
          >
            {selectedTargets.size === allTargetKeys.length ? 'Deselect All' : 'Select All'}
          </button>
          {isScanning ? (
            <button className="q-btn" onClick={stopScan}
              style={{ padding: '8px 20px', fontSize: 13, background: 'var(--qg-red)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)' }}>
              Stop Scan
            </button>
          ) : (
            <button
              className="q-btn q-btn-primary"
              onClick={startScan}
              disabled={selectedTargets.size === 0}
              style={{ opacity: selectedTargets.size === 0 ? 0.5 : 1 }}
            >
              Start Quantum Scan
            </button>
          )}
        </div>

        {/* Grouped Target Categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {SCAN_CATEGORIES.map((category) => {
            const isCollapsed = collapsedCategories.has(category.name)
            const selectableInCategory = category.targets.filter((t) => canScanTarget(t.key))
            const selectedInCategory = selectableInCategory.filter((t) => selectedTargets.has(t.key)).length
            const allInCategorySelected = selectableInCategory.length > 0 && selectedInCategory === selectableInCategory.length

            return (
              <div key={category.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isCollapsed ? 0 : 10 }}>
                  <span style={{ fontSize: 18 }}>{category.icon}</span>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', flex: 1, color: 'var(--qg-text-secondary)' }}
                    onClick={() => toggleCategory(category.name)}
                  >
                    {category.name}
                    <span style={{ fontWeight: 400, color: 'var(--qg-text-muted)', marginLeft: 8, fontSize: 11 }}>
                      {selectedInCategory}/{selectableInCategory.length} selected
                    </span>
                  </span>
                  <button
                    className="q-btn q-btn-ghost"
                    style={{ padding: '2px 10px', fontSize: 10, opacity: selectableInCategory.length === 0 ? 0.5 : 1 }}
                    onClick={() => selectAllInCategory(category)}
                    disabled={selectableInCategory.length === 0}
                  >
                    {allInCategorySelected ? 'None' : 'All'}
                  </button>
                  <span
                    style={{ cursor: 'pointer', color: 'var(--qg-text-muted)', fontSize: 12, userSelect: 'none' }}
                    onClick={() => toggleCategory(category.name)}
                  >
                    {isCollapsed ? '▶' : '▼'}
                  </span>
                </div>

                {!isCollapsed && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, paddingLeft: 28 }}>
                    {category.targets.map((target) => {
                      const integration = integrations.find((i) => i.id === target.key)
                      const isConnected = integration?.status === 'connected'
                      const isExternal = !!integration
                      const canSelect = !isExternal || isConnected

                      return (
                        <div
                          key={target.key}
                          onClick={() => toggleTarget(target.key)}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${selectedTargets.has(target.key) ? 'var(--qg-cyan)' : 'var(--qg-border)'}`,
                            cursor: canSelect ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            transition: 'all 0.2s ease',
                            background: selectedTargets.has(target.key) ? 'rgba(212, 175, 55, 0.06)' : 'transparent',
                            opacity: canSelect ? 1 : 0.48,
                          }}
                          title={canSelect ? target.label : `Connect ${target.label} in Integrations before scanning`}
                        >
                          <span style={{ fontSize: 20 }}>{target.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {target.label}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {isExternal && isConnected && (
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--qg-green)', flexShrink: 0 }} />
                              )}
                              {isExternal && !isConnected && (
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--qg-text-muted)', flexShrink: 0 }} />
                              )}
                              {canSelect ? target.desc : 'Connect first'}
                            </div>
                          </div>
                          <span style={{ color: selectedTargets.has(target.key) ? 'var(--qg-green)' : 'var(--qg-text-muted)', fontSize: 13, flexShrink: 0 }}>
                            {selectedTargets.has(target.key) ? '✓' : '○'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress + Live Telemetry */}
        {isScanning && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-secondary)' }}>
                {currentTarget ? `Scanning ${currentTarget}...` : 'Initializing scan...'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>
                {Math.round(progress)}%
              </span>
            </div>
            <div className="q-progress" style={{ height: 8, marginBottom: 16 }}>
              <div className="q-progress-bar" style={{ width: `${progress}%`, transition: 'width 0.3s ease' }} />
            </div>

            <div style={{
              maxHeight: 160, overflowY: 'auto', background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px',
              fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.8,
            }}>
              {telemetryLog.slice(-20).map((entry, i) => (
                <div key={i} style={{
                  color: entry.type === 'error' ? 'var(--qg-red)'
                    : entry.type === 'finding' ? 'var(--qg-cyan)'
                    : entry.type === 'success' ? 'var(--qg-green)'
                    : 'var(--qg-text-muted)',
                }}>
                  <span style={{ color: 'var(--qg-text-muted)', marginRight: 8 }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  {entry.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Scan Results
          ═══════════════════════════════════════════════════════════════════════ */}
      {scanComplete && results.length > 0 && (
        <>
          {/* ─── Summary Stats ────────────────────────────────────────────── */}
          <div className="stats-grid">
            <div className="q-card stat-card animate-fade-in-up">
              <div className="stat-label">Q-Score</div>
              <div className="stat-value" style={{ color: qScore && qScore >= 60 ? 'var(--qg-green)' : 'var(--qg-red)' }}>
                {qScore ?? '-'}/100
              </div>
            </div>
            <div className="q-card stat-card animate-fade-in-up delay-100">
              <div className="stat-label">Critical</div>
              <div className="stat-value" style={{ color: 'var(--qg-red)' }}>
                {results.filter((r) => r.threatLevel === 'critical').length}
              </div>
            </div>
            <div className="q-card stat-card animate-fade-in-up delay-200">
              <div className="stat-label">HNDL Risks</div>
              <div className="stat-value" style={{ color: 'var(--qg-orange, #ff6b35)' }}>
                {results.filter((r) => r.isHNDLRisk).length}
              </div>
            </div>
            <div className="q-card stat-card animate-fade-in-up delay-300">
              <div className="stat-label">Quantum-Safe</div>
              <div className="stat-value" style={{ color: 'var(--qg-green)' }}>
                {results.filter((r) => r.threatLevel === 'safe' || r.threatLevel === 'low').length}
              </div>
            </div>
          </div>

          {/* ─── Migration CTA ────────────────────────────────────────────── */}
          {results.filter((r) => r.threatLevel === 'critical' || r.threatLevel === 'high').length > 0 && (
            <div className="q-card animate-fade-in-up" style={{
              marginBottom: 24, padding: '18px 24px',
              background: 'linear-gradient(135deg, rgba(255,243,193,0.06), rgba(212,175,55,0.04))',
              border: '1px solid rgba(255,243,193,0.25)',
              display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                  color: 'var(--qg-text-primary)', marginBottom: 4,
                }}>
                  ⚠️ Quantum-Vulnerable Cryptography Detected
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)',
                }}>
                  {results.filter((r) => r.threatLevel === 'critical').length} critical and{' '}
                  {results.filter((r) => r.threatLevel === 'high').length} high-risk findings need post-quantum migration
                </div>
              </div>
              <Link
                href={`/dashboard/migrate/wizard?targets=${encodeURIComponent(Array.from(selectedTargets).join(','))}`}
                className="q-btn q-btn-primary"
                style={{
                  padding: '10px 20px', fontSize: 12, textDecoration: 'none',
                  background: 'linear-gradient(135deg, var(--qg-violet), var(--qg-cyan))',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                🔄 Start PQC Migration
              </Link>
            </div>
          )}

          {/* ─── Quantum Readiness Score ───────────────────────────────────── */}
          {readiness && (
            <div className="q-card animate-fade-in-up delay-100" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, flex: 1 }}>Quantum Readiness Score</h3>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 13,
                  color: readiness.color, fontWeight: 700,
                }}>
                  {readiness.label}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {/* Readiness Gauge */}
                <div style={{
                  padding: 24, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--qg-border)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', letterSpacing: '0.06em', marginBottom: 12 }}>
                    READINESS SCORE
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 800,
                    color: readiness.color, lineHeight: 1,
                  }}>
                    {readiness.score}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginTop: 8 }}>
                    {readiness.quantumSafeAssets} of {readiness.totalAssets} assets quantum-safe
                  </div>
                </div>

                {/* Assets Requiring Migration */}
                <div style={{
                  padding: 20, background: 'rgba(255, 45, 85, 0.03)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--qg-border)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', letterSpacing: '0.06em', marginBottom: 12 }}>
                    ASSETS REQUIRING MIGRATION
                  </div>
                  {Object.entries(readiness.assetsRequiringMigration).length > 0 ? (
                    Object.entries(readiness.assetsRequiringMigration).map(([category, count]) => (
                      <div key={category} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                        <span style={{ color: 'var(--qg-text-secondary)' }}>{category}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--qg-red)' }}>{count}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--qg-green)' }}>All assets are quantum-safe</div>
                  )}
                </div>

                {/* File Patterns Detected */}
                <div style={{
                  padding: 20, background: 'rgba(212, 175, 55, 0.03)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--qg-border)',
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', letterSpacing: '0.06em', marginBottom: 12 }}>
                    CRYPTOGRAPHIC ARTIFACTS SCANNED
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {['.pem', '.key', '.pfx', '.p12', '.asc', '.gpg', '.ppk', '.jks', '.keystore', '.wallet'].map((ext) => (
                      <span key={ext} style={{
                        padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                        background: 'rgba(212, 175, 55, 0.06)', border: '1px solid var(--qg-border)',
                        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)',
                      }}>
                        {ext}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Quantum Risk Assessment ──────────────────────────────────── */}
          {riskAssessment && (
            <div className="q-card animate-fade-in-up delay-200" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, flex: 1 }}>Quantum Risk Assessment</h3>
                <span style={{
                  padding: '6px 18px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#000',
                  background: riskColor(riskAssessment.classification),
                }}>
                  {riskAssessment.classification}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                {/* Detected Assets Summary */}
                <div style={{ padding: 16, background: 'rgba(212,175,55,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--qg-border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', marginBottom: 12, letterSpacing: '0.06em' }}>
                    DETECTED ASSETS
                  </div>
                  {Object.entries(riskAssessment.detectedAssets)
                    .filter(([, count]) => count > 0)
                    .map(([key, count]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--qg-text-secondary)' }}>
                          {formatAssetLabel(key)}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--qg-cyan)' }}>
                          {count}
                        </span>
                      </div>
                    ))}
                </div>

                {/* Quantum Breakability Window */}
                <div style={{ padding: 16, background: 'rgba(255,45,85,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--qg-border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', marginBottom: 12, letterSpacing: '0.06em' }}>
                    QUANTUM BREAKABILITY WINDOW
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: riskColor(riskAssessment.classification), marginBottom: 8 }}>
                    {riskAssessment.estimatedBreakWindow.earliest} – {riskAssessment.estimatedBreakWindow.latest}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', lineHeight: 1.6 }}>
                    Estimated timeframe when a cryptographically relevant quantum computer could break detected algorithms using Shor&apos;s or Grover&apos;s algorithm.
                  </div>
                </div>

                {/* Risk Score Gauge */}
                <div style={{ padding: 16, background: 'rgba(255,243,193,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--qg-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', marginBottom: 12, letterSpacing: '0.06em' }}>
                    RISK SCORE
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 700, color: riskColor(riskAssessment.classification), lineHeight: 1 }}>
                    {riskAssessment.riskScore}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginTop: 8 }}>out of 100</div>
                </div>
              </div>

              {/* AI Attack Correlations */}
              {riskAssessment.attackCorrelations.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', marginBottom: 12, letterSpacing: '0.06em' }}>
                    AI ATTACK CHAIN CORRELATIONS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {riskAssessment.attackCorrelations.slice(0, 8).map((corr) => (
                      <div key={corr.id} style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--qg-border)',
                        background: 'rgba(0,0,0,0.15)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span className={`threat-badge threat-${corr.riskLevel.toLowerCase()}`} style={{ fontSize: 10 }}>
                            {corr.riskLevel}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{corr.source}</span>
                          <span style={{ fontSize: 11, color: 'var(--qg-text-muted)' }}>({corr.sourceType})</span>
                          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)' }}>
                            {corr.finding}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 12, color: 'var(--qg-text-secondary)', fontFamily: 'var(--font-mono)',
                          padding: '8px 12px', background: 'rgba(212,175,55,0.03)', borderRadius: 'var(--radius-sm, 4px)',
                          borderLeft: `3px solid ${riskColor(corr.riskLevel)}`,
                        }}>
                          {corr.chain}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Post-Quantum Migration Recommendations ───────────────────── */}
          <div className="q-card animate-fade-in-up delay-300" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Post-Quantum Migration Recommendations</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {getUniqueMigrationRecommendations(results).map((rec) => (
                <div
                  key={rec.classicalAlgorithm}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--qg-border)',
                    background: 'rgba(0, 0, 0, 0.15)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Migration header */}
                  <div
                    style={{
                      padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 12,
                      cursor: 'pointer',
                    }}
                    onClick={() => setMigrationDetail(
                      migrationDetail === rec.classicalAlgorithm ? null : rec.classicalAlgorithm
                    )}
                  >
                    <span className={`threat-badge threat-${rec.migrationComplexity === 'CRITICAL' ? 'critical' : rec.migrationComplexity === 'HIGH' ? 'high' : rec.migrationComplexity === 'MEDIUM' ? 'medium' : 'low'}`}
                      style={{ fontSize: 10 }}>
                      {rec.migrationComplexity}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--qg-red)' }}>
                          {rec.classicalAlgorithm}
                        </span>
                        <span style={{ color: 'var(--qg-text-muted)', fontSize: 12 }}>→</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--qg-green)' }}>
                          {rec.recommendedPQC}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginTop: 2 }}>
                        {rec.migrationType}
                      </div>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      color: 'var(--qg-text-muted)',
                      padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                      background: 'rgba(212,175,55,0.05)',
                    }}>
                      {rec.nistStandard}
                    </span>
                    <span style={{ color: 'var(--qg-text-muted)', fontSize: 14 }}>
                      {migrationDetail === rec.classicalAlgorithm ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded migration details */}
                  {migrationDetail === rec.classicalAlgorithm && (
                    <div style={{
                      padding: '16px 20px',
                      borderTop: '1px solid var(--qg-border)',
                      background: 'rgba(212, 175, 55, 0.02)',
                    }}>
                      {/* Migration Steps */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          color: 'var(--qg-text-muted)', letterSpacing: '0.06em',
                          marginBottom: 8,
                        }}>
                          MIGRATION STEPS
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {rec.migrationSteps.map((step, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 8,
                              fontSize: 12, color: 'var(--qg-text-secondary)',
                            }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                                color: 'var(--qg-cyan)', minWidth: 16,
                              }}>
                                {i + 1}.
                              </span>
                              {step}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Alternative PQC algorithms */}
                      {rec.alternativePQC.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            color: 'var(--qg-text-muted)', letterSpacing: '0.06em',
                            marginBottom: 8,
                          }}>
                            ALTERNATIVE PQC ALGORITHMS
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {rec.alternativePQC.map((alt) => (
                              <span key={alt} style={{
                                padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                                background: 'rgba(255, 243, 193, 0.08)',
                                border: '1px solid rgba(255, 243, 193, 0.2)',
                                fontSize: 11, fontFamily: 'var(--font-mono)',
                                color: 'var(--qg-violet)',
                              }}>
                                {alt}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Estimated effort */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        fontSize: 12, color: 'var(--qg-text-muted)',
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em' }}>
                          ESTIMATED EFFORT:
                        </span>
                        <span style={{ color: 'var(--qg-text-secondary)', fontWeight: 600 }}>
                          {rec.estimatedEffort}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ─── Telemetry Log (post-scan) ────────────────────────────────── */}
          {telemetryLog.length > 0 && (
            <div className="q-card animate-fade-in-up delay-300" style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12 }}>Scan Telemetry Log</h3>
              <div style={{
                maxHeight: 200, overflowY: 'auto', background: 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
                fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.8,
              }}>
                {telemetryLog.map((entry, i) => (
                  <div key={i} style={{
                    color: entry.type === 'error' ? 'var(--qg-red)'
                      : entry.type === 'finding' ? 'var(--qg-cyan)'
                      : entry.type === 'success' ? 'var(--qg-green)'
                      : entry.type === 'complete' ? 'var(--qg-violet, #fff3c1)'
                      : 'var(--qg-text-muted)',
                  }}>
                    <span style={{ color: 'var(--qg-text-muted)', marginRight: 8 }}>
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Result Filters ───────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {filterTypes.map((filter) => (
              <button key={filter}
                className={`q-btn ${selectedTarget === filter ? 'q-btn-primary' : 'q-btn-ghost'}`}
                style={{ padding: '6px 16px', fontSize: 12, textTransform: 'capitalize' }}
                onClick={() => setSelectedTarget(filter)}
              >
                {filter === 'all' ? `All Results (${results.length})` : filter.replace(/-/g, ' ')}
              </button>
            ))}
          </div>

          {/* ─── Results Table ─────────────────────────────────────────────── */}
          <div className="q-card animate-fade-in-up delay-200">
            <table className="q-table">
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Threat Level</th>
                  <th>HNDL Risk</th>
                  <th>Target</th>
                  <th>Type</th>
                  <th>Quantum Break Time</th>
                  <th>Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((result, idx) => {
                  const migration = getMigrationRecommendation(result.detectedAlgorithm)
                  const protectionPathLabel = result.remediation?.canDirectlyMigrate
                    ? migration?.recommendedPQC
                    : result.remediation?.label || migration?.recommendedPQC

                  return (
                    <React.Fragment key={`${result.id}-${idx}`}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>{result.detectedAlgorithm}</td>
                        <td><span className={`threat-badge threat-${result.threatLevel}`}>{result.threatLevel}</span></td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: result.isHNDLRisk ? 'var(--qg-red)' : 'var(--qg-green)' }}>
                          {result.isHNDLRisk ? 'YES' : 'NO'}
                        </td>
                        <td style={{ fontSize: 13 }}>{result.target.name}</td>
                        <td style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>{result.target.type}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-secondary)' }}>{result.quantumBreakTime}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: getThreatLevelColor(result.threatLevel) }}>{result.riskScore}</td>
                        <td style={{ color: 'var(--qg-text-muted)', fontSize: 14 }}>{expandedId === result.id ? '▲' : '▼'}</td>
                      </tr>
                      {expandedId === result.id && (
                        <tr key={`${result.id}-detail`}>
                          <td colSpan={8} style={{ padding: '16px 20px', background: 'rgba(212, 175, 55, 0.02)', borderLeft: `3px solid ${getThreatLevelColor(result.threatLevel)}` }}>
                            <div style={{ fontSize: 14, marginBottom: 8 }}>
                              <strong style={{ color: 'var(--qg-text-secondary)' }}>Description:</strong>{' '}
                              <span style={{ color: 'var(--qg-text-muted)' }}>{result.description}</span>
                            </div>
                            <div style={{ fontSize: 14, marginBottom: 12 }}>
                              <strong style={{ color: 'var(--qg-cyan)' }}>Recommendation:</strong>{' '}
                              <span style={{ color: 'var(--qg-text-secondary)' }}>{result.recommendation}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginBottom: 12 }}>
                              Classical break time: {result.classicalBreakTime}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
                              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)', marginBottom: 4 }}>EVIDENCE</div>
                                <div style={{ fontSize: 12, color: 'var(--qg-text-secondary)', marginBottom: 4 }}>{formatEvidence(result.evidence)}</div>
                                <div style={{ fontSize: 11, color: 'var(--qg-text-muted)' }}>{result.evidence?.detail || 'Connect a real provider adapter or local agent for observed evidence.'}</div>
                              </div>
                              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,159,10,0.04)', border: '1px solid rgba(255,159,10,0.14)' }}>
                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)', marginBottom: 4 }}>REMEDIATION AUTHORITY</div>
                                <div style={{ fontSize: 12, color: result.remediation?.canDirectlyMigrate ? 'var(--qg-green)' : 'var(--qg-amber)' }}>
                                  {formatAuthority(result.remediation?.authority)}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginTop: 4 }}>{result.remediation?.summary || 'No remediation model available.'}</div>
                              </div>
                            </div>

                            {/* Protection path inline */}
                            {migration && (
                              <div style={{
                                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                background: 'rgba(48, 209, 88, 0.04)',
                                border: '1px solid rgba(48, 209, 88, 0.15)',
                                marginBottom: 12,
                              }}>
                                <div style={{
                                  fontFamily: 'var(--font-mono)', fontSize: 10,
                                  color: 'var(--qg-text-muted)', letterSpacing: '0.06em',
                                  marginBottom: 6,
                                }}>
                                  {result.remediation?.canDirectlyMigrate ? 'DIRECT PROTECTION PATH' : 'PROTECTION / ADVISORY PATH'}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-red)', fontWeight: 600 }}>
                                    {migration.classicalAlgorithm}
                                  </span>
                                  <span style={{ color: 'var(--qg-text-muted)', fontSize: 11 }}>→</span>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-green)', fontWeight: 600 }}>
                                    {protectionPathLabel}
                                  </span>
                                  <span style={{
                                    fontFamily: 'var(--font-mono)', fontSize: 9,
                                    padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(212,175,55,0.06)',
                                    color: 'var(--qg-cyan)',
                                  }}>
                                    {migration.nistStandard}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--qg-text-muted)' }}>
                                  {result.remediation?.nextStep || migration.migrationType} &mdash; Est. effort: {migration.estimatedEffort}
                                </div>
                              </div>
                            )}

                            <a href="/dashboard/migrate/wizard" className="q-btn q-btn-primary" style={{ padding: '8px 20px', fontSize: 11, textDecoration: 'none' }}>
                              Protect / Plan
                            </a>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ─── AI Security Co-Pilot ──────────────────────────────────────── */}
          <SecurityCoPilot
            findings={results}
            qScore={qScore}
            targets={Array.from(selectedTargets)}
            accessToken={session?.access_token}
          />
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Scan History
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="q-card animate-fade-in-up" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, flex: 1, margin: 0 }}>Scan History</h3>
          <button
            className="q-btn q-btn-ghost"
            onClick={fetchScanHistory}
            disabled={historyLoading}
            style={{ padding: '6px 14px', fontSize: 11 }}
          >
            {historyLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {scanHistory.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
            {historyLoading ? 'Loading scan history...' : 'No scan history yet. Run a scan to see results here.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scanHistory.map((scan) => {
              const statusColors: Record<string, { color: string; bg: string }> = {
                completed: { color: 'var(--qg-green)', bg: 'rgba(48,209,88,0.08)' },
                running: { color: 'var(--qg-cyan)', bg: 'rgba(212,175,55,0.08)' },
                failed: { color: 'var(--qg-red)', bg: 'rgba(255,45,85,0.08)' },
                cancelled: { color: 'var(--qg-text-muted)', bg: 'rgba(255,255,255,0.04)' },
              }
              const sc = statusColors[scan.status] || statusColors.completed
              const targetLabels = scan.targets.slice(0, 3).join(', ')
              const moreCount = scan.targets.length > 3 ? ` +${scan.targets.length - 3}` : ''

              return (
                <div key={scan.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--qg-border)',
                }}>
                  {/* Status indicator */}
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: sc.color,
                    boxShadow: scan.status === 'running' ? `0 0 8px ${sc.color}` : undefined,
                  }} />

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
                        color: 'var(--qg-text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {targetLabels}{moreCount}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 6px',
                        borderRadius: 3, background: sc.bg, color: sc.color,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {scan.status}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 6px',
                        borderRadius: 3, background: 'rgba(255,243,193,0.08)', color: 'var(--qg-violet)',
                        textTransform: 'uppercase',
                      }}>
                        {scan.scan_type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)' }}>
                      <span>{new Date(scan.started_at).toLocaleString()}</span>
                      <span>{scan.total_findings} findings</span>
                      {scan.critical_count > 0 && (
                        <span style={{ color: 'var(--qg-red)' }}>{scan.critical_count} critical</span>
                      )}
                      {scan.high_count > 0 && (
                        <span style={{ color: 'var(--qg-orange, #ff6b35)' }}>{scan.high_count} high</span>
                      )}
                      {scan.q_score != null && (
                        <span style={{ color: scan.q_score >= 60 ? 'var(--qg-green)' : 'var(--qg-red)' }}>
                          Q-Score: {scan.q_score}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '5px 10px', fontSize: 10 }}
                      title="View details"
                      onClick={() => {
                        // Load this scan's findings into the results view
                        if (scan.findings && scan.findings.length > 0) {
                          setResults(scan.findings as ScanFinding[])
                          setQScore(scan.q_score)
                          setScanComplete(true)
                        }
                      }}
                    >
                      View
                    </button>
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '5px 10px', fontSize: 10 }}
                      title="Export results"
                      onClick={() => {
                        const exportData = {
                          scanId: scan.scan_id,
                          targets: scan.targets,
                          scanType: scan.scan_type,
                          status: scan.status,
                          qScore: scan.q_score,
                          riskLevel: scan.risk_level,
                          totalFindings: scan.total_findings,
                          findings: scan.findings,
                          startedAt: scan.started_at,
                          completedAt: scan.completed_at,
                        }
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `qguard-scan-${new Date(scan.started_at).toISOString().slice(0, 10)}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                    >
                      Export
                    </button>
                    <Link
                      href={`/dashboard/migrate/wizard?targets=${encodeURIComponent(scan.targets.join(','))}`}
                      className="q-btn q-btn-ghost"
                      style={{ padding: '5px 10px', fontSize: 10, textDecoration: 'none' }}
                      title="Send to migration"
                      onClick={() => {
                        // Also persist these findings so migration page picks them up
                        if (scan.findings?.length > 0 && session?.access_token) {
                          fetch('/api/v1/scan/results', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({
                              findings: scan.findings,
                              targets: scan.targets,
                              qScore: scan.q_score,
                            }),
                          }).catch(() => {})
                        }
                      }}
                    >
                      Migrate
                    </Link>
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '5px 10px', fontSize: 10, color: 'var(--qg-red)' }}
                      title="Delete scan"
                      onClick={async () => {
                        if (!session?.access_token) return
                        await fetch(`/api/v1/scan/history?id=${scan.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${session.access_token}` },
                        })
                        fetchScanHistory()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatAssetLabel(key: string): string {
  const labels: Record<string, string> = {
    rsaKeys: 'RSA Keys',
    eccKeys: 'ECC Keys',
    dhKeys: 'DH Keys',
    ecdsaSignatures: 'ECDSA Signatures',
    dsaKeys: 'DSA Keys',
    pgpKeys: 'PGP Keys',
    tlsCertificates: 'TLS Certificates',
    smimeCertificates: 'S/MIME Certificates',
    sshKeys: 'SSH Keys',
    walletKeys: 'Wallet Keys',
    vaultParams: 'Vault Parameters',
  }
  return labels[key] || key
}

function getUniqueMigrationRecommendations(results: ScanFinding[]): PQCRecommendation[] {
  const seen = new Set<string>()
  const recommendations: PQCRecommendation[] = []

  for (const result of results) {
    if (seen.has(result.detectedAlgorithm)) continue
    seen.add(result.detectedAlgorithm)

    const rec = getMigrationRecommendation(result.detectedAlgorithm)
    if (rec) {
      recommendations.push(rec)
    }
  }

  // Sort by migration complexity: CRITICAL > HIGH > MEDIUM > LOW
  const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  return recommendations.sort((a, b) => (order[a.migrationComplexity] ?? 4) - (order[b.migrationComplexity] ?? 4))
}
