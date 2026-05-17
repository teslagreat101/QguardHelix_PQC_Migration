'use client'

import { useState } from 'react'
import { createSharedLink } from '@/lib/vault/vault-service-enhanced'

interface ShareLinkModalProps {
  fileId: string
  fileName: string
  isOpen: boolean
  onClose: () => void
  onShareCreated: () => void
  authHeaders: Record<string, string>
  /** Pre-decrypted plaintext bytes for the file to share */
  getFileData: () => Promise<Uint8Array>
}

type ExpirationOption = {
  label: string
  seconds: number | null
}

const EXPIRATION_OPTIONS: ExpirationOption[] = [
  { label: 'No expiration', seconds: null },
  { label: '1 hour', seconds: 3600 },
  { label: '24 hours', seconds: 86400 },
  { label: '7 days', seconds: 604800 },
  { label: '30 days', seconds: 2592000 },
]

const MAX_DOWNLOAD_OPTIONS = [
  { label: 'Unlimited', value: null },
  { label: '1 download (one-time)', value: 1 },
  { label: '5 downloads', value: 5 },
  { label: '10 downloads', value: 10 },
  { label: '25 downloads', value: 25 },
]

const MIN_SHARE_PASSWORD_LENGTH = 12

function isSharePasswordStrong(value: string): boolean {
  if (value.length < MIN_SHARE_PASSWORD_LENGTH) return false
  const classes = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length
  return classes >= 3
}

export default function ShareLinkModal({
  fileId,
  fileName,
  isOpen,
  onClose,
  onShareCreated,
  authHeaders,
  getFileData,
}: ShareLinkModalProps) {
  const [step, setStep] = useState<'configure' | 'encrypting' | 'done' | 'error'>('configure')
  const [shareLink, setShareLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Options
  const [expiresIn, setExpiresIn] = useState<number | null>(86400) // default 24h
  const [maxDownloads, setMaxDownloads] = useState<number | null>(null)
  const [usePassword, setUsePassword] = useState(false)
  const [password, setPassword] = useState('')

  if (!isOpen) return null

  const handleCreate = async () => {
    setErrorMsg('')
    const isPasswordProtected = usePassword && password.length > 0

    if (usePassword && !isSharePasswordStrong(password)) {
      setErrorMsg(`Use at least ${MIN_SHARE_PASSWORD_LENGTH} characters with 3 character types for password-protected shares.`)
      return
    }

    setStep('encrypting')
    let fileData: Uint8Array | null = null

    try {
      // 1. Get plaintext file data
      fileData = await getFileData()

      // 2. Encrypt client-side for sharing (dynamic import to keep bundle lean)
      let result: {
        encryptedPayload: string
        iv: string
        integrityHash: string
        shareKey?: string
        passwordSalt?: string
        passwordHash?: string
      }

      if (isPasswordProtected) {
        const { encryptForSharingWithPassword } = await import('@/lib/vault/sharing-crypto')
        result = await encryptForSharingWithPassword(fileData, password)
      } else {
        const { encryptForSharing } = await import('@/lib/vault/sharing-crypto')
        result = await encryptForSharing(fileData)
      }

      // 3. Send encrypted payload to Supabase (key NEVER leaves browser)
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : undefined

      const created = await createSharedLink({
        fileId,
        originalFilename: fileName,
        originalSize: fileData.length,
        mimeType: 'application/octet-stream',
        encryptedFileData: new TextEncoder().encode(result.encryptedPayload),
        encryptionMetadata: {
          iv: result.iv,
          integrityHash: result.integrityHash,
          encryptedPayload: result.encryptedPayload,
          passwordSalt: result.passwordSalt,
        },
        isPasswordProtected,
        passwordHash: result.passwordHash,
        maxDownloads: maxDownloads ?? undefined,
        expiresAt,
        isOneTime: maxDownloads === 1,
      })

      // 4. Build the share link. Password-protected links do not carry the
      // decryption key; the recipient derives it locally from the password.
      const origin = window.location.origin
      if (!isPasswordProtected && !result.shareKey) {
        throw new Error('Share key generation failed. Please try again.')
      }
      const link = isPasswordProtected
        ? `${origin}/vault/shared/${created.id}`
        : `${origin}/vault/shared/${created.id}#${result.shareKey}`

      setShareLink(link)
      setStep('done')
      onShareCreated()
    } catch (err) {
      console.error('Share creation failed:', err)
      setErrorMsg((err as Error).message || 'Failed to create share link')
      setStep('error')
    } finally {
      fileData?.fill(0)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = shareLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    setStep('configure')
    setShareLink('')
    setCopied(false)
    setErrorMsg('')
    setPassword('')
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
    }} onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="glass-panel" style={{ borderRadius: "var(--radius-lg, 12px)", padding: 28, maxWidth: 520, width: "90%" }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔗 Secure Share
          </h3>
          <button onClick={handleClose} className="q-btn q-btn-ghost"
            style={{ padding: '4px 8px', fontSize: 14, lineHeight: 1 }}>✕</button>
        </div>

        {/* File info */}
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-md, 8px)',
          background: 'rgba(212, 175, 55, 0.05)', border: '1px solid var(--qg-border, #1e293b)',
          marginBottom: 20, fontSize: 13,
        }}>
          <span style={{ color: 'var(--qg-text-muted)' }}>File: </span>
          <span style={{ fontWeight: 600 }}>{fileName}</span>
        </div>

        {/* ── Configure Step ─────────────────────────── */}
        {step === 'configure' && (
          <div>
            {/* Zero-knowledge notice */}
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
              marginBottom: 20, fontSize: 12, color: 'var(--qg-green, #10b981)',
            }}>
              {usePassword
                ? 'Password-protected sharing: the file is encrypted in your browser with AES-256-GCM using a key derived from the password. The generated link will not contain the file decryption key.'
                : 'Zero-knowledge link sharing: the file is encrypted in your browser with AES-256-GCM. The decryption key is placed in the URL fragment (#) and is never sent to the server.'}
            </div>

            {/* Expiration */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--qg-text-muted)' }}>
                Link Expiration
              </label>
              <select
                value={expiresIn ?? ''}
                onChange={(e) => setExpiresIn(e.target.value === '' ? null : Number(e.target.value))}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13,
                  background: 'var(--qg-bg, #010409)', color: 'var(--qg-text, #e6edf3)',
                  border: '1px solid var(--qg-border, #1e293b)', borderRadius: 'var(--radius-md, 8px)',
                }}
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.seconds ?? ''}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Max Downloads */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, color: 'var(--qg-text-muted)' }}>
                Download Limit
              </label>
              <select
                value={maxDownloads ?? ''}
                onChange={(e) => setMaxDownloads(e.target.value === '' ? null : Number(e.target.value))}
                style={{
                  width: '100%', padding: '8px 12px', fontSize: 13,
                  background: 'var(--qg-bg, #010409)', color: 'var(--qg-text, #e6edf3)',
                  border: '1px solid var(--qg-border, #1e293b)', borderRadius: 'var(--radius-md, 8px)',
                }}
              >
                {MAX_DOWNLOAD_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ''}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Password Protection */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 8, color: 'var(--qg-text-muted)', cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  style={{ accentColor: 'var(--qg-cyan)' }}
                />
                Password Protection (requires both link + password)
              </label>
              {usePassword && (
                <>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrorMsg('') }}
                    placeholder={`Enter at least ${MIN_SHARE_PASSWORD_LENGTH} characters`}
                    style={{
                      width: '100%', padding: '8px 12px', fontSize: 13,
                      background: 'var(--qg-bg, #010409)', color: 'var(--qg-text, #e6edf3)',
                      border: `1px solid ${password && !isSharePasswordStrong(password) ? 'rgba(245,158,11,0.55)' : 'var(--qg-border, #1e293b)'}`,
                      borderRadius: 'var(--radius-md, 8px)',
                    }}
                  />
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--qg-text-muted)' }}>
                    Use at least {MIN_SHARE_PASSWORD_LENGTH} characters with 3 character types. Send it through a separate trusted channel.
                  </div>
                </>
              )}
            </div>

            {errorMsg && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md, 8px)',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)',
                color: 'var(--qg-amber, #f59e0b)',
                fontSize: 12,
                marginBottom: 14,
              }}>
                {errorMsg}
              </div>
            )}

            {/* Create button */}
            <button
              className="q-btn q-btn-primary"
              style={{ width: '100%', padding: '10px 20px', fontSize: 13 }}
              onClick={handleCreate}
              aria-disabled={usePassword && !isSharePasswordStrong(password)}
              title={usePassword && !isSharePasswordStrong(password)
                ? `Use at least ${MIN_SHARE_PASSWORD_LENGTH} characters with 3 character types.`
                : 'Encrypt and generate secure share link'}
            >
              🔐 Encrypt & Generate Share Link
            </button>
          </div>
        )}

        {/* ── Encrypting Step ────────────────────────── */}
        {step === 'encrypting' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{
              width: 48, height: 48, margin: '0 auto 16px',
              borderWidth: 3,
              borderStyle: 'solid',
              borderColor: 'var(--qg-border, #1e293b)',
              borderTopColor: 'var(--qg-cyan, #d4af37)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Encrypting file...
            </div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)' }}>
              Client-side AES-256-GCM encryption in progress
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Done Step ──────────────────────────────── */}
        {step === 'done' && (
          <div>
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
              marginBottom: 16, fontSize: 12, color: 'var(--qg-green, #10b981)',
            }}>
              {usePassword
                ? 'Password-protected share created. The recipient needs this link and the password; the file decryption key is derived locally in their browser and is not embedded in the URL.'
                : 'Secure share link created. The decryption key is in the link fragment (#) and is never stored on or transmitted to our servers. Share this link only through trusted, secure channels.'}
            </div>

            {/* Share link display */}
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md, 8px)',
              background: 'var(--qg-bg, #010409)', border: '1px solid var(--qg-border, #1e293b)',
              marginBottom: 16, wordBreak: 'break-all', fontSize: 12,
              fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan, #d4af37)',
              maxHeight: 100, overflow: 'auto',
            }}>
              {shareLink}
            </div>

            {/* Copy button */}
            <button
              className="q-btn q-btn-primary"
              style={{ width: '100%', padding: '10px 20px', fontSize: 13, marginBottom: 12 }}
              onClick={handleCopy}
            >
              {copied ? '✅ Copied!' : '📋 Copy Link to Clipboard'}
            </button>

            {/* Security info */}
            <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', lineHeight: 1.6 }}>
              <div>
                {expiresIn ? `Expires in ${EXPIRATION_OPTIONS.find(o => o.seconds === expiresIn)?.label}` : 'No expiration'}
                {maxDownloads ? ` · ${maxDownloads} download${maxDownloads === 1 ? '' : 's'} max` : ''}
                {usePassword ? ' · Password protected' : ''}
              </div>
              <div style={{ marginTop: 4, color: 'var(--qg-amber, #f59e0b)' }}>
                {usePassword
                  ? 'Send the password separately. Anyone without the password cannot decrypt this file.'
                  : 'Anyone with the full link can decrypt the file. Share it securely.'}
              </div>
            </div>
          </div>
        )}

        {/* ── Error Step ─────────────────────────────── */}
        {step === 'error' && (
          <div>
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--radius-md, 8px)',
              background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: 16, fontSize: 13, color: 'var(--qg-red, #ef4444)',
            }}>
              {errorMsg || 'An unexpected error occurred'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="q-btn q-btn-primary" style={{ flex: 1, padding: '8px 16px', fontSize: 12 }}
                onClick={() => setStep('configure')}>
                Try Again
              </button>
              <button className="q-btn q-btn-ghost" style={{ padding: '8px 16px', fontSize: 12 }}
                onClick={handleClose}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
