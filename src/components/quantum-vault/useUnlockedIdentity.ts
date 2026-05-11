'use client'

/**
 * Holds an unlocked HybridKeyMaterial in memory with safety rails:
 *
 *   • Idle lock     — clears after `idleMs` of no user input
 *   • Hidden lock   — clears after `hiddenMs` of the tab being in
 *                     document.visibilityState === 'hidden'
 *   • Unload lock   — zeroes secrets on pagehide / beforeunload
 *
 * "Clearing" means: overwrite each secret Uint8Array with zeros, then
 * drop the React reference. JS can't truly purge memory (V8 may have
 * copies in nursery/old space, browsers may have swapped pages to
 * disk), but explicit `.fill(0)` removes the obvious reachable copy
 * and shrinks the post-mortem-dump attack surface to the GC's whim
 * instead of "indefinitely".
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { HybridKeyMaterial } from '@/lib/vault/qgkey'

interface Options {
  /** Lock after this many ms of no mousedown/keydown/touchstart. */
  idleMs?: number
  /** Lock after this many ms of the tab being hidden. */
  hiddenMs?: number
  /** Called whenever the identity is locked (with the reason). */
  onLock?: (reason: 'idle' | 'hidden' | 'unload' | 'manual') => void
}

const DEFAULT_IDLE_MS = 5 * 60 * 1000 // 5 min
const DEFAULT_HIDDEN_MS = 60 * 1000 // 1 min

function zeroize(m: HybridKeyMaterial) {
  // Only the secret components matter; publics are not sensitive.
  m.x25519Secret.fill(0)
  m.mlkemSecret.fill(0)
  m.ed25519Secret.fill(0)
  m.mldsaSecret.fill(0)
}

export function useUnlockedIdentity(opts: Options = {}) {
  const idleMs = opts.idleMs ?? DEFAULT_IDLE_MS
  const hiddenMs = opts.hiddenMs ?? DEFAULT_HIDDEN_MS
  const onLockRef = useRef(opts.onLock)
  onLockRef.current = opts.onLock

  const [unlocked, setUnlockedState] = useState<HybridKeyMaterial | null>(null)
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null)

  const materialRef = useRef<HybridKeyMaterial | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lock = useCallback(
    (reason: 'idle' | 'hidden' | 'unload' | 'manual') => {
      const m = materialRef.current
      if (!m) return
      zeroize(m)
      materialRef.current = null
      setUnlockedState(null)
      setFingerprint(null)
      setLabel(null)
      setUnlockedAt(null)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current)
      idleTimerRef.current = null
      hiddenTimerRef.current = null
      onLockRef.current?.(reason)
    },
    [],
  )

  const resetIdleTimer = useCallback(() => {
    if (!materialRef.current) return
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => lock('idle'), idleMs)
  }, [idleMs, lock])

  const unlock = useCallback(
    (m: HybridKeyMaterial, fp: string, lbl?: string | null) => {
      // If something was already unlocked, zero it before swapping.
      if (materialRef.current && materialRef.current !== m) {
        zeroize(materialRef.current)
      }
      materialRef.current = m
      setUnlockedState(m)
      setFingerprint(fp)
      setLabel(lbl ?? null)
      setUnlockedAt(Date.now())
      resetIdleTimer()
    },
    [resetIdleTimer],
  )

  // Activity listeners → reset idle timer.
  useEffect(() => {
    if (!unlocked) return
    const events: Array<keyof DocumentEventMap> = [
      'mousedown',
      'keydown',
      'touchstart',
      'pointerdown',
    ]
    const handler = () => resetIdleTimer()
    events.forEach((e) => document.addEventListener(e, handler, { passive: true }))
    resetIdleTimer()
    return () => {
      events.forEach((e) => document.removeEventListener(e, handler))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [unlocked, resetIdleTimer])

  // Visibility lock.
  useEffect(() => {
    if (!unlocked) return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current)
        hiddenTimerRef.current = setTimeout(() => lock('hidden'), hiddenMs)
      } else {
        if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current)
        hiddenTimerRef.current = null
        resetIdleTimer()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (hiddenTimerRef.current) clearTimeout(hiddenTimerRef.current)
    }
  }, [unlocked, hiddenMs, lock, resetIdleTimer])

  // Page unload — zero before the page is gone.
  useEffect(() => {
    const onUnload = () => {
      if (materialRef.current) zeroize(materialRef.current)
    }
    window.addEventListener('pagehide', onUnload)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('pagehide', onUnload)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [])

  // Component unmount — zero too.
  useEffect(() => {
    return () => {
      if (materialRef.current) {
        zeroize(materialRef.current)
        materialRef.current = null
      }
    }
  }, [])

  return {
    unlocked,
    fingerprint,
    label,
    unlockedAt,
    unlock,
    lock: () => lock('manual'),
    /** ms until idle lock fires (or null if not unlocked). For UI countdown. */
    idleMs,
    hiddenMs,
  }
}
