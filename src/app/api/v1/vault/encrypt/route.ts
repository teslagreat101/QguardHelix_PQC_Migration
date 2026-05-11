import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { encryptFile, signFileMetadata, encryptSecretKey } from '@/lib/vault/crypto-engine'
import {
  checkRateLimit,
  logFileEncrypted,
  logRateLimited,
  logKeyGenerated,
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
 * POST /api/v1/vault/encrypt
 *
 * Encrypts an already-uploaded vault file using ML-KEM-768 + AES-256-GCM
 * envelope encryption with ML-DSA-65 signature.
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
    const allowed = await checkRateLimit(user.id, 'upload', client)
    if (!allowed) {
      await logRateLimited(user.id, 'encrypt', ip, client)
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Encryption rate limit exceeded. Try again later.' } },
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

    // Get file metadata — verify ownership
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

    // Check if already encrypted
    if (file.is_locked) {
      return NextResponse.json(
        { error: { code: 'ALREADY_ENCRYPTED', message: 'File is already encrypted' } },
        { status: 400 }
      )
    }

    if (!file.storage_path) {
      return NextResponse.json(
        { error: { code: 'NO_STORAGE', message: 'File storage path not found' } },
        { status: 404 }
      )
    }

    // Step 1: Download the raw file from storage
    const { data: rawBlob, error: downloadError } = await client.storage
      .from('vault-files')
      .download(file.storage_path)

    if (downloadError || !rawBlob) {
      console.error('Download error:', downloadError)
      return NextResponse.json(
        { error: { code: 'DOWNLOAD_ERROR', message: 'Failed to retrieve file for encryption' } },
        { status: 500 }
      )
    }

    const fileData = new Uint8Array(await rawBlob.arrayBuffer())
    const originalSize = fileData.length
    console.log('[encrypt] Step 2: Generating ML-KEM-768 key pair...')

    // Step 2: Generate ML-KEM-768 key pair for this encryption
    const encKeyPair = ml_kem768.keygen()
    const encFingerprint = toHex(sha256(encKeyPair.publicKey)).slice(0, 32)
    console.log('[encrypt] Step 3: Encrypting file...')

    // Step 3: Encrypt file using envelope encryption
    const encryptionResult = encryptFile(fileData, encKeyPair.publicKey)
    console.log('[encrypt] Step 4: Generating ML-DSA-65 signing key...')

    // Step 4: Generate ML-DSA-65 signing key and sign metadata
    const sigKeyPair = ml_dsa65.keygen()
    const sigFingerprint = toHex(sha256(sigKeyPair.publicKey)).slice(0, 32)
    console.log('[encrypt] Step 4b: Signing metadata...')

    const signResult = signFileMetadata(
      {
        fileId: file.id,
        fileName: file.name,
        fileSize: originalSize,
        integrityHash: encryptionResult.integrityHash,
        encryptionAlgorithm: encryptionResult.algorithm,
        ownerId: user.id,
        timestamp: new Date().toISOString(),
      },
      sigKeyPair.secretKey
    )

    // Step 5: Store keys in vault_keys table
    // Private keys are encrypted at rest using AES-256-GCM before storage.
    console.log('[encrypt] Step 5: Encrypting and storing keys in vault_keys...')

    // VAULT_MASTER_KEY must be set in production. In development a fixed fallback is
    // used so the app runs, but keys encrypted with it have reduced protection.
    const masterKey = process.env.VAULT_MASTER_KEY
    if (!masterKey) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[encrypt] CRITICAL: VAULT_MASTER_KEY is not set in production.')
        return NextResponse.json(
          { error: { code: 'CONFIG_ERROR', message: 'Vault master key not configured. Contact administrator.' } },
          { status: 500 }
        )
      }
      console.warn('[encrypt] WARNING: VAULT_MASTER_KEY not set. Using dev fallback — do NOT use in production.')
    }
    const effectiveMasterKey = masterKey ?? 'qguard-dev-fallback-key-not-for-production'

    // Encrypt the ML-KEM-768 secret key before storage.
    // user.id is mixed into the HKDF derivation — each customer gets a unique
    // wrapping key so a master key leak alone cannot decrypt any user's vault.
    const { encryptedKey: encEncKey, nonce: encNonce } = encryptSecretKey(encKeyPair.secretKey, effectiveMasterKey, user.id)
    const encStoredKey = `${toHex(encNonce)}:${toHex(encEncKey)}`

    const { data: encKeyRecord, error: encKeyError } = await client
      .from('vault_keys')
      .insert({
        user_id: user.id,
        key_type: 'encryption',
        algorithm: 'ML-KEM-768',
        public_key: toHex(encKeyPair.publicKey),
        encrypted_private_key: encStoredKey,
        key_encryption_method: 'AES-256-GCM-USER',
        fingerprint: encFingerprint,
        is_active: true,
        version: 1,
      })
      .select('id')
      .single()

    if (encKeyError) {
      console.error('Enc key insert error:', encKeyError)
      return NextResponse.json(
        { error: { code: 'KEY_ERROR', message: 'Failed to store encryption key' } },
        { status: 500 }
      )
    }

    // Encrypt the ML-DSA-65 signing secret key with the same per-user derivation
    const { encryptedKey: sigEncKey, nonce: sigNonce } = encryptSecretKey(sigKeyPair.secretKey, effectiveMasterKey, user.id)
    const sigStoredKey = `${toHex(sigNonce)}:${toHex(sigEncKey)}`

    const { data: sigKeyRecord, error: sigKeyError } = await client
      .from('vault_keys')
      .insert({
        user_id: user.id,
        key_type: 'signing',
        algorithm: 'ML-DSA-65',
        public_key: toHex(sigKeyPair.publicKey),
        encrypted_private_key: sigStoredKey,
        key_encryption_method: 'AES-256-GCM-USER',
        fingerprint: sigFingerprint,
        is_active: true,
        version: 1,
      })
      .select('id')
      .single()

    if (sigKeyError) {
      console.error('Sig key insert error:', sigKeyError)
    }

    // Step 6: Replace the raw file with encrypted file in storage
    // Delete old raw file
    await client.storage.from('vault-files').remove([file.storage_path])

    // Upload encrypted file
    const encStoragePath = `${user.id}/${crypto.randomUUID()}-${file.name}.enc`
    const { error: uploadError } = await client.storage
      .from('vault-files')
      .upload(encStoragePath, encryptionResult.encryptedData, {
        contentType: 'application/octet-stream',
      })

    if (uploadError) {
      console.error('Encrypted upload error:', uploadError)
      return NextResponse.json(
        { error: { code: 'UPLOAD_ERROR', message: 'Failed to upload encrypted file' } },
        { status: 500 }
      )
    }

    // Step 7: Update file metadata
    const { data: updatedFile, error: updateError } = await client
      .from('vault_files')
      .update({
        encryption_algorithm: 'ML-KEM-768+AES-256-GCM',
        storage_path: encStoragePath,
        kem_ciphertext: encryptionResult.encryptedDataKey,
        aes_nonce: encryptionResult.aesNonce,
        signature: signResult.signature,
        signed_metadata: signResult.signedMetadata,
        signing_key_id: sigKeyRecord?.id || null,
        encryption_key_id: encKeyRecord.id,
        integrity_hash: encryptionResult.integrityHash,
        original_size: originalSize,
        size: encryptionResult.encryptedData.length,
        is_locked: true,
      })
      .eq('id', fileId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('DB update error:', updateError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to update file metadata' } },
        { status: 500 }
      )
    }

    // Step 8: Audit logging
    await logFileEncrypted(user.id, fileId, file.name, encKeyRecord.id, ip, client)
    await logKeyGenerated(user.id, encKeyRecord.id, 'encryption', 'ML-KEM-768', ip, client)

    // Zero out key material
    encKeyPair.secretKey.fill(0)
    sigKeyPair.secretKey.fill(0)

    return NextResponse.json({
      data: {
        ...updatedFile,
        encryption: 'ML-KEM-768+AES-256-GCM',
        signed: true,
        integrityHash: encryptionResult.integrityHash,
        originalSize,
      },
    })
  } catch (err) {
    const error = err as Error
    console.error('Vault encrypt error:', error.message, error.stack)
    return NextResponse.json(
      { error: { code: 'ENCRYPT_ERROR', message: `Failed to encrypt file: ${error.message}` } },
      { status: 500 }
    )
  }
}
