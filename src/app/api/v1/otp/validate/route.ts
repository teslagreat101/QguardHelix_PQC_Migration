import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'

async function resolveAuth(request: NextRequest) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) return { userId: null, authClient: null }
  const authClient = createAuthClient(token)
  if (!authClient) return { userId: null, authClient: null }
  return { userId: user.id, authClient }
}

// ─── POST /api/v1/otp/validate — Validate OTP via timing-safe comparison ───
export async function POST(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { otp_id, otp_value } = body

    if (!otp_value) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'otp_value required' } },
        { status: 400 }
      )
    }

    // Compute hash of submitted value first (always done for timing safety)
    const submittedHash = createHash('sha256').update(String(otp_value)).digest()
    const submittedHashHex = submittedHash.toString('hex')

    let record: {
      id: string; fingerprint: string; status: string; expires_at: string | null;
      bit_length: number; label: string | null; quality_score: number; entropy_source: string
    } | null = null

    if (otp_id) {
      // Direct lookup by ID
      const { data, error: fetchError } = await authClient
        .from('generated_keys')
        .select('id, fingerprint, status, expires_at, bit_length, label, quality_score, entropy_source')
        .eq('id', otp_id)
        .eq('user_id', userId)
        .eq('algorithm', 'OTP')
        .single()
      if (!fetchError && data) record = data
    } else {
      // Search by hash — find matching active OTP for this user
      const { data } = await authClient
        .from('generated_keys')
        .select('id, fingerprint, status, expires_at, bit_length, label, quality_score, entropy_source')
        .eq('user_id', userId)
        .eq('algorithm', 'OTP')
        .eq('fingerprint', submittedHashHex)
        .order('created_at', { ascending: false })
        .limit(1)
      if (data && data.length > 0) record = data[0]
    }

    if (!record) {
      return NextResponse.json({
        data: {
          valid: false,
          otp_id: otp_id || null,
          reason: 'OTP not found — it may have expired, been used, or never recorded',
          security_level: 'quantum-safe',
          timing_safe: true,
        },
      })
    }

    // Check expiry
    const now = new Date()
    const isExpired = record.expires_at ? new Date(record.expires_at) < now : false
    const isUsed = record.status === 'used'
    const isRevoked = record.status === 'revoked'

    // Timing-safe comparison against stored hash
    const storedHash = Buffer.from(record.fingerprint || '', 'hex')

    let hashMatch = false
    if (storedHash.length > 0 && submittedHash.length === storedHash.length) {
      try {
        hashMatch = timingSafeEqual(submittedHash, storedHash)
      } catch {
        hashMatch = false
      }
    }

    const isValid = hashMatch && !isExpired && !isUsed && !isRevoked

    let labelData: Record<string, unknown> = {}
    try { labelData = JSON.parse(record.label || '{}') } catch { /* skip */ }

    // Mark as used if valid (single-use enforcement)
    if (isValid) {
      await authClient
        .from('generated_keys')
        .update({ status: 'used', revoked_at: now.toISOString() })
        .eq('id', record.id)
        .eq('user_id', userId)
    }

    const reason = !hashMatch
      ? 'OTP value does not match'
      : isExpired
        ? 'OTP has expired'
        : isUsed
          ? 'OTP has already been used'
          : isRevoked
            ? 'OTP has been revoked'
            : 'Valid'

    return NextResponse.json({
      data: {
        valid: isValid,
        otp_id: record.id,
        reason,
        format: labelData.format || 'unknown',
        purpose: labelData.purpose || 'unknown',
        length: record.bit_length,
        entropy_source: record.entropy_source,
        quality_score: record.quality_score,
        expires_at: record.expires_at,
        validated_at: now.toISOString(),
        security_level: 'quantum-safe',
        timing_safe: true,
        marked_used: isValid,
      },
    })
  } catch (err) {
    console.error('OTP validate error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
