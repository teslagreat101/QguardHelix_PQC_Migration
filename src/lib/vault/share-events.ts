import { EventEmitter } from 'events'

/**
 * Share Events System
 * Manages real-time security notifications for share link owners.
 */

export interface ShareSecurityEvent {
  type: 'failed_attempt' | 'link_destroyed'
  linkId: string
  ownerId: string
  fileName?: string
  filename?: string
  attemptsUsed?: number
  remainingAttempts?: number
  ip?: string
  ipAddress?: string
  userAgent?: string
  timestamp: string
  metadata?: any
}

// Global emitter for the server process
const shareEmitter = new EventEmitter()
shareEmitter.setMaxListeners(1000)

/**
 * Subscribe to events for a specific owner.
 */
export function subscribeOwnerEvents(ownerId: string, callback: (event: ShareSecurityEvent) => void) {
  const handler = (event: ShareSecurityEvent) => {
    if (event.ownerId === ownerId) {
      callback(event)
    }
  }

  shareEmitter.on('share_event', handler)

  return () => {
    shareEmitter.off('share_event', handler)
  }
}

/**
 * Emit a security event.
 * Called by share validation logic when a violation occurs.
 */
export function emitShareEvent(event: ShareSecurityEvent) {
  shareEmitter.emit('share_event', event)
}

export const emitShareLinkEvent = emitShareEvent
