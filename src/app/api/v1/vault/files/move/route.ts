import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { logFileMoved } from '@/lib/vault/audit-service'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
}

// ─── PATCH: Move file to a folder ─────────────────────────────

export async function PATCH(request: NextRequest) {
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
    const { fileId, folder_id } = body as { fileId: unknown; folder_id: unknown }

    if (typeof fileId !== 'string' || !fileId) {
      return NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'File ID is required' } },
        { status: 400 }
      )
    }

    const targetFolderId = (typeof folder_id === 'string' && folder_id) ? folder_id : null

    // Verify file ownership
    const { data: file } = await client
      .from('vault_files')
      .select('id, name, user_id, folder_id')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single()

    if (!file) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'File not found' } },
        { status: 404 }
      )
    }

    // Verify target folder ownership (if not moving to root)
    if (targetFolderId) {
      const { data: folder } = await client
        .from('vault_folders')
        .select('id')
        .eq('id', targetFolderId)
        .eq('user_id', user.id)
        .single()

      if (!folder) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Destination folder not found' } },
          { status: 404 }
        )
      }
    }

    // Move the file
    const { data: updated, error: updateError } = await client
      .from('vault_files')
      .update({ folder_id: targetFolderId })
      .eq('id', fileId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('File move error:', updateError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to move file: ${updateError.message}` } },
        { status: 500 }
      )
    }

    // Audit log (best-effort)
    const ip = getClientIp(request)
    try {
      await logFileMoved(user.id, fileId, file.name, targetFolderId, ip, client)
    } catch {
      // Non-critical
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('Vault file move error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to move file' } },
      { status: 500 }
    )
  }
}
