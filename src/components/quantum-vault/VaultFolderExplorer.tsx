'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  fetchVaultFiles,
  fetchVaultFolders,
  createVaultFolder,
  renameVaultFolder,
  deleteVaultFolder,
  getFolderBreadcrumbs,
  type VaultFileEntry,
} from '@/lib/vault/vault-service'

// ─── Types ─────────────────────────────────────────────────

interface VaultFolder {
  id: string
  name: string
  parent_id: string | null
  created_at: string
  updated_at: string
  item_count: number
}

interface Breadcrumb {
  id: string
  name: string
}

interface VaultFolderExplorerProps {
  authHeaders: Record<string, string>
  onFileAction: (action: string, file: VaultFileEntry) => void
  onMoveFile: (fileId: string, fileName: string) => void
  encrypting: string | null
  decrypting: string | null
  downloading: string | null
  verifying: string | null
  onFilesChanged: (files: VaultFileEntry[]) => void
  onFolderChanged: (folderId: string | null) => void
}

// ─── Helpers ───────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(1)} GB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Component ─────────────────────────────────────────────

export default function VaultFolderExplorer({
  authHeaders,
  onFileAction,
  onMoveFile,
  encrypting,
  decrypting,
  downloading,
  verifying,
  onFilesChanged,
  onFolderChanged,
}: VaultFolderExplorerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<VaultFolder[]>([])
  const [files, setFiles] = useState<VaultFileEntry[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ─── Fetch folder contents (Supabase direct) ─────────────

  const fetchContents = useCallback(async (folderId: string | null) => {
    setLoading(true)
    setError(null)
    try {
      const [folderRecords, fileRecords, crumbs] = await Promise.all([
        fetchVaultFolders(folderId),
        fetchVaultFiles(folderId),
        getFolderBreadcrumbs(folderId),
      ])

      // Count items in each folder
      const foldersWithCounts: VaultFolder[] = await Promise.all(
        folderRecords.map(async (f) => {
          const [subFolders, subFiles] = await Promise.all([
            fetchVaultFolders(f.id),
            fetchVaultFiles(f.id),
          ])
          return {
            id: f.id,
            name: f.name,
            parent_id: f.parent_id,
            created_at: f.created_at,
            updated_at: f.updated_at,
            item_count: subFolders.length + subFiles.length,
          }
        })
      )

      setFolders(foldersWithCounts)
      setFiles(fileRecords)
      setBreadcrumbs(crumbs)
      onFilesChanged(fileRecords)
    } catch (err) {
      console.error('Vault fetch error:', err)
      setError('Could not load vault contents. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [onFilesChanged])

  useEffect(() => {
    fetchContents(currentFolderId)
  }, [currentFolderId, fetchContents])

  useEffect(() => {
    onFolderChanged(currentFolderId)
  }, [currentFolderId, onFolderChanged])

  const navigateToFolder = (folderId: string | null) => {
    setCurrentFolderId(folderId)
  }

  // ─── Create Folder ──────────────────────────────────────

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    setCreateError(null)
    try {
      await createVaultFolder(name, currentFolderId)
      setCreatingFolder(false)
      setNewFolderName('')
      fetchContents(currentFolderId)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create folder'
      setCreateError(msg)
    }
  }

  // ─── Rename Folder ──────────────────────────────────────

  const handleRenameFolder = async (folderId: string) => {
    const name = renameValue.trim()
    if (!name) return
    try {
      await renameVaultFolder(folderId, name)
      setRenamingId(null)
      setRenameValue('')
      fetchContents(currentFolderId)
    } catch {
      alert('Rename failed')
    }
  }

  // ─── Delete Folder ──────────────────────────────────────

  const handleDeleteFolder = async (folderId: string, folderName: string, itemCount: number) => {
    const message = itemCount > 0
      ? `Delete folder "${folderName}" and its ${itemCount} item(s)? Files inside will be moved to root.`
      : `Delete empty folder "${folderName}"?`
    if (!confirm(message)) return
    setDeletingId(folderId)
    try {
      await deleteVaultFolder(folderId)
      fetchContents(currentFolderId)
    } catch {
      alert('Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  // Expose refresh for parent component
  const refresh = useCallback(() => {
    fetchContents(currentFolderId)
  }, [currentFolderId, fetchContents])

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__vaultFolderRefresh = refresh
    return () => {
      delete (window as unknown as Record<string, unknown>).__vaultFolderRefresh
    }
  }, [refresh])

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="q-card animate-fade-in-up">
      {/* Breadcrumbs */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
        fontSize: 13, flexWrap: 'wrap',
      }}>
        <button
          onClick={() => navigateToFolder(null)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: currentFolderId ? 'var(--qg-cyan)' : 'var(--qg-text)',
            fontWeight: currentFolderId ? 400 : 600,
            fontSize: 13, padding: '2px 4px', borderRadius: 4,
          }}
        >
          Root
        </button>
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--qg-text-muted)', fontSize: 11 }}>&gt;</span>
            <button
              onClick={() => navigateToFolder(crumb.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: i === breadcrumbs.length - 1 ? 'var(--qg-text)' : 'var(--qg-cyan)',
                fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                fontSize: 13, padding: '2px 4px', borderRadius: 4,
              }}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, margin: 0 }}>
          {currentFolderId ? breadcrumbs[breadcrumbs.length - 1]?.name || 'Folder' : 'Vault Files'}
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="q-btn q-btn-secondary"
            style={{ padding: '6px 14px', fontSize: 11 }}
            onClick={() => { setCreatingFolder(true); setCreateError(null); setNewFolderName('') }}
          >
            + New Folder
          </button>
          <button
            className="q-btn q-btn-ghost"
            style={{ padding: '6px 14px', fontSize: 11 }}
            onClick={() => fetchContents(currentFolderId)}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Create Folder Inline Input */}
      <AnimatePresence>
        {creatingFolder && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: 16, overflow: 'hidden' }}
          >
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center',
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--qg-cyan)',
              background: 'rgba(212, 175, 55, 0.03)',
            }}>
              <span style={{ fontSize: 18 }}>📁</span>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') setCreatingFolder(false)
                }}
                placeholder="Folder name..."
                autoFocus
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--qg-text)', fontSize: 13, fontFamily: 'inherit',
                }}
              />
              <button
                className="q-btn q-btn-primary"
                style={{ padding: '4px 14px', fontSize: 11 }}
                onClick={handleCreateFolder}
              >
                Create
              </button>
              <button
                className="q-btn q-btn-ghost"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => setCreatingFolder(false)}
              >
                Cancel
              </button>
            </div>
            {createError && (
              <div style={{ fontSize: 11, color: 'var(--qg-red, #ef4444)', marginTop: 4, paddingLeft: 36 }}>
                {createError}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--qg-red, #ef4444)', fontWeight: 600 }}>Error</div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>{error}</div>
          </div>
          <button
            className="q-btn q-btn-ghost"
            style={{ fontSize: 11, padding: '6px 12px' }}
            onClick={() => { setError(null); fetchContents(currentFolderId) }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <div style={{
            width: 24, height: 24, border: '2px solid var(--qg-cyan)',
            borderTopColor: 'transparent', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>Loading vault contents...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && folders.length === 0 && files.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--qg-text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{currentFolderId ? '📂' : '📁'}</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>
            {currentFolderId ? 'This folder is empty' : 'Your Quantum Vault is empty'}
          </div>
          <div style={{ fontSize: 13 }}>
            {currentFolderId
              ? 'Upload files or create subfolders to get started.'
              : 'Upload files first, then encrypt them with ML-KEM-768 + AES-256-GCM'}
          </div>
        </div>
      )}

      {/* Folder & File Table */}
      {!loading && !error && (folders.length > 0 || files.length > 0) && (
        <table className="q-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Size / Items</th>
              <th>Status</th>
              <th>Date</th>
              <th>Integrity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Folders first */}
            {folders.map((folder) => (
              <tr
                key={`folder-${folder.id}`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (renamingId !== folder.id) navigateToFolder(folder.id)
                }}
              >
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📁</span>
                    {renamingId === folder.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation()
                          if (e.key === 'Enter') handleRenameFolder(folder.id)
                          if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        style={{
                          background: 'rgba(212,175,55,0.05)', border: '1px solid var(--qg-cyan)',
                          borderRadius: 4, padding: '2px 8px', color: 'var(--qg-text)',
                          fontSize: 13, fontFamily: 'inherit', outline: 'none',
                        }}
                      />
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{folder.name}</div>
                    )}
                  </div>
                </td>
                <td style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
                  {folder.item_count} item{folder.item_count !== 1 ? 's' : ''}
                </td>
                <td>
                  <span style={{ fontSize: 10, color: 'var(--qg-cyan)', fontWeight: 500 }}>Folder</span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
                  {formatDate(folder.created_at)}
                </td>
                <td>
                  <span style={{ fontSize: 10, color: 'var(--qg-text-muted)' }}>—</span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 10 }}
                      onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name) }}
                      title="Rename folder"
                    >
                      ✏️ Rename
                    </button>
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 10, color: 'var(--qg-red, #ef4444)' }}
                      onClick={() => handleDeleteFolder(folder.id, folder.name, folder.item_count)}
                      disabled={deletingId === folder.id}
                      title="Delete folder"
                    >
                      {deletingId === folder.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Files */}
            {files.map((file) => (
              <tr key={`file-${file.id}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{file.is_locked ? '🔐' : '📄'}</span>
                    <div>
                      <div style={{ fontSize: 13 }}>{file.name}</div>
                      {file.original_size && file.is_locked && (
                        <div style={{ fontSize: 10, color: 'var(--qg-text-muted)' }}>
                          Original: {formatFileSize(file.original_size)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-muted)' }}>
                  {formatFileSize(file.size)}
                </td>
                <td>
                  {file.is_locked ? (
                    <div>
                      <span className="threat-badge threat-safe" style={{ fontSize: 9 }}>
                        {file.encryption_algorithm}
                      </span>
                      {file.signature && (
                        <span className="threat-badge" style={{ fontSize: 9, marginLeft: 4, background: 'rgba(255, 243, 193, 0.15)', color: 'var(--qg-violet)' }}>
                          Signed
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--qg-amber, #f59e0b)', fontWeight: 600 }}>
                      ⚠️ Unencrypted
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
                  {formatDate(file.uploaded_at)}
                </td>
                <td>
                  {file.integrity_hash ? (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-green)' }}>
                      {file.integrity_hash.slice(0, 12)}...
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--qg-text-muted)' }}>—</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {!file.is_locked && (
                      <button
                        className="q-btn q-btn-primary"
                        style={{ padding: '4px 12px', fontSize: 10 }}
                        onClick={() => onFileAction('encrypt', file)}
                        disabled={encrypting === file.id}
                        title="Encrypt with ML-KEM-768 + AES-256-GCM"
                      >
                        {encrypting === file.id ? '⏳ Encrypting...' : '🔐 Encrypt'}
                      </button>
                    )}
                    {file.is_locked && (
                      <button
                        className="q-btn q-btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 10 }}
                        onClick={() => onFileAction('decrypt', file)}
                        disabled={decrypting === file.id}
                        title="Decrypt & Download original file"
                      >
                        {decrypting === file.id ? '⏳' : '🔓'} Decrypt
                      </button>
                    )}
                    {file.is_locked && (
                      <button
                        className="q-btn q-btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 10, color: 'var(--qg-cyan)' }}
                        onClick={() => onFileAction('download', file)}
                        disabled={downloading === file.id}
                        title="Download encrypted file"
                      >
                        {downloading === file.id ? '⏳' : '💾'} Download
                      </button>
                    )}
                    {file.is_locked && (
                      <button
                        className="q-btn q-btn-ghost"
                        style={{ padding: '4px 10px', fontSize: 10 }}
                        onClick={() => onFileAction('verify', file)}
                        disabled={verifying === file.id}
                        title="Verify Integrity"
                      >
                        {verifying === file.id ? '⏳' : '🔍'} Verify
                      </button>
                    )}
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 10, color: 'var(--qg-violet, #fff3c1)' }}
                      onClick={() => onFileAction('share', file)}
                      title="Create secure share link"
                    >
                      🔗 Share
                    </button>
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 10 }}
                      onClick={() => onMoveFile(file.id, file.name)}
                      title="Move to folder"
                    >
                      📦 Move
                    </button>
                    <button
                      className="q-btn q-btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 10, color: 'var(--qg-red, #ef4444)' }}
                      onClick={() => onFileAction('delete', file)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
