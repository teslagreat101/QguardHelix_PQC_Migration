import { NextRequest, NextResponse } from 'next/server'
import { generatePQCKeyPair } from '@/lib/quantum/pqc-crypto'
import { generateQuantumEntropy, calculateEntropyQuality } from '@/lib/quantum/qrng'
import { generateQRNGKey } from '@/lib/quantum/qrng-client'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import type { PQCAlgorithm } from '@/types/quantum.types'

const VALID_ALGORITHMS: PQCAlgorithm[] = ['ML-KEM', 'ML-DSA', 'SPHINCS+', 'HYBRID']

/** Resolve authenticated user + auth client from request (local JWT decode) */
async function resolveAuth(request: NextRequest) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) return { userId: null, authClient: null }
  const authClient = createAuthClient(token)
  if (!authClient) return { userId: null, authClient: null }
  return { userId: user.id, authClient }
}

// ─── GET /api/v1/keys — Fetch user's key history ───────────────
export async function GET(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const statusFilter = request.nextUrl.searchParams.get('status') // 'active' | 'revoked' | 'rotated' | 'expired' | null (all)
    const algorithmFilter = request.nextUrl.searchParams.get('algorithm') // 'ML-KEM' | 'ML-DSA' | 'SPHINCS+' | 'HYBRID' | null (all)
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50'), 100)
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0')

    let query = authClient
      .from('generated_keys')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }
    if (algorithmFilter) {
      query = query.eq('algorithm', algorithmFilter)
    }

    const { data: keys, count, error } = await query

    if (error) {
      console.error('Key fetch error:', error)
      return NextResponse.json(
        { error: { code: 'FETCH_ERROR', message: 'Failed to fetch keys' } },
        { status: 500 }
      )
    }

    // Also fetch today's count for quota display
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: todayCount } = await authClient
      .from('generated_keys')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())

    return NextResponse.json({
      data: (keys || []).map(k => ({
        id: k.id,
        algorithm: k.algorithm,
        bitLength: k.bit_length,
        entropySource: k.entropy_source,
        qualityScore: k.quality_score,
        fingerprint: k.fingerprint,
        status: k.status || 'active',
        createdAt: k.created_at,
        expiresAt: k.expires_at,
        revokedAt: k.revoked_at,
        rotatedFrom: k.rotated_from,
        label: k.label,
      })),
      meta: {
        total: count || 0,
        limit,
        offset,
        keysToday: todayCount || 0,
        maxKeysPerDay: 5,
      },
    })
  } catch (err) {
    console.error('Key history error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

// ─── POST /api/v1/keys — Generate a new quantum key ────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { algorithm = 'ML-KEM', bitLength = 256, label, rotatedFrom } = body

    if (!VALID_ALGORITHMS.includes(algorithm)) {
      return NextResponse.json(
        { error: { code: 'INVALID_ALGORITHM', message: `Supported algorithms: ${VALID_ALGORITHMS.join(', ')}` } },
        { status: 400 }
      )
    }

    // Generate real PQC key pair
    const keyPair = generatePQCKeyPair(algorithm as PQCAlgorithm)

    // Try real Qiskit QRNG first, fall back to local CSPRNG
    let entropySource: 'QRNG' | 'CSPRNG' | 'HYBRID' = 'CSPRNG'
    let qualityScore: number

    try {
      const qrngResult = await Promise.race([
        generateQRNGKey({ algorithm, bitLength, label, purpose: 'encryption' }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('QRNG timeout')), 5000)),
      ])
      entropySource = 'QRNG'
      qualityScore = qrngResult.quality_score
    } catch {
      // QRNG unavailable or timed out — fall back to local CSPRNG
      const entropy = generateQuantumEntropy(bitLength)
      qualityScore = calculateEntropyQuality(entropy.rawValues)
    }

    const { userId, authClient } = await resolveAuth(request)

    let persistedId: string | null = null

    if (userId && authClient) {
      // If rotating, mark old key as rotated
      if (rotatedFrom) {
        await authClient
          .from('generated_keys')
          .update({ status: 'rotated', revoked_at: new Date().toISOString() })
          .eq('id', rotatedFrom)
          .eq('user_id', userId)
      }

      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 2)

      const { data: inserted } = await authClient.from('generated_keys').insert({
        user_id: userId,
        algorithm,
        bit_length: bitLength,
        entropy_source: entropySource,
        quality_score: qualityScore,
        fingerprint: keyPair.fingerprint,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        rotated_from: rotatedFrom || null,
        label: label || null,
      }).select('id').single()

      persistedId = inserted?.id || null

      // Increment daily key counter (best-effort)
      try {
        const { data: profile } = await authClient
          .from('profiles')
          .select('keys_generated_today')
          .eq('id', userId)
          .single()
        if (profile) {
          await authClient
            .from('profiles')
            .update({ keys_generated_today: (profile.keys_generated_today || 0) + 1 })
            .eq('id', userId)
        }
      } catch {
        // Non-critical — continue
      }
    }

    return NextResponse.json({
      data: {
        id: persistedId || crypto.randomUUID(),
        publicKey: keyPair.publicKey,
        algorithm: keyPair.algorithm,
        bitLength,
        fingerprint: keyPair.fingerprint,
        entropySource: entropySource,
        qualityScore,
        status: 'active',
        createdAt: keyPair.createdAt,
        expiresAt: keyPair.expiresAt,
        exportable: true,
        rotatedFrom: rotatedFrom || null,
        label: label || null,
      },
    })
  } catch (err) {
    console.error('Key generation error:', err)
    return NextResponse.json(
      { error: { code: 'KEY_GEN_ERROR', message: 'Failed to generate quantum key' } },
      { status: 400 }
    )
  }
}

// ─── PATCH /api/v1/keys — Revoke a key ──────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { keyId, action } = body // action: 'revoke'

    if (!keyId || action !== 'revoke') {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'keyId and action="revoke" required' } },
        { status: 400 }
      )
    }

    const { data, error } = await authClient
      .from('generated_keys')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('id', keyId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: { code: 'REVOKE_FAILED', message: 'Key not found or already revoked' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: {
        id: data.id,
        status: 'revoked',
        revokedAt: data.revoked_at,
        message: 'Key revoked successfully',
      },
    })
  } catch (err) {
    console.error('Key revoke error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke key' } },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/v1/keys — Permanently delete a key ─────────────
export async function DELETE(request: NextRequest) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const keyId = request.nextUrl.searchParams.get('keyId')
    if (!keyId) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'keyId query parameter required' } },
        { status: 400 }
      )
    }

    const { error } = await authClient
      .from('generated_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json(
        { error: { code: 'DELETE_FAILED', message: 'Failed to delete key' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: { id: keyId, deleted: true, message: 'Key permanently deleted' },
    })
  } catch (err) {
    console.error('Key delete error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete key' } },
      { status: 500 }
    )
  }
}
