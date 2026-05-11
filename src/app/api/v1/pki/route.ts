import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'

/** Resolve authenticated user from request */
async function resolveAuth(request: NextRequest) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) return { userId: null, authClient: null }
  const authClient = createAuthClient(token)
  if (!authClient) return { userId: null, authClient: null }
  return { userId: user.id, authClient }
}

// ─── POST /api/v1/pki — Persist a PKI certificate record ────────
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
      common_name,
      organization,
      key_algorithm = 'ML-DSA',
      validity_days = 365,
      quality_score = 0,
      entropy_source = 'QRNG',
      serial_number,
      fingerprint_sha256,
      key_usage,
      extended_key_usage,
      sans,
    } = body

    if (!common_name) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'common_name required' } },
        { status: 400 }
      )
    }

    const fingerprint = fingerprint_sha256 || createHash('sha256').update(`${common_name}:${Date.now()}`).digest('hex').slice(0, 40)
    const expiresAt = new Date(Date.now() + validity_days * 24 * 60 * 60 * 1000)

    const labelData = JSON.stringify({
      common_name,
      organization: organization || null,
      serial_number: serial_number || null,
      key_usage: key_usage || [],
      extended_key_usage: extended_key_usage || [],
      sans: sans || [],
      validity_days,
    })

    const { data: inserted, error } = await authClient
      .from('generated_keys')
      .insert({
        user_id: userId,
        algorithm: `PKI-${key_algorithm}`,
        bit_length: key_algorithm === 'ML-DSA' ? 2528 : key_algorithm === 'SPHINCS+' ? 256 : 768,
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
      console.error('PKI persist error:', error)
      return NextResponse.json(
        { error: { code: 'PERSIST_ERROR', message: 'Failed to save PKI record' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        id: inserted.id,
        common_name,
        key_algorithm,
        validity_days,
        entropy_source,
        quality_score,
        fingerprint,
        expires_at: expiresAt.toISOString(),
        created_at: inserted.created_at,
        status: 'active',
      },
    })
  } catch (err) {
    console.error('PKI save error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// ─── GET /api/v1/pki — PKI certificate history + stats ───────────
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

    const { data: rows, count, error } = await authClient
      .from('generated_keys')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .like('algorithm', 'PKI-%')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('PKI history fetch error:', error)
      return NextResponse.json(
        { error: { code: 'FETCH_ERROR', message: 'Failed to fetch PKI history' } },
        { status: 500 }
      )
    }

    // Stats
    const { data: allRows } = await authClient
      .from('generated_keys')
      .select('entropy_source, quality_score, status')
      .eq('user_id', userId)
      .like('algorithm', 'PKI-%')

    const all = allRows || []
    const quantumCount = all.filter(r => r.entropy_source === 'QRNG').length
    const avgQuality = all.length > 0
      ? all.reduce((s, r) => s + (r.quality_score || 0), 0) / all.length
      : 0

    const records = (rows || []).map(r => {
      let labelData: Record<string, unknown> = {}
      try { labelData = JSON.parse(r.label || '{}') } catch { /* skip */ }

      return {
        id: r.id,
        common_name: labelData.common_name || 'unknown',
        key_algorithm: r.algorithm?.replace('PKI-', '') || 'ML-DSA',
        validity_days: labelData.validity_days || 365,
        organization: labelData.organization || null,
        entropy_source: r.entropy_source,
        quality_score: r.quality_score,
        fingerprint: r.fingerprint,
        expires_at: r.expires_at,
        created_at: r.created_at,
        status: r.status || 'active',
      }
    })

    return NextResponse.json({
      data: records,
      meta: {
        total: count || 0,
        limit,
        offset,
        stats: {
          total_generated: all.length,
          quantum_source_count: quantumCount,
          avg_quality: Math.round(avgQuality * 1000) / 1000,
        },
      },
    })
  } catch (err) {
    console.error('PKI history error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/v1/pki — Delete PKI record ──────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const id = request.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'id query parameter required' } },
        { status: 400 }
      )
    }

    const { error } = await authClient
      .from('generated_keys')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .like('algorithm', 'PKI-%')

    if (error) {
      return NextResponse.json(
        { error: { code: 'DELETE_FAILED', message: 'Failed to delete PKI record' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { id, deleted: true } })
  } catch (err) {
    console.error('PKI delete error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete PKI record' } },
      { status: 500 }
    )
  }
}
