import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { sha3_256 } from '@noble/hashes/sha3.js'

/**
 * Register / read a user's portable hybrid identity public-key set.
 *
 * The four public keys that make up a QGV1-compatible identity are
 * stored as four rows in public.vault_keys, grouped by a shared
 * identity_id. Secret keys never leave the client — they live only
 * inside the user's .qgkey bundle.
 *
 * Registration is idempotent: POST replaces any prior active hybrid
 * identity for the caller. Legacy ZK master keys
 * (key_encryption_method = 'PBKDF2-AES-256-GCM') are untouched.
 */

const HYBRID_METHOD = 'QGKEY-v1'

interface PublicsPayload {
  x25519_b64: string
  mlkem768_b64: string
  ed25519_b64: string
  mldsa65_b64: string
  label?: string
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toHex(b: Uint8Array): string {
  let s = ''
  for (const x of b) s += x.toString(16).padStart(2, '0')
  return s
}

function identityFingerprint(p: PublicsPayload): string {
  const parts = [
    b64decode(p.x25519_b64),
    b64decode(p.mlkem768_b64),
    b64decode(p.ed25519_b64),
    b64decode(p.mldsa65_b64),
  ]
  let total = 0
  for (const a of parts) total += a.length
  const buf = new Uint8Array(total)
  let o = 0
  for (const a of parts) { buf.set(a, o); o += a.length }
  return toHex(sha3_256(buf))
}

export async function GET(request: NextRequest) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }
  const client = createAuthClient(token)
  if (!client) {
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Database not configured' } },
      { status: 500 },
    )
  }

  const { data: rows, error } = await client
    .from('vault_keys')
    .select('id, identity_id, algorithm, public_key, fingerprint, created_at')
    .eq('user_id', user.id)
    .eq('key_encryption_method', HYBRID_METHOD)
    .eq('is_active', true)
    .not('identity_id', 'is', null)

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ data: null })
  }

  const byIdentity = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = r.identity_id as string
    if (!byIdentity.has(key)) byIdentity.set(key, [])
    byIdentity.get(key)!.push(r)
  }

  let best: { identityId: string; pick: typeof rows } | null = null
  for (const [id, group] of byIdentity) {
    if (group.length === 4) {
      const newest = group.reduce((a, b) =>
        new Date(a.created_at).getTime() > new Date(b.created_at).getTime() ? a : b,
      )
      if (
        !best ||
        new Date(newest.created_at).getTime() >
          Math.max(...best.pick.map((r) => new Date(r.created_at).getTime()))
      ) {
        best = { identityId: id, pick: group }
      }
    }
  }

  if (!best) return NextResponse.json({ data: null })

  const byAlgo = Object.fromEntries(best.pick.map((r) => [r.algorithm, r.public_key]))
  return NextResponse.json({
    data: {
      identityId: best.identityId,
      publicsHex: {
        x25519: byAlgo['X25519'],
        mlkem768: byAlgo['ML-KEM-768'],
        ed25519: byAlgo['Ed25519'],
        mldsa65: byAlgo['ML-DSA-65'],
      },
      fingerprint: best.pick[0].fingerprint,
    },
  })
}

export async function POST(request: NextRequest) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    )
  }
  const client = createAuthClient(token)
  if (!client) {
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Database not configured' } },
      { status: 500 },
    )
  }

  let body: PublicsPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_JSON', message: 'Invalid JSON body' } },
      { status: 400 },
    )
  }
  if (!body.x25519_b64 || !body.mlkem768_b64 || !body.ed25519_b64 || !body.mldsa65_b64) {
    return NextResponse.json(
      { error: { code: 'MISSING_KEYS', message: 'All four public keys are required' } },
      { status: 400 },
    )
  }

  const lengths = {
    x25519: b64decode(body.x25519_b64).length,
    mlkem768: b64decode(body.mlkem768_b64).length,
    ed25519: b64decode(body.ed25519_b64).length,
    mldsa65: b64decode(body.mldsa65_b64).length,
  }
  if (
    lengths.x25519 !== 32 ||
    lengths.mlkem768 !== 1184 ||
    lengths.ed25519 !== 32 ||
    lengths.mldsa65 !== 1952
  ) {
    return NextResponse.json(
      {
        error: {
          code: 'BAD_KEY_LENGTHS',
          message: `Key length mismatch: got ${JSON.stringify(lengths)}, want 32/1184/32/1952`,
        },
      },
      { status: 400 },
    )
  }

  const fingerprint = identityFingerprint(body)

  // Deactivate any prior hybrid identity for this user.
  await client
    .from('vault_keys')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('key_encryption_method', HYBRID_METHOD)

  const identityId = crypto.randomUUID()
  const base = {
    user_id: user.id,
    identity_id: identityId,
    key_encryption_method: HYBRID_METHOD,
    fingerprint,
    is_active: true,
    version: 1,
  }

  const rows = [
    {
      ...base,
      key_type: 'encryption',
      algorithm: 'X25519',
      public_key: toHex(b64decode(body.x25519_b64)),
      encrypted_private_key: '',
    },
    {
      ...base,
      key_type: 'encryption',
      algorithm: 'ML-KEM-768',
      public_key: toHex(b64decode(body.mlkem768_b64)),
      encrypted_private_key: '',
    },
    {
      ...base,
      key_type: 'signing',
      algorithm: 'Ed25519',
      public_key: toHex(b64decode(body.ed25519_b64)),
      encrypted_private_key: '',
    },
    {
      ...base,
      key_type: 'signing',
      algorithm: 'ML-DSA-65',
      public_key: toHex(b64decode(body.mldsa65_b64)),
      encrypted_private_key: '',
    },
  ]

  const { error: insertError } = await client.from('vault_keys').insert(rows)
  if (insertError) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: insertError.message } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: { identityId, fingerprint, label: body.label ?? null },
  })
}
