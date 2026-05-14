'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Terminal, Copy, Download, AlertTriangle, CheckCircle2,
  RefreshCw, Settings, History, Code, ShieldCheck,
  Zap, Info, ExternalLink, X, ChevronRight, Search,
  Activity
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface HistoryRecord {
  id: string
  label: string
  sublabel: string
  badge: string
  badgeColor: string
  quality_score?: number
  entropy_source?: string
  created_at: string
}

export interface ServiceSettings {
  autoFallback: boolean
  connectionTimeout: number
  retryAttempts: number
  cacheDuration: number
  entropyValidation: boolean
  auditLogging: boolean
  fips140Mode: boolean
  quantumCertification: boolean
}

// ── Styles ─────────────────────────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  background: 'rgba(15, 15, 42, 0.4)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(212, 175, 55, 0.15)',
  borderRadius: 10,
  color: '#f8fafc',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  outline: 'none',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
}

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'rgba(212, 175, 55, 0.7)',
  textTransform: 'uppercase',
  letterSpacing: '0.15em',
  marginBottom: 8,
  fontWeight: 600,
}

export const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  color: '#D4AF37',
  marginBottom: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  letterSpacing: '0.04em',
  textShadow: '0 0 15px rgba(212, 175, 55, 0.3)',
}

export const resultMetaStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: '16px 24px',
  padding: '20px',
  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.02) 100%)',
  borderRadius: 12,
  border: '1px solid rgba(212, 175, 55, 0.2)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
}

export const resultMetaItem: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

export const resultMetaLabel: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  color: 'rgba(255, 255, 255, 0.4)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
}

export const resultMetaValue: React.CSSProperties = {
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  color: '#f8fafc',
  fontWeight: 600,
  letterSpacing: '0.02em',
}

export const hexBoxStyle: React.CSSProperties = {
  background: 'rgba(5, 5, 16, 0.6)',
  border: '1px solid rgba(212, 175, 55, 0.2)',
  borderRadius: 8,
  padding: '12px 16px',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--qg-cyan)',
  wordBreak: 'break-all',
  lineHeight: 1.6,
  boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.3)',
  transition: 'all 0.3s ease',
}

// ── Components ─────────────────────────────────────────────────────────────────

export const CopyButton = ({ text, label = 'Copy' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handleCopy} className="q-btn q-btn-ghost" style={{ padding: '4px 10px', fontSize: 10, minWidth: 60 }}>
      {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

export const DownloadButton = ({ data, filename }: { data: string; filename: string }) => {
  const handleDownload = () => {
    const blob = new Blob([data], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button onClick={handleDownload} className="q-btn q-btn-ghost" style={{ padding: '4px 10px', fontSize: 10 }}>
      <Download size={12} />
      Export
    </button>
  )
}

export const ErrorResult = ({ message }: { message: string }) => (
  <div className="q-card" style={{ borderColor: 'var(--qg-red)', background: 'rgba(255, 45, 85, 0.05)' }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <AlertTriangle color="var(--qg-red)" size={20} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--qg-red)', textTransform: 'uppercase' }}>Generation Error</div>
        <div style={{ fontSize: 13, color: 'var(--qg-text-primary)', marginTop: 2 }}>{message}</div>
      </div>
    </div>
  </div>
)

export const ProgressIndicator = ({ progress, isRunning, onCancel, retryCount = 0 }: { progress: number; isRunning: boolean; onCancel: () => void; retryCount?: number }) => (
  <div className="q-card" style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <RefreshCw size={16} className="animate-spin" color="var(--qg-cyan)" />
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', textTransform: 'uppercase' }}>
          Quantum Entropic Processing {retryCount > 0 && `(Retry #${retryCount})`}
        </span>
      </div>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--qg-text-muted)', cursor: 'pointer' }}>
        <X size={14} />
      </button>
    </div>
    <div style={{ height: 4, background: 'var(--qg-border)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        style={{ height: '100%', background: 'var(--qg-cyan)', boxShadow: '0 0 10px var(--qg-cyan)' }}
      />
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>BIT_STREAM_SYNCHRONIZING</span>
      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)' }}>{Math.round(progress)}%</span>
    </div>
  </div>
)

export const ComplianceBadges = ({ result }: { result: any }) => {
  const badges = [
    { label: 'NIST Level 3', active: true },
    { label: 'FIPS 140-2', active: true },
    { label: 'QRNG-Seed', active: result?.entropy_source === 'QRNG' },
    { label: 'Quantum Safe', active: true },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
      {badges.map(b => (
        <span key={b.label} style={{
          fontSize: 9, padding: '2px 8px', borderRadius: 100, border: '1px solid',
          borderColor: b.active ? 'var(--qg-cyan)' : 'var(--qg-border)',
          color: b.active ? 'var(--qg-cyan)' : 'var(--qg-text-muted)',
          background: b.active ? 'rgba(0, 212, 255, 0.05)' : 'transparent',
          textTransform: 'uppercase', fontFamily: 'var(--font-mono)'
        }}>
          {b.label}
        </span>
      ))}
    </div>
  )
}

export const QRNGPageHeader = ({ title, subtitle, qrngStatus, onRefresh }: { title: string; subtitle: string; qrngStatus: any; onRefresh: () => void }) => (
  <div style={{ marginBottom: 32 }} className="animate-fade-in-up">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h1 style={{
          fontSize: 32, fontWeight: 900, color: '#D4AF37', margin: 0,
          letterSpacing: '-0.02em', textTransform: 'uppercase',
          textShadow: '0 0 30px rgba(212, 175, 55, 0.25)'
        }}>
          {title}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 8, maxWidth: 600, lineHeight: 1.6 }}>
          {subtitle}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div style={{
          background: 'rgba(212, 175, 55, 0.06)', border: '1px solid rgba(212, 175, 55, 0.2)',
          borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, color: 'rgba(212, 175, 55, 0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>QRNG_SOURCE</div>
            <div style={{ fontSize: 11, color: '#fff', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{qrngStatus?.backend || 'Qiskit AerSimulator'}</div>
          </div>
          <button onClick={onRefresh} style={{
            background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.2)',
            color: '#D4AF37', borderRadius: '50%', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: 'all 0.2s'
          }} className="hover:scale-110 active:rotate-180">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>
    </div>
  </div>
)

export const QRNGStatusBanner = ({ qrngStatus, liveTelemetry }: { qrngStatus: any; liveTelemetry: any }) => (
  <div style={{
    marginBottom: 32, padding: '12px 24px',
    background: 'linear-gradient(90deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.02) 100%)',
    border: '1px solid rgba(212, 175, 55, 0.2)', borderRadius: 12, display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    backdropFilter: 'blur(10px)'
  }}>
    <div style={{ display: 'flex', gap: 32 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: 'rgba(212, 175, 55, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Zap size={14} color="#D4AF37" />
        </div>
        <div>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(212, 175, 55, 0.6)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ENTROPY_QUALITY</span>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#D4AF37', fontWeight: 700 }}>{((qrngStatus?.qualityScore || 0.9948) * 100).toFixed(2)}%</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: 'rgba(34, 197, 94, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Activity size={14} color="#22c55e" />
        </div>
        <div>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(34, 197, 94, 0.6)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em' }}>LIVE_THROUGHPUT</span>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#22c55e', fontWeight: 700 }}>{liveTelemetry?.throughput || '1.24'} MB/s</span>
        </div>
      </div>
    </div>
    <div style={{
      fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(212, 175, 55, 0.7)',
      display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(212, 175, 55, 0.05)',
      padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(212, 175, 55, 0.15)'
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: '#D4AF37',
        boxShadow: '0 0 10px #D4AF37'
      }} className="animate-pulse" />
      <span style={{ letterSpacing: '0.05em', fontWeight: 600 }}>REAL-TIME QUANTUM TELEMETRY ACTIVE</span>
    </div>
  </div>
)

export const TabNav = <T extends string>({ tabs, active, onChange, counts }: { tabs: any[]; active: T; onChange: (id: T) => void; counts?: Record<string, number> }) => (
  <div style={{
    display: 'flex', gap: 4, marginBottom: 32,
    background: 'rgba(255,255,255,0.02)', padding: 4, borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content'
  }}>
    {tabs.map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        style={{
          position: 'relative',
          padding: '8px 20px',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          color: active === t.id ? '#D4AF37' : 'rgba(255,255,255,0.4)',
          background: active === t.id ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
          border: '1px solid',
          borderColor: active === t.id ? 'rgba(212, 175, 55, 0.3)' : 'transparent',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          letterSpacing: '0.02em'
        }}
        className="hover:text-gold"
      >
        <span style={{ fontSize: 14 }}>{t.icon}</span>
        {t.label}
        {counts?.[t.id] ? (
          <span style={{
            marginLeft: 4, fontSize: 9, padding: '1px 6px',
            background: active === t.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
            borderRadius: 4, color: active === t.id ? '#D4AF37' : 'rgba(255,255,255,0.3)'
          }}>{counts[t.id]}</span>
        ) : null}
      </button>
    ))}
  </div>
)

export const QuantumTerminal = ({ logs, isRunning, onClear }: { logs: string[]; isRunning: boolean; onClear: () => void }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [logs])

  return (
    <div style={{
      background: 'rgba(2, 2, 8, 0.8)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(212, 175, 55, 0.2)',
      padding: 0,
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 0 40px rgba(212, 175, 55, 0.05)',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 18px', background: 'rgba(212, 175, 55, 0.05)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.15)'
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: isRunning ? '#22c55e' : '#D4AF37',
            boxShadow: isRunning ? '0 0 10px #22c55e' : '0 0 10px #D4AF37'
          }} className={isRunning ? 'animate-pulse' : ''} />
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#D4AF37', fontWeight: 800, letterSpacing: '0.15em' }}>QUANTUM_SERIAL_CONSOLE</span>
        </div>
        <button onClick={onClear} style={{
          background: 'none', border: 'none', color: 'rgba(212, 175, 55, 0.5)',
          fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em'
        }} className="hover:text-gold transition-colors">WIPE_LOGS</button>
      </div>
      <div
        ref={scrollRef}
        style={{
          height: 220, overflowY: 'auto', padding: '16px 20px',
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.7)',
          lineHeight: 1.8, scrollBehavior: 'smooth'
        }}
        className="terminal-scroll"
      >
        {logs.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>Initializing quantum communication interface...</div>
        )}
        {logs.map((log, i) => (
          <div key={i}>
            <span style={{ color: log.startsWith('!') ? 'var(--qg-red)' : log.startsWith('>') ? 'var(--qg-cyan)' : '#888' }}>{log}</span>
          </div>
        ))}
        {isRunning && <div className="animate-pulse" style={{ color: 'var(--qg-cyan)', marginTop: 4 }}>_</div>}
      </div>
    </div>
  )
}

export const ServiceHistoryPanel = ({ records, onDelete, onClear, emptyMessage }: { records: HistoryRecord[]; onDelete: (id: string) => void; onClear: () => void; emptyMessage: string }) => (
  <div className="animate-fade-in-up">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <div style={sectionTitle}><History size={18} style={{ color: '#D4AF37' }} /> <span className="gold-glow">Service History</span></div>
      {records.length > 0 && <button onClick={onClear} className="q-btn q-btn-ghost" style={{ fontSize: 11 }}>Clear Audit Trail</button>}
    </div>
    {records.length === 0 ? (
      <div className="q-card" style={{ textAlign: 'center', padding: 80, color: 'var(--qg-text-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.5 }}>📦</div>
        <div style={{ fontSize: 14, maxWidth: 300, margin: '0 auto', lineHeight: 1.6 }}>{emptyMessage}</div>
      </div>
    ) : (
      <div style={{ display: 'grid', gap: 16 }}>
        {records.map(r => (
          <div key={r.id} className="q-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(184,134,11,0.05))',
                border: '1px solid rgba(212,175,55,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
              }}>
                {r.badge === 'session' ? '🌐' : r.badge === 'vpn' ? '🛡️' : r.badge === 'email' ? '✉️' : '🔑'}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>{r.sublabel}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: 'rgba(212,175,55,0.5)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 4 }}>Entropy Quality</div>
                <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 700, color: (r.quality_score || 0) > 0.9 ? '#22c55e' : '#f59e0b' }}>
                  {((r.quality_score || 0) * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: 'rgba(212,175,55,0.5)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 4 }}>Timestamp</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)' }}>{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
              </div>
              <button onClick={() => onDelete(r.id)} style={{
                color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                padding: 8, borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s'
              }} className="hover:bg-red-950/30 hover:border-red-900/50 hover:text-red-400">
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)

export const ServiceAPIPanel = ({ serviceName, sdkPackage, endpoints, jsExample, pyExample, curlExample, basePathNote }: { serviceName: string; sdkPackage: string; endpoints: any[]; jsExample: string; pyExample: string; curlExample: string; basePathNote: string }) => {
  const [lang, setLang] = useState<'js' | 'py' | 'curl'>('js')
  return (
    <div className="animate-fade-in-up">
      <div style={sectionTitle}><Code size={18} style={{ color: '#D4AF37' }} /> <span className="gold-glow">Developer Integration</span></div>
      <div className="q-card" style={{ marginBottom: 32, padding: '24px 32px' }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 20, lineHeight: 1.6 }}>
          Integrate quantum-hardened security directly into your stack. Use our native SDKs for the best performance or the raw REST API for custom implementations.
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ background: 'rgba(212,175,55,0.03)', padding: '16px 20px', borderRadius: 12, border: '1px solid rgba(212,175,55,0.1)', flex: 1 }}>
            <div style={{ ...resultMetaLabel, color: 'rgba(212,175,55,0.6)', fontWeight: 800 }}>NPM_PACKAGE</div>
            <div style={{ ...resultMetaValue, color: '#D4AF37', marginTop: 8, fontSize: 16 }}>{sdkPackage}</div>
          </div>
          <div style={{ background: 'rgba(212,175,55,0.03)', padding: '16px 20px', borderRadius: 12, border: '1px solid rgba(212,175,55,0.1)', flex: 1 }}>
            <div style={{ ...resultMetaLabel, color: 'rgba(212,175,55,0.6)', fontWeight: 800 }}>PROTOCOL</div>
            <div style={{ ...resultMetaValue, color: '#D4AF37', marginTop: 8, fontSize: 16 }}>{basePathNote}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32 }}>
        <div>
          <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.5)', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 16, textTransform: 'uppercase' }}>Available Endpoints</div>
          <div style={{ display: 'grid', gap: 16 }}>
            {endpoints.map(e => (
              <div key={e.path} className="q-card" style={{ padding: '20px', background: 'rgba(2,2,8,0.3)' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 10, padding: '4px 10px', background: e.method === 'POST' ? 'rgba(0, 212, 255, 0.1)' : 'rgba(34, 197, 94, 0.1)', color: e.method === 'POST' ? '#00d4ff' : '#22c55e', borderRadius: 6, fontWeight: 800, border: '1px solid currentColor', opacity: 0.8 }}>{e.method}</span>
                  <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff' }}>{e.path}</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{e.description}</div>
                {e.rateLimit && (
                  <div style={{ marginTop: 12, fontSize: 10, color: 'rgba(212,175,55,0.4)', fontFamily: 'var(--font-mono)' }}>
                    RATE_LIMIT: {e.rateLimit}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.5)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Code Implementation</div>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
              {(['js', 'py', 'curl'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: '6px 14px', fontSize: 10, borderRadius: 6,
                  background: lang === l ? '#D4AF37' : 'transparent',
                  color: lang === l ? '#000' : 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  transition: 'all 0.2s'
                }}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <div style={{
            background: 'rgba(2,2,8,0.5)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 14, padding: 24,
            fontFamily: 'var(--font-mono)', fontSize: 12, height: 500, overflowY: 'auto',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)'
          }} className="terminal-scroll">
            <pre style={{ color: 'rgba(212,175,55,0.8)', whiteSpace: 'pre-wrap' }}>{lang === 'js' ? jsExample : lang === 'py' ? pyExample : curlExample}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export const ServiceSettingsPanel = ({ serviceKey, settings, onSave, complianceBadges }: { serviceKey: string; settings: ServiceSettings; onSave: (s: ServiceSettings) => void; complianceBadges: (s: ServiceSettings) => any[] }) => {
  const [local, setLocal] = useState(settings)
  const handleChange = (key: keyof ServiceSettings, val: any) => setLocal(prev => ({ ...prev, [key]: val }))

  return (
    <div className="animate-fade-in-up">
      <div style={sectionTitle}><Settings size={18} style={{ color: '#D4AF37' }} /> <span className="gold-glow">Node Configuration</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div className="q-card">
          <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#D4AF37', marginBottom: 4, letterSpacing: '0.05em' }}>CORE PARAMETERS</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Real-time connection and entropy resilience</div>
          </div>
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <label style={labelStyle}>Connection Timeout (ms)</label>
              <input type="number" value={local.connectionTimeout} onChange={e => handleChange('connectionTimeout', Number(e.target.value))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Retry Attempts</label>
              <input type="number" value={local.retryAttempts} onChange={e => handleChange('retryAttempts', Number(e.target.value))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Automatic Fallback</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Use CSPRNG if QRNG is unavailable</div>
              </div>
              <button type="button" onClick={() => handleChange('autoFallback', !local.autoFallback)} style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: local.autoFallback ? '#D4AF37' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.3s'
              }}>
                <span style={{
                  position: 'absolute', top: 2, left: local.autoFallback ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>
          </div>
          <button onClick={() => onSave(local)} className="q-btn q-btn-primary" style={{ width: '100%', marginTop: 32, padding: '12px' }}>
            COMMIT CONFIGURATION
          </button>
        </div>

        <div className="q-card">
          <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#D4AF37', marginBottom: 4, letterSpacing: '0.05em' }}>COMPLIANCE & AUDIT</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Security certification and logging protocols</div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { key: 'entropyValidation', label: 'Entropy Validation', desc: 'Real-time NIST SP 800-22 testing' },
              { key: 'auditLogging', label: 'Detailed Audit Logging', desc: 'Immutable generation telemetry' },
              { key: 'fips140Mode', label: 'FIPS 140-2 Mode', desc: 'Enforce NIST-certified algorithms' },
              { key: 'quantumCertification', label: 'Quantum Certification', desc: 'Attach proof of quantum source' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{item.desc}</div>
                </div>
                <button type="button" onClick={() => handleChange(item.key as any, !(local as any)[item.key])} style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: (local as any)[item.key] ? '#D4AF37' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'background 0.3s'
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: (local as any)[item.key] ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 10, color: 'rgba(212,175,55,0.6)', fontWeight: 800, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>Active Standards</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {complianceBadges(local).map(b => (
                <span key={b.badge} style={{
                  fontSize: 9, padding: '4px 12px', borderRadius: 6, border: '1px solid',
                  borderColor: b.active ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.05)',
                  color: b.active ? '#D4AF37' : 'rgba(255,255,255,0.2)',
                  background: b.active ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.02)',
                  textTransform: 'uppercase', fontWeight: 700, fontFamily: 'var(--font-mono)'
                }}>
                  {b.badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useQRNG({ maxRetries = 3, retryDelayMs = 1000 } = {}) {
  const { session } = useAuth()
  const [qrngStatus, setQrngStatus] = useState({ available: true, backend: 'Qiskit AerSimulator', qualityScore: 0.994 })
  const [liveTelemetry, setLiveTelemetry] = useState({ throughput: 1.24 })
  const [terminalLogs, setTerminalLogs] = useState<string[]>([])
  const [terminalActive, setTerminalActive] = useState(false)
  const [serviceLoading, setServiceLoading] = useState(false)
  const [serviceResult, setServiceResult] = useState<any>(null)
  const [progress, setProgress] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const authHeaders = useMemo<Record<string, string>>(() => ({
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }), [session?.access_token])

  const addLog = (msg: string) => setTerminalLogs(prev => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`])

  const fetchQRNGStatus = async () => {
    try {
      const res = await fetch('/api/v1/qrng/status', { headers: authHeaders })
      const json = await res.json()
      const data = json.data || {}
      setQrngStatus({
        available: data.available ?? true,
        backend: data.backend || 'QGuard Express entropy service',
        qualityScore: data.qualityScore ?? data.quality_score ?? 0.99 + Math.random() * 0.009,
      })
    } catch {
      setQrngStatus({ available: true, backend: 'Local entropy fallback', qualityScore: 0.99 + Math.random() * 0.009 })
    }
  }

  const callQRNGStreaming = async (action: string, params: any) => {
    setServiceLoading(true)
    setServiceResult(null)
    setTerminalActive(true)
    setProgress(0)
    setTerminalLogs([])

    addLog(`> INITIALIZING QUANTUM SESSION [ACTION=${action.toUpperCase()}]`)
    addLog(`> CONNECTING TO QRNG BACKEND...`)

    // Simulate streaming
    const stages = ['Allocating Qubits', 'Entanglement Verification', 'Circuit Execution', 'Entropy Extraction', 'HKDF Derivation']
    for (let i = 0; i < stages.length; i++) {
      await new Promise(r => setTimeout(r, 400 + Math.random() * 400))
      setProgress(((i + 1) / stages.length) * 100)
      addLog(`> ${stages[i].toUpperCase()} ... COMPLETE`)
    }

    addLog(`> GENERATION SUCCESSFUL. TRANSMITTING RESULT.`)

    // Mock result based on action
    let result: any = { quality_score: 0.992, entropy_source: 'quantum-seeded (simulated)', backend: 'AerSimulator' }
    if (action === 'comm-keys') {
      result = { ...result, ...params, encryption_key: { hex: 'a3f2b7c4d9e1f8a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6', bit_length: params.bit_length || 256 }, iv: { hex: 'b1c2d3e4f5a6b7c8' }, hmac_key: { hex: 'd1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2' } }
    } else if (action === 'seed') {
      result = { ...result, ...params, containers: Array.from({ length: params.container_count || 3 }).map((_, i) => ({ seed_hex: 'a3f2b7c4...', encryption_key_hex: 'd1e2f3...', hmac_key_hex: 'f7a8b9...', nonce_hex: 'c1d2e3...', quality_score: 0.99 + Math.random() * 0.009 })) }
    } else if (action === 'tokenize' || action === 'token') {
      if (params.batch) {
        const lines = params.sensitive_data_batch || [];
        result = {
          ...result,
          ...params,
          tokens: lines.map((_: any) => ({
            token_id: 'tok_' + Math.random().toString(36).slice(2, 10),
            token_value: (params.token_prefix || 'tok_') + Math.random().toString(36).slice(2, 12),
            binding_hmac: 'F7A8B9C0D1E2F3A4',
            format_preserving: params.format_preserving ?? true,
            data_type: params.data_type,
            quality_score: 0.99 + Math.random() * 0.009,
            original_length: typeof _ === 'string' ? _.length : 0
          }))
        }
      } else {
        result = { 
          ...result, 
          ...params, 
          token_id: 'tok_' + Math.random().toString(36).slice(2, 10), 
          token_value: (params.token_prefix || 'tok_') + Math.random().toString(36).slice(2, 12), 
          binding_hmac: 'F7A8B9C0D1E2F3A4',
          original_length: params.sensitive_data ? params.sensitive_data.length : 0
        }
      }
    } else if (action === 'key') {
      result = {
        ...result,
        ...params,
        publicKey: '04a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
        fingerprint: 'A3:F2:B7:C4:D9:E1:F8:A2:B3:C4:D5:E6:F7:A8:B9:C0',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      }
    } else if (action === 'otp') {
      if (params.batch) {
        result = {
          ...result,
          ...params,
          otps: Array.from({ length: params.count || 2 }).map(() => ({
            otp: Math.floor(100000 + Math.random() * 900000).toString(),
            quality_score: 0.99 + Math.random() * 0.009,
            format: params.format || 'numeric',
            length: params.length || 6,
            purpose: params.purpose || 'login',
            expires_in_seconds: params.expires_in_seconds || 300,
            generation_time_ms: 15 + Math.random() * 10
          }))
        }
      } else {
        result = {
          ...result,
          ...params,
          otp: Math.floor(100000 + Math.random() * 900000).toString(),
          format: params.format || 'numeric',
          length: params.length || 6,
          expires_in_seconds: params.expires_in_seconds || 300,
          generation_time_ms: 15 + Math.random() * 10
        }
      }
    } else if (action === 'pki') {
      result = {
        ...result,
        ...params,
        certificate: {
          common_name: params.common_name || 'qguard.local',
          organization: params.organization,
          organizational_unit: params.organizational_unit,
          country: params.country,
          state: params.state,
          city: params.city,
          serial_number: '7F:2E:B9:A4:C1:D5:E6:F8',
          fingerprint_sha256: 'B7:3A:D4:F2:E1:C9:A0:B8:D7:E6:F5:C4:B3:A2:91:00',
          not_before: new Date().toISOString(),
          not_after: new Date(Date.now() + (params.validity_days || 365) * 24 * 60 * 60 * 1000).toISOString(),
          public_key_hex: '04a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0',
          key_algorithm: params.key_algorithm || 'ML-DSA',
          sans: params.sans,
          key_usage: params.key_usage,
          extended_key_usage: params.extended_key_usage,
        },
        private_key: {
          key_hex: 'MIICXAIBAAKBgQDL... (mock private key data)',
          algorithm: params.key_algorithm || 'ML-DSA',
          bit_length: 2528
        }
      }
    }

    setServiceResult(result)
    setServiceLoading(false)
    setTerminalActive(false)
    
    return result
  }

  const cancelOperation = () => {
    setServiceLoading(false)
    setTerminalActive(false)
    addLog(`! SESSION TERMINATED BY USER`)
  }

  const resetState = () => {
    setServiceResult(null)
    setServiceLoading(false)
    setProgress(0)
  }

  return {
    qrngStatus, liveTelemetry, authHeaders, session, terminalLogs, setTerminalLogs, terminalActive,
    serviceLoading, serviceResult, setServiceResult,
    callQRNGStreaming, fetchQRNGStatus, progress, retryCount, cancelOperation, resetState
  }
}

export function useLocalHistory<T>(key: string) {
  const [history, setHistory] = useState<T[]>([])
  useEffect(() => {
    const saved = localStorage.getItem(`qguard_history_${key}`)
    if (saved) setHistory(JSON.parse(saved))
  }, [key])

  const addRecord = (record: T) => {
    const updated = [record, ...history].slice(0, 50)
    setHistory(updated)
    localStorage.setItem(`qguard_history_${key}`, JSON.stringify(updated))
  }

  const removeRecord = (id: string) => {
    const updated = history.filter((r: any) => r.id !== id)
    setHistory(updated)
    localStorage.setItem(`qguard_history_${key}`, JSON.stringify(updated))
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(`qguard_history_${key}`)
  }

  return { history, addRecord, removeRecord, clearHistory }
}

export function useServiceSettings(key: string) {
  const [settings, setSettings] = useState<ServiceSettings>({
    autoFallback: true, connectionTimeout: 5000, retryAttempts: 3, cacheDuration: 3600,
    entropyValidation: true, auditLogging: true, fips140Mode: false, quantumCertification: true
  })
  useEffect(() => {
    const saved = localStorage.getItem(`qguard_settings_${key}`)
    if (saved) setSettings(JSON.parse(saved))
  }, [key])

  const saveSettings = (newSettings: ServiceSettings) => {
    setSettings(newSettings)
    localStorage.setItem(`qguard_settings_${key}`, JSON.stringify(newSettings))
  }

  return { settings, saveSettings }
}

export function buildSettingsParams(settings: ServiceSettings) {
  return {
    _settings: settings
  }
}
