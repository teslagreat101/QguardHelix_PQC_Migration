import Link from 'next/link'
import {
  Key, Lock, Shield, FileText, Mail, Cloud,
  Scan, Users, Code, Terminal, ArrowRight,
} from 'lucide-react'

const SERVICES = [
  { href: '/docs/api/otp', label: 'OTP / MFA', icon: Key, desc: 'Generate, validate, and manage quantum-random OTPs', endpoints: 8, color: 'var(--qg-cyan)' },
  { href: '/docs/api/keys', label: 'Key Management', icon: Key, desc: 'Generate PQC key pairs with ML-KEM and ML-DSA', endpoints: 6, color: 'var(--qg-violet)' },
  { href: '/docs/api/pki', label: 'PKI Certificates', icon: FileText, desc: 'Issue X.509 certificates with post-quantum algorithms', endpoints: 2, color: 'var(--qg-green)' },
  { href: '/docs/api/tokenize', label: 'Tokenization', icon: Lock, desc: 'Format-preserving tokenization for sensitive data', endpoints: 3, color: 'var(--qg-amber)' },
  { href: '/docs/api/comm', label: 'Secure Communications', icon: Mail, desc: 'Session, VPN, and email encryption key generation', endpoints: 4, color: 'var(--qg-cyan)' },
  { href: '/docs/api/cloud', label: 'Cloud Seeding', icon: Cloud, desc: 'QRNG seeds for containers, K8s, and cloud infra', endpoints: 3, color: 'var(--qg-violet)' },
  { href: '/docs/api/vault', label: 'Quantum Vault', icon: Lock, desc: 'Zero-knowledge encrypted storage with ML-KEM-1024', endpoints: 12, color: 'var(--qg-green)' },
  { href: '/docs/api/scanner', label: 'Scanner', icon: Scan, desc: 'Detect quantum-vulnerable cryptography', endpoints: 4, color: 'var(--qg-red)' },
  { href: '/docs/api/admin', label: 'Admin API', icon: Users, desc: 'User management, stats, and subscription control', endpoints: 5, color: 'var(--qg-amber)' },
]

export default function DevHubPage() {
  return (
    <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 40 }}>
      {/* Hero */}
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Developer Documentation</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, marginTop: 8, letterSpacing: '-0.02em', color: 'var(--qg-text-primary)' }}>
          QGuard API Reference
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginTop: 12, maxWidth: 640 }}>
          Integrate quantum-safe cryptography into your applications. Full REST API with Server-Sent Events streaming, interactive playground, and SDK examples in 5 languages.
        </p>
      </div>

      {/* Quick start cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <QuickCard icon={Terminal} title="Base URL" value="http://localhost:4000/api/v1" />
        <QuickCard icon={Shield} title="Authentication" value="Bearer JWT or x-qrng-api-key" />
        <QuickCard icon={Code} title="Content-Type" value="application/json" />
      </div>

      {/* SDK install */}
      <div style={{
        borderRadius: 10,
        border: '1px solid var(--qg-border)',
        padding: '20px',
        background: 'rgba(0,212,255,0.02)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 12 }}>
          Quick Install
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InstallCmd label="Node.js" cmd="npm install @qguard/sdk" />
          <InstallCmd label="Python" cmd="pip install qguard" />
        </div>
      </div>

      {/* Service grid */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 16 }}>
          API Services
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 }}>
          {SERVICES.map(s => (
            <Link key={s.href} href={s.href} style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              padding: '16px',
              borderRadius: 12,
              border: '1px solid var(--qg-border)',
              background: 'rgba(255,255,255,0.02)',
              textDecoration: 'none',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <s.icon size={14} style={{ color: s.color }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--qg-text-primary)' }}>
                    {s.label}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)' }}>
                  {s.endpoints} endpoints
                </span>
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--qg-text-secondary)', margin: 0 }}>
                {s.desc}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)' }}>
                View API <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuickCard({ icon: Icon, title, value }: { icon: React.ElementType<{ size?: number; style?: React.CSSProperties }>; title: string; value: string }) {
  return (
    <div style={{
      padding: '16px',
      borderRadius: 10,
      border: '1px solid var(--qg-border)',
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Icon size={12} style={{ color: 'var(--qg-cyan)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--qg-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

function InstallCmd({ label, cmd }: { label: string; cmd: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      borderRadius: 8,
      background: 'rgba(3,3,8,0.8)',
      border: '1px solid var(--qg-border)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)', minWidth: 50 }}>{label}</span>
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>{cmd}</code>
    </div>
  )
}
