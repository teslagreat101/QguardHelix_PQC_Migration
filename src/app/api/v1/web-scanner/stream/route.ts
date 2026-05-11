import { NextRequest } from 'next/server'
import { executeWebScan } from '@/lib/web-scanner/scan-orchestrator'
import type { WebScanTargetType, SSEEvent } from '@/lib/web-scanner/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120 // 120 seconds for enterprise scans

// ─── Scan Concurrency Manager ────────────────────────────────────────────────

const MAX_CONCURRENT_SCANS = 10
const activeScanIds = new Set<string>()
const scanStartTimes = new Map<string, number>()

function canStartScan(): boolean {
  // Clean up stale scans (older than 3 minutes)
  const now = Date.now()
  for (const [id, startTime] of scanStartTimes.entries()) {
    if (now - startTime > 180_000) {
      activeScanIds.delete(id)
      scanStartTimes.delete(id)
    }
  }
  return activeScanIds.size < MAX_CONCURRENT_SCANS
}

function registerScan(scanId: string): void {
  activeScanIds.add(scanId)
  scanStartTimes.set(scanId, Date.now())
}

function deregisterScan(scanId: string): void {
  activeScanIds.delete(scanId)
  scanStartTimes.delete(scanId)
}

// ─── Input Sanitization ──────────────────────────────────────────────────────

const TARGET_MAX_LENGTH = 2048
const DANGEROUS_PATTERNS = [
  /[<>{}|\\^~`]/,         // Shell/HTML injection chars
  /\.\.\//,               // Directory traversal
  /javascript:/i,          // Script injection
  /data:/i,               // Data URI injection
]

function sanitizeTarget(target: string): string {
  return target.trim().slice(0, TARGET_MAX_LENGTH)
}

function isTargetSafe(target: string): boolean {
  if (target.length === 0 || target.length > TARGET_MAX_LENGTH) return false
  return !DANGEROUS_PATTERNS.some(p => p.test(target))
}

/**
 * SSE streaming endpoint for QGuard Web Scanner real-time telemetry.
 *
 * Usage: GET /api/v1/web-scanner/stream?target=https://example.com&type=url
 *
 * Streams scan phase events as the web scanner analyzes the target
 * for quantum-vulnerable cryptography using real TLS handshakes,
 * certificate parsing, cipher suite analysis, and code scanning.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawTarget = searchParams.get('target') || ''
  const targetType = (searchParams.get('type') || 'url') as WebScanTargetType
  const target = sanitizeTarget(rawTarget)

  if (!target) {
    return Response.json(
      { error: 'target parameter is required' },
      { status: 400 }
    )
  }

  // Validate target safety
  if (!isTargetSafe(target)) {
    return Response.json(
      { error: 'Invalid target — contains disallowed characters' },
      { status: 400 }
    )
  }

  // Validate target type
  const validTypes: WebScanTargetType[] = ['url', 'domain', 'ip', 'github']
  if (!validTypes.includes(targetType)) {
    return Response.json(
      { error: 'Invalid target type. Must be: url, domain, ip, or github' },
      { status: 400 }
    )
  }

  // Check concurrency limits
  if (!canStartScan()) {
    return Response.json(
      { error: 'Maximum concurrent scans reached. Please wait and try again.' },
      { status: 429 }
    )
  }

  const scanId = crypto.randomUUID()
  registerScan(scanId)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let clientDisconnected = false

      function send(data: Record<string, unknown>) {
        if (clientDisconnected) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          clientDisconnected = true
        }
      }

      try {
        // Send initial heartbeat
        send({
          type: 'heartbeat',
          scanId,
          timestamp: new Date().toISOString(),
          activeScanCount: activeScanIds.size,
        })

        await executeWebScan(target, targetType, (event: SSEEvent) => {
          send(event as unknown as Record<string, unknown>)
        })
      } catch (err) {
        send({
          type: 'error',
          scanId,
          message: String(err instanceof Error ? err.message : err),
          timestamp: new Date().toISOString(),
        })
      } finally {
        deregisterScan(scanId)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Scan-Id': scanId,
    },
  })
}
