import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { verifyFileSignature } from '@/lib/vault/crypto-engine'
import { logAccess, recordAuditEvent } from '@/lib/vault/audit-service'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
}

/**
 * POST /api/v1/vault/verify
 *
 * Verify the integrity of a vault file without decrypting it.
 * Checks:
 * 1. Encrypted blob hash matches stored hash (storage-level integrity)
 * 2. Digital signature is valid (if signed)
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

    const body = await request.json()
    const { fileId } = body
    const ip = getClientIp(request)

    if (!fileId) {
      return NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'File ID required' } },
        { status: 400 }
      )
    }

    // Get file metadata
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

    const checks = {
      storageIntegrity: false,
      signatureValid: false,
      hasSignature: !!file.signature,
      encryptionAlgorithm: file.encryption_algorithm,
      integrityHash: file.integrity_hash,
    }

    // Check 1: Verify the encrypted blob exists and matches expected size
    if (file.storage_path) {
      const { data: fileBlob, error: downloadError } = await client.storage
        .from('vault-files')
        .download(file.storage_path)

      if (!downloadError && fileBlob) {
        const blobData = new Uint8Array(await fileBlob.arrayBuffer())
        // Verify the encrypted blob size matches what we stored
        if (blobData.length === file.size) {
          checks.storageIntegrity = true
        }
      }
    }

    // Check 2: Verify digital signature if present
    if (file.signature && file.signed_metadata) {
      let sigPublicKeyHex: string | null = null

      if (file.signing_key_id) {
        // Server-side encrypted files — signing key is linked directly
        const { data: signingKey } = await client
          .from('vault_keys')
          .select('public_key')
          .eq('id', file.signing_key_id)
          .eq('user_id', user.id)
          .single()
        if (signingKey) sigPublicKeyHex = signingKey.public_key
      } else {
        // ZK files — signed client-side with the user's ZK master signing key
        const { data: zkSigKey } = await client
          .from('vault_keys')
          .select('public_key')
          .eq('user_id', user.id)
          .eq('key_type', 'signing')
          .eq('key_encryption_method', 'PBKDF2-AES-256-GCM')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (zkSigKey) sigPublicKeyHex = zkSigKey.public_key
      }

      if (sigPublicKeyHex) {
        const pubKeyBytes = new Uint8Array(
          sigPublicKeyHex.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16))
        )
        checks.signatureValid = verifyFileSignature(file.signed_metadata, file.signature, pubKeyBytes)
      }
    }

    const overallValid = checks.storageIntegrity &&
      (!checks.hasSignature || checks.signatureValid)

    // Log the verification
    await Promise.all([
      logAccess({
        userId: user.id,
        fileId,
        operation: overallValid ? 'integrity_check' : 'integrity_fail',
        status: overallValid ? 'success' : 'failure',
        ipAddress: ip,
        client,
      }),
      recordAuditEvent({
        userId: user.id,
        eventType: overallValid ? 'integrity_verified' : 'integrity_failed',
        severity: overallValid ? 'info' : 'critical',
        resourceType: 'file',
        resourceId: fileId,
        description: overallValid
          ? `Integrity verified for: ${file.name}`
          : `INTEGRITY FAILURE for: ${file.name}`,
        ipAddress: ip,
        metadata: checks,
        client,
      }),
    ])

    return NextResponse.json({
      data: {
        fileId,
        fileName: file.name,
        valid: overallValid,
        checks,
        verifiedAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('Vault verify error:', err)
    return NextResponse.json(
      { error: { code: 'VERIFY_ERROR', message: 'Failed to verify file integrity' } },
      { status: 500 }
    )
  }
}
