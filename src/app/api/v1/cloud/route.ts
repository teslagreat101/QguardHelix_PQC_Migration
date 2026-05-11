import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
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

export async function POST(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }
    const body = await request.json()
    const { target = 'generic', container_count = 3, seed_bits = 256, prefix = '', quality_score = 0, entropy_source = 'QRNG' } = body
    const fingerprint = createHash('sha256').update(`cloud:${target}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 40)
    const labelData = JSON.stringify({ target, container_count, seed_bits, prefix: prefix || null })

    const { data: inserted, error } = await authClient.from('generated_keys').insert({
      user_id: userId, algorithm: `CLOUD-${target.toUpperCase()}`, bit_length: seed_bits, entropy_source, quality_score, fingerprint, status: 'active', label: labelData,
    }).select('id, created_at').single()

    if (error) {
      console.error('Cloud persist error:', error)
      return NextResponse.json({ error: { code: 'PERSIST_ERROR', message: 'Failed to save cloud seed record' } }, { status: 500 })
    }
    return NextResponse.json({ data: { id: inserted.id, target, container_count, seed_bits, entropy_source, quality_score, created_at: inserted.created_at, status: 'active' } })
  } catch (err) {
    console.error('Cloud save error:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    }
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')

    const { data: rows, count, error } = await authClient.from('generated_keys').select('*', { count: 'exact' }).eq('user_id', userId).like('algorithm', 'CLOUD-%').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: { code: 'FETCH_ERROR', message: 'Failed to fetch cloud history' } }, { status: 500 })

    const { data: allRows } = await authClient.from('generated_keys').select('entropy_source, quality_score, algorithm').eq('user_id', userId).like('algorithm', 'CLOUD-%')
    const all = allRows || []

    const records = (rows || []).map(r => {
      let ld: Record<string, unknown> = {}
      try { ld = JSON.parse(r.label || '{}') } catch { /* skip */ }
      return { id: r.id, target: ld.target || r.algorithm?.replace('CLOUD-', '').toLowerCase() || 'generic', container_count: ld.container_count || 1, seed_bits: r.bit_length, entropy_source: r.entropy_source, quality_score: r.quality_score, created_at: r.created_at, status: r.status || 'active' }
    })

    return NextResponse.json({
      data: records,
      meta: { total: count || 0, limit, offset, stats: { total_generated: all.length, quantum_source_count: all.filter(r => r.entropy_source === 'QRNG').length, avg_quality: all.length > 0 ? Math.round((all.reduce((s, r) => s + (r.quality_score || 0), 0) / all.length) * 1000) / 1000 : 0 } },
    })
  } catch (err) {
    console.error('Cloud history error:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'id query parameter required' } }, { status: 400 })
    const { error } = await authClient.from('generated_keys').delete().eq('id', id).eq('user_id', userId).like('algorithm', 'CLOUD-%')
    if (error) return NextResponse.json({ error: { code: 'DELETE_FAILED', message: 'Failed to delete cloud record' } }, { status: 500 })
    return NextResponse.json({ data: { id, deleted: true } })
  } catch (err) {
    console.error('Cloud delete error:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete cloud record' } }, { status: 500 })
  }
}
