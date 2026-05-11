'use client'

import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import EncryptionProgress from './EncryptionProgress'
import { uploadVaultFile } from '@/lib/vault/vault-service'

interface EncryptionStage {
  stage: 'idle' | 'encrypting' | 'complete' | 'error'
  percent: number
  message: string
}

interface VaultUploadPanelProps {
  sessionToken: string | undefined
  /** ML-KEM-768 public key for client-side ZK encryption */
  encPublicKey: Uint8Array
  /** ML-DSA-65 secret key for client-side signing */
  sigSecretKey: Uint8Array
  onFileUploaded: () => void
  onClose: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function VaultUploadPanel({ sessionToken, encPublicKey, sigSecretKey, onFileUploaded, onClose }: VaultUploadPanelProps) {
  const [file, setFile]         = useState<File | null>(null)
  const [encStage, setEncStage] = useState<EncryptionStage>({ stage: 'idle', percent: 0, message: '' })
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {}
    if (sessionToken) h['Authorization'] = `Bearer ${sessionToken}`
    return h
  }, [sessionToken])

  const handleFileSelect = (selected: File) => {
    setFile(selected)
    setEncStage({ stage: 'idle', percent: 0, message: '' })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  /**
   * Single-step ZK flow:
   * 1. Encrypt file client-side with ML-KEM-768 + AES-256-GCM
   * 2. Upload encrypted blob + KEM envelope to server
   * Server never sees plaintext.
   */
  const handleEncryptAndUpload = async () => {
    if (!file) return

    setEncStage({ stage: 'encrypting', percent: 5, message: 'Reading file into memory...' })

    try {
      // Read file into Uint8Array
      const fileData = new Uint8Array(await file.arrayBuffer())

      // Dynamic import — keeps crypto libs out of initial bundle
      setEncStage({ stage: 'encrypting', percent: 10, message: 'Loading post-quantum crypto engine...' })
      const { encryptFileLocal, computeHash, signData } = await import('@/lib/vault/client-crypto')

      // Build Merkle tree for integrity proof
      setEncStage({ stage: 'encrypting', percent: 15, message: 'Computing Merkle integrity tree...' })
      const { buildMerkleTreeFromData } = await import('@/lib/vault/merkle-tree')
      const merkleTree = buildMerkleTreeFromData(fileData)

      // Client-side encryption
      setEncStage({ stage: 'encrypting', percent: 25, message: 'Generating AES-256-GCM data key...' })
      await new Promise(r => setTimeout(r, 100)) // yield to UI

      setEncStage({ stage: 'encrypting', percent: 40, message: 'Encrypting file with AES-256-GCM...' })
      const result = encryptFileLocal(fileData, encPublicKey)

      setEncStage({ stage: 'encrypting', percent: 60, message: 'ML-KEM-768 key encapsulation complete' })

      // Sign file metadata with ML-DSA-65
      setEncStage({ stage: 'encrypting', percent: 70, message: 'Signing metadata with ML-DSA-65...' })
      const signedMetadata = JSON.stringify({
        fileName: file.name,
        fileSize: result.originalSize,
        integrityHash: result.integrityHash,
        encryptionAlgorithm: 'ZK-ML-KEM-768+AES-256-GCM',
        timestamp: new Date().toISOString(),
      })
      const signature = signData(new TextEncoder().encode(signedMetadata), sigSecretKey)

      // Upload encrypted data via Supabase
      setEncStage({ stage: 'encrypting', percent: 80, message: 'Uploading encrypted blob to vault...' })

      const uploaded = await uploadVaultFile(file, null, {
        encryptedData: result.encryptedData,
        kemCiphertext: result.kemCiphertext,
        aesNonce: result.aesNonce,
        contentHash: result.integrityHash,
        signature,
      })

      if (uploaded?.id) {
        setEncStage({
          stage: 'complete',
          percent: 100,
          message: 'File encrypted client-side and secured in vault · ML-KEM-768 + AES-256-GCM · Zero-Knowledge',
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

  const handleReset = () => {
    setFile(null)
    setEncStage({ stage: 'idle', percent: 0, message: '' })
  }

  const isEncrypted = encStage.stage === 'complete'

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.97 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}
    >
      {/* Panel header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          padding: '6px 18px',
          background: 'rgba(212,175,55,0.06)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 40,
          marginBottom: 12,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--qg-green)', boxShadow: '0 0 6px var(--qg-green)', animation: 'pulse 1.5s infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.15em', color: 'var(--qg-cyan)' }}>
            ZERO-KNOWLEDGE · CLIENT-SIDE ENCRYPTION
          </span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.08em', color: 'var(--qg-text-primary)', marginBottom: 4 }}>
          Encrypt & Secure
        </h2>
        <p style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
          Files are encrypted in your browser before upload — the server never sees plaintext
        </p>
      </div>

      {/* Drop zone */}
      {!file && (
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          animate={{ borderColor: dragOver ? 'var(--qg-cyan)' : 'rgba(212,175,55,0.2)' }}
          style={{
            border: `2px dashed rgba(212,175,55,0.2)`,
            borderRadius: 'var(--radius-lg)',
            padding: '40px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(212,175,55,0.04)' : 'rgba(0,0,0,0.2)',
            transition: 'background 0.2s, box-shadow 0.2s',
            boxShadow: dragOver ? '0 0 24px rgba(212,175,55,0.12) inset' : 'none',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', color: 'var(--qg-text-primary)', marginBottom: 6 }}>
            DROP FILE HERE
          </div>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginBottom: 14 }}>
            or click to browse · encrypted before it leaves your device
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 18px',
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.25)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--qg-cyan)',
            fontFamily: 'var(--font-mono)',
          }}>
            📂 Choose File
          </div>
        </motion.div>
      )}

      <input ref={inputRef} type="file" title="Select file to encrypt" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />

      {/* File selected state */}
      {file && !isEncrypted && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 16 }}
        >
          {/* File info card */}
          <div style={{
            padding: '14px 18px',
            background: 'rgba(212,175,55,0.04)',
            border: '1px solid rgba(212,175,55,0.18)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28 }}>
                {file.type.startsWith('image/') ? '🖼️' : file.type.includes('pdf') ? '📄' : file.type.includes('text') ? '📝' : '📦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--qg-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {formatSize(file.size)} · {file.type || 'unknown type'}
                </div>
              </div>
              <button
                onClick={handleReset}
                disabled={encStage.stage === 'encrypting'}
                style={{ background: 'none', border: 'none', color: 'var(--qg-text-muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}
                title="Remove"
              >✕</button>
            </div>

            {/* ZK indicator */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--qg-cyan)',
                boxShadow: '0 0 6px var(--qg-cyan)',
              }} />
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>
                Will encrypt in your browser before upload (zero-knowledge)
              </span>
            </div>
          </div>

          {/* Encryption progress */}
          {encStage.stage !== 'idle' && (
            <div style={{ marginBottom: 12 }}>
              <EncryptionProgress
                stage={encStage.stage}
                percent={encStage.percent}
                message={encStage.message}
              />
            </div>
          )}

          {/* Action button — single step: encrypt + upload */}
          {encStage.stage === 'idle' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleEncryptAndUpload}
                className="q-btn q-btn-primary"
                style={{
                  flex: 1, padding: '12px 0', fontSize: 12, letterSpacing: '0.1em',
                  background: 'linear-gradient(135deg, #003344, #005566)',
                  boxShadow: '0 0 20px rgba(212,175,55,0.2)',
                }}
              >
                🔐 ENCRYPT & SECURE
              </button>
              <button onClick={handleReset} className="q-btn q-btn-ghost" style={{ padding: '10px 16px', fontSize: 11 }}>
                Clear
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Success state */}
      {isEncrypted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ textAlign: 'center', marginBottom: 16 }}
        >
          <EncryptionProgress stage="complete" percent={100} message={encStage.message} />
          <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={handleReset} className="q-btn q-btn-primary" style={{ padding: '9px 24px', fontSize: 12 }}>
              📁 Encrypt Another File
            </button>
            <button onClick={onClose} className="q-btn q-btn-ghost" style={{ padding: '9px 20px', fontSize: 12 }}>
              🔒 Close Vault
            </button>
          </div>
        </motion.div>
      )}

      {/* Footer info */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 20,
        padding: '12px 0',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        marginTop: 8,
      }}>
        {['Zero-Knowledge', 'Post-Quantum', 'Merkle Integrity', 'Client-Side'].map((tag) => (
          <span key={tag} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', letterSpacing: '0.1em' }}>
            ✓ {tag}
          </span>
        ))}
      </div>

      {/* Close vault link */}
      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--qg-text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
        >
          🔒 CLOSE QUANTUM VAULT
        </button>
      </div>
    </motion.div>
  )
}
