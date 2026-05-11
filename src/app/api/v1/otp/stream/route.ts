import { NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getTokenFromHeaderOrQuery, getServerUserFromToken } from '@/lib/server-auth'

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ─── GET /api/v1/otp/stream — SSE real-time OTP history ────────
// EventSource doesn't support custom headers — accept token via ?token= param
export async function GET(request: NextRequest) {
  const rawToken = getTokenFromHeaderOrQuery(request) || ''

  const user = rawToken ? await getServerUserFromToken(rawToken) : null
  const authClient = rawToken ? createAuthClient(rawToken) : null
  const userId = user?.id ?? null

  if (!userId || !authClient) {
    return new Response(
      sseEvent('error', { code: 'UNAUTHORIZED', message: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  const encoder = new TextEncoder()

  async function fetchLatestOTPs(limit = 20) {
    const now = new Date().toISOString()
    const { data, count } = await authClient!
      .from('generated_keys')
      .select('id, bit_length, entropy_source, quality_score, status, expires_at, label, created_at', { count: 'exact' })
      .eq('user_id', userId!)
      .eq('algorithm', 'OTP')
      .order('created_at', { ascending: false })
      .limit(limit)

    const records = (data || []).map(r => {
      let labelData: Record<string, unknown> = {}
      try { labelData = JSON.parse(r.label || '{}') } catch { /* skip */ }
      const isExpired = r.status === 'active' && r.expires_at && r.expires_at < now
      return {
        id: r.id,
        format: labelData.format || 'numeric',
        purpose: labelData.purpose || 'login',
        length: r.bit_length,
        entropy_source: r.entropy_source,
        quality_score: r.quality_score,
        otp_preview: labelData.otp_preview || '••••••',
        expires_at: r.expires_at,
        created_at: r.created_at,
        status: isExpired ? 'expired' : (r.status || 'active'),
      }
    })

    return { records, total: count || 0 }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => {
        try { controller.enqueue(encoder.encode(chunk)) } catch { /* closed */ }
      }

      // Initial snapshot
      try {
        const { records, total } = await fetchLatestOTPs(50)
        enqueue(sseEvent('snapshot', { records, total }))
      } catch (err) {
        enqueue(sseEvent('error', { message: 'Failed to load OTP history' }))
      }

      let lastCheck = new Date().toISOString()

      // Poll for new OTPs every 10 seconds
      const pollInterval = setInterval(async () => {
        try {
          const { data, count } = await authClient!
            .from('generated_keys')
            .select('id, bit_length, entropy_source, quality_score, status, expires_at, label, created_at', { count: 'exact' })
            .eq('user_id', userId!)
            .eq('algorithm', 'OTP')
            .gt('created_at', lastCheck)
            .order('created_at', { ascending: false })

          if (data && data.length > 0) {
            const now = new Date().toISOString()
            const newRecords = data.map(r => {
              let labelData: Record<string, unknown> = {}
              try { labelData = JSON.parse(r.label || '{}') } catch { /* skip */ }
              return {
                id: r.id,
                format: labelData.format || 'numeric',
                purpose: labelData.purpose || 'login',
                length: r.bit_length,
                entropy_source: r.entropy_source,
                quality_score: r.quality_score,
                otp_preview: labelData.otp_preview || '••••••',
                expires_at: r.expires_at,
                created_at: r.created_at,
                status: r.status || 'active',
              }
            })
            lastCheck = now
            enqueue(sseEvent('new_otps', { records: newRecords, total: count || 0 }))
          }
        } catch { /* non-fatal */ }
      }, 10000)

      // Heartbeat every 25 seconds
      const heartbeatInterval = setInterval(() => {
        enqueue(sseEvent('heartbeat', { ts: Date.now() }))
      }, 25000)

      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval)
        clearInterval(heartbeatInterval)
        try { controller.close() } catch { /* already closed */ }
      })
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
