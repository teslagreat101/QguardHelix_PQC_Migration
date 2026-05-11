import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import {
  logFileUpload,
  logFileDeleted,
  checkRateLimit,
  logRateLimited,
} from '@/lib/vault/audit-service'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
}

// ─── GET: List vault files and stats ───────────────────────

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

    const { searchParams } = new URL(request.url)
    const folderIdParam = searchParams.get('folder_id')

    let filesQuery = client
      .from('vault_files')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })

    // If folder_id param is present, filter by it. 'root' means root level only.
    if (folderIdParam && folderIdParam !== 'root') {
      filesQuery = filesQuery.eq('folder_id', folderIdParam)
    } else if (folderIdParam === 'root') {
      filesQuery = filesQuery.is('folder_id', null)
    }
    // If no folder_id param at all, return ALL files (backward compatible)

    const { data: files, error: filesError } = await filesQuery

    if (filesError) {
      console.error('Vault files DB error:', filesError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to load vault files: ${filesError.message}` } },
        { status: 500 }
      )
    }

    const fileList = files || []
    const stats = {
      totalFiles: fileList.length,
      usedStorage: fileList.reduce((sum: number, f: Record<string, unknown>) => sum + (f.size as number), 0),
      maxStorage: 104857600,
      encryptedFiles: fileList.filter((f: Record<string, unknown>) => f.is_locked).length,
      sharedFiles: fileList.filter((f: Record<string, unknown>) => {
        const sw = f.shared_with as string[] | undefined
        return sw && sw.length > 0
      }).length,
    }

    return NextResponse.json({ data: { files: fileList, stats } })
  } catch (err) {
    console.error('Vault error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to fetch vault data' } },
      { status: 500 }
    )
  }
}

// ─── POST: Upload file (plain, unencrypted) ────────────────

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
      await logRateLimited(user.id, 'upload', ip, client)
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Upload rate limit exceeded. Try again later.' } },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const metadataRaw = formData.get('metadata') as string | null

    if (!file) {
      return NextResponse.json(
        { error: { code: 'NO_FILE', message: 'No file provided' } },
        { status: 400 }
      )
    }

    // Enforce size limit before reading into memory to prevent DoS
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: 'FILE_TOO_LARGE', message: 'File exceeds the 50 MB upload limit' } },
        { status: 413 }
      )
    }

    // Parse ZK metadata if present
    let zkMeta: {
      zk_mode: boolean
      original_name: string
      original_size: number
      mime_type: string
      kem_ciphertext: string
      aes_nonce: string
      integrity_hash: string
      signature?: string
      signed_metadata?: string
      encryption_algorithm: string
    } | null = null

    if (metadataRaw) {
      try {
        const parsed = JSON.parse(metadataRaw)
        if (parsed.zk_mode) zkMeta = parsed
      } catch {
        // Not ZK mode, treat as normal upload
      }
    }

    // Parse folder_id from form data
    const folderIdRaw = formData.get('folder_id') as string | null
    const folderId = folderIdRaw && folderIdRaw.trim() ? folderIdRaw.trim() : null

    // Verify folder ownership if folder_id is provided
    if (folderId) {
      const { data: folder } = await client
        .from('vault_folders')
        .select('id')
        .eq('id', folderId)
        .eq('user_id', user.id)
        .single()

      if (!folder) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Destination folder not found or access denied' } },
          { status: 404 }
        )
      }
    }

    const fileBuffer = await file.arrayBuffer()

    // Upload file to Supabase Storage (encrypted blob for ZK, raw for legacy)
    const fileName = zkMeta ? zkMeta.original_name : file.name
    const storagePath = `${user.id}/${crypto.randomUUID()}-${fileName}${zkMeta ? '.enc' : ''}`

    const { error: uploadError } = await client.storage
      .from('vault-files')
      .upload(storagePath, fileBuffer, {
        contentType: zkMeta ? 'application/octet-stream' : (file.type || 'application/octet-stream'),
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: { code: 'UPLOAD_ERROR', message: `Failed to upload file: ${uploadError.message}` } },
        { status: 500 }
      )
    }

    // Store metadata
    const insertData = zkMeta
      ? {
          // ZK mode: file is already encrypted client-side
          user_id: user.id,
          name: zkMeta.original_name,
          size: file.size,
          original_size: zkMeta.original_size,
          mime_type: zkMeta.mime_type,
          encryption_algorithm: zkMeta.encryption_algorithm,
          storage_path: storagePath,
          kem_ciphertext: zkMeta.kem_ciphertext,
          aes_nonce: zkMeta.aes_nonce,
          integrity_hash: zkMeta.integrity_hash,
          signature: zkMeta.signature || null,
          signed_metadata: zkMeta.signed_metadata || null,
          is_locked: true,
          folder_id: folderId,
        }
      : {
          // Legacy mode: plain upload, not yet encrypted
          user_id: user.id,
          name: file.name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
          encryption_algorithm: 'NONE',
          storage_path: storagePath,
          is_locked: false,
          folder_id: folderId,
        }

    const { data: vaultFile, error: dbError } = await client
      .from('vault_files')
      .insert(insertData)
      .select()
      .single()

    if (dbError) {
      console.error('DB insert error:', dbError)
      await client.storage.from('vault-files').remove([storagePath])
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to save file metadata: ${dbError.message}` } },
        { status: 500 }
      )
    }

    // Audit log (best-effort)
    try {
      await logFileUpload(user.id, vaultFile.id, fileName, ip, client)
    } catch {
      // Non-critical
    }

    // Update storage used (best-effort)
    try {
      const { data: profile } = await client
        .from('profiles')
        .select('vault_storage_used')
        .eq('id', user.id)
        .single()
      if (profile) {
        await client
          .from('profiles')
          .update({ vault_storage_used: (profile.vault_storage_used || 0) + file.size })
          .eq('id', user.id)
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({ data: vaultFile })
  } catch (err) {
    console.error('Vault upload error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to upload file' } },
      { status: 500 }
    )
  }
}

// ─── DELETE: Delete vault file ─────────────────────────────

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('id')
    if (!fileId) {
      return NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'File ID required' } },
        { status: 400 }
      )
    }

    const { data: file } = await client
      .from('vault_files')
      .select('storage_path, name, size, user_id')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single()

    if (!file) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'File not found or access denied' } },
        { status: 404 }
      )
    }

    if (file.storage_path) {
      await client.storage.from('vault-files').remove([file.storage_path])
    }

    await client.from('vault_files').delete().eq('id', fileId).eq('user_id', user.id)

    const ip = getClientIp(request)
    try {
      await logFileDeleted(user.id, fileId, file.name, ip, client)
    } catch {
      // Non-critical
    }

    try {
      const { data: profile } = await client
        .from('profiles')
        .select('vault_storage_used')
        .eq('id', user.id)
        .single()
      if (profile) {
        await client
          .from('profiles')
          .update({ vault_storage_used: Math.max(0, (profile.vault_storage_used || 0) - file.size) })
          .eq('id', user.id)
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    console.error('Vault delete error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to delete file' } },
      { status: 500 }
    )
  }
}
