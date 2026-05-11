import { NextRequest } from 'next/server'
import { isQRNGServiceHealthy, fetchQRNGStats, fetchQRNGEntropy } from '@/lib/quantum/qrng-client'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── GET /api/v1/qrng/stream — SSE telemetry stream ────────
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      // Send a heartbeat immediately so the connection is established without delay
      send('status', { online: false, timestamp: new Date().toISOString(), checking: true })

      // Then check QRNG health in background
      try {
        const healthy = await isQRNGServiceHealthy()
        send('status', { online: healthy, timestamp: new Date().toISOString() })

        if (healthy) {
          const stats = await fetchQRNGStats()
          send('stats', { ...stats, status: 'online' })

          try {
            const entropy = await fetchQRNGEntropy(256)
            send('telemetry', {
              quality_score: entropy.quality_score,
              nist_frequency_test: entropy.nist_frequency_test,
              entropy_bits: entropy.entropy_bits,
              generation_time_ms: entropy.generation_time_ms,
              source: entropy.source,
              backend: entropy.backend,
              timestamp: entropy.timestamp,
            })
          } catch { /* entropy fetch optional */ }
        }
      } catch {
        send('status', { online: false, timestamp: new Date().toISOString() })
      }

      // Poll every 10 seconds for live telemetry
      const interval = setInterval(async () => {
        if (closed || request.signal.aborted) {
          clearInterval(interval)
          if (!closed) {
            closed = true
            try { controller.close() } catch { /* already closed */ }
          }
          return
        }

        try {
          const healthy = await isQRNGServiceHealthy()
          send('status', { online: healthy, timestamp: new Date().toISOString() })

          if (healthy) {
            const entropy = await fetchQRNGEntropy(256)
            send('telemetry', {
              quality_score: entropy.quality_score,
              nist_frequency_test: entropy.nist_frequency_test,
              entropy_bits: entropy.entropy_bits,
              generation_time_ms: entropy.generation_time_ms,
              source: entropy.source,
              backend: entropy.backend,
              timestamp: entropy.timestamp,
            })
          }
        } catch {
          send('error', { message: 'Telemetry fetch failed', timestamp: new Date().toISOString() })
        }
      }, 10000)

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        closed = true
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
