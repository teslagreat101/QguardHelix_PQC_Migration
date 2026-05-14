import { Router, Request, Response, NextFunction } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAuthClient, getServerUser } from '@/lib/supabase-server'

type AuthedRequest = Request & {
  user?: User
  token?: string
  authClient?: SupabaseClient
}

type Severity = 'info' | 'success' | 'warning' | 'critical'

const router = Router()
const sensitiveActionWindows = new Map<string, { count: number; resetAt: number }>()

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const MAX_BANNER_BYTES = 4 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function jsonError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } })
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  const queryToken = req.query.token
  return typeof queryToken === 'string' && queryToken ? queryToken : null
}

function getRefreshToken(req: Request): string | null {
  const header = req.headers['x-qguard-refresh-token']
  return typeof header === 'string' && header.length > 0 ? header : null
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for']
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded
  const candidate = raw?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || null
  return candidate?.replace('::ffff:', '') || null
}

function getUserAgent(req: Request): string {
  return String(req.headers['user-agent'] || 'Unknown device').slice(0, 500)
}

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function hashRecoveryCode(userId: string, code: string) {
  return hashValue(`${userId}:${code.replace(/[\s-]/g, '').toUpperCase()}`)
}

function cleanString(value: unknown, max = 200): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > max ? undefined : trimmed || null
}

function parseDeviceType(userAgent: string) {
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) return 'mobile'
  if (ua.includes('tablet') || ua.includes('ipad')) return 'tablet'
  return 'desktop'
}

function parseDeviceName(userAgent: string) {
  const browser = userAgent.includes('Edg/') ? 'Edge'
    : userAgent.includes('Chrome/') ? 'Chrome'
    : userAgent.includes('Firefox/') ? 'Firefox'
    : userAgent.includes('Safari/') ? 'Safari'
    : 'Browser'
  const os = userAgent.includes('Windows') ? 'Windows'
    : userAgent.includes('Mac OS') ? 'macOS'
    : userAgent.includes('Android') ? 'Android'
    : userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'iOS'
    : userAgent.includes('Linux') ? 'Linux'
    : 'Unknown OS'
  return `${browser} on ${os}`
}

function getDeviceFingerprint(req: Request, userId: string) {
  const explicit = req.headers['x-qguard-device-id']
  if (typeof explicit === 'string' && explicit.length >= 12 && explicit.length <= 120) {
    return explicit
  }
  return hashValue(`${userId}:${getUserAgent(req)}:${getClientIp(req) || 'unknown'}`).slice(0, 48)
}

function normalizeProfile(row: any, user: User, twoFactorEnabled: boolean, recoveryCodesRemaining: number) {
  const fullName = row?.full_name || row?.name || user.user_metadata?.full_name || user.user_metadata?.name || ''
  return {
    id: user.id,
    email: user.email || row?.email || '',
    pendingEmail: user.new_email || null,
    emailVerifiedAt: user.email_confirmed_at || null,
    fullName,
    username: row?.username || '',
    role: row?.role || '',
    company: row?.company || '',
    phone: row?.phone || '',
    location: row?.location || '',
    department: row?.department || '',
    jobTitle: row?.job_title || '',
    avatarUrl: row?.avatar_url || user.user_metadata?.avatar_url || null,
    bannerUrl: row?.banner_url || null,
    tier: row?.tier || 'free',
    qScore: row?.q_score ?? 0,
    badges: row?.badges || [],
    createdAt: user.created_at || row?.created_at || null,
    lastLoginAt: user.last_sign_in_at || null,
    updatedAt: row?.updated_at || null,
    twoFactorEnabled,
    recoveryCodesRemaining,
    usage: {
      keysGeneratedToday: row?.keys_generated_today || 0,
      maxKeysPerDay: row?.max_keys_per_day || 10,
      vaultStorageUsed: row?.vault_storage_used || 0,
      maxVaultStorage: row?.max_vault_storage || 104857600,
    },
  }
}

function normalizePreferences(row: any) {
  return {
    theme: row?.theme || 'gold',
    language: row?.language || 'en',
    timezone: row?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    dashboardDensity: row?.dashboard_density || 'comfortable',
    defaultDashboardView: row?.default_dashboard_view || 'overview',
    notificationEmail: row?.notification_email ?? true,
    notificationPush: row?.notification_push ?? false,
    notificationSms: row?.notification_sms ?? false,
    securityAlerts: row?.security_alerts ?? true,
    productUpdates: row?.product_updates ?? false,
    telemetryOptIn: row?.telemetry_opt_in ?? true,
    updatedAt: row?.updated_at || null,
  }
}

function normalizeSecuritySettings(row: any, twoFactorEnabled: boolean) {
  return {
    twoFactorEnabled,
    mfaEnforced: row?.mfa_enforced ?? false,
    suspiciousLoginAlerts: row?.suspicious_login_alerts ?? true,
    securityEmailNotifications: row?.security_email_notifications ?? true,
    trustedDeviceExpiryDays: row?.trusted_device_expiry_days || 30,
    passwordChangedAt: row?.password_changed_at || null,
    recoveryCodesGeneratedAt: row?.recovery_codes_generated_at || null,
    updatedAt: row?.updated_at || null,
  }
}

function normalizeDevice(row: any) {
  return {
    id: row.id,
    name: row.device_name || 'Unknown device',
    type: row.device_type || 'desktop',
    trusted: row.trusted ?? false,
    current: row.current ?? false,
    fingerprint: row.fingerprint,
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    lastActive: row.last_active || row.updated_at || row.created_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at || null,
  }
}

function normalizeSession(row: any, currentHash: string) {
  return {
    id: row.id,
    current: row.session_token_hash === currentHash,
    trusted: row.trusted ?? false,
    deviceId: row.device_id || null,
    deviceName: row.device_name || 'Unknown device',
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at || null,
    revokedAt: row.revoked_at || null,
  }
}

function normalizeActivity(row: any) {
  return {
    id: row.id,
    eventType: row.event_type || row.action || 'activity',
    severity: row.severity || 'info',
    message: row.message || row.action || 'Account activity recorded',
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    metadata: row.metadata || row.details || {},
    createdAt: row.created_at,
  }
}

function passwordIssues(password: string, email?: string | null) {
  const issues: string[] = []
  if (password.length < 12) issues.push('Use at least 12 characters')
  if (!/[a-z]/.test(password)) issues.push('Add a lowercase letter')
  if (!/[A-Z]/.test(password)) issues.push('Add an uppercase letter')
  if (!/[0-9]/.test(password)) issues.push('Add a number')
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('Add a symbol')
  const emailName = email?.split('@')[0]?.toLowerCase()
  if (emailName && emailName.length > 2 && password.toLowerCase().includes(emailName)) {
    issues.push('Do not include your email name')
  }
  return issues
}

function checkRateLimit(userId: string, action: string, limit: number, windowMs: number) {
  const key = `${userId}:${action}`
  const now = Date.now()
  const existing = sensitiveActionWindows.get(key)
  if (!existing || existing.resetAt < now) {
    sensitiveActionWindows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (existing.count >= limit) return false
  existing.count += 1
  return true
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractToken(req)
  if (!token) return jsonError(res, 401, 'UNAUTHORIZED', 'Authentication required')

  const client = createAuthClient(token)
  if (!client) return jsonError(res, 500, 'CONFIG_ERROR', 'Supabase is not configured')

  const user = await getServerUser(token)
  if (!user) return jsonError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token')

  req.user = user
  req.token = token
  req.authClient = client
  return next()
}

async function ensureSessionBound(client: SupabaseClient, token: string, refreshToken: string | null) {
  if (!refreshToken) return false
  const { error } = await client.auth.setSession({ access_token: token, refresh_token: refreshToken })
  return !error
}

async function recordSecurityEvent(
  client: SupabaseClient,
  userId: string,
  req: Request,
  eventType: string,
  severity: Severity,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await client.from('user_security_events').insert({
      user_id: userId,
      event_type: eventType,
      severity,
      message,
      ip_address: getClientIp(req),
      user_agent: getUserAgent(req),
      metadata,
    })
  } catch {
    // Audit logging must never block the user operation.
  }
}

async function getTwoFactorEnabled(client: SupabaseClient) {
  try {
    const { data } = await client.auth.mfa.listFactors()
    return ((data as any)?.totp || []).some((factor: any) => factor.status === 'verified')
  } catch {
    return false
  }
}

async function countUnusedRecoveryCodes(client: SupabaseClient, userId: string) {
  try {
    const { count, error } = await client
      .from('user_mfa_recovery_codes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('used_at', null)
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

async function ensureProfile(client: SupabaseClient, user: User) {
  const defaults = {
    id: user.id,
    email: user.email || '',
    name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
    tier: 'free',
    q_score: 0,
    badges: [],
    keys_generated_today: 0,
    max_keys_per_day: 10,
    vault_storage_used: 0,
    max_vault_storage: 104857600,
  }

  let { data, error } = await client.from('profiles').select('*').eq('id', user.id).single()

  if (!data && error?.code === 'PGRST116') {
    const result = await client.from('profiles').insert(defaults).select('*').single()
    data = result.data
    error = result.error
  }

  if (error || !data) throw error || new Error('Profile not found')
  return data
}

async function ensurePreferences(client: SupabaseClient, userId: string) {
  const defaults = {
    user_id: userId,
    theme: 'gold',
    language: 'en',
    timezone: 'UTC',
    dashboard_density: 'comfortable',
    default_dashboard_view: 'overview',
    notification_email: true,
    notification_push: false,
    notification_sms: false,
    security_alerts: true,
    product_updates: false,
    telemetry_opt_in: true,
  }

  let { data, error } = await client.from('user_preferences').select('*').eq('user_id', userId).single()
  if (!data && error?.code === 'PGRST116') {
    const result = await client.from('user_preferences').insert(defaults).select('*').single()
    data = result.data
    error = result.error
  }
  if (error || !data) throw error || new Error('Preferences not found')
  return data
}

async function ensureSecuritySettings(client: SupabaseClient, userId: string) {
  const defaults = {
    user_id: userId,
    mfa_enforced: false,
    suspicious_login_alerts: true,
    security_email_notifications: true,
    trusted_device_expiry_days: 30,
  }

  let { data, error } = await client.from('user_security_settings').select('*').eq('user_id', userId).single()
  if (!data && error?.code === 'PGRST116') {
    const result = await client.from('user_security_settings').insert(defaults).select('*').single()
    data = result.data
    error = result.error
  }
  if (error || !data) throw error || new Error('Security settings not found')
  return data
}

async function touchDeviceAndSession(client: SupabaseClient, userId: string, token: string, req: Request) {
  const userAgent = getUserAgent(req)
  const fingerprint = getDeviceFingerprint(req, userId)
  const now = new Date().toISOString()
  const devicePayload = {
    user_id: userId,
    fingerprint,
    device_name: parseDeviceName(userAgent),
    device_type: parseDeviceType(userAgent),
    ip_address: getClientIp(req),
    user_agent: userAgent,
    last_active: now,
    metadata: { source: 'profile_api' },
  }

  const { data: device } = await client
    .from('user_devices')
    .upsert(devicePayload, { onConflict: 'user_id,fingerprint' })
    .select('*')
    .single()

  const sessionHash = hashValue(token)
  const { data: session } = await client
    .from('user_sessions')
    .upsert({
      user_id: userId,
      device_id: device?.id || null,
      device_name: devicePayload.device_name,
      session_token_hash: sessionHash,
      ip_address: devicePayload.ip_address,
      user_agent: userAgent,
      last_seen_at: now,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'session_token_hash' })
    .select('*')
    .single()

  return { device, session, sessionHash }
}

async function fetchProfileBundle(client: SupabaseClient, user: User, token: string, req: Request) {
  const [profile, preferences, securitySettings, twoFactorEnabled, recoveryCount] = await Promise.all([
    ensureProfile(client, user),
    ensurePreferences(client, user.id),
    ensureSecuritySettings(client, user.id),
    getTwoFactorEnabled(client),
    countUnusedRecoveryCodes(client, user.id),
  ])

  const { sessionHash } = await touchDeviceAndSession(client, user.id, token, req)

  const [devicesResult, sessionsResult, activity] = await Promise.all([
    client
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('last_active', { ascending: false })
      .limit(12),
    client
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(12),
    fetchActivity(client, user.id, 20),
  ])

  return {
    profile: normalizeProfile(profile, user, twoFactorEnabled, recoveryCount),
    preferences: normalizePreferences(preferences),
    security: normalizeSecuritySettings(securitySettings, twoFactorEnabled),
    devices: (devicesResult.data || []).map(normalizeDevice),
    sessions: (sessionsResult.data || []).map((session) => normalizeSession(session, sessionHash)),
    activity,
    telemetry: {
      activeSessions: sessionsResult.data?.length || 0,
      trustedDevices: (devicesResult.data || []).filter((device: any) => device.trusted).length,
      lastSyncAt: new Date().toISOString(),
    },
  }
}

async function fetchActivity(client: SupabaseClient, userId: string, limit = 30) {
  const [securityEventsResult, authEventsResult, auditLogsResult] = await Promise.all([
    client
      .from('user_security_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    client
      .from('auth_events')
      .select('id, event_type, success, ip_address, user_agent, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    client
      .from('audit_logs')
      .select('id, action, entity_type, details, ip_address, user_agent, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const securityEvents = securityEventsResult.error ? [] : securityEventsResult.data || []
  const authEvents = authEventsResult.error ? [] : (authEventsResult.data || []).map((event: any) => ({
    ...event,
    severity: event.success === false ? 'warning' : 'info',
    message: event.event_type,
  }))
  const auditLogs = auditLogsResult.error ? [] : (auditLogsResult.data || []).map((event: any) => ({
    ...event,
    event_type: `audit.${event.action}`,
    severity: 'info',
    message: `${event.action}${event.entity_type ? ` on ${event.entity_type}` : ''}`,
    metadata: event.details || {},
  }))

  return [...securityEvents, ...authEvents, ...auditLogs]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map(normalizeActivity)
}

async function uploadProfileImage(client: SupabaseClient, userId: string, kind: 'avatar' | 'banner', body: any) {
  const contentType = String(body?.contentType || '')
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Invalid image type. Use JPEG, PNG, WebP, or GIF.')
  }

  const raw = String(body?.data || '').replace(/^data:[^;]+;base64,/, '')
  const buffer = Buffer.from(raw, 'base64')
  const maxBytes = kind === 'avatar' ? MAX_AVATAR_BYTES : MAX_BANNER_BYTES
  if (!buffer.length || buffer.length > maxBytes) {
    throw new Error(kind === 'avatar' ? 'Avatar must be 2 MB or smaller.' : 'Banner must be 4 MB or smaller.')
  }

  const ext = contentType === 'image/png' ? 'png'
    : contentType === 'image/webp' ? 'webp'
    : contentType === 'image/gif' ? 'gif'
    : 'jpg'
  const bucket = kind === 'avatar' ? 'avatars' : 'profile-banners'
  const storagePath = `${userId}/${kind}.${ext}`

  const { data: existingFiles } = await client.storage.from(bucket).list(userId)
  if (existingFiles?.length) {
    await client.storage.from(bucket).remove(existingFiles.map((file) => `${userId}/${file.name}`))
  }

  const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  })
  if (uploadError) throw uploadError

  const { data } = client.storage.from(bucket).getPublicUrl(storagePath)
  return data.publicUrl
}

function generateRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const partA = randomBytes(3).toString('hex').toUpperCase()
    const partB = randomBytes(3).toString('hex').toUpperCase()
    return `QG-${partA}-${partB}`
  })
}

router.get('/stream', async (req: Request, res: Response) => {
  const token = extractToken(req)
  if (!token) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Unauthorized' })}\n\n`)
    res.end()
    return
  }

  const client = createAuthClient(token)
  const user = await getServerUser(token)
  if (!client || !user) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    })
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Invalid token' })}\n\n`)
    res.end()
    return
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write(`event: connected\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`)

  let lastActivityAt = new Date(Date.now() - 30000).toISOString()

  const sendSnapshot = async () => {
    try {
      const [activity, sessionsResult, trustedDevicesResult] = await Promise.all([
        client
          .from('user_security_events')
          .select('*')
          .eq('user_id', user.id)
          .gt('created_at', lastActivityAt)
          .order('created_at', { ascending: true })
          .limit(10),
        client
          .from('user_sessions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('revoked_at', null),
        client
          .from('user_devices')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('trusted', true)
          .is('revoked_at', null),
      ])

      for (const event of activity.data || []) {
        lastActivityAt = event.created_at
        res.write(`event: activity\ndata: ${JSON.stringify(normalizeActivity(event))}\n\n`)
      }
      res.write(`event: telemetry\ndata: ${JSON.stringify({
        activeSessions: sessionsResult.count || 0,
        trustedDevices: trustedDevicesResult.count || 0,
        lastSyncAt: new Date().toISOString(),
      })}\n\n`)
    } catch {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString(), degraded: true })}\n\n`)
    }
  }

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)
  }, 15000)
  const poll = setInterval(sendSnapshot, 10000)
  sendSnapshot()

  req.on('close', () => {
    clearInterval(heartbeat)
    clearInterval(poll)
  })
})

router.use(requireAuth)

router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const data = await fetchProfileBundle(req.authClient!, req.user!, req.token!, req)
    return res.json({ data })
  } catch (err) {
    console.error('Profile fetch error:', err)
    return jsonError(res, 500, 'PROFILE_ERROR', 'Failed to load profile settings')
  }
})

router.put('/', async (req: AuthedRequest, res: Response) => {
  const user = req.user!
  const client = req.authClient!
  try {
    const allowed: Record<string, string> = {
      fullName: 'full_name',
      username: 'username',
      role: 'role',
      company: 'company',
      phone: 'phone',
      location: 'location',
      department: 'department',
      jobTitle: 'job_title',
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const [key, column] of Object.entries(allowed)) {
      if (req.body[key] !== undefined) {
        const value = cleanString(req.body[key], key === 'username' ? 60 : 200)
        if (value === undefined) return jsonError(res, 400, 'VALIDATION_ERROR', `Invalid value for ${key}`)
        updates[column] = value
        if (key === 'fullName') updates.name = value
      }
    }

    const { data, error } = await client.from('profiles').update(updates).eq('id', user.id).select('*').single()
    if (error || !data) return jsonError(res, 500, 'UPDATE_ERROR', 'Failed to update profile')

    if (updates.full_name !== undefined) {
      await client.auth.updateUser({ data: { full_name: updates.full_name } }).catch(() => undefined)
    }

    await recordSecurityEvent(client, user.id, req, 'profile.updated', 'success', 'Profile details updated', {
      fields: Object.keys(updates).filter((key) => key !== 'updated_at'),
    })

    const twoFactorEnabled = await getTwoFactorEnabled(client)
    const recoveryCodesRemaining = await countUnusedRecoveryCodes(client, user.id)

    return res.json({ data: { profile: normalizeProfile(data, user, twoFactorEnabled, recoveryCodesRemaining) } })
  } catch (err) {
    console.error('Profile update error:', err)
    return jsonError(res, 500, 'UPDATE_ERROR', 'Failed to update profile')
  }
})

router.put('/preferences', async (req: AuthedRequest, res: Response) => {
  const user = req.user!
  const client = req.authClient!
  try {
    const allowed: Record<string, string> = {
      theme: 'theme',
      language: 'language',
      timezone: 'timezone',
      dashboardDensity: 'dashboard_density',
      defaultDashboardView: 'default_dashboard_view',
      notificationEmail: 'notification_email',
      notificationPush: 'notification_push',
      notificationSms: 'notification_sms',
      securityAlerts: 'security_alerts',
      productUpdates: 'product_updates',
      telemetryOptIn: 'telemetry_opt_in',
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const [key, column] of Object.entries(allowed)) {
      if (req.body[key] === undefined) continue
      if (typeof req.body[key] === 'boolean') updates[column] = req.body[key]
      else {
        const value = cleanString(req.body[key], 100)
        if (value === undefined) return jsonError(res, 400, 'VALIDATION_ERROR', `Invalid value for ${key}`)
        updates[column] = value
      }
    }

    const { data, error } = await client
      .from('user_preferences')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error || !data) return jsonError(res, 500, 'UPDATE_ERROR', 'Failed to update preferences')
    await recordSecurityEvent(client, user.id, req, 'preferences.updated', 'info', 'Account preferences updated')
    return res.json({ data: { preferences: normalizePreferences(data) } })
  } catch (err) {
    console.error('Preferences update error:', err)
    return jsonError(res, 500, 'UPDATE_ERROR', 'Failed to update preferences')
  }
})

router.put('/security', async (req: AuthedRequest, res: Response) => {
  const user = req.user!
  const client = req.authClient!
  try {
    const trustedDays = Number(req.body.trustedDeviceExpiryDays)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (req.body.mfaEnforced !== undefined) updates.mfa_enforced = Boolean(req.body.mfaEnforced)
    if (req.body.suspiciousLoginAlerts !== undefined) updates.suspicious_login_alerts = Boolean(req.body.suspiciousLoginAlerts)
    if (req.body.securityEmailNotifications !== undefined) updates.security_email_notifications = Boolean(req.body.securityEmailNotifications)
    if (Number.isFinite(trustedDays)) updates.trusted_device_expiry_days = Math.min(365, Math.max(1, Math.round(trustedDays)))

    const { data, error } = await client
      .from('user_security_settings')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error || !data) return jsonError(res, 500, 'UPDATE_ERROR', 'Failed to update security settings')
    const twoFactorEnabled = await getTwoFactorEnabled(client)
    await recordSecurityEvent(client, user.id, req, 'security.settings_updated', 'success', 'Security notification settings updated')
    return res.json({ data: { security: normalizeSecuritySettings(data, twoFactorEnabled) } })
  } catch (err) {
    console.error('Security settings update error:', err)
    return jsonError(res, 500, 'UPDATE_ERROR', 'Failed to update security settings')
  }
})

router.post('/avatar', async (req: AuthedRequest, res: Response) => {
  try {
    const avatarUrl = await uploadProfileImage(req.authClient!, req.user!.id, 'avatar', req.body)
    const { data, error } = await req.authClient!
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', req.user!.id)
      .select('*')
      .single()
    if (error || !data) return jsonError(res, 500, 'UPDATE_ERROR', 'Avatar uploaded but profile update failed')
    await recordSecurityEvent(req.authClient!, req.user!.id, req, 'profile.avatar_updated', 'success', 'Profile avatar updated')
    return res.json({ data: { avatarUrl } })
  } catch (err) {
    return jsonError(res, 400, 'UPLOAD_ERROR', err instanceof Error ? err.message : 'Failed to upload avatar')
  }
})

router.delete('/avatar', async (req: AuthedRequest, res: Response) => {
  const client = req.authClient!
  const userId = req.user!.id
  try {
    const { data: existingFiles } = await client.storage.from('avatars').list(userId)
    if (existingFiles?.length) await client.storage.from('avatars').remove(existingFiles.map((file) => `${userId}/${file.name}`))
    await client.from('profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('id', userId)
    await recordSecurityEvent(client, userId, req, 'profile.avatar_removed', 'info', 'Profile avatar removed')
    return res.json({ data: { avatarUrl: null } })
  } catch {
    return jsonError(res, 500, 'DELETE_ERROR', 'Failed to remove avatar')
  }
})

router.post('/banner', async (req: AuthedRequest, res: Response) => {
  try {
    const bannerUrl = await uploadProfileImage(req.authClient!, req.user!.id, 'banner', req.body)
    await req.authClient!
      .from('profiles')
      .update({ banner_url: bannerUrl, updated_at: new Date().toISOString() })
      .eq('id', req.user!.id)
    await recordSecurityEvent(req.authClient!, req.user!.id, req, 'profile.banner_updated', 'success', 'Profile banner updated')
    return res.json({ data: { bannerUrl } })
  } catch (err) {
    return jsonError(res, 400, 'UPLOAD_ERROR', err instanceof Error ? err.message : 'Failed to upload banner')
  }
})

router.delete('/banner', async (req: AuthedRequest, res: Response) => {
  const client = req.authClient!
  const userId = req.user!.id
  try {
    const { data: existingFiles } = await client.storage.from('profile-banners').list(userId)
    if (existingFiles?.length) await client.storage.from('profile-banners').remove(existingFiles.map((file) => `${userId}/${file.name}`))
    await client.from('profiles').update({ banner_url: null, updated_at: new Date().toISOString() }).eq('id', userId)
    await recordSecurityEvent(client, userId, req, 'profile.banner_removed', 'info', 'Profile banner removed')
    return res.json({ data: { bannerUrl: null } })
  } catch {
    return jsonError(res, 500, 'DELETE_ERROR', 'Failed to remove banner')
  }
})

router.post('/change-password', async (req: AuthedRequest, res: Response) => {
  const user = req.user!
  const client = req.authClient!
  if (!checkRateLimit(user.id, 'change-password', 5, 15 * 60 * 1000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many password attempts. Try again later.')
  }

  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : ''
  const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : ''
  const issues = passwordIssues(newPassword, user.email)
  if (!currentPassword || issues.length > 0) {
    return jsonError(res, 400, 'VALIDATION_ERROR', issues[0] || 'Current password is required')
  }

  const { error: signInError } = await client.auth.signInWithPassword({ email: user.email || '', password: currentPassword })
  if (signInError) {
    await recordSecurityEvent(client, user.id, req, 'password.change_failed', 'warning', 'Password change rejected: invalid current password')
    return jsonError(res, 403, 'AUTH_ERROR', 'Current password is incorrect')
  }

  await ensureSessionBound(client, req.token!, getRefreshToken(req))
  const { error: updateError } = await client.auth.updateUser({ password: newPassword })
  if (updateError) {
    return res.json({ data: { requiresClientUpdate: true, message: 'Password verified. Complete update with the active Supabase session.' } })
  }

  await client
    .from('user_security_settings')
    .upsert({ user_id: user.id, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  await recordSecurityEvent(client, user.id, req, 'password.changed', 'success', 'Password updated successfully')
  return res.json({ data: { message: 'Password updated successfully' } })
})

router.post('/change-email', async (req: AuthedRequest, res: Response) => {
  const user = req.user!
  const client = req.authClient!
  if (!checkRateLimit(user.id, 'change-email', 5, 15 * 60 * 1000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many email change attempts. Try again later.')
  }

  const newEmail = typeof req.body.newEmail === 'string' ? req.body.newEmail.trim().toLowerCase() : ''
  const password = typeof req.body.password === 'string' ? req.body.password : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return jsonError(res, 400, 'VALIDATION_ERROR', 'Enter a valid email address')
  }
  if (!password) return jsonError(res, 400, 'VALIDATION_ERROR', 'Current password is required')

  const { error: signInError } = await client.auth.signInWithPassword({ email: user.email || '', password })
  if (signInError) {
    await recordSecurityEvent(client, user.id, req, 'email.change_failed', 'warning', 'Email change rejected: invalid current password', { newEmail })
    return jsonError(res, 403, 'AUTH_ERROR', 'Current password is incorrect')
  }

  await ensureSessionBound(client, req.token!, getRefreshToken(req))
  const { error: updateError } = await client.auth.updateUser({ email: newEmail })
  if (updateError) {
    return res.json({ data: { requiresClientUpdate: true, newEmail, message: 'Email verified. Complete verification with the active Supabase session.' } })
  }

  await recordSecurityEvent(client, user.id, req, 'email.change_requested', 'success', 'Email verification requested', { newEmail })
  return res.json({ data: { newEmail, message: 'Verification email sent to your new address.' } })
})

router.post('/2fa/enable', async (req: AuthedRequest, res: Response) => {
  const client = req.authClient!
  const user = req.user!
  if (!checkRateLimit(user.id, 'mfa-enable', 8, 15 * 60 * 1000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many MFA enrollment attempts. Try again later.')
  }

  await ensureSessionBound(client, req.token!, getRefreshToken(req))
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'QGuard Helix Authenticator',
  })

  if (error || !data) return jsonError(res, 400, 'MFA_ERROR', error?.message || 'Failed to start MFA enrollment')
  await recordSecurityEvent(client, user.id, req, 'mfa.enrollment_started', 'info', 'Two-factor enrollment started')

  return res.json({
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  })
})

router.post('/2fa/verify', async (req: AuthedRequest, res: Response) => {
  const client = req.authClient!
  const user = req.user!
  const factorId = typeof req.body.factorId === 'string' ? req.body.factorId : ''
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : ''
  if (!factorId || !/^\d{6}$/.test(code)) return jsonError(res, 400, 'VALIDATION_ERROR', 'Enter the 6-digit authenticator code')

  await ensureSessionBound(client, req.token!, getRefreshToken(req))
  const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId })
  if (challengeError || !challenge) return jsonError(res, 400, 'MFA_ERROR', challengeError?.message || 'Failed to create MFA challenge')

  const { error: verifyError } = await client.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
  if (verifyError) return jsonError(res, 400, 'MFA_ERROR', 'Invalid verification code')

  const recoveryCodes = generateRecoveryCodes()
  await client.from('user_mfa_recovery_codes').delete().eq('user_id', user.id)
  await client.from('user_mfa_recovery_codes').insert(recoveryCodes.map((recoveryCode) => ({
    user_id: user.id,
    code_hash: hashRecoveryCode(user.id, recoveryCode),
    code_suffix: recoveryCode.slice(-6),
  })))
  await client
    .from('user_security_settings')
    .upsert({
      user_id: user.id,
      two_factor_enabled: true,
      recovery_codes_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  await recordSecurityEvent(client, user.id, req, 'mfa.enabled', 'success', 'Two-factor authentication enabled')
  return res.json({ data: { message: 'Two-factor authentication enabled', recoveryCodes } })
})

router.post('/2fa/disable', async (req: AuthedRequest, res: Response) => {
  const client = req.authClient!
  const user = req.user!
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : ''
  const recoveryCode = typeof req.body.recoveryCode === 'string' ? req.body.recoveryCode.trim() : ''
  if (!code && !recoveryCode) return jsonError(res, 400, 'VALIDATION_ERROR', 'Verification code or recovery code required')

  await ensureSessionBound(client, req.token!, getRefreshToken(req))
  const { data: factors } = await client.auth.mfa.listFactors()
  const factor = ((factors as any)?.totp || []).find((item: any) => item.status === 'verified')

  if (recoveryCode) {
    const codeHash = hashRecoveryCode(user.id, recoveryCode)
    const { data: stored } = await client
      .from('user_mfa_recovery_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .single()
    if (!stored) return jsonError(res, 400, 'MFA_ERROR', 'Invalid recovery code')
    await client.from('user_mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('id', stored.id)
  } else {
    if (!factor) return jsonError(res, 400, 'MFA_ERROR', 'Two-factor authentication is not enabled')
    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({ factorId: factor.id })
    if (challengeError || !challenge) return jsonError(res, 400, 'MFA_ERROR', 'Failed to create MFA challenge')
    const { error: verifyError } = await client.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code })
    if (verifyError) return jsonError(res, 400, 'MFA_ERROR', 'Invalid verification code')
  }

  if (factor) {
    const { error: unenrollError } = await client.auth.mfa.unenroll({ factorId: factor.id })
    if (unenrollError) return jsonError(res, 500, 'MFA_ERROR', 'Failed to disable 2FA')
  }

  await client
    .from('user_security_settings')
    .upsert({ user_id: user.id, two_factor_enabled: false, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  await recordSecurityEvent(client, user.id, req, 'mfa.disabled', 'warning', 'Two-factor authentication disabled')
  return res.json({ data: { message: 'Two-factor authentication disabled' } })
})

router.post('/recovery-codes/regenerate', async (req: AuthedRequest, res: Response) => {
  const client = req.authClient!
  const user = req.user!
  if (!checkRateLimit(user.id, 'recovery-regenerate', 5, 15 * 60 * 1000)) {
    return jsonError(res, 429, 'RATE_LIMITED', 'Too many recovery-code requests. Try again later.')
  }
  const recoveryCodes = generateRecoveryCodes()
  await client.from('user_mfa_recovery_codes').delete().eq('user_id', user.id)
  await client.from('user_mfa_recovery_codes').insert(recoveryCodes.map((recoveryCode) => ({
    user_id: user.id,
    code_hash: hashRecoveryCode(user.id, recoveryCode),
    code_suffix: recoveryCode.slice(-6),
  })))
  await client
    .from('user_security_settings')
    .upsert({ user_id: user.id, recovery_codes_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  await recordSecurityEvent(client, user.id, req, 'mfa.recovery_codes_regenerated', 'warning', 'MFA recovery codes regenerated')
  return res.json({ data: { recoveryCodes } })
})

router.get('/activity', async (req: AuthedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '30'), 10) || 30, 100)
    const activity = await fetchActivity(req.authClient!, req.user!.id, limit)
    return res.json({ data: { activity } })
  } catch {
    return jsonError(res, 500, 'ACTIVITY_ERROR', 'Failed to fetch activity')
  }
})

router.patch('/devices/:id', async (req: AuthedRequest, res: Response) => {
  const trusted = Boolean(req.body.trusted)
  const { data, error } = await req.authClient!
    .from('user_devices')
    .update({ trusted, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select('*')
    .single()
  if (error || !data) return jsonError(res, 404, 'NOT_FOUND', 'Device not found')
  await recordSecurityEvent(req.authClient!, req.user!.id, req, trusted ? 'device.trusted' : 'device.untrusted', 'success', trusted ? 'Device marked trusted' : 'Device trust removed', { deviceId: req.params.id })
  return res.json({ data: { device: normalizeDevice(data) } })
})

router.delete('/sessions/:id', async (req: AuthedRequest, res: Response) => {
  const { data, error } = await req.authClient!
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('user_id', req.user!.id)
    .select('*')
    .single()
  if (error || !data) return jsonError(res, 404, 'NOT_FOUND', 'Session not found')
  await recordSecurityEvent(req.authClient!, req.user!.id, req, 'session.revoked', 'warning', 'Account session revoked', { sessionId: req.params.id })
  return res.json({ data: { revoked: true } })
})

export default router
