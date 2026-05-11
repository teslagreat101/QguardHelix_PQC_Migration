'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface EncryptionProgressProps {
  stage: 'idle' | 'encrypting' | 'complete' | 'error'
  percent: number
  message: string
}

const STAGE_LABELS: Record<string, { icon: string; label: string }> = {
  preparing:    { icon: '⚙️',  label: 'Preparing secure channel...' },
  keygen:       { icon: '🔑',  label: 'Generating ML-KEM-768 keypair...' },
  kem:          { icon: '🔐',  label: 'Applying quantum key encapsulation...' },
  aes:          { icon: '🛡️',  label: 'Encrypting with AES-256-GCM...' },
  signing:      { icon: '✍️',  label: 'Signing with ML-DSA-65...' },
  storing:      { icon: '💾',  label: 'Securing file in Quantum Vault...' },
  complete:     { icon: '✅',  label: 'Encryption complete. File secured.' },
  error:        { icon: '❌',  label: 'Encryption failed.' },
}

// Simulated stages for the UI animation
const SIM_STAGES = [
  { text: 'Initializing secure context...', pct: 5 },
  { text: 'Generating hybrid quantum keys...', pct: 20 },
  { text: 'Applying ML-KEM-768 encapsulation...', pct: 40 },
  { text: 'Encrypting with AES-256-GCM...', pct: 62 },
  { text: 'Signing with ML-DSA-65...', pct: 80 },
  { text: 'Sealing Quantum Vault...', pct: 95 },
]

export default function EncryptionProgress({ stage, percent, message }: EncryptionProgressProps) {
  const [logLines, setLogLines] = useState<string[]>([])
  const [simIdx, setSimIdx] = useState(0)

  // Build terminal log during encryption
  useEffect(() => {
    if (stage !== 'encrypting') return
    setLogLines([])
    setSimIdx(0)
  }, [stage])

  useEffect(() => {
    if (stage !== 'encrypting') return
    if (simIdx >= SIM_STAGES.length) return
    const t = setTimeout(() => {
      setLogLines(prev => [...prev, SIM_STAGES[simIdx].text])
      setSimIdx(s => s + 1)
    }, 600 * simIdx)
    return () => clearTimeout(t)
  }, [stage, simIdx])

  const isComplete = stage === 'complete'
  const isError    = stage === 'error'
  const isActive   = stage === 'encrypting'

  const borderColor = isComplete ? 'var(--qg-green)' : isError ? 'var(--qg-red)' : 'var(--qg-cyan)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      style={{
        background: 'rgba(3, 12, 25, 0.95)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        boxShadow: isComplete
          ? '0 0 24px rgba(48,209,88,0.15)'
          : isError
          ? '0 0 24px rgba(255,45,85,0.15)'
          : '0 0 24px rgba(212,175,55,0.12)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        {isActive && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--qg-cyan)',
            boxShadow: '0 0 8px var(--qg-cyan)',
            animation: 'pulse 1s ease-in-out infinite',
          }} />
        )}
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 12,
          letterSpacing: '0.1em',
          color: borderColor,
          fontWeight: 600,
        }}>
          {isComplete ? '✅ ENCRYPTION COMPLETE' : isError ? '❌ ENCRYPTION FAILED' : '🔐 QUANTUM ENCRYPTION ACTIVE'}
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-muted)' }}>
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, borderRadius: 2,
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        marginBottom: 14,
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            height: '100%',
            borderRadius: 2,
            background: isComplete
              ? 'linear-gradient(90deg, var(--qg-green), #00ff88)'
              : isError
              ? 'var(--qg-red)'
              : 'linear-gradient(90deg, #0088cc, var(--qg-cyan), #7fffff)',
            boxShadow: isComplete ? '0 0 8px var(--qg-green)' : '0 0 8px var(--qg-cyan)',
          }}
        />
      </div>

      {/* Terminal log */}
      {isActive && logLines.length > 0 && (
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          borderRadius: 6,
          padding: '10px 14px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--qg-text-muted)',
          maxHeight: 110,
          overflow: 'hidden',
        }}>
          {logLines.map((line, i) => (
            <div key={i} style={{
              color: i === logLines.length - 1 ? 'var(--qg-cyan)' : 'var(--qg-text-muted)',
              marginBottom: 3,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span style={{ color: 'var(--qg-green)', opacity: 0.7 }}>&gt;</span>
              {line}
              {i === logLines.length - 1 && (
                <span style={{ animation: 'pulse 1s infinite', marginLeft: 2, color: 'var(--qg-cyan)' }}>▋</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Final status */}
      {(isComplete || isError) && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: isComplete ? 'var(--qg-green)' : 'var(--qg-red)',
          marginTop: 4,
        }}>
          {message}
        </div>
      )}

      {/* Success details */}
      {isComplete && (
        <div style={{
          marginTop: 10, padding: '8px 12px',
          background: 'rgba(48,209,88,0.06)',
          border: '1px solid rgba(48,209,88,0.2)',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--qg-text-muted)',
          display: 'flex', gap: 20,
        }}>
          <span>🛡️ ML-KEM-768</span>
          <span>🔐 AES-256-GCM</span>
          <span>✍️ ML-DSA-65</span>
        </div>
      )}
    </motion.div>
  )
}
