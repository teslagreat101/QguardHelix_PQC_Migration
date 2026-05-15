import express from 'express'
import dashboardRoutes from './dashboard'
import profileRoutes from './profile'
import scannerRoutes from './scanner'
import agentScannerRoutes, { startAgentScannerScheduler } from './agent-scanner'
import serviceRecordRoutes from './service-records'
import { getServerUser, getServiceClient } from '@/lib/supabase-server'
import { emitShareLinkEvent, subscribeOwnerEvents } from '@/lib/vault/share-events'

const shareIpAttempts = new Map<string, { count: number; windowStart: number }>()
const SHARE_RATE_LIMIT_WINDOW_MS = 60_000
const SHARE_RATE_LIMIT_MAX_REQUESTS = 10
const SHARE_MAX_PASSWORD_ATTEMPTS = 3

function isShareIpRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = shareIpAttempts.get(ip)

  if (!entry || now - entry.windowStart > SHARE_RATE_LIMIT_WINDOW_MS) {
    shareIpAttempts.set(ip, { count: 1, windowStart: now })
    return false
  }

  entry.count += 1
  return entry.count > SHARE_RATE_LIMIT_MAX_REQUESTS
}

function readClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim()
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  return req.ip || req.socket.remoteAddress || 'unknown'
}

function byteaToText(value: unknown): string {
  if (!value) return ''
  const normalizeBytes = (bytes: Uint8Array | Buffer): string => {
    const buffer = Buffer.from(bytes)
    const text = buffer.toString('utf8').trim()
    return isBase64Payload(text) ? text : buffer.toString('base64')
  }

  if (typeof value === 'string') {
    if (value.startsWith('\\x')) {
      return normalizeBytes(Buffer.from(value.slice(2), 'hex'))
    }
    const trimmed = value.trim()
    if (isBase64Payload(trimmed)) return trimmed
    if (/^[0-9a-f]+$/i.test(trimmed) && trimmed.length % 2 === 0) {
      return Buffer.from(trimmed, 'hex').toString('base64')
    }
    return Buffer.from(trimmed, 'utf8').toString('base64')
  }
  if (value instanceof Uint8Array) {
    return normalizeBytes(value)
  }
  if (Array.isArray(value)) {
    return normalizeBytes(new Uint8Array(value))
  }
  if (typeof value === 'object' && value !== null) {
    const maybeBuffer = value as { type?: unknown; data?: unknown }
    if (maybeBuffer.type === 'Buffer' && Array.isArray(maybeBuffer.data)) {
      return normalizeBytes(new Uint8Array(maybeBuffer.data as number[]))
    }
  }
  return ''
}

function isBase64Payload(value: string): boolean {
  if (!value || value.length % 4 !== 0) return false
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false
  try {
    Buffer.from(value, 'base64')
    return true
  } catch {
    return false
  }
}

function readShareMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {}
    } catch {
      return {}
    }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function metadataText(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key]
  return typeof value === 'string' ? value : ''
}

function allowedOrigin(req: express.Request): string | null {
  const origin = req.headers.origin
  if (!origin) return null

  const host = req.headers.host
  try {
    const originUrl = new URL(origin)
    if (host && originUrl.host === host) return origin

    const configured = [
      process.env.APP_ORIGIN,
      process.env.VITE_APP_ORIGIN,
      process.env.PUBLIC_APP_ORIGIN,
      process.env.ALLOWED_ORIGINS,
    ]
      .filter(Boolean)
      .flatMap((value) => String(value).split(','))
      .map((value) => value.trim())
      .filter(Boolean)

    if (configured.includes(origin)) return origin
  } catch {
    return null
  }

  return null
}

function setNoStoreShareHeaders(res: express.Response) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Referrer-Policy', 'no-referrer')
}

/**
 * QGuard Helix — Express API Server
 * Mounted under /api/v1 in development via Vite configureServer.
 * In production, this can be run as a standalone server or mounted under an API gateway.
 */
export function createApiServer() {
  const app = express()

  app.use(express.json({ limit: '8mb' }))

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=()')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('X-DNS-Prefetch-Control', 'off')
    if (process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    next()
  })

  // Same-origin CORS by default. Cross-origin API access can be enabled via
  // APP_ORIGIN / VITE_APP_ORIGIN / PUBLIC_APP_ORIGIN / ALLOWED_ORIGINS.
  app.use((req, res, next) => {
    const origin = req.headers.origin
    const originAllowed = allowedOrigin(req)
    if (originAllowed) {
      res.setHeader('Access-Control-Allow-Origin', originAllowed)
      res.setHeader('Vary', 'Origin')
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-QGuard-Device-Id, X-QGuard-Refresh-Token, X-QGuard-Agent-Id, X-QGuard-Agent-Token')
    if (req.method === 'OPTIONS') {
      if (origin && !originAllowed) {
        res.sendStatus(403)
        return
      }
      res.sendStatus(204)
      return
    }
    next()
  })

  // Health check
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        services: {
          scanner: 'operational',
          pqcEngine: 'operational',
          qrng: 'operational',
          vault: 'operational',
          monitoring: 'operational',
        },
        pqcAlgorithms: ['ML-KEM (Kyber)', 'ML-DSA (Dilithium)', 'SPHINCS+', 'HYBRID'],
      },
    })
  })

  app.post('/api/v1/vault/share/public', async (req, res) => {
    setNoStoreShareHeaders(res)

    const { linkId, passwordHash } = req.body || {}

    if (!linkId || typeof linkId !== 'string') {
      res.status(400).json({ error: { code: 'MISSING_ID', message: 'Link ID required' } })
      return
    }

    const db = getServiceClient()
    if (!db) {
      res.status(503).json({ error: { code: 'CONFIG_ERROR', message: 'Share service is unavailable' } })
      return
    }

    const ip = readClientIp(req)
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null

    const { data: linkData, error: queryError } = await db
      .from('vault_shared_links')
      .select('id, user_id, encrypted_file_data, encryption_metadata, original_filename, original_size, mime_type, expires_at, max_downloads, download_count, is_revoked, is_password_protected, password_hash, failed_password_attempts, is_destroyed')
      .eq('id', linkId)
      .single()

    if (queryError || !linkData) {
      const detail = queryError ? `${queryError.code}: ${queryError.message}` : 'no row returned'
      console.error('[share/public] Query failed - linkId:', linkId, '| error:', detail)
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shared link not found or has expired' } })
      return
    }

    const metadata = readShareMetadata(linkData.encryption_metadata)
    const remainingAttempts = Math.max(0, SHARE_MAX_PASSWORD_ATTEMPTS - (linkData.failed_password_attempts || 0))

    if (linkData.is_destroyed) {
      res.status(410).json({
        error: {
          code: 'DESTROYED',
          message: 'This shared link has been permanently destroyed due to too many failed password attempts. The sender must share the file again.',
        },
      })
      return
    }

    if (linkData.is_revoked) {
      res.status(410).json({ error: { code: 'REVOKED', message: 'This shared link has been revoked' } })
      return
    }

    if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
      res.status(410).json({ error: { code: 'EXPIRED', message: 'This shared link has expired' } })
      return
    }

    if (linkData.max_downloads !== null && linkData.download_count >= linkData.max_downloads) {
      res.status(410).json({ error: { code: 'LIMIT_REACHED', message: 'Download limit reached for this link' } })
      return
    }

    if (linkData.is_password_protected) {
      const passwordSalt = metadataText(metadata, 'passwordSalt')
      if (!passwordHash) {
        res.json({
          data: {
            requiresPassword: true,
            originalFilename: linkData.original_filename,
            originalSize: Number(linkData.original_size || 0),
            mimeType: linkData.mime_type || 'application/octet-stream',
            passwordSalt,
            remainingAttempts,
          },
        })
        return
      }

      if (isShareIpRateLimited(ip)) {
        res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait before trying again.' } })
        return
      }

      if (passwordHash !== linkData.password_hash) {
        const attemptsUsed = (linkData.failed_password_attempts || 0) + 1
        const nextRemaining = Math.max(0, SHARE_MAX_PASSWORD_ATTEMPTS - attemptsUsed)
        const shouldDestroy = attemptsUsed >= SHARE_MAX_PASSWORD_ATTEMPTS

        await db
          .from('vault_shared_links')
          .update({
            failed_password_attempts: attemptsUsed,
            is_destroyed: shouldDestroy,
            encrypted_file_data: shouldDestroy ? null : linkData.encrypted_file_data,
            encryption_metadata: shouldDestroy ? null : linkData.encryption_metadata,
            password_hash: shouldDestroy ? null : linkData.password_hash,
          })
          .eq('id', linkId)

        emitShareLinkEvent({
          type: shouldDestroy ? 'link_destroyed' : 'failed_attempt',
          linkId,
          ownerId: linkData.user_id,
          fileName: linkData.original_filename,
          attemptsUsed,
          remainingAttempts: nextRemaining,
          ip,
          timestamp: new Date().toISOString(),
        })

        if (shouldDestroy) {
          res.status(410).json({
            error: {
              code: 'DESTROYED',
              message: 'This shared link has been permanently destroyed due to too many failed password attempts. All encrypted data has been wiped. The sender must share the file again.',
              attemptsUsed,
              remainingAttempts: 0,
            },
          })
          return
        }

        res.status(403).json({
          error: {
            code: 'WRONG_PASSWORD',
            message: `Incorrect password. ${nextRemaining} attempt${nextRemaining === 1 ? '' : 's'} remaining before this link is permanently destroyed.`,
            attemptsUsed,
            remainingAttempts: nextRemaining,
          },
        })
        return
      }
    }

    const metadataPayload = metadataText(metadata, 'encryptedPayload')
    const encryptedPayload = metadataPayload && isBase64Payload(metadataPayload)
      ? metadataPayload
      : byteaToText(linkData.encrypted_file_data)
    const iv = metadataText(metadata, 'iv')
    const integrityHash = metadataText(metadata, 'integrityHash')

    if (!encryptedPayload || !iv || !integrityHash) {
      res.status(410).json({ error: { code: 'PAYLOAD_MISSING', message: 'Shared file payload is unavailable. The sender must create a new share link.' } })
      return
    }

    await db
      .from('vault_shared_links')
      .update({
        download_count: (linkData.download_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', linkId)

    res.json({
      data: {
        encryptedPayload,
        iv,
        integrityHash,
        originalFilename: linkData.original_filename,
        originalSize: Number(linkData.original_size || 0),
        mimeType: linkData.mime_type || 'application/octet-stream',
        isPasswordProtected: !!linkData.is_password_protected,
        passwordSalt: metadataText(metadata, 'passwordSalt'),
      },
    })
  })

  app.get('/api/v1/vault/share/events', async (req, res) => {
    const authHeader = req.headers.authorization
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null
    const token = headerToken || queryToken
    const user = token ? await getServerUser(token) : null

    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })
      return
    }

    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    send('connected', { userId: user.id, timestamp: new Date().toISOString() })

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n')
    }, 30_000)

    const unsubscribe = subscribeOwnerEvents(user.id, (event) => {
      const eventType = event.type === 'link_destroyed' ? 'link_destroyed' : 'failed_attempt'
      send(eventType, {
        ...event,
        fileName: event.fileName || event.filename || 'Shared file',
        ip: event.ip || event.ipAddress || 'unknown',
        attemptsUsed: event.attemptsUsed || 0,
        remainingAttempts: event.remainingAttempts || 0,
      })
    })

    req.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })

  // Dashboard API routes
  app.use('/api/v1/dashboard', dashboardRoutes)
  app.use('/api/v1/profile', profileRoutes)
  app.use('/api/v1/scanner', scannerRoutes)
  app.use('/api/v1/agent-scanner', agentScannerRoutes)
  app.use('/api/v1', serviceRecordRoutes)

  startAgentScannerScheduler()

  // API-only 404 handler. In standalone mode non-API routes fall through to Vite static files.
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      next()
      return
    }
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API endpoint not found' } })
  })

  return app
}

export default createApiServer
