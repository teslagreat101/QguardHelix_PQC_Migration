import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Bell,
  CheckCircle2,
  Clock3,
  Globe2,
  KeyRound,
  Laptop,
  LockKeyhole,
  Mail,
  Monitor,
  QrCode,
  RefreshCw,
  Save,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
  UserCog,
  XCircle,
} from 'lucide-react'
import {
  MfaEnrollment,
  ProfileTheme,
  UserActivity,
  UserDevice,
  UserPreferences,
  UserProfileSettings,
  UserSecuritySettings,
  UserSession,
  useProfileSettings,
} from '@/hooks/use-profile-settings'

type SettingsTab = 'profile' | 'security' | 'preferences' | 'activity'

const inputClass = 'w-full rounded-lg border border-gold/15 bg-black/45 px-3 py-2.5 text-sm text-white outline-none transition focus:border-gold/50 focus:bg-black/65'
const labelClass = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-white/35'
const ghostButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gold/20 bg-gold/[0.04] px-3 py-2 text-xs font-bold text-gold transition hover:border-gold/40 hover:bg-gold/[0.08] disabled:cursor-not-allowed disabled:opacity-50'
const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-gold/40 bg-gold px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_0_20px_rgba(212,175,55,0.18)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50'

const TABS: { key: SettingsTab; label: string; icon: typeof UserCog }[] = [
  { key: 'profile', label: 'Profile', icon: UserCog },
  { key: 'security', label: 'Security', icon: ShieldCheck },
  { key: 'preferences', label: 'Preferences', icon: Settings },
  { key: 'activity', label: 'Activity', icon: Activity },
]

const THEME_OPTIONS: { key: ProfileTheme; label: string; accent: string }[] = [
  { key: 'gold', label: 'Gold', accent: 'from-gold to-yellow-200' },
  { key: 'dark', label: 'Dark', accent: 'from-zinc-500 to-white' },
  { key: 'light', label: 'Light', accent: 'from-white to-cyan-200' },
  { key: 'cyber', label: 'Cyber', accent: 'from-cyan-400 to-fuchsia-400' },
]

const TIMEZONES = ['UTC', 'Asia/Manila', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore']
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
]

type ProfileDraft = Pick<UserProfileSettings, 'fullName' | 'username' | 'role' | 'company' | 'phone' | 'location' | 'department' | 'jobTitle'>

const PROFILE_FIELD_LIMITS: Record<keyof ProfileDraft, number> = {
  fullName: 200,
  username: 60,
  role: 200,
  company: 200,
  phone: 40,
  location: 200,
  department: 200,
  jobTitle: 200,
}

function createProfileDraft(profile?: UserProfileSettings | null): ProfileDraft {
  return {
    fullName: profile?.fullName || '',
    username: profile?.username || '',
    role: profile?.role || '',
    company: profile?.company || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    department: profile?.department || '',
    jobTitle: profile?.jobTitle || '',
  }
}

function validateProfileDraft(draft: ProfileDraft) {
  for (const [key, limit] of Object.entries(PROFILE_FIELD_LIMITS) as [keyof ProfileDraft, number][]) {
    if ((draft[key] || '').length > limit) return `${key} must be ${limit} characters or fewer.`
  }
  if (draft.username && !/^[a-zA-Z0-9_.-]{3,60}$/.test(draft.username)) {
    return 'Username must be 3-60 characters using letters, numbers, dots, underscores, or hyphens.'
  }
  if (draft.phone && !/^[+()0-9\s.-]{7,40}$/.test(draft.phone)) {
    return 'Phone number can only include digits, spaces, plus signs, dashes, dots, and parentheses.'
  }
  return null
}

function validatePreferencesDraft(draft: UserPreferences) {
  if (!LANGUAGES.some((language) => language.value === draft.language)) return 'Choose a supported language.'
  if (!TIMEZONES.includes(draft.timezone)) return 'Choose a supported timezone.'
  if (!['compact', 'comfortable', 'expanded'].includes(draft.dashboardDensity)) return 'Choose a valid dashboard density.'
  if (!draft.defaultDashboardView.trim()) return 'Choose a default dashboard view.'
  return null
}

function validateSecurityDraft(draft: UserSecuritySettings) {
  if (!Number.isFinite(draft.trustedDeviceExpiryDays) || draft.trustedDeviceExpiryDays < 1 || draft.trustedDeviceExpiryDays > 365) {
    return 'Trusted device expiry must be between 1 and 365 days.'
  }
  return null
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleString()
}

function timeAgo(value?: string | null) {
  if (!value) return 'Never'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${sizes[index]}`
}

function passwordScore(password: string) {
  let score = 0
  if (password.length >= 12) score += 25
  if (/[a-z]/.test(password)) score += 15
  if (/[A-Z]/.test(password)) score += 15
  if (/[0-9]/.test(password)) score += 15
  if (/[^A-Za-z0-9]/.test(password)) score += 20
  if (password.length >= 18) score += 10
  return Math.min(100, score)
}

function qrImageSource(value: string) {
  if (value.startsWith('data:') || value.startsWith('http')) return value
  return `data:image/svg+xml;utf8,${encodeURIComponent(value)}`
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-gold/15 bg-black/45 p-5 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.25)] ${className}`}>
      {children}
    </div>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  maxLength,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  maxLength?: number
  autoComplete?: string
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input
        className={inputClass}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-3">
      <div>
        <div className="text-sm font-bold text-white/85">{title}</div>
        <div className="mt-0.5 text-xs text-white/40">{description}</div>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition ${checked ? 'border-gold/50 bg-gold/35' : 'border-white/15 bg-white/10'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

function DeviceIcon({ type }: { type: string }) {
  if (type === 'mobile') return <Smartphone className="h-4 w-4" />
  if (type === 'tablet') return <Tablet className="h-4 w-4" />
  if (type === 'desktop') return <Monitor className="h-4 w-4" />
  return <Laptop className="h-4 w-4" />
}

function SeverityDot({ severity }: { severity: UserActivity['severity'] }) {
  const color = severity === 'critical' ? 'bg-red-500' : severity === 'warning' ? 'bg-yellow-400' : severity === 'success' ? 'bg-green-400' : 'bg-cyan-400'
  return <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${color} shadow-[0_0_10px_currentColor]`} />
}

function ProfileTab({
  profile,
  draft,
  setDraft,
  saving,
  onSave,
  onUpload,
  onRemove,
  onChangeEmail,
  validationError,
}: {
  profile: UserProfileSettings
  draft: ProfileDraft
  setDraft: (updates: Partial<ProfileDraft>) => void
  saving: boolean
  onSave: () => Promise<unknown>
  onUpload: (kind: 'avatar' | 'banner', file: File) => Promise<void>
  onRemove: (kind: 'avatar' | 'banner') => Promise<void>
  onChangeEmail: (email: string, password: string) => Promise<void>
  validationError: string | null
}) {
  const [emailForm, setEmailForm] = useState({ newEmail: '', password: '' })
  const initials = (profile.fullName || profile.email || 'QG').split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

  const update = (key: keyof ProfileDraft, value: string) => setDraft({ [key]: value })

  async function submitProfile(event: FormEvent) {
    event.preventDefault()
    if (validationError) return
    await onSave()
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault()
    await onChangeEmail(emailForm.newEmail, emailForm.password)
    setEmailForm({ newEmail: '', password: '' })
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
      <SectionCard className="overflow-hidden p-0">
        <div
          className="relative h-44 border-b border-gold/15 bg-[radial-gradient(circle_at_20%_10%,rgba(212,175,55,0.25),transparent_35%),linear-gradient(135deg,rgba(2,6,23,0.96),rgba(0,0,0,0.98))]"
          style={profile.bannerUrl ? { backgroundImage: `linear-gradient(90deg,rgba(0,0,0,0.55),rgba(0,0,0,0.2)),url(${profile.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <div className="absolute bottom-4 left-5 flex items-end gap-4">
            <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-lg border border-gold/35 bg-black/60 text-2xl font-black text-gold shadow-[0_0_26px_rgba(212,175,55,0.18)]">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" /> : initials}
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-black text-white">{profile.fullName || 'Unnamed operator'}</h2>
              <p className="text-xs text-white/45">{profile.email}</p>
            </div>
          </div>
          <div className="absolute right-4 top-4 flex flex-wrap justify-end gap-2">
            <label className={ghostButtonClass}>
              <Upload className="h-3.5 w-3.5" />
              Avatar
              <input type="file" accept="image/*" className="hidden" onChange={async (event) => {
                const file = event.currentTarget.files?.[0]
                if (file) await onUpload('avatar', file)
                event.currentTarget.value = ''
              }} />
            </label>
            <label className={ghostButtonClass}>
              <Upload className="h-3.5 w-3.5" />
              Banner
              <input type="file" accept="image/*" className="hidden" onChange={async (event) => {
                const file = event.currentTarget.files?.[0]
                if (file) await onUpload('banner', file)
                event.currentTarget.value = ''
              }} />
            </label>
          </div>
        </div>

        <form onSubmit={submitProfile} className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Full name" value={draft.fullName} maxLength={PROFILE_FIELD_LIMITS.fullName} autoComplete="name" onChange={(value) => update('fullName', value)} />
            <TextField label="Username" value={draft.username} maxLength={PROFILE_FIELD_LIMITS.username} autoComplete="username" onChange={(value) => update('username', value)} />
            <TextField label="Role" value={draft.role} maxLength={PROFILE_FIELD_LIMITS.role} onChange={(value) => update('role', value)} />
            <TextField label="Job title" value={draft.jobTitle} maxLength={PROFILE_FIELD_LIMITS.jobTitle} autoComplete="organization-title" onChange={(value) => update('jobTitle', value)} />
            <TextField label="Company" value={draft.company} maxLength={PROFILE_FIELD_LIMITS.company} autoComplete="organization" onChange={(value) => update('company', value)} />
            <TextField label="Department" value={draft.department} maxLength={PROFILE_FIELD_LIMITS.department} onChange={(value) => update('department', value)} />
            <TextField label="Phone" type="tel" value={draft.phone} maxLength={PROFILE_FIELD_LIMITS.phone} autoComplete="tel" onChange={(value) => update('phone', value)} />
            <TextField label="Location" value={draft.location} maxLength={PROFILE_FIELD_LIMITS.location} autoComplete="address-level2" onChange={(value) => update('location', value)} />
          </div>

          {validationError && (
            <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-100">
              {validationError}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-4">
            <div className="flex gap-2">
              {profile.avatarUrl && (
                <button type="button" className={ghostButtonClass} onClick={() => onRemove('avatar')} disabled={saving}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Avatar
                </button>
              )}
              {profile.bannerUrl && (
                <button type="button" className={ghostButtonClass} onClick={() => onRemove('banner')} disabled={saving}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Banner
                </button>
              )}
            </div>
            <button type="submit" className={primaryButtonClass} disabled={saving || Boolean(validationError)}>
              <Save className="h-3.5 w-3.5" />
              Save Profile
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="space-y-5">
        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <Mail className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Email Verification</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/45">Current email</span>
              <span className="text-right font-mono text-white/80">{profile.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/45">Verified</span>
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${profile.emailVerifiedAt ? 'text-green-400' : 'text-yellow-400'}`}>
                {profile.emailVerifiedAt ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                {profile.emailVerifiedAt ? 'Verified' : 'Pending'}
              </span>
            </div>
            {profile.pendingEmail && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-xs text-yellow-100">
                Verification pending for {profile.pendingEmail}
              </div>
            )}
          </div>
          <form onSubmit={submitEmail} className="mt-5 space-y-3">
            <TextField label="New email" type="email" value={emailForm.newEmail} autoComplete="email" onChange={(value) => setEmailForm((prev) => ({ ...prev, newEmail: value }))} />
            <TextField label="Current password" type="password" value={emailForm.password} autoComplete="current-password" onChange={(value) => setEmailForm((prev) => ({ ...prev, password: value }))} />
            <button type="submit" className={primaryButtonClass} disabled={saving || !emailForm.newEmail || !emailForm.password}>
              <Mail className="h-3.5 w-3.5" />
              Send Verification
            </button>
          </form>
        </SectionCard>

        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Account Timeline</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><span className="text-white/45">Created</span><span className="text-right text-white/75">{formatDate(profile.createdAt)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-white/45">Last login</span><span className="text-right text-white/75">{formatDate(profile.lastLoginAt)}</span></div>
            <div className="flex justify-between gap-4"><span className="text-white/45">Plan</span><span className="text-right font-black uppercase text-gold">{profile.tier}</span></div>
            <div className="flex justify-between gap-4"><span className="text-white/45">Vault storage</span><span className="text-right text-white/75">{formatBytes(profile.usage.vaultStorageUsed)} / {formatBytes(profile.usage.maxVaultStorage)}</span></div>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function SecurityTab({
  profile,
  security,
  devices,
  sessions,
  saving,
  recoveryCodes,
  clearRecoveryCodes,
  updateSecurity,
  changePassword,
  startMfaEnrollment,
  verifyMfa,
  disableMfa,
  regenerateRecoveryCodes,
  setDeviceTrust,
  revokeSession,
}: {
  profile: UserProfileSettings
  security: UserSecuritySettings
  devices: UserDevice[]
  sessions: UserSession[]
  saving: boolean
  recoveryCodes: string[]
  clearRecoveryCodes: () => void
  updateSecurity: (updates: Partial<UserSecuritySettings>) => Promise<UserSecuritySettings>
  changePassword: (currentPassword: string, newPassword: string) => Promise<string>
  startMfaEnrollment: () => Promise<MfaEnrollment>
  verifyMfa: (factorId: string, code: string) => Promise<{ message: string; recoveryCodes: string[] }>
  disableMfa: (code: string, recoveryCode?: string) => Promise<string>
  regenerateRecoveryCodes: () => Promise<string[]>
  setDeviceTrust: (deviceId: string, trusted: boolean) => Promise<UserDevice>
  revokeSession: (sessionId: string) => Promise<void>
}) {
  const [securityDraft, setSecurityDraft] = useState<UserSecuritySettings>(security)
  const [securityDirty, setSecurityDirty] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [mfaEnrollment, setMfaEnrollment] = useState<MfaEnrollment | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [disableForm, setDisableForm] = useState({ code: '', recoveryCode: '' })

  useEffect(() => {
    if (!securityDirty) setSecurityDraft(security)
  }, [security, securityDirty])

  const score = passwordScore(passwordForm.next)
  const passwordMismatch = passwordForm.next && passwordForm.confirm && passwordForm.next !== passwordForm.confirm
  const securityValidationError = useMemo(() => validateSecurityDraft(securityDraft), [securityDraft])
  const updateSecurityDraft = useCallback((updates: Partial<UserSecuritySettings>) => {
    setSecurityDirty(true)
    setSecurityDraft((prev) => ({ ...prev, ...updates }))
  }, [])

  async function submitPassword(event: FormEvent) {
    event.preventDefault()
    if (passwordMismatch) return
    await changePassword(passwordForm.current, passwordForm.next)
    setPasswordForm({ current: '', next: '', confirm: '' })
  }

  async function submitSecurity(event: FormEvent) {
    event.preventDefault()
    if (securityValidationError) return
    const saved = await updateSecurity(securityDraft)
    setSecurityDraft(saved)
    setSecurityDirty(false)
  }

  async function beginMfa() {
    const enrollment = await startMfaEnrollment()
    setMfaEnrollment(enrollment)
  }

  async function completeMfa(event: FormEvent) {
    event.preventDefault()
    if (!mfaEnrollment) return
    await verifyMfa(mfaEnrollment.factorId, mfaCode)
    setMfaCode('')
    setMfaEnrollment(null)
  }

  async function submitDisableMfa(event: FormEvent) {
    event.preventDefault()
    await disableMfa(disableForm.code, disableForm.recoveryCode)
    setDisableForm({ code: '', recoveryCode: '' })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={ShieldCheck} label="2FA Status" value={security.twoFactorEnabled ? 'Enabled' : 'Disabled'} tone={security.twoFactorEnabled ? 'green' : 'yellow'} />
        <MetricCard icon={KeyRound} label="Recovery Codes" value={`${profile.recoveryCodesRemaining} active`} tone={profile.recoveryCodesRemaining > 0 ? 'cyan' : 'yellow'} />
        <MetricCard icon={Clock3} label="Password Changed" value={timeAgo(security.passwordChangedAt)} tone="gold" />
        <MetricCard icon={Monitor} label="Active Sessions" value={String(sessions.length)} tone="cyan" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <LockKeyhole className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Password</h3>
          </div>
          <form onSubmit={submitPassword} className="space-y-3">
            <TextField label="Current password" type="password" value={passwordForm.current} autoComplete="current-password" onChange={(value) => setPasswordForm((prev) => ({ ...prev, current: value }))} />
            <TextField label="New password" type="password" value={passwordForm.next} autoComplete="new-password" onChange={(value) => setPasswordForm((prev) => ({ ...prev, next: value }))} />
            <TextField label="Confirm password" type="password" value={passwordForm.confirm} autoComplete="new-password" onChange={(value) => setPasswordForm((prev) => ({ ...prev, confirm: value }))} />
            <div>
              <div className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
                <span>Password Strength</span>
                <span className={score >= 80 ? 'text-green-400' : score >= 55 ? 'text-yellow-400' : 'text-red-400'}>{score}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-green-400' : score >= 55 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${score}%` }} />
              </div>
            </div>
            {passwordMismatch && <div className="text-xs text-red-300">Passwords do not match.</div>}
            <button type="submit" className={primaryButtonClass} disabled={saving || score < 75 || passwordMismatch || !passwordForm.current}>
              <KeyRound className="h-3.5 w-3.5" />
              Change Password
            </button>
          </form>
        </SectionCard>

        <SectionCard>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Two-Factor Authentication</h3>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${security.twoFactorEnabled ? 'border-green-400/30 bg-green-400/10 text-green-300' : 'border-yellow-400/30 bg-yellow-400/10 text-yellow-200'}`}>
              {security.twoFactorEnabled ? 'Protected' : 'Action Needed'}
            </span>
          </div>

          {!security.twoFactorEnabled && !mfaEnrollment && (
            <button type="button" className={primaryButtonClass} disabled={saving} onClick={beginMfa}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Enable 2FA
            </button>
          )}

          {mfaEnrollment && (
            <form onSubmit={completeMfa} className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="rounded-lg border border-gold/20 bg-white p-3">
                <img src={qrImageSource(mfaEnrollment.qrCode)} alt="Authenticator QR code" className="h-36 w-36" />
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3 font-mono text-xs text-white/70 break-all">
                  {mfaEnrollment.secret}
                </div>
                <TextField label="Authenticator code" value={mfaCode} onChange={setMfaCode} placeholder="123456" />
                <button type="submit" className={primaryButtonClass} disabled={saving || mfaCode.length < 6}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Verify 2FA
                </button>
              </div>
            </form>
          )}

          {security.twoFactorEnabled && (
            <form onSubmit={submitDisableMfa} className="space-y-3">
              <div className="rounded-lg border border-green-400/20 bg-green-400/10 p-3 text-sm text-green-100">
                Authenticator TOTP is active for this account.
              </div>
              <TextField label="Authenticator code" value={disableForm.code} onChange={(value) => setDisableForm((prev) => ({ ...prev, code: value }))} placeholder="123456" />
              <TextField label="Recovery code" value={disableForm.recoveryCode} onChange={(value) => setDisableForm((prev) => ({ ...prev, recoveryCode: value }))} placeholder="Optional fallback" />
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={ghostButtonClass} disabled={saving || (!disableForm.code && !disableForm.recoveryCode)}>
                  <XCircle className="h-3.5 w-3.5" />
                  Disable 2FA
                </button>
                <button type="button" className={ghostButtonClass} disabled={saving} onClick={regenerateRecoveryCodes}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate Codes
                </button>
              </div>
            </form>
          )}

          {recoveryCodes.length > 0 && (
            <div className="mt-5 rounded-lg border border-gold/20 bg-gold/[0.04] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-gold">Recovery Codes</div>
                <button type="button" className="text-xs font-bold text-white/45 hover:text-white" onClick={clearRecoveryCodes}>Hide</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {recoveryCodes.map((code) => (
                  <code key={code} className="rounded border border-white/10 bg-black/50 px-3 py-2 text-xs text-white/85">{code}</code>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <form onSubmit={submitSecurity}>
        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Security Notifications</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <ToggleRow title="MFA enforcement" description="Require MFA for privileged account actions." checked={securityDraft.mfaEnforced} onChange={(value) => updateSecurityDraft({ mfaEnforced: value })} />
            <ToggleRow title="Suspicious login alerts" description="Receive alerts when a new device or location appears." checked={securityDraft.suspiciousLoginAlerts} onChange={(value) => updateSecurityDraft({ suspiciousLoginAlerts: value })} />
            <ToggleRow title="Security email notices" description="Send account security changes to verified email." checked={securityDraft.securityEmailNotifications} onChange={(value) => updateSecurityDraft({ securityEmailNotifications: value })} />
          </div>
          {securityValidationError && (
            <div className="mt-3 rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-100">
              {securityValidationError}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <label className="w-full max-w-xs">
              <span className={labelClass}>Trusted device expiry days</span>
              <input
                className={inputClass}
                type="number"
                min={1}
                max={365}
                value={securityDraft.trustedDeviceExpiryDays}
                onChange={(event) => updateSecurityDraft({ trustedDeviceExpiryDays: Number(event.target.value) })}
              />
            </label>
            <button type="submit" className={primaryButtonClass} disabled={saving || Boolean(securityValidationError)}>
              <Save className="h-3.5 w-3.5" />
              Save Security
            </button>
          </div>
        </SectionCard>
      </form>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <Monitor className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Active Sessions</h3>
          </div>
          <div className="space-y-3">
            {sessions.length === 0 && <EmptyState text="No active sessions recorded." />}
            {sessions.map((session) => (
              <div key={session.id}>
                <SessionRow session={session} saving={saving} onRevoke={revokeSession} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <Laptop className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Trusted Devices</h3>
          </div>
          <div className="space-y-3">
            {devices.length === 0 && <EmptyState text="No devices recorded." />}
            {devices.map((device) => (
              <div key={device.id}>
                <DeviceRow device={device} saving={saving} onTrust={setDeviceTrust} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof ShieldCheck; label: string; value: string; tone: 'green' | 'yellow' | 'cyan' | 'gold' }) {
  const color = tone === 'green' ? 'text-green-400' : tone === 'yellow' ? 'text-yellow-300' : tone === 'cyan' ? 'text-cyan-300' : 'text-gold'
  return (
    <SectionCard className="relative overflow-hidden">
      <Icon className="absolute right-4 top-4 h-12 w-12 text-white/[0.04]" />
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
        <Icon className="h-3.5 w-3.5 text-gold/60" />
        {label}
      </div>
      <div className={`mt-3 text-2xl font-black ${color}`}>{value}</div>
    </SectionCard>
  )
}

function SessionRow({ session, saving, onRevoke }: { session: UserSession; saving: boolean; onRevoke: (id: string) => Promise<void> }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-bold text-white/85">
          <Monitor className="h-4 w-4 text-gold/70" />
          <span className="truncate">{session.deviceName}</span>
          {session.current && <span className="rounded-full border border-green-400/20 bg-green-400/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-green-300">Current</span>}
        </div>
        <div className="mt-1 text-xs text-white/40">{session.ipAddress || 'Unknown IP'} - Last seen {timeAgo(session.lastSeenAt)}</div>
      </div>
      <button type="button" className={ghostButtonClass} disabled={saving || session.current} onClick={() => onRevoke(session.id)}>
        <Trash2 className="h-3.5 w-3.5" />
        Revoke
      </button>
    </div>
  )
}

function DeviceRow({ device, saving, onTrust }: { device: UserDevice; saving: boolean; onTrust: (id: string, trusted: boolean) => Promise<UserDevice> }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-bold text-white/85">
          <DeviceIcon type={device.type} />
          <span className="truncate">{device.name}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${device.trusted ? 'border-green-400/20 bg-green-400/10 text-green-300' : 'border-white/15 bg-white/5 text-white/40'}`}>
            {device.trusted ? 'Trusted' : 'Standard'}
          </span>
        </div>
        <div className="mt-1 text-xs text-white/40">{device.ipAddress || 'Unknown IP'} - Active {timeAgo(device.lastActive)}</div>
      </div>
      <button type="button" className={ghostButtonClass} disabled={saving} onClick={() => onTrust(device.id, !device.trusted)}>
        <ShieldCheck className="h-3.5 w-3.5" />
        {device.trusted ? 'Untrust' : 'Trust'}
      </button>
    </div>
  )
}

function PreferencesTab({
  preferences,
  saving,
  onSave,
}: {
  preferences: UserPreferences
  saving: boolean
  onSave: (updates: Partial<UserPreferences>) => Promise<UserPreferences>
}) {
  const [draft, setDraft] = useState<UserPreferences>(preferences)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setDraft(preferences)
  }, [dirty, preferences])

  const validationError = useMemo(() => validatePreferencesDraft(draft), [draft])
  const updateDraft = useCallback((updates: Partial<UserPreferences>) => {
    setDirty(true)
    setDraft((prev) => ({ ...prev, ...updates }))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (validationError) return
    const saved = await onSave(draft)
    setDraft(saved)
    setDirty(false)
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <SectionCard>
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Theme</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          {THEME_OPTIONS.map((theme) => (
            <button
              key={theme.key}
              type="button"
              onClick={() => updateDraft({ theme: theme.key })}
              className={`rounded-lg border p-4 text-left transition ${draft.theme === theme.key ? 'border-gold/50 bg-gold/[0.08]' : 'border-white/10 bg-white/[0.025] hover:border-gold/25'}`}
            >
              <span className={`mb-3 block h-7 rounded-md bg-gradient-to-r ${theme.accent}`} />
              <span className="text-sm font-black text-white/85">{theme.label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Notifications</h3>
          </div>
          <div className="space-y-3">
            <ToggleRow title="Email notifications" description="Operational and account updates." checked={draft.notificationEmail} onChange={(value) => updateDraft({ notificationEmail: value })} />
            <ToggleRow title="Push notifications" description="Browser and dashboard alerts." checked={draft.notificationPush} onChange={(value) => updateDraft({ notificationPush: value })} />
            <ToggleRow title="SMS notifications" description="Critical account and security events." checked={draft.notificationSms} onChange={(value) => updateDraft({ notificationSms: value })} />
            <ToggleRow title="Security alerts" description="MFA, session, and suspicious activity notices." checked={draft.securityAlerts} onChange={(value) => updateDraft({ securityAlerts: value })} />
            <ToggleRow title="Product updates" description="Release notes and platform announcements." checked={draft.productUpdates} onChange={(value) => updateDraft({ productUpdates: value })} />
          </div>
        </SectionCard>

        <SectionCard>
          <div className="mb-4 flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-gold" />
            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Localization</h3>
          </div>
          <div className="grid gap-4">
            <label>
              <span className={labelClass}>Language</span>
              <select className={inputClass} value={draft.language} onChange={(event) => updateDraft({ language: event.target.value })}>
                {LANGUAGES.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
              </select>
            </label>
            <label>
              <span className={labelClass}>Timezone</span>
              <select className={inputClass} value={draft.timezone} onChange={(event) => updateDraft({ timezone: event.target.value })}>
                {TIMEZONES.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
              </select>
            </label>
            <label>
              <span className={labelClass}>Dashboard density</span>
              <select className={inputClass} value={draft.dashboardDensity} onChange={(event) => updateDraft({ dashboardDensity: event.target.value as UserPreferences['dashboardDensity'] })}>
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="expanded">Expanded</option>
              </select>
            </label>
            <label>
              <span className={labelClass}>Default dashboard view</span>
              <select className={inputClass} value={draft.defaultDashboardView} onChange={(event) => updateDraft({ defaultDashboardView: event.target.value })}>
                <option value="overview">Overview</option>
                <option value="quantum-risk">Quantum Risk</option>
                <option value="scanner">PQC Scanner</option>
                <option value="hybrid-metrics">Hybrid Metrics</option>
              </select>
            </label>
            <ToggleRow title="Telemetry sync" description="Use live profile telemetry and account activity streams." checked={draft.telemetryOptIn} onChange={(value) => updateDraft({ telemetryOptIn: value })} />
          </div>
        </SectionCard>
      </div>

      {validationError && (
        <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-100">
          {validationError}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" className={primaryButtonClass} disabled={saving || Boolean(validationError)}>
          <Save className="h-3.5 w-3.5" />
          Save Preferences
        </button>
      </div>
    </form>
  )
}

function ActivityTab({ activity, onRefresh, saving }: { activity: UserActivity[]; onRefresh: () => Promise<void>; saving: boolean }) {
  return (
    <SectionCard>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-gold" />
          <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/70">Recent Account Activity</h3>
        </div>
        <button type="button" className={ghostButtonClass} onClick={onRefresh} disabled={saving}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
      <div className="space-y-3">
        {activity.length === 0 && <EmptyState text="No recent account activity." />}
        {activity.map((event) => (
          <div key={event.id} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3">
            <SeverityDot severity={event.severity} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-white/85">{event.message}</div>
                <div className="font-mono text-[10px] text-white/35">{timeAgo(event.createdAt)}</div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                <span>{event.eventType}</span>
                <span>{event.ipAddress || 'Unknown IP'}</span>
                <span className="truncate">{event.userAgent || 'Unknown device'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/35">
      {text}
    </div>
  )
}

export default function ProfileSettingsPage() {
  const {
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
    clearRecoveryCodes,
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
  } = useProfileSettings()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => createProfileDraft())
  const [profileDirty, setProfileDirty] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (profile && !profileDirty) setProfileDraft(createProfileDraft(profile))
  }, [profile, profileDirty])

  const profileValidationError = useMemo(() => validateProfileDraft(profileDraft), [profileDraft])

  const updateProfileDraft = useCallback((updates: Partial<ProfileDraft>) => {
    setProfileDirty(true)
    setProfileDraft((prev) => ({ ...prev, ...updates }))
  }, [])

  const securityScore = useMemo(() => {
    if (!profile || !security) return 0
    let score = 50
    if (security.twoFactorEnabled) score += 20
    if (profile.recoveryCodesRemaining > 0) score += 10
    if (devices.some((device) => device.trusted)) score += 10
    if (security.suspiciousLoginAlerts) score += 10
    return Math.min(100, score)
  }, [devices, profile, security])

  async function showNotice<T>(action: () => Promise<T>, message: string): Promise<T> {
    setNotice(null)
    const result = await action()
    setNotice(message)
    window.setTimeout(() => setNotice(null), 4500)
    return result
  }

  async function saveProfileDraft() {
    if (profileValidationError) return
    const saved = await updateProfile(profileDraft)
    setProfileDraft(createProfileDraft(saved))
    setProfileDirty(false)
    return saved
  }

  if (loading) {
    return (
      <div className="min-h-screen p-6 lg:p-8">
        <div className="mb-6 h-28 animate-pulse rounded-lg border border-gold/15 bg-white/[0.04]" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-lg border border-gold/15 bg-white/[0.03]" />)}
        </div>
      </div>
    )
  }

  if (!profile || !preferences || !security) {
    return (
      <div className="min-h-screen p-6 lg:p-8">
        <SectionCard className="mx-auto max-w-xl text-center">
          <ShieldAlert className="mx-auto mb-4 h-8 w-8 text-yellow-300" />
          <h1 className="text-xl font-black text-white">Profile settings unavailable</h1>
          <p className="mt-2 text-sm text-white/45">{error || 'The account profile schema is not ready yet.'}</p>
          <button type="button" className={`${primaryButtonClass} mt-5`} onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </SectionCard>
      </div>
    )
  }

  return (
    <div className="min-h-screen space-y-6 p-6 lg:p-8">
      <header className="relative overflow-hidden rounded-lg border border-gold/15 bg-black/55 p-5 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(212,175,55,0.18),transparent_28%),radial-gradient(circle_at_88%_12%,rgba(0,243,255,0.12),transparent_24%)]" />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-gold">
              <UserCog className="h-3.5 w-3.5" />
              Identity Control Plane
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">
              Profile & <span className="text-gold">Security</span>
            </h1>
            <p className="mt-1 text-sm text-white/45">
              {profile.fullName || profile.email} - {profile.company || 'QGuard Helix account'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Security Score</div>
              <div className="mt-1 text-2xl font-black text-gold">{securityScore}%</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Realtime</div>
              <div className={`mt-2 inline-flex items-center gap-2 text-xs font-bold ${sseConnected ? 'text-green-300' : 'text-yellow-300'}`}>
                <span className={`h-2 w-2 rounded-full ${sseConnected ? 'bg-green-400' : 'bg-yellow-400'} ${sseConnected ? 'animate-pulse' : ''}`} />
                {sseConnected ? 'Live' : 'Polling'}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Last Sync</div>
              <div className="mt-2 text-xs font-bold text-white/70">{timeAgo(telemetry?.lastSyncAt)}</div>
            </div>
          </div>
        </div>
      </header>

      {(error || notice) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-500/25 bg-red-500/10 text-red-100' : 'border-green-400/25 bg-green-400/10 text-green-100'}`}>
          {error || notice}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto border-b border-gold/15 pb-0">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 rounded-t-lg border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition ${
                active ? 'border-gold/35 border-b-black bg-gold/[0.08] text-gold' : 'border-transparent text-white/35 hover:bg-white/[0.03] hover:text-white/70'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {active && <motion.span layoutId="settings-tab" className="absolute inset-x-2 bottom-0 h-[2px] bg-gold" />}
            </button>
          )
        })}
      </div>

      {activeTab === 'profile' && (
        <ProfileTab
          profile={profile}
          draft={profileDraft}
          setDraft={updateProfileDraft}
          saving={saving}
          validationError={profileValidationError}
          onSave={() => showNotice(saveProfileDraft, 'Profile updated.')}
          onUpload={(kind, file) => showNotice(() => uploadMedia(kind, file), kind === 'avatar' ? 'Avatar updated.' : 'Banner updated.')}
          onRemove={(kind) => showNotice(() => removeMedia(kind), kind === 'avatar' ? 'Avatar removed.' : 'Banner removed.')}
          onChangeEmail={(email, password) => showNotice(() => changeEmail(email, password), 'Verification email requested.')}
        />
      )}

      {activeTab === 'security' && (
        <SecurityTab
          profile={profile}
          security={security}
          devices={devices}
          sessions={sessions}
          saving={saving}
          recoveryCodes={recoveryCodes}
          clearRecoveryCodes={clearRecoveryCodes}
          updateSecurity={(updates) => showNotice(() => updateSecurity(updates), 'Security settings updated.')}
          changePassword={(current, next) => showNotice(() => changePassword(current, next), 'Password updated.')}
          startMfaEnrollment={startMfaEnrollment}
          verifyMfa={verifyMfa}
          disableMfa={(code, recoveryCode) => showNotice(() => disableMfa(code, recoveryCode), 'Two-factor authentication disabled.')}
          regenerateRecoveryCodes={regenerateRecoveryCodes}
          setDeviceTrust={setDeviceTrust}
          revokeSession={revokeSession}
        />
      )}

      {activeTab === 'preferences' && (
        <PreferencesTab
          preferences={preferences}
          saving={saving}
          onSave={(updates) => showNotice(() => updatePreferences(updates), 'Preferences saved.')}
        />
      )}

      {activeTab === 'activity' && (
        <ActivityTab
          activity={activity}
          saving={saving}
          onRefresh={() => showNotice(refreshActivity, 'Activity refreshed.')}
        />
      )}
    </div>
  )
}
