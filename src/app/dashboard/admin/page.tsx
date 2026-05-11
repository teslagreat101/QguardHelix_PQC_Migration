'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { AdminRoute } from '@/components/admin-route'

/* ────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────── */

interface AdminUser {
  id: string
  email: string
  name: string | null
  tier: 'free' | 'premium'
  q_score: number
  badges: string[]
  keys_generated_today: number
  max_keys_per_day: number
  vault_storage_used: number
  max_vault_storage: number
  paypal_payer_id: string | null
  paypal_subscription_id: string | null
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  auth_provider: string
}

interface AdminStats {
  users: {
    total: number
    premium: number
    free: number
    newToday: number
    newThisWeek: number
    newThisMonth: number
    avgQScore: number
    recentSignups: Array<{ id: string; email: string; tier: string; created_at: string }>
  }
  platform: {
    totalScans: number
    completedScans: number
    totalFindings: number
    criticalFindings: number
    totalVaultFiles: number
    totalVaultKeys: number
    totalKeysGenerated: number
    totalMigrations: number
    completedMigrations: number
    totalWebScans: number
    totalAlerts: number
    unreadAlerts: number
  }
  storage: {
    totalUsed: number
    totalCapacity: number
    utilizationPercent: number
  }
  timestamp: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface SSEData {
  totalUsers: number
  premiumUsers: number
  recentScans: Array<{ id: string; user_id: string; status: string; created_at: string }>
  recentAlerts: Array<{ id: string; user_id: string; type: string; title: string; severity: string; created_at: string }>
  recentSignups: Array<{ id: string; email: string; tier: string; created_at: string }>
  timestamp: string
}

type AdminTab = 'overview' | 'users' | 'activity'

const TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'users', label: 'User Management', icon: '👥' },
  { key: 'activity', label: 'Live Activity', icon: '📡' },
]

/* ────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// Re-usable inline style fragments (matches settings page tokens)
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: 'var(--qg-text-muted)', marginBottom: 6,
  fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
}
const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
}
const rowStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
}
const monoValStyle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)',
}
const msgBoxStyle = (type: 'success' | 'error'): React.CSSProperties => ({
  padding: '10px 16px', borderRadius: 'var(--radius-md)', marginBottom: 16, fontSize: 13,
  background: type === 'success' ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 45, 85, 0.08)',
  border: `1px solid ${type === 'success' ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 45, 85, 0.3)'}`,
  color: type === 'success' ? 'var(--qg-green)' : 'var(--qg-red)',
})

/* ────────────────────────────────────────────────────────────────────
   Main Admin Dashboard
   ──────────────────────────────────────────────────────────────────── */

function AdminDashboardContent() {
  const { session } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [sseConnected, setSseConnected] = useState(false)
  const [liveData, setLiveData] = useState<SSEData | null>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
    return headers
  }, [session?.access_token])

  /* ── Data Fetching ─────────────────────────────────────────────── */

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/stats', { headers: authHeaders })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.status === 'success') { setStats(json.data); setError(null) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
    } finally { setLoading(false) }
  }, [authHeaders])

  const fetchUsers = useCallback(async (page = 1) => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', sort: sortBy, order: sortOrder })
      if (searchQuery) params.set('search', searchQuery)
      if (tierFilter) params.set('tier', tierFilter)
      const res = await fetch(`/api/v1/admin/users?${params}`, { headers: authHeaders })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.status === 'success') { setUsers(json.data.users); setPagination(json.data.pagination) }
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to fetch users') }
    finally { setUsersLoading(false) }
  }, [authHeaders, searchQuery, tierFilter, sortBy, sortOrder])

  /* ── SSE ───────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!session?.access_token) return
    const connectSSE = () => {
      const token = encodeURIComponent(session.access_token)
      const es = new EventSource(`/api/v1/admin/stream?token=${token}`)
      eventSourceRef.current = es
      es.addEventListener('connected', () => setSseConnected(true))
      es.addEventListener('stats-update', (e) => {
        try { setLiveData(JSON.parse(e.data) as SSEData) } catch { /* ignore */ }
      })
      es.addEventListener('heartbeat', () => setSseConnected(true))
      es.onerror = () => { setSseConnected(false); es.close(); setTimeout(connectSSE, 5000) }
    }
    connectSSE()
    return () => { eventSourceRef.current?.close(); eventSourceRef.current = null; setSseConnected(false) }
  }, [session?.access_token])

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  useEffect(() => { fetchStats(); const id = setInterval(fetchStats, 30000); return () => clearInterval(id) }, [fetchStats])
  useEffect(() => { if (activeTab === 'users') fetchUsers(1) }, [activeTab, tierFilter, sortBy, sortOrder]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeTab !== 'users') return
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => fetchUsers(1), 400)
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current) }
  }, [searchQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Actions ───────────────────────────────────────────────────── */

  const showMsg = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text })
    if (type === 'success') setTimeout(() => setActionMsg(null), 3000)
  }

  const handleSubscriptionAction = async (userId: string, action: 'upgrade' | 'downgrade' | 'cancel') => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}/subscription`, { method: 'POST', headers: authHeaders, body: JSON.stringify({ action }) })
      const json = await res.json()
      if (json.status !== 'success') throw new Error(json.message)
      showMsg('success', `User ${action}d successfully`)
      await Promise.all([fetchStats(), fetchUsers(pagination.page)])
    } catch (err) { showMsg('error', err instanceof Error ? err.message : 'Action failed') }
    finally { setActionLoading(null) }
  }

  const handleUpdateUser = async (userId: string, updates: Record<string, unknown>) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, { method: 'PUT', headers: authHeaders, body: JSON.stringify(updates) })
      const json = await res.json()
      if (json.status !== 'success') throw new Error(json.message)
      showMsg('success', 'User updated successfully')
      await fetchUsers(pagination.page)
      setSelectedUser(null)
    } catch (err) { showMsg('error', err instanceof Error ? err.message : 'Update failed') }
    finally { setActionLoading(null) }
  }

  const handleDeleteUser = async (userId: string) => {
    setActionLoading(userId)
    try {
      const res = await fetch(`/api/v1/admin/users/${userId}`, { method: 'DELETE', headers: authHeaders })
      const json = await res.json()
      if (json.status !== 'success') throw new Error(json.message)
      showMsg('success', 'User deleted successfully')
      setShowDeleteConfirm(null)
      await Promise.all([fetchStats(), fetchUsers(pagination.page)])
    } catch (err) { showMsg('error', err instanceof Error ? err.message : 'Delete failed') }
    finally { setActionLoading(null) }
  }

  const handleCreateUser = async (email: string, password: string, name: string, tier: string) => {
    setActionLoading('create')
    try {
      const res = await fetch('/api/v1/admin/users', { method: 'POST', headers: authHeaders, body: JSON.stringify({ email, password, name, tier }) })
      const json = await res.json()
      if (json.status !== 'success') throw new Error(json.message)
      showMsg('success', 'User created successfully')
      setShowCreateModal(false)
      await Promise.all([fetchStats(), fetchUsers(1)])
    } catch (err) { showMsg('error', err instanceof Error ? err.message : 'Create failed') }
    finally { setActionLoading(null) }
  }

  /* ── Render ────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div>
        <h1 className="page-title animate-fade-in-up">Administrator Dashboard</h1>
        <div className="q-card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 16, animation: 'pulse-glow 2s infinite' }}>🛡️</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-text-muted)' }}>
            Loading admin data...
          </div>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div>
        <h1 className="page-title animate-fade-in-up">Administrator Dashboard</h1>
        <div className="q-card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={msgBoxStyle('error')}>Failed to load admin dashboard: {error}</div>
          <button type="button" className="q-btn q-btn-primary" onClick={fetchStats} style={{ padding: '10px 28px' }}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header — matches settings page layout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 className="page-title animate-fade-in-up">Administrator Dashboard</h1>
          <p className="page-subtitle animate-fade-in-up delay-100">
            Platform management &middot; User administration &middot; Real-time telemetry
          </p>
        </div>
        <div className="animate-fade-in-up delay-100" style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)',
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
            background: sseConnected ? 'var(--qg-green)' : 'var(--qg-red)',
            boxShadow: sseConnected ? '0 0 6px var(--qg-green)' : 'none',
          }} />
          {sseConnected ? 'Live' : 'Polling'} &middot; Updated {stats?.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : '--'}
        </div>
      </div>

      {/* Tabs — matches settings page tab style */}
      <div className="animate-fade-in-up delay-200" style={{
        display: 'flex', gap: 4, marginBottom: 24,
        borderBottom: '1px solid var(--qg-border)', paddingBottom: 0,
      }}>
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`q-btn ${activeTab === tab.key ? 'q-btn-primary' : 'q-btn-ghost'}`}
            style={{
              padding: '10px 20px', fontSize: 13,
              borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              borderBottom: activeTab === tab.key ? '2px solid var(--qg-cyan)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action Message */}
      {actionMsg && <div style={msgBoxStyle(actionMsg.type)}>{actionMsg.type === 'success' ? '✓' : '✗'} {actionMsg.text}</div>}

      {/* Tab Content */}
      <div className="animate-fade-in-up delay-300">
        {activeTab === 'overview' && stats && <OverviewTab stats={stats} liveData={liveData} />}
        {activeTab === 'users' && (
          <UsersTab
            users={users} pagination={pagination} loading={usersLoading}
            searchQuery={searchQuery} tierFilter={tierFilter} sortBy={sortBy} sortOrder={sortOrder}
            actionLoading={actionLoading} selectedUser={selectedUser}
            showCreateModal={showCreateModal} showDeleteConfirm={showDeleteConfirm}
            onSearchChange={setSearchQuery} onTierFilterChange={setTierFilter}
            onSortChange={(col) => { sortBy === col ? setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') : (setSortBy(col), setSortOrder('desc')) }}
            onPageChange={(p) => fetchUsers(p)} onSelectUser={setSelectedUser}
            onSubscriptionAction={handleSubscriptionAction} onUpdateUser={handleUpdateUser}
            onDeleteUser={handleDeleteUser} onCreateUser={handleCreateUser}
            onShowCreate={setShowCreateModal} onShowDelete={setShowDeleteConfirm}
          />
        )}
        {activeTab === 'activity' && <ActivityTab liveData={liveData} sseConnected={sseConnected} />}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   OVERVIEW TAB
   ════════════════════════════════════════════════════════════════════ */

function OverviewTab({ stats, liveData }: { stats: AdminStats; liveData: SSEData | null }) {
  const totalUsers = liveData?.totalUsers ?? stats.users.total
  const premiumUsers = liveData?.premiumUsers ?? stats.users.premium

  return (
    <>
      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Users', value: totalUsers, sub: `+${stats.users.newToday} today`, color: 'var(--qg-cyan)', icon: '👥' },
          { label: 'Premium Subscribers', value: premiumUsers, sub: `${totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0}% conversion`, color: 'var(--qg-violet)', icon: '⭐' },
          { label: 'Total Scans', value: stats.platform.totalScans, sub: `${stats.platform.completedScans} completed`, color: 'var(--qg-green)', icon: '🔍' },
          { label: 'Critical Findings', value: stats.platform.criticalFindings, sub: `${stats.platform.totalFindings} total`, color: 'var(--qg-red)', icon: '⚠️' },
        ].map((kpi) => (
          <div key={kpi.label} className="q-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>{kpi.icon}</span>
              <span style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {kpi.label}
              </span>
            </div>
            <div style={{ fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 700, color: kpi.color, lineHeight: 1.2 }}>
              {kpi.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 6 }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Detail Cards — 2-column layout like settings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left: Platform Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="q-card" style={{ padding: 24 }}>
            <h3 style={sectionTitleStyle}><span style={{ fontSize: 18 }}>🔐</span> Quantum Vault</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Encrypted Files', val: stats.platform.totalVaultFiles.toLocaleString() },
                { label: 'Vault Keys', val: stats.platform.totalVaultKeys.toLocaleString() },
                { label: 'Storage Used', val: formatBytes(stats.storage.totalUsed) },
              ].map((r) => (
                <div key={r.label} style={rowStyle}>
                  <span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>{r.label}</span>
                  <span style={{ ...monoValStyle, color: 'var(--qg-cyan)' }}>{r.val}</span>
                </div>
              ))}
              <div style={rowStyle}>
                <span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Storage Utilization</span>
                <span style={{ ...monoValStyle, color: 'var(--qg-cyan)' }}>{stats.storage.utilizationPercent}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${stats.storage.utilizationPercent}%`, background: 'linear-gradient(90deg, var(--qg-cyan), var(--qg-violet))', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>

          <div className="q-card" style={{ padding: 24 }}>
            <h3 style={sectionTitleStyle}><span style={{ fontSize: 18 }}>⚡</span> Security Operations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Keys Generated', val: stats.platform.totalKeysGenerated.toLocaleString(), color: 'var(--qg-cyan)' },
                { label: 'PQC Migrations', val: `${stats.platform.completedMigrations}/${stats.platform.totalMigrations}`, color: 'var(--qg-green)' },
                { label: 'Web Scans', val: stats.platform.totalWebScans.toLocaleString(), color: 'var(--qg-cyan)' },
                { label: 'Avg Q-Score', val: `${stats.users.avgQScore}/100`, color: stats.users.avgQScore >= 70 ? 'var(--qg-green)' : stats.users.avgQScore >= 40 ? 'var(--qg-amber)' : 'var(--qg-red)' },
                { label: 'Active Alerts', val: `${stats.platform.unreadAlerts} unread / ${stats.platform.totalAlerts} total`, color: stats.platform.unreadAlerts > 0 ? 'var(--qg-amber)' : 'var(--qg-green)' },
              ].map((r) => (
                <div key={r.label} style={rowStyle}>
                  <span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>{r.label}</span>
                  <span style={{ ...monoValStyle, color: r.color }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Recent Signups + User Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="q-card" style={{
            padding: 24, textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.06), rgba(255, 243, 193, 0.06))',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: 'linear-gradient(135deg, var(--qg-cyan), var(--qg-violet))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)',
            }}>🛡️</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Admin Console</div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', marginBottom: 12 }}>
              Platform-wide metrics & controls
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px',
              borderRadius: 20, background: 'rgba(255, 45, 85, 0.1)',
              border: '1px solid rgba(255, 45, 85, 0.3)', fontSize: 11,
              fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--qg-red)',
            }}>
              🔴 Superadmin
            </div>
          </div>

          <div className="q-card" style={{ padding: 20 }}>
            <h4 style={{ fontSize: 13, color: 'var(--qg-text-muted)', marginBottom: 14, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              User Breakdown
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={rowStyle}>
                <span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Free Users</span>
                <span style={{ ...monoValStyle, color: 'var(--qg-text-primary)' }}>{stats.users.free}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Premium Users</span>
                <span style={{ ...monoValStyle, color: 'var(--qg-violet)' }}>{premiumUsers}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>New This Week</span>
                <span style={{ ...monoValStyle, color: 'var(--qg-green)' }}>+{stats.users.newThisWeek}</span>
              </div>
              <div style={rowStyle}>
                <span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>New This Month</span>
                <span style={{ ...monoValStyle, color: 'var(--qg-cyan)' }}>+{stats.users.newThisMonth}</span>
              </div>
            </div>
          </div>

          <div className="q-card" style={{ padding: 20 }}>
            <h4 style={{ fontSize: 13, color: 'var(--qg-text-muted)', marginBottom: 14, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Signups
            </h4>
            {stats.users.recentSignups.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', textAlign: 'center', padding: 16 }}>No recent signups</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.users.recentSignups.slice(0, 5).map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--qg-cyan-dim), var(--qg-violet-dim))',
                      border: '1px solid var(--qg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--qg-cyan)',
                    }}>{u.email[0].toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--qg-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                      <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>{timeAgo(u.created_at)}</div>
                    </div>
                    <TierBadge tier={u.tier} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════
   USERS TAB
   ════════════════════════════════════════════════════════════════════ */

interface UsersTabProps {
  users: AdminUser[]; pagination: Pagination; loading: boolean
  searchQuery: string; tierFilter: string; sortBy: string; sortOrder: 'asc' | 'desc'
  actionLoading: string | null; selectedUser: AdminUser | null
  showCreateModal: boolean; showDeleteConfirm: string | null
  onSearchChange: (v: string) => void; onTierFilterChange: (v: string) => void
  onSortChange: (col: string) => void; onPageChange: (p: number) => void
  onSelectUser: (u: AdminUser | null) => void
  onSubscriptionAction: (userId: string, action: 'upgrade' | 'downgrade' | 'cancel') => void
  onUpdateUser: (userId: string, updates: Record<string, unknown>) => void
  onDeleteUser: (userId: string) => void
  onCreateUser: (email: string, password: string, name: string, tier: string) => void
  onShowCreate: (show: boolean) => void; onShowDelete: (userId: string | null) => void
}

function UsersTab(p: UsersTabProps) {
  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input
            type="text" className="q-input" placeholder="Search by email or name..."
            value={p.searchQuery} onChange={(e) => p.onSearchChange(e.target.value)}
            style={{ maxWidth: 320, padding: '8px 16px', fontSize: 13 }}
          />
          <select className="q-input" value={p.tierFilter} onChange={(e) => p.onTierFilterChange(e.target.value)}
            title="Filter by tier" aria-label="Filter by tier"
            style={{ padding: '8px 12px', fontSize: 13, minWidth: 120 }}>
            <option value="">All Tiers</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>{p.pagination.total} users</span>
          <button type="button" className="q-btn q-btn-primary" onClick={() => p.onShowCreate(true)} style={{ padding: '8px 20px', fontSize: 13 }}>
            + Add User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="q-card" style={{ overflow: 'hidden' }}>
        {p.loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 24, animation: 'pulse-glow 2s infinite' }}>⚛️</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {[
                    { key: 'email', label: 'Email', sortable: true },
                    { key: 'name', label: 'Name', sortable: false },
                    { key: 'tier', label: 'Tier', sortable: true },
                    { key: 'q_score', label: 'Q-Score', sortable: true },
                    { key: 'provider', label: 'Provider', sortable: false },
                    { key: 'last_sign_in', label: 'Last Sign In', sortable: false },
                    { key: 'created_at', label: 'Joined', sortable: true },
                    { key: 'actions', label: 'Actions', sortable: false },
                  ].map((col) => (
                    <th key={col.key}
                      onClick={col.sortable ? () => p.onSortChange(col.key) : undefined}
                      style={{
                        padding: '12px 16px', textAlign: 'left',
                        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                        color: p.sortBy === col.key ? 'var(--qg-cyan)' : 'var(--qg-text-muted)',
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        background: 'var(--qg-surface-alt)', borderBottom: '1px solid var(--qg-border)',
                        whiteSpace: 'nowrap', cursor: col.sortable ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}>
                      {col.label}
                      {col.sortable && p.sortBy === col.key && (
                        <span style={{ marginLeft: 4, color: 'var(--qg-cyan)' }}>{p.sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {p.users.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--qg-text-muted)' }}>No users found</td></tr>
                ) : p.users.map((user) => (
                  <tr key={user.id} style={{
                    borderBottom: '1px solid var(--qg-border)',
                    background: p.selectedUser?.id === user.id ? 'rgba(212, 175, 55, 0.06)' : undefined,
                    transition: 'background 0.15s ease',
                  }}
                    onMouseEnter={(e) => { if (p.selectedUser?.id !== user.id) e.currentTarget.style.background = 'rgba(212, 175, 55, 0.03)' }}
                    onMouseLeave={(e) => { if (p.selectedUser?.id !== user.id) e.currentTarget.style.background = '' }}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--qg-cyan-dim), var(--qg-violet-dim))',
                          border: '1px solid var(--qg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--qg-cyan)',
                        }}>{user.email[0].toUpperCase()}</div>
                        <span style={{ color: 'var(--qg-text-primary)', fontWeight: 500 }}>{user.email}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--qg-text-secondary)' }}>{user.name || '—'}</td>
                    <td style={{ padding: '10px 16px' }}><TierBadge tier={user.tier} /></td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: user.q_score >= 70 ? 'var(--qg-green)' : user.q_score >= 40 ? 'var(--qg-amber)' : 'var(--qg-red)',
                      }}>{user.q_score}</span>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--qg-surface-alt)', color: 'var(--qg-text-muted)', border: '1px solid var(--qg-border)' }}>
                        {user.auth_provider}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)' }}>
                      {user.last_sign_in_at ? timeAgo(user.last_sign_in_at) : 'Never'}
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)' }}>
                      {timeAgo(user.created_at)}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="q-btn q-btn-ghost" style={{ padding: '4px 8px', fontSize: 14 }}
                          onClick={() => p.onSelectUser(p.selectedUser?.id === user.id ? null : user)} title="Edit">✏️</button>
                        {user.tier === 'free' ? (
                          <button type="button" className="q-btn q-btn-ghost" style={{ padding: '4px 8px', fontSize: 14, color: 'var(--qg-green)' }}
                            onClick={() => p.onSubscriptionAction(user.id, 'upgrade')} disabled={p.actionLoading === user.id} title="Upgrade">
                            {p.actionLoading === user.id ? '...' : '⬆'}
                          </button>
                        ) : (
                          <button type="button" className="q-btn q-btn-ghost" style={{ padding: '4px 8px', fontSize: 14, color: 'var(--qg-amber)' }}
                            onClick={() => p.onSubscriptionAction(user.id, 'downgrade')} disabled={p.actionLoading === user.id} title="Downgrade">
                            {p.actionLoading === user.id ? '...' : '⬇'}
                          </button>
                        )}
                        <button type="button" className="q-btn q-btn-ghost" style={{ padding: '4px 8px', fontSize: 14 }}
                          onClick={() => p.onShowDelete(user.id)} disabled={p.actionLoading === user.id} title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {p.pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 16, borderTop: '1px solid var(--qg-border)' }}>
            <button type="button" className="q-btn q-btn-ghost" disabled={p.pagination.page <= 1} onClick={() => p.onPageChange(p.pagination.page - 1)}>
              &laquo; Prev
            </button>
            <span style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Page {p.pagination.page} of {p.pagination.totalPages}
            </span>
            <button type="button" className="q-btn q-btn-ghost" disabled={p.pagination.page >= p.pagination.totalPages} onClick={() => p.onPageChange(p.pagination.page + 1)}>
              Next &raquo;
            </button>
          </div>
        )}
      </div>

      {/* Edit Drawer */}
      {p.selectedUser && (
        <EditUserDrawer user={p.selectedUser} actionLoading={p.actionLoading}
          onClose={() => p.onSelectUser(null)}
          onSave={(updates) => p.onUpdateUser(p.selectedUser!.id, updates)}
          onSubscriptionAction={(action) => p.onSubscriptionAction(p.selectedUser!.id, action)} />
      )}
      {p.showCreateModal && <CreateUserModal actionLoading={p.actionLoading} onClose={() => p.onShowCreate(false)} onCreate={p.onCreateUser} />}
      {p.showDeleteConfirm && (
        <DeleteConfirmModal userId={p.showDeleteConfirm} userEmail={p.users.find((u) => u.id === p.showDeleteConfirm)?.email || ''}
          actionLoading={p.actionLoading} onClose={() => p.onShowDelete(null)} onConfirm={() => p.onDeleteUser(p.showDeleteConfirm!)} />
      )}
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════
   EDIT USER DRAWER
   ════════════════════════════════════════════════════════════════════ */

function EditUserDrawer({ user, actionLoading, onClose, onSave, onSubscriptionAction }: {
  user: AdminUser; actionLoading: string | null; onClose: () => void
  onSave: (updates: Record<string, unknown>) => void
  onSubscriptionAction: (action: 'upgrade' | 'downgrade' | 'cancel') => void
}) {
  const [name, setName] = useState(user.name || '')
  const [maxKeys, setMaxKeys] = useState(user.max_keys_per_day)
  const [maxStorage, setMaxStorage] = useState(Math.round(user.max_vault_storage / (1024 * 1024 * 1024)))

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(3, 3, 8, 0.7)',
      backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 440, maxWidth: '90vw', height: '100vh', background: 'var(--qg-deep)',
        borderLeft: '1px solid var(--qg-border)', display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--qg-border)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Edit User</h3>
          <button type="button" className="q-btn q-btn-ghost" onClick={onClose} style={{ fontSize: 18, padding: '4px 8px' }}>&times;</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Email</label>
            <div style={{ fontSize: 13, color: 'var(--qg-text-primary)' }}>{user.email}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>User ID</label>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', wordBreak: 'break-all' }}>{user.id}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Current Tier</label>
            <TierBadge tier={user.tier} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="edit-name">Display Name</label>
            <input id="edit-name" type="text" className="q-input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Enter name..." style={{ width: '100%', padding: '10px 16px', fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="edit-keys">Max Keys / Day</label>
            <input id="edit-keys" type="number" className="q-input" value={maxKeys} onChange={(e) => setMaxKeys(parseInt(e.target.value) || 0)}
              min={0} style={{ width: '100%', padding: '10px 16px', fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="edit-storage">Max Storage (GB)</label>
            <input id="edit-storage" type="number" className="q-input" value={maxStorage} onChange={(e) => setMaxStorage(parseInt(e.target.value) || 0)}
              min={0} style={{ width: '100%', padding: '10px 16px', fontSize: 14 }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Usage</label>
            <div className="q-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={rowStyle}><span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Storage</span><span style={monoValStyle}>{formatBytes(user.vault_storage_used)} / {formatBytes(user.max_vault_storage)}</span></div>
                <div style={rowStyle}><span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Keys Today</span><span style={monoValStyle}>{user.keys_generated_today} / {user.max_keys_per_day}</span></div>
                <div style={rowStyle}><span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Q-Score</span><span style={{ ...monoValStyle, color: user.q_score >= 70 ? 'var(--qg-green)' : user.q_score >= 40 ? 'var(--qg-amber)' : 'var(--qg-red)' }}>{user.q_score}/100</span></div>
                <div style={rowStyle}><span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Provider</span><span style={monoValStyle}>{user.auth_provider}</span></div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Subscription Actions</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {user.tier === 'free' ? (
                <button type="button" className="q-btn q-btn-primary" onClick={() => onSubscriptionAction('upgrade')} disabled={actionLoading === user.id}
                  style={{ padding: '8px 20px', fontSize: 13 }}>Upgrade to Premium</button>
              ) : (
                <button type="button" className="q-btn q-btn-secondary" onClick={() => onSubscriptionAction('downgrade')} disabled={actionLoading === user.id}
                  style={{ padding: '8px 20px', fontSize: 13 }}>Downgrade to Free</button>
              )}
              {user.paypal_subscription_id && (
                <button type="button" className="q-btn q-btn-ghost" onClick={() => onSubscriptionAction('cancel')} disabled={actionLoading === user.id}
                  style={{ padding: '8px 20px', fontSize: 13, color: 'var(--qg-red)' }}>Cancel PayPal Sub</button>
              )}
            </div>
          </div>

          {user.paypal_payer_id && (
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>PayPal</label>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', wordBreak: 'break-all', padding: '10px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--qg-border)' }}>
                Payer: {user.paypal_payer_id}
                {user.paypal_subscription_id && (<><br />Subscription: {user.paypal_subscription_id}</>)}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--qg-border)' }}>
          <button type="button" className="q-btn q-btn-ghost" onClick={onClose} style={{ padding: '10px 20px', fontSize: 13 }}>Cancel</button>
          <button type="button" className="q-btn q-btn-primary" disabled={actionLoading === user.id}
            onClick={() => onSave({ name: name || null, max_keys_per_day: maxKeys, max_vault_storage: maxStorage * 1024 * 1024 * 1024 })}
            style={{ padding: '10px 28px', fontSize: 13 }}>
            {actionLoading === user.id ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   CREATE USER MODAL
   ════════════════════════════════════════════════════════════════════ */

function CreateUserModal({ actionLoading, onClose, onCreate }: {
  actionLoading: string | null; onClose: () => void
  onCreate: (email: string, password: string, name: string, tier: string) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [tier, setTier] = useState('free')

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(3, 3, 8, 0.7)',
      backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, maxWidth: '90vw', background: 'var(--qg-deep)',
        border: '1px solid var(--qg-border)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--qg-border)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>Create New User</h3>
          <button type="button" className="q-btn q-btn-ghost" onClick={onClose} style={{ fontSize: 18, padding: '4px 8px' }}>&times;</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="c-email">Email *</label>
            <input id="c-email" type="email" className="q-input" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com" style={{ width: '100%', padding: '10px 16px', fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="c-pwd">Password *</label>
            <input id="c-pwd" type="password" className="q-input" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters" style={{ width: '100%', padding: '10px 16px', fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="c-name">Display Name</label>
            <input id="c-name" type="text" className="q-input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Optional" style={{ width: '100%', padding: '10px 16px', fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="c-tier">Tier</label>
            <select id="c-tier" className="q-input" value={tier} onChange={(e) => setTier(e.target.value)}
              style={{ width: '100%', padding: '10px 16px', fontSize: 14 }}>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--qg-border)' }}>
          <button type="button" className="q-btn q-btn-ghost" onClick={onClose} style={{ padding: '10px 20px', fontSize: 13 }}>Cancel</button>
          <button type="button" className="q-btn q-btn-primary" disabled={!email || !password || actionLoading === 'create'}
            onClick={() => onCreate(email, password, name, tier)} style={{ padding: '10px 28px', fontSize: 13 }}>
            {actionLoading === 'create' ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   DELETE CONFIRMATION MODAL
   ════════════════════════════════════════════════════════════════════ */

function DeleteConfirmModal({ userId, userEmail, actionLoading, onClose, onConfirm }: {
  userId: string; userEmail: string; actionLoading: string | null; onClose: () => void; onConfirm: () => void
}) {
  const [confirmText, setConfirmText] = useState('')

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(3, 3, 8, 0.7)',
      backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 480, maxWidth: '90vw', background: 'var(--qg-deep)',
        border: '1px solid var(--qg-red)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 8px 32px rgba(255, 45, 85, 0.15)', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(255, 45, 85, 0.3)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--qg-red)' }}>⚠ Delete User</h3>
          <button type="button" className="q-btn q-btn-ghost" onClick={onClose} style={{ fontSize: 18, padding: '4px 8px' }}>&times;</button>
        </div>
        <div style={{ padding: 24 }}>
          <p style={{ color: 'var(--qg-text-secondary)', marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
            This will permanently delete <strong style={{ color: 'var(--qg-text-primary)' }}>{userEmail}</strong> and all their data including scans, vault files, keys, and migrations. This action cannot be undone.
          </p>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="d-confirm">
              Type <strong style={{ color: 'var(--qg-red)' }}>DELETE</strong> to confirm
            </label>
            <input id="d-confirm" type="text" className="q-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE" style={{ width: '100%', padding: '10px 16px', fontSize: 14 }} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: '1px solid var(--qg-border)' }}>
          <button type="button" className="q-btn q-btn-ghost" onClick={onClose} style={{ padding: '10px 20px', fontSize: 13 }}>Cancel</button>
          <button type="button" className="q-btn" disabled={confirmText !== 'DELETE' || actionLoading === userId} onClick={onConfirm}
            style={{ padding: '10px 28px', fontSize: 13, background: 'var(--qg-red)', color: '#fff', border: '1px solid var(--qg-red)' }}>
            {actionLoading === userId ? 'Deleting...' : 'Delete User Permanently'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════
   ACTIVITY TAB
   ════════════════════════════════════════════════════════════════════ */

function ActivityTab({ liveData, sseConnected }: { liveData: SSEData | null; sseConnected: boolean }) {
  return (
    <>
      <div className="q-card" style={{ padding: '12px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: sseConnected ? 'var(--qg-green)' : 'var(--qg-red)',
          boxShadow: sseConnected ? '0 0 8px var(--qg-green)' : 'none',
        }} />
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: sseConnected ? 'var(--qg-green)' : 'var(--qg-red)' }}>
          {sseConnected ? 'Connected — Receiving real-time updates' : 'Disconnected — Attempting reconnection...'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Live Counters */}
        <div className="q-card" style={{ padding: 24 }}>
          <h3 style={sectionTitleStyle}><span style={{ fontSize: 18 }}>📊</span> Live Counters</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={rowStyle}><span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Total Users</span><span style={{ ...monoValStyle, color: 'var(--qg-cyan)', textShadow: '0 0 8px var(--qg-cyan-dim)' }}>{liveData?.totalUsers ?? '--'}</span></div>
            <div style={rowStyle}><span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Premium Users</span><span style={{ ...monoValStyle, color: 'var(--qg-violet)' }}>{liveData?.premiumUsers ?? '--'}</span></div>
            <div style={rowStyle}><span style={{ fontSize: 13, color: 'var(--qg-text-secondary)' }}>Last Update</span><span style={monoValStyle}>{liveData?.timestamp ? new Date(liveData.timestamp).toLocaleTimeString() : '--'}</span></div>
          </div>
        </div>

        {/* Recent Scans */}
        <div className="q-card" style={{ padding: 24 }}>
          <h3 style={sectionTitleStyle}><span style={{ fontSize: 18 }}>🔍</span> Recent Scans (5 min)</h3>
          {!liveData?.recentScans?.length ? (
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', textAlign: 'center', padding: 20 }}>No recent scans</div>
          ) : liveData.recentScans.map((scan) => (
            <div key={scan.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--qg-border)' }}>
              <StatusDot status={scan.status} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-primary)' }}>{scan.user_id.slice(0, 8)}...</div>
                <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>{scan.status} &middot; {timeAgo(scan.created_at)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Alerts */}
        <div className="q-card" style={{ padding: 24 }}>
          <h3 style={sectionTitleStyle}><span style={{ fontSize: 18 }}>⚠️</span> Recent Alerts (5 min)</h3>
          {!liveData?.recentAlerts?.length ? (
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', textAlign: 'center', padding: 20 }}>No recent alerts</div>
          ) : liveData.recentAlerts.map((alert) => (
            <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--qg-border)' }}>
              <SeverityDot severity={alert.severity} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--qg-text-primary)' }}>{alert.title}</div>
                <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>{alert.type} &middot; {alert.severity} &middot; {timeAgo(alert.created_at)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Signups */}
        <div className="q-card" style={{ padding: 24 }}>
          <h3 style={sectionTitleStyle}><span style={{ fontSize: 18 }}>👤</span> Recent Signups (5 min)</h3>
          {!liveData?.recentSignups?.length ? (
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', textAlign: 'center', padding: 20 }}>No recent signups</div>
          ) : liveData.recentSignups.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--qg-border)' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--qg-cyan-dim), var(--qg-violet-dim))',
                border: '1px solid var(--qg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--qg-cyan)',
              }}>{u.email[0].toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--qg-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>{timeAgo(u.created_at)}</div>
              </div>
              <TierBadge tier={u.tier} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* ════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ════════════════════════════════════════════════════════════════════ */

function TierBadge({ tier }: { tier: string }) {
  const isPremium = tier === 'premium'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 12,
      fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
      background: isPremium ? 'rgba(255, 243, 193, 0.15)' : 'var(--qg-surface-alt)',
      color: isPremium ? 'var(--qg-violet)' : 'var(--qg-text-secondary)',
      border: `1px solid ${isPremium ? 'rgba(255, 243, 193, 0.3)' : 'var(--qg-border)'}`,
    }}>
      {isPremium ? '⭐ Premium' : 'Free'}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { completed: 'var(--qg-green)', scanning: 'var(--qg-cyan)', running: 'var(--qg-cyan)', failed: 'var(--qg-red)' }
  return <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: colors[status] || 'var(--qg-text-muted)', boxShadow: colors[status] ? `0 0 6px ${colors[status]}` : 'none' }} />
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = { critical: 'var(--qg-red)', warning: 'var(--qg-amber)', info: 'var(--qg-cyan)' }
  return <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: colors[severity] || 'var(--qg-text-muted)', boxShadow: colors[severity] ? `0 0 6px ${colors[severity]}` : 'none' }} />
}

/* ════════════════════════════════════════════════════════════════════
   EXPORT WITH ADMIN GUARD
   ════════════════════════════════════════════════════════════════════ */

export default function AdminDashboard() {
  return (
    <AdminRoute>
      <AdminDashboardContent />
    </AdminRoute>
  )
}
