/**
 * Quantum Vault — Supabase Service Layer
 * Replaces all /api/v1/vault/* API calls with direct Supabase queries.
 * Every query is user-scoped via RLS (auth.uid()).
 */

import { supabase } from '@/lib/supabase'

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
  is_deleted: boolean
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
  original_filename: string | null
  original_size: number | null
  mime_type: string | null
  is_revoked: boolean
  is_destroyed: boolean
  failed_password_attempts: number
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
  metadata: Record<string, unknown>
  created_at: string
}

// ─── Mapped types for the UI (matching existing interfaces) ──

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
  folder_id: string | null
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
}

// ─── Mappers ───────────────────────────────────────────────

function mapFileToEntry(f: VaultFileRecord): VaultFileEntry {
  return {
    id: f.id,
    name: f.original_filename,
    size: f.encrypted_size ?? f.original_size,
    original_size: f.original_size,
    mime_type: f.mime_type,
    encryption_algorithm: f.encryption_algorithm || '',
    uploaded_at: f.uploaded_at || f.created_at,
    shared_with: [],
    is_locked: f.encryption_status === 'encrypted',
    integrity_hash: f.content_hash,
    signature: f.signature,
    encryption_key_id: f.encryption_key_id,
    signing_key_id: f.signing_key_id,
    kem_ciphertext: f.kem_ciphertext,
    aes_nonce: f.aes_nonce,
    folder_id: f.folder_id,
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
    failed_password_attempts: l.failed_password_attempts,
    created_at: l.created_at,
    last_accessed_at: l.last_accessed_at,
  }
}

// ─── Vault Profile ─────────────────────────────────────────

export async function ensureVaultProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: existing } = await supabase
    .from('vault_user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (existing) return existing

  const { data: created, error } = await supabase
    .from('vault_user_profiles')
    .insert({ user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return created
}

// ─── Files ─────────────────────────────────────────────────

export async function fetchVaultFiles(folderId?: string | null): Promise<VaultFileEntry[]> {
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
  if (error) throw error
  return (data || []).map(mapFileToEntry)
}

export async function fetchAllVaultFiles(): Promise<VaultFileEntry[]> {
  const { data, error } = await supabase
    .from('vault_files')
    .select('*')
    .eq('is_deleted', false)
    .eq('is_latest', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapFileToEntry)
}

export async function uploadVaultFile(
  file: File,
  folderId: string | null,
  encryptionData?: {
    encryptedData: Uint8Array
    kemCiphertext: string
    aesNonce: string
    contentHash: string
    signature?: string
    signingKeyId?: string
  }
): Promise<VaultFileEntry> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const fileId = crypto.randomUUID()
  const isEncrypted = !!encryptionData
  const storagePath = `vault/${user.id}/${fileId}/${isEncrypted ? fileId + '.enc' : file.name}`

  // Upload to storage
  const uploadData = isEncrypted ? encryptionData!.encryptedData : await file.arrayBuffer()
  const { error: storageError } = await supabase.storage
    .from('vault-encrypted')
    .upload(storagePath, uploadData, {
      contentType: isEncrypted ? 'application/octet-stream' : file.type,
      upsert: false,
    })

  if (storageError) throw storageError

  // Create file record
  const fileRecord = {
    id: fileId,
    user_id: user.id,
    folder_id: folderId,
    original_filename: file.name,
    encrypted_filename: isEncrypted ? fileId + '.enc' : null,
    mime_type: file.type || 'application/octet-stream',
    original_size: file.size,
    encrypted_size: isEncrypted ? encryptionData!.encryptedData.length : null,
    storage_path: storagePath,
    encryption_status: isEncrypted ? 'encrypted' : 'pending',
    encryption_algorithm: isEncrypted ? 'ZK-ML-KEM-768+AES-256-GCM' : 'none',
    kem_ciphertext: encryptionData?.kemCiphertext || null,
    aes_nonce: encryptionData?.aesNonce || null,
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

  if (error) throw error

  // Update storage quota
  await supabase.rpc('ensure_vault_profile')
  const fileSize = isEncrypted ? encryptionData!.encryptedData.length : file.size
  await supabase
    .from('vault_user_profiles')
    .update({
      storage_used: supabase.rpc ? undefined : 0,
      file_count: supabase.rpc ? undefined : 0,
    })
    .eq('user_id', user.id)

  // Increment storage_used and file_count manually
  const { data: profile } = await supabase
    .from('vault_user_profiles')
    .select('storage_used, file_count')
    .eq('user_id', user.id)
    .single()

  if (profile) {
    await supabase
      .from('vault_user_profiles')
      .update({
        storage_used: (profile.storage_used || 0) + fileSize,
        file_count: (profile.file_count || 0) + 1,
        vault_created: true,
      })
      .eq('user_id', user.id)
  }

  // Audit log
  await logAudit('file_uploaded', 'info', 'file', data.id, `Uploaded file: ${file.name}`)

  return mapFileToEntry(data)
}

export async function deleteVaultFile(fileId: string): Promise<void> {
  // Soft delete
  const { data: file } = await supabase
    .from('vault_files')
    .select('storage_path, original_filename, original_size, encrypted_size')
    .eq('id', fileId)
    .single()

  const { error } = await supabase
    .from('vault_files')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      permanent_delete_after: new Date(Date.now() + 30 * 86400000).toISOString(),
    })
    .eq('id', fileId)

  if (error) throw error

  if (file) {
    await logAudit('file_deleted', 'warning', 'file', fileId, `Deleted file: ${file.original_filename}`)

    // Update quota
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('vault_user_profiles')
        .select('storage_used, file_count')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        const size = file.encrypted_size || file.original_size || 0
        await supabase
          .from('vault_user_profiles')
          .update({
            storage_used: Math.max(0, (profile.storage_used || 0) - size),
            file_count: Math.max(0, (profile.file_count || 0) - 1),
          })
          .eq('user_id', user.id)
      }
    }
  }
}

export async function moveVaultFile(fileId: string, targetFolderId: string | null): Promise<void> {
  const { error } = await supabase
    .from('vault_files')
    .update({ folder_id: targetFolderId })
    .eq('id', fileId)

  if (error) throw error
}

export async function downloadVaultFile(fileId: string): Promise<{ data: Blob; filename: string }> {
  const { data: file } = await supabase
    .from('vault_files')
    .select('storage_path, original_filename')
    .eq('id', fileId)
    .single()

  if (!file?.storage_path) throw new Error('File not found')

  const { data, error } = await supabase.storage
    .from('vault-encrypted')
    .download(file.storage_path)

  if (error || !data) throw error || new Error('Download failed')

  return { data, filename: file.original_filename }
}

// ─── Folders ───────────────────────────────────────────────

export async function fetchVaultFolders(parentId: string | null): Promise<VaultFolderRecord[]> {
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
  if (error) throw error
  return data || []
}

export async function createVaultFolder(name: string, parentId: string | null): Promise<VaultFolderRecord> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Calculate depth
  let depth = 0
  let path = '/' + name
  if (parentId) {
    const { data: parent } = await supabase
      .from('vault_folders')
      .select('depth, path')
      .eq('id', parentId)
      .single()
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

  if (error) throw error

  // Update profile folder count
  const { data: profile } = await supabase
    .from('vault_user_profiles')
    .select('folder_count')
    .eq('user_id', user.id)
    .single()

  if (profile) {
    await supabase
      .from('vault_user_profiles')
      .update({ folder_count: (profile.folder_count || 0) + 1 })
      .eq('user_id', user.id)
  }

  return data
}

export async function renameVaultFolder(folderId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('vault_folders')
    .update({ name })
    .eq('id', folderId)

  if (error) throw error
}

export async function deleteVaultFolder(folderId: string): Promise<void> {
  // Move files in this folder to root
  await supabase
    .from('vault_files')
    .update({ folder_id: null })
    .eq('folder_id', folderId)

  // Move sub-folders to root
  await supabase
    .from('vault_folders')
    .update({ parent_id: null })
    .eq('parent_id', folderId)

  // Soft delete
  const { error } = await supabase
    .from('vault_folders')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', folderId)

  if (error) throw error
}

export async function getFolderBreadcrumbs(folderId: string | null): Promise<Array<{ id: string; name: string }>> {
  if (!folderId) return []

  const breadcrumbs: Array<{ id: string; name: string }> = []
  let currentId: string | null = folderId

  while (currentId) {
    const { data } = await supabase
      .from('vault_folders')
      .select('id, name, parent_id')
      .eq('id', currentId)
      .single()

    if (!data) break
    breadcrumbs.unshift({ id: data.id, name: data.name })
    currentId = data.parent_id
  }

  return breadcrumbs
}

// ─── Keys ──────────────────────────────────────────────────

export async function fetchVaultKeys(): Promise<VaultKeyEntry[]> {
  const { data, error } = await supabase
    .from('vault_keys')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapKeyToEntry)
}

export async function createVaultKey(params: {
  keyType: string
  algorithm: string
  fingerprint: string
  publicKeyHex?: string
  wrappedSecretKey?: string
  wrappingNonce?: string
}): Promise<VaultKeyRecord> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Deactivate existing keys of same type
  await supabase
    .from('vault_keys')
    .update({ is_active: false, status: 'rotated', rotated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('key_type', params.keyType)
    .eq('is_active', true)

  // Get current max version for this key type
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
      version: nextVersion,
      is_active: true,
      status: 'active',
    })
    .select()
    .single()

  if (error) throw error

  await logAudit('key_generated', 'info', 'key', data.id, `Generated ${params.keyType} key using ${params.algorithm}`)
  return data
}

export async function revokeVaultKey(keyId: string): Promise<void> {
  const { data: key } = await supabase
    .from('vault_keys')
    .select('key_type, algorithm')
    .eq('id', keyId)
    .single()

  const { error } = await supabase
    .from('vault_keys')
    .update({
      is_active: false,
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      revocation_reason: 'manual_revocation',
    })
    .eq('id', keyId)

  if (error) throw error

  if (key) {
    await logAudit('key_revoked', 'warning', 'key', keyId, `Revoked ${key.key_type} key (${key.algorithm})`)
  }
}

// ─── User Keys (ZK wrapped master keys) ────────────────────

export async function fetchUserKeys(): Promise<{ wrapped_bundle: string; enc_public_key: string; sign_public_key: string } | null> {
  const { data, error } = await supabase
    .from('vault_user_keys')
    .select('wrapped_bundle, enc_public_key, sign_public_key')
    .single()

  if (error && error.code !== 'PGRST116') throw error  // PGRST116 = no rows
  return data || null
}

export async function storeUserKeys(wrappedBundle: string, encPublicKey: string, signPublicKey: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('vault_user_keys')
    .upsert({
      user_id: user.id,
      wrapped_bundle: wrappedBundle,
      enc_public_key: encPublicKey,
      sign_public_key: signPublicKey,
    })

  if (error) throw error

  // Mark vault as created
  await supabase
    .from('vault_user_profiles')
    .update({ vault_created: true })
    .eq('user_id', user.id)
}

// ─── Audit Logs ────────────────────────────────────────────

export async function fetchAuditLogs(limit = 50): Promise<AuditEventEntry[]> {
  const { data, error } = await supabase
    .from('vault_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []).map(mapAuditToEntry)
}

export async function logAudit(
  eventType: string,
  severity: string,
  resourceType: string,
  resourceId: string | null = null,
  description: string = ''
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('vault_audit_logs').insert({
    user_id: user.id,
    event_type: eventType,
    severity,
    resource_type: resourceType,
    resource_id: resourceId,
    description,
  })
}

// ─── Shared Links ──────────────────────────────────────────

export async function fetchSharedLinks(): Promise<SharedLinkEntry[]> {
  const { data, error } = await supabase
    .from('vault_shared_links')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(mapSharedLink)
}

export async function createSharedLink(params: {
  fileId: string
  originalFilename: string
  originalSize: number
  mimeType: string
  encryptedFileData?: Uint8Array
  encryptionMetadata?: Record<string, unknown>
  isPasswordProtected?: boolean
  passwordHash?: string
  maxDownloads?: number
  expiresAt?: string
  isOneTime?: boolean
}): Promise<VaultSharedLinkRecord> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

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
      max_downloads: params.maxDownloads,
      expires_at: params.expiresAt,
      is_one_time: params.isOneTime || false,
    })
    .select()
    .single()

  if (error) throw error

  await logAudit('file_shared', 'info', 'share_link', data.id, `Created share link for: ${params.originalFilename}`)
  return data
}

export async function revokeSharedLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('vault_shared_links')
    .update({ is_revoked: true, revoked_at: new Date().toISOString() })
    .eq('id', linkId)

  if (error) throw error
  await logAudit('share_revoked', 'info', 'share_link', linkId, 'Revoked share link')
}

export async function deleteSharedLink(linkId: string): Promise<void> {
  const { error } = await supabase
    .from('vault_shared_links')
    .delete()
    .eq('id', linkId)

  if (error) throw error
}

// ─── Vault Profile Stats ──────────────────────────────────

export async function fetchVaultStats() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('vault_user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Get actual counts from tables for accuracy
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

  return {
    profile,
    fileCount: fileCount || 0,
    encryptedCount: encryptedCount || 0,
    activeKeyCount: activeKeyCount || 0,
    activeLinkCount: activeLinkCount || 0,
    storageUsed: profile?.storage_used || 0,
    storageQuota: profile?.storage_quota || 104857600,
  }
}
