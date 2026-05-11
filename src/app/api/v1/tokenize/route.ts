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

// ─── POST /api/v1/tokenize — Persist a tokenization record ──────
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
      token_id,
      token_value,
      data_type = 'credit-card',
      format_preserving = true,
      original_hint,
      binding_hmac,
      quality_score = 0,
      entropy_source = 'QRNG',
    } = body

    if (!token_id || !token_value) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'token_id and token_value required' } },
        { status: 400 }
      )
    }

    const fingerprint = createHash('sha256').update(`${token_id}:${token_value}`).digest('hex').slice(0, 40)

    const labelData = JSON.stringify({
      token_id,
      token_value_preview: token_value.slice(0, 4) + '***' + token_value.slice(-4),
      data_type,
      format_preserving,
      original_hint: original_hint || '****',
      binding_hmac: binding_hmac || null,
    })

    const { data: inserted, error } = await authClient
      .from('generated_keys')
      .insert({
        user_id: userId,
        algorithm: 'TOKEN',
        bit_length: token_value.length,
        entropy_source: entropy_source || 'QRNG',
        quality_score: quality_score || 0,
        fingerprint,
        status: 'active',
        label: labelData,
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('Token persist error:', error)
      return NextResponse.json(
        { error: { code: 'PERSIST_ERROR', message: 'Failed to save tokenization record' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        id: inserted.id,
        token_id,
        data_type,
        format_preserving,
        entropy_source,
        quality_score,
        created_at: inserted.created_at,
        status: 'active',
      },
    })
  } catch (err) {
    console.error('Token save error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// ─── GET /api/v1/tokenize — Tokenization history + stats ─────────
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
      .eq('algorithm', 'TOKEN')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Token history fetch error:', error)
      return NextResponse.json(
        { error: { code: 'FETCH_ERROR', message: 'Failed to fetch tokenization history' } },
        { status: 500 }
      )
    }

    // Stats
    const { data: allRows } = await authClient
      .from('generated_keys')
      .select('entropy_source, quality_score')
      .eq('user_id', userId)
      .eq('algorithm', 'TOKEN')

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
        token_id: labelData.token_id || '',
        token_value_preview: labelData.token_value_preview || '***',
        data_type: labelData.data_type || 'unknown',
        format_preserving: labelData.format_preserving ?? true,
        original_hint: labelData.original_hint || '****',
        entropy_source: r.entropy_source,
        quality_score: r.quality_score,
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
          total_tokenized: all.length,
          quantum_source_count: quantumCount,
          avg_quality: Math.round(avgQuality * 1000) / 1000,
        },
      },
    })
  } catch (err) {
    console.error('Token history error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/v1/tokenize — Delete tokenization record ────────
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
      .eq('algorithm', 'TOKEN')

    if (error) {
      return NextResponse.json(
        { error: { code: 'DELETE_FAILED', message: 'Failed to delete token record' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { id, deleted: true } })
  } catch (err) {
    console.error('Token delete error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete token record' } },
      { status: 500 }
    )
  }
}
