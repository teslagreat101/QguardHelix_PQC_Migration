import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'

/**
 * Real-time security events for vault share links.
 * Listens via Server-Sent Events (SSE).
 */

export interface ShareLinkSecurityEvent {
  type: 'failed_attempt' | 'link_destroyed'
  linkId: string
  fileName: string
  attemptsUsed: number
  remainingAttempts: number
  ip: string
  timestamp: string
}

export function useShareLinkEvents() {
  const { session } = useAuth()
  const [events, setEvents] = useState<ShareLinkSecurityEvent[]>([])

  useEffect(() => {
    if (!session?.access_token) return

    // SSE endpoint for share events
    const url = `/api/v1/vault/share/events?token=${session.access_token}`
    const eventSource = new EventSource(url)

    eventSource.addEventListener('security_alert', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as ShareLinkSecurityEvent
        setEvents((prev) => [data, ...prev])
      } catch (err) {
        console.error('Failed to parse share security event:', err)
      }
    })

    eventSource.onerror = (err) => {
      console.error('Share security event stream error:', err)
      // EventSource will automatically retry by default
    }

    return () => {
      eventSource.close()
    }
  }, [session?.access_token])

  const dismissEvent = useCallback((index: number) => {
    setEvents((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const dismissAll = useCallback(() => {
    setEvents([])
  }, [])

  return {
    events,
    dismissEvent,
    dismissAll,
  }
}
