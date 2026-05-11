'use client'

/**
 * Passphrase entry modal — replaces window.prompt for any flow that
 * collects the .qgkey wrapping passphrase.
 *
 * Modes:
 *   - 'create'  → two masked inputs (passphrase + confirm), strength
 *                 meter, hard minimum 12 characters, must match.
 *   - 'unlock'  → single masked input.
 *
 * The plaintext passphrase is held in component state only for the
 * duration of the modal. On submit/cancel/unmount we overwrite the
 * string state with empty values before calling the parent callback,
 * so React's reconciler discards the old strings as soon as possible.
 * (JS strings are immutable — we cannot truly zero them — but we
 * minimise the window.)
 */

import { useEffect, useId, useRef, useState } from 'react'

export type PassphraseModalMode = 'create' | 'unlock'

interface Props {
  open: boolean
  mode: PassphraseModalMode
  title: string
  description?: string
  /** Min length for create mode. Defaults to 12. */
  minLength?: number
  /** Called with the entered passphrase when the user submits. */
  onSubmit: (passphrase: string) => void
  /** Called when the user cancels or hits Escape. */
  onCancel: () => void
}

interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  color: string
  bits: number
}

/**
 * Conservative entropy estimate: bits ≈ length × log2(charset).
 * Not a substitute for zxcvbn but catches the obviously-bad cases
 * (short, single-class, all-lowercase) without adding a dependency.
 */
function estimateStrength(p: string): Strength {
  if (!p) return { score: 0, label: '—', color: 'rgba(255,255,255,0.2)', bits: 0 }
  let charset = 0
  if (/[a-z]/.test(p)) charset += 26
  if (/[A-Z]/.test(p)) charset += 26
  if (/[0-9]/.test(p)) charset += 10
  if (/[^a-zA-Z0-9]/.test(p)) charset += 32
  const bits = Math.round(p.length * Math.log2(Math.max(charset, 2)))
  let score: Strength['score'] = 0
  if (bits >= 28) score = 1
  if (bits >= 50) score = 2
  if (bits >= 70) score = 3
  if (bits >= 90) score = 4
  const labels: Record<number, [string, string]> = {
    0: ['Too weak', '#ff7070'],
    1: ['Weak', '#ff9a5a'],
    2: ['Fair', '#e0c050'],
    3: ['Strong', '#7ad97a'],
    4: ['Excellent', '#5af0a8'],
  }
  const [label, color] = labels[score]
  return { score, label, color, bits }
}

export default function PassphraseModal({
  open,
  mode,
  title,
  description,
  minLength = 12,
  onSubmit,
  onCancel,
}: Props) {
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [reveal, setReveal] = useState(false)
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const passId = useId()
  const confirmId = useId()

  // Reset state whenever the modal is closed.
  useEffect(() => {
    if (!open) {
      setPass('')
      setConfirm('')
      setReveal(false)
      setTouched(false)
    } else {
      // Focus the first field on open.
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const strength = estimateStrength(pass)
  const tooShort = mode === 'create' && pass.length > 0 && pass.length < minLength
  const mismatch = mode === 'create' && confirm.length > 0 && confirm !== pass
  const canSubmit =
    mode === 'unlock'
      ? pass.length > 0
      : pass.length >= minLength && confirm === pass && strength.score >= 2

  function submit() {
    if (!canSubmit) {
      setTouched(true)
      return
    }
    const value = pass
    // Clear local state before invoking callback.
    setPass('')
    setConfirm('')
    onSubmit(value)
  }

  function cancel() {
    setPass('')
    setConfirm('')
    onCancel()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${passId}-title`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'rgba(20,22,32,0.96)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: 24,
          color: '#fff',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div id={`${passId}-title`} style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
          {title}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, marginBottom: 16 }}>
            {description}
          </div>
        )}

        <label
          htmlFor={passId}
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 4 }}
        >
          Passphrase
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id={passId}
            ref={inputRef}
            type={reveal ? 'text' : 'password'}
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            spellCheck={false}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && mode === 'unlock') submit()
            }}
            style={{
              width: '100%',
              padding: '10px 44px 10px 12px',
              borderRadius: 10,
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${tooShort && touched ? '#ff7070' : 'rgba(255,255,255,0.12)'}`,
              color: '#fff',
              fontSize: 14,
              fontFamily: 'ui-monospace, monospace',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide passphrase' : 'Show passphrase'}
            tabIndex={-1}
            style={{
              position: 'absolute',
              right: 6,
              top: 6,
              padding: '4px 8px',
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.55)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {reveal ? 'hide' : 'show'}
          </button>
        </div>

        {mode === 'create' && (
          <>
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(strength.score / 4) * 100}%`,
                    background: strength.color,
                    transition: 'width 120ms ease, background 120ms ease',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  marginTop: 4,
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                <span style={{ color: strength.color }}>{strength.label}</span>
                <span>
                  {pass.length} chars · ~{strength.bits} bits
                </span>
              </div>
              {tooShort && touched && (
                <div style={{ fontSize: 11, color: '#ff7070', marginTop: 6 }}>
                  At least {minLength} characters required.
                </div>
              )}
            </div>

            <label
              htmlFor={confirmId}
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.6)',
                display: 'block',
                marginTop: 14,
                marginBottom: 4,
              }}
            >
              Confirm passphrase
            </label>
            <input
              id={confirmId}
              type={reveal ? 'text' : 'password'}
              autoComplete="new-password"
              spellCheck={false}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.3)',
                border: `1px solid ${mismatch ? '#ff7070' : 'rgba(255,255,255,0.12)'}`,
                color: '#fff',
                fontSize: 14,
                fontFamily: 'ui-monospace, monospace',
                boxSizing: 'border-box',
              }}
            />
            {mismatch && (
              <div style={{ fontSize: 11, color: '#ff7070', marginTop: 6 }}>
                Passphrases do not match.
              </div>
            )}
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.45)',
                marginTop: 12,
                lineHeight: 1.5,
              }}
            >
              ⚠ This passphrase cannot be recovered. If you lose it, the .qgkey bundle
              becomes unusable and any data sealed to this identity is unrecoverable.
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button
            type="button"
            onClick={cancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              background: canSubmit
                ? 'linear-gradient(135deg, #d4af37, #fff3c1)'
                : 'rgba(255,255,255,0.06)',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            {mode === 'create' ? 'Generate identity' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  )
}
