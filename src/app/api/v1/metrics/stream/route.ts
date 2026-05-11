import { NextRequest } from 'next/server'
import { getTokenFromHeaderOrQuery, getServerUserFromToken } from '@/lib/server-auth'
import { createAuthClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** Return a self-closing SSE stream that tells the client not to reconnect. */
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
 * GET /api/v1/metrics/stream
 * SSE endpoint that pushes real-time metrics updates to the dashboard.
 * Polls the database every 8 seconds and emits metric deltas.
 */
export async function GET(request: NextRequest) {
  const token = getTokenFromHeaderOrQuery(request)

  if (!token) {
    return sseError('Unauthorized')
  }

  let userId: string
  try {
    const user = await getServerUserFromToken(token)
    if (!user) {
      return sseError('Invalid token')
    }
    userId = user.id
  } catch {
    return sseError('Auth service unavailable')
  }
  const encoder = new TextEncoder()

  // Track last known counts to detect changes
  let lastWebScanCount = -1
  let lastScanCount = -1
  let lastKeyCount = -1
  let lastVaultFileCount = -1
  let lastActiveKeyCount = -1
  let lastRevokedKeyCount = -1

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'))

      // Heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      // Poll for metric changes every 8 seconds
      const pollInterval = setInterval(async () => {
        try {
          const authClient = createAuthClient(token)
          if (!authClient) return

          // Fetch latest counts in parallel
          const [webScans, scans, keys, vaultFiles, activeKeys, revokedKeys, recentKeys] = await Promise.all([
            authClient
              .from('web_scan_sessions')
              .select('id, target, target_type, overall_risk_score, total_findings, critical_count, high_count, medium_count, low_count, safe_count, scan_duration, is_quantum_safe, created_at', { count: 'exact' })
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(10),
            authClient
              .from('scan_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId),
            authClient
              .from('generated_keys')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId),
            authClient
              .from('vault_files')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId),
            authClient
              .from('generated_keys')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('status', 'active'),
            authClient
              .from('generated_keys')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('status', 'revoked'),
            authClient
              .from('generated_keys')
              .select('id, algorithm, fingerprint, status, quality_score, bit_length, created_at, revoked_at, expires_at')
              .eq('user_id', userId)
              .order('created_at', { ascending: false })
              .limit(5),
          ])

          const currentWebScanCount = webScans.count || 0
          const currentScanCount = scans.count || 0
          const currentKeyCount = keys.count || 0
          const currentVaultFileCount = vaultFiles.count || 0
          const currentActiveKeyCount = activeKeys.count || 0
          const currentRevokedKeyCount = revokedKeys.count || 0

          // Detect changes and emit targeted updates
          const hasChanges =
            lastWebScanCount !== currentWebScanCount ||
            lastScanCount !== currentScanCount ||
            lastKeyCount !== currentKeyCount ||
            lastVaultFileCount !== currentVaultFileCount ||
            lastActiveKeyCount !== currentActiveKeyCount ||
            lastRevokedKeyCount !== currentRevokedKeyCount

          if (hasChanges || lastWebScanCount === -1) {
            // Emit web scanner metrics update with recent scan data
            const recentWebScans = (webScans.data || []).map(s => ({
              target: s.target,
              targetType: s.target_type,
              riskScore: s.overall_risk_score || 0,
              findingsCount: s.total_findings || 0,
              criticalCount: s.critical_count || 0,
              highCount: s.high_count || 0,
              mediumCount: s.medium_count || 0,
              lowCount: s.low_count || 0,
              safeCount: s.safe_count || 0,
              scanDuration: s.scan_duration || 0,
              isQuantumSafe: s.is_quantum_safe || false,
              timestamp: s.created_at,
            }))

            // Aggregate findings from recent sessions
            const totalFindings = recentWebScans.reduce((sum, s) => sum + s.findingsCount, 0)
            const criticalFindings = recentWebScans.reduce((sum, s) => sum + s.criticalCount, 0)
            const highFindings = recentWebScans.reduce((sum, s) => sum + s.highCount, 0)
            const avgRiskScore = recentWebScans.length > 0
              ? Math.round(recentWebScans.reduce((sum, s) => sum + s.riskScore, 0) / recentWebScans.length)
              : 0

            controller.enqueue(encoder.encode(
              `event: metrics-update\ndata: ${JSON.stringify({
                type: 'full',
                timestamp: new Date().toISOString(),
                counts: {
                  webScans: currentWebScanCount,
                  scans: currentScanCount,
                  keys: currentKeyCount,
                  vaultFiles: currentVaultFileCount,
                },
                webScanner: {
                  totalScans: currentWebScanCount,
                  totalFindings,
                  criticalFindings,
                  highFindings,
                  avgRiskScore,
                  quantumSafe: recentWebScans.filter(s => s.isQuantumSafe).length,
                  quantumVulnerable: recentWebScans.filter(s => !s.isQuantumSafe).length,
                  recentScans: recentWebScans,
                },
              })}\n\n`
            ))

            // Emit a scan-complete event when web scan count increases
            if (lastWebScanCount !== -1 && currentWebScanCount > lastWebScanCount && recentWebScans.length > 0) {
              const latestScan = recentWebScans[0]
              controller.enqueue(encoder.encode(
                `event: scan-complete\ndata: ${JSON.stringify({
                  target: latestScan.target,
                  targetType: latestScan.targetType,
                  riskScore: latestScan.riskScore,
                  findingsCount: latestScan.findingsCount,
                  isQuantumSafe: latestScan.isQuantumSafe,
                  timestamp: latestScan.timestamp,
                })}\n\n`
              ))
            }

            // Emit key-update event when key counts change
            if (lastKeyCount !== -1 && (currentKeyCount !== lastKeyCount || currentActiveKeyCount !== lastActiveKeyCount || currentRevokedKeyCount !== lastRevokedKeyCount)) {
              const recentKeyData = (recentKeys.data || []).map(k => ({
                id: k.id,
                algorithm: k.algorithm,
                fingerprint: k.fingerprint,
                status: k.status || 'active',
                qualityScore: k.quality_score,
                bitLength: k.bit_length,
                createdAt: k.created_at,
                revokedAt: k.revoked_at,
                expiresAt: k.expires_at,
              }))

              controller.enqueue(encoder.encode(
                `event: key-update\ndata: ${JSON.stringify({
                  totalKeys: currentKeyCount,
                  activeKeys: currentActiveKeyCount,
                  revokedKeys: currentRevokedKeyCount,
                  recentKeys: recentKeyData,
                  timestamp: new Date().toISOString(),
                })}\n\n`
              ))
            }

            lastWebScanCount = currentWebScanCount
            lastScanCount = currentScanCount
            lastKeyCount = currentKeyCount
            lastVaultFileCount = currentVaultFileCount
            lastActiveKeyCount = currentActiveKeyCount
            lastRevokedKeyCount = currentRevokedKeyCount
          }
        } catch {
          // Silently handle poll errors — SSE connection stays open
        }
      }, 8000)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        clearInterval(pollInterval)
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
