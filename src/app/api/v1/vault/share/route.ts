import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
}

// ─── POST: Create a shared link ─────────────────────────────

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
      fileId,
      encryptedPayload,
      iv,
      integrityHash,
      originalFilename,
      originalSize,
      mimeType,
      expiresIn,       // seconds from now (optional)
      maxDownloads,    // integer (optional)
      isPasswordProtected,
      passwordSalt,
      passwordHash,
    } = body

    // Validate required fields
    if (!fileId || !encryptedPayload || !iv || !integrityHash || !originalFilename || !originalSize) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      )
    }

    // Verify the user owns the file
    const { data: file } = await client
      .from('vault_files')
      .select('id, user_id')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single()

    if (!file) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'File not found or access denied' } },
        { status: 404 }
      )
    }

    // Calculate expiration
    let expiresAt: string | null = null
    if (expiresIn && typeof expiresIn === 'number' && expiresIn > 0) {
      expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    }

    // Validate payload size (max 50 MB base64 ≈ ~37 MB raw)
    if (encryptedPayload.length > 70_000_000) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Encrypted payload exceeds size limit' } },
        { status: 413 }
      )
    }

    // Insert shared link
    const insertData: Record<string, unknown> = {
      file_id: fileId,
      owner_id: user.id,
      encrypted_payload: encryptedPayload,
      iv,
      integrity_hash: integrityHash,
      original_filename: originalFilename,
      original_size: originalSize,
      mime_type: mimeType || 'application/octet-stream',
      expires_at: expiresAt,
      max_downloads: maxDownloads && typeof maxDownloads === 'number' ? maxDownloads : null,
      is_password_protected: !!isPasswordProtected,
      password_salt: isPasswordProtected ? passwordSalt : null,
      password_hash: isPasswordProtected ? passwordHash : null,
    }

    const { data: link, error: dbError } = await client
      .from('vault_shared_links')
      .insert(insertData)
      .select('id, file_id, expires_at, max_downloads, is_password_protected, created_at')
      .single()

    if (dbError) {
      console.error('Share link creation error:', dbError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to create shared link' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: link }, { status: 201 })
  } catch (err) {
    console.error('Share creation error:', err)
    return NextResponse.json(
      { error: { code: 'SHARE_ERROR', message: 'Failed to create shared link' } },
      { status: 500 }
    )
  }
}

// ─── GET: List shared links for current user ────────────────

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

    const { data: links } = await client
      .from('vault_shared_links')
      .select('id, file_id, original_filename, original_size, mime_type, expires_at, max_downloads, download_count, is_revoked, is_password_protected, is_destroyed, failed_password_attempts, created_at, last_accessed_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ data: { links: links || [] } })
  } catch (err) {
    console.error('Share list error:', err)
    return NextResponse.json(
      { error: { code: 'SHARE_ERROR', message: 'Failed to fetch shared links' } },
      { status: 500 }
    )
  }
}

// ─── DELETE: Revoke a shared link ───────────────────────────

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
    const linkId = searchParams.get('id')
    const action = searchParams.get('action') // 'revoke' or 'delete'

    if (!linkId) {
      return NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'Link ID required' } },
        { status: 400 }
      )
    }

    if (action === 'revoke') {
      // Soft revoke — mark as revoked but keep metadata for audit
      const { error } = await client
        .from('vault_shared_links')
        .update({ is_revoked: true })
        .eq('id', linkId)
        .eq('owner_id', user.id)

      if (error) {
        return NextResponse.json(
          { error: { code: 'REVOKE_ERROR', message: 'Failed to revoke link' } },
          { status: 500 }
        )
      }

      return NextResponse.json({ data: { revoked: true } })
    } else {
      // Hard delete
      const { error } = await client
        .from('vault_shared_links')
        .delete()
        .eq('id', linkId)
        .eq('owner_id', user.id)

      if (error) {
        return NextResponse.json(
          { error: { code: 'DELETE_ERROR', message: 'Failed to delete link' } },
          { status: 500 }
        )
      }

      return NextResponse.json({ data: { deleted: true } })
    }
  } catch (err) {
    console.error('Share delete error:', err)
    return NextResponse.json(
      { error: { code: 'SHARE_ERROR', message: 'Failed to modify shared link' } },
      { status: 500 }
    )
  }
}
