'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ProtectedRoute } from '@/components/protected-route'
import { useAuth } from '@/contexts/auth-context'
import { useProfile } from '@/hooks/use-profile'
import { ADMIN_EMAIL } from '@/lib/admin'
import { CyberBackground } from '@/components/home/CyberBackground'

const NAV_SECTIONS = [
  {
    label: 'Command Center',
    items: [
      { label: 'Overview', href: '/dashboard', icon: '📊' },
      { label: 'Quantum Risk', href: '/dashboard/quantum_risk_overview', icon: '🛡️' },
      { label: 'Migration Planner', href: '/dashboard/migration_planner', icon: '📅' },
      { label: 'Quantum QRNG', href: '/dashboard/qrng', icon: '🎲' },
    ],
  },
  {
    label: 'Cryptographic Services',
    items: [
      { label: 'Encryption Services', href: '/dashboard/keys', icon: '🔐' },
      { label: 'Security Authentication', href: '/dashboard/otp', icon: '🔢' },
      { label: 'Digital Certificates', href: '/dashboard/pki', icon: '📜' },
      { label: 'Tokenization', href: '/dashboard/tokenize', icon: '🎭' },
      { label: 'Secure Communications', href: '/dashboard/comm', icon: '📡' },
      { label: 'Cloud Security', href: '/dashboard/cloud', icon: '☁️' },
    ],
  },
  {
    label: 'Inventory & Analysis',
    items: [
      { label: 'Quantum Vault', href: '/dashboard/vault', icon: '📦' },
      { label: 'PQC Scanner', href: '/dashboard/scanner', icon: '🔍' },
      { label: 'CBOM Explorer', href: '/dashboard/cbom_explorer', icon: '📋' },
      { label: 'Crypto Exposure', href: '/dashboard/crypto_exposure_map', icon: '🗺️' },
      { label: 'Assets & CBOM', href: '/dashboard/assets_map', icon: '🏗️' },
    ],
  },
  {
    label: 'Migration Operations',
    items: [
      { label: 'Migration Timeline', href: '/dashboard/migration_timeline', icon: '⏱️' },
      { label: 'Live Migration Ops', href: '/dashboard/live_migration', icon: '⚡' },
      { label: 'Migration Terminal', href: '/dashboard/migration_terminal', icon: '💻' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Compliance Dashboard', href: '/dashboard/compliance_dashboard', icon: '⚖️' },
      { label: 'Drift Detection', href: '/dashboard/drift_detection', icon: '📉' },
      { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ],
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, signOut, session } = useAuth()
  const { profile } = useProfile()
  const tier = profile?.tier || 'free'

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }

  const handleUpgrade = async (plan: 'pro' | 'elite') => {
    try {
      const res = await fetch('/api/v1/paypal/checkout', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ plan, interval: 'monthly', returnUrl: window.location.origin + '/dashboard' }),
      })
      const data = await res.json()
      if (data.data?.url) window.location.href = data.data.url
      else alert(data.error?.message || 'PayPal not configured')
    } catch {
      alert('Payment service unavailable')
    }
  }

  const handleManage = async () => {
    if (!confirm('Cancel your current subscription? You will be downgraded to the Free tier.')) return
    try {
      const res = await fetch('/api/v1/paypal/cancel', {
        method: 'POST',
        headers: authHeaders,
      })
      const data = await res.json()
      if (data.data?.cancelled) {
        alert('Subscription cancelled successfully.')
        window.location.reload()
      } else {
        alert(data.error?.message || 'Unable to cancel subscription')
      }
    } catch {
      alert('Billing service unavailable')
    }
  }

  return (
    <ProtectedRoute>
      <div className="dashboard-container dashboard-gold qguard-home">
        <CyberBackground />
        {/* Sidebar */}
        <aside className="sidebar">

          {/* ── Logo ── */}
          <Link
            href="/"
            className="sidebar-logo"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
            title="Back to homepage"
          >
            <img
              src="/NEW_LOGO.png"
              alt="Qguard Helix logo"
              style={{
                width: 36,
                height: 36,
                objectFit: 'contain',
                borderRadius: 6,
                flexShrink: 0,
              }}
            />
            <h1>Helix</h1>
          </Link>

          {/* ── Navigation ── */}
          <nav className="sidebar-nav">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="sidebar-section-label">{section.label}</div>
                {section.items.map((item) => {
                  const children = 'children' in item && Array.isArray(item.children) ? item.children : []
                  const hasChildren = children.length > 0
                  const isActive = pathname === item.href ||
                    (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/')) ||
                    (item.href === '/dashboard/settings' && pathname?.startsWith('/dashboard/settings'))
                  const isGroupActive = item.href === '/dashboard/migrate'
                    ? pathname === '/dashboard/migrate' || pathname?.startsWith('/dashboard/migrate/')
                    : isActive

                  return (
                    <div key={item.href} className={hasChildren ? 'sidebar-nav-group' : undefined}>
                      <Link
                        href={item.href}
                        className={`sidebar-link ${isGroupActive ? 'active' : ''} ${hasChildren ? 'parent' : ''}`}
                      >
                        <span style={{ fontSize: 16 }}>{item.icon}</span>
                        {item.label}
                      </Link>

                      {hasChildren && (
                        <div className="sidebar-subnav">
                          {children.map((child) => {
                            const childActive = pathname === child.href || pathname?.startsWith(child.href + '/')

                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={`sidebar-link sidebar-sublink ${childActive ? 'active' : ''}`}
                              >
                                <span className="sidebar-sublink-icon">{child.icon}</span>
                                {child.label}
                              </Link>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Admin link — only visible to admin */}
            {user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
              <>
                <div className="sidebar-section-label">Admin</div>
                <Link
                  href="/dashboard/admin"
                  className={`sidebar-link ${pathname === '/dashboard/admin' ? 'active' : ''}`}
                  style={{
                    borderLeft: '2px solid var(--qg-red)',
                    background: pathname === '/dashboard/admin' ? 'rgba(255, 45, 85, 0.08)' : undefined,
                  }}
                >
                  <span style={{ fontSize: 16 }}>🛡️</span>
                  Admin Panel
                </Link>
              </>
            )}
          </nav>

          {/* ── Sidebar Footer — Tier CTA ── */}
          <div style={{ padding: '16px 12px', borderTop: '1px solid var(--qg-border)' }}>
            {tier === 'elite' ? (
              /* Elite — manage subscription */
              <div className="q-card" style={{
                padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(255,204,0,0.08), rgba(255,150,0,0.06))',
                border: '1px solid rgba(255,204,0,0.25)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>👑</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--qg-amber)', marginBottom: 4, letterSpacing: '0.1em' }}>
                  ELITE PLAN
                </div>
                <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginBottom: 12 }}>
                  100 GB Vault · Unlimited keys
                </div>
                <button
                  type="button" className="q-btn q-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', padding: '7px', fontSize: 11, borderColor: 'rgba(255,204,0,0.3)', color: 'var(--qg-amber)' }}
                  onClick={handleManage}
                >
                  Manage Subscription
                </button>
              </div>
            ) : tier === 'pro' ? (
              /* Pro — upgrade to Elite */
              <div className="q-card" style={{
                padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(255,247,207,0.04))',
                border: '1px solid rgba(212,175,55,0.26)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>⭐</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--qg-cyan)', marginBottom: 4, letterSpacing: '0.1em' }}>
                  PRO PLAN
                </div>
                <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginBottom: 12 }}>
                  50 GB Vault · 100 keys/day
                </div>
                <button
                  type="button" className="q-btn q-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', padding: '7px', fontSize: 11, marginBottom: 6 }}
                  onClick={handleManage}
                >
                  Manage Plan
                </button>
                <button
                  type="button" className="q-btn q-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '7px', fontSize: 11, background: 'linear-gradient(135deg, rgba(255,204,0,0.15), rgba(255,150,0,0.1))', borderColor: 'rgba(255,204,0,0.4)', color: 'var(--qg-amber)' }}
                  onClick={() => handleUpgrade('elite')}
                >
                  👑 Upgrade to Elite
                </button>
              </div>
            ) : (
              /* Free — upgrade to Pro or Elite */
              <div className="q-card" style={{
                padding: '14px 16px',
                background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(255,247,207,0.04))',
                border: '1px solid rgba(212,175,55,0.18)',
                textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--qg-cyan)', marginBottom: 4, letterSpacing: '0.12em' }}>
                  FREE TIER
                </div>
                <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', marginBottom: 10 }}>
                  5 keys/day · 5 GB vault
                </div>
                <button
                  type="button" className="q-btn q-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '7px', fontSize: 11, marginBottom: 6 }}
                  onClick={() => handleUpgrade('pro')}
                >
                  ⭐ Go Pro — $10/mo
                </button>
                <button
                  type="button" className="q-btn q-btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', padding: '7px', fontSize: 11, borderColor: 'rgba(255,204,0,0.35)', color: 'var(--qg-amber)' }}
                  onClick={() => handleUpgrade('elite')}
                >
                  👑 Go Elite — $50/mo
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Top Bar */}
          <div className="topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <input
                type="text"
                className="q-input"
                placeholder="Search vulnerabilities, keys, files..."
                style={{ width: 320, padding: '8px 16px', fontSize: 13 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-green)',
              }}>
                <span style={{ width: 6, height: 6, background: 'var(--qg-green)', borderRadius: '50%', boxShadow: '0 0 8px var(--qg-green)' }} />
                PQC Encrypted Session
              </div>

              {/* User Profile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Link
                  href="/dashboard/settings"
                  style={{
                    padding: '8px 16px',
                    background: pathname?.startsWith('/dashboard/settings') ? 'rgba(212, 175, 55, 0.18)' : 'rgba(212, 175, 55, 0.08)',
                    border: '1px solid rgba(212, 175, 55, 0.34)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '12px',
                    color: 'var(--qg-cyan)',
                    fontFamily: 'var(--font-mono)',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                  title="Account settings"
                >
                  <span style={{ fontSize: 14 }}>⚙️</span>
                  {user?.email?.split('@')[0]}
                </Link>
                <button
                  onClick={signOut}
                  type="button" className="q-btn q-btn-ghost"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                  title="Sign out"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
