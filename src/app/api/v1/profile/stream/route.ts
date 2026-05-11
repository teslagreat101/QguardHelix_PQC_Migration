import { NextRequest } from 'next/server'
import { getServerUserFromToken, getTokenFromHeaderOrQuery } from '@/lib/server-auth'
import { createAuthClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** Return a self-closing SSE stream that tells the client not to reconnect. */
function sseError(message: string, httpStatus = 200) {
  const encoder = new TextEncoder()
  const body = encoder.encode(
    `event: error\ndata: ${JSON.stringify({ error: message })}\n\nretry: 86400000\n\n`
  )
  return new Response(body, {
    status: httpStatus,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  })
}

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

  const supabase = createAuthClient(token)

  const encoder = new TextEncoder()
  let lastWebScanCount = -1

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'))

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15000)

      const pollInterval = setInterval(async () => {
        try {
          if (!supabase) return

          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

          const [profileResult, quantumScansResult, webScansResult, recentWebScansResult] = await Promise.all([
            supabase
              .from('profiles')
              .select('q_score, keys_generated_today, vault_storage_used, tier, name, updated_at')
              .eq('id', userId)
              .single(),
            supabase
              .from('scan_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .gte('created_at', oneDayAgo),
            supabase
              .from('web_scan_sessions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .gte('created_at', oneDayAgo),
            supabase
              .from('web_scan_sessions')
              .select('id, target, target_type, total_findings, critical_count, high_count, overall_risk_score, is_quantum_safe, created_at')
              .eq('user_id', userId)
              .gte('created_at', new Date(Date.now() - 30000).toISOString())
              .order('created_at', { ascending: false })
              .limit(5),
          ])

          const profile = profileResult.data
          const totalScansUsed = (quantumScansResult.count || 0) + (webScansResult.count || 0)

          if (profile) {
            controller.enqueue(encoder.encode(
              `event: profile-update\ndata: ${JSON.stringify({
                qScore: profile.q_score,
                keysGeneratedToday: profile.keys_generated_today,
                vaultStorageUsed: profile.vault_storage_used,
                tier: profile.tier,
                name: profile.name,
                updatedAt: profile.updated_at,
              })}\n\n`
            ))

            const tierLimits = profile.tier === 'elite'
              ? { keysLimit: 999, vaultStorageLimit: 107374182400, scansLimit: 999 }
              : profile.tier === 'pro'
              ? { keysLimit: 100, vaultStorageLimit: 53687091200, scansLimit: 500 }
              : { keysLimit: 5, vaultStorageLimit: 5368709120, scansLimit: 10 }
            controller.enqueue(encoder.encode(
              `event: usage-update\ndata: ${JSON.stringify({
                keysGenerated: profile.keys_generated_today || 0,
                keysLimit: tierLimits.keysLimit,
                vaultStorageUsed: profile.vault_storage_used || 0,
                vaultStorageLimit: tierLimits.vaultStorageLimit,
                scansUsed: totalScansUsed,
                scansLimit: tierLimits.scansLimit,
              })}\n\n`
            ))
          }

          const currentWebScanCount = webScansResult.count || 0
          if (lastWebScanCount !== -1 && currentWebScanCount > lastWebScanCount) {
            for (const ws of recentWebScansResult.data || []) {
              const criticalCount = ws.critical_count || 0
              const highCount = ws.high_count || 0
              const riskScore = ws.overall_risk_score || 0
              controller.enqueue(encoder.encode(
                `event: activity\ndata: ${JSON.stringify({
                  id: `webscan-${ws.id}`,
                  eventType: 'webscan.completed',
                  description: `Web scan on ${ws.target_type} "${ws.target}" — ${ws.total_findings || 0} findings (risk: ${riskScore}/100)${ws.is_quantum_safe ? ' \u2713 quantum safe' : ' \u26a0 quantum vulnerable'}`,
                  ipAddress: null,
                  userAgent: null,
                  timestamp: ws.created_at,
                  severity: criticalCount > 0 ? 'critical' : (highCount > 0 || riskScore >= 60) ? 'warning' : 'info',
                })}\n\n`
              ))
            }
          }
          lastWebScanCount = currentWebScanCount

          const thirtySecsAgo = new Date(Date.now() - 30000).toISOString()
          const { data: newAlerts } = await supabase
            .from('monitoring_alerts')
            .select('id, type, title, message, severity, created_at')
            .eq('user_id', userId)
            .gte('created_at', thirtySecsAgo)
            .order('created_at', { ascending: false })
            .limit(5)

          if (newAlerts && newAlerts.length > 0) {
            for (const alert of newAlerts) {
              controller.enqueue(encoder.encode(
                `event: activity\ndata: ${JSON.stringify({
                  id: `alert-${alert.id}`,
                  eventType: `alert.${alert.type}`,
                  description: alert.title,
                  ipAddress: null,
                  userAgent: null,
                  timestamp: alert.created_at,
                  severity: alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info',
                })}\n\n`
              ))
            }
          }
        } catch {
          // Silently handle poll errors — SSE connection stays open
        }
      }, 10000)

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
