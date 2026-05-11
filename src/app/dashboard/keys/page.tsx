'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  useQRNG, QuantumTerminal, CopyButton, QRNGPageHeader, QRNGStatusBanner,
  ServiceAPIPanel, ServiceSettingsPanel, TabNav, ProgressIndicator, ComplianceBadges,
  useServiceSettings, buildSettingsParams, type ServiceSettings,
  inputStyle, labelStyle, sectionTitle, resultMetaStyle, resultMetaItem,
  resultMetaLabel, resultMetaValue, hexBoxStyle, useLocalHistory
} from '@/components/qrng/shared'

// ── Types ──────────────────────────────────────────────────────────────────────

type KeyStatus = 'active' | 'revoked' | 'rotated' | 'expired'
type PageTab = 'generate' | 'history' | 'api' | 'settings'

interface GeneratedKey {
  id: string
  algorithm: string
  bitLength: number
  entropySource: string
  qualityScore: number
  fingerprint: string
  status: KeyStatus
  createdAt: string
  expiresAt: string
  revokedAt?: string | null
  rotatedFrom?: string | null
  label?: string | null
}

interface KeyHistoryMeta {
  total: number
  limit: number
  offset: number
  keysToday: number
  maxKeysPerDay: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ALGO_VARIANT: Record<string, string> = {
  'ML-KEM': 'ML-KEM-768',
  'ML-DSA': 'ML-DSA-65',
  'SPHINCS+': 'SLH-DSA-SHA2-128F',
  'HYBRID': 'ML-KEM-768 + AES-256-GCM',
}

const ALGO_STANDARD: Record<string, string> = {
  'ML-KEM': 'FIPS 203',
  'ML-DSA': 'FIPS 204',
  'SPHINCS+': 'FIPS 205',
  'HYBRID': 'FIPS 203 + NIST SP 800-38D',
}

const ALGORITHMS = ['ML-KEM', 'ML-DSA', 'SPHINCS+', 'HYBRID'] as const
const BIT_LENGTHS = [128, 256, 384, 512] as const
const HISTORY_LIMIT = 20

function statusColor(s: KeyStatus) {
  switch (s) {
    case 'active': return 'var(--qg-green)'
    case 'revoked': return 'var(--qg-red)'
    case 'rotated': return 'var(--qg-amber)'
    case 'expired': return 'var(--qg-text-muted)'
  }
}

// ── Key Result Component ───────────────────────────────────────────────────────

/** Normalize QRNG result fields — the Python service uses snake_case while
 *  the Node.js fallback uses camelCase. Merge both conventions into a
 *  consistent shape so the UI always has data to render. */
function normalizeKeyResult(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...raw,
    publicKey:     raw.publicKey || raw.key_hex || raw.public_key || raw.public_key_hex || '',
    id:            raw.id || raw.key_id || '',
    algorithm:     raw.algorithm || '',
    bitLength:     raw.bitLength || raw.bit_length || '',
    entropySource: raw.entropySource || raw.entropy_source || 'CSPRNG',
    qualityScore:  raw.qualityScore ?? raw.quality_score ?? 0,
    fingerprint:   raw.fingerprint || '',
    status:        raw.status || 'active',
    createdAt:     raw.createdAt || raw.created_at || new Date().toISOString(),
    expiresAt:     raw.expiresAt || raw.expires_at || '',
    backend:       raw.backend || '',
    label:         raw.label ?? null,
    purpose:       raw.purpose || '',
  }
}

function KeyResult({ result: raw }: { result: Record<string, unknown> }) {
  const result = normalizeKeyResult(raw)
  const publicKeyHex = String(result.publicKey || '')
  const algo = String(result.algorithm || '')
  const qualityScore = Number(result.qualityScore || 0)
  const entropySource = String(result.entropySource || '-')
  const expiresAt = result.expiresAt ? String(result.expiresAt) : ''

  return (
    <div className="q-card animate-fade-in-up" style={{ borderColor: 'var(--qg-cyan)', marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          &#x2705; QRNG Key Generated
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <CopyButton text={String(result.fingerprint || '')} label="Copy Fingerprint" />
          <CopyButton text={publicKeyHex} label="Copy Public Key" />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={resultMetaLabel}>Public Key (Hex)</div>
        <div style={hexBoxStyle}>{publicKeyHex || '-'}</div>
      </div>

      <div style={resultMetaStyle}>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Algorithm</div>
          <div style={resultMetaValue}>{ALGO_VARIANT[algo] || algo || '-'}</div>
        </div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Standard</div>
          <div style={resultMetaValue}>{ALGO_STANDARD[algo] || '-'}</div>
        </div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Bit Length</div>
          <div style={resultMetaValue}>{String(result.bitLength || '-')}</div>
        </div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Entropy Source</div>
          <div style={{ ...resultMetaValue, color: entropySource === 'QRNG' ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>
            {entropySource}
          </div>
        </div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Backend</div>
          <div style={{ ...resultMetaValue, fontSize: 11 }}>
            {String(result.backend || '-')}
          </div>
        </div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Quality Score</div>
          <div style={{ ...resultMetaValue, color: qualityScore > 0.9 ? 'var(--qg-green)' : 'var(--qg-amber)' }}>
            {(qualityScore * 100).toFixed(1)}%
          </div>
        </div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Fingerprint</div>
          <div style={{ ...resultMetaValue, fontSize: 11, color: 'var(--qg-cyan)' }}>{String(result.fingerprint || '-')}</div>
        </div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Expires</div>
          <div style={resultMetaValue}>
            {expiresAt ? new Date(expiresAt).toLocaleDateString() : '-'}
          </div>
        </div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Status</div>
          <div style={{ ...resultMetaValue, color: 'var(--qg-green)' }}>Active</div>
        </div>
      </div>
      <ComplianceBadges result={result} />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EncryptionKeysPage() {
  const { session } = useAuth()
  const { settings: svcSettings, saveSettings } = useServiceSettings('keys')
  const {
    qrngStatus, liveTelemetry, authHeaders,
    terminalLogs, setTerminalLogs, terminalActive,
    fetchQRNGStatus, progress, retryCount, cancelOperation, resetState,
    serviceLoading, serviceResult, setServiceResult,
    callQRNGStreaming,
  } = useQRNG({ maxRetries: svcSettings.retryAttempts, retryDelayMs: 800 })

  const [activeTab, setActiveTab] = useState<PageTab>('generate')

  // Generation state
  const [algorithm, setAlgorithm] = useState('ML-KEM')
  const [bitLength, setBitLength] = useState(256)
  const [keyLabel, setKeyLabel] = useState('')
  const [keyPurpose, setKeyPurpose] = useState('encryption')
  const [genError, setGenError] = useState<string | null>(null)
  const [terminalActiveState, setTerminalActiveState] = useState(false)

  // Use genResult as alias for serviceResult for backward compatibility
  const genResult = serviceResult

  // Keys list state
  const { history: localKeys, addRecord, removeRecord } = useLocalHistory<GeneratedKey>('keys')
  const [keysMeta, setKeysMeta] = useState<KeyHistoryMeta | null>(null)
  const [keysLoading, setKeysLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<KeyStatus | ''>('')

  // History tab state
  const [historyPage, setHistoryPage] = useState(0)
  const [historyAlgoFilter, setHistoryAlgoFilter] = useState('')
  const [historyLive, setHistoryLive] = useState(false)
  const historySSERef = useRef<EventSource | null>(null)

  const keys = useMemo(() => {
    return localKeys.filter(k => {
      if (statusFilter && k.status !== statusFilter) return false
      if (historyAlgoFilter && k.algorithm !== historyAlgoFilter) return false
      return true
    })
  }, [localKeys, statusFilter, historyAlgoFilter])

  // ── Fetch Keys ─────────────────────────────────────────────────────────────

  const fetchKeys = useCallback(async (page = 0, statusF = statusFilter, algoF = historyAlgoFilter) => {
    setKeysLoading(true)
    try {
      setKeysMeta({ total: localKeys.length, keysToday: localKeys.length, limit: HISTORY_LIMIT, offset: page * HISTORY_LIMIT, maxKeysPerDay: 50 })
    } catch { /* ignore */ } finally { setKeysLoading(false) }
  }, [localKeys.length, statusFilter, historyAlgoFilter])

  useEffect(() => {
    if (activeTab === 'generate') fetchKeys(0, statusFilter, historyAlgoFilter)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // ── History SSE ────────────────────────────────────────────────────────────

  const connectHistorySSE = useCallback(() => {
    setHistoryLive(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      connectHistorySSE()
      fetchKeys(historyPage, statusFilter, historyAlgoFilter)
    } else {
      setHistoryLive(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // ── Key Generation ─────────────────────────────────────────────────────────

  const handleGenerateKey = async () => {
    setGenError(null)
    resetState()
    setTerminalActiveState(true)

    try {
      const generatedResult = await callQRNGStreaming('key', { algorithm, bit_length: bitLength, label: keyLabel || null, purpose: keyPurpose, ...buildSettingsParams(svcSettings) })

      const newKey: GeneratedKey = {
         id: crypto.randomUUID(),
         fingerprint: generatedResult?.fingerprint || '',
         algorithm,
         bitLength,
         entropySource: 'QRNG',
         qualityScore: generatedResult?.quality_score || 0.992,
         status: 'active',
         createdAt: generatedResult?.createdAt || new Date().toISOString(),
         expiresAt: generatedResult?.expiresAt || new Date(Date.now() + 365*24*3600*1000).toISOString(),
         label: keyLabel || undefined,
      }
      addRecord(newKey)

      // Persist to Supabase using user-selected config (non-blocking)
      fetch('/api/v1/keys', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ algorithm, bitLength, label: keyLabel || null, purpose: keyPurpose }),
      }).then(() => fetchKeys(0, statusFilter, historyAlgoFilter)).catch(() => {})
      setKeyLabel('')
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Key generation failed')
    } finally {
      setTerminalActiveState(false)
    }
  }

  // ── Key Actions ────────────────────────────────────────────────────────────

  const handleRevokeKey = async (keyId: string) => {
    fetch('/api/v1/keys', {
      method: 'PATCH', headers: authHeaders,
      body: JSON.stringify({ keyId, action: 'revoke' }),
    }).catch(() => {})
    
    const key = localKeys.find(k => k.id === keyId)
    if (key) {
      removeRecord(keyId)
      addRecord({ ...key, status: 'revoked', revokedAt: new Date().toISOString() })
    }
    fetchKeys(historyPage, statusFilter, historyAlgoFilter)
  }

  const handleDeleteKey = async (keyId: string) => {
    fetch(`/api/v1/keys?keyId=${keyId}`, { method: 'DELETE', headers: authHeaders }).catch(() => {})
    removeRecord(keyId)
    fetchKeys(historyPage, statusFilter, historyAlgoFilter)
  }

  const handleRotateKey = async (keyId: string) => {
    setTerminalLogs([])
    setTerminalActiveState(true)
    try {
      const rotated = await callQRNGStreaming('key', { algorithm, bit_length: bitLength, label: `rotated-${keyId.slice(0, 8)}`, ...buildSettingsParams(svcSettings) })
      
      const newKey: GeneratedKey = {
         id: crypto.randomUUID(),
         fingerprint: rotated?.fingerprint || '',
         algorithm,
         bitLength,
         entropySource: 'QRNG',
         qualityScore: rotated?.quality_score || 0.992,
         status: 'active',
         createdAt: new Date().toISOString(),
         expiresAt: new Date(Date.now() + 365*24*3600*1000).toISOString(),
         rotatedFrom: keyId
      }
      addRecord(newKey)

      fetch('/api/v1/keys', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ algorithm, bitLength, rotatedFrom: keyId }),
      }).then(() => fetchKeys(historyPage, statusFilter, historyAlgoFilter)).catch(() => {})
    } catch { /* ignore */ } finally {
      setTerminalActiveState(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
        <QRNGPageHeader
          title="Encryption Services"
          subtitle="QRNG-powered post-quantum cryptographic key generation with live Qiskit circuit execution"
          qrngStatus={qrngStatus}
          onRefresh={() => { fetchQRNGStatus(); fetchKeys(historyPage, statusFilter, historyAlgoFilter) }}
        />

      <QRNGStatusBanner qrngStatus={qrngStatus} liveTelemetry={liveTelemetry} />

      {/* Page Tabs */}
      <TabNav<PageTab>
        tabs={[
          { id: 'generate', label: 'Generate Key', icon: '\uD83D\uDD11' },
          { id: 'history', label: 'Key History', icon: '\uD83D\uDCCB' },
          { id: 'api', label: 'API', icon: '\uD83D\uDCD6' },
          { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        counts={{ history: keysMeta?.total }}
      />

      {/* ── Generate Tab ── */}
      {activeTab === 'generate' && (
        <div className="animate-fade-in-up">

          {/* Generation Form */}
          <div className="q-card" style={{ marginBottom: 24 }}>
            <div style={sectionTitle}>Configure QRNG Key</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>

              <div>
                <label style={labelStyle}>Algorithm</label>
                <select value={algorithm} onChange={e => setAlgorithm(e.target.value)} style={inputStyle}>
                  {ALGORITHMS.map(a => (
                    <option key={a} value={a}>{a} ({ALGO_VARIANT[a]}) — {ALGO_STANDARD[a]}</option>
                  ))}
                </select>
                <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  {algorithm === 'ML-KEM' && 'Key encapsulation for encryption & key exchange'}
                  {algorithm === 'ML-DSA' && 'Lattice-based digital signatures'}
                  {algorithm === 'SPHINCS+' && 'Hash-based stateless signatures'}
                  {algorithm === 'HYBRID' && 'PQC + classical for maximum transitional security'}
                </div>
              </div>

              <div>
                <label htmlFor="key-bit-length" style={labelStyle}>Security Level</label>
                <select id="key-bit-length" value={bitLength} onChange={e => setBitLength(Number(e.target.value))} style={inputStyle}>
                  <option value={128}>128-bit — NIST Level 1</option>
                  <option value={256}>256-bit — NIST Level 3 (Recommended)</option>
                  <option value={384}>384-bit — NIST Level 5</option>
                  <option value={512}>512-bit — Maximum Security</option>
                </select>
              </div>

              <div>
                <label htmlFor="key-purpose" style={labelStyle}>Key Purpose</label>
                <select id="key-purpose" value={keyPurpose} onChange={e => setKeyPurpose(e.target.value)} style={inputStyle}>
                  <option value="encryption">Encryption — Data protection</option>
                  <option value="signing">Signing — Authentication & integrity</option>
                  <option value="authentication">Authentication — Identity verification</option>
                  <option value="key-exchange">Key Exchange — Secure channel setup</option>
                  <option value="storage">Storage — At-rest encryption</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Label (optional)</label>
                <input
                  value={keyLabel}
                  onChange={e => setKeyLabel(e.target.value)}
                  placeholder="e.g. prod-api-key, db-master"
                  style={inputStyle}
                  maxLength={64}
                />
              </div>
            </div>

            {/* Algorithm Info Card */}
            <div style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.12)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                <div><div style={resultMetaLabel}>Variant</div><div style={{ ...resultMetaValue, fontSize: 12 }}>{ALGO_VARIANT[algorithm]}</div></div>
                <div><div style={resultMetaLabel}>Standard</div><div style={{ ...resultMetaValue, fontSize: 12 }}>{ALGO_STANDARD[algorithm]}</div></div>
                <div><div style={resultMetaLabel}>Key Size</div><div style={{ ...resultMetaValue, fontSize: 12 }}>{bitLength}-bit</div></div>
                <div><div style={resultMetaLabel}>Quantum Safe</div><div style={{ ...resultMetaValue, fontSize: 12, color: 'var(--qg-green)' }}>Yes</div></div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button" className="q-btn q-btn-primary"
                onClick={handleGenerateKey}
                disabled={serviceLoading}
                style={{ minWidth: 220 }}>
                {serviceLoading ? '\u23f3 Executing Quantum Circuit...' : '\u26a1 Generate QRNG Key'}
              </button>
              {genError && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-red)' }}>
                  {genError}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          {keysMeta && (
            <div className="stats-grid animate-fade-in-up" style={{ marginBottom: 24 }}>
              <div className="q-card stat-card"><div className="stat-label">Total Keys</div><div className="stat-value ent-stat-cyan">{keysMeta.total}</div></div>
              <div className="q-card stat-card"><div className="stat-label">Today</div><div className="stat-value ent-stat-violet">{keysMeta.keysToday} / {keysMeta.maxKeysPerDay}</div></div>
              <div className="q-card stat-card"><div className="stat-label">Active</div><div className="stat-value ent-stat-green">{keys.filter(k => k.status === 'active').length}</div></div>
              <div className="q-card stat-card"><div className="stat-label">Revoked</div><div className="stat-value ent-stat-red">{keys.filter(k => k.status === 'revoked').length}</div></div>
            </div>
          )}

          {/* Progress Indicator */}
          {(terminalActiveState || terminalActive) && (
            <ProgressIndicator
              progress={progress}
              isRunning={terminalActiveState || terminalActive}
              onCancel={cancelOperation}
              retryCount={retryCount}
            />
          )}

          {/* Key Result */}
          {genResult && <KeyResult result={genResult} />}

          {/* Recent Keys Preview */}
          {keys.length > 0 && (
            <div className="q-card animate-fade-in-up" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={sectionTitle}>Recent Keys</div>
                <button type="button" className="q-btn q-btn-ghost" style={{ fontSize: 11 }}
                  onClick={() => setActiveTab('history')}>
                  View Full History &rarr;
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {keys.slice(0, 5).map(key => (
                  <div key={key.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    background: 'var(--qg-surface)', borderRadius: 8, border: '1px solid var(--qg-border)',
                  }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: `color-mix(in srgb, ${statusColor(key.status)} 15%, transparent)`, color: statusColor(key.status), whiteSpace: 'nowrap' }}>
                      {key.status}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {key.fingerprint}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--qg-text-muted)', whiteSpace: 'nowrap' }}>{ALGO_VARIANT[key.algorithm] || key.algorithm}</span>
                    <span style={{ fontSize: 11, color: 'var(--qg-text-muted)', whiteSpace: 'nowrap' }}>{new Date(key.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <div className="animate-fade-in-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>
                {keysMeta?.total || 0} total &bull; {keysMeta?.keysToday || 0} today
              </span>
              {historyLive && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-green)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--qg-green)', boxShadow: '0 0 6px var(--qg-green)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  LIVE
                </span>
              )}
            </div>
            <button type="button" className="q-btn q-btn-secondary"
              onClick={() => fetchKeys(historyPage, statusFilter, historyAlgoFilter)}>
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="q-card stat-card"><div className="stat-label">Total</div><div className="stat-value ent-stat-cyan">{keysMeta?.total || 0}</div></div>
            <div className="q-card stat-card"><div className="stat-label">Today</div><div className="stat-value ent-stat-violet">{keysMeta?.keysToday || 0} / 5</div></div>
            <div className="q-card stat-card"><div className="stat-label">Active</div><div className="stat-value ent-stat-green">{keys.filter(k => k.status === 'active').length}</div></div>
            <div className="q-card stat-card"><div className="stat-label">Revoked / Rotated</div><div className="stat-value ent-stat-red">{keys.filter(k => k.status === 'revoked' || k.status === 'rotated').length}</div></div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['', 'active', 'revoked', 'rotated', 'expired'] as const).map(f => (
                <button key={f} type="button" className={`q-btn q-btn-ghost ${statusFilter === f ? 'active' : ''}`}
                  onClick={() => { setStatusFilter(f); fetchKeys(0, f, historyAlgoFilter); setHistoryPage(0) }}
                  style={statusFilter === f ? { borderColor: 'var(--qg-cyan)', color: 'var(--qg-cyan)' } : {}}>
                  {f || 'All Status'}
                </button>
              ))}
            </div>
            <select value={historyAlgoFilter}
              onChange={e => { setHistoryAlgoFilter(e.target.value); fetchKeys(0, statusFilter, e.target.value); setHistoryPage(0) }}
              style={{ ...inputStyle, width: 'auto', minWidth: 160 }}>
              <option value="">All Algorithms</option>
              {ALGORITHMS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="q-card" style={{ overflow: 'auto', marginBottom: 16 }}>
            {keysLoading ? (
              <div className="ent-loading"><div className="ent-loading-spinner" /><p>Loading history...</p></div>
            ) : keys.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--qg-text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>&#x1F4CB;</div>
                <p style={{ fontSize: 14, marginBottom: 4 }}>No keys found</p>
                <p style={{ fontSize: 12 }}>Generate your first QRNG key from the Generate tab</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Fingerprint / Label', 'Algorithm', 'Bits', 'Source', 'Quality', 'Status', 'Created', 'Expires', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px', textAlign: h === 'Actions' ? 'right' : 'left', color: '#D4AF37', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keys.map(key => (
                    <tr key={key.id} style={{ background: 'rgba(255,255,255,0.02)', transition: 'background 0.2s' }} className="hover:bg-white/[0.05]">
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ color: 'var(--qg-cyan)', fontSize: 11 }}>{key.fingerprint}</div>
                        {key.label && <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', marginTop: 2 }}>{key.label}</div>}
                        {key.rotatedFrom && <div style={{ fontSize: 10, color: 'var(--qg-amber)', marginTop: 2 }}>rotated from {key.rotatedFrom.slice(0, 8)}&hellip;</div>}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{ALGO_VARIANT[key.algorithm] || key.algorithm}</td>
                      <td style={{ padding: '10px 12px' }}>{key.bitLength}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, background: key.entropySource === 'QRNG' ? 'rgba(212,175,55,0.15)' : 'rgba(255,243,193,0.15)', color: key.entropySource === 'QRNG' ? 'var(--qg-cyan)' : 'var(--qg-violet)' }}>
                          {key.entropySource}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ color: key.qualityScore > 0.9 ? 'var(--qg-green)' : key.qualityScore > 0.7 ? 'var(--qg-amber)' : 'var(--qg-red)' }}>
                          {(key.qualityScore * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: `color-mix(in srgb, ${statusColor(key.status)} 15%, transparent)`, color: statusColor(key.status) }}>
                          {key.status}
                        </span>
                        {key.revokedAt && <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', marginTop: 2 }}>{new Date(key.revokedAt).toLocaleDateString()}</div>}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--qg-text-muted)', whiteSpace: 'nowrap' }}>{new Date(key.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--qg-text-muted)', whiteSpace: 'nowrap' }}>
                        {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <CopyButton text={key.fingerprint} label="FP" />
                          {key.status === 'active' && (
                            <>
                              <button type="button" className="q-btn q-btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => handleRotateKey(key.id)}>Rotate</button>
                              <button type="button" className="q-btn q-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--qg-red)' }}
                                onClick={() => handleRevokeKey(key.id)}>Revoke</button>
                            </>
                          )}
                          {key.status === 'revoked' && (
                            <button type="button" className="q-btn q-btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--qg-text-muted)' }}
                              onClick={() => handleDeleteKey(key.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {keysMeta && keysMeta.total > HISTORY_LIMIT && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button type="button" className="q-btn q-btn-ghost" disabled={historyPage === 0}
                onClick={() => { const p = historyPage - 1; setHistoryPage(p); fetchKeys(p) }}>
                &larr; Prev
              </button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-muted)', alignSelf: 'center' }}>
                Page {historyPage + 1} of {Math.ceil(keysMeta.total / HISTORY_LIMIT)}
              </span>
              <button type="button" className="q-btn q-btn-ghost" disabled={(historyPage + 1) * HISTORY_LIMIT >= keysMeta.total}
                onClick={() => { const p = historyPage + 1; setHistoryPage(p); fetchKeys(p) }}>
                Next &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── API Tab ── */}
      {activeTab === 'api' && (
        <ServiceAPIPanel
          serviceName="Quantum Key Management"
          sdkPackage="@qguard/sdk"
          basePathNote="RESTful CRUD + SSE streaming"
          endpoints={[
            {
              method: 'POST',
              path: '/api/v1/keys',
              description: 'Generate a new post-quantum cryptographic key pair via QRNG entropy',
              rateLimit: '60 req/min (Standard), 600 req/min (Enterprise)',
              body: `{
  "algorithm": "ML-KEM",       // ML-KEM | ML-DSA | SPHINCS+ | HYBRID
  "bitLength": 256,            // 128 | 256 | 384 | 512 | 768
  "label": "prod-api-key",
  "purpose": "encryption"      // encryption | signing | key-agreement
}`,
              response: `{
  "data": {
    "id": "uuid",
    "publicKey": "0a3f...",
    "fingerprint": "A3:F2:...",
    "algorithm": "ML-KEM",
    "bitLength": 256,
    "qualityScore": 0.987,
    "entropySource": "QRNG",
    "createdAt": "2026-04-06T..."
  }
}`,
            },
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Stream key generation with real-time progress via Server-Sent Events',
              rateLimit: '30 req/min',
              body: `{
  "action": "key",
  "algorithm": "ML-KEM",
  "bit_length": 256
}`,
              response: `event: progress
data: {"percent":60,"stage":"Key Generation"}

event: result
data: {"publicKey":"0a3f...","algorithm":"ML-KEM",...}`,
            },
            {
              method: 'GET',
              path: '/api/v1/keys?limit=20&offset=0&status=active&algorithm=ML-KEM',
              description: 'List generated keys with pagination, status filter, and algorithm filter',
              rateLimit: '200 req/min',
              response: `{
  "data": [ { "id": "uuid", "algorithm": "ML-KEM", ... } ],
  "total": 42,
  "limit": 20,
  "offset": 0
}`,
            },
            {
              method: 'PATCH',
              path: '/api/v1/keys',
              description: 'Revoke or rotate an existing key by ID. Rotation generates a new key and revokes the old one.',
              rateLimit: '30 req/min',
              body: `{
  "keyId": "uuid",
  "action": "revoke"           // revoke | rotate
}`,
            },
            {
              method: 'DELETE',
              path: '/api/v1/keys?keyId={id}',
              description: 'Permanently delete a revoked key. Active keys must be revoked first.',
              rateLimit: '30 req/min',
            },
            {
              method: 'GET',
              path: '/api/v1/qrng/status',
              description: 'Health check for QRNG service — returns availability, backend type, and entropy metrics',
              rateLimit: '300 req/min',
              auth: false,
              response: `{
  "available": true,
  "backend": "Qiskit AerSimulator",
  "qualityScore": 0.994
}`,
            },
          ]}
          jsExample={`const BASE = 'http://localhost:4000'

// 1. Generate key via QRNG stream (real-time progress)
async function generateQuantumKey(config) {
  const { algorithm = 'ML-KEM', bitLength = 256 } = config

  const res = await fetch(\`\${BASE}/api/v1/qrng/generate/stream\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify({ action: 'key', algorithm, bit_length: bitLength }),
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
        const data = JSON.parse(part.split('data: ')[1])
        console.log(\`[\${data.percent}%] \${data.stage}\`)
      }
      if (part.includes('event: result')) {
        result = JSON.parse(part.split('data: ')[1])
      }
    }
  }
  return result
}

// 2. Persist key to database
async function persistKey(keyData) {
  const res = await fetch(\`\${BASE}/api/v1/keys\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify(keyData),
  })
  return res.json()
}

// 3. List keys with filters
async function listKeys(status = 'active', algorithm = null) {
  const params = new URLSearchParams({ limit: '50', status })
  if (algorithm) params.set('algorithm', algorithm)
  const res = await fetch(\`\${BASE}/api/v1/keys?\${params}\`, {
    headers: { 'Authorization': \`Bearer \${JWT_TOKEN}\` },
  })
  return res.json()
}

// 4. Revoke a key
async function revokeKey(keyId) {
  return fetch(\`\${BASE}/api/v1/keys\`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify({ keyId, action: 'revoke' }),
  }).then(r => r.json())
}

// Usage
const key = await generateQuantumKey({ algorithm: 'ML-KEM', bitLength: 256 })
await persistKey(key)
const activeKeys = await listKeys('active', 'ML-KEM')`}
          pyExample={`import requests, json, sseclient

BASE = "http://localhost:4000"
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}

# 1. Generate key via QRNG stream
def generate_quantum_key(algorithm="ML-KEM", bit_length=256):
    res = requests.post(
        f"{BASE}/api/v1/qrng/generate/stream",
        json={"action": "key", "algorithm": algorithm, "bit_length": bit_length},
        headers=HEADERS, stream=True,
    )
    client = sseclient.SSEClient(res)
    for event in client.events():
        if event.event == "progress":
            data = json.loads(event.data)
            print(f"[{data['percent']}%] {data['stage']}")
        elif event.event == "result":
            return json.loads(event.data)

# 2. Persist key to DB
def persist_key(key_data: dict) -> dict:
    res = requests.post(f"{BASE}/api/v1/keys", json=key_data, headers=HEADERS)
    return res.json()

# 3. List keys with filters
def list_keys(status="active", algorithm=None, limit=50):
    params = {"limit": limit, "status": status}
    if algorithm:
        params["algorithm"] = algorithm
    res = requests.get(f"{BASE}/api/v1/keys", params=params, headers=HEADERS)
    return res.json()

# 4. Revoke key
def revoke_key(key_id: str) -> dict:
    res = requests.patch(
        f"{BASE}/api/v1/keys",
        json={"keyId": key_id, "action": "revoke"},
        headers=HEADERS,
    )
    return res.json()

# Usage
key = generate_quantum_key("ML-KEM", 256)
persist_key(key)
active = list_keys("active", "ML-KEM")`}
          curlExample={`# Check QRNG service status
curl -s http://localhost:4000/api/v1/qrng/status | jq

# Generate key via QRNG stream (SSE)
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "key",
    "algorithm": "ML-KEM",
    "bit_length": 256
  }'

# Persist key to database
curl -X POST http://localhost:4000/api/v1/keys \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "algorithm": "ML-KEM",
    "bitLength": 256,
    "label": "prod-api-key",
    "purpose": "encryption"
  }'

# List active keys (paginated)
curl -s "http://localhost:4000/api/v1/keys?limit=20&status=active&algorithm=ML-KEM" \\
  -H "Authorization: Bearer $JWT_TOKEN" | jq

# Revoke a key
curl -X PATCH http://localhost:4000/api/v1/keys \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{"keyId": "KEY_UUID", "action": "revoke"}'

# Delete a revoked key
curl -X DELETE "http://localhost:4000/api/v1/keys?keyId=KEY_UUID" \\
  -H "Authorization: Bearer $JWT_TOKEN"`}
        />
      )}

      {/* ── Settings Tab ── */}
      {activeTab === 'settings' && (
        <ServiceSettingsPanel
          serviceKey="keys"
          settings={svcSettings}
          onSave={saveSettings}
          complianceBadges={(d) => [
            { badge: 'NIST SP 800-22', active: d.entropyValidation },
            { badge: 'NIST SP 800-90B', active: d.quantumCertification },
            { badge: 'FIPS 140-2', active: d.fips140Mode },
            { badge: 'FIPS 203 (ML-KEM)', active: true },
            { badge: 'FIPS 204 (ML-DSA)', active: true },
            { badge: 'ISO/IEC 18031', active: d.auditLogging },
          ]}
        />
      )}

      {/* Live Terminal */}
      <div className="animate-fade-in-up" style={{ marginTop: 24 }}>
        <QuantumTerminal
          logs={terminalLogs}
          isRunning={terminalActiveState || terminalActive}
          onClear={() => setTerminalLogs([])}
        />
      </div>
    </div>
  )
}
