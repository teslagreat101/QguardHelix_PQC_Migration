import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import {
  logFolderCreated,
  logFolderRenamed,
  logFolderMoved,
  logFolderDeleted,
  checkRateLimit,
  logRateLimited,
} from '@/lib/vault/audit-service'

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined
}

const MAX_FOLDER_DEPTH = 10
const MAX_FOLDER_NAME_LENGTH = 255

function validateFolderName(name: unknown): string | null {
  if (typeof name !== 'string') return 'Folder name is required'
  const trimmed = name.trim()
  if (trimmed.length === 0) return 'Folder name cannot be empty'
  if (trimmed.length > MAX_FOLDER_NAME_LENGTH) return `Folder name cannot exceed ${MAX_FOLDER_NAME_LENGTH} characters`
  if (trimmed.includes('/') || trimmed.includes('\\')) return 'Folder name cannot contain path separators'
  return null
}

/**
 * Compute the depth of a folder by traversing its parent chain.
 * Returns the depth (0 = root level folder, 1 = child of root folder, etc.)
 */
async function getFolderDepth(
  folderId: string,
  userId: string,
  client: ReturnType<typeof createAuthClient>
): Promise<number> {
  if (!client) return 0
  let depth = 0
  let currentId: string | null = folderId

  while (currentId) {
    const { data }: { data: { parent_id: string | null } | null } = await client
      .from('vault_folders')
      .select('parent_id')
      .eq('id', currentId)
      .eq('user_id', userId)
      .single()

    if (!data) break
    currentId = data.parent_id
    depth++
  }

  return depth
}

/**
 * Build the breadcrumb chain from a folder up to root.
 * Returns array from root to current: [{ id, name }, ...]
 */
async function getBreadcrumbs(
  folderId: string | null,
  userId: string,
  client: ReturnType<typeof createAuthClient>
): Promise<{ id: string; name: string }[]> {
  if (!client || !folderId) return []

  const crumbs: { id: string; name: string }[] = []
  let currentId: string | null = folderId

  while (currentId) {
    const { data }: { data: { id: string; name: string; parent_id: string | null } | null } = await client
      .from('vault_folders')
      .select('id, name, parent_id')
      .eq('id', currentId)
      .eq('user_id', userId)
      .single()

    if (!data) break
    crumbs.unshift({ id: data.id, name: data.name })
    currentId = data.parent_id
  }

  return crumbs
}

/**
 * Check if targetId is a descendant of ancestorId.
 * Used to prevent circular folder moves.
 */
async function isDescendant(
  targetId: string,
  ancestorId: string,
  userId: string,
  client: ReturnType<typeof createAuthClient>
): Promise<boolean> {
  if (!client) return false
  let currentId: string | null = targetId

  while (currentId) {
    if (currentId === ancestorId) return true
    const { data }: { data: { parent_id: string | null } | null } = await client
      .from('vault_folders')
      .select('parent_id')
      .eq('id', currentId)
      .eq('user_id', userId)
      .single()

    if (!data) break
    currentId = data.parent_id
  }

  return false
}

// ─── GET: List folder contents ────────────────────────────────

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
    const parentId = searchParams.get('parent_id') || null

    // If parent_id is provided, verify ownership
    if (parentId) {
      const { data: parentFolder } = await client
        .from('vault_folders')
        .select('id, name')
        .eq('id', parentId)
        .eq('user_id', user.id)
        .single()

      if (!parentFolder) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Folder not found' } },
          { status: 404 }
        )
      }
    }

    // Fetch subfolders at this level
    let foldersQuery = client
      .from('vault_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (parentId) {
      foldersQuery = foldersQuery.eq('parent_id', parentId)
    } else {
      foldersQuery = foldersQuery.is('parent_id', null)
    }

    const { data: folders, error: foldersError } = await foldersQuery

    if (foldersError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to load folders: ${foldersError.message}` } },
        { status: 500 }
      )
    }

    // Fetch files at this level
    let filesQuery = client
      .from('vault_files')
      .select('*')
      .eq('user_id', user.id)
      .order('uploaded_at', { ascending: false })

    if (parentId) {
      filesQuery = filesQuery.eq('folder_id', parentId)
    } else {
      filesQuery = filesQuery.is('folder_id', null)
    }

    const { data: files, error: filesError } = await filesQuery

    if (filesError) {
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to load files: ${filesError.message}` } },
        { status: 500 }
      )
    }

    // Get item counts for each folder (subfolders + files inside)
    const folderList = (folders || []).map((f) => ({ ...f, item_count: 0 }))
    for (const folder of folderList) {
      const [{ count: subfolderCount }, { count: fileCount }] = await Promise.all([
        client
          .from('vault_folders')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('parent_id', folder.id),
        client
          .from('vault_files')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('folder_id', folder.id),
      ])
      folder.item_count = (subfolderCount || 0) + (fileCount || 0)
    }

    // Build breadcrumbs
    const breadcrumbs = await getBreadcrumbs(parentId, user.id, client)

    // Current folder info
    let currentFolder: { id: string; name: string } | null = null
    if (parentId && breadcrumbs.length > 0) {
      currentFolder = breadcrumbs[breadcrumbs.length - 1]
    }

    return NextResponse.json({
      data: {
        folders: folderList,
        files: files || [],
        breadcrumbs,
        current_folder: currentFolder,
      },
    })
  } catch (err) {
    console.error('Vault folders error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to fetch folder contents' } },
      { status: 500 }
    )
  }
}

// ─── POST: Create folder ──────────────────────────────────────

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

    // Rate limit
    const allowed = await checkRateLimit(user.id, 'upload', client)
    if (!allowed) {
      await logRateLimited(user.id, 'folder_create', ip, client)
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Try again later.' } },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, parent_id } = body as { name: unknown; parent_id: unknown }

    // Validate name
    const nameError = validateFolderName(name)
    if (nameError) {
      return NextResponse.json(
        { error: { code: 'INVALID_NAME', message: nameError } },
        { status: 400 }
      )
    }

    const trimmedName = (name as string).trim()
    const parentId = (typeof parent_id === 'string' && parent_id) ? parent_id : null

    // Verify parent folder ownership and depth
    if (parentId) {
      const { data: parentFolder } = await client
        .from('vault_folders')
        .select('id')
        .eq('id', parentId)
        .eq('user_id', user.id)
        .single()

      if (!parentFolder) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Parent folder not found' } },
          { status: 404 }
        )
      }

      // Check depth limit
      const depth = await getFolderDepth(parentId, user.id, client)
      if (depth >= MAX_FOLDER_DEPTH) {
        return NextResponse.json(
          { error: { code: 'DEPTH_LIMIT', message: `Maximum folder depth of ${MAX_FOLDER_DEPTH} exceeded` } },
          { status: 400 }
        )
      }
    }

    // Insert folder (unique constraint handles duplicate names at DB level)
    const { data: folder, error: insertError } = await client
      .from('vault_folders')
      .insert({
        user_id: user.id,
        name: trimmedName,
        parent_id: parentId,
      })
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_NAME', message: 'A folder with this name already exists at this level' } },
          { status: 409 }
        )
      }
      console.error('Folder insert error:', insertError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to create folder: ${insertError.message}` } },
        { status: 500 }
      )
    }

    // Audit log (best-effort)
    try {
      await logFolderCreated(user.id, folder.id, trimmedName, parentId, ip, client)
    } catch {
      // Non-critical
    }

    return NextResponse.json({ data: folder })
  } catch (err) {
    console.error('Vault folder create error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to create folder' } },
      { status: 500 }
    )
  }
}

// ─── PATCH: Rename or move folder ─────────────────────────────

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

    const ip = getClientIp(request)
    const body = await request.json()
    const { id, name, parent_id } = body as {
      id: unknown
      name?: unknown
      parent_id?: unknown
    }

    if (typeof id !== 'string' || !id) {
      return NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'Folder ID is required' } },
        { status: 400 }
      )
    }

    // Verify ownership of the folder being modified
    const { data: folder } = await client
      .from('vault_folders')
      .select('id, name, parent_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!folder) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Folder not found' } },
        { status: 404 }
      )
    }

    const updates: Record<string, unknown> = {}

    // Handle rename
    if (name !== undefined) {
      const nameError = validateFolderName(name)
      if (nameError) {
        return NextResponse.json(
          { error: { code: 'INVALID_NAME', message: nameError } },
          { status: 400 }
        )
      }
      updates.name = (name as string).trim()
    }

    // Handle move
    const isMoving = parent_id !== undefined
    if (isMoving) {
      const newParentId = (typeof parent_id === 'string' && parent_id) ? parent_id : null

      // Cannot move folder into itself
      if (newParentId === id) {
        return NextResponse.json(
          { error: { code: 'INVALID_MOVE', message: 'Cannot move folder into itself' } },
          { status: 400 }
        )
      }

      // Verify new parent ownership (if not root)
      if (newParentId) {
        const { data: newParent } = await client
          .from('vault_folders')
          .select('id')
          .eq('id', newParentId)
          .eq('user_id', user.id)
          .single()

        if (!newParent) {
          return NextResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Destination folder not found' } },
            { status: 404 }
          )
        }

        // Circular reference check: new parent cannot be a descendant of this folder
        const circular = await isDescendant(newParentId, id, user.id, client)
        if (circular) {
          return NextResponse.json(
            { error: { code: 'CIRCULAR_MOVE', message: 'Cannot move folder into its own subfolder' } },
            { status: 400 }
          )
        }

        // Depth check: compute depth of new parent + 1 (for this folder) + max subtree depth
        const newParentDepth = await getFolderDepth(newParentId, user.id, client)
        if (newParentDepth + 1 >= MAX_FOLDER_DEPTH) {
          return NextResponse.json(
            { error: { code: 'DEPTH_LIMIT', message: `Maximum folder depth of ${MAX_FOLDER_DEPTH} exceeded` } },
            { status: 400 }
          )
        }
      }

      updates.parent_id = newParentId
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_CHANGES', message: 'No changes specified' } },
        { status: 400 }
      )
    }

    const { data: updated, error: updateError } = await client
      .from('vault_folders')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_NAME', message: 'A folder with this name already exists at this level' } },
          { status: 409 }
        )
      }
      console.error('Folder update error:', updateError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to update folder: ${updateError.message}` } },
        { status: 500 }
      )
    }

    // Audit logs (best-effort)
    try {
      if (updates.name && updates.name !== folder.name) {
        await logFolderRenamed(user.id, id, folder.name, updates.name as string, ip, client)
      }
      if (isMoving) {
        await logFolderMoved(user.id, id, updated.name, updates.parent_id as string | null, ip, client)
      }
    } catch {
      // Non-critical
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('Vault folder update error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to update folder' } },
      { status: 500 }
    )
  }
}

// ─── DELETE: Delete folder (cascades to subfolders) ───────────

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
    const folderId = searchParams.get('id')
    if (!folderId) {
      return NextResponse.json(
        { error: { code: 'MISSING_ID', message: 'Folder ID required' } },
        { status: 400 }
      )
    }

    // Verify ownership
    const { data: folder } = await client
      .from('vault_folders')
      .select('id, name, user_id')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .single()

    if (!folder) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Folder not found' } },
        { status: 404 }
      )
    }

    // Delete folder (cascades to subfolders via ON DELETE CASCADE;
    // files get folder_id set to NULL via ON DELETE SET NULL)
    const { error: deleteError } = await client
      .from('vault_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Folder delete error:', deleteError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: `Failed to delete folder: ${deleteError.message}` } },
        { status: 500 }
      )
    }

    const ip = getClientIp(request)
    try {
      await logFolderDeleted(user.id, folderId, folder.name, ip, client)
    } catch {
      // Non-critical
    }

    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    console.error('Vault folder delete error:', err)
    return NextResponse.json(
      { error: { code: 'VAULT_ERROR', message: 'Failed to delete folder' } },
      { status: 500 }
    )
  }
}
