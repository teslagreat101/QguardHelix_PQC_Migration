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
    const { key_type = 'session', bit_length = 256, exchange_mode = 'X25519+ML-KEM', quality_score = 0, entropy_source = 'QRNG', encryption_key_preview } = body
    const fingerprint = createHash('sha256').update(`comm:${key_type}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 40)
    const labelData = JSON.stringify({ key_type, exchange_mode, encryption_key_preview: encryption_key_preview || fingerprint.slice(0, 16) + '...' })
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (key_type === 'session' ? 1 : key_type === 'vpn' ? 30 : 365))

    const { data: inserted, error } = await authClient.from('generated_keys').insert({
      user_id: userId, algorithm: `COMM-${key_type.toUpperCase()}`, bit_length, entropy_source, quality_score, fingerprint, status: 'active', expires_at: expiresAt.toISOString(), label: labelData,
    }).select('id, created_at').single()

    if (error) {
      console.error('Comm persist error:', error)
      return NextResponse.json({ error: { code: 'PERSIST_ERROR', message: 'Failed to save comm record' } }, { status: 500 })
    }
    return NextResponse.json({ data: { id: inserted.id, key_type, bit_length, exchange_mode, entropy_source, quality_score, expires_at: expiresAt.toISOString(), created_at: inserted.created_at, status: 'active' } })
  } catch (err) {
    console.error('Comm save error:', err)
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

    const { data: rows, count, error } = await authClient.from('generated_keys').select('*', { count: 'exact' }).eq('user_id', userId).like('algorithm', 'COMM-%').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: { code: 'FETCH_ERROR', message: 'Failed to fetch comm history' } }, { status: 500 })

    const { data: allRows } = await authClient.from('generated_keys').select('entropy_source, quality_score, algorithm').eq('user_id', userId).like('algorithm', 'COMM-%')
    const all = allRows || []

    const records = (rows || []).map(r => {
      let ld: Record<string, unknown> = {}
      try { ld = JSON.parse(r.label || '{}') } catch { /* skip */ }
      return { id: r.id, key_type: ld.key_type || r.algorithm?.replace('COMM-', '').toLowerCase() || 'session', bit_length: r.bit_length, exchange_mode: ld.exchange_mode || 'X25519+ML-KEM', encryption_key_preview: ld.encryption_key_preview || '***', entropy_source: r.entropy_source, quality_score: r.quality_score, fingerprint: r.fingerprint, expires_at: r.expires_at, created_at: r.created_at, status: r.status || 'active' }
    })

    return NextResponse.json({
      data: records,
      meta: { total: count || 0, limit, offset, stats: { total_generated: all.length, quantum_source_count: all.filter(r => r.entropy_source === 'QRNG').length, avg_quality: all.length > 0 ? Math.round((all.reduce((s, r) => s + (r.quality_score || 0), 0) / all.length) * 1000) / 1000 : 0, by_type: { session: all.filter(r => r.algorithm === 'COMM-SESSION').length, vpn: all.filter(r => r.algorithm === 'COMM-VPN').length, email: all.filter(r => r.algorithm === 'COMM-EMAIL').length } } },
    })
  } catch (err) {
    console.error('Comm history error:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 })
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: { code: 'INVALID_REQUEST', message: 'id query parameter required' } }, { status: 400 })
    const { error } = await authClient.from('generated_keys').delete().eq('id', id).eq('user_id', userId).like('algorithm', 'COMM-%')
    if (error) return NextResponse.json({ error: { code: 'DELETE_FAILED', message: 'Failed to delete comm record' } }, { status: 500 })
    return NextResponse.json({ data: { id, deleted: true } })
  } catch (err) {
    console.error('Comm delete error:', err)
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete comm record' } }, { status: 500 })
  }
}
