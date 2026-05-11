'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

// ─── Types ──────────────────────────────────────────────────

interface SharedFileInfo {
  encryptedPayload: string
  iv: string
  integrityHash: string
  originalFilename: string
  originalSize: number
  mimeType: string
  isPasswordProtected: boolean
  passwordSalt?: string
}

type PageState =
  | 'loading'
  | 'ready'
  | 'password_required'
  | 'decrypting'
  | 'decrypted'
  | 'error'
  | 'expired'
  | 'destroyed'

// ─── Helpers ────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(1)} GB`
}

function getMimeIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed')) return '📦'
  if (mime.includes('text') || mime.includes('json') || mime.includes('xml')) return '📝'
  return '📄'
}

// ─── Page ───────────────────────────────────────────────────

export default function SharedFilePage() {
  const params = useParams()
  const linkId = params?.id as string

  const [state, setState] = useState<PageState>('loading')
  const [fileInfo, setFileInfo] = useState<SharedFileInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [password, setPassword] = useState('')
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [remainingAttempts, setRemainingAttempts] = useState<number>(3)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Security: extract key from URL fragment, then scrub it ──
  // The key lives in the hash ONLY until we capture it in memory.
  // After that we wipe it from the URL bar and browser history entry
  // to reduce the window of exposure.
  const [shareKey, setShareKey] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash || hash.length < 2) return

    // Capture key into React state (memory-only)
    const key = hash.slice(1)
    setShareKey(key)

    // Scrub the fragment from the URL bar and current history entry
    // so it no longer appears in browser history or DevTools
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [])

  const getShareKey = useCallback((): string | null => {
    return shareKey
  }, [shareKey])

  // Fetch file metadata from server
  const fetchSharedFile = useCallback(async (passwordHash?: string) => {
    try {
      const res = await fetch('/api/v1/vault/share/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, passwordHash }),
      })

      const json = await res.json()

      if (!res.ok && json.error?._debug) {
        console.warn('[share debug]', json.error)
      }

      if (!res.ok) {
        const code = json.error?.code
        if (code === 'DESTROYED') {
          setState('destroyed')
          setErrorMsg(json.error.message)
          setRemainingAttempts(0)
          return
        }
        if (code === 'EXPIRED' || code === 'LIMIT_REACHED' || code === 'REVOKED') {
          setState('expired')
          setErrorMsg(json.error.message)
          return
        }
        if (code === 'WRONG_PASSWORD') {
          const remaining = json.error.remainingAttempts ?? 0
          setRemainingAttempts(remaining)
          if (remaining <= 0) {
            setState('destroyed')
            setErrorMsg('This link has been permanently destroyed due to too many failed attempts. The sender must share the file again.')
          } else {
            setErrorMsg(json.error.message)
            setState('password_required')
          }
          return
        }
        if (code === 'RATE_LIMITED') {
          setErrorMsg(json.error.message)
          setState('password_required')
          return
        }
        throw new Error(json.error?.message || 'Failed to load shared file')
      }

      if (json.data?.requiresPassword) {
        const remaining = json.data.remainingAttempts ?? 3
        setRemainingAttempts(remaining)
        setFileInfo({
          encryptedPayload: '',
          iv: '',
          integrityHash: '',
          originalFilename: json.data.originalFilename,
          originalSize: json.data.originalSize,
          mimeType: json.data.mimeType,
          isPasswordProtected: true,
        })
        setState('password_required')
        return
      }

      setFileInfo(json.data)
      setState('ready')
    } catch (err) {
      console.error('Fetch error:', err)
      setErrorMsg((err as Error).message)
      setState('error')
    }
  }, [linkId])

  useEffect(() => {
    if (linkId) fetchSharedFile()
  }, [linkId, fetchSharedFile])

  // Handle password submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const { hashPassword } = await import('@/lib/vault/sharing-crypto')
      const passwordHash = hashPassword(password)
      await fetchSharedFile(passwordHash)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Decrypt the file
  const handleDecrypt = async () => {
    const shareKey = getShareKey()
    if (!shareKey) {
      setErrorMsg('Decryption key not found in URL. The link may be incomplete.')
      setState('error')
      return
    }
    if (!fileInfo) return

    setState('decrypting')

    try {
      let decryptedData: Uint8Array

      if (fileInfo.isPasswordProtected && fileInfo.passwordSalt) {
        const { decryptSharedFileWithPassword } = await import('@/lib/vault/sharing-crypto')
        decryptedData = await decryptSharedFileWithPassword(
          fileInfo.encryptedPayload,
          fileInfo.iv,
          shareKey,
          password,
          fileInfo.passwordSalt,
          fileInfo.integrityHash,
        )
      } else {
        const { decryptSharedFile } = await import('@/lib/vault/sharing-crypto')
        decryptedData = await decryptSharedFile(
          fileInfo.encryptedPayload,
          fileInfo.iv,
          shareKey,
          fileInfo.integrityHash,
        )
      }

      const blob = new Blob([decryptedData.buffer as ArrayBuffer], { type: fileInfo.mimeType })
      setDecryptedBlob(blob)

      // Generate preview for supported types
      if (fileInfo.mimeType.startsWith('image/') || fileInfo.mimeType === 'application/pdf') {
        setPreviewUrl(URL.createObjectURL(blob))
      }

      setState('decrypted')
    } catch (err) {
      console.error('Decryption failed:', err)
      const msg = (err as Error).message
      if (msg.includes('INTEGRITY_CHECK_FAILED')) {
        setErrorMsg('Integrity check failed — file may have been tampered with!')
      } else {
        setErrorMsg('Decryption failed. The link may be invalid or corrupted.')
      }
      setState('error')
    }
  }

  // Download decrypted file
  const handleDownload = () => {
    if (!decryptedBlob || !fileInfo) return
    const url = URL.createObjectURL(decryptedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileInfo.originalFilename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <>
      {/* ── Security headers via meta tags ─────────────────────── */}
      {/* Prevent the URL (with fragment) from leaking via Referer  */}
      <meta name="referrer" content="no-referrer" />

      <div style={{
        minHeight: '100vh',
        background: 'var(--qg-bg, #010409)',
        color: 'var(--qg-text, #e6edf3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}>
        <div style={{
          maxWidth: 560, width: '100%',
          background: 'var(--qg-surface, #0d1117)',
          border: '1px solid var(--qg-border, #1e293b)',
          borderRadius: 16, padding: 32,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}>
          {/* Branding */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔐</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>QGuard Secure Share</h1>
          <p style={{ fontSize: 12, color: 'var(--qg-text-muted, #8b949e)', margin: 0 }}>
            Zero-Knowledge Encrypted File Transfer
          </p>
        </div>

        {/* ── Loading ────────────────────────────────── */}
        {state === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 40, height: 40, margin: '0 auto 16px',
              border: '3px solid var(--qg-border, #1e293b)',
              borderTopColor: 'var(--qg-cyan, #00d4ff)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{ fontSize: 13, color: 'var(--qg-text-muted)' }}>Loading shared file...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Password Required ──────────────────────── */}
        {state === 'password_required' && fileInfo && (
          <div>
            <div style={{
              padding: '14px 16px', borderRadius: 8,
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid var(--qg-border, #1e293b)',
              marginBottom: 20, textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{getMimeIcon(fileInfo.mimeType)}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{fileInfo.originalFilename}</div>
              <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
                {formatFileSize(fileInfo.originalSize)}
              </div>
            </div>

            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              marginBottom: 16, fontSize: 12,
              color: 'var(--qg-amber, #f59e0b)',
            }}>
              This file is password-protected. Enter the password to continue.
            </div>

            {/* Remaining attempts indicator */}
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              marginBottom: 16, fontSize: 12, textAlign: 'center',
              background: remainingAttempts <= 1
                ? 'rgba(239, 68, 68, 0.1)'
                : remainingAttempts === 2
                  ? 'rgba(245, 158, 11, 0.1)'
                  : 'rgba(0, 212, 255, 0.05)',
              border: `1px solid ${
                remainingAttempts <= 1
                  ? 'rgba(239, 68, 68, 0.3)'
                  : remainingAttempts === 2
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'var(--qg-border, #1e293b)'
              }`,
            }}>
              {/* Attempt dots */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: i <= (3 - remainingAttempts)
                      ? 'var(--qg-red, #ef4444)'
                      : 'rgba(16, 185, 129, 0.5)',
                    transition: 'background 0.3s ease',
                  }} />
                ))}
              </div>
              <span style={{
                color: remainingAttempts <= 1 ? 'var(--qg-red, #ef4444)' : 'var(--qg-text-muted, #8b949e)',
                fontWeight: remainingAttempts <= 1 ? 600 : 400,
              }}>
                {remainingAttempts} of 3 attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                {remainingAttempts <= 1 && ' — link will be destroyed on next failure!'}
              </span>
            </div>

            {errorMsg && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, marginBottom: 12,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                fontSize: 12, color: 'var(--qg-red, #ef4444)',
              }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorMsg('') }}
                placeholder="Enter password"
                autoFocus
                disabled={isSubmitting}
                style={{
                  width: '100%', padding: '10px 14px', fontSize: 14,
                  background: 'var(--qg-bg, #010409)', color: 'var(--qg-text, #e6edf3)',
                  border: `1px solid ${remainingAttempts <= 1 ? 'rgba(239, 68, 68, 0.4)' : 'var(--qg-border, #1e293b)'}`,
                  borderRadius: 8, marginBottom: 12, boxSizing: 'border-box',
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              />
              <button
                type="submit"
                disabled={!password || isSubmitting}
                style={{
                  width: '100%', padding: '10px 20px', fontSize: 13, fontWeight: 600,
                  background: password && !isSubmitting ? 'linear-gradient(135deg, #0891b2, #06b6d4)' : 'var(--qg-border)',
                  color: '#fff', border: 'none', borderRadius: 8,
                  cursor: password && !isSubmitting ? 'pointer' : 'not-allowed',
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                {isSubmitting ? 'Verifying...' : 'Unlock File'}
              </button>
            </form>
          </div>
        )}

        {/* ── Ready to Decrypt ───────────────────────── */}
        {state === 'ready' && fileInfo && (
          <div>
            <div style={{
              padding: '20px 16px', borderRadius: 8,
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid var(--qg-border, #1e293b)',
              marginBottom: 20, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{getMimeIcon(fileInfo.mimeType)}</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{fileInfo.originalFilename}</div>
              <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginTop: 4 }}>
                {formatFileSize(fileInfo.originalSize)} · Encrypted with AES-256-GCM
              </div>
            </div>

            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              marginBottom: 20, fontSize: 12,
              color: 'var(--qg-green, #10b981)',
            }}>
              Zero-Knowledge: Decryption happens entirely in your browser.
              The server never sees the decryption key or your file contents.
            </div>

            <button
              onClick={handleDecrypt}
              style={{
                width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 600,
                background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              🔓 Decrypt & Download
            </button>
          </div>
        )}

        {/* ── Decrypting ─────────────────────────────── */}
        {state === 'decrypting' && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 48, height: 48, margin: '0 auto 16px',
              border: '3px solid var(--qg-border, #1e293b)',
              borderTopColor: 'var(--qg-cyan, #00d4ff)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Decrypting file...</div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              Client-side AES-256-GCM decryption in progress
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Decrypted ──────────────────────────────── */}
        {state === 'decrypted' && fileInfo && (
          <div>
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              fontSize: 13, color: 'var(--qg-green, #10b981)',
              textAlign: 'center', fontWeight: 600,
            }}>
              ✅ File decrypted successfully
            </div>

            {/* Image Preview */}
            {previewUrl && fileInfo.mimeType.startsWith('image/') && (
              <div style={{
                marginBottom: 16, borderRadius: 8, overflow: 'hidden',
                border: '1px solid var(--qg-border, #1e293b)',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={fileInfo.originalFilename}
                  style={{ width: '100%', display: 'block', maxHeight: 400, objectFit: 'contain' }}
                />
              </div>
            )}

            {/* PDF Preview */}
            {previewUrl && fileInfo.mimeType === 'application/pdf' && (
              <div style={{
                marginBottom: 16, borderRadius: 8, overflow: 'hidden',
                border: '1px solid var(--qg-border, #1e293b)',
                height: 400,
              }}>
                <iframe
                  src={previewUrl}
                  title={fileInfo.originalFilename}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            )}

            <div style={{
              padding: '14px 16px', borderRadius: 8,
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid var(--qg-border, #1e293b)',
              marginBottom: 16, textAlign: 'center',
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{getMimeIcon(fileInfo.mimeType)}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{fileInfo.originalFilename}</div>
              <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
                {formatFileSize(fileInfo.originalSize)} · Integrity verified
              </div>
            </div>

            <button
              onClick={handleDownload}
              style={{
                width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 600,
                background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
                color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
              }}
            >
              💾 Save File
            </button>
          </div>
        )}

        {/* ── Destroyed (3 failed attempts) ────────────── */}
        {state === 'destroyed' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💀</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--qg-red, #ef4444)' }}>
              Link Permanently Destroyed
            </div>
            <div style={{
              padding: '12px 16px', borderRadius: 8, marginBottom: 16,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: 12, color: 'var(--qg-text-muted, #8b949e)', lineHeight: 1.6,
            }}>
              This shared link has been permanently destroyed after 3 failed password attempts.
              All encrypted data has been wiped from the server.
              <br /><br />
              <strong style={{ color: 'var(--qg-amber, #f59e0b)' }}>
                The sender must create a new share link to share this file again.
              </strong>
            </div>
            {/* Failed attempt dots */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: 'var(--qg-red, #ef4444)',
                }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--qg-text-muted)' }}>
              3 of 3 attempts used — link destroyed
            </div>
          </div>
        )}

        {/* ── Expired / Revoked ──────────────────────── */}
        {state === 'expired' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Link Unavailable
            </div>
            <div style={{ fontSize: 13, color: 'var(--qg-text-muted)' }}>
              {errorMsg || 'This shared link has expired or been revoked.'}
            </div>
          </div>
        )}

        {/* ── Error ──────────────────────────────────── */}
        {state === 'error' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--qg-red, #ef4444)' }}>
              Error
            </div>
            <div style={{ fontSize: 13, color: 'var(--qg-text-muted)', maxWidth: 400, margin: '0 auto' }}>
              {errorMsg || 'Something went wrong. The link may be invalid or incomplete.'}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center', marginTop: 24, paddingTop: 16,
          borderTop: '1px solid var(--qg-border, #1e293b)',
          fontSize: 11, color: 'var(--qg-text-muted, #8b949e)',
        }}>
          Secured by <strong>QGuard</strong> · Zero-Knowledge · PQC-Ready
        </div>
      </div>
    </div>
    </>
  )
}
