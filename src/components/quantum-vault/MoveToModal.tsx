'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { fetchVaultFolders } from '@/lib/vault/vault-service-enhanced'

interface FolderNode {
  id: string
  name: string
  parent_id: string | null
  children?: FolderNode[]
}

interface MoveToModalProps {
  authHeaders: Record<string, string>
  itemName: string
  itemType: 'file' | 'folder'
  currentFolderId: string | null
  onMove: (targetFolderId: string | null) => void
  onCancel: () => void
}

export default function MoveToModal({
  authHeaders,
  itemName,
  itemType,
  currentFolderId,
  onMove,
  onCancel,
}: MoveToModalProps) {
  const [allFolders, setAllFolders] = useState<FolderNode[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(currentFolderId)
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const fetchAllFolders = useCallback(async () => {
    setLoading(true)
    try {
      const folders = await fetchVaultFolders(null)
      setAllFolders(folders.map(f => ({ id: f.id, name: f.name, parent_id: f.parent_id })))
    } catch {
      // Silently fail — user can cancel
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAllFolders()
  }, [fetchAllFolders])

  const loadChildren = async (folderId: string) => {
    try {
      const childFolders = await fetchVaultFolders(folderId)
      setAllFolders(prev => {
        const updateTree = (nodes: FolderNode[]): FolderNode[] => {
          return nodes.map(n => {
            if (n.id === folderId) {
              return { ...n, children: childFolders.map(f => ({ id: f.id, name: f.name, parent_id: f.parent_id })) }
            }
            if (n.children) {
              return { ...n, children: updateTree(n.children) }
            }
            return n
          })
        }
        return updateTree(prev)
      })
    } catch {
      // Silently fail
    }
  }

  const toggleExpand = async (folderId: string) => {
    const next = new Set(expanded)
    if (next.has(folderId)) {
      next.delete(folderId)
    } else {
      next.add(folderId)
      const folder = findFolder(allFolders, folderId)
      if (folder && !folder.children) {
        await loadChildren(folderId)
      }
    }
    setExpanded(next)
  }

  const findFolder = (nodes: FolderNode[], id: string): FolderNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) {
        const found = findFolder(n.children, id)
        if (found) return found
      }
    }
    return null
  }

  const handleMove = async () => {
    setMoving(true)
    try {
      onMove(selectedId)
    } finally {
      setMoving(false)
    }
  }

  const renderTree = (nodes: FolderNode[], depth: number = 0) => {
    return nodes.map(folder => (
      <div key={folder.id}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', paddingLeft: 10 + depth * 20,
            cursor: 'pointer', borderRadius: 4,
            background: selectedId === folder.id ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
            border: selectedId === folder.id ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid transparent',
          }}
          onClick={() => setSelectedId(folder.id)}
        >
          <span
            style={{ fontSize: 10, cursor: 'pointer', width: 16, textAlign: 'center' }}
            onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id) }}
          >
            {expanded.has(folder.id) ? '▼' : '▶'}
          </span>
          <span style={{ fontSize: 14 }}>📁</span>
          <span style={{ fontSize: 12 }}>{folder.name}</span>
        </div>
        {expanded.has(folder.id) && folder.children && renderTree(folder.children, depth + 1)}
      </div>
    ))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
    }} onClick={onCancel}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          width: '100%', maxWidth: 420, maxHeight: '70vh',
          background: 'var(--qg-bg-card, #0a1628)',
          border: '1px solid var(--qg-border)',
          borderRadius: 12, padding: 24,
          display: 'flex', flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>
          Move {itemType === 'folder' ? 'Folder' : 'File'}
        </h3>
        <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginBottom: 16 }}>
          Select destination for &quot;{itemName}&quot;
        </div>

        {/* Root option */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 10px', cursor: 'pointer', borderRadius: 4,
            background: selectedId === null ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
            border: selectedId === null ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid transparent',
            marginBottom: 4,
          }}
          onClick={() => setSelectedId(null)}
        >
          <span style={{ fontSize: 14 }}>🏠</span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Root (top level)</span>
        </div>

        {/* Folder tree */}
        <div style={{
          flex: 1, overflowY: 'auto', marginBottom: 16,
          border: '1px solid var(--qg-border)', borderRadius: 6, padding: 8,
          minHeight: 120, maxHeight: 300,
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--qg-text-muted)', fontSize: 12 }}>
              Loading folders...
            </div>
          ) : allFolders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--qg-text-muted)', fontSize: 12 }}>
              No folders yet. The file will be at root level.
            </div>
          ) : (
            renderTree(allFolders)
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="q-btn q-btn-ghost"
            style={{ padding: '8px 16px', fontSize: 12 }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="q-btn q-btn-primary"
            style={{ padding: '8px 20px', fontSize: 12 }}
            onClick={handleMove}
            disabled={moving || selectedId === currentFolderId}
          >
            {moving ? '⏳ Moving...' : 'Move Here'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
