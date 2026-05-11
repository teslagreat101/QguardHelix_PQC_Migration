/**
 * Quantum Vault — Enhanced Supabase Service Layer
 * Production-grade implementation with error handling, retries, and real-time support
 */

import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Types ─────────────────────────────────────────────────

export interface VaultFileRecord {
  id: string
  user_id: string
  folder_id: string | null
  original_filename: string
  encrypted_filename: string | null
  mime_type: string
  original_size: number
  encrypted_size: number | null
  storage_path: string | null
  storage_bucket: string | null
  encryption_status: string
  encryption_algorithm: string
  kem_ciphertext: string | null
  aes_nonce: string | null
  aes_auth_tag: string | null
  content_hash: string | null
  encrypted_content_hash: string | null
  encryption_key_id: string | null
  signature: string | null
  signing_key_id: string | null
  signature_status: string
  is_deleted: boolean
  version: number
  is_latest: boolean
  processing_status: string
  error_message: string | null
  uploaded_at: string
  encrypted_at: string | null
  created_at: string
  updated_at: string
}

export interface VaultFolderRecord {
  id: string
  user_id: string
  name: string
  parent_id: string | null
  path: string
  depth: number
  is_encrypted: boolean
  is_deleted: boolean
  file_count: number
  total_size: number
  created_at: string
  updated_at: string
}

export interface VaultKeyRecord {
  id: string
  user_id: string
  key_type: string
  algorithm: string
  fingerprint: string
  public_key_hex: string | null
  status: string
  version: number
  is_active: boolean
  expires_at: string | null
  last_used_at: string | null
  created_at: string
}

export interface VaultSharedLinkRecord {
  id: string
  user_id: string
  file_id: string | null
  token: string
  permissions: string[]
  is_password_protected: boolean
  max_downloads: number | null
  download_count: number
  is_one_time: boolean
  is_revoked: boolean
  is_destroyed: boolean
  original_filename: string | null
  original_size: number | null
  mime_type: string | null
  expires_at: string | null
  last_accessed_at: string | null
  created_at: string
}

export interface VaultAuditRecord {
  id: string
  user_id: string
  event_type: string
  severity: string
  result: string
  resource_type: string | null
  resource_id: string | null
  description: string | null
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface VaultProfile {
  id: string
  user_id: string
  display_name: string | null
  storage_used: number
  storage_quota: number
  storage_warning_sent: boolean
  file_count: number
  folder_count: number
  encrypted_file_count: number
  vault_created: boolean
  vault_locked: boolean
  vault_unlocked_at: string | null
  last_vault_activity: string | null
  kdf_algorithm: string
  auto_lock_minutes: number
  max_failed_attempts: number
  created_at: string
  updated_at: string
}

export interface VaultStats {
  profile: VaultProfile | null
  fileCount: number
  encryptedCount: number
  activeKeyCount: number
  activeLinkCount: number
  storageUsed: number
  storageQuota: number
  storagePercent: number
}

// ─── Mapped types for the UI ──────────────────────────────

export interface VaultFileEntry {
  id: string
  name: string
  size: number
  original_size: number | null
  mime_type: string
  encryption_algorithm: string
  uploaded_at: string
  shared_with: string[]
  is_locked: boolean
  integrity_hash: string | null
  signature: string | null
  encryption_key_id: string | null
  signing_key_id: string | null
  kem_ciphertext: string | null
  aes_nonce: string | null
  aes_auth_tag: string | null
  folder_id: string | null
  processing_status: string
  encryption_status: string
}

export interface VaultKeyEntry {
  id: string
  keyType: string
  algorithm: string
  fingerprint: string
  isActive: boolean
  version: number
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
}

export interface AuditEventEntry {
  id: string
  event_type: string
  severity: string
  resource_type: string
  resource_id: string | null
  description: string
  created_at: string
  ip_address: string | null
}

export interface SharedLinkEntry {
  id: string
  file_id: string
  original_filename: string
  original_size: number
  mime_type: string
  expires_at: string | null
  max_downloads: number | null
  download_count: number
  is_revoked: boolean
  is_password_protected: boolean
  is_destroyed: boolean
  failed_password_attempts: number
  created_at: string
  last_accessed_at: string | null
  permissions: string[]
}

// ─── Mappers ───────────────────────────────────────────────

function mapFileToEntry(f: VaultFileRecord): VaultFileEntry {
  return {
    id: f.id,
    name: f.original_filename,
    size: f.encrypted_size ?? f.original_size,
    original_size: f.original_size,
    mime_type: f.mime_type,
    encryption_algorithm: f.encryption_algorithm || 'none',
    uploaded_at: f.uploaded_at || f.created_at,
    shared_with: [],
    is_locked: f.encryption_status === 'encrypted',
    integrity_hash: f.content_hash,
    signature: f.signature,
    encryption_key_id: f.encryption_key_id,
    signing_key_id: f.signing_key_id,
    kem_ciphertext: f.kem_ciphertext,
    aes_nonce: f.aes_nonce,
    aes_auth_tag: f.aes_auth_tag,
    folder_id: f.folder_id,
    processing_status: f.processing_status,
    encryption_status: f.encryption_status,
  }
}

function mapKeyToEntry(k: VaultKeyRecord): VaultKeyEntry {
  return {
    id: k.id,
    keyType: k.key_type,
    algorithm: k.algorithm,
    fingerprint: k.fingerprint,
    isActive: k.is_active,
    version: k.version,
    expiresAt: k.expires_at,
    lastUsedAt: k.last_used_at,
    createdAt: k.created_at,
  }
}

function mapAuditToEntry(a: VaultAuditRecord): AuditEventEntry {
  return {
    id: a.id,
    event_type: a.event_type,
    severity: a.severity,
    resource_type: a.resource_type || 'system',
    resource_id: a.resource_id,
    description: a.description || '',
    created_at: a.created_at,
    ip_address: a.ip_address,
  }
}

function mapSharedLink(l: VaultSharedLinkRecord): SharedLinkEntry {
  return {
    id: l.id,
    file_id: l.file_id || '',
    original_filename: l.original_filename || 'Unknown',
    original_size: l.original_size || 0,
    mime_type: l.mime_type || 'application/octet-stream',
    expires_at: l.expires_at,
    max_downloads: l.max_downloads,
    download_count: l.download_count,
    is_revoked: l.is_revoked,
    is_password_protected: l.is_password_protected,
    is_destroyed: l.is_destroyed,
    failed_password_attempts: 0, // Will be populated from metadata
    created_at: l.created_at,
    last_accessed_at: l.last_accessed_at,
    permissions: l.permissions || ['view', 'download'],
  }
}

// ─── Error Handling Utilities ────────────────────────────

class VaultError extends Error {
  code: string
  status?: number

  constructor(message: string, code: string, status?: number) {
    super(message)
    this.name = 'VaultError'
    this.code = code
    this.status = status
  }
}

function handleSupabaseError(error: unknown, operation: string): never {
  if (error instanceof VaultError) throw error

  const err = error as { message?: string; code?: string; status?: number }
  const message = err.message || 'Unknown error'
  const code = err.code || 'UNKNOWN'
  const status = err.status

  // Categorize errors
  if (code === 'PGRST116' || message.includes('0 rows')) {
    throw new VaultError(
      `No data found for ${operation}`,
      'NOT_FOUND',
      404
    )
  }

  if (code === '23505' || message.includes('duplicate')) {
    throw new VaultError(
      `Duplicate entry during ${operation}`,
      'DUPLICATE',
      409
    )
  }

  if (code === '42501' || message.includes('permission denied') || message.includes('violates row-level security')) {
    throw new VaultError(
      'Permission denied. Please check your authentication.',
      'PERMISSION_DENIED',
      403
    )
  }

  if (code === 'PGRST301' || message.includes('JWT')) {
    throw new VaultError(
      'Authentication failed. Please sign in again.',
      'AUTH_ERROR',
      401
    )
  }

  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    throw new VaultError(
      'Network connection failed. Please check your internet connection.',
      'NETWORK_ERROR',
      503
    )
  }

  // Default error
  throw new VaultError(
    `${operation} failed: ${message}`,
    code,
    status
  )
}

// ─── Retry Utility ───────────────────────────────────────

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const isRetryable =
        error instanceof VaultError &&
        (error.code === 'NETWORK_ERROR' || error.status === 503 || error.status === 504)

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error
      }

      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)))
    }
  }

  throw lastError
}

// ─── Authentication Check ─────────────────────────────────

async function getAuthenticatedUser() {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new VaultError(
      'Not authenticated. Please sign in to access your vault.',
      'AUTH_REQUIRED',
      401
    )
  }

  return user
}

// ─── Vault Profile ───────────────────────────────────────

export async function ensureVaultProfile(): Promise<VaultProfile> {
  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new VaultError('Not authenticated', 'AUTH_REQUIRED', 401)

    // Try to get existing profile
    const { data: existing, error: fetchError } = await supabase
      .from('vault_user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      handleSupabaseError(fetchError, 'fetching vault profile')
    }

    if (existing) return existing as VaultProfile

    // Create new profile
    const { data: created, error: insertError } = await supabase
      .from('vault_user_profiles')
      .insert({
        user_id: user.id,
        vault_created: true,
        vault_locked: true,
      })
      .select()
      .single()

    if (insertError) {
      handleSupabaseError(insertError, 'creating vault profile')
    }

    // Log the creation
    await logAudit('vault_created', 'info', 'profile', created?.id, 'Vault profile initialized')

    return created as VaultProfile
  })
}

export async function fetchVaultProfile(): Promise<VaultProfile | null> {
  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from('vault_user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      handleSupabaseError(error, 'fetching vault profile')
    }

    return data as VaultProfile
  })
}

// ─── Files ─────────────────────────────────────────────────

export async function fetchVaultFiles(folderId?: string | null): Promise<VaultFileEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    let query = supabase
      .from('vault_files')
      .select('*')
      .eq('is_deleted', false)
      .eq('is_latest', true)
      .order('created_at', { ascending: false })

    if (folderId) {
      query = query.eq('folder_id', folderId)
    } else {
      query = query.is('folder_id', null)
    }

    const { data, error } = await query
    if (error) handleSupabaseError(error, 'fetching files')

    return (data || []).map(mapFileToEntry)
  })
}

export async function fetchAllVaultFiles(): Promise<VaultFileEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_files')
      .select('*')
      .eq('is_deleted', false)
      .eq('is_latest', true)
      .order('uploaded_at', { ascending: false })

    if (error) handleSupabaseError(error, 'fetching all files')

    return (data || []).map(mapFileToEntry)
  })
}

export async function fetchRecentFiles(limit = 10): Promise<VaultFileEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_files')
      .select('*')
      .eq('is_deleted', false)
      .eq('is_latest', true)
      .order('uploaded_at', { ascending: false })
      .limit(limit)

    if (error) handleSupabaseError(error, 'fetching recent files')

    return (data || []).map(mapFileToEntry)
  })
}

export interface UploadVaultFileOptions {
  folderId?: string | null
  encryptionData?: {
    encryptedData: Uint8Array
    kemCiphertext: string
    aesNonce: string
    aesAuthTag?: string
    contentHash: string
    signature?: string
    signingKeyId?: string
  }
  onProgress?: (progress: number) => void
}

export async function uploadVaultFile(
  file: File,
  options: UploadVaultFileOptions = {}
): Promise<VaultFileEntry> {
  const { folderId = null, encryptionData, onProgress } = options

  return withRetry(async () => {
    const user = await getAuthenticatedUser()
    await ensureVaultProfile()

    const fileId = crypto.randomUUID()
    const isEncrypted = !!encryptionData
    const fileExt = isEncrypted ? '.enc' : ''
    const storagePath = `vault/${user.id}/${fileId}/${fileId}${fileExt}`

    // Upload to storage with progress tracking
    const uploadData = isEncrypted ? encryptionData!.encryptedData : await file.arrayBuffer()

    const { error: storageError } = await supabase.storage
      .from('vault-encrypted')
      .upload(storagePath, uploadData, {
        contentType: isEncrypted ? 'application/octet-stream' : file.type,
        upsert: false,
        onUploadProgress: onProgress
          ? (progress) => onProgress(progress.loaded / progress.total)
          : undefined,
      })

    if (storageError) {
      throw new VaultError(
        `Storage upload failed: ${storageError.message}`,
        'STORAGE_ERROR',
        500
      )
    }

    // Create file record
    const fileRecord = {
      id: fileId,
      user_id: user.id,
      folder_id: folderId,
      original_filename: file.name,
      encrypted_filename: isEncrypted ? `${fileId}.enc` : null,
      mime_type: file.type || 'application/octet-stream',
      original_size: file.size,
      encrypted_size: isEncrypted ? encryptionData!.encryptedData.length : null,
      storage_path: storagePath,
      storage_bucket: 'vault-encrypted',
      encryption_status: isEncrypted ? 'encrypted' : 'pending',
      encryption_algorithm: isEncrypted ? 'ML-KEM-768+AES-256-GCM' : 'none',
      kem_ciphertext: encryptionData?.kemCiphertext || null,
      aes_nonce: encryptionData?.aesNonce || null,
      aes_auth_tag: encryptionData?.aesAuthTag || null,
      content_hash: encryptionData?.contentHash || null,
      signature: encryptionData?.signature || null,
      signing_key_id: encryptionData?.signingKeyId || null,
      processing_status: 'complete',
      uploaded_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('vault_files')
      .insert(fileRecord)
      .select()
      .single()

    if (error) {
      // Clean up storage on DB error
      await supabase.storage.from('vault-encrypted').remove([storagePath])
      handleSupabaseError(error, 'creating file record')
    }

    // Log audit
    await logAudit(
      'file_uploaded',
      'info',
      'file',
      data.id,
      `Uploaded ${isEncrypted ? 'encrypted' : 'unencrypted'} file: ${file.name}`
    )

    return mapFileToEntry(data)
  }, 2) // Fewer retries for uploads
}

export async function deleteVaultFile(fileId: string): Promise<void> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    // Get file info before deletion
    const { data: file, error: fetchError } = await supabase
      .from('vault_files')
      .select('original_filename, original_size, encrypted_size')
      .eq('id', fileId)
      .single()

    if (fetchError) handleSupabaseError(fetchError, 'fetching file for deletion')

    // Soft delete
    const { error } = await supabase
      .from('vault_files')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        permanent_delete_after: new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .eq('id', fileId)

    if (error) handleSupabaseError(error, 'deleting file')

    // Log audit
    await logAudit(
      'file_deleted',
      'warning',
      'file',
      fileId,
      `Deleted file: ${file?.original_filename || fileId}`
    )
  })
}

export async function restoreVaultFile(fileId: string): Promise<void> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { error } = await supabase
      .from('vault_files')
      .update({
        is_deleted: false,
        deleted_at: null,
        permanent_delete_after: null,
      })
      .eq('id', fileId)

    if (error) handleSupabaseError(error, 'restoring file')

    await logAudit('file_restored', 'info', 'file', fileId, 'File restored from trash')
  })
}

export async function permanentlyDeleteFile(fileId: string): Promise<void> {
  return withRetry(async () => {
    const user = await getAuthenticatedUser()

    // Get storage path first
    const { data: file, error: fetchError } = await supabase
      .from('vault_files')
      .select('storage_path, original_filename')
      .eq('id', fileId)
      .single()

    if (fetchError) handleSupabaseError(fetchError, 'fetching file for permanent deletion')

    // Delete from storage first
    if (file?.storage_path) {
      await supabase.storage.from('vault-encrypted').remove([file.storage_path])
    }

    // Permanently delete from database
    const { error } = await supabase.from('vault_files').delete().eq('id', fileId)

    if (error) handleSupabaseError(error, 'permanently deleting file')

    await logAudit(
      'file_permanently_deleted',
      'critical',
      'file',
      fileId,
      `Permanently deleted: ${file?.original_filename || fileId}`
    )
  })
}

export async function moveVaultFile(fileId: string, targetFolderId: string | null): Promise<void> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { error } = await supabase
      .from('vault_files')
      .update({ folder_id: targetFolderId, updated_at: new Date().toISOString() })
      .eq('id', fileId)

    if (error) handleSupabaseError(error, 'moving file')

    await logAudit(
      'file_moved',
      'info',
      'file',
      fileId,
      `Moved to folder: ${targetFolderId || 'root'}`
    )
  })
}

export async function renameVaultFile(fileId: string, newName: string): Promise<void> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { error } = await supabase
      .from('vault_files')
      .update({ original_filename: newName, updated_at: new Date().toISOString() })
      .eq('id', fileId)

    if (error) handleSupabaseError(error, 'renaming file')

    await logAudit('file_renamed', 'info', 'file', fileId, `Renamed to: ${newName}`)
  })
}

export async function downloadVaultFile(fileId: string): Promise<{ data: Blob; filename: string; mimeType: string }> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data: file, error: fetchError } = await supabase
      .from('vault_files')
      .select('storage_path, original_filename, mime_type, storage_bucket')
      .eq('id', fileId)
      .single()

    if (fetchError) handleSupabaseError(fetchError, 'fetching file for download')
    if (!file?.storage_path) throw new VaultError('File not found in storage', 'NOT_FOUND', 404)

    const bucket = file.storage_bucket || 'vault-encrypted'
    const { data, error } = await supabase.storage.from(bucket).download(file.storage_path)

    if (error || !data) {
      throw new VaultError(
        `Download failed: ${error?.message || 'Unknown error'}`,
        'DOWNLOAD_ERROR',
        500
      )
    }

    await logAudit('file_downloaded', 'info', 'file', fileId, `Downloaded: ${file.original_filename}`)

    return {
      data,
      filename: file.original_filename || 'download',
      mimeType: file.mime_type || 'application/octet-stream',
    }
  })
}

// ─── Folders ───────────────────────────────────────────────

export async function fetchVaultFolders(parentId: string | null): Promise<VaultFolderRecord[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    let query = supabase
      .from('vault_folders')
      .select('*')
      .eq('is_deleted', false)
      .order('name', { ascending: true })

    if (parentId) {
      query = query.eq('parent_id', parentId)
    } else {
      query = query.is('parent_id', null)
    }

    const { data, error } = await query
    if (error) handleSupabaseError(error, 'fetching folders')

    return (data || []) as VaultFolderRecord[]
  })
}

export async function fetchAllFolders(): Promise<VaultFolderRecord[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_folders')
      .select('*')
      .eq('is_deleted', false)
      .order('path', { ascending: true })

    if (error) handleSupabaseError(error, 'fetching all folders')

    return (data || []) as VaultFolderRecord[]
  })
}

export async function createVaultFolder(name: string, parentId: string | null): Promise<VaultFolderRecord> {
  return withRetry(async () => {
    const user = await getAuthenticatedUser()

    // Calculate depth and path
    let depth = 0
    let path = '/' + name

    if (parentId) {
      const { data: parent, error: parentError } = await supabase
        .from('vault_folders')
        .select('depth, path')
        .eq('id', parentId)
        .single()

      if (parentError) handleSupabaseError(parentError, 'fetching parent folder')

      if (parent) {
        depth = parent.depth + 1
        path = parent.path + '/' + name
      }
    }

    const { data, error } = await supabase
      .from('vault_folders')
      .insert({
        user_id: user.id,
        name,
        parent_id: parentId,
        depth,
        path,
      })
      .select()
      .single()

    if (error) handleSupabaseError(error, 'creating folder')

    await logAudit('folder_created', 'info', 'folder', data.id, `Created folder: ${name}`)

    return data as VaultFolderRecord
  })
}

export async function renameVaultFolder(folderId: string, name: string): Promise<void> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { error } = await supabase
      .from('vault_folders')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', folderId)

    if (error) handleSupabaseError(error, 'renaming folder')

    await logAudit('folder_renamed', 'info', 'folder', folderId, `Renamed to: ${name}`)
  })
}

export async function deleteVaultFolder(folderId: string): Promise<void> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    // Move files to root
    await supabase
      .from('vault_files')
      .update({ folder_id: null, updated_at: new Date().toISOString() })
      .eq('folder_id', folderId)

    // Move sub-folders to root
    await supabase
      .from('vault_folders')
      .update({ parent_id: null, updated_at: new Date().toISOString() })
      .eq('parent_id', folderId)

    // Soft delete
    const { error } = await supabase
      .from('vault_folders')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', folderId)

    if (error) handleSupabaseError(error, 'deleting folder')

    await logAudit('folder_deleted', 'warning', 'folder', folderId, 'Folder moved to trash')
  })
}

export async function getFolderBreadcrumbs(folderId: string | null): Promise<Array<{ id: string; name: string }>> {
  if (!folderId) return []

  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .rpc('vault_folder_path_array', { folder_uuid: folderId })

    if (error) {
      // Fallback if RPC not available
      const breadcrumbs: Array<{ id: string; name: string }> = []
      let currentId: string | null = folderId

      while (currentId) {
        const { data: folder } = await supabase
          .from('vault_folders')
          .select('id, name, parent_id')
          .eq('id', currentId)
          .single()

        if (!folder) break
        breadcrumbs.unshift({ id: folder.id, name: folder.name })
        currentId = folder.parent_id
      }

      return breadcrumbs
    }

    return (data || []) as Array<{ id: string; name: string }>
  })
}

// ─── Keys ──────────────────────────────────────────────────

export async function fetchVaultKeys(): Promise<VaultKeyEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_keys')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) handleSupabaseError(error, 'fetching keys')

    return (data || []).map(mapKeyToEntry)
  })
}

export async function fetchActiveKeys(): Promise<VaultKeyEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_keys')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) handleSupabaseError(error, 'fetching active keys')

    return (data || []).map(mapKeyToEntry)
  })
}

export async function createVaultKey(params: {
  keyType: string
  algorithm: string
  fingerprint: string
  publicKeyHex?: string
  wrappedSecretKey?: string
  wrappingNonce?: string
  deviceId?: string
}): Promise<VaultKeyRecord> {
  return withRetry(async () => {
    const user = await getAuthenticatedUser()

    // Deactivate existing keys of same type
    await supabase
      .from('vault_keys')
      .update({
        is_active: false,
        status: 'rotated',
        rotated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('key_type', params.keyType)
      .eq('is_active', true)

    // Get next version
    const { data: existingKeys } = await supabase
      .from('vault_keys')
      .select('version')
      .eq('user_id', user.id)
      .eq('key_type', params.keyType)
      .order('version', { ascending: false })
      .limit(1)

    const nextVersion = (existingKeys?.[0]?.version || 0) + 1

    const { data, error } = await supabase
      .from('vault_keys')
      .insert({
        user_id: user.id,
        key_type: params.keyType,
        algorithm: params.algorithm,
        fingerprint: params.fingerprint,
        public_key_hex: params.publicKeyHex,
        wrapped_secret_key: params.wrappedSecretKey,
        wrapping_nonce: params.wrappingNonce,
        device_id: params.deviceId,
        is_device_bound: !!params.deviceId,
        version: nextVersion,
        is_active: true,
        status: 'active',
      })
      .select()
      .single()

    if (error) handleSupabaseError(error, 'creating key')

    await logAudit(
      'key_generated',
      'info',
      'key',
      data.id,
      `Generated ${params.keyType} key using ${params.algorithm} (v${nextVersion})`
    )

    return data as VaultKeyRecord
  })
}

export async function revokeVaultKey(keyId: string, reason = 'manual_revocation'): Promise<void> {
  return withRetry(async () => {
    const { data: key, error: fetchError } = await supabase
      .from('vault_keys')
      .select('key_type, algorithm, fingerprint')
      .eq('id', keyId)
      .single()

    if (fetchError) handleSupabaseError(fetchError, 'fetching key for revocation')

    const { error } = await supabase
      .from('vault_keys')
      .update({
        is_active: false,
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revocation_reason: reason,
      })
      .eq('id', keyId)

    if (error) handleSupabaseError(error, 'revoking key')

    await logAudit(
      'key_revoked',
      'warning',
      'key',
      keyId,
      `Revoked ${key?.key_type} key (${key?.algorithm})`
    )
  })
}

export async function updateKeyLastUsed(keyId: string): Promise<void> {
  await supabase
    .from('vault_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyId)
}

// ─── User Keys (ZK wrapped master keys) ────────────────────

export interface UserKeysData {
  wrapped_bundle: string
  enc_public_key: string
  sign_public_key: string
  kdf_salt?: string
  kdf_algorithm?: string
  kdf_params?: Record<string, unknown>
}

export async function fetchUserKeys(): Promise<UserKeysData | null> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_user_keys')
      .select('wrapped_bundle, enc_public_key, sign_public_key, kdf_salt, kdf_algorithm, kdf_params')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      handleSupabaseError(error, 'fetching user keys')
    }

    return data as UserKeysData
  })
}

export async function hasUserKeys(): Promise<boolean> {
  const keys = await fetchUserKeys()
  return !!keys
}

export async function storeUserKeys(
  wrappedBundle: string,
  encPublicKey: string,
  signPublicKey: string,
  kdfMetadata?: {
    salt: string
    algorithm: string
    params: Record<string, unknown>
  }
): Promise<void> {
  return withRetry(async () => {
    const user = await getAuthenticatedUser()

    const { error } = await supabase.from('vault_user_keys').upsert(
      {
        user_id: user.id,
        wrapped_bundle: wrappedBundle,
        enc_public_key: encPublicKey,
        sign_public_key: signPublicKey,
        kdf_salt: kdfMetadata?.salt,
        kdf_algorithm: kdfMetadata?.algorithm || 'Argon2id',
        kdf_params: kdfMetadata?.params || { memory: 65536, iterations: 3, parallelism: 4 },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) handleSupabaseError(error, 'storing user keys')

    // Mark vault as created
    await supabase
      .from('vault_user_profiles')
      .update({ vault_created: true, vault_locked: false })
      .eq('user_id', user.id)

    await logAudit('vault_unlocked', 'info', 'profile', user.id, 'Vault unlocked with passphrase')
  })
}

// ─── Audit Logs ────────────────────────────────────────────

export async function fetchAuditLogs(limit = 50, offset = 0): Promise<AuditEventEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) handleSupabaseError(error, 'fetching audit logs')

    return (data || []).map(mapAuditToEntry)
  })
}

export async function fetchAuditLogsByType(
  eventType: string,
  limit = 50
): Promise<AuditEventEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_audit_logs')
      .select('*')
      .eq('event_type', eventType)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) handleSupabaseError(error, 'fetching audit logs by type')

    return (data || []).map(mapAuditToEntry)
  })
}

export async function logAudit(
  eventType: string,
  severity: string,
  resourceType: string,
  resourceId: string | null = null,
  description: string = '',
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Get client info
    const ipAddress = typeof window !== 'undefined' ? undefined : undefined
    const userAgent = typeof window !== 'undefined' ? navigator.userAgent : undefined

    await supabase.from('vault_audit_logs').insert({
      user_id: user.id,
      event_type: eventType,
      severity,
      resource_type: resourceType,
      resource_id: resourceId,
      description,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: metadata || {},
    })
  } catch {
    // Fail silently - audit logging should not break operations
    console.warn('Failed to log audit event:', eventType)
  }
}

// ─── Shared Links ──────────────────────────────────────────

export async function fetchSharedLinks(): Promise<SharedLinkEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_shared_links')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) handleSupabaseError(error, 'fetching shared links')

    return (data || []).map(mapSharedLink)
  })
}

export async function fetchActiveSharedLinks(): Promise<SharedLinkEntry[]> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_shared_links')
      .select('*')
      .eq('is_revoked', false)
      .eq('is_destroyed', false)
      .or(`expires_at.gt.${new Date().toISOString()},expires_at.is.null`)
      .order('created_at', { ascending: false })

    if (error) handleSupabaseError(error, 'fetching active shared links')

    return (data || []).map(mapSharedLink)
  })
}

export interface CreateSharedLinkParams {
  fileId: string
  originalFilename: string
  originalSize: number
  mimeType: string
  encryptedFileData?: Uint8Array
  encryptionMetadata?: Record<string, unknown>
  isPasswordProtected?: boolean
  passwordHash?: string
  passwordHint?: string
  maxDownloads?: number
  expiresAt?: string
  isOneTime?: boolean
  permissions?: string[]
}

export async function createSharedLink(params: CreateSharedLinkParams): Promise<VaultSharedLinkRecord> {
  return withRetry(async () => {
    const user = await getAuthenticatedUser()

    const { data, error } = await supabase
      .from('vault_shared_links')
      .insert({
        user_id: user.id,
        file_id: params.fileId,
        original_filename: params.originalFilename,
        original_size: params.originalSize,
        mime_type: params.mimeType,
        encrypted_file_data: params.encryptedFileData,
        encryption_metadata: params.encryptionMetadata,
        is_password_protected: params.isPasswordProtected || false,
        password_hash: params.passwordHash,
        password_hint: params.passwordHint,
        max_downloads: params.maxDownloads,
        expires_at: params.expiresAt,
        is_one_time: params.isOneTime || false,
        permissions: params.permissions || ['view', 'download'],
      })
      .select()
      .single()

    if (error) handleSupabaseError(error, 'creating shared link')

    await logAudit(
      'share_created',
      'info',
      'share_link',
      data.id,
      `Created share link for: ${params.originalFilename}`
    )

    return data as VaultSharedLinkRecord
  })
}

export async function revokeSharedLink(linkId: string): Promise<void> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { error } = await supabase
      .from('vault_shared_links')
      .update({
        is_revoked: true,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', linkId)

    if (error) handleSupabaseError(error, 'revoking shared link')

    await logAudit('share_revoked', 'info', 'share_link', linkId, 'Revoked share link')
  })
}

export async function deleteSharedLink(linkId: string): Promise<void> {
  return withRetry(async () => {
    await getAuthenticatedUser()

    const { error } = await supabase.from('vault_shared_links').delete().eq('id', linkId)

    if (error) handleSupabaseError(error, 'deleting shared link')

    await logAudit('share_deleted', 'info', 'share_link', linkId, 'Permanently deleted share link')
  })
}

// ─── Vault Stats ──────────────────────────────────────────

export async function fetchVaultStats(): Promise<VaultStats> {
  return withRetry(async () => {
    const user = await getAuthenticatedUser()

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('vault_user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      handleSupabaseError(profileError, 'fetching vault profile')
    }

    // Get file counts
    const { count: fileCount } = await supabase
      .from('vault_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('is_latest', true)

    const { count: encryptedCount } = await supabase
      .from('vault_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('encryption_status', 'encrypted')

    const { count: activeKeyCount } = await supabase
      .from('vault_keys')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    const { count: activeLinkCount } = await supabase
      .from('vault_shared_links')
      .select('*', { count: 'exact', head: true })
      .eq('is_revoked', false)
      .eq('is_destroyed', false)

    const storageQuota = profile?.storage_quota || 10737418240 // 10GB default
    const storageUsed = profile?.storage_used || 0

    return {
      profile: profile as VaultProfile | null,
      fileCount: fileCount || 0,
      encryptedCount: encryptedCount || 0,
      activeKeyCount: activeKeyCount || 0,
      activeLinkCount: activeLinkCount || 0,
      storageUsed,
      storageQuota,
      storagePercent: storageQuota > 0 ? Math.min(100, (storageUsed / storageQuota) * 100) : 0,
    }
  })
}

// ─── Realtime Subscriptions ──────────────────────────────

export function subscribeToVaultFiles(
  callback: (payload: { event: string; file: VaultFileEntry }) => void
) {
  return supabase
    .channel('vault-files-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'vault_files' },
      (payload) => {
        callback({
          event: payload.eventType,
          file: mapFileToEntry(payload.new as VaultFileRecord),
        })
      }
    )
    .subscribe()
}

export function subscribeToVaultFolders(
  callback: (payload: { event: string; folder: VaultFolderRecord }) => void
) {
  return supabase
    .channel('vault-folders-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'vault_folders' },
      (payload) => {
        callback({
          event: payload.eventType,
          folder: payload.new as VaultFolderRecord,
        })
      }
    )
    .subscribe()
}

export function subscribeToProcessingStatus(
  callback: (payload: { operation: string; progress: number; isComplete: boolean }) => void
) {
  return supabase
    .channel('vault-processing-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'vault_processing_status' },
      (payload) => {
        const new_data = payload.new as { operation: string; progress_pct: number; is_complete: boolean }
        callback({
          operation: new_data.operation,
          progress: new_data.progress_pct,
          isComplete: new_data.is_complete,
        })
      }
    )
    .subscribe()
}

// ─── Re-export types for backward compatibility ───────────
export type { VaultError }
