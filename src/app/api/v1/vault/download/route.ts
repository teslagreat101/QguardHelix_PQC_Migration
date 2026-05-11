import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { logAccess } from '@/lib/vault/audit-service'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
}

/**
 * POST /api/v1/vault/download
 *
 * Downloads the raw encrypted file blob without decrypting.
 * Allows users to save the encrypted file to their local machine
 * for offline quantum-safe storage.
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

    if (!file.storage_path) {
      return NextResponse.json(
        { error: { code: 'NO_STORAGE', message: 'File storage path not found' } },
        { status: 404 }
      )
    }

    // Download the file blob from storage (encrypted or plain)
    const { data: fileBlob, error: downloadError } = await client.storage
      .from('vault-files')
      .download(file.storage_path)

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: { code: 'DOWNLOAD_ERROR', message: 'Failed to retrieve file' } },
        { status: 500 }
      )
    }

    const blobData = await fileBlob.arrayBuffer()

    // Audit log
    try {
      await logAccess({
        userId: user.id,
        fileId,
        operation: 'download',
        status: 'success',
        ipAddress: ip,
        client,
      })
    } catch {
      // Non-critical
    }

    // Determine filename
    const downloadName = file.is_locked
      ? `${file.name}.qguard.enc`
      : file.name

    return new NextResponse(blobData, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadName)}"`,
        'Content-Length': blobData.byteLength.toString(),
        'X-Encrypted': file.is_locked ? 'true' : 'false',
        'X-Encryption-Algorithm': file.encryption_algorithm || 'NONE',
        'X-Integrity-Hash': file.integrity_hash || '',
      },
    })
  } catch (err) {
    console.error('Vault download error:', err)
    return NextResponse.json(
      { error: { code: 'DOWNLOAD_ERROR', message: 'Failed to download file' } },
      { status: 500 }
    )
  }
}
