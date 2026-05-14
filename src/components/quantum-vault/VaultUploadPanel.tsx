'use client'

import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { motion } from 'framer-motion'
import EncryptionProgress from './EncryptionProgress'
import {
  createVaultFolder,
  fetchAllFolders,
  uploadVaultFile,
} from '@/lib/vault/vault-service-enhanced'

interface EncryptionStage {
  stage: 'idle' | 'encrypting' | 'complete' | 'error'
  percent: number
  message: string
}

interface VaultUploadPanelProps {
  sessionToken: string | undefined
  encPublicKey: Uint8Array
  x25519Public?: Uint8Array
  sigSecretKey: Uint8Array
  ed25519SecretKey?: Uint8Array
  onFileUploaded: () => void
  onClose: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function relativePath(file: File): string {
  return file.webkitRelativePath || file.name
}

export default function VaultUploadPanel({
  encPublicKey,
  x25519Public,
  sigSecretKey,
  ed25519SecretKey,
  onFileUploaded,
  onClose,
}: VaultUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [encStage, setEncStage] = useState<EncryptionStage>({ stage: 'idle', percent: 0, message: '' })
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
    folderInputRef.current?.setAttribute('directory', '')
  }, [])

  const handleFileSelect = (selected: File) => {
    setFile(selected)
    setEncStage({ stage: 'idle', percent: 0, message: '' })
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const selected = e.dataTransfer.files[0]
    if (selected) handleFileSelect(selected)
  }

  const encryptAndUploadOne = async (targetFile: File, folderId: string | null, progressBase = 0, progressSpan = 100) => {
    const pct = (local: number) => Math.min(99, Math.round(progressBase + (local / 100) * progressSpan))
    const fileData = new Uint8Array(await targetFile.arrayBuffer())

    try {
      setEncStage({ stage: 'encrypting', percent: pct(10), message: `Loading PQC engine for ${targetFile.name}...` })
      const { encryptFileLocal, signData } = await import('@/lib/vault/client-crypto')

      setEncStage({ stage: 'encrypting', percent: pct(24), message: `Computing SHA3 integrity context for ${targetFile.name}...` })
      const { buildMerkleTreeFromData } = await import('@/lib/vault/merkle-tree')
      buildMerkleTreeFromData(fileData)

      setEncStage({ stage: 'encrypting', percent: pct(42), message: `Encrypting ${targetFile.name} with AES-256-GCM...` })
      const result = encryptFileLocal(fileData, encPublicKey, x25519Public)

      setEncStage({ stage: 'encrypting', percent: pct(64), message: `Signing ${targetFile.name} with ML-DSA-65...` })
      const signedMetadata = JSON.stringify({
        fileName: targetFile.name,
        fileSize: result.originalSize,
        integrityHash: result.integrityHash,
        encryptedIntegrityHash: result.encryptedIntegrityHash,
        encryptionAlgorithm: result.algorithm,
        envelope: result.envelopeMeta,
        timestamp: new Date().toISOString(),
      })
      const signature = signData(new TextEncoder().encode(signedMetadata), sigSecretKey, ed25519SecretKey)

      setEncStage({ stage: 'encrypting', percent: pct(82), message: `Uploading sealed blob for ${targetFile.name}...` })
      return await uploadVaultFile(targetFile, {
        folderId,
        encryptionData: {
          encryptedData: result.encryptedData,
          kemCiphertext: result.kemCiphertext,
          aesNonce: result.aesNonce,
          aesAuthTag: result.aesAuthTag,
          contentHash: result.integrityHash,
          encryptedContentHash: result.encryptedIntegrityHash,
          aadHash: result.aadHash,
          envelopeMeta: {
            ...result.envelopeMeta,
            signedMetadata,
          },
          keyDerivationMeta: {
            kdf: 'HKDF-SHA3-256',
            hash: 'SHA3-256',
            oqsProfile: 'liboqs/oqs-provider compatible ML-KEM-768 hybrid envelope',
          },
          algorithm: result.algorithm,
          signature,
        },
      })
    } finally {
      fileData.fill(0)
    }
  }

  const handleEncryptAndUpload = async () => {
    if (!file) return

    setEncStage({ stage: 'encrypting', percent: 5, message: 'Reading file into memory...' })

    try {
      const uploaded = await encryptAndUploadOne(file, null, 5, 92)
      if (uploaded?.id) {
        setEncStage({
          stage: 'complete',
          percent: 100,
          message: 'File sealed client-side with X25519 + ML-KEM-768, AES-256-GCM, and ML-DSA-65.',
        })
        onFileUploaded()
      } else {
        setEncStage({ stage: 'error', percent: 0, message: 'Upload failed' })
      }
    } catch (err) {
      console.error('ZK encrypt+upload error:', err)
      setEncStage({ stage: 'error', percent: 0, message: (err as Error).message || 'Encryption failed' })
    }
  }

  const handleFolderSelect = async (fileList: FileList | null) => {
    const selected = Array.from(fileList || [])
    if (selected.length === 0) return

    setFile(null)
    setEncStage({ stage: 'encrypting', percent: 3, message: `Preparing encrypted folder upload (${selected.length} files)...` })

    try {
      const existingFolders = await fetchAllFolders()
      const folderCache = new Map<string, string | null>()
      folderCache.set('', null)
      for (const folder of existingFolders) {
        folderCache.set(folder.path.replace(/^\/+/, ''), folder.id)
      }

      const resolveFolder = async (targetFile: File): Promise<string | null> => {
        const parts = relativePath(targetFile).split('/').filter(Boolean)
        const folderParts = parts.slice(0, -1)
        let parentId: string | null = null
        let cachePath = ''

        for (const part of folderParts) {
          cachePath = cachePath ? `${cachePath}/${part}` : part
          if (!folderCache.has(cachePath)) {
            const created = await createVaultFolder(part, parentId)
            folderCache.set(cachePath, created.id)
          }
          parentId = folderCache.get(cachePath) || null
        }

        return parentId
      }

      for (let i = 0; i < selected.length; i++) {
        const target = selected[i]
        const folderId = await resolveFolder(target)
        await encryptAndUploadOne(target, folderId, (i / selected.length) * 100, 100 / selected.length)
      }

      setEncStage({
        stage: 'complete',
        percent: 100,
        message: `Encrypted folder upload complete. ${selected.length} files were sealed with independent keys.`,
      })
      onFileUploaded()
    } catch (err) {
      console.error('Folder encrypt+upload error:', err)
      setEncStage({ stage: 'error', percent: 0, message: (err as Error).message || 'Folder upload failed' })
    } finally {
      if (folderInputRef.current) folderInputRef.current.value = ''
    }
  }

  const handleReset = () => {
    setFile(null)
    setEncStage({ stage: 'idle', percent: 0, message: '' })
  }

  const isEncrypted = encStage.stage === 'complete'
  const isBusy = encStage.stage === 'encrypting'

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.97 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}
    >
      <div style={{ textAlign: 'center', marginBottom: 22 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '6px 18px',
          background: 'rgba(212,175,55,0.08)',
          border: '1px solid rgba(212,175,55,0.25)',
          borderRadius: 40,
          marginBottom: 12,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--qg-green)', boxShadow: '0 0 8px var(--qg-green)', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--qg-cyan)' }}>
            ZERO-KNOWLEDGE CLIENT-SIDE ENCRYPTION
          </span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.08em', color: 'var(--qg-text-primary)', marginBottom: 4 }}>
          Encrypt And Secure
        </h2>
        <p style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
          Files and folders are encrypted before upload. Plaintext never leaves this browser session.
        </p>
      </div>

      {!file && !isEncrypted && (
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          animate={{ borderColor: dragOver ? 'rgba(255,215,96,0.75)' : 'rgba(212,175,55,0.28)' }}
          style={{
            border: '2px dashed rgba(212,175,55,0.28)',
            borderRadius: 12,
            padding: '38px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(212,175,55,0.06)' : 'rgba(0,0,0,0.28)',
            transition: 'background 0.2s, box-shadow 0.2s',
            boxShadow: dragOver ? '0 0 28px rgba(212,175,55,0.16) inset' : 'none',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 34, marginBottom: 10 }}>Secure Upload</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', color: 'var(--qg-text-primary)', marginBottom: 6 }}>
            DROP FILE HERE
          </div>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginBottom: 14 }}>
            Choose one file or an entire folder. Every file gets a unique AES-256-GCM data key.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                background: 'rgba(212,175,55,0.1)',
                border: '1px solid rgba(212,175,55,0.35)',
                borderRadius: 8,
                fontSize: 12,
                color: 'var(--qg-cyan)',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Choose File
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                folderInputRef.current?.click()
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 18px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(212,175,55,0.28)',
                borderRadius: 8,
                fontSize: 12,
                color: 'rgba(255,255,255,0.84)',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
              }}
            >
              Choose Folder
            </button>
          </div>
        </motion.div>
      )}

      <input
        ref={inputRef}
        type="file"
        title="Select file to encrypt"
        style={{ display: 'none' }}
        onChange={(e) => {
          const selected = e.target.files?.[0]
          e.target.value = ''
          if (selected) handleFileSelect(selected)
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        title="Select folder to encrypt"
        style={{ display: 'none' }}
        onChange={(e) => void handleFolderSelect(e.target.files)}
      />

      {file && !isEncrypted && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16 }}>
          <div style={{
            padding: '14px 18px',
            background: 'rgba(212,175,55,0.05)',
            border: '1px solid rgba(212,175,55,0.2)',
            borderRadius: 10,
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 22, width: 34, height: 34, display: 'grid', placeItems: 'center' }}>FILE</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--qg-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {formatSize(file.size)} / {file.type || 'unknown type'}
                </div>
              </div>
              <button
                onClick={handleReset}
                disabled={isBusy}
                style={{ background: 'none', border: 'none', color: 'var(--qg-text-muted)', cursor: isBusy ? 'wait' : 'pointer', fontSize: 16, padding: 4 }}
                title="Remove"
              >
                x
              </button>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--qg-cyan)', boxShadow: '0 0 6px var(--qg-cyan)' }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>
                Zero-knowledge envelope: X25519 + ML-KEM-768, AES-256-GCM, HKDF-SHA3-256.
              </span>
            </div>
          </div>

          {encStage.stage !== 'idle' && (
            <div style={{ marginBottom: 12 }}>
              <EncryptionProgress stage={encStage.stage} percent={encStage.percent} message={encStage.message} />
            </div>
          )}

          {encStage.stage === 'idle' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleEncryptAndUpload}
                className="q-btn q-btn-primary"
                style={{
                  flex: 1, padding: '12px 0', fontSize: 12, letterSpacing: '0.1em',
                  boxShadow: '0 0 24px rgba(212,175,55,0.24)',
                }}
              >
                Encrypt And Secure
              </button>
              <button onClick={handleReset} className="q-btn q-btn-ghost" style={{ padding: '10px 16px', fontSize: 11 }}>
                Clear
              </button>
            </div>
          )}
        </motion.div>
      )}

      {(isEncrypted || (encStage.stage !== 'idle' && !file)) && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', marginBottom: 16 }}>
          <EncryptionProgress stage={encStage.stage} percent={encStage.percent} message={encStage.message} />
          {isEncrypted && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleReset} className="q-btn q-btn-primary" style={{ padding: '9px 24px', fontSize: 12 }}>
                Encrypt Another File
              </button>
              <button onClick={onClose} className="q-btn q-btn-ghost" style={{ padding: '9px 20px', fontSize: 12 }}>
                Close Vault
              </button>
            </div>
          )}
        </motion.div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'center', gap: 18,
        padding: '12px 0',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        marginTop: 8,
        flexWrap: 'wrap',
      }}>
        {['Zero-Knowledge', 'Post-Quantum', 'SHA3 Integrity', 'Per-File Keys'].map((tag) => (
          <span key={tag} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', letterSpacing: '0.1em' }}>
            {tag}
          </span>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--qg-text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
        >
          Close Quantum Vault
        </button>
      </div>
    </motion.div>
  )
}
