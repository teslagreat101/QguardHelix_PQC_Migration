import { NextRequest } from 'next/server'
import { getServerUserFromToken, getTokenFromHeaderOrQuery } from '@/lib/server-auth'
import { subscribeOwnerEvents } from '@/lib/vault/share-events'

/**
 * GET /api/v1/vault/share/events
 *
 * SSE endpoint for real-time share link security notifications.
 * Authenticated owners receive events when:
 * - Someone fails a password attempt on their shared link
 * - A shared link is auto-destroyed after 3 failed attempts
 *
 * Auth: Bearer token via header or ?token= query param (EventSource limitation).
 */

export async function GET(request: NextRequest) {
  const token = getTokenFromHeaderOrQuery(request)
  const user = token ? await getServerUserFromToken(token) : null
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId: user.id, timestamp: new Date().toISOString() })}\n\n`))

      // Heartbeat to keep connection alive (every 30s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)

      // Subscribe to events for this owner
      const unsubscribe = subscribeOwnerEvents(user.id, (event) => {
        try {
          const eventType = event.type === 'link_destroyed' ? 'link_destroyed' : 'failed_attempt'
          controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Stream closed
          clearInterval(heartbeat)
          unsubscribe()
        }
      })

      // Cleanup on abort (client disconnects)
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsubscribe()
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
