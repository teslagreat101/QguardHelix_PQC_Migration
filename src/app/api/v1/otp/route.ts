import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { generateQRNGOtp } from '@/lib/quantum/qrng-client'
import { generateQuantumEntropy, calculateEntropyQuality } from '@/lib/quantum/qrng'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'

/** Resolve authenticated user from request (local JWT decode — no network call) */
async function resolveAuth(request: NextRequest) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) return { userId: null, authClient: null }
  const authClient = createAuthClient(token)
  if (!authClient) return { userId: null, authClient: null }
  return { userId: user.id, authClient }
}

/** SHA-256 fingerprint of OTP value for validation */
function otpFingerprint(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

// ─── POST /api/v1/otp — Persist a generated OTP to DB ────────────
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
    const {
      otp,
      format = 'numeric',
      length,
      purpose = 'login',
      quality_score,
      entropy_source = 'QRNG',
      expires_in_seconds = 300,
      generation_time_ms,
    } = body

    if (!otp || typeof otp !== 'string' || otp.length === 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_OTP', message: 'otp field required' } },
        { status: 400 }
      )
    }

    const expiresAt = new Date(Date.now() + expires_in_seconds * 1000)
    const fingerprint = otpFingerprint(otp)
    const otpLength = length || otp.length
    const maskedPreview = otp.length > 2
      ? '•'.repeat(otp.length - 2) + otp.slice(-2)
      : '••'

    const labelData = JSON.stringify({
      format,
      purpose,
      generation_time_ms: generation_time_ms || null,
      otp_preview: maskedPreview,
      expires_in_seconds,
    })

    const { data: inserted, error } = await authClient
      .from('generated_keys')
      .insert({
        user_id: userId,
        algorithm: 'OTP',
        bit_length: otpLength,
        entropy_source: entropy_source || 'QRNG',
        quality_score: quality_score || 0,
        fingerprint,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        label: labelData,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('OTP persist error:', error)
      return NextResponse.json(
        { error: { code: 'PERSIST_ERROR', message: 'Failed to save OTP record' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        id: inserted.id,
        format,
        purpose,
        length: otpLength,
        entropy_source,
        quality_score: quality_score || 0,
        otp_preview: maskedPreview,
        expires_at: expiresAt.toISOString(),
        created_at: inserted.created_at,
        status: 'active',
      },
    })
  } catch (err) {
    console.error('OTP save error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// ─── GET /api/v1/otp — OTP history + stats ───────────────────────
export async function GET(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')
    const statusFilter = request.nextUrl.searchParams.get('status')

    let query = authClient
      .from('generated_keys')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('algorithm', 'OTP')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: rows, count, error } = await query

    if (error) {
      console.error('OTP history fetch error:', error)
      return NextResponse.json(
        { error: { code: 'FETCH_ERROR', message: 'Failed to fetch OTP history' } },
        { status: 500 }
      )
    }

    // Stats: total, quantum source count, avg entropy
    const { data: allRows } = await authClient
      .from('generated_keys')
      .select('entropy_source, quality_score, status')
      .eq('user_id', userId)
      .eq('algorithm', 'OTP')

    const allOtps = allRows || []
    const quantumCount = allOtps.filter(r => r.entropy_source === 'QRNG').length
    const avgEntropy = allOtps.length > 0
      ? allOtps.reduce((s, r) => s + (r.quality_score || 0), 0) / allOtps.length
      : 0
    const successCount = allOtps.filter(r => r.status !== 'revoked').length
    const successRate = allOtps.length > 0 ? (successCount / allOtps.length) * 100 : 0

    // Mark expired OTPs (best-effort update)
    const now = new Date().toISOString()
    const expiredIds = (rows || [])
      .filter(r => r.status === 'active' && r.expires_at && r.expires_at < now)
      .map(r => r.id)

    if (expiredIds.length > 0) {
      await authClient
        .from('generated_keys')
        .update({ status: 'expired' })
        .in('id', expiredIds)
        .eq('user_id', userId)
    }

    const records = (rows || []).map(r => {
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
        generation_time_ms: labelData.generation_time_ms || null,
        expires_in_seconds: labelData.expires_in_seconds || 300,
        expires_at: r.expires_at,
        created_at: r.created_at,
        status: isExpired ? 'expired' : (r.status || 'active'),
      }
    })

    return NextResponse.json({
      data: records,
      meta: {
        total: count || 0,
        limit,
        offset,
        stats: {
          total_generated: allOtps.length,
          quantum_source_count: quantumCount,
          avg_entropy_bits: Math.round(avgEntropy * 128),
          success_rate: Math.round(successRate * 10) / 10,
        },
      },
    })
  } catch (err) {
    console.error('OTP history error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/v1/otp — Delete OTP record ──────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const otpId = request.nextUrl.searchParams.get('id')
    if (!otpId) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'id query parameter required' } },
        { status: 400 }
      )
    }

    const { error } = await authClient
      .from('generated_keys')
      .delete()
      .eq('id', otpId)
      .eq('user_id', userId)
      .eq('algorithm', 'OTP')

    if (error) {
      return NextResponse.json(
        { error: { code: 'DELETE_FAILED', message: 'Failed to delete OTP record' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { id: otpId, deleted: true } })
  } catch (err) {
    console.error('OTP delete error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete OTP record' } },
      { status: 500 }
    )
  }
}
