'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ZKMasterKeys, WrappedMasterKeys } from '@/lib/vault/client-crypto'
import { fetchUserKeys, storeUserKeys } from '@/lib/vault/vault-service'

interface VaultPassphraseProps {
  mode: 'create' | 'unlock'
  sessionToken: string | undefined
  onKeysReady: (keys: ZKMasterKeys) => void
  onCancel: () => void
}

const MIN_PASSPHRASE_LENGTH = 12

export default function VaultPassphrase({ mode, sessionToken, onKeysReady, onCancel }: VaultPassphraseProps) {
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStage] = useState('')

  const isCreate = mode === 'create'
  const isValid = isCreate
    ? passphrase.length >= MIN_PASSPHRASE_LENGTH && passphrase === confirmPassphrase
    : passphrase.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid || loading) return

    setLoading(true)
    setError('')

    try {
      // Dynamic import to keep bundle split — crypto libs are large
      const {
        generateMasterKeys,
        wrapMasterKeys,
        unwrapMasterKeys,
      } = await import('@/lib/vault/client-crypto')

      if (isCreate) {
        // ── CREATE: Generate keypairs, wrap with passphrase, store on server ──
        setStage('Generating ML-KEM-768 + ML-DSA-65 keypairs...')
        const masterKeys = await generateMasterKeys()

        setStage('Deriving key from passphrase (PBKDF2 · 600K rounds)...')
        const wrapped = await wrapMasterKeys(masterKeys, passphrase)

        setStage('Storing wrapped keys in vault...')
        // Helper to convert Uint8Array to hex
        const toHex = (bytes: Uint8Array) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
        await storeUserKeys(wrapped, toHex(masterKeys.encPublicKey), toHex(masterKeys.signPublicKey))

        onKeysReady(masterKeys)
      } else {
        // ── UNLOCK: Fetch wrapped keys from Supabase, unwrap with passphrase ──
        setStage('Fetching wrapped keys...')
        const userKeys = await fetchUserKeys()

        if (!userKeys) {
          throw new Error('No keys found — please create a vault passphrase first')
        }

        setStage('Deriving key from passphrase (PBKDF2 · 600K rounds)...')
        const wrappedData: WrappedMasterKeys = userKeys

        setStage('Unwrapping secret keys...')
        const masterKeys = await unwrapMasterKeys(wrappedData.wrapped_bundle, passphrase)

        onKeysReady(masterKeys)
      }
    } catch (err) {
      const msg = (err as Error).message
      const msgLower = msg.toLowerCase()
      if (msgLower.includes('tag') || msgLower.includes('decrypt')) {
        setError('Incorrect passphrase. Please try again.')
      } else if (msgLower.includes('authentication') || msgLower.includes('unauthorized')) {
        setError('Session error. Please reload the page and try again.')
      } else {
        setError(msg || 'Something went wrong')
      }
    } finally {
      setLoading(false)
      setStage('')
    }
  }

  const strengthScore = (() => {
    let score = 0
    if (passphrase.length >= 12) score++
    if (passphrase.length >= 16) score++
    if (/[A-Z]/.test(passphrase) && /[a-z]/.test(passphrase)) score++
    if (/[0-9]/.test(passphrase)) score++
    if (/[^A-Za-z0-9]/.test(passphrase)) score++
    return score
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][strengthScore] || ''
  const strengthColor = ['', 'var(--qg-red, #ef4444)', 'var(--qg-amber)', 'var(--qg-cyan)', 'var(--qg-green)', 'var(--qg-green)'][strengthScore] || ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{ width: '100%', maxWidth: 460, margin: '0 auto' }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 14px',
          background: 'rgba(212,175,55,0.06)',
          border: '1px solid rgba(212,175,55,0.2)',
          borderRadius: 40,
          marginBottom: 14,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--qg-cyan)', boxShadow: '0 0 6px var(--qg-cyan)', animation: 'pulse 2s infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em', color: 'var(--qg-cyan)' }}>
            {isCreate ? 'ZERO-KNOWLEDGE SETUP' : 'VAULT AUTHENTICATION'}
          </span>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: '0.06em', color: 'var(--qg-text-primary)', marginBottom: 6 }}>
          {isCreate ? 'Create Vault Passphrase' : 'Unlock Vault'}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--qg-text-muted)', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
          {isCreate
            ? 'Your passphrase protects your master encryption keys. It never leaves your browser — zero-knowledge architecture.'
            : 'Enter your passphrase to decrypt your master keys. All decryption happens locally in your browser.'}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>
            {isCreate ? 'VAULT PASSPHRASE' : 'PASSPHRASE'}
          </label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => { setPassphrase(e.target.value); setError('') }}
            placeholder={isCreate ? 'Minimum 12 characters' : 'Enter your vault passphrase'}
            autoFocus
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--qg-text-primary)',
              fontSize: 14,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Strength meter (create mode only) */}
          {isCreate && passphrase.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: i <= strengthScore ? strengthColor : 'rgba(255,255,255,0.08)',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: strengthColor, fontFamily: 'var(--font-mono)' }}>
                {strengthLabel}
                {passphrase.length < MIN_PASSPHRASE_LENGTH && ` · ${MIN_PASSPHRASE_LENGTH - passphrase.length} more characters needed`}
              </div>
            </div>
          )}
        </div>

        {/* Confirm passphrase (create mode) */}
        <AnimatePresence>
          {isCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 16, overflow: 'hidden' }}
            >
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>
                CONFIRM PASSPHRASE
              </label>
              <input
                type="password"
                value={confirmPassphrase}
                onChange={(e) => { setConfirmPassphrase(e.target.value); setError('') }}
                placeholder="Repeat your passphrase"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${confirmPassphrase && confirmPassphrase !== passphrase ? 'var(--qg-red, #ef4444)' : 'rgba(212,175,55,0.2)'}`,
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--qg-text-primary)',
                  fontSize: 14,
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {confirmPassphrase && confirmPassphrase !== passphrase && (
                <div style={{ fontSize: 10, color: 'var(--qg-red, #ef4444)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  Passphrases do not match
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: '10px 14px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              color: 'var(--qg-red, #ef4444)',
              marginBottom: 16,
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Loading stage */}
        {loading && stage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: '10px 14px',
              background: 'rgba(212,175,55,0.04)',
              border: '1px solid rgba(212,175,55,0.15)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--qg-cyan)',
              animation: 'pulse 0.6s infinite',
            }} />
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', letterSpacing: '0.05em' }}>
              {stage}
            </span>
          </motion.div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="submit"
            disabled={!isValid || loading}
            className="q-btn q-btn-primary"
            style={{
              flex: 1,
              padding: '12px 0',
              fontSize: 12,
              letterSpacing: '0.1em',
              opacity: (!isValid || loading) ? 0.5 : 1,
              cursor: (!isValid || loading) ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳ Processing...' : isCreate ? '🔐 CREATE VAULT KEYS' : '🔓 UNLOCK VAULT'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="q-btn q-btn-ghost"
            style={{ padding: '12px 20px', fontSize: 12 }}
          >
            Cancel
          </button>
        </div>
      </form>

      {/* ZK info footer */}
      <div style={{
        marginTop: 20,
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 'var(--radius-md)',
        fontSize: 10,
        color: 'var(--qg-text-muted)',
        lineHeight: 1.6,
        fontFamily: 'var(--font-mono)',
      }}>
        <div style={{ color: 'var(--qg-cyan)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.1em' }}>
          ZERO-KNOWLEDGE ARCHITECTURE
        </div>
        {isCreate ? (
          <>
            Your passphrase derives a Key Encryption Key (KEK) via PBKDF2-SHA256 with 600,000 iterations.
            The KEK wraps your ML-KEM-768 + ML-DSA-65 master secret keys using AES-256-GCM.
            Only the wrapped (encrypted) keys are stored on the server. Your passphrase and raw keys never leave this browser.
          </>
        ) : (
          <>
            Your passphrase is used locally to derive the KEK and unwrap your master keys.
            The server only stores encrypted blobs — it cannot decrypt your files even if compromised.
          </>
        )}
      </div>
    </motion.div>
  )
}
