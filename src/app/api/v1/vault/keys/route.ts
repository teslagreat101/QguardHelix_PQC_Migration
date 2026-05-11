import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { encryptSecretKey } from '@/lib/vault/crypto-engine'
import {
  logKeyGenerated,
  logKeyRotated,
  recordAuditEvent,
  logAccess,
} from '@/lib/vault/audit-service'
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js'
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js'
import { sha256 } from '@noble/hashes/sha2.js'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * GET /api/v1/vault/keys
 * List user's vault keys (public metadata only, no secret keys).
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

    const { data: keys } = await client
      .from('vault_keys')
      .select('id, key_type, algorithm, fingerprint, key_encryption_method, is_active, version, expires_at, last_used_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const keyList = (keys || []).map((k) => ({
      id: k.id,
      keyType: k.key_type,
      algorithm: k.algorithm,
      fingerprint: k.fingerprint,
      keyEncryptionMethod: k.key_encryption_method,
      isActive: k.is_active,
      version: k.version,
      expiresAt: k.expires_at,
      lastUsedAt: k.last_used_at,
      createdAt: k.created_at,
    }))

    return NextResponse.json({
      data: {
        keys: keyList,
        activeEncryptionKey: keyList.find((k) => k.keyType === 'encryption' && k.isActive) || null,
        activeSigningKey: keyList.find((k) => k.keyType === 'signing' && k.isActive) || null,
        totalKeys: keyList.length,
        activeKeys: keyList.filter((k) => k.isActive).length,
      },
    })
  } catch (err) {
    console.error('Vault keys error:', err)
    return NextResponse.json(
      { error: { code: 'KEYS_ERROR', message: 'Failed to fetch vault keys' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/vault/keys
 * Key management: rotate or revoke keys.
 *
 * Body: { action: 'rotate' | 'revoke', keyType?: 'encryption' | 'signing', keyId?: string }
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

    const ip = getClientIp(request)
    const body = await request.json()
    const { action, keyType, keyId } = body

    // ─── REVOKE ─────────────────────────────────────────────
    if (action === 'revoke' && keyId) {
      // Get key info before revoking (for audit)
      const { data: keyInfo } = await client
        .from('vault_keys')
        .select('key_type, algorithm, fingerprint')
        .eq('id', keyId)
        .eq('user_id', user.id)
        .single()

      if (!keyInfo) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Key not found' } },
          { status: 404 }
        )
      }

      const { error } = await client
        .from('vault_keys')
        .update({ is_active: false })
        .eq('id', keyId)
        .eq('user_id', user.id)

      if (error) {
        return NextResponse.json(
          { error: { code: 'REVOKE_ERROR', message: 'Failed to revoke key' } },
          { status: 500 }
        )
      }

      // Audit log
      await Promise.all([
        logAccess({ userId: user.id, keyId, operation: 'key_rotate', status: 'success', ipAddress: ip, client }),
        recordAuditEvent({
          userId: user.id,
          eventType: 'key_revoked',
          severity: 'warning',
          resourceType: 'key',
          resourceId: keyId,
          description: `${keyInfo.key_type} key revoked (${keyInfo.algorithm}, fingerprint: ${keyInfo.fingerprint})`,
          ipAddress: ip,
          metadata: { keyType: keyInfo.key_type, algorithm: keyInfo.algorithm, fingerprint: keyInfo.fingerprint },
          client,
        }),
      ])

      return NextResponse.json({ data: { revoked: true, keyId } })
    }

    // ─── ROTATE ─────────────────────────────────────────────
    if (action === 'rotate' && keyType) {
      if (keyType !== 'encryption' && keyType !== 'signing') {
        return NextResponse.json(
          { error: { code: 'INVALID_TYPE', message: 'Key type must be "encryption" or "signing"' } },
          { status: 400 }
        )
      }

      // Get the current active key (to link rotation chain + determine version)
      const { data: currentKey } = await client
        .from('vault_keys')
        .select('id, version, key_encryption_method')
        .eq('user_id', user.id)
        .eq('key_type', keyType)
        .eq('is_active', true)
        // Exclude ZK (PBKDF2-wrapped) keys — those are managed client-side
        .neq('key_encryption_method', 'PBKDF2-AES-256-GCM')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const newVersion = currentKey ? currentKey.version + 1 : 1
      const rotatedFrom = currentKey?.id || null

      // Master key for wrapping
      const masterKey = process.env.VAULT_MASTER_KEY
      if (!masterKey && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: { code: 'CONFIG_ERROR', message: 'Vault master key not configured' } },
          { status: 500 }
        )
      }
      const effectiveMasterKey = masterKey ?? 'qguard-dev-fallback-key-not-for-production'

      let newKeyId: string

      if (keyType === 'encryption') {
        // Generate new ML-KEM-768 keypair
        const keyPair = ml_kem768.keygen()
        const fingerprint = toHex(sha256(keyPair.publicKey)).slice(0, 32)

        // Encrypt secret key with per-user derivation
        const { encryptedKey, nonce } = encryptSecretKey(keyPair.secretKey, effectiveMasterKey, user.id)
        const storedKey = `${toHex(nonce)}:${toHex(encryptedKey)}`

        // Deactivate old key
        if (currentKey) {
          await client
            .from('vault_keys')
            .update({ is_active: false })
            .eq('id', currentKey.id)
            .eq('user_id', user.id)
        }

        // Insert new key
        const { data: newKey, error: insertError } = await client
          .from('vault_keys')
          .insert({
            user_id: user.id,
            key_type: 'encryption',
            algorithm: 'ML-KEM-768',
            public_key: toHex(keyPair.publicKey),
            encrypted_private_key: storedKey,
            key_encryption_method: 'AES-256-GCM-USER',
            fingerprint,
            is_active: true,
            version: newVersion,
            rotated_from: rotatedFrom,
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
          })
          .select('id')
          .single()

        if (insertError || !newKey) {
          return NextResponse.json(
            { error: { code: 'KEY_ERROR', message: 'Failed to create new encryption key' } },
            { status: 500 }
          )
        }

        newKeyId = newKey.id

        // Zero out secret key material
        keyPair.secretKey.fill(0)
      } else {
        // Generate new ML-DSA-65 keypair
        const keyPair = ml_dsa65.keygen()
        const fingerprint = toHex(sha256(keyPair.publicKey)).slice(0, 32)

        const { encryptedKey, nonce } = encryptSecretKey(keyPair.secretKey, effectiveMasterKey, user.id)
        const storedKey = `${toHex(nonce)}:${toHex(encryptedKey)}`

        // Deactivate old key
        if (currentKey) {
          await client
            .from('vault_keys')
            .update({ is_active: false })
            .eq('id', currentKey.id)
            .eq('user_id', user.id)
        }

        // Insert new key
        const { data: newKey, error: insertError } = await client
          .from('vault_keys')
          .insert({
            user_id: user.id,
            key_type: 'signing',
            algorithm: 'ML-DSA-65',
            public_key: toHex(keyPair.publicKey),
            encrypted_private_key: storedKey,
            key_encryption_method: 'AES-256-GCM-USER',
            fingerprint,
            is_active: true,
            version: newVersion,
            rotated_from: rotatedFrom,
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('id')
          .single()

        if (insertError || !newKey) {
          return NextResponse.json(
            { error: { code: 'KEY_ERROR', message: 'Failed to create new signing key' } },
            { status: 500 }
          )
        }

        newKeyId = newKey.id
        keyPair.secretKey.fill(0)
      }

      // Audit log
      await Promise.all([
        logKeyRotated(user.id, newKeyId, keyType, ip, client),
        logKeyGenerated(user.id, newKeyId, keyType, keyType === 'encryption' ? 'ML-KEM-768' : 'ML-DSA-65', ip, client),
      ])

      return NextResponse.json({
        data: {
          rotated: true,
          keyType,
          newKeyId,
          version: newVersion,
          algorithm: keyType === 'encryption' ? 'ML-KEM-768' : 'ML-DSA-65',
        },
      })
    }

    return NextResponse.json(
      { error: { code: 'INVALID_ACTION', message: 'Valid actions: rotate, revoke' } },
      { status: 400 }
    )
  } catch (err) {
    console.error('Vault keys error:', err)
    return NextResponse.json(
      { error: { code: 'KEYS_ERROR', message: 'Failed to manage vault keys' } },
      { status: 500 }
    )
  }
}
