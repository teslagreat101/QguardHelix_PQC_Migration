import { NextRequest } from 'next/server'
import { getTokenFromHeaderOrQuery, getServerUserFromToken } from '@/lib/server-auth'
import { createAuthClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

function sseError(message: string) {
  const encoder = new TextEncoder()
  const body = encoder.encode(
    `event: error\ndata: ${JSON.stringify({ error: message })}\n\nretry: 86400000\n\n`
  )
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}

/**
 * GET /api/v1/monitoring/stream
 * SSE endpoint for the monitoring dashboard. Pushes:
 * - monitoring-snapshot: full state on connect and when data changes
 * - alert-new: newly created monitoring alerts
 * - activity: recent user activity events
 * - qscore-update: Q-Score changes
 */
export async function GET(request: NextRequest) {
  const token = getTokenFromHeaderOrQuery(request)
  if (!token) return sseError('Unauthorized')

  let userId: string
  try {
    const user = await getServerUserFromToken(token)
    if (!user) return sseError('Invalid token')
    userId = user.id
  } catch {
    return sseError('Auth service unavailable')
  }

  const encoder = new TextEncoder()

  let lastAlertId: string | null = null
  let lastQScore: number | null = null
  let lastScanCount = -1
  let lastWebScanCount = -1
  let lastKeyCount = -1
  let lastVaultFileCount = -1
  let lastAssetHash = ''

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: connected\ndata: {}\n\n'))

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      const poll = setInterval(async () => {
        try {
          const client = createAuthClient(token)
          if (!client) return

          const now24hAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

          const [
            profileResult,
            alertsResult,
            unreadAlertsResult,
            scanSessionsResult,
            webScanSessionsResult,
            keysResult,
            vaultFilesResult,
            recentScansResult,
            recentWebScansResult,
            recentKeysResult,
            migrationResult,
            monitoredAssetsResult,
          ] = await Promise.all([
            // Q-Score and profile
            client
              .from('profiles')
              .select('q_score, tier, vault_storage_used, keys_generated_today')
              .eq('id', userId)
              .single(),
            // Recent alerts (last 20)
            client
              .from('monitoring_alerts')
              .select('id, type, title, message, severity, is_read, action_url, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(20),
            // Unread alerts count
            client
              .from('monitoring_alerts')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('is_read', false),
            // Total scan sessions
            client
              .from('scan_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId),
            // Total web scan sessions
            client
              .from('web_scan_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId),
            // Total keys
            client
              .from('generated_keys')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId),
            // Total vault files
            client
              .from('vault_files')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId),
            // Recent scan sessions (last 10)
            client
              .from('scan_sessions')
              .select('id, status, targets_scanned, total_findings, critical_count, high_count, medium_count, low_count, q_score_overall, started_at, completed_at, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(10),
            // Recent web scans (last 10)
            client
              .from('web_scan_sessions')
              .select('id, target, target_type, overall_risk_score, total_findings, critical_count, high_count, medium_count, low_count, safe_count, is_quantum_safe, scan_duration, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(10),
            // Recent keys (last 10)
            client
              .from('generated_keys')
              .select('id, algorithm, status, quality_score, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(10),
            // Migration logs
            client
              .from('migration_logs')
              .select('id, file_name, original_algorithm, new_algorithm, status, before_score, after_score, created_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(10),
            // User-defined monitored assets
            client
              .from('monitored_assets')
              .select('id, label, asset_type, target, status, last_checked, last_risk, findings, is_quantum_safe, check_interval_s, error_message, created_at, updated_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false }),
          ])

          const profile = profileResult.data
          const alerts = alertsResult.data || []
          const unreadCount = unreadAlertsResult.count || 0
          const scanCount = scanSessionsResult.count || 0
          const webScanCount = webScanSessionsResult.count || 0
          const keyCount = keysResult.count || 0
          const vaultFileCount = vaultFilesResult.count || 0
          const recentScans = recentScansResult.data || []
          const recentWebScans = recentWebScansResult.data || []
          const recentKeys = recentKeysResult.data || []
          const migrations = migrationResult.data || []
          const monitoredAssets = monitoredAssetsResult.data || []

          const currentQScore = profile?.q_score ?? 0

          // Build a quick hash of asset states to detect changes
          const assetHash = monitoredAssets.map((a: Record<string, unknown>) => `${a.id}:${a.status}:${a.last_risk}:${a.findings}:${a.updated_at}`).join('|')

          // Check for changes
          const hasChanges =
            lastScanCount !== scanCount ||
            lastWebScanCount !== webScanCount ||
            lastKeyCount !== keyCount ||
            lastVaultFileCount !== vaultFileCount ||
            lastQScore !== currentQScore ||
            lastAssetHash !== assetHash

          if (hasChanges || lastScanCount === -1) {
            // Aggregate vulnerability data
            const allWebFindings = recentWebScans.reduce((acc, s) => ({
              total: acc.total + (s.total_findings || 0),
              critical: acc.critical + (s.critical_count || 0),
              high: acc.high + (s.high_count || 0),
              medium: acc.medium + (s.medium_count || 0),
              low: acc.low + (s.low_count || 0),
              safe: acc.safe + (s.safe_count || 0),
            }), { total: 0, critical: 0, high: 0, medium: 0, low: 0, safe: 0 })

            const quantumSafe = recentWebScans.filter(s => s.is_quantum_safe).length
            const quantumVulnerable = recentWebScans.filter(s => !s.is_quantum_safe).length
            const avgRiskScore = recentWebScans.length > 0
              ? Math.round(recentWebScans.reduce((sum, s) => sum + (s.overall_risk_score || 0), 0) / recentWebScans.length)
              : 0

            // Build monitored sources from actual data
            const monitoredSources = [
              {
                id: 'quantum-scanner',
                label: 'Quantum Scanner',
                icon: 'scanner',
                status: scanCount > 0 ? 'active' : 'inactive',
                lastScan: recentScans[0]?.created_at || null,
                findings: recentScans[0]?.total_findings || 0,
                totalScans: scanCount,
              },
              {
                id: 'web-scanner',
                label: 'Web Scanner',
                icon: 'web',
                status: webScanCount > 0 ? 'active' : 'inactive',
                lastScan: recentWebScans[0]?.created_at || null,
                findings: recentWebScans[0]?.total_findings || 0,
                totalScans: webScanCount,
              },
              {
                id: 'key-generator',
                label: 'Key Generator',
                icon: 'key',
                status: keyCount > 0 ? 'active' : 'inactive',
                lastScan: recentKeys[0]?.created_at || null,
                findings: 0,
                totalScans: keyCount,
              },
              {
                id: 'quantum-vault',
                label: 'Quantum Vault',
                icon: 'vault',
                status: vaultFileCount > 0 ? 'active' : 'inactive',
                lastScan: null,
                findings: 0,
                totalScans: vaultFileCount,
              },
              {
                id: 'migration-engine',
                label: 'Migration Engine',
                icon: 'migration',
                status: migrations.length > 0 ? 'active' : 'inactive',
                lastScan: migrations[0]?.created_at || null,
                findings: migrations.filter(m => m.status === 'failed').length,
                totalScans: migrations.length,
              },
            ]

            const activeSources = monitoredSources.filter(s => s.status === 'active').length

            controller.enqueue(encoder.encode(
              `event: monitoring-snapshot\ndata: ${JSON.stringify({
                timestamp: new Date().toISOString(),
                qScore: currentQScore,
                tier: profile?.tier || 'free',
                stats: {
                  activeSources,
                  totalSources: monitoredSources.length,
                  unreadAlerts: unreadCount,
                  criticalAlerts: alerts.filter(a => a.severity === 'critical' && !a.is_read).length,
                  totalScans: scanCount + webScanCount,
                  totalKeys: keyCount,
                  totalVaultFiles: vaultFileCount,
                },
                alerts: alerts.map(a => ({
                  id: a.id,
                  type: a.type,
                  title: a.title,
                  message: a.message,
                  severity: a.severity,
                  isRead: a.is_read,
                  actionUrl: a.action_url,
                  createdAt: a.created_at,
                })),
                monitoredSources,
                vulnerabilities: allWebFindings,
                riskMetrics: {
                  avgRiskScore,
                  quantumSafe,
                  quantumVulnerable,
                },
                recentWebScans: recentWebScans.map(s => ({
                  id: s.id,
                  target: s.target,
                  targetType: s.target_type,
                  riskScore: s.overall_risk_score || 0,
                  findings: s.total_findings || 0,
                  criticalCount: s.critical_count || 0,
                  isQuantumSafe: s.is_quantum_safe || false,
                  duration: s.scan_duration || 0,
                  createdAt: s.created_at,
                })),
                recentScans: recentScans.map(s => ({
                  id: s.id,
                  status: s.status,
                  targets: s.targets_scanned || 0,
                  findings: s.total_findings || 0,
                  qScore: s.q_score_overall,
                  createdAt: s.created_at,
                })),
                migrations: migrations.map(m => ({
                  id: m.id,
                  fileName: m.file_name,
                  from: m.original_algorithm,
                  to: m.new_algorithm,
                  status: m.status,
                  scoreDelta: (m.after_score || 0) - (m.before_score || 0),
                  createdAt: m.created_at,
                })),
                userAssets: monitoredAssets.map((a: Record<string, unknown>) => ({
                  id: a.id,
                  label: a.label,
                  assetType: a.asset_type,
                  target: a.target,
                  status: a.status,
                  lastChecked: a.last_checked,
                  lastRisk: a.last_risk ?? 0,
                  findings: a.findings ?? 0,
                  isQuantumSafe: a.is_quantum_safe,
                  checkIntervalS: a.check_interval_s,
                  errorMessage: a.error_message,
                  createdAt: a.created_at,
                  updatedAt: a.updated_at,
                })),
              })}\n\n`
            ))

            // Emit Q-Score update if changed
            if (lastQScore !== null && lastQScore !== currentQScore) {
              controller.enqueue(encoder.encode(
                `event: qscore-update\ndata: ${JSON.stringify({
                  previous: lastQScore,
                  current: currentQScore,
                  delta: currentQScore - lastQScore,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              ))
            }

            // Detect new alerts
            if (lastAlertId && alerts.length > 0 && alerts[0].id !== lastAlertId) {
              const newAlerts = []
              for (const alert of alerts) {
                if (alert.id === lastAlertId) break
                newAlerts.push(alert)
              }
              for (const alert of newAlerts) {
                controller.enqueue(encoder.encode(
                  `event: alert-new\ndata: ${JSON.stringify({
                    id: alert.id,
                    type: alert.type,
                    title: alert.title,
                    message: alert.message,
                    severity: alert.severity,
                    createdAt: alert.created_at,
                  })}\n\n`
                ))
              }
            }

            lastAlertId = alerts[0]?.id || null
            lastQScore = currentQScore
            lastScanCount = scanCount
            lastWebScanCount = webScanCount
            lastKeyCount = keyCount
            lastVaultFileCount = vaultFileCount
            lastAssetHash = assetHash
          }
        } catch {
          // Silently handle poll errors — SSE stays open
        }
      }, 8000)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        clearInterval(poll)
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
