import { NextRequest } from 'next/server'
import { getTokenFromHeaderOrQuery, getServerUserFromToken } from '@/lib/server-auth'
import { isAdminEmail, getServiceClient } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Authenticate via query param (SSE can't use headers)
  const token = getTokenFromHeaderOrQuery(request)
  if (!token) {
    return new Response('Authentication required', { status: 401 })
  }

  const user = await getServerUserFromToken(token)

  if (!user || !isAdminEmail(user.email)) {
    return new Response('Forbidden', { status: 403 })
  }

  const serviceClient = getServiceClient()
  if (!serviceClient) {
    return new Response('Service not configured', { status: 500 })
  }

  const encoder = new TextEncoder()
  let intervalId: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Stream closed
        }
      }

      send('connected', { timestamp: new Date().toISOString() })

      const fetchStats = async () => {
        try {
          const now = new Date()
          const last5min = new Date(now.getTime() - 300000).toISOString()

          const [
            { count: totalUsers },
            { count: premiumUsers },
            { data: recentScans },
            { data: recentAlerts },
            { data: recentSignups },
          ] = await Promise.all([
            serviceClient.from('profiles').select('*', { count: 'exact', head: true }),
            serviceClient.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'premium'),
            serviceClient
              .from('scan_sessions')
              .select('id, user_id, status, created_at')
              .gte('created_at', last5min)
              .order('created_at', { ascending: false })
              .limit(5),
            serviceClient
              .from('monitoring_alerts')
              .select('id, user_id, type, title, severity, created_at')
              .gte('created_at', last5min)
              .order('created_at', { ascending: false })
              .limit(5),
            serviceClient
              .from('profiles')
              .select('id, email, tier, created_at')
              .gte('created_at', last5min)
              .order('created_at', { ascending: false })
              .limit(5),
          ])

          send('stats-update', {
            totalUsers: totalUsers || 0,
            premiumUsers: premiumUsers || 0,
            recentScans: recentScans || [],
            recentAlerts: recentAlerts || [],
            recentSignups: recentSignups || [],
            timestamp: now.toISOString(),
          })
        } catch {
          // Non-fatal: skip this update
        }
      }

      fetchStats()
      intervalId = setInterval(fetchStats, 10000)

      const heartbeatId = setInterval(() => {
        send('heartbeat', { timestamp: new Date().toISOString() })
      }, 30000)

      request.signal.addEventListener('abort', () => {
        if (intervalId) clearInterval(intervalId)
        clearInterval(heartbeatId)
        try { controller.close() } catch { /* already closed */ }
      })
    },
    cancel() {
      if (intervalId) clearInterval(intervalId)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
