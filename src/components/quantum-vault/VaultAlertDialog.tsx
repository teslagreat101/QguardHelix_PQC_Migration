'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export type VaultAlertVariant = 'info' | 'warning' | 'error' | 'success'

export interface VaultAlertAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'ghost'
  autoFocus?: boolean
}

interface VaultAlertDialogProps {
  open: boolean
  title: string
  description: string
  variant?: VaultAlertVariant
  actions?: VaultAlertAction[]
  onClose: () => void
}

const VARIANT_STYLES: Record<VaultAlertVariant, { accent: string; glow: string; icon: string }> = {
  info:    { accent: 'var(--qg-cyan)',   glow: 'rgba(212, 175, 55, 0.35)',  icon: 'ℹ' },
  warning: { accent: 'var(--qg-amber)',  glow: 'rgba(255, 204, 0, 0.35)',  icon: '⚠' },
  error:   { accent: '#ef4444',          glow: 'rgba(239, 68, 68, 0.35)',  icon: '✕' },
  success: { accent: '#10b981',          glow: 'rgba(16, 185, 129, 0.35)', icon: '✓' },
}

export default function VaultAlertDialog({
  open,
  title,
  description,
  variant = 'info',
  actions,
  onClose,
}: VaultAlertDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const { accent, glow, icon } = VARIANT_STYLES[variant]

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  const resolvedActions: VaultAlertAction[] =
    actions && actions.length > 0
      ? actions
      : [{ label: 'OK', onClick: onClose, variant: 'primary', autoFocus: true }]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(4, 8, 14, 0.72)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="vault-alert-title"
            aria-describedby="vault-alert-description"
            tabIndex={-1}
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(12, 18, 28, 0.98) 0%, rgba(8, 12, 20, 0.98) 100%)',
              border: `1px solid ${accent}`,
              borderRadius: 14,
              boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px ${glow}`,
              overflow: 'hidden',
              outline: 'none',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              }}
            />

            <div style={{ padding: '24px 24px 20px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: accent,
                  background: `${accent}1A`,
                  border: `1px solid ${accent}55`,
                }}
              >
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  id="vault-alert-title"
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--qg-text, #e6f0ff)',
                    letterSpacing: 0.2,
                  }}
                >
                  {title}
                </h2>
                <p
                  id="vault-alert-description"
                  style={{
                    margin: '8px 0 0',
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: 'var(--qg-text-muted, #9fb3c8)',
                  }}
                >
                  {description}
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                padding: '16px 20px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,0,0,0.25)',
              }}
            >
              {resolvedActions.map((action, idx) => {
                const isPrimary = (action.variant ?? 'primary') === 'primary'
                return (
                  <button
                    key={`${action.label}-${idx}`}
                    autoFocus={action.autoFocus}
                    onClick={action.onClick}
                    style={{
                      padding: '8px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      border: isPrimary ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.12)',
                      background: isPrimary ? `${accent}22` : 'transparent',
                      color: isPrimary ? accent : 'var(--qg-text-muted, #9fb3c8)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isPrimary ? `${accent}33` : 'rgba(255,255,255,0.06)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isPrimary ? `${accent}22` : 'transparent'
                    }}
                  >
                    {action.label}
                  </button>
                )
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
