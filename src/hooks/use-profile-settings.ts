import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'

export type ProfileTheme = 'dark' | 'gold' | 'light' | 'cyber'

export interface UserProfileSettings {
  id: string
  email: string
  pendingEmail: string | null
  emailVerifiedAt: string | null
  fullName: string
  username: string
  role: string
  company: string
  phone: string
  location: string
  department: string
  jobTitle: string
  avatarUrl: string | null
  bannerUrl: string | null
  tier: string
  qScore: number
  badges: string[]
  createdAt: string | null
  lastLoginAt: string | null
  updatedAt: string | null
  twoFactorEnabled: boolean
  recoveryCodesRemaining: number
  usage: {
    keysGeneratedToday: number
    maxKeysPerDay: number
    vaultStorageUsed: number
    maxVaultStorage: number
  }
}

export interface UserPreferences {
  theme: ProfileTheme
  language: string
  timezone: string
  dashboardDensity: 'compact' | 'comfortable' | 'expanded'
  defaultDashboardView: string
  notificationEmail: boolean
  notificationPush: boolean
  notificationSms: boolean
  securityAlerts: boolean
  productUpdates: boolean
  telemetryOptIn: boolean
  updatedAt: string | null
}

export interface UserSecuritySettings {
  twoFactorEnabled: boolean
  mfaEnforced: boolean
  suspiciousLoginAlerts: boolean
  securityEmailNotifications: boolean
  trustedDeviceExpiryDays: number
  passwordChangedAt: string | null
  recoveryCodesGeneratedAt: string | null
  updatedAt: string | null
}

export interface UserDevice {
  id: string
  name: string
  type: string
  trusted: boolean
  current?: boolean
  fingerprint: string
  ipAddress: string | null
  userAgent: string | null
  lastActive: string
  createdAt: string
  revokedAt: string | null
}

export interface UserSession {
  id: string
  current: boolean
  trusted: boolean
  deviceId: string | null
  deviceName: string
  ipAddress: string | null
  userAgent: string | null
  lastSeenAt: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
}

export interface UserActivity {
  id: string
  eventType: string
  severity: 'info' | 'success' | 'warning' | 'critical'
  message: string
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export interface MfaEnrollment {
  factorId: string
  qrCode: string
  secret: string
  uri: string
}

interface ProfileBundle {
  profile: UserProfileSettings
  preferences: UserPreferences
  security: UserSecuritySettings
  devices: UserDevice[]
  sessions: UserSession[]
  activity: UserActivity[]
  telemetry: {
    activeSessions: number
    trustedDevices: number
    lastSyncAt: string
  }
}

function createDeviceId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `qgd-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function getStoredDeviceId() {
  if (typeof window === 'undefined') return ''
  const existing = window.localStorage.getItem('qguard_device_id')
  if (existing) return existing
  const next = createDeviceId()
  window.localStorage.setItem('qguard_device_id', next)
  return next
}

function parseApiError(json: any, fallback: string) {
  return json?.error?.message || json?.message || fallback
}

function parseApiCode(json: any) {
  return json?.error?.code || json?.code || null
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

function timestampMs(value?: string | null) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function shallowEqualRecord(a: Record<string, unknown>, b: Record<string, unknown>) {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => {
    if (Object.is(a[key], b[key])) return true
    if (a[key] && b[key] && typeof a[key] === 'object' && typeof b[key] === 'object') {
      try {
        return JSON.stringify(a[key]) === JSON.stringify(b[key])
      } catch {
        return false
      }
    }
    return false
  })
}

function mergeServerObject<T extends { updatedAt?: string | null }>(
  previous: T | null,
  incoming: Partial<T> | T | null | undefined,
): T | null {
  if (!incoming || typeof incoming !== 'object') return previous
  if (!previous) return incoming as T

  const next = { ...previous, ...incoming } as T
  const previousUpdated = timestampMs(previous.updatedAt)
  const nextUpdated = timestampMs(next.updatedAt)

  if (previousUpdated && nextUpdated && nextUpdated < previousUpdated) {
    return previous
  }

  return shallowEqualRecord(previous as Record<string, unknown>, next as Record<string, unknown>) ? previous : next
}

function mergeProfileUpdate(previous: UserProfileSettings | null, raw: Partial<UserProfileSettings> & Record<string, any>) {
  if (!raw || typeof raw !== 'object') return previous
  if (!previous && (!raw.id || !raw.email)) return previous

  const {
    name,
    keysGeneratedToday,
    maxKeysPerDay,
    vaultStorageUsed,
    maxVaultStorage,
    ...profileFields
  } = raw
  const patch: Partial<UserProfileSettings> = { ...profileFields }

  if (name !== undefined && patch.fullName === undefined) {
    patch.fullName = name || ''
  }

  if (previous && (
    keysGeneratedToday !== undefined ||
    maxKeysPerDay !== undefined ||
    vaultStorageUsed !== undefined ||
    maxVaultStorage !== undefined
  )) {
    patch.usage = {
      ...previous.usage,
      keysGeneratedToday: keysGeneratedToday ?? previous.usage.keysGeneratedToday,
      maxKeysPerDay: maxKeysPerDay ?? previous.usage.maxKeysPerDay,
      vaultStorageUsed: vaultStorageUsed ?? previous.usage.vaultStorageUsed,
      maxVaultStorage: maxVaultStorage ?? previous.usage.maxVaultStorage,
    }
  }

  return mergeServerObject(previous, patch)
}

export function useProfileSettings() {
  const { session, user } = useAuth()
  const [deviceId, setDeviceId] = useState('')
  const [profile, setProfile] = useState<UserProfileSettings | null>(null)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [security, setSecurity] = useState<UserSecuritySettings | null>(null)
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [activity, setActivity] = useState<UserActivity[]>([])
  const [telemetry, setTelemetry] = useState<ProfileBundle['telemetry'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sseConnected, setSseConnected] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const loadedRef = useRef(false)
  const savingRef = useRef(false)

  const token = session?.access_token

  useEffect(() => {
    setDeviceId(getStoredDeviceId())
  }, [])

  useEffect(() => {
    loadedRef.current = false
    savingRef.current = false
    setProfile(null)
    setPreferences(null)
    setSecurity(null)
    setDevices([])
    setSessions([])
    setActivity([])
    setTelemetry(null)
    setRecoveryCodes([])
    setError(null)
    setSseConnected(false)
    setLoading(Boolean(user))
  }, [user?.id])

  const baseHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (deviceId) headers['X-QGuard-Device-Id'] = deviceId
    return headers
  }, [token, deviceId])

  const sensitiveHeaders = useMemo(() => {
    const headers = { ...baseHeaders }
    if (session?.refresh_token) headers['X-QGuard-Refresh-Token'] = session.refresh_token
    return headers
  }, [baseHeaders, session?.refresh_token])

  const request = useCallback(async <T,>(
    path: string,
    init: RequestInit = {},
    sensitive = false,
  ): Promise<T> => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(sensitive ? sensitiveHeaders : baseHeaders),
          ...(init.headers || {}),
        },
      })
      const json = await res.json().catch(() => ({}))
      const apiCode = parseApiCode(json)

      if (res.ok) return json.data as T
      lastError = new Error(parseApiError(json, `Request failed with HTTP ${res.status}`))

      if (res.status === 503 && (apiCode === 'NOT_READY' || apiCode === 'API_LOAD_ERROR')) {
        await wait(350 + attempt * 150)
        continue
      }

      throw lastError
    }

    throw lastError || new Error('Request failed')
  }, [baseHeaders, sensitiveHeaders])

  const applyBundle = useCallback((bundle: ProfileBundle) => {
    setProfile((prev) => mergeServerObject(prev, bundle.profile))
    setPreferences((prev) => mergeServerObject(prev, bundle.preferences))
    setSecurity((prev) => mergeServerObject(prev, bundle.security))
    setDevices(bundle.devices || [])
    setSessions(bundle.sessions || [])
    setActivity(bundle.activity || [])
    setTelemetry(bundle.telemetry)
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!token) {
      loadedRef.current = false
      setLoading(false)
      return
    }

    if (!deviceId) {
      if (!loadedRef.current) setLoading(true)
      return
    }

    if (!loadedRef.current) setLoading(true)
    try {
      const bundle = await request<ProfileBundle>('/api/v1/profile')
      applyBundle(bundle)
      loadedRef.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile settings')
    } finally {
      setLoading(false)
    }
  }, [applyBundle, deviceId, request, token])

  const refreshActivity = useCallback(async () => {
    if (!token) return
    const data = await request<{ activity: UserActivity[] }>('/api/v1/profile/activity?limit=50')
    setActivity(data.activity || [])
  }, [request, token])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!token || !user) return

    const channels = [
      supabase
        .channel(`profile-row-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, refresh)
        .subscribe(),
      supabase
        .channel(`profile-preferences-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${user.id}` }, refresh)
        .subscribe(),
      supabase
        .channel(`profile-security-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_security_settings', filter: `user_id=eq.${user.id}` }, refresh)
        .subscribe(),
      supabase
        .channel(`profile-events-${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_security_events', filter: `user_id=eq.${user.id}` }, refreshActivity)
        .subscribe(),
    ]

    return () => {
      for (const channel of channels) supabase.removeChannel(channel)
    }
  }, [refresh, refreshActivity, token, user])

  useEffect(() => {
    if (!token || !profile?.id) return

    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const connect = () => {
      const es = new EventSource(`/api/v1/profile/stream?token=${encodeURIComponent(token)}`)
      eventSourceRef.current = es
      es.addEventListener('connected', () => setSseConnected(true))
      es.addEventListener('heartbeat', () => setSseConnected(true))
      es.addEventListener('profile-update', (event) => {
        try {
          const payload = JSON.parse(event.data)
          setProfile((prev) => mergeProfileUpdate(prev, payload))
        } catch { /* ignore malformed SSE */ }
      })
      es.addEventListener('preferences-update', (event) => {
        try {
          const payload = JSON.parse(event.data)
          setPreferences((prev) => mergeServerObject(prev, payload))
        } catch { /* ignore malformed SSE */ }
      })
      es.addEventListener('security-update', (event) => {
        try {
          const payload = JSON.parse(event.data)
          setSecurity((prev) => mergeServerObject(prev, payload))
        } catch { /* ignore malformed SSE */ }
      })
      es.addEventListener('telemetry', (event) => {
        try {
          const payload = JSON.parse(event.data)
          setTelemetry((prev) => ({
            activeSessions: payload.activeSessions ?? prev?.activeSessions ?? 0,
            trustedDevices: payload.trustedDevices ?? prev?.trustedDevices ?? 0,
            lastSyncAt: payload.lastSyncAt ?? prev?.lastSyncAt ?? new Date().toISOString(),
          }))
        } catch { /* ignore malformed SSE */ }
      })
      es.addEventListener('activity', (event) => {
        try {
          const item = JSON.parse(event.data) as UserActivity
          setActivity((prev) => [item, ...prev.filter((existing) => existing.id !== item.id)].slice(0, 50))
        } catch { /* ignore malformed SSE */ }
      })
      es.onerror = () => {
        setSseConnected(false)
        es.close()
        retryTimer = setTimeout(connect, 15000)
      }
    }

    connect()
    return () => {
      if (retryTimer) clearTimeout(retryTimer)
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      setSseConnected(false)
    }
  }, [profile?.id, token])

  const withSaving = useCallback(async <T,>(operation: () => Promise<T>) => {
    if (savingRef.current) {
      const err = new Error('Another settings update is already in progress.')
      setError(err.message)
      throw err
    }

    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      return await operation()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      setError(message)
      throw err
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  const updateProfile = useCallback((updates: Partial<UserProfileSettings>) => withSaving(async () => {
    const data = await request<{ profile: UserProfileSettings }>('/api/v1/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    setProfile((prev) => mergeServerObject(prev, data.profile))
    return data.profile
  }), [request, withSaving])

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => withSaving(async () => {
    const data = await request<{ preferences: UserPreferences }>('/api/v1/profile/preferences', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    setPreferences((prev) => mergeServerObject(prev, data.preferences))
    return data.preferences
  }), [request, withSaving])

  const updateSecurity = useCallback((updates: Partial<UserSecuritySettings>) => withSaving(async () => {
    const data = await request<{ security: UserSecuritySettings }>('/api/v1/profile/security', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
    setSecurity((prev) => mergeServerObject(prev, data.security))
    return data.security
  }), [request, withSaving])

  const uploadMedia = useCallback((kind: 'avatar' | 'banner', file: File) => withSaving(async () => {
    const dataUrl = await fileToDataUrl(file)
    const data = await request<{ avatarUrl?: string; bannerUrl?: string }>(`/api/v1/profile/${kind}`, {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type,
        data: dataUrl,
      }),
    })
    setProfile((prev) => prev ? {
      ...prev,
      avatarUrl: kind === 'avatar' ? data.avatarUrl || null : prev.avatarUrl,
      bannerUrl: kind === 'banner' ? data.bannerUrl || null : prev.bannerUrl,
    } : prev)
    return data
  }), [request, withSaving])

  const removeMedia = useCallback((kind: 'avatar' | 'banner') => withSaving(async () => {
    const data = await request<{ avatarUrl?: string | null; bannerUrl?: string | null }>(`/api/v1/profile/${kind}`, {
      method: 'DELETE',
    })
    setProfile((prev) => prev ? {
      ...prev,
      avatarUrl: kind === 'avatar' ? null : prev.avatarUrl,
      bannerUrl: kind === 'banner' ? null : prev.bannerUrl,
    } : prev)
    return data
  }), [request, withSaving])

  const changePassword = useCallback((currentPassword: string, newPassword: string) => withSaving(async () => {
    const data = await request<{ requiresClientUpdate?: boolean; message: string }>('/api/v1/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, true)
    if (data.requiresClientUpdate) {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
    }
    await refresh()
    return data.message || 'Password updated successfully'
  }), [refresh, request, withSaving])

  const changeEmail = useCallback((newEmail: string, password: string) => withSaving(async () => {
    const data = await request<{ requiresClientUpdate?: boolean; newEmail: string; message: string }>('/api/v1/profile/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail, password }),
    }, true)
    if (data.requiresClientUpdate) {
      const { error: updateError } = await supabase.auth.updateUser({ email: newEmail })
      if (updateError) throw updateError
    }
    await refresh()
    return data.message || 'Verification email sent to your new address.'
  }), [refresh, request, withSaving])

  const startMfaEnrollment = useCallback(() => withSaving(async () => {
    return request<MfaEnrollment>('/api/v1/profile/2fa/enable', { method: 'POST' }, true)
  }), [request, withSaving])

  const verifyMfa = useCallback((factorId: string, code: string) => withSaving(async () => {
    const data = await request<{ message: string; recoveryCodes: string[] }>('/api/v1/profile/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ factorId, code }),
    }, true)
    setRecoveryCodes(data.recoveryCodes || [])
    await refresh()
    return data
  }), [refresh, request, withSaving])

  const disableMfa = useCallback((code: string, recoveryCode?: string) => withSaving(async () => {
    const data = await request<{ message: string }>('/api/v1/profile/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code, recoveryCode }),
    }, true)
    await refresh()
    return data.message
  }), [refresh, request, withSaving])

  const regenerateRecoveryCodes = useCallback(() => withSaving(async () => {
    const data = await request<{ recoveryCodes: string[] }>('/api/v1/profile/recovery-codes/regenerate', {
      method: 'POST',
    }, true)
    setRecoveryCodes(data.recoveryCodes || [])
    await refresh()
    return data.recoveryCodes || []
  }), [refresh, request, withSaving])

  const setDeviceTrust = useCallback((deviceIdToUpdate: string, trusted: boolean) => withSaving(async () => {
    const data = await request<{ device: UserDevice }>(`/api/v1/profile/devices/${deviceIdToUpdate}`, {
      method: 'PATCH',
      body: JSON.stringify({ trusted }),
    })
    setDevices((prev) => prev.map((device) => device.id === data.device.id ? data.device : device))
    return data.device
  }), [request, withSaving])

  const revokeSession = useCallback((sessionId: string) => withSaving(async () => {
    await request<{ revoked: boolean }>(`/api/v1/profile/sessions/${sessionId}`, {
      method: 'DELETE',
    })
    setSessions((prev) => prev.filter((item) => item.id !== sessionId))
  }), [request, withSaving])

  return {
    user,
    profile,
    preferences,
    security,
    devices,
    sessions,
    activity,
    telemetry,
    loading,
    saving,
    error,
    sseConnected,
    recoveryCodes,
    clearRecoveryCodes: () => setRecoveryCodes([]),
    refresh,
    refreshActivity,
    updateProfile,
    updatePreferences,
    updateSecurity,
    uploadMedia,
    removeMedia,
    changePassword,
    changeEmail,
    startMfaEnrollment,
    verifyMfa,
    disableMfa,
    regenerateRecoveryCodes,
    setDeviceTrust,
    revokeSession,
  }
}
