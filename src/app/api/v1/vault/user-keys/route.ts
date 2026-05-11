import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'

/**
 * GET /api/v1/vault/user-keys
 *
 * Returns the user's passphrase-wrapped ZK master keypairs (public keys in
 * cleartext, secret keys wrapped with the user's passphrase-derived KEK).
 * The server never sees the passphrase or the unwrapped secret keys.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Database not configured' } },
        { status: 500 }
      )
    }

    // Fetch ZK master encryption key (identified by key_encryption_method)
    const { data: encKey, error: encKeyError } = await client
      .from('vault_keys')
      .select('public_key, encrypted_private_key, fingerprint')
      .eq('user_id', user.id)
      .eq('key_type', 'encryption')
      .eq('key_encryption_method', 'PBKDF2-AES-256-GCM')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Fetch ZK master signing key (identified by key_encryption_method)
    const { data: sigKey, error: sigKeyError } = await client
      .from('vault_keys')
      .select('public_key, encrypted_private_key, fingerprint')
      .eq('user_id', user.id)
      .eq('key_type', 'signing')
      .eq('key_encryption_method', 'PBKDF2-AES-256-GCM')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // PGRST116 = "Results contain 0 rows" (not found — expected, not an error)
    const encNotFound = !encKey && encKeyError?.code === 'PGRST116'
    const sigNotFound = !sigKey && sigKeyError?.code === 'PGRST116'

    // Any other error (network, RLS, etc.) should be surfaced
    if (encKeyError && !encNotFound) {
      console.error('vault_keys enc fetch error:', encKeyError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to fetch encryption key: ${encKeyError.message}` } },
        { status: 500 }
      )
    }
    if (sigKeyError && !sigNotFound) {
      console.error('vault_keys sig fetch error:', sigKeyError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to fetch signing key: ${sigKeyError.message}` } },
        { status: 500 }
      )
    }

    if (!encKey || !sigKey) {
      return NextResponse.json({ data: null })
    }

    return NextResponse.json({
      data: {
        encPublicKey: encKey.public_key,
        wrappedEncSecretKey: encKey.encrypted_private_key,
        encFingerprint: encKey.fingerprint,
        sigPublicKey: sigKey.public_key,
        wrappedSigSecretKey: sigKey.encrypted_private_key,
        sigFingerprint: sigKey.fingerprint,
      },
    })
  } catch (err) {
    console.error('User keys GET error:', err)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch user keys' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/vault/user-keys
 *
 * Stores the user's passphrase-wrapped ZK master keypairs.
 * The server only stores:
 *   - Public keys (cleartext hex)
 *   - Secret keys wrapped with passphrase-derived KEK (salt:iterations:nonce:ciphertext)
 * The server NEVER sees the passphrase or unwrapped secret keys.
 *
 * Body: WrappedMasterKeys from client-crypto.ts
 */
export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Database not configured' } },
        { status: 500 }
      )
    }

    const body = await request.json()
    const {
      encPublicKey,
      wrappedEncSecretKey,
      encFingerprint,
      sigPublicKey,
      wrappedSigSecretKey,
      sigFingerprint,
    } = body

    // Validate required fields
    if (!encPublicKey || !wrappedEncSecretKey || !encFingerprint ||
        !sigPublicKey || !wrappedSigSecretKey || !sigFingerprint) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'All key fields are required' } },
        { status: 400 }
      )
    }

    // Validate wrapped key format: salt:iterations:nonce:ciphertext
    const encParts = wrappedEncSecretKey.split(':')
    const sigParts = wrappedSigSecretKey.split(':')
    if (encParts.length !== 4 || sigParts.length !== 4) {
      return NextResponse.json(
        { error: { code: 'INVALID_FORMAT', message: 'Wrapped key format invalid' } },
        { status: 400 }
      )
    }

    // Deactivate any existing ZK (PBKDF2-wrapped) master keys for this user
    await client
      .from('vault_keys')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('key_encryption_method', 'PBKDF2-AES-256-GCM')

    // Store ZK master encryption key
    const { error: encError } = await client
      .from('vault_keys')
      .insert({
        user_id: user.id,
        key_type: 'encryption',
        algorithm: 'ML-KEM-768',
        public_key: encPublicKey,
        encrypted_private_key: wrappedEncSecretKey,
        key_encryption_method: 'PBKDF2-AES-256-GCM',
        fingerprint: encFingerprint,
        is_active: true,
        version: 1,
      })

    if (encError) {
      console.error('ZK enc key insert error:', encError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to store encryption key: ${encError.message}` } },
        { status: 500 }
      )
    }

    // Store ZK master signing key
    const { error: sigError } = await client
      .from('vault_keys')
      .insert({
        user_id: user.id,
        key_type: 'signing',
        algorithm: 'ML-DSA-65',
        public_key: sigPublicKey,
        encrypted_private_key: wrappedSigSecretKey,
        key_encryption_method: 'PBKDF2-AES-256-GCM',
        fingerprint: sigFingerprint,
        is_active: true,
        version: 1,
      })

    if (sigError) {
      console.error('ZK sig key insert error:', sigError)
    }

    return NextResponse.json({
      data: {
        success: true,
        encFingerprint,
        sigFingerprint,
      },
    })
  } catch (err) {
    console.error('User keys POST error:', err)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to store user keys' } },
      { status: 500 }
    )
  }
}
