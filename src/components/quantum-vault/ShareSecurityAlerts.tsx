'use client'

import { useEffect, useRef } from 'react'
import { useShareLinkEvents, type ShareLinkSecurityEvent } from '@/hooks/use-share-link-events'

/**
 * Real-time security alert overlay for vault share links.
 * Shows toast notifications when:
 * - Someone fails a password attempt on an owner's shared link
 * - A shared link is auto-destroyed after 3 failed attempts
 *
 * Integrates via SSE hook — no polling.
 */
export default function ShareSecurityAlerts({ onLinkDestroyed }: { onLinkDestroyed?: () => void }) {
  const { events, dismissEvent, dismissAll } = useShareLinkEvents()
  const prevEventsLenRef = useRef(0)

  // Auto-refresh shared links when a link is destroyed
  useEffect(() => {
    if (events.length > prevEventsLenRef.current) {
      const latest = events[0]
      if (latest?.type === 'link_destroyed' && onLinkDestroyed) {
        onLinkDestroyed()
      }
    }
    prevEventsLenRef.current = events.length
  }, [events, onLinkDestroyed])

  if (events.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 10000,
      display: 'flex', flexDirection: 'column', gap: 10,
      maxWidth: 400, width: '100%', pointerEvents: 'none',
    }}>
      {/* Dismiss all button */}
      {events.length > 1 && (
        <button
          onClick={dismissAll}
          style={{
            alignSelf: 'flex-end', pointerEvents: 'auto',
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            background: 'rgba(0, 0, 0, 0.6)', color: 'var(--qg-text-muted, #8b949e)',
            border: '1px solid var(--qg-border, #1e293b)', borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Dismiss all ({events.length})
        </button>
      )}

      {events.slice(0, 5).map((event, index) => (
        <AlertToast key={`${event.linkId}-${event.timestamp}`} event={event} onDismiss={() => dismissEvent(index)} />
      ))}
    </div>
  )
}

function AlertToast({ event, onDismiss }: { event: ShareLinkSecurityEvent; onDismiss: () => void }) {
  const isDestroyed = event.type === 'link_destroyed'
  const timeAgo = getTimeAgo(event.timestamp)

  // Auto-dismiss after 15s for failed attempts, 30s for destruction
  useEffect(() => {
    const timeout = setTimeout(onDismiss, isDestroyed ? 30_000 : 15_000)
    return () => clearTimeout(timeout)
  }, [onDismiss, isDestroyed])

  return (
    <div style={{
      pointerEvents: 'auto',
      padding: '14px 16px', borderRadius: 10,
      background: isDestroyed
        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.08))'
        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.08))',
      border: `1px solid ${isDestroyed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
      backdropFilter: 'blur(12px)',
      boxShadow: `0 8px 32px ${isDestroyed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.15)'}`,
      animation: 'slideInRight 0.3s ease-out',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{isDestroyed ? '💀' : '🚨'}</span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: isDestroyed ? 'var(--qg-red, #ef4444)' : 'var(--qg-amber, #f59e0b)',
          }}>
            {isDestroyed ? 'Link Destroyed' : 'Failed Password Attempt'}
          </span>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'none', border: 'none', color: 'var(--qg-text-muted, #8b949e)',
            cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ fontSize: 12, color: 'var(--qg-text, #e6edf3)', lineHeight: 1.5 }}>
        <div style={{ marginBottom: 4 }}>
          <strong>{event.fileName}</strong>
        </div>
        {isDestroyed ? (
          <div>
            3 failed password attempts — link permanently destroyed.
            All encrypted data has been wiped. You must create a new share link.
          </div>
        ) : (
          <div>
            Incorrect password entered.{' '}
            <strong style={{ color: event.remainingAttempts <= 1 ? 'var(--qg-red, #ef4444)' : 'var(--qg-amber, #f59e0b)' }}>
              {event.remainingAttempts} attempt{event.remainingAttempts !== 1 ? 's' : ''} remaining
            </strong>{' '}
            before link is destroyed.
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 8, fontSize: 11, color: 'var(--qg-text-muted, #8b949e)',
      }}>
        <span>IP: {event.ip === 'unknown' ? 'Hidden' : event.ip}</span>
        <span>{timeAgo}</span>
      </div>

      {/* Attempt progress dots */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i <= event.attemptsUsed
              ? 'var(--qg-red, #ef4444)'
              : 'rgba(16, 185, 129, 0.4)',
          }} />
        ))}
      </div>
    </div>
  )
}

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  if (diff < 5000) return 'Just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3600_000)}h ago`
}
