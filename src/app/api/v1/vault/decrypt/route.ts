import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { decryptFile, decryptSecretKey } from '@/lib/vault/crypto-engine'
import {
  checkRateLimit,
  logFileDecrypted,
  logIntegrityFailure,
  logRateLimited,
  logAccessDenied,
} from '@/lib/vault/audit-service'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
}

function fromHex(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
}

/**
 * POST /api/v1/vault/decrypt
 *
 * Decrypts and downloads a vault file.
 * Only the file owner can decrypt.
 *
 * Body: { fileId: string }
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

    // Rate limiting
    const allowed = await checkRateLimit(user.id, 'decrypt', client)
    if (!allowed) {
      await logRateLimited(user.id, 'decrypt', ip, client)
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Decrypt rate limit exceeded. Try again later.' } },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { fileId } = body

    if (!fileId) {
      return NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'File ID required' } },
        { status: 400 }
      )
    }

    // Get file metadata — always filter by user_id at query level (defense in depth)
    const { data: file } = await client
      .from('vault_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single()

    if (!file) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'File not found' } },
        { status: 404 }
      )
    }

    // Only owner can decrypt
    if (file.user_id !== user.id) {
      await logAccessDenied(user.id, 'decrypt', 'Not file owner', ip, client)
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Only the file owner can decrypt' } },
        { status: 403 }
      )
    }

    if (!file.is_locked || !file.kem_ciphertext || !file.aes_nonce) {
      return NextResponse.json(
        { error: { code: 'NOT_ENCRYPTED', message: 'File is not encrypted' } },
        { status: 400 }
      )
    }
    // Zero-knowledge files have no server-held key — they must be decrypted in the browser.
    if (!file.encryption_key_id) {
      return NextResponse.json(
        {
          error: {
            code: 'CLIENT_DECRYPT_REQUIRED',
            message:
              'This file is zero-knowledge encrypted. Open the Quantum Vault and enter your passphrase to decrypt it locally.',
          },
        },
        { status: 400 }
      )
    }

    if (!file.storage_path) {
      return NextResponse.json(
        { error: { code: 'NO_STORAGE', message: 'File storage path not found' } },
        { status: 404 }
      )
    }

    // Download encrypted file
    const { data: fileBlob, error: downloadError } = await client.storage
      .from('vault-files')
      .download(file.storage_path)

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: { code: 'DOWNLOAD_ERROR', message: 'Failed to retrieve encrypted file' } },
        { status: 500 }
      )
    }

    const encryptedData = new Uint8Array(await fileBlob.arrayBuffer())

    // Get the encryption secret key from vault_keys (stored as hex)
    const { data: keyRecord } = await client
      .from('vault_keys')
      .select('encrypted_private_key, key_encryption_method')
      .eq('id', file.encryption_key_id)
      .eq('user_id', user.id)
      .single()

    if (!keyRecord) {
      return NextResponse.json(
        { error: { code: 'KEY_ERROR', message: 'Decryption key not found' } },
        { status: 500 }
      )
    }

    // Recover the secret key.
    //   AES-256-GCM-USER  → per-user HKDF derivation  (current, recommended)
    //   AES-256-GCM       → global HKDF derivation     (transitional)
    //   PLAINTEXT_HEX     → no wrapping                (legacy, pre-fix)
    let secretKey: Uint8Array
    const method = keyRecord.key_encryption_method

    if (method === 'AES-256-GCM-USER' || method === 'AES-256-GCM') {
      const masterKey = process.env.VAULT_MASTER_KEY
      if (!masterKey && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: { code: 'CONFIG_ERROR', message: 'Vault master key not configured. Contact administrator.' } },
          { status: 500 }
        )
      }
      const effectiveMasterKey = masterKey ?? 'qguard-dev-fallback-key-not-for-production'
      const separatorIdx = keyRecord.encrypted_private_key.indexOf(':')
      if (separatorIdx === -1) {
        return NextResponse.json(
          { error: { code: 'KEY_ERROR', message: 'Stored key format invalid' } },
          { status: 500 }
        )
      }
      const nonceHex  = keyRecord.encrypted_private_key.slice(0, separatorIdx)
      const encKeyHex = keyRecord.encrypted_private_key.slice(separatorIdx + 1)
      const nonce  = fromHex(nonceHex)
      const encKey = fromHex(encKeyHex)
      // Pass user.id only for per-user keys so HKDF info string matches encryption
      const userId = method === 'AES-256-GCM-USER' ? user.id : undefined
      secretKey = decryptSecretKey(encKey, nonce, effectiveMasterKey, userId)
    } else {
      // Legacy PLAINTEXT_HEX — backward-compat for files encrypted before security fix
      secretKey = fromHex(keyRecord.encrypted_private_key)
    }

    // Decrypt the file
    let decryptedData: Uint8Array
    try {
      decryptedData = decryptFile(
        encryptedData,
        file.kem_ciphertext,
        file.aes_nonce,
        secretKey,
        file.integrity_hash || undefined
      )
    } catch (err) {
      const error = err as Error
      if (error.message?.includes('INTEGRITY_CHECK_FAILED')) {
        await logIntegrityFailure(user.id, fileId, file.name, ip, client)
        return NextResponse.json(
          { error: { code: 'INTEGRITY_FAILED', message: 'File integrity check failed — file may have been tampered with' } },
          { status: 422 }
        )
      }
      console.error('Decrypt error:', err)
      return NextResponse.json(
        { error: { code: 'DECRYPT_ERROR', message: 'Failed to decrypt file' } },
        { status: 500 }
      )
    }

    // Audit log
    await logFileDecrypted(user.id, fileId, file.name, ip, client)

    // Update last accessed
    await client
      .from('vault_files')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', fileId)

    // Return decrypted file as download
    return new NextResponse(decryptedData.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': file.mime_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
        'Content-Length': decryptedData.length.toString(),
        'X-Integrity-Hash': file.integrity_hash || '',
        'X-Encryption-Algorithm': file.encryption_algorithm,
      },
    })
  } catch (err) {
    console.error('Vault decrypt error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to decrypt file' } },
      { status: 500 }
    )
  }
}
