import { NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getTokenFromHeaderOrQuery, getServerUserFromToken } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// EventSource doesn't support custom headers — accept token via query param or Authorization header
async function resolveAuth(request: NextRequest) {
  const raw = getTokenFromHeaderOrQuery(request)
  if (!raw) return { userId: null, authClient: null }
  const user = await getServerUserFromToken(raw)
  if (!user) return { userId: null, authClient: null }
  const authClient = createAuthClient(raw)
  if (!authClient) return { userId: null, authClient: null }
  return { userId: user.id, authClient }
}

function mapKey(k: Record<string, unknown>) {
  return {
    id: k.id,
    algorithm: k.algorithm,
    bitLength: k.bit_length,
    entropySource: k.entropy_source,
    qualityScore: k.quality_score,
    fingerprint: k.fingerprint,
    status: k.status || 'active',
    createdAt: k.created_at,
    expiresAt: k.expires_at,
    revokedAt: k.revoked_at,
    rotatedFrom: k.rotated_from,
    label: k.label,
  }
}

/**
 * GET /api/v1/keys/stream
 * SSE stream for real-time key history.
 * - Emits `snapshot` with initial key list on connect
 * - Emits `new_keys` when new keys are detected (polls every 15s)
 * - Emits `heartbeat` every 15s to keep connection alive
 */
export async function GET(request: NextRequest) {
  const { userId, authClient } = await resolveAuth(request)

  if (!userId || !authClient) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        )
      }

      // ── Initial snapshot ─────────────────────────────────
      try {
        const { data: keys, count } = await (authClient as ReturnType<typeof createAuthClient>)!
          .from('generated_keys')
          .select('*', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(100)

        // Also fetch today's count
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const { count: todayCount } = await (authClient as ReturnType<typeof createAuthClient>)!
          .from('generated_keys')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', today.toISOString())

        send('snapshot', {
          keys: (keys || []).map(k => mapKey(k as Record<string, unknown>)),
          total: count || 0,
          keysToday: todayCount || 0,
        })
      } catch {
        send('snapshot', { keys: [], total: 0, keysToday: 0 })
      }

      // ── Poll for new/updated keys every 15s ─────────────
      let lastCheck = new Date().toISOString()

      const interval = setInterval(async () => {
        if (request.signal.aborted) {
          clearInterval(interval)
          return
        }

        try {
          // Check for new or status-changed keys since last check
          const { data: newKeys } = await (authClient as ReturnType<typeof createAuthClient>)!
            .from('generated_keys')
            .select('*')
            .eq('user_id', userId)
            .or(`created_at.gt.${lastCheck},revoked_at.gt.${lastCheck}`)
            .order('created_at', { ascending: false })

          if (newKeys && newKeys.length > 0) {
            send('new_keys', {
              keys: newKeys.map(k => mapKey(k as Record<string, unknown>)),
            })
          }

          lastCheck = new Date().toISOString()
          send('heartbeat', { ts: Date.now() })
        } catch {
          // Non-critical — keep connection alive
          send('heartbeat', { ts: Date.now() })
        }
      }, 15000)

      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
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
