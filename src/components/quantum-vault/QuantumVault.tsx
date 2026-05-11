'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import VaultDoor, { VaultState } from './VaultDoor'
import VaultUploadPanel from './VaultUploadPanel'
import VaultPassphrase from './VaultPassphrase'
import type { ZKMasterKeys } from '@/lib/vault/client-crypto'
import { fetchUserKeys, ensureVaultProfile } from '@/lib/vault/vault-service'

interface QuantumVaultProps {
  sessionToken: string | undefined
  onFileUploaded: () => void
  /** Called when ZK master keys are unlocked — parent can use for client-side decrypt */
  onKeysUnlocked?: (keys: ZKMasterKeys) => void
}

export default function QuantumVault({ sessionToken, onFileUploaded, onKeysUnlocked }: QuantumVaultProps) {
  const [vaultState, setVaultState] = useState<VaultState>('idle')
  const [zkKeys, setZkKeys] = useState<ZKMasterKeys | null>(null)
  const [hasServerKeys, setHasServerKeys] = useState<boolean | null>(null) // null = not checked yet
  const [authError, setAuthError] = useState<string | null>(null)

  const handleOpenVault = async () => {
    if (vaultState !== 'idle') return
    setVaultState('opening')
    setAuthError(null)

    // Check if user already has ZK keys in Supabase (don't block animation)
    if (hasServerKeys === null) {
      try {
        await ensureVaultProfile()
        const keys = await fetchUserKeys()
        setHasServerKeys(!!keys)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Vault service error'
        if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('not authenticated')) {
          setVaultState('idle')
          setAuthError('Session error. Please sign out and back in, then try again.')
          return
        }
        // Network error — assume no keys so user can still create
        setHasServerKeys(false)
      }
    }
  }

  const handleOpenComplete = useCallback(() => {
    setVaultState('opened')
  }, [])

  const handleCloseVault = () => {
    setVaultState('idle')
  }

  const handleKeysReady = (keys: ZKMasterKeys) => {
    setZkKeys(keys)
    setHasServerKeys(true)
    onKeysUnlocked?.(keys)
  }

  const isOpen = vaultState === 'opened' || vaultState === 'uploading' || vaultState === 'encrypting' || vaultState === 'complete'
  const needsPassphrase = isOpen && !zkKeys

  return (
    <section style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '32px 0 40px',
      marginBottom: 32,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background atmosphere */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,100,150,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Scanline texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212,175,55,0.008) 2px, rgba(212,175,55,0.008) 4px)',
        pointerEvents: 'none',
      }} />

      {/* Section label */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 20,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.2em',
          color: 'var(--qg-text-muted)',
          textTransform: 'uppercase',
        }}
      >
        <div style={{ width: 24, height: 1, background: 'var(--qg-cyan)', opacity: 0.4 }} />
        QUANTUM SECURE VAULT — FIPS 203 COMPLIANT · ZERO KNOWLEDGE
        <div style={{ width: 24, height: 1, background: 'var(--qg-cyan)', opacity: 0.4 }} />
      </motion.div>

      {/* Auth error banner */}
      {authError && (
        <div style={{
          width: '100%', maxWidth: 520, marginBottom: 16,
          padding: '10px 16px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--qg-red, #ef4444)',
          fontFamily: 'var(--font-mono)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚠</span>
          <span>{authError}</span>
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── CLOSED VAULT STATE ─────────────────────────────── */}
        {!isOpen && (
          <motion.div
            key="vault-door"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            {/* Status bar above vault */}
            <div style={{
              display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center',
            }}>
              {[
                { label: 'VAULT STATUS',    value: vaultState === 'opening' ? 'UNLOCKING' : 'SECURED', color: vaultState === 'opening' ? 'var(--qg-amber)' : 'var(--qg-green)' },
                { label: 'ENCRYPTION',      value: 'ML-KEM-768',   color: 'var(--qg-cyan)' },
                { label: 'INTEGRITY',       value: 'ML-DSA-65',    color: 'var(--qg-violet)' },
                { label: 'ARCHITECTURE',    value: 'ZERO-KNOWLEDGE', color: 'var(--qg-green)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 40,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--qg-text-muted)', letterSpacing: '0.12em' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, fontWeight: 600, letterSpacing: '0.1em' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Vault door */}
            <div
              onClick={vaultState === 'idle' ? handleOpenVault : undefined}
              style={{
                cursor: vaultState === 'idle' ? 'pointer' : 'default',
                transition: 'filter 0.3s',
              }}
              onMouseEnter={(e) => {
                if (vaultState === 'idle') (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1.15) drop-shadow(0 0 30px rgba(212,175,55,0.3))'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.filter = 'none'
              }}
              title={vaultState === 'idle' ? 'Click to open Quantum Vault' : ''}
            >
              <VaultDoor vaultState={vaultState} onOpenComplete={handleOpenComplete} />
            </div>

            {/* Open button */}
            {vaultState === 'idle' && (
              <motion.button
                onClick={handleOpenVault}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  marginTop: 24,
                  padding: '13px 36px',
                  background: 'linear-gradient(135deg, rgba(0,60,90,0.9), rgba(0,100,140,0.8))',
                  border: '1px solid rgba(212,175,55,0.4)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--qg-cyan)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                  boxShadow: '0 0 24px rgba(212,175,55,0.15)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Button shimmer */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(105deg, transparent 40%, rgba(212,175,55,0.06) 50%, transparent 60%)',
                  animation: 'shimmer 2.5s infinite',
                }} />
                <style>{`@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }`}</style>
                🔓 OPEN QUANTUM VAULT
              </motion.button>
            )}

            {/* Opening state message */}
            {vaultState === 'opening' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  marginTop: 20,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--qg-cyan)',
                  letterSpacing: '0.2em',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--qg-cyan)', animation: 'pulse 0.4s infinite' }} />
                INITIALIZING QUANTUM DECRYPTION SEQUENCE...
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ── PASSPHRASE GATE ──────────────────────────────── */}
        {needsPassphrase && (
          <motion.div
            key="vault-passphrase"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', maxWidth: 520, padding: '0 16px' }}
          >
            <VaultPassphrase
              mode={hasServerKeys ? 'unlock' : 'create'}
              sessionToken={sessionToken}
              onKeysReady={handleKeysReady}
              onCancel={handleCloseVault}
            />
          </motion.div>
        )}

        {/* ── OPEN VAULT STATE (upload panel) ─────────────── */}
        {isOpen && zkKeys && (
          <motion.div
            key="vault-panel"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', maxWidth: 600, padding: '0 16px' }}
          >
            {/* Open status badge */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '5px 14px',
                background: 'rgba(212,175,55,0.05)',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: 40,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--qg-green)', boxShadow: '0 0 6px var(--qg-green)', animation: 'pulse 2s infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--qg-cyan)', letterSpacing: '0.18em' }}>
                  VAULT OPEN · ZERO-KNOWLEDGE ENCRYPTION ACTIVE
                </span>
              </div>
            </div>

            <VaultUploadPanel
              sessionToken={sessionToken}
              encPublicKey={zkKeys.encPublicKey}
              sigSecretKey={zkKeys.sigSecretKey}
              onFileUploaded={onFileUploaded}
              onClose={handleCloseVault}
            />
          </motion.div>
        )}

      </AnimatePresence>
    </section>
  )
}
