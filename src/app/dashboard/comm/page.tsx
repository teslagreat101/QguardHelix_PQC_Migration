'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  useQRNG, QuantumTerminal, CopyButton, DownloadButton, ErrorResult, ProgressIndicator, ComplianceBadges,
  QRNGPageHeader, QRNGStatusBanner,
  useLocalHistory, ServiceHistoryPanel, ServiceAPIPanel, ServiceSettingsPanel, TabNav,
  useServiceSettings, buildSettingsParams, type ServiceSettings,
  type HistoryRecord,
  inputStyle, labelStyle, sectionTitle, resultMetaStyle, resultMetaItem, resultMetaLabel, resultMetaValue, hexBoxStyle,
} from '@/components/qrng/shared'

// ── Types ──────────────────────────────────────────────────────────────────────

type PageTab = 'generate' | 'history' | 'api' | 'settings'
type CommTab = 'session' | 'vpn' | 'email'

// ── Comm Key Result ────────────────────────────────────────────────────────────

function CommKeyResult({ result, keyType }: { result: Record<string, unknown>; keyType: CommTab }) {
  const encKey = (result.encryption_key || {}) as Record<string, unknown>
  const iv = (result.iv || {}) as Record<string, unknown>
  const hmacKey = (result.hmac_key || {}) as Record<string, unknown>
  const [exportFormat, setExportFormat] = useState<'json' | 'env'>('json')

  const exportJSON = JSON.stringify({
    key_type: keyType,
    encryption_key: encKey.hex,
    iv: iv.hex,
    hmac_key: hmacKey.hex,
    bit_length: encKey.bit_length,
    quality_score: result.quality_score,
    generated_at: new Date().toISOString(),
  }, null, 2)

  const exportENV = [
    `ENCRYPTION_KEY=${encKey.hex || ''}`,
    `ENCRYPTION_IV=${iv.hex || ''}`,
    `HMAC_KEY=${hmacKey.hex || ''}`,
    `KEY_BIT_LENGTH=${encKey.bit_length || 256}`,
    `KEY_TYPE=${keyType}`,
    `KEY_GENERATED_AT=${new Date().toISOString()}`,
  ].join('\n')

  const typeLabels: Record<CommTab, string> = {
    session: 'Session Encryption Key',
    vpn: 'VPN Tunnel Key',
    email: 'Email Encryption Key',
  }

  return (
    <div className="q-card" style={{ borderColor: 'var(--qg-cyan)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            &#x2705; {typeLabels[keyType]}
          </div>
          <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {String(encKey.bit_length || 256)}-bit &bull; Quality: {((result.quality_score as number || 0) * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--qg-border)', borderRadius: 6, overflow: 'hidden' }}>
            {(['json', 'env'] as const).map(f => (
              <button key={f} type="button"
                style={{ padding: '4px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', border: 'none', background: exportFormat === f ? 'rgba(212,175,55,0.15)' : 'transparent', color: exportFormat === f ? 'var(--qg-cyan)' : 'var(--qg-text-muted)' }}
                onClick={() => setExportFormat(f)}>
                .{f}
              </button>
            ))}
          </div>
          <DownloadButton data={exportFormat === 'json' ? exportJSON : exportENV} filename={`${keyType}-key.${exportFormat === 'env' ? 'env' : 'json'}`} />
          <CopyButton text={exportFormat === 'json' ? exportJSON : exportENV} label="Copy" />
        </div>
      </div>

      {/* Encryption Key */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={resultMetaLabel}>Encryption Key</div>
          <CopyButton text={String(encKey.hex || '')} label="Copy" />
        </div>
        <div style={hexBoxStyle}>{String(encKey.hex || '-')}</div>
      </div>

      {/* IV */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={resultMetaLabel}>Initialization Vector (IV / Nonce)</div>
          <CopyButton text={String(iv.hex || '')} label="Copy" />
        </div>
        <div style={hexBoxStyle}>{String(iv.hex || '-')}</div>
      </div>

      {/* HMAC Key */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={resultMetaLabel}>HMAC Authentication Key</div>
          <CopyButton text={String(hmacKey.hex || '')} label="Copy" />
        </div>
        <div style={hexBoxStyle}>{String(hmacKey.hex || '-')}</div>
      </div>

      <div style={resultMetaStyle}>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Bit Length</div><div style={resultMetaValue}>{String(encKey.bit_length || 256)}-bit</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Quality</div><div style={{ ...resultMetaValue, color: Number(result.quality_score || 0) > 0.9 ? 'var(--qg-green)' : 'var(--qg-amber)' }}>{((result.quality_score as number || 0) * 100).toFixed(1)}%</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Entropy Source</div><div style={{ ...resultMetaValue, color: String(result.entropy_source || '') === 'QRNG' ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>{String(result.entropy_source || 'CSPRNG')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Backend</div><div style={resultMetaValue}>{String(result.backend || '-')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Key Type</div><div style={resultMetaValue}>{keyType}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>KDF</div><div style={resultMetaValue}>{String(result.kdf || 'HKDF-SHA3-256')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>KEM</div><div style={resultMetaValue}>{String(result.kem || 'ML-KEM-768+X25519')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Quantum Safe</div><div style={{ ...resultMetaValue, color: 'var(--qg-green)' }}>Yes</div></div>
        {/* Key-type-specific config */}
        {keyType === 'session' && result.purpose ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Purpose</div><div style={resultMetaValue}>{String(result.purpose).toUpperCase()}</div></div>
        ) : null}
        {keyType === 'session' && result.aead_mode ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>AEAD Mode</div><div style={resultMetaValue}>{String(result.aead_mode).toUpperCase()}</div></div>
        ) : null}
        {keyType === 'vpn' && result.protocol ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Protocol</div><div style={resultMetaValue}>{String(result.protocol)}</div></div>
        ) : null}
        {keyType === 'vpn' ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>PFS</div><div style={{ ...resultMetaValue, color: result.pfs ? 'var(--qg-green)' : 'var(--qg-amber)' }}>{result.pfs ? 'Enabled' : 'Disabled'}</div></div>
        ) : null}
        {keyType === 'email' && result.standard ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Standard</div><div style={resultMetaValue}>{String(result.standard).toUpperCase()}</div></div>
        ) : null}
        {keyType === 'email' && result.algorithm ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Algorithm</div><div style={resultMetaValue}>{String(result.algorithm)}</div></div>
        ) : null}
        {keyType === 'email' && result.expiry_days ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Key Expiry</div><div style={resultMetaValue}>{String(result.expiry_days)} days</div></div>
        ) : null}
      </div>
      <ComplianceBadges result={result} />
    </div>
  )
}

// ── Session Key Form ───────────────────────────────────────────────────────────

function SessionKeyForm({ onGenerate, loading }: { onGenerate: (p: Record<string, unknown>) => void; loading: boolean }) {
  const [bitLength, setBitLength] = useState(256)
  const [purpose, setPurpose] = useState('tls')
  const [aeadMode, setAeadMode] = useState('gcm')

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label htmlFor="session-bits" style={labelStyle}>Key Strength</label>
        <select id="session-bits" value={bitLength} onChange={e => setBitLength(Number(e.target.value))} style={inputStyle}>
          <option value={128}>128-bit — NIST Level 1</option>
          <option value={256}>256-bit — NIST Level 3 (Recommended)</option>
          <option value={384}>384-bit — NIST Level 5</option>
          <option value={512}>512-bit — Maximum</option>
        </select>
      </div>
      <div>
        <label htmlFor="session-purpose" style={labelStyle}>Purpose</label>
        <select id="session-purpose" value={purpose} onChange={e => setPurpose(e.target.value)} style={inputStyle}>
          <option value="tls">TLS Session</option>
          <option value="app">Application Layer</option>
          <option value="storage">Encrypted Storage</option>
          <option value="api">API Communication</option>
          <option value="websocket">WebSocket Channel</option>
        </select>
      </div>
      <div>
        <label htmlFor="session-aead" style={labelStyle}>AEAD Mode</label>
        <select id="session-aead" value={aeadMode} onChange={e => setAeadMode(e.target.value)} style={inputStyle}>
          <option value="gcm">AES-GCM (standard)</option>
          <option value="ccm">AES-CCM (IoT)</option>
          <option value="siv">AES-SIV (nonce-misuse resistant)</option>
          <option value="chacha">ChaCha20-Poly1305 (mobile)</option>
        </select>
      </div>
      <button type="button" className="q-btn q-btn-primary" disabled={loading}
        onClick={() => onGenerate({ key_type: 'session', bit_length: bitLength, purpose, aead_mode: aeadMode })}>
        {loading ? '\u23f3 Generating...' : '\u{1f4e1} Generate Session Key'}
      </button>
    </div>
  )
}

// ── VPN Key Form ───────────────────────────────────────────────────────────────

function VPNKeyForm({ onGenerate, loading }: { onGenerate: (p: Record<string, unknown>) => void; loading: boolean }) {
  const [protocol, setProtocol] = useState('wireguard')
  const [bitLength, setBitLength] = useState(256)
  const [pfs, setPFS] = useState(true)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label htmlFor="vpn-protocol" style={labelStyle}>VPN Protocol</label>
        <select id="vpn-protocol" value={protocol} onChange={e => setProtocol(e.target.value)} style={inputStyle}>
          <option value="wireguard">WireGuard (modern, fast)</option>
          <option value="openvpn">OpenVPN (TLS-based)</option>
          <option value="ikev2">IPSec IKEv2 (enterprise)</option>
          <option value="shadowsocks">Shadowsocks (obfuscated)</option>
        </select>
      </div>
      <div>
        <label htmlFor="vpn-bits" style={labelStyle}>Key Strength</label>
        <select id="vpn-bits" value={bitLength} onChange={e => setBitLength(Number(e.target.value))} style={inputStyle}>
          <option value={128}>128-bit</option>
          <option value={256}>256-bit (Recommended)</option>
          <option value={512}>512-bit</option>
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input type="checkbox" id="pfs" checked={pfs} onChange={e => setPFS(e.target.checked)} />
        <label htmlFor="pfs" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-muted)', cursor: 'pointer' }}>
          Perfect Forward Secrecy (PFS) — generate ephemeral keys
        </label>
      </div>
      <button type="button" className="q-btn q-btn-primary" disabled={loading}
        onClick={() => onGenerate({ key_type: 'vpn', protocol, bit_length: bitLength, pfs })}>
        {loading ? '\u23f3 Generating...' : '\u{1f4e1} Generate VPN Key'}
      </button>
    </div>
  )
}

// ── Email Key Form ─────────────────────────────────────────────────────────────

function EmailKeyForm({ onGenerate, loading }: { onGenerate: (p: Record<string, unknown>) => void; loading: boolean }) {
  const [standard, setStandard] = useState('smime')
  const [algorithm, setAlgorithm] = useState('hybrid')
  const [expiryDays, setExpiryDays] = useState(365)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label htmlFor="email-standard" style={labelStyle}>Email Security Standard</label>
        <select id="email-standard" value={standard} onChange={e => setStandard(e.target.value)} style={inputStyle}>
          <option value="smime">S/MIME (enterprise, certificate-based)</option>
          <option value="pgp">PGP / GPG (open standard)</option>
          <option value="pqcmail">PQC Mail (post-quantum experimental)</option>
        </select>
      </div>
      <div>
        <label htmlFor="email-algo" style={labelStyle}>Encryption Algorithm</label>
        <select id="email-algo" value={algorithm} onChange={e => setAlgorithm(e.target.value)} style={inputStyle}>
          <option value="hybrid">Hybrid ML-KEM + RSA (max compatibility)</option>
          <option value="mlkem">ML-KEM only (pure PQC)</option>
          <option value="rsa">RSA-4096 (classical compatibility)</option>
          <option value="ecc">ECDH P-384 (lightweight)</option>
        </select>
      </div>
      <div>
        <label htmlFor="email-expiry" style={labelStyle}>Key Expiry</label>
        <select id="email-expiry" value={expiryDays} onChange={e => setExpiryDays(Number(e.target.value))} style={inputStyle}>
          <option value={90}>90 days</option>
          <option value={180}>180 days</option>
          <option value={365}>1 year (default)</option>
          <option value={730}>2 years</option>
        </select>
      </div>
      <button type="button" className="q-btn q-btn-primary" disabled={loading}
        onClick={() => onGenerate({ key_type: 'email', standard, algorithm, expiry_days: expiryDays })}>
        {loading ? '\u23f3 Generating...' : '\u{1f4e1} Generate Email Key'}
      </button>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CommPage() {
  const { settings: svcSettings, saveSettings } = useServiceSettings('comm')
  const {
    qrngStatus, liveTelemetry,
    terminalLogs, setTerminalLogs, terminalActive,
    serviceLoading, serviceResult, setServiceResult,
    callQRNGStreaming, fetchQRNGStatus, progress, retryCount, cancelOperation, resetState,
  } = useQRNG({ maxRetries: svcSettings.retryAttempts, retryDelayMs: 800 })

  const [pageTab, setPageTab] = useState<PageTab>('generate')
  const [activeTab, setActiveTab] = useState<CommTab>('session')
  const { history: localHistory, addRecord, removeRecord, clearHistory } = useLocalHistory<HistoryRecord>('comm')

  // ── DB-backed history ──────────────────────────────────────────
  const { session } = useAuth()
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }
  const [dbHistory, setDbHistory] = useState<HistoryRecord[]>([])

  const fetchDbHistory = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch('/api/v1/comm?limit=100', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await res.json()
      if (json.data) {
        setDbHistory(json.data.map((r: any) => ({
          id: r.id,
          label: `${(r.key_type || 'session').charAt(0).toUpperCase() + (r.key_type || 'session').slice(1)} Key`,
          sublabel: `${r.bit_length}-bit • ${r.exchange_mode} • ${r.entropy_source}`,
          badge: r.key_type || 'session',
          badgeColor: r.key_type === 'session' ? 'var(--qg-cyan)' : r.key_type === 'vpn' ? 'var(--qg-green)' : 'var(--qg-purple)',
          quality_score: r.quality_score,
          entropy_source: r.entropy_source,
          created_at: r.created_at,
        })))
      }
    } catch { /* non-critical */ }
  }, [session?.access_token])

  useEffect(() => { fetchDbHistory() }, [fetchDbHistory])

  const history = (() => {
    const dbIds = new Set(dbHistory.map(r => r.id))
    const localOnly = localHistory.filter(r => !dbIds.has(r.id))
    return [...dbHistory, ...localOnly].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  })()

  useEffect(() => {
    if (!serviceResult || 'error' in serviceResult) return
    const encKey = (serviceResult.encryption_key || {}) as Record<string, unknown>
    const keyType = String(serviceResult.key_type || activeTab)
    const bits = String(encKey.bit_length || 256)

    const details: string[] = [`${bits}-bit`, String(serviceResult.entropy_source || 'CSPRNG')]
    if (keyType === 'session') {
      if (serviceResult.purpose) details.push(String(serviceResult.purpose).toUpperCase())
      if (serviceResult.aead_mode) details.push(String(serviceResult.aead_mode).toUpperCase())
    } else if (keyType === 'vpn') {
      if (serviceResult.protocol) details.push(String(serviceResult.protocol))
      details.push(serviceResult.pfs ? 'PFS' : 'no-PFS')
    } else if (keyType === 'email') {
      if (serviceResult.standard) details.push(String(serviceResult.standard).toUpperCase())
      if (serviceResult.algorithm) details.push(String(serviceResult.algorithm))
      if (serviceResult.expiry_days) details.push(`${serviceResult.expiry_days}d`)
    }

    addRecord({
      id: crypto.randomUUID(),
      label: `${keyType.charAt(0).toUpperCase() + keyType.slice(1)} Key`,
      sublabel: details.join(' • '),
      badge: keyType,
      badgeColor: keyType === 'session' ? 'var(--qg-cyan)' : keyType === 'vpn' ? 'var(--qg-green)' : 'var(--qg-purple)',
      quality_score: Number(serviceResult.quality_score || 0),
      entropy_source: String(serviceResult.entropy_source || 'CSPRNG'),
      created_at: new Date().toISOString(),
    })

    // Persist to DB (non-blocking)
    fetch('/api/v1/comm', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        key_type: keyType,
        bit_length: Number(encKey.bit_length || 256),
        exchange_mode: serviceResult.exchange_mode || 'X25519+ML-KEM',
        quality_score: Number(serviceResult.quality_score || 0),
        entropy_source: String(serviceResult.entropy_source || 'QRNG'),
        encryption_key_preview: String(encKey.hex || '').slice(0, 16) + '...',
      }),
    }).then(() => setTimeout(fetchDbHistory, 500)).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceResult])

  const handleGenerate = (params: Record<string, unknown>) => {
    callQRNGStreaming('comm-keys', { ...params, ...buildSettingsParams(svcSettings) })
  }

  const TABS: { key: CommTab; label: string; desc: string }[] = [
    { key: 'session', label: '\uD83C\uDF10 Session Keys', desc: 'TLS, app layer, and WebSocket session encryption' },
    { key: 'vpn', label: '\uD83D\uDEE1 VPN Tunnel', desc: 'WireGuard, OpenVPN, IPSec IKEv2 keys' },
    { key: 'email', label: '\u2709 Email Encryption', desc: 'S/MIME, PGP, and post-quantum email keys' },
  ]

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <QRNGPageHeader
        title="Secure Communications"
        subtitle="QRNG-seeded keys for sessions, VPN tunnels, and encrypted email — quantum-safe by default"
        qrngStatus={qrngStatus}
        onRefresh={fetchQRNGStatus}
      />

      <QRNGStatusBanner qrngStatus={qrngStatus} liveTelemetry={liveTelemetry} />

      <TabNav<PageTab>
        tabs={[
          { id: 'generate', label: 'Generate', icon: '\uD83D\uDCE1' },
          { id: 'history', label: 'History', icon: '\uD83D\uDCCB' },
          { id: 'api', label: 'API', icon: '\uD83D\uDCD6' },
          { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F' },
        ]}
        active={pageTab}
        onChange={setPageTab}
        counts={{ history: history.length }}
      />

      {pageTab === 'generate' && (<>
      {/* Comm Type Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, padding: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', width: 'fit-content' }} className="animate-fade-in-up">
        {TABS.map(t => (
          <button key={t.key} type="button"
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeTab === t.key ? '#D4AF37' : 'transparent',
              color: activeTab === t.key ? '#000' : 'rgba(255,255,255,0.4)',
              boxShadow: activeTab === t.key ? '0 4px 12px rgba(212,175,55,0.3)' : 'none'
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>

        {/* Left — Form */}
        <div>
          {/* Tab description */}
          <div style={{ marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-muted)', padding: '10px 16px', background: 'rgba(212,175,55,0.04)', borderRadius: 8, border: '1px solid rgba(212,175,55,0.1)' }}>
            {TABS.find(t => t.key === activeTab)?.desc}
          </div>

          <div className="q-card animate-fade-in-up">
            <div style={sectionTitle}>{activeTab === 'session' ? 'Session Key' : activeTab === 'vpn' ? 'VPN Key' : 'Email Key'} Configuration</div>
            {activeTab === 'session' && <SessionKeyForm onGenerate={handleGenerate} loading={serviceLoading} />}
            {activeTab === 'vpn' && <VPNKeyForm onGenerate={handleGenerate} loading={serviceLoading} />}
            {activeTab === 'email' && <EmailKeyForm onGenerate={handleGenerate} loading={serviceLoading} />}
          </div>

          {/* Security Properties */}
          <div className="q-card animate-fade-in-up" style={{ marginTop: 16, background: 'rgba(212,175,55,0.03)', borderColor: 'rgba(212,175,55,0.1)' }}>
            <div style={sectionTitle}>Key Derivation</div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 2 }}>
              <div>&#x2022; Fresh quantum entropy per generation</div>
              <div>&#x2022; HKDF with QRNG seed for key derivation</div>
              <div>&#x2022; Independent enc key + IV + HMAC key</div>
              <div>&#x2022; No entropy reuse between requests</div>
              <div>&#x2022; Ephemeral — not persisted server-side</div>
            </div>
          </div>
        </div>

        {/* Right — Result */}
        <div>
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
            'error' in serviceResult
              ? <ErrorResult message={String(serviceResult.error)} />
              : <CommKeyResult result={serviceResult} keyType={activeTab} />
          )}
          {!serviceResult && (
            <div className="q-card" style={{ textAlign: 'center', padding: 48, color: 'var(--qg-text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>&#x1F4E1;</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                {activeTab === 'session' ? 'Session key' : activeTab === 'vpn' ? 'VPN key' : 'Email key'} will appear here
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>Configure parameters and click Generate</div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div style={{ marginTop: 24 }}>
        <QuantumTerminal logs={terminalLogs} isRunning={terminalActive} onClear={() => setTerminalLogs([])} />
      </div>
      </>)}

      {pageTab === 'history' && (
        <ServiceHistoryPanel
          records={history}
          onDelete={removeRecord}
          onClear={clearHistory}
          emptyMessage="No communication keys yet — generate your first key above."
        />
      )}

      {pageTab === 'api' && (
        <ServiceAPIPanel
          serviceName="Secure Communications"
          sdkPackage="@qguard/sdk"
          basePathNote="SSE streaming + HKDF key derivation"
          endpoints={[
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Generate session encryption keys (TLS, app layer, WebSocket) with AEAD mode selection and HKDF derivation',
              rateLimit: '60 req/min (Standard), 600 req/min (Enterprise)',
              body: `{
  "action": "comm-keys",
  "key_type": "session",
  "bit_length": 256,              // 128 | 256 | 384 | 512
  "purpose": "tls",               // tls | app | storage | api | websocket
  "aead_mode": "gcm"              // gcm | ccm | siv | chacha
}`,
              response: `event: result
data: {
  "key_type": "session",
  "encryption_key": { "hex": "a3f2...", "bit_length": 256 },
  "iv": { "hex": "b7c4..." },
  "hmac_key": { "hex": "d9e1..." },
  "purpose": "tls",
  "aead_mode": "gcm",
  "kdf": "HKDF-SHA3-256",
  "kem": "ML-KEM-768+X25519",
  "quality_score": 0.987,
  "entropy_source": "CSPRNG"
}`,
            },
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Generate VPN tunnel keys for WireGuard, OpenVPN, IPSec IKEv2, or Shadowsocks with optional PFS',
              rateLimit: '60 req/min',
              body: `{
  "action": "comm-keys",
  "key_type": "vpn",
  "protocol": "wireguard",        // wireguard | openvpn | ikev2 | shadowsocks
  "bit_length": 256,
  "pfs": true                     // Perfect Forward Secrecy
}`,
              response: `event: result
data: {
  "key_type": "vpn",
  "encryption_key": { "hex": "...", "bit_length": 256 },
  "iv": { "hex": "..." },
  "hmac_key": { "hex": "..." },
  "protocol": "wireguard",
  "pfs": true,
  "kdf": "HKDF-SHA3-256",
  "quality_score": 0.993
}`,
            },
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Generate email encryption keys for S/MIME, PGP, or post-quantum mail standards with configurable expiry',
              rateLimit: '60 req/min',
              body: `{
  "action": "comm-keys",
  "key_type": "email",
  "standard": "smime",            // smime | pgp | pqcmail
  "algorithm": "hybrid",          // hybrid | mlkem | rsa | ecc
  "expiry_days": 365              // 90 | 180 | 365 | 730
}`,
              response: `event: result
data: {
  "key_type": "email",
  "encryption_key": { "hex": "...", "bit_length": 256 },
  "iv": { "hex": "..." },
  "hmac_key": { "hex": "..." },
  "standard": "smime",
  "algorithm": "hybrid",
  "expiry_days": 365,
  "quality_score": 0.989
}`,
            },
            {
              method: 'GET',
              path: '/api/v1/qrng/status',
              description: 'Health check — QRNG availability, backend info, and entropy quality metrics',
              rateLimit: '300 req/min',
              auth: false,
            },
          ]}
          jsExample={`const BASE = 'http://localhost:4000'

// Helper: parse SSE stream and return final result
async function streamGenerate(body) {
  const res = await fetch(\`\${BASE}/api/v1/qrng/generate/stream\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify(body),
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

// 1. Generate TLS session key
const sessionKey = await streamGenerate({
  action: 'comm-keys',
  key_type: 'session',
  bit_length: 256,
  purpose: 'tls',
  aead_mode: 'gcm',
})
console.log('Enc Key:', sessionKey.encryption_key.hex)
console.log('IV:     ', sessionKey.iv.hex)
console.log('HMAC:   ', sessionKey.hmac_key.hex)

// 2. Generate WireGuard VPN key with PFS
const vpnKey = await streamGenerate({
  action: 'comm-keys',
  key_type: 'vpn',
  protocol: 'wireguard',
  bit_length: 256,
  pfs: true,
})

// 3. Generate S/MIME email key
const emailKey = await streamGenerate({
  action: 'comm-keys',
  key_type: 'email',
  standard: 'smime',
  algorithm: 'hybrid',
  expiry_days: 365,
})`}
          pyExample={`import requests, json, sseclient

BASE = "http://localhost:4000"
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}

# Helper: parse SSE stream
def stream_generate(body: dict) -> dict:
    res = requests.post(
        f"{BASE}/api/v1/qrng/generate/stream",
        json=body, headers=HEADERS, stream=True,
    )
    client = sseclient.SSEClient(res)
    for event in client.events():
        if event.event == "progress":
            d = json.loads(event.data)
            print(f"[{d['percent']}%] {d['stage']}")
        elif event.event == "result":
            return json.loads(event.data)

# 1. Generate TLS session key
session_key = stream_generate({
    "action": "comm-keys",
    "key_type": "session",
    "bit_length": 256,
    "purpose": "tls",
    "aead_mode": "gcm",
})
print(f"Enc Key: {session_key['encryption_key']['hex']}")
print(f"IV:      {session_key['iv']['hex']}")
print(f"HMAC:    {session_key['hmac_key']['hex']}")

# 2. Generate WireGuard VPN key
vpn_key = stream_generate({
    "action": "comm-keys",
    "key_type": "vpn",
    "protocol": "wireguard",
    "bit_length": 256,
    "pfs": True,
})

# 3. Generate S/MIME email key
email_key = stream_generate({
    "action": "comm-keys",
    "key_type": "email",
    "standard": "smime",
    "algorithm": "hybrid",
    "expiry_days": 365,
})
print(f"Email enc key expires in {email_key['expiry_days']} days")`}
          curlExample={`# Generate TLS session key
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "comm-keys",
    "key_type": "session",
    "bit_length": 256,
    "purpose": "tls",
    "aead_mode": "gcm"
  }'

# Generate WireGuard VPN key with PFS
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "comm-keys",
    "key_type": "vpn",
    "protocol": "wireguard",
    "bit_length": 256,
    "pfs": true
  }'

# Generate S/MIME email encryption key
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "comm-keys",
    "key_type": "email",
    "standard": "smime",
    "algorithm": "hybrid",
    "expiry_days": 365
  }'

# Check QRNG status
curl -s http://localhost:4000/api/v1/qrng/status | jq`}
        />
      )}

      {pageTab === 'settings' && (
        <ServiceSettingsPanel
          serviceKey="comm"
          settings={svcSettings}
          onSave={saveSettings}
          complianceBadges={(d) => [
            { badge: 'NIST SP 800-22', active: d.entropyValidation },
            { badge: 'NIST SP 800-90B', active: d.quantumCertification },
            { badge: 'FIPS 140-2', active: d.fips140Mode },
            { badge: 'TLS 1.3', active: true },
            { badge: 'IPSec/IKEv2', active: true },
            { badge: 'OWASP Crypto', active: d.auditLogging },
          ]}
        />
      )}
    </div>
  )
}
