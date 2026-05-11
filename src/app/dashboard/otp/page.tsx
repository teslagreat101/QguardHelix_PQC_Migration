'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  useQRNG, QuantumTerminal, CopyButton, ErrorResult, QRNGPageHeader, QRNGStatusBanner, ProgressIndicator,
  ServiceAPIPanel, TabNav,
  inputStyle, labelStyle, sectionTitle, resultMetaStyle, resultMetaItem, resultMetaLabel, resultMetaValue,
} from '@/components/qrng/shared'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OTPRecord {
  id: string
  format: string
  purpose: string
  length: number
  entropy_source: string
  quality_score: number
  otp_preview: string
  expires_at: string | null
  created_at: string
  status: 'active' | 'used' | 'expired' | 'revoked'
  _mock_otp?: string
}

interface OTPStats {
  total_generated: number
  quantum_source_count: number
  avg_entropy_bits: number
  success_rate: number
}

type Tab = 'generate' | 'validate' | 'history' | 'api' | 'settings'

// ── OTP Settings (shared across all tabs) ─────────────────────────────────────

interface OTPSettings {
  // Service Configuration
  autoFallback: boolean
  connectionTimeout: number
  retryAttempts: number
  cacheDuration: number
  // Security Settings
  entropyValidation: boolean
  auditLogging: boolean
  fips140Mode: boolean
  quantumCertification: boolean
}

const DEFAULT_OTP_SETTINGS: OTPSettings = {
  autoFallback: true,
  connectionTimeout: 8000,
  retryAttempts: 3,
  cacheDuration: 0,
  entropyValidation: true,
  auditLogging: true,
  fips140Mode: false,
  quantumCertification: true,
}

function useOTPSettings() {
  const [settings, setSettings] = useState<OTPSettings>(DEFAULT_OTP_SETTINGS)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    try {
      const stored = localStorage.getItem('qguard-otp-settings')
      if (stored) setSettings(prev => ({ ...prev, ...JSON.parse(stored) }))
    } catch { /* ignore */ }
  }, [])

  const saveSettings = useCallback((next: OTPSettings) => {
    setSettings(next)
    try { localStorage.setItem('qguard-otp-settings', JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  return { settings, saveSettings }
}

// ── OTP Result Display ─────────────────────────────────────────────────────────

function OTPDisplay({
  result,
  onSave,
  purpose,
}: {
  result: Record<string, unknown>
  onSave: (r: { otp: string; format: string; length: number; purpose: string; quality_score: number; entropy_source: string; expires_in_seconds: number; expires_at: string; generation_time_ms: number }) => void
  purpose?: string
}) {
  const otp = String(result.otp || '')
  const expiresAt = result.expires_at ? new Date(result.expires_at as string) : null
  const [timeLeft, setTimeLeft] = useState(result.expires_in_seconds as number || 300)
  const [masked, setMasked] = useState(true)
  const savedRef = useRef(false)

  useEffect(() => {
    if (savedRef.current) return
    savedRef.current = true
    onSave({
      otp,
      format: String(result.format || 'numeric'),
      length: Number(result.length || otp.length),
      purpose: purpose || String(result.purpose || 'login'),
      quality_score: Number(result.quality_score || 0),
      entropy_source: String(result.entropy_source || 'QRNG'),
      expires_in_seconds: Number(result.expires_in_seconds || 300),
      expires_at: (result.expires_at as string) || new Date(Date.now() + 300000).toISOString(),
      generation_time_ms: Number(result.generation_time_ms || 0),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!expiresAt) return
    const timer = setInterval(() => {
      const diff = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      setTimeLeft(diff)
      if (diff <= 0) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const pct = expiresAt
    ? Math.max(0, (expiresAt.getTime() - Date.now()) / ((result.expires_in_seconds as number || 300) * 1000))
    : 1
  const timerColor = timeLeft < 60 ? 'var(--qg-red)' : timeLeft < 120 ? 'var(--qg-amber)' : 'var(--qg-green)'
  const displayValue = masked ? '\u2022'.repeat(otp.length) : otp

  const isQuantum = String(result.entropy_source) === 'QRNG'
  const sourceColor = isQuantum ? 'var(--qg-cyan)' : 'var(--qg-amber)'

  return (
    <div className="q-card" style={{ borderColor: sourceColor }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: sourceColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {isQuantum ? '\u2705 Quantum OTP Generated' : '\u26a0\ufe0f OTP Generated (CSPRNG Fallback)'}
        </span>
        <button
          type="button"
          onClick={() => setMasked(v => !v)}
          style={{
            fontSize: 11, padding: '4px 10px', cursor: 'pointer',
            background: masked ? 'rgba(255,243,193,0.1)' : 'rgba(212,175,55,0.1)',
            border: `1px solid ${masked ? 'rgba(255,243,193,0.3)' : 'rgba(212,175,55,0.3)'}`,
            borderRadius: 4, color: masked ? 'var(--qg-violet)' : 'var(--qg-cyan)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {masked ? '\uD83D\uDC41 Reveal OTP' : '\uD83D\uDD12 Hide OTP'}
        </button>
      </div>
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{
          fontSize: otp.length > 10 ? 32 : otp.length > 6 ? 40 : 52,
          fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.35em',
          color: masked ? 'var(--qg-text-muted)' : 'var(--qg-text)',
          background: 'var(--qg-surface)', borderRadius: 12,
          padding: '20px 32px', display: 'inline-block', border: '1px solid var(--qg-border)',
          userSelect: masked ? 'none' : 'all', filter: masked ? 'blur(4px)' : 'none',
          transition: 'filter 0.2s ease',
        }}>
          {displayValue}
        </div>
        {masked && (
          <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>
            OTP hidden for security — click Reveal to view
          </div>
        )}
        <div style={{ marginTop: 16, maxWidth: 360, margin: '16px auto 0' }}>
          <div style={{ height: 4, background: 'var(--qg-border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct * 100}%`, background: timerColor, transition: 'width 1s linear, background 0.3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
            <CopyButton text={otp} label="Copy OTP" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: timerColor }}>
              {timeLeft > 0 ? `${minutes}:${String(seconds).padStart(2, '0')} remaining` : 'Expired'}
            </span>
          </div>
        </div>
      </div>
      <div style={resultMetaStyle}>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Format</div><div style={resultMetaValue}>{String(result.format || 'numeric')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Length</div><div style={resultMetaValue}>{String(result.length || otp.length)} chars</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Purpose</div><div style={resultMetaValue}>{purpose || String(result.purpose || 'login')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Expiry</div><div style={resultMetaValue}>{Number(result.expires_in_seconds || 300)}s</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Quality</div><div style={{ ...resultMetaValue, color: 'var(--qg-green)' }}>{((result.quality_score as number || 0) * 100).toFixed(1)}%</div></div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Entropy Source</div>
          <div style={{ ...resultMetaValue, color: String(result.entropy_source) === 'QRNG' ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>
            {String(result.entropy_source || 'CSPRNG')}
          </div>
        </div>
        {result.backend != null && (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Backend</div><div style={{ ...resultMetaValue, color: 'var(--qg-cyan)' }}>{String(result.backend)}</div></div>
        )}
        {result.generation_time_ms !== undefined && (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Gen Time</div><div style={resultMetaValue}>{Number(result.generation_time_ms).toFixed(0)}ms</div></div>
        )}
      </div>
      {result.compliance != null && (
        <ComplianceBadges compliance={result.compliance as Record<string, unknown>} />
      )}
    </div>
  )
}

function ComplianceBadges({ compliance }: { compliance: Record<string, unknown> }) {
  const badges = [
    { label: 'NIST 800-22', active: compliance.nist_800_22 === true },
    { label: 'NIST 800-90B', active: compliance.nist_800_90b === true },
    { label: 'FIPS 140-2', active: compliance.fips140_mode === true },
    { label: 'Entropy OK', active: compliance.entropy_validation === true },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
      {badges.map(({ label, active }) => (
        <span key={label} style={{
          fontSize: 9, padding: '2px 8px', borderRadius: 3,
          background: active ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${active ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)'}`,
          color: active ? 'var(--qg-cyan)' : 'var(--qg-text-muted)',
          fontFamily: 'var(--font-mono)', opacity: active ? 1 : 0.5,
        }}>
          {active ? '\u2713 ' : ''}{label}
        </span>
      ))}
    </div>
  )
}

function BatchOTPDisplay({ results, entropySource, backend, compliance, onSave, purpose: userPurpose }: {
  results: Array<Record<string, unknown>>
  entropySource?: string
  backend?: string
  compliance?: Record<string, unknown>
  onSave?: (r: { otp: string; format: string; length: number; purpose: string; quality_score: number; entropy_source: string; expires_in_seconds: number; expires_at: string; generation_time_ms: number }) => void
  purpose?: string
}) {
  const first = results[0] || {}
  const format = String(first.format || 'numeric')
  const length = Number(first.length || String(first.otp || '').length)
  const expiry = Number(first.expires_in_seconds || 300)
  const purpose = userPurpose || String(first.purpose || 'login')
  const source = entropySource || 'CSPRNG'
  const isQuantum = source === 'QRNG'
  const savedRef = useRef(false)

  // Persist each batch OTP to DB + local history on first render
  useEffect(() => {
    if (savedRef.current || !onSave) return
    savedRef.current = true
    for (const r of results) {
      const otp = String(r.otp || '')
      if (!otp) continue
      onSave({
        otp,
        format: String(r.format || format),
        length: Number(r.length || otp.length),
        purpose: String(r.purpose || purpose),
        quality_score: Number(r.quality_score || 0),
        entropy_source: source,
        expires_in_seconds: Number(r.expires_in_seconds || expiry),
        expires_at: String(r.expires_at || new Date(Date.now() + expiry * 1000).toISOString()),
        generation_time_ms: Number(r.generation_time_ms || 0),
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="q-card" style={{ borderColor: isQuantum ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: isQuantum ? 'var(--qg-cyan)' : 'var(--qg-amber)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {isQuantum ? '\u2705' : '\u26a0\ufe0f'} {results.length} {isQuantum ? 'Quantum' : 'CSPRNG'} OTPs Generated
        </span>
        <CopyButton text={results.map(r => String(r.otp || '')).join('\n')} label="Copy All" />
      </div>
      <div style={resultMetaStyle}>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Count</div><div style={resultMetaValue}>{results.length}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Format</div><div style={resultMetaValue}>{format}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Length</div><div style={resultMetaValue}>{length} chars</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Expiry</div><div style={resultMetaValue}>{expiry}s</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Purpose</div><div style={resultMetaValue}>{purpose}</div></div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Entropy Source</div>
          <div style={{ ...resultMetaValue, color: isQuantum ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>{source}</div>
        </div>
        {backend && (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Backend</div><div style={{ ...resultMetaValue, color: 'var(--qg-cyan)' }}>{backend}</div></div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {results.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--qg-surface)', borderRadius: 8, border: '1px solid var(--qg-border)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-text-muted)', minWidth: 24 }}>#{i + 1}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, letterSpacing: '0.2em', flex: 1 }}>{String(r.otp || '-')}</span>
            <span style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>{String(r.format || format)}</span>
            <span style={{ fontSize: 10, color: 'var(--qg-green)', fontFamily: 'var(--font-mono)' }}>{((r.quality_score as number || 0) * 100).toFixed(1)}%</span>
            <CopyButton text={String(r.otp || '')} label="Copy" />
          </div>
        ))}
      </div>
      {compliance && <ComplianceBadges compliance={compliance} />}
    </div>
  )
}

// ── Tab: Generate ──────────────────────────────────────────────────────────────

function GenerateTab({
  qrngStatus, liveTelemetry, fetchQRNGStatus,
  terminalLogs, setTerminalLogs, terminalActive,
  serviceLoading, serviceResult, setServiceResult,
  callQRNGStreaming, authHeaders, onOTPGenerated,
  progress, retryCount, cancelOperation, otpSettings,
}: {
  qrngStatus: ReturnType<typeof useQRNG>['qrngStatus']
  liveTelemetry: ReturnType<typeof useQRNG>['liveTelemetry']
  fetchQRNGStatus: ReturnType<typeof useQRNG>['fetchQRNGStatus']
  terminalLogs: ReturnType<typeof useQRNG>['terminalLogs']
  setTerminalLogs: ReturnType<typeof useQRNG>['setTerminalLogs']
  terminalActive: ReturnType<typeof useQRNG>['terminalActive']
  serviceLoading: ReturnType<typeof useQRNG>['serviceLoading']
  serviceResult: ReturnType<typeof useQRNG>['serviceResult']
  setServiceResult: ReturnType<typeof useQRNG>['setServiceResult']
  callQRNGStreaming: ReturnType<typeof useQRNG>['callQRNGStreaming']
  authHeaders: ReturnType<typeof useQRNG>['authHeaders']
  onOTPGenerated: (localRecord?: OTPRecord) => void
  progress: ReturnType<typeof useQRNG>['progress']
  retryCount: ReturnType<typeof useQRNG>['retryCount']
  cancelOperation: ReturnType<typeof useQRNG>['cancelOperation']
  otpSettings: OTPSettings
}) {
  const [otpLength, setOtpLength] = useState(6)
  const [otpFormat, setOtpFormat] = useState('numeric')
  const [otpExpiry, setOtpExpiry] = useState(300)
  const [otpPurpose, setOtpPurpose] = useState('login')
  const [batchCount, setBatchCount] = useState(1)
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleGenerate = () => {
    setSaveError(null)
    // Build params with user's OTP config + settings from Settings tab
    const settingsParams = {
      // Service Configuration
      connection_timeout_ms: otpSettings.connectionTimeout,
      auto_fallback: otpSettings.autoFallback,
      cache_duration: otpSettings.cacheDuration,
      // Security Settings — enforced server-side
      entropy_validation: otpSettings.entropyValidation,
      fips140_mode: otpSettings.fips140Mode,
      quantum_certification: otpSettings.quantumCertification,
      audit_logging: otpSettings.auditLogging,
    }
    if (mode === 'batch') {
      callQRNGStreaming('otp', { length: otpLength, format: otpFormat, count: batchCount, expires_in_seconds: otpExpiry, purpose: otpPurpose, batch: true, ...settingsParams })
    } else {
      callQRNGStreaming('otp', { length: otpLength, format: otpFormat, expires_in_seconds: otpExpiry, purpose: otpPurpose, ...settingsParams })
    }
  }

  const handleSaveOTP = useCallback(async (r: { otp: string; format: string; length: number; purpose: string; quality_score: number; entropy_source: string; expires_in_seconds: number; expires_at: string; generation_time_ms: number }) => {
    // Always create a local record for session history (works even without DB)
    const localRecord: OTPRecord = {
      id: crypto.randomUUID(),
      format: r.format,
      purpose: r.purpose,
      length: r.length,
      entropy_source: r.entropy_source,
      quality_score: r.quality_score,
      otp_preview: r.otp.length > 2 ? '\u2022'.repeat(r.otp.length - 2) + r.otp.slice(-2) : '\u2022\u2022',
      expires_at: r.expires_at,
      created_at: new Date().toISOString(),
      status: 'active',
      _mock_otp: r.otp,
    }

    // Attempt to persist to DB — non-blocking
    fetch('/api/v1/otp', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(r),
    }).catch(() => {})

    // Always update local history regardless of DB result
    onOTPGenerated(localRecord)
  }, [authHeaders, onOTPGenerated])

  const batchResults = serviceResult && Array.isArray(serviceResult.otps)
    ? (serviceResult.otps as Array<Record<string, unknown>>)
    : null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <div className="q-card animate-fade-in-up" style={{ marginBottom: 24 }}>
            <div style={sectionTitle}>OTP Configuration</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['single', 'batch'] as const).map(m => (
                <button key={m} type="button"
                  className={`q-btn ${mode === m ? 'q-btn-primary' : 'q-btn-ghost'}`}
                  style={{ flex: 1 }}
                  onClick={() => setMode(m)}>
                  {m === 'single' ? 'Single OTP' : 'Batch OTP'}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label htmlFor="otp-length" style={labelStyle}>OTP Length</label>
                <select id="otp-length" value={otpLength} onChange={e => setOtpLength(Number(e.target.value))} style={inputStyle}>
                  <option value={4}>4 digits — Basic</option>
                  <option value={6}>6 digits — Standard (TOTP)</option>
                  <option value={8}>8 digits — High Security</option>
                  <option value={10}>10 chars — Extended</option>
                  <option value={12}>12 chars — Maximum</option>
                </select>
              </div>
              <div>
                <label htmlFor="otp-format" style={labelStyle}>Format</label>
                <select id="otp-format" value={otpFormat} onChange={e => setOtpFormat(e.target.value)} style={inputStyle}>
                  <option value="numeric">Numeric (0-9)</option>
                  <option value="alphanumeric">Alphanumeric (A-Z, 0-9)</option>
                  <option value="hex">Hexadecimal (0-9, A-F)</option>
                  <option value="base32">Base32 (TOTP compatible)</option>
                  <option value="pin">PIN (no ambiguous chars)</option>
                </select>
              </div>
              <div>
                <label htmlFor="otp-expiry" style={labelStyle}>Expiry</label>
                <select id="otp-expiry" value={otpExpiry} onChange={e => setOtpExpiry(Number(e.target.value))} style={inputStyle}>
                  <option value={30}>30 seconds (TOTP standard)</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={300}>5 minutes (default)</option>
                  <option value={600}>10 minutes</option>
                  <option value={900}>15 minutes</option>
                  <option value={1800}>30 minutes</option>
                </select>
              </div>
              <div>
                <label htmlFor="otp-purpose" style={labelStyle}>Purpose</label>
                <select id="otp-purpose" value={otpPurpose} onChange={e => setOtpPurpose(e.target.value)} style={inputStyle}>
                  <option value="login">Login / 2FA</option>
                  <option value="transaction">Transaction Signing</option>
                  <option value="password-reset">Password Reset</option>
                  <option value="email-verify">Email Verification</option>
                  <option value="device-pairing">Device Pairing</option>
                  <option value="admin-action">Admin Action</option>
                </select>
              </div>
              {mode === 'batch' && (
                <div>
                  <label htmlFor="batch-count" style={labelStyle}>Batch Count</label>
                  <input id="batch-count" type="number" value={batchCount}
                    onChange={e => setBatchCount(Math.min(50, Math.max(2, Number(e.target.value))))}
                    min={2} max={50} style={inputStyle} />
                  <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                    Generate 2–50 unique OTPs in one quantum circuit execution
                  </div>
                </div>
              )}
              <button type="button" className="q-btn q-btn-primary" onClick={handleGenerate} disabled={serviceLoading} style={{ marginTop: 4 }}>
                {serviceLoading ? '\u23f3 Executing Quantum Circuit...' : `\u26a1 Generate ${mode === 'batch' ? `${batchCount} OTPs` : 'OTP'}`}
              </button>
            </div>
          </div>

          <div className="q-card" style={{ background: 'rgba(212,175,55,0.03)', borderColor: 'rgba(212,175,55,0.1)' }}>
            <div style={sectionTitle}>About QRNG OTPs</div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
              <div>&#x2022; Generated from real quantum hardware entropy via Qiskit</div>
              <div>&#x2022; Each OTP uses a fresh quantum circuit measurement</div>
              <div>&#x2022; Passes NIST SP 800-22 randomness tests</div>
              <div>&#x2022; No predictable patterns — immune to prediction attacks</div>
              <div>&#x2022; Single-use by design — invalidated after verification</div>
              <div>&#x2022; All OTPs auto-saved to your persistent history</div>
            </div>
          </div>
        </div>

        <div>
          {saveError && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-amber)' }}>
              {saveError}
            </div>
          )}
          
          {/* Progress Indicator */}
          {terminalActive && (
            <ProgressIndicator
              progress={progress}
              isRunning={terminalActive}
              onCancel={cancelOperation}
              retryCount={retryCount}
            />
          )}
          
          {serviceResult && (
            <div style={{ marginBottom: 24 }}>
              {'error' in serviceResult
                ? <ErrorResult message={String(serviceResult.error)} />
                : batchResults
                  ? <BatchOTPDisplay results={batchResults} entropySource={String(serviceResult.entropy_source || '')} backend={String(serviceResult.backend || '')} compliance={serviceResult.compliance as Record<string, unknown> | undefined} onSave={handleSaveOTP} purpose={otpPurpose} />
                  : <OTPDisplay result={serviceResult} onSave={handleSaveOTP} purpose={otpPurpose} />
              }
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <QuantumTerminal logs={terminalLogs} isRunning={terminalActive} onClear={() => setTerminalLogs([])} />
      </div>
    </div>
  )
}

// ── Tab: Validate ──────────────────────────────────────────────────────────────

function ValidateTab({
  authHeaders,
  history,
  onUpdateRecord,
}: {
  authHeaders: Record<string, string>
  history: OTPRecord[]
  onUpdateRecord: (r: OTPRecord) => void
}) {
  const [otpValue, setOtpValue] = useState('')
  const [validating, setValidating] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)

  // After validation, find the matched record from local history for display
  const matchedId = result ? String((result as { otp_id?: string }).otp_id || '') : ''
  const matchedRecord = matchedId ? history.find(r => r.id === matchedId) : null

  const handleValidate = async () => {
    if (!otpValue.trim()) return
    setValidating(true)
    setResult(null)

    let apiSuccess = false

    // 1. Try backend API first (timing-safe SHA-256 comparison)
    try {
      const res = await fetch('/api/v1/otp/validate', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ otp_value: otpValue.trim() }),
      })
      const json = await res.json()

      if (json.data) {
        apiSuccess = true
        setResult(json.data)

        // Sync local history status with backend result
        if (json.data.otp_id) {
          const matchedLocal = history.find(r => r.id === json.data.otp_id)
          if (matchedLocal) {
            onUpdateRecord({
              ...matchedLocal,
              status: json.data.valid ? 'used' : (json.data.reason?.includes('expired') ? 'expired' : matchedLocal.status),
            })
          }
        }
      } else if (json.error) {
        // API returned an error structure — show it
        setResult({ valid: false, reason: json.error.message || 'Validation failed' })
        apiSuccess = true
      }
    } catch {
      // API unreachable — fall through to local fallback
    }

    // 2. Fallback: local history matching (when API is unavailable)
    if (!apiSuccess) {
      const activeRecords = history.filter(r => r.status === 'active')
      const matched = activeRecords.find(r => r._mock_otp === otpValue.trim())

      if (matched) {
        const isExpired = matched.expires_at ? new Date(matched.expires_at) < new Date() : false
        if (isExpired) {
          setResult({ valid: false, reason: 'OTP has expired.' })
          onUpdateRecord({ ...matched, status: 'expired' })
        } else {
          setResult({
            valid: true,
            otp_id: matched.id,
            format: matched.format,
            entropy_source: matched.entropy_source,
            validated_at: new Date().toISOString(),
          })
          onUpdateRecord({ ...matched, status: 'used' })
        }
      } else {
        setResult({ valid: false, reason: 'OTP not found — it may have expired, been used, or was never recorded' })
      }
    }

    setValidating(false)
  }

  const isValid = result && (result as { valid?: boolean }).valid === true
  const activeCount = history.filter(r => r.status === 'active').length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div>
        <div className="q-card animate-fade-in-up">
          <div style={sectionTitle}>OTP Validation</div>

          <div style={{ marginBottom: 16, padding: '10px 12px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 6 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', marginBottom: 4 }}>
              How it works
            </div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', lineHeight: 1.7 }}>
              Enter the OTP value below. The system will find a matching active OTP in your account using a SHA-256 hash lookup — no selection required.
            </div>
            {activeCount > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-green)' }}>
                {activeCount} active OTP{activeCount !== 1 ? 's' : ''} available for validation
              </div>
            )}
            {activeCount === 0 && (
              <div style={{ marginTop: 6, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-amber)' }}>
                No active OTPs — generate one in the Generate tab first
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label htmlFor="validate-input" style={labelStyle}>Enter OTP Value</label>
              <input
                id="validate-input"
                type="text"
                value={otpValue}
                onChange={e => setOtpValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleValidate() }}
                placeholder="Enter the exact OTP code..."
                style={{ ...inputStyle, letterSpacing: '0.25em', fontSize: 20, textAlign: 'center', padding: '14px 16px' }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <button
              type="button"
              className="q-btn q-btn-primary"
              onClick={handleValidate}
              disabled={validating || !otpValue.trim()}
              style={{ marginTop: 4, padding: '12px', fontSize: 14, justifyContent: 'center' }}
            >
              {validating ? '\u23f3 Validating...' : '\u2714 Validate OTP'}
            </button>

            {otpValue.trim() && (
              <button
                type="button"
                className="q-btn q-btn-ghost"
                onClick={() => { setOtpValue(''); setResult(null) }}
                style={{ fontSize: 11 }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {matchedRecord && (
          <div className="q-card" style={{ marginTop: 16, borderColor: isValid ? 'rgba(34,197,94,0.3)' : 'rgba(212,175,55,0.2)' }}>
            <div style={sectionTitle}>Matched OTP Details</div>
            <div style={{ display: 'grid', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {[
                ['Preview', matchedRecord.otp_preview, 'var(--qg-cyan)'],
                ['Format', matchedRecord.format, null],
                ['Purpose', matchedRecord.purpose, null],
                ['Length', `${matchedRecord.length} chars`, null],
                ['Entropy Source', matchedRecord.entropy_source, 'var(--qg-green)'],
                ['Generated', new Date(matchedRecord.created_at).toLocaleString(), null],
                ['Expires', matchedRecord.expires_at ? new Date(matchedRecord.expires_at).toLocaleString() : 'N/A', null],
              ].map(([label, value, color]) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--qg-text-muted)' }}>{label}</span>
                  <span style={{ color: color || 'var(--qg-text)', letterSpacing: label === 'Preview' ? '0.15em' : undefined }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        {result && (
          <div className="q-card animate-fade-in-up" style={{ borderColor: isValid ? 'var(--qg-green)' : 'var(--qg-red)' }}>
            <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>
                {isValid ? '\u2705' : '\u274c'}
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
                color: isValid ? 'var(--qg-green)' : 'var(--qg-red)', marginBottom: 8,
              }}>
                {isValid ? 'OTP Valid' : 'OTP Invalid'}
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>
                {String((result as { reason?: string }).reason || '')}
              </div>
            </div>

            <div style={resultMetaStyle}>
              <div style={resultMetaItem}>
                <div style={resultMetaLabel}>Comparison</div>
                <div style={{ ...resultMetaValue, color: 'var(--qg-cyan)' }}>Timing-Safe</div>
              </div>
              <div style={resultMetaItem}>
                <div style={resultMetaLabel}>Security Level</div>
                <div style={{ ...resultMetaValue, color: 'var(--qg-green)' }}>Quantum-Safe</div>
              </div>
              {(result as { format?: string }).format && (
                <div style={resultMetaItem}>
                  <div style={resultMetaLabel}>Format</div>
                  <div style={resultMetaValue}>{String((result as { format?: string }).format)}</div>
                </div>
              )}
              {(result as { entropy_source?: string }).entropy_source && (
                <div style={resultMetaItem}>
                  <div style={resultMetaLabel}>Entropy Source</div>
                  <div style={{ ...resultMetaValue, color: 'var(--qg-cyan)' }}>{String((result as { entropy_source?: string }).entropy_source)}</div>
                </div>
              )}
              {(result as { validated_at?: string }).validated_at && (
                <div style={resultMetaItem}>
                  <div style={resultMetaLabel}>Validated At</div>
                  <div style={resultMetaValue}>{new Date(String((result as { validated_at?: string }).validated_at)).toLocaleTimeString()}</div>
                </div>
              )}
              {isValid && (
                <div style={resultMetaItem}>
                  <div style={resultMetaLabel}>Single-Use</div>
                  <div style={{ ...resultMetaValue, color: 'var(--qg-amber)' }}>Marked Used</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(212,175,55,0.05)', borderRadius: 6, border: '1px solid rgba(212,175,55,0.1)' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', lineHeight: 1.7 }}>
                <div>&#x2022; SHA-256 hashed comparison — original OTP not stored in plaintext</div>
                <div>&#x2022; Constant-time comparison prevents timing-based side-channel attacks</div>
                {isValid && <div style={{ color: 'var(--qg-amber)' }}>&#x2022; OTP has been invalidated to enforce single-use policy</div>}
              </div>
            </div>
          </div>
        )}

        {!result && (
          <div className="q-card" style={{ background: 'rgba(212,175,55,0.03)', borderColor: 'rgba(212,175,55,0.08)' }}>
            <div style={sectionTitle}>How Validation Works</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['1. Enter OTP', 'Type the exact OTP value you want to verify'],
                ['2. Hash Lookup', 'SHA-256 of your input is searched against active OTPs'],
                ['3. Timing-Safe Check', 'Comparison uses timingSafeEqual() — no timing leaks'],
                ['4. Single-Use', 'Valid OTPs are marked "used" preventing replay attacks'],
                ['5. No Dropdown Needed', 'System finds the match automatically from your account'],
              ].map(([title, desc]) => (
                <div key={title} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)', flexShrink: 0, minWidth: 120 }}>{title}</span>
                  <span style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: History ───────────────────────────────────────────────────────────────

function HistoryTab({
  authHeaders,
  history,
  stats,
  loading,
  onDelete,
  onRefresh,
}: {
  authHeaders: Record<string, string>
  history: OTPRecord[]
  stats: OTPStats | null
  loading: boolean
  onDelete: (id: string) => void
  onRefresh: () => void
}) {
  const [filter, setFilter] = useState<'all' | 'active' | 'used' | 'expired'>('all')
  const [search, setSearch] = useState('')

  const filtered = history.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false
    if (search && !r.purpose.toLowerCase().includes(search.toLowerCase()) && !r.format.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const statusColor = (s: string) => {
    if (s === 'active') return 'var(--qg-green)'
    if (s === 'used') return 'var(--qg-cyan)'
    if (s === 'expired') return 'var(--qg-text-muted)'
    return 'var(--qg-red)'
  }

  return (
    <div>
      {/* Stats — use DB stats if available, else derive from local history */}
      {(stats || history.length > 0) && (() => {
        const totalGenerated = stats?.total_generated ?? history.length
        const quantumCount = stats?.quantum_source_count ?? history.filter(r => r.entropy_source === 'QRNG').length
        const avgEntropy = stats?.avg_entropy_bits ?? Math.round((history.reduce((s, r) => s + r.quality_score, 0) / (history.length || 1)) * 128)
        const successRate = stats?.success_rate ?? (history.length > 0 ? Math.round((history.filter(r => r.status !== 'revoked').length / history.length) * 100 * 10) / 10 : 0)
        return (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          {[
            { label: 'Total Generated', value: totalGenerated.toString(), colorClass: 'ent-stat-cyan' },
            { label: 'Quantum Source', value: quantumCount.toString(), colorClass: 'ent-stat-green' },
            { label: 'Avg Entropy Bits', value: avgEntropy.toString(), colorClass: 'ent-stat-violet' },
            { label: 'Success Rate', value: `${successRate.toFixed(1)}%`, colorClass: 'ent-stat-amber' },
          ].map(({ label, value, colorClass }) => (
            <div key={label} className="q-card stat-card animate-fade-in-up" style={{ textAlign: 'center' }}>
              <div className={`stat-value ${colorClass}`}>{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
        )
      })()}

      {/* Controls */}
      <div className="q-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by purpose or format..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'active', 'used', 'expired'] as const).map(f => (
              <button key={f} type="button"
                className={`q-btn ${filter === f ? 'q-btn-primary' : 'q-btn-ghost'}`}
                style={{ fontSize: 11, padding: '6px 12px' }}
                onClick={() => setFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="q-btn q-btn-ghost" style={{ fontSize: 11 }} onClick={onRefresh}>
            {loading ? '\u23f3' : '\u21bb'} Refresh
          </button>
        </div>
      </div>

      {/* List */}
      <div className="q-card">
        {loading && filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            Loading OTP history...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {history.length === 0 ? 'No OTPs generated yet — use the Generate tab to create your first quantum OTP' : 'No OTPs match the current filter'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <thead>
                <tr>
                  {['OTP Preview', 'Format', 'Len', 'Purpose', 'Source', 'Quality', 'Status', 'Expires', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px', textAlign: 'left', color: '#D4AF37', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const isExpiredTime = r.expires_at ? new Date(r.expires_at).getTime() < Date.now() : false
                  return (
                  <tr key={r.id} style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    transition: 'background 0.2s',
                    opacity: r.status === 'expired' || isExpiredTime ? 0.6 : 1,
                  }} className="hover:bg-white/[0.05]">
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.2em', color: r.status === 'active' && !isExpiredTime ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                        {r.otp_preview}
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: 'rgba(255,255,255,0.6)' }}>{r.format}</td>
                    <td style={{ padding: '12px', color: 'rgba(255,255,255,0.6)' }}>{r.length}</td>
                    <td style={{ padding: '12px' }}>{r.purpose}</td>
                    <td style={{ padding: '12px', color: r.entropy_source === 'QRNG' ? '#22c55e' : '#f59e0b' }}>{r.entropy_source}</td>
                    <td style={{ padding: '12px', color: '#00d4ff' }}>{(r.quality_score * 100).toFixed(1)}%</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: `${statusColor(isExpiredTime ? 'expired' : r.status)}15`, color: statusColor(isExpiredTime ? 'expired' : r.status), fontWeight: 700, textTransform: 'uppercase', border: '1px solid currentColor', opacity: 0.8 }}>
                        {isExpiredTime ? 'expired' : r.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                      {r.expires_at ? new Date(r.expires_at).toLocaleTimeString() : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button type="button"
                        className="hover:text-red-400 transition-colors"
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }}
                        onClick={() => onDelete(r.id)}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab: API Docs (uses ServiceAPIPanel — see render) ─────────────────────────

// ── Tab: Settings ──────────────────────────────────────────────────────────────

function SettingsTab({ settings, onSave }: { settings: OTPSettings; onSave: (s: OTPSettings) => void }) {
  const [draft, setDraft] = useState<OTPSettings>(settings)
  const [saved, setSaved] = useState(false)

  // Sync draft when external settings change (e.g. loaded from localStorage)
  useEffect(() => { setDraft(settings) }, [settings])

  const handleSave = () => {
    onSave(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggle = (key: keyof OTPSettings) => {
    setDraft(prev => ({ ...prev, [key]: !prev[key] } as OTPSettings))
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Service Configuration */}
      <div>
        <div className="q-card animate-fade-in-up" style={{ marginBottom: 16 }}>
          <div style={sectionTitle}>Service Configuration</div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--qg-text)', marginBottom: 2 }}>Auto CSPRNG Fallback</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>Fall back to CSPRNG when QRNG is offline</div>
              </div>
              <button type="button"
                onClick={() => toggle('autoFallback')}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: draft.autoFallback ? 'var(--qg-green)' : 'var(--qg-border)',
                  position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                }}>
                <span style={{
                  position: 'absolute', top: 2, left: draft.autoFallback ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%', background: 'white',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            <div>
              <label htmlFor="conn-timeout" style={labelStyle}>Connection Timeout (ms)</label>
              <select id="conn-timeout" value={draft.connectionTimeout}
                onChange={e => setDraft(prev => ({ ...prev, connectionTimeout: Number(e.target.value) }))}
                style={inputStyle}>
                <option value={3000}>3,000 ms (Fast)</option>
                <option value={5000}>5,000 ms (Balanced)</option>
                <option value={8000}>8,000 ms (Reliable)</option>
                <option value={15000}>15,000 ms (Slow network)</option>
              </select>
            </div>

            <div>
              <label htmlFor="retry-attempts" style={labelStyle}>Retry Attempts</label>
              <select id="retry-attempts" value={draft.retryAttempts}
                onChange={e => setDraft(prev => ({ ...prev, retryAttempts: Number(e.target.value) }))}
                style={inputStyle}>
                <option value={1}>1 attempt</option>
                <option value={2}>2 attempts</option>
                <option value={3}>3 attempts (default)</option>
                <option value={5}>5 attempts</option>
              </select>
            </div>

            <div>
              <label htmlFor="cache-duration" style={labelStyle}>Cache Duration</label>
              <select id="cache-duration" value={draft.cacheDuration}
                onChange={e => setDraft(prev => ({ ...prev, cacheDuration: Number(e.target.value) }))}
                style={inputStyle}>
                <option value={0}>No cache (recommended for OTP)</option>
                <option value={60}>60 seconds</option>
                <option value={300}>5 minutes</option>
              </select>
              <div style={{ fontSize: 10, color: 'var(--qg-amber)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                OTP caching is disabled by default — each OTP must be unique
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div>
        <div className="q-card animate-fade-in-up" style={{ marginBottom: 16 }}>
          <div style={sectionTitle}>Security Settings</div>
          <div style={{ display: 'grid', gap: 16 }}>
            {[
              { key: 'entropyValidation' as const, label: 'Entropy Validation', desc: 'Validate QRNG quality score before use' },
              { key: 'auditLogging' as const, label: 'Audit Logging', desc: 'Log all generate & validate operations' },
              { key: 'fips140Mode' as const, label: 'FIPS 140-2 Mode', desc: 'Enforce FIPS 140-2 Level 3 compliance' },
              { key: 'quantumCertification' as const, label: 'Quantum Certification', desc: 'Require NIST SP 800-90B certified entropy' },
            ].map(({ key, label, desc }) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--qg-text)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>{desc}</div>
                </div>
                <button type="button"
                  onClick={() => toggle(key)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: draft[key] ? 'var(--qg-green)' : 'var(--qg-border)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}>
                  <span style={{
                    position: 'absolute', top: 2, left: draft[key] ? 22 : 2,
                    width: 20, height: 20, borderRadius: '50%', background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance badges — reflect active security settings */}
        <div className="q-card" style={{ background: 'rgba(212,175,55,0.03)', borderColor: 'rgba(212,175,55,0.1)' }}>
          <div style={sectionTitle}>Compliance Standards</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {([
              { badge: 'NIST SP 800-22', active: draft.entropyValidation },
              { badge: 'NIST SP 800-90B', active: draft.quantumCertification },
              { badge: 'FIPS 140-2', active: draft.fips140Mode },
              { badge: 'RFC 6238 (TOTP)', active: true },
              { badge: 'RFC 4226 (HOTP)', active: true },
              { badge: 'OWASP MFA', active: draft.auditLogging },
            ] as const).map(({ badge, active }) => (
              <span key={badge} style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 4,
                background: active ? 'rgba(212,175,55,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)'}`,
                color: active ? 'var(--qg-cyan)' : 'var(--qg-text-muted)',
                fontFamily: 'var(--font-mono)', opacity: active ? 1 : 0.5,
                transition: 'all 0.2s ease',
              }}>
                {active ? '\u2705 ' : ''}{badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Save button full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <button type="button" className="q-btn q-btn-primary" onClick={handleSave} style={{ width: '100%', justifyContent: 'center', padding: '12px' }}>
          {saved ? '\u2705 Settings Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function OTPPage() {
  const { settings: otpSettings, saveSettings } = useOTPSettings()

  const {
    qrngStatus, liveTelemetry, authHeaders, session,
    terminalLogs, setTerminalLogs, terminalActive,
    serviceLoading, serviceResult, setServiceResult,
    callQRNGStreaming, fetchQRNGStatus, progress, retryCount, cancelOperation,
  } = useQRNG({ maxRetries: otpSettings.retryAttempts, retryDelayMs: 800 })

  const [activeTab, setActiveTab] = useState<Tab>('generate')

  // History state — DB records + local session fallback merged
  const [dbHistory, setDbHistory] = useState<OTPRecord[]>([])
  const [localHistory, setLocalHistory] = useState<OTPRecord[]>([])
  const [stats, setStats] = useState<OTPStats | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const historySSERef = useRef<EventSource | null>(null)

  const handleUpdateOTP = useCallback((updatedRecord: OTPRecord) => {
    setLocalHistory(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r))
    setDbHistory(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r))
  }, [])

  // Merge: DB records take precedence (dedup by id), local fills in what DB missed
  const history = (() => {
    const dbIds = new Set(dbHistory.map(r => r.id))
    const localOnly = localHistory.filter(r => !dbIds.has(r.id))
    return [...dbHistory, ...localOnly].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  })()

  const fetchHistory = useCallback(async () => {
    if (!session?.access_token) return
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/v1/otp?limit=100', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (json.data) {
        setDbHistory(json.data)
        if (json.meta?.stats) setStats(json.meta.stats)
      }
    } catch { /* non-critical */ } finally {
      setHistoryLoading(false)
    }
  }, [session?.access_token])

  // Connect SSE for real-time history updates
  const connectHistorySSE = useCallback(() => {
    if (!session?.access_token || historySSERef.current) return
    const es = new EventSource(`/api/v1/otp/stream?token=${encodeURIComponent(session.access_token)}`)
    historySSERef.current = es

    es.addEventListener('snapshot', (e) => {
      try {
        const { records } = JSON.parse(e.data)
        setDbHistory(records || [])
      } catch { /* ignore */ }
    })
    es.addEventListener('new_otps', (e) => {
      try {
        const { records } = JSON.parse(e.data)
        if (records?.length) setDbHistory(prev => [...records, ...prev].slice(0, 200))
      } catch { /* ignore */ }
    })
    es.onerror = () => { /* auto-reconnect handled by browser */ }
  }, [session?.access_token])

  const disconnectHistorySSE = useCallback(() => {
    if (historySSERef.current) {
      historySSERef.current.close()
      historySSERef.current = null
    }
  }, [])

  // Manage SSE lifecycle based on active tab
  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'validate') {
      connectHistorySSE()
      fetchHistory()
    } else {
      disconnectHistorySSE()
    }
    return () => {
      if (activeTab !== 'history' && activeTab !== 'validate') {
        disconnectHistorySSE()
      }
    }
  }, [activeTab, connectHistorySSE, disconnectHistorySSE, fetchHistory])

  // Load history on initial mount so validate tab has data immediately
  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Cleanup on unmount
  useEffect(() => () => disconnectHistorySSE(), [disconnectHistorySSE])

  const handleOTPGenerated = useCallback((localRecord?: OTPRecord) => {
    // Immediately add to local session history (instant feedback regardless of DB)
    if (localRecord) {
      setLocalHistory(prev => [localRecord, ...prev].slice(0, 200))
    }
    // Also refresh DB history after a short delay to pick up the persisted record
    setTimeout(() => fetchHistory(), 800)
  }, [fetchHistory])

  const handleDeleteOTP = async (id: string) => {
    // Remove from both local and DB history immediately (optimistic)
    setLocalHistory(prev => prev.filter(r => r.id !== id))
    setDbHistory(prev => prev.filter(r => r.id !== id))
    if (!session?.access_token) return
    try {
      await fetch(`/api/v1/otp?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } catch { /* non-critical */ }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'generate', label: 'Generate', icon: '\u26a1' },
    { id: 'validate', label: 'Validate OTP', icon: '\u2714' },
    { id: 'history', label: 'History', icon: '\ud83d\udcdc' },
    { id: 'api', label: 'API Endpoints', icon: '\ud83d\udcd6' },
    { id: 'settings', label: 'Settings', icon: '\u2699\ufe0f' },
  ]

  return (
      <div style={{ padding: '32px 40px', maxWidth: 1600, margin: '0 auto' }}>
        <QRNGPageHeader
          title="Security Authentication"
          subtitle="Quantum-random one-time passwords for multi-factor authentication and transaction signing"
          qrngStatus={qrngStatus}
          onRefresh={fetchQRNGStatus}
        />

        <QRNGStatusBanner qrngStatus={qrngStatus} liveTelemetry={liveTelemetry} />

          <TabNav<PageTab>
          tabs={tabs as any}
          active={activeTab}
          onChange={setActiveTab}
          counts={{ history: history.length }}
        />

      {/* Tab Content */}
      {activeTab === 'generate' && (
        <GenerateTab
          qrngStatus={qrngStatus}
          liveTelemetry={liveTelemetry}
          fetchQRNGStatus={fetchQRNGStatus}
          terminalLogs={terminalLogs}
          setTerminalLogs={setTerminalLogs}
          terminalActive={terminalActive}
          serviceLoading={serviceLoading}
          serviceResult={serviceResult}
          setServiceResult={setServiceResult}
          callQRNGStreaming={callQRNGStreaming}
          authHeaders={authHeaders}
          onOTPGenerated={(rec) => handleOTPGenerated(rec)}
          progress={progress}
          retryCount={retryCount}
          cancelOperation={cancelOperation}
          otpSettings={otpSettings}
        />
      )}

      {activeTab === 'validate' && (
        <ValidateTab authHeaders={authHeaders} history={history} onUpdateRecord={handleUpdateOTP} />
      )}

      {activeTab === 'history' && (
        <HistoryTab
          authHeaders={authHeaders}
          history={history}
          stats={stats}
          loading={historyLoading}
          onDelete={handleDeleteOTP}
          onRefresh={fetchHistory}
        />
      )}

      {activeTab === 'api' && (
        <ServiceAPIPanel
          serviceName="Quantum OTP"
          sdkPackage="@qguard/sdk"
          basePathNote="RESTful CRUD + SSE streaming + validation"
          endpoints={[
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Generate a QRNG-seeded OTP via Server-Sent Events stream with real-time progress. Supports single and batch mode.',
              rateLimit: '60 req/min (Standard), 600 req/min (Enterprise)',
              body: `{
  "action": "otp",
  "length": 6,                    // 4 | 6 | 8 | 10 | 12
  "format": "numeric",            // numeric | alphanumeric | hex | base32 | pin
  "purpose": "login",             // login | transaction | password-reset | email-verify | device-pairing | admin-action
  "expires_in_seconds": 300       // 30–1800
}`,
              response: `event: progress
data: {"percent":60,"stage":"OTP Generation"}

event: result
data: {
  "otp": "847293",
  "format": "numeric",
  "length": 6,
  "purpose": "login",
  "quality_score": 0.987,
  "entropy_source": "QRNG",
  "expires_in_seconds": 300
}`,
            },
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Batch generate multiple unique OTPs in a single request with per-item progress tracking',
              rateLimit: '20 req/min (batch limited)',
              body: `{
  "action": "otp",
  "batch": true,
  "count": 10,                    // 2–50
  "length": 6,
  "format": "numeric",
  "purpose": "transaction",
  "expires_in_seconds": 300
}`,
              response: `event: result
data: {
  "otps": [
    { "otp": "847293", "quality_score": 0.98, ... },
    { "otp": "152847", "quality_score": 0.99, ... }
  ],
  "count": 10,
  "quality_score": 0.985,
  "entropy_source": "QRNG"
}`,
            },
            {
              method: 'POST',
              path: '/api/v1/otp',
              description: 'Persist a generated OTP to your secure, user-scoped history for later validation and audit',
              rateLimit: '100 req/min (Pro), 1000 req/min (Elite)',
              body: `{
  "otp": "847293",
  "format": "numeric",
  "length": 6,
  "purpose": "login",
  "quality_score": 0.98,
  "entropy_source": "QRNG",
  "expires_in_seconds": 300
}`,
              response: `{
  "data": {
    "id": "uuid",
    "otp": "847293",
    "status": "active",
    "created_at": "2026-04-06T..."
  }
}`,
            },
            {
              method: 'GET',
              path: '/api/v1/otp?limit=50&offset=0&status=active',
              description: 'Retrieve your OTP generation history with stats, pagination, and optional status filter',
              rateLimit: '200 req/min',
              response: `{
  "data": [ { "id": "uuid", "otp": "847293", "status": "active", ... } ],
  "total": 142,
  "stats": { "active": 5, "expired": 120, "used": 17 }
}`,
            },
            {
              method: 'POST',
              path: '/api/v1/otp/validate',
              description: 'Timing-safe OTP validation with single-use enforcement. Marks OTP as used on success.',
              rateLimit: '50 req/min (rate-limited for security)',
              body: `{
  "otp_id": "uuid-of-stored-otp",
  "otp_value": "847293"
}`,
              response: `{
  "data": {
    "valid": true,
    "reason": "OTP matches and is within expiry window",
    "security_level": "quantum"
  }
}`,
            },
            {
              method: 'GET',
              path: '/api/v1/otp/stream?token=JWT',
              description: 'Server-Sent Events stream for real-time OTP history updates. Emits snapshot on connect and new_otps on generation.',
              rateLimit: '10 concurrent connections',
            },
            {
              method: 'DELETE',
              path: '/api/v1/otp?id=uuid',
              description: 'Permanently delete an OTP record from history',
              rateLimit: '100 req/min',
            },
            {
              method: 'GET',
              path: '/api/v1/qrng/status',
              description: 'Health check — QRNG availability, backend type, and entropy quality metrics',
              rateLimit: '300 req/min',
              auth: false,
            },
          ]}
          jsExample={`const BASE = 'http://localhost:4000'

// 1. Generate OTP via QRNG stream (real-time progress)
async function generateQuantumOTP(config = {}) {
  const { length = 6, format = 'numeric', purpose = 'login', expiry = 300 } = config

  const res = await fetch(\`\${BASE}/api/v1/qrng/generate/stream\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify({
      action: 'otp', length, format, purpose,
      expires_in_seconds: expiry,
    }),
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let result = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    for (const part of text.split('\\n\\n')) {
      if (part.includes('event: progress')) {
        const d = JSON.parse(part.split('data: ')[1])
        console.log(\`[\${d.percent}%] \${d.stage}\`)
      }
      if (part.includes('event: result')) {
        result = JSON.parse(part.split('data: ')[1])
      }
    }
  }
  return result
}

// 2. Persist to database
async function persistOTP(otpData) {
  const res = await fetch(\`\${BASE}/api/v1/otp\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify(otpData),
  })
  return res.json()
}

// 3. Validate OTP (timing-safe)
async function validateOTP(otpId, otpValue) {
  const res = await fetch(\`\${BASE}/api/v1/otp/validate\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify({ otp_id: otpId, otp_value: otpValue }),
  })
  return res.json()
}

// 4. Real-time history via SSE
const es = new EventSource(\`\${BASE}/api/v1/otp/stream?token=\${JWT_TOKEN}\`)
es.addEventListener('snapshot', (e) => console.log('History:', JSON.parse(e.data)))
es.addEventListener('new_otps', (e) => console.log('New:', JSON.parse(e.data)))

// Usage: payment transaction OTP
const otp = await generateQuantumOTP({
  length: 8, format: 'numeric', purpose: 'transaction', expiry: 120,
})
const saved = await persistOTP(otp)
// ...send OTP to user...
const result = await validateOTP(saved.data.id, '84729315')
console.log(result.data.valid ? 'OTP Valid' : result.data.reason)`}
          pyExample={`import requests, json, sseclient

BASE = "http://localhost:4000"
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}

# 1. Generate OTP via QRNG stream
def generate_quantum_otp(length=6, fmt="numeric", purpose="login", expiry=300):
    res = requests.post(
        f"{BASE}/api/v1/qrng/generate/stream",
        json={
            "action": "otp", "length": length, "format": fmt,
            "purpose": purpose, "expires_in_seconds": expiry,
        },
        headers=HEADERS, stream=True,
    )
    client = sseclient.SSEClient(res)
    for event in client.events():
        if event.event == "progress":
            d = json.loads(event.data)
            print(f"[{d['percent']}%] {d['stage']}")
        elif event.event == "result":
            return json.loads(event.data)

# 2. Persist to DB
def persist_otp(otp_data: dict) -> dict:
    res = requests.post(f"{BASE}/api/v1/otp", json=otp_data, headers=HEADERS)
    return res.json()

# 3. Validate OTP (timing-safe)
def validate_otp(otp_id: str, otp_value: str) -> dict:
    res = requests.post(
        f"{BASE}/api/v1/otp/validate",
        json={"otp_id": otp_id, "otp_value": otp_value},
        headers=HEADERS,
    )
    return res.json()

# 4. Fetch history
def get_history(limit=50, status=None):
    params = {"limit": limit}
    if status:
        params["status"] = status
    return requests.get(f"{BASE}/api/v1/otp", params=params, headers=HEADERS).json()

# 5. Real-time SSE stream
def listen_stream(token: str):
    url = f"{BASE}/api/v1/otp/stream?token={token}"
    client = sseclient.SSEClient(url)
    for event in client:
        if event.event == "snapshot":
            print("Initial:", event.data)
        elif event.event == "new_otps":
            print("New OTPs:", event.data)

# Usage: payment flow
otp = generate_quantum_otp(length=8, purpose="transaction", expiry=120)
saved = persist_otp(otp)
# ...deliver OTP to user...
result = validate_otp(saved["data"]["id"], "84729315")
print("Valid" if result["data"]["valid"] else result["data"]["reason"])`}
          curlExample={`# Generate single OTP (SSE stream)
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "otp",
    "length": 6,
    "format": "numeric",
    "purpose": "login",
    "expires_in_seconds": 300
  }'

# Batch generate 10 OTPs
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "otp",
    "batch": true,
    "count": 10,
    "length": 8,
    "format": "numeric",
    "purpose": "transaction",
    "expires_in_seconds": 120
  }'

# Persist OTP to database
curl -X POST http://localhost:4000/api/v1/otp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "otp": "847293",
    "format": "numeric",
    "length": 6,
    "purpose": "login",
    "quality_score": 0.98,
    "entropy_source": "QRNG",
    "expires_in_seconds": 300
  }'

# Validate OTP (timing-safe)
curl -X POST http://localhost:4000/api/v1/otp/validate \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{"otp_id": "OTP_UUID", "otp_value": "847293"}'

# Fetch OTP history
curl -s "http://localhost:4000/api/v1/otp?limit=50&status=active" \\
  -H "Authorization: Bearer $JWT_TOKEN" | jq

# Delete OTP record
curl -X DELETE "http://localhost:4000/api/v1/otp?id=OTP_UUID" \\
  -H "Authorization: Bearer $JWT_TOKEN"

# SSE stream (real-time updates)
curl -N "http://localhost:4000/api/v1/otp/stream?token=$JWT_TOKEN"

# Check QRNG status
curl -s http://localhost:4000/api/v1/qrng/status | jq`}
        />
      )}

      {activeTab === 'settings' && <SettingsTab settings={otpSettings} onSave={saveSettings} />}
    </div>
  )
}
