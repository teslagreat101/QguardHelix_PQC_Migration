import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { emitShareLinkEvent } from '@/lib/vault/share-events'

/**
 * Public endpoint for fetching shared file data.
 * NO authentication required — access controlled by link ID + expiration + download limits.
 * The decryption key is NEVER sent to this endpoint (it's in the URL fragment).
 *
 * Security: Password-protected links are auto-destroyed after 3 failed attempts.
 * All encrypted payload, IV, and key material is wiped — the sender must re-share.
 *
 * Rate limiting: IP-based throttle on password attempts (max 10 requests/minute per IP).
 */

// ─── In-memory IP rate limiter (per-instance) ───────────────
// For production, replace with Redis or database-backed rate limiting.

const ipAttemptMap = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000  // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10   // max 10 password attempts per minute per IP

function isIpRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = ipAttemptMap.get(ip)

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipAttemptMap.set(ip, { count: 1, windowStart: now })
    return false
  }

  entry.count++
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return true
  }
  return false
}

// Periodically clean up stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of ipAttemptMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      ipAttemptMap.delete(ip)
    }
  }
}, 300_000)

// ─── Helper: set security headers ───────────────────────────

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  return response
}

// ─── POST: Fetch encrypted shared file (public) ────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { linkId, passwordHash } = body

    if (!linkId) {
      return withSecurityHeaders(NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'Link ID required' } },
        { status: 400 }
      ))
    }

    // Extract client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    // Fetch link data using service-role client (bypasses RLS directly).
    // This avoids PostgREST RPC schema cache issues entirely.
    const db = supabaseAdmin || supabase
    if (!db) {
      return withSecurityHeaders(NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service unavailable' } },
        { status: 503 }
      ))
    }

    const { data: linkData, error: queryError } = await db
      .from('vault_shared_links')
      .select('id, owner_id, encrypted_payload, iv, integrity_hash, original_filename, original_size, mime_type, expires_at, max_downloads, download_count, is_revoked, is_password_protected, password_salt, password_hash, failed_password_attempts, is_destroyed, destroyed_reason')
      .eq('id', linkId)
      .single()

    if (queryError || !linkData) {
      const isDev = process.env.NODE_ENV === 'development'
      const detail = queryError?.code + ': ' + queryError?.message
      console.error('[share/public] Query failed — linkId:', linkId, '| usingAdmin:', !!supabaseAdmin, '| error:', detail)
      return withSecurityHeaders(NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Shared link not found or has expired', ...(isDev && { _debug: detail, _linkId: linkId, _usingAdmin: !!supabaseAdmin }) } },
        { status: 404 }
      ))
    }

    // ── Check destroyed (auto-destroyed after failed password attempts) ──
    if (linkData.is_destroyed) {
      return withSecurityHeaders(NextResponse.json(
        { error: {
          code: 'DESTROYED',
          message: 'This shared link has been permanently destroyed due to too many failed password attempts. The sender must share the file again.',
        } },
        { status: 410 }
      ))
    }

    // ── Check revoked ──
    if (linkData.is_revoked) {
      return withSecurityHeaders(NextResponse.json(
        { error: { code: 'REVOKED', message: 'This shared link has been revoked' } },
        { status: 410 }
      ))
    }

    // ── Check expiration ──
    if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
      return withSecurityHeaders(NextResponse.json(
        { error: { code: 'EXPIRED', message: 'This shared link has expired' } },
        { status: 410 }
      ))
    }

    // ── Check download limit ──
    if (linkData.max_downloads !== null && linkData.download_count >= linkData.max_downloads) {
      return withSecurityHeaders(NextResponse.json(
        { error: { code: 'LIMIT_REACHED', message: 'Download limit reached for this link' } },
        { status: 410 }
      ))
    }

    // ── Password verification with auto-destroy ──
    if (linkData.is_password_protected) {
      // If no password provided, return metadata + remaining attempts info
      if (!passwordHash) {
        const remaining = Math.max(0, 3 - (linkData.failed_password_attempts || 0))
        return withSecurityHeaders(NextResponse.json({
          data: {
            requiresPassword: true,
            originalFilename: linkData.original_filename,
            originalSize: linkData.original_size,
            mimeType: linkData.mime_type,
            passwordSalt: linkData.password_salt,
            remainingAttempts: remaining,
          }
        }))
      }

      // IP-based rate limit on password attempts
      if (isIpRateLimited(ip)) {
        return withSecurityHeaders(NextResponse.json(
          { error: {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please wait before trying again.',
          } },
          { status: 429 }
        ))
      }

      // Check password — wrong password triggers atomic increment + possible auto-destroy
      if (passwordHash !== linkData.password_hash) {
        // Record failed attempt via DB function (atomic increment + auto-destroy at 3)
        const { data: attemptResult } = await db.rpc('record_failed_password_attempt', {
          p_link_id: linkId,
          p_ip_address: ip !== 'unknown' ? ip : null,
          p_user_agent: userAgent || null,
        })

        const result = attemptResult as { attempts?: number; remaining?: number; is_destroyed?: boolean } | null

        if (result?.is_destroyed) {
          // Notify owner in real-time via SSE
          emitShareLinkEvent({
            type: 'link_destroyed',
            linkId,
            ownerId: linkData.owner_id,
            fileName: linkData.original_filename,
            attemptsUsed: 3,
            remainingAttempts: 0,
            ip,
            timestamp: new Date().toISOString(),
          })

          return withSecurityHeaders(NextResponse.json(
            { error: {
              code: 'DESTROYED',
              message: 'This shared link has been permanently destroyed due to too many failed password attempts. All encrypted data has been wiped. The sender must share the file again.',
              attemptsUsed: 3,
              remainingAttempts: 0,
            } },
            { status: 410 }
          ))
        }

        const remaining = result?.remaining ?? 0
        const attemptsUsed = result?.attempts ?? 0

        // Notify owner of failed attempt via SSE
        emitShareLinkEvent({
          type: 'failed_attempt',
          linkId,
          ownerId: linkData.owner_id,
          fileName: linkData.original_filename,
          attemptsUsed,
          remainingAttempts: remaining,
          ip,
          timestamp: new Date().toISOString(),
        })

        return withSecurityHeaders(NextResponse.json(
          { error: {
            code: 'WRONG_PASSWORD',
            message: remaining > 0
              ? `Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before this link is permanently destroyed.`
              : 'Incorrect password.',
            attemptsUsed,
            remainingAttempts: remaining,
          } },
          { status: 403 }
        ))
      }
    }

    // ── Password correct (or no password needed) — serve the encrypted payload ──

    // Log access and increment download count
    await db.rpc('record_share_access', {
      p_link_id: linkId,
      p_ip_address: ip !== 'unknown' ? ip : null,
      p_user_agent: userAgent || null,
    })

    // Return encrypted payload (decryption key is NOT here — it's in the URL fragment)
    return withSecurityHeaders(NextResponse.json({
      data: {
        encryptedPayload: linkData.encrypted_payload,
        iv: linkData.iv,
        integrityHash: linkData.integrity_hash,
        originalFilename: linkData.original_filename,
        originalSize: linkData.original_size,
        mimeType: linkData.mime_type,
        isPasswordProtected: linkData.is_password_protected,
        passwordSalt: linkData.password_salt,
      }
    }))
  } catch (err) {
    console.error('Public share fetch error:', err)
    return withSecurityHeaders(NextResponse.json(
      { error: { code: 'SHARE_ERROR', message: 'Failed to fetch shared file' } },
      { status: 500 }
    ))
  }
}
