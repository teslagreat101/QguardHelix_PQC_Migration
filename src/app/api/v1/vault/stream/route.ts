import { NextRequest } from 'next/server'
import { getServerUserFromToken, getTokenFromHeaderOrQuery } from '@/lib/server-auth'

/**
 * GET /api/v1/vault/stream
 *
 * Server-Sent Events (SSE) endpoint for real-time encryption progress.
 *
 * Query params:
 * - operation: 'encrypt' | 'decrypt'
 * - fileId: optional file ID for tracking
 *
 * Sends progress events during encryption/decryption operations.
 * This simulates the stages — in production, the actual crypto operations
 * would emit events through a shared channel (e.g., Redis pub/sub).
 */
export async function GET(request: NextRequest) {
  const token = getTokenFromHeaderOrQuery(request)
  const user = token ? await getServerUserFromToken(token) : null
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const operation = searchParams.get('operation') || 'encrypt'
  const fileId = searchParams.get('fileId') || 'unknown'

  const encoder = new TextEncoder()

  const stages = operation === 'encrypt'
    ? [
        { stage: 'preparing', percent: 0, message: 'Preparing file for encryption' },
        { stage: 'generating_data_key', percent: 10, message: 'Generating AES-256-GCM data key' },
        { stage: 'encrypting_file', percent: 30, message: 'Encrypting file blocks with AES-256-GCM' },
        { stage: 'encapsulating_key', percent: 60, message: 'Encapsulating data key with ML-KEM-768' },
        { stage: 'signing_metadata', percent: 80, message: 'Signing metadata with ML-DSA-65' },
        { stage: 'uploading', percent: 90, message: 'Uploading encrypted file to vault' },
        { stage: 'complete', percent: 100, message: 'Encryption and upload complete' },
      ]
    : [
        { stage: 'preparing', percent: 0, message: 'Preparing for decryption' },
        { stage: 'encapsulating_key', percent: 20, message: 'Decapsulating data key with ML-KEM-768' },
        { stage: 'generating_data_key', percent: 40, message: 'Recovering AES-256 data key' },
        { stage: 'encrypting_file', percent: 60, message: 'Decrypting file with AES-256-GCM' },
        { stage: 'signing_metadata', percent: 80, message: 'Verifying metadata signature' },
        { stage: 'complete', percent: 100, message: 'Decryption complete' },
      ]

  const stream = new ReadableStream({
    async start(controller) {
      for (const event of stages) {
        const data = JSON.stringify({
          fileId,
          operation,
          ...event,
          timestamp: new Date().toISOString(),
        })

        controller.enqueue(encoder.encode(`event: progress\ndata: ${data}\n\n`))

        // Small delay between stages
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ fileId, operation })}\n\n`))
      controller.close()
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
