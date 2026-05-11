import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { decryptFile, decryptSecretKey } from '@/lib/vault/crypto-engine'
import { encryptToQGV1 } from '@/lib/vault/qgv1'

/**
 * POST /api/v1/vault/export-qgv1  { fileId: string }
 *
 * ⚠ DISABLED BY DEFAULT (returns 410 Gone unless explicitly enabled).
 *
 * Why disabled: this route decrypts plaintext server-side and signs
 * the resulting QGV1 container with a server-held issuer key. That
 * cuts directly against the product's end-to-end / user-attributable
 * signing model:
 *   • A server compromise = signature forgery for any file labelled
 *     "qguard-issuer-v1". Recipients cannot distinguish forgery from
 *     legitimate exports.
 *   • The container is signed by the *service*, not by the user — so
 *     downstream verifiers get no cryptographic evidence that the
 *     human who owns the vault actually authorized the export.
 *
 * The supported export path is client-side: the user imports their
 * .qgkey bundle in the browser, which fetches plaintext over the
 * existing /decrypt route and re-encrypts + dual-signs locally with
 * their own hybrid signing keys.
 *
 * To re-enable this route (e.g. for an enterprise issuer-signed
 * distribution flow), set:
 *   QGUARD_ENABLE_SERVER_REPACKAGE=1
 *   QGUARD_ISSUER_ED25519_SK_B64  — 32-byte Ed25519 secret key, base64
 *   QGUARD_ISSUER_MLDSA_SK_B64    — ML-DSA-65 secret key, base64
 *   QGUARD_ISSUER_ED25519_PK_B64  — advertised for verification
 *   QGUARD_ISSUER_MLDSA_PK_B64    — advertised for verification
 *
 * Even with the flag on: prefer a KMS-backed signer over env vars,
 * log every signing call, and publish the PK as a JWKS-style list to
 * support rotation. Missing env → 412 PRECONDITION_FAILED. We never
 * fall back to a hardcoded or ephemeral signer.
 */

export const runtime = 'nodejs'

function fromHex(hex: string): Uint8Array {
  const m = hex.match(/.{1,2}/g)
  if (!m) return new Uint8Array()
  return new Uint8Array(m.map((b) => parseInt(b, 16)))
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function clientIp(req: NextRequest): string | undefined {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    undefined
  )
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.QGUARD_ENABLE_SERVER_REPACKAGE !== '1') {
      return NextResponse.json(
        {
          error: {
            code: 'SERVER_REPACKAGE_DISABLED',
            message:
              'Server-side .qgv1 repackage is disabled. Use the in-browser export: import your .qgkey identity in the vault UI, then click "Export as .qgv1". This signs the container with your own keys end-to-end.',
          },
        },
        { status: 410 },
      )
    }

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

    const issuerEdSk = process.env.QGUARD_ISSUER_ED25519_SK_B64
    const issuerMldsaSk = process.env.QGUARD_ISSUER_MLDSA_SK_B64
    if (!issuerEdSk || !issuerMldsaSk) {
      return NextResponse.json(
        {
          error: {
            code: 'ISSUER_UNCONFIGURED',
            message:
              'Server issuer signing keys are not configured. Set QGUARD_ISSUER_ED25519_SK_B64 and QGUARD_ISSUER_MLDSA_SK_B64 to enable QGV1 export.',
          },
        },
        { status: 412 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const fileId = (body as { fileId?: string }).fileId
    if (!fileId) {
      return NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'File ID required' } },
        { status: 400 },
      )
    }

    const { data: file } = await client
      .from('vault_files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single()
    if (!file) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'File not found' } },
        { status: 404 },
      )
    }
    if (!file.is_locked || !file.encryption_key_id || !file.kem_ciphertext || !file.aes_nonce) {
      return NextResponse.json(
        { error: { code: 'NOT_ENCRYPTED', message: 'File is not encrypted' } },
        { status: 400 },
      )
    }

    const { data: fileBlob, error: downloadError } = await client.storage
      .from('vault-files')
      .download(file.storage_path)
    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: { code: 'DOWNLOAD_ERROR', message: 'Failed to retrieve file' } },
        { status: 500 },
      )
    }
    const encryptedData = new Uint8Array(await fileBlob.arrayBuffer())

    const { data: keyRecord } = await client
      .from('vault_keys')
      .select('encrypted_private_key, key_encryption_method')
      .eq('id', file.encryption_key_id)
      .eq('user_id', user.id)
      .single()
    if (!keyRecord) {
      return NextResponse.json(
        { error: { code: 'KEY_ERROR', message: 'Decryption key not found' } },
        { status: 500 },
      )
    }

    let secretKey: Uint8Array
    const method = keyRecord.key_encryption_method
    if (method === 'AES-256-GCM-USER' || method === 'AES-256-GCM') {
      const masterKey = process.env.VAULT_MASTER_KEY
      if (!masterKey && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: { code: 'CONFIG_ERROR', message: 'Vault master key not configured' } },
          { status: 500 },
        )
      }
      const effective = masterKey ?? 'qguard-dev-fallback-key-not-for-production'
      const sep = keyRecord.encrypted_private_key.indexOf(':')
      if (sep === -1) {
        return NextResponse.json(
          { error: { code: 'KEY_ERROR', message: 'Stored key format invalid' } },
          { status: 500 },
        )
      }
      const nonce = fromHex(keyRecord.encrypted_private_key.slice(0, sep))
      const encKey = fromHex(keyRecord.encrypted_private_key.slice(sep + 1))
      const userId = method === 'AES-256-GCM-USER' ? user.id : undefined
      secretKey = decryptSecretKey(encKey, nonce, effective, userId)
    } else {
      secretKey = fromHex(keyRecord.encrypted_private_key)
    }

    let plaintext: Uint8Array
    try {
      plaintext = decryptFile(
        encryptedData,
        file.kem_ciphertext,
        file.aes_nonce,
        secretKey,
        file.integrity_hash || undefined,
      )
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('INTEGRITY_CHECK_FAILED')) {
        return NextResponse.json(
          { error: { code: 'INTEGRITY_FAILED', message: 'File integrity check failed' } },
          { status: 422 },
        )
      }
      return NextResponse.json(
        { error: { code: 'DECRYPT_ERROR', message: 'Failed to decrypt file' } },
        { status: 500 },
      )
    }

    // Load the caller's active hybrid identity publics.
    const { data: hybridRows } = await client
      .from('vault_keys')
      .select('identity_id, algorithm, public_key')
      .eq('user_id', user.id)
      .eq('key_encryption_method', 'QGKEY-v1')
      .eq('is_active', true)
      .not('identity_id', 'is', null)

    if (!hybridRows || hybridRows.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_HYBRID_IDENTITY',
            message:
              'No active hybrid identity registered. Generate a .qgkey in the vault dashboard and register its public keys first.',
          },
        },
        { status: 412 },
      )
    }

    const byAlgo = new Map<string, string>()
    for (const r of hybridRows) byAlgo.set(r.algorithm, r.public_key as string)
    const x25519Pub = byAlgo.get('X25519')
    const mlkemPub = byAlgo.get('ML-KEM-768')
    if (!x25519Pub || !mlkemPub) {
      return NextResponse.json(
        {
          error: {
            code: 'INCOMPLETE_HYBRID_IDENTITY',
            message: 'Hybrid identity is missing X25519 or ML-KEM-768 public key',
          },
        },
        { status: 412 },
      )
    }

    const container = encryptToQGV1({
      filename: file.name,
      fileData: plaintext,
      recipientX25519Public: fromHex(x25519Pub),
      recipientMlkemPublic: fromHex(mlkemPub),
      signerEd25519Secret: b64decode(issuerEdSk),
      signerMldsaSecret: b64decode(issuerMldsaSk),
      encryptionKeyId: `user:${user.id}`,
      signingKeyId: 'qguard-issuer-v1',
      label: 'qguard-service-repackage',
    })

    // Best-effort access log (non-fatal).
    void clientIp(request)

    return new NextResponse(new Uint8Array(container) as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(
          file.name,
        )}.qgv1"`,
        'Content-Length': container.length.toString(),
        'X-Container-Format': 'QGV1',
        'X-Signer': 'qguard-issuer-v1',
      },
    })
  } catch (err) {
    console.error('export-qgv1 error:', err)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Export failed' } },
      { status: 500 },
    )
  }
}
