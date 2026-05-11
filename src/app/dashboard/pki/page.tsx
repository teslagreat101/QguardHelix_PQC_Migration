'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  useQRNG, QuantumTerminal, CopyButton, DownloadButton, ErrorResult,
  QRNGPageHeader, QRNGStatusBanner, ProgressIndicator, ComplianceBadges,
  useLocalHistory, ServiceHistoryPanel, ServiceAPIPanel, ServiceSettingsPanel, TabNav,
  useServiceSettings, buildSettingsParams, type ServiceSettings,
  type HistoryRecord,
  inputStyle, labelStyle, sectionTitle, resultMetaStyle, resultMetaItem, resultMetaLabel, resultMetaValue, hexBoxStyle,
} from '@/components/qrng/shared'

// ── Types ──────────────────────────────────────────────────────────────────────

type PageTab = 'generate' | 'history' | 'api' | 'settings'

interface SANEntry {
  id: string
  value: string
}

// ── PKI Result ─────────────────────────────────────────────────────────────────

function PKIResult({ result }: { result: Record<string, unknown> }) {
  const cert = (result.certificate || {}) as Record<string, unknown>
  const privKey = (result.private_key || {}) as Record<string, unknown>
  const [showPrivKey, setShowPrivKey] = useState(false)

  const certSANs = Array.isArray(cert.sans) ? (cert.sans as string[]) : []
  const certKeyUsage = Array.isArray(cert.key_usage) ? (cert.key_usage as string[]) : []
  const certExtKeyUsage = Array.isArray(cert.extended_key_usage) ? (cert.extended_key_usage as string[]) : []

  const exportJSON = JSON.stringify({
    certificate: cert,
    private_key: privKey,
    generated_at: new Date().toISOString(),
  }, null, 2)

  return (
    <div className="q-card" style={{ borderColor: 'var(--qg-cyan)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          &#x2705; PKI Certificate Generated
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <DownloadButton data={String(privKey.key_hex || '')} filename={`${String(cert.common_name || 'cert')}-private.key`} />
          <DownloadButton data={exportJSON} filename={`${String(cert.common_name || 'cert')}-full.json`} />
        </div>
      </div>

      {/* Certificate Details */}
      <div style={{ background: 'var(--qg-surface)', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid var(--qg-border)' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Subject Information
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <span style={{ color: 'var(--qg-text-muted)' }}>Common Name</span>
          <span style={{ color: 'var(--qg-text)' }}>{String(cert.common_name || '-')}</span>
          <span style={{ color: 'var(--qg-text-muted)' }}>Organization</span>
          <span style={{ color: 'var(--qg-text)' }}>{String(cert.organization || '-')}</span>
          {cert.organizational_unit != null && String(cert.organizational_unit) !== '' && <>
            <span style={{ color: 'var(--qg-text-muted)' }}>Org Unit</span>
            <span style={{ color: 'var(--qg-text)' }}>{String(cert.organizational_unit)}</span>
          </>}
          {cert.country != null && String(cert.country) !== '' && <>
            <span style={{ color: 'var(--qg-text-muted)' }}>Country</span>
            <span style={{ color: 'var(--qg-text)' }}>{String(cert.country)}</span>
          </>}
          {cert.state != null && String(cert.state) !== '' && <>
            <span style={{ color: 'var(--qg-text-muted)' }}>State</span>
            <span style={{ color: 'var(--qg-text)' }}>{String(cert.state)}</span>
          </>}
          {cert.city != null && String(cert.city) !== '' && <>
            <span style={{ color: 'var(--qg-text-muted)' }}>City</span>
            <span style={{ color: 'var(--qg-text)' }}>{String(cert.city)}</span>
          </>}
          <span style={{ color: 'var(--qg-text-muted)' }}>Serial Number</span>
          <span style={{ color: 'var(--qg-cyan)', wordBreak: 'break-all' }}>{String(cert.serial_number || '-')}</span>
          <span style={{ color: 'var(--qg-text-muted)' }}>Algorithm</span>
          <span style={{ color: 'var(--qg-text)' }}>{String(cert.key_algorithm || '-')}</span>
          <span style={{ color: 'var(--qg-text-muted)' }}>Bit Length</span>
          <span style={{ color: 'var(--qg-text)' }}>{String(privKey.bit_length || '-')}</span>
          <span style={{ color: 'var(--qg-text-muted)' }}>Valid From</span>
          <span style={{ color: 'var(--qg-green)' }}>{cert.not_before ? new Date(cert.not_before as string).toLocaleDateString() : '-'}</span>
          <span style={{ color: 'var(--qg-text-muted)' }}>Valid Until</span>
          <span style={{ color: 'var(--qg-green)' }}>{cert.not_after ? new Date(cert.not_after as string).toLocaleDateString() : '-'}</span>
        </div>
      </div>

      {/* SANs */}
      {certSANs.length > 0 && (
        <div style={{ background: 'var(--qg-surface)', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid var(--qg-border)' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Subject Alternative Names ({certSANs.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {certSANs.map(san => (
              <span key={san} style={{ padding: '3px 10px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)' }}>
                {san}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key Usage */}
      {(certKeyUsage.length > 0 || certExtKeyUsage.length > 0) && (
        <div style={{ background: 'var(--qg-surface)', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid var(--qg-border)' }}>
          {certKeyUsage.length > 0 && (
            <div style={{ marginBottom: certExtKeyUsage.length > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Key Usage
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {certKeyUsage.map(u => (
                  <span key={u} style={{ padding: '3px 10px', background: 'rgba(255,243,193,0.08)', border: '1px solid rgba(255,243,193,0.2)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-violet)' }}>
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
          {certExtKeyUsage.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Extended Key Usage
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {certExtKeyUsage.map(u => (
                  <span key={u} style={{ padding: '3px 10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-green)' }}>
                    {u}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SHA-256 Fingerprint */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={resultMetaLabel}>SHA-256 Fingerprint</div>
          <CopyButton text={String(cert.fingerprint_sha256 || '')} label="Copy" />
        </div>
        <div style={hexBoxStyle}>{String(cert.fingerprint_sha256 || '-')}</div>
      </div>

      {/* Public Key */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={resultMetaLabel}>Public Key (Hex)</div>
          <CopyButton text={String(cert.public_key_hex || '')} label="Copy" />
        </div>
        <div style={hexBoxStyle}>{String(cert.public_key_hex || '-')}</div>
      </div>

      {/* Private Key — hidden by default */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ ...resultMetaLabel, color: 'var(--qg-red)' }}>&#x1F512; Private Key — Handle with care</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="q-btn q-btn-ghost" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--qg-amber)', borderColor: 'rgba(251,191,36,0.3)' }}
              onClick={() => setShowPrivKey(v => !v)}>
              {showPrivKey ? 'Hide' : 'Reveal'}
            </button>
            {showPrivKey && <CopyButton text={String(privKey.key_hex || '')} label="Copy" />}
          </div>
        </div>
        {showPrivKey && (
          <div style={{ ...hexBoxStyle, color: 'var(--qg-amber)', borderColor: 'rgba(251,191,36,0.2)', background: 'rgba(251,191,36,0.03)' }}>
            {String(privKey.key_hex || '-')}
          </div>
        )}
        {!showPrivKey && (
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px dashed rgba(239,68,68,0.2)', borderRadius: 6, padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-muted)' }}>
            Private key hidden — click Reveal to display
          </div>
        )}
      </div>

      <div style={resultMetaStyle}>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Key Algorithm</div><div style={resultMetaValue}>{String(privKey.algorithm || '-')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Quality Score</div><div style={{ ...resultMetaValue, color: Number(result.quality_score || 0) > 0.9 ? 'var(--qg-green)' : 'var(--qg-amber)' }}>{((result.quality_score as number || 0) * 100).toFixed(1)}%</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Entropy Source</div><div style={{ ...resultMetaValue, color: String(result.entropy_source || '') === 'QRNG' ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>{String(result.entropy_source || 'CSPRNG')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Backend</div><div style={resultMetaValue}>{String(result.backend || '-')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Quantum Safe</div><div style={{ ...resultMetaValue, color: 'var(--qg-green)' }}>Yes</div></div>
      </div>
      <ComplianceBadges result={result} />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PKIPage() {
  const { settings: svcSettings, saveSettings } = useServiceSettings('pki')
  const {
    qrngStatus, liveTelemetry,
    terminalLogs, setTerminalLogs, terminalActive,
    serviceLoading, serviceResult, setServiceResult,
    callQRNGStreaming, fetchQRNGStatus, progress, retryCount, cancelOperation, resetState,
  } = useQRNG({ maxRetries: svcSettings.retryAttempts, retryDelayMs: 800 })

  const [activeTab, setActiveTab] = useState<PageTab>('generate')
  const { history: localHistory, addRecord, removeRecord, clearHistory } = useLocalHistory<HistoryRecord>('pki')

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
      const res = await fetch('/api/v1/pki?limit=100', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await res.json()
      if (json.data) {
        setDbHistory(json.data.map((r: any) => ({
          id: r.id,
          label: r.common_name || 'Certificate',
          sublabel: `${r.key_algorithm} • ${r.validity_days}d • ${r.entropy_source}`,
          badge: r.key_algorithm || 'PKI',
          badgeColor: 'var(--qg-cyan)',
          quality_score: r.quality_score,
          entropy_source: r.entropy_source,
          created_at: r.created_at,
        })))
      }
    } catch { /* non-critical */ }
  }, [session?.access_token])

  useEffect(() => { fetchDbHistory() }, [fetchDbHistory])

  // Merge: DB records + local-only records (dedup by id)
  const history = (() => {
    const dbIds = new Set(dbHistory.map(r => r.id))
    const localOnly = localHistory.filter(r => !dbIds.has(r.id))
    return [...dbHistory, ...localOnly].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  })()

  // Save result to history whenever a new one arrives
  useEffect(() => {
    if (!serviceResult || 'error' in serviceResult) return
    const cert = (serviceResult.certificate || {}) as Record<string, unknown>
    const privKey = (serviceResult.private_key || {}) as Record<string, unknown>
    const certSANs = Array.isArray(cert.sans) ? (cert.sans as string[]) : []
    const certKeyUsage = Array.isArray(cert.key_usage) ? (cert.key_usage as string[]) : []
    const certExtKeyUsage = Array.isArray(cert.extended_key_usage) ? (cert.extended_key_usage as string[]) : []

    // Build a rich sublabel showing subject, algorithm, validity, SANs, and usage
    const subParts: string[] = []
    if (cert.organization) subParts.push(`O=${String(cert.organization)}`)
    if (cert.country) subParts.push(`C=${String(cert.country)}`)
    subParts.push(String(cert.key_algorithm || ''))
    subParts.push(`${privKey.bit_length || ''}b`)
    if (cert.not_before && cert.not_after) {
      subParts.push(`${new Date(cert.not_before as string).toLocaleDateString()} → ${new Date(cert.not_after as string).toLocaleDateString()}`)
    }
    if (certSANs.length > 0) subParts.push(`SANs: ${certSANs.join(', ')}`)
    if (certKeyUsage.length > 0) subParts.push(`KU: ${certKeyUsage.join(', ')}`)
    if (certExtKeyUsage.length > 0) subParts.push(`EKU: ${certExtKeyUsage.join(', ')}`)

    addRecord({
      id: crypto.randomUUID(),
      label: String(cert.common_name || 'Certificate'),
      sublabel: subParts.join(' • '),
      badge: String(cert.key_algorithm || 'PKI'),
      badgeColor: 'var(--qg-cyan)',
      quality_score: Number(serviceResult.quality_score || 0),
      entropy_source: String(serviceResult.entropy_source || 'CSPRNG'),
      created_at: new Date().toISOString(),
    })

    // Persist to DB (non-blocking)
    fetch('/api/v1/pki', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        common_name: cert.common_name,
        organization: cert.organization,
        key_algorithm: cert.key_algorithm || 'ML-DSA',
        validity_days: serviceResult.validity_days || 365,
        quality_score: serviceResult.quality_score || 0,
        entropy_source: serviceResult.entropy_source || 'QRNG',
        serial_number: cert.serial_number,
        fingerprint_sha256: cert.fingerprint_sha256,
        key_usage: certKeyUsage,
        extended_key_usage: certExtKeyUsage,
        sans: certSANs,
      }),
    }).then(() => setTimeout(fetchDbHistory, 500)).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceResult])

  // Subject fields
  const [cn, setCN] = useState('')
  const [org, setOrg] = useState('')
  const [ou, setOU] = useState('')
  const [country, setCountry] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')

  // Certificate config
  const [keyAlgorithm, setKeyAlgorithm] = useState('ML-DSA')
  const [validityDays, setValidityDays] = useState(365)
  const [sans, setSANs] = useState<SANEntry[]>([])
  const [sanInput, setSANInput] = useState('')

  // Key usage
  const [keyUsage, setKeyUsage] = useState<string[]>(['digitalSignature', 'keyEncipherment'])
  const [extKeyUsage, setExtKeyUsage] = useState<string[]>(['serverAuth'])

  const KEY_USAGES = [
    { id: 'digitalSignature', label: 'Digital Signature' },
    { id: 'keyEncipherment', label: 'Key Encipherment' },
    { id: 'dataEncipherment', label: 'Data Encipherment' },
    { id: 'keyAgreement', label: 'Key Agreement' },
    { id: 'keyCertSign', label: 'Certificate Signing' },
    { id: 'cRLSign', label: 'CRL Signing' },
  ]

  const EXT_KEY_USAGES = [
    { id: 'serverAuth', label: 'TLS Server Auth' },
    { id: 'clientAuth', label: 'TLS Client Auth' },
    { id: 'codeSigning', label: 'Code Signing' },
    { id: 'emailProtection', label: 'Email Protection' },
    { id: 'timeStamping', label: 'Time Stamping' },
  ]

  const toggleUsage = (id: string, arr: string[], setArr: (v: string[]) => void) => {
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id])
  }

  const addSAN = () => {
    const v = sanInput.trim()
    if (v && !sans.some(s => s.value === v)) {
      setSANs(prev => [...prev, { id: crypto.randomUUID(), value: v }])
      setSANInput('')
    }
  }

  const handleGenerate = () => {
    callQRNGStreaming('pki', {
      common_name: cn || 'qguard.local',
      organization: org || undefined,
      organizational_unit: ou || undefined,
      country: country || undefined,
      state: state || undefined,
      city: city || undefined,
      key_algorithm: keyAlgorithm,
      validity_days: validityDays,
      sans: sans.map(s => s.value),
      key_usage: keyUsage,
      extended_key_usage: extKeyUsage,
      ...buildSettingsParams(svcSettings),
    })
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <QRNGPageHeader
        title="Digital Certificates"
        subtitle="QRNG-seeded post-quantum certificates with full subject control and key usage configuration"
        qrngStatus={qrngStatus}
        onRefresh={fetchQRNGStatus}
      />

      <QRNGStatusBanner qrngStatus={qrngStatus} liveTelemetry={liveTelemetry} />

      <TabNav<PageTab>
        tabs={[
          { id: 'generate', label: 'Generate', icon: '\uD83D\uDCDC' },
          { id: 'history', label: 'History', icon: '\uD83D\uDCCB' },
          { id: 'api', label: 'API', icon: '\uD83D\uDCD6' },
          { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F' },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        counts={{ history: history.length }}
      />

      {activeTab === 'generate' && (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>

        {/* Left — Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Subject */}
          <div className="q-card animate-fade-in-up">
            <div style={sectionTitle}>Subject Information</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={labelStyle}>Common Name *</label>
                <input value={cn} onChange={e => setCN(e.target.value)} placeholder="api.example.com" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Organization</label>
                  <input value={org} onChange={e => setOrg(e.target.value)} placeholder="Acme Corp" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Org Unit</label>
                  <input value={ou} onChange={e => setOU(e.target.value)} placeholder="Engineering" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Country</label>
                  <input value={country} onChange={e => setCountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="US" style={inputStyle} maxLength={2} />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input value={state} onChange={e => setState(e.target.value)} placeholder="CA" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>City</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="San Jose" style={inputStyle} />
                </div>
              </div>
            </div>
          </div>

          {/* Certificate Config */}
          <div className="q-card animate-fade-in-up">
            <div style={sectionTitle}>Certificate Configuration</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label htmlFor="key-algorithm" style={labelStyle}>Key Algorithm</label>
                <select id="key-algorithm" value={keyAlgorithm} onChange={e => setKeyAlgorithm(e.target.value)} style={inputStyle}>
                  <option value="ML-DSA">ML-DSA-65 (FIPS 204) — PQC</option>
                  <option value="SPHINCS+">SLH-DSA-SHA2-128F (FIPS 205) — PQC</option>
                  <option value="RSA-4096">RSA-4096 — Classical (compatibility)</option>
                  <option value="HYBRID">ML-DSA + RSA (Hybrid)</option>
                </select>
              </div>
              <div>
                <label htmlFor="validity-days" style={labelStyle}>Validity</label>
                <select id="validity-days" value={validityDays} onChange={e => setValidityDays(Number(e.target.value))} style={inputStyle}>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year (recommended)</option>
                  <option value={730}>2 years</option>
                  <option value={3650}>10 years (CA only)</option>
                </select>
              </div>
            </div>

            {/* SANs */}
            <div>
              <label style={labelStyle}>Subject Alternative Names (SANs)</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={sanInput} onChange={e => setSANInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSAN()}
                  placeholder="e.g. www.example.com, 192.168.1.1" style={{ ...inputStyle, flex: 1 }} />
                <button type="button" className="q-btn q-btn-ghost" onClick={addSAN} style={{ whiteSpace: 'nowrap' }}>+ Add</button>
              </div>
              {sans.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sans.map(s => (
                    <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)' }}>
                      {s.value}
                      <button type="button" onClick={() => setSANs(prev => prev.filter(x => x.id !== s.id))}
                        style={{ background: 'none', border: 'none', color: 'var(--qg-red)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 14 }}>
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Key Usage */}
          <div className="q-card animate-fade-in-up">
            <div style={sectionTitle}>Key Usage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {KEY_USAGES.map(u => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, color: keyUsage.includes(u.id) ? 'var(--qg-text)' : 'var(--qg-text-muted)' }}>
                  <input type="checkbox" checked={keyUsage.includes(u.id)} onChange={() => toggleUsage(u.id, keyUsage, setKeyUsage)} />
                  {u.label}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>Extended Key Usage</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {EXT_KEY_USAGES.map(u => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, color: extKeyUsage.includes(u.id) ? 'var(--qg-text)' : 'var(--qg-text-muted)' }}>
                  <input type="checkbox" checked={extKeyUsage.includes(u.id)} onChange={() => toggleUsage(u.id, extKeyUsage, setExtKeyUsage)} />
                  {u.label}
                </label>
              ))}
            </div>
          </div>

          <button type="button" className="q-btn q-btn-primary" onClick={handleGenerate} disabled={serviceLoading} style={{ width: '100%' }}>
            {serviceLoading ? '\u23f3 Generating Certificate...' : '\u{1f4dc} Generate PKI Certificate'}
          </button>
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
              : <PKIResult result={serviceResult} />
          )}
          {!serviceResult && (
            <div className="q-card" style={{ textAlign: 'center', padding: 48, color: 'var(--qg-text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>&#x1f4dc;</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Certificate will appear here</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>Fill in the subject details and click Generate</div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div style={{ marginTop: 24 }}>
        <QuantumTerminal logs={terminalLogs} isRunning={terminalActive} onClear={() => setTerminalLogs([])} />
      </div>
      </>
      )}

      {activeTab === 'history' && (
        <ServiceHistoryPanel
          records={history}
          onDelete={removeRecord}
          onClear={clearHistory}
          emptyMessage="No certificates yet — generate your first PKI certificate above."
        />
      )}

      {activeTab === 'api' && (
        <ServiceAPIPanel
          serviceName="PKI Certificate Authority"
          sdkPackage="@qguard/sdk"
          basePathNote="SSE streaming + certificate management"
          endpoints={[
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Generate a post-quantum X.509 certificate with QRNG entropy (SSE stream with real-time progress)',
              rateLimit: '20 req/min (Standard), 200 req/min (Enterprise)',
              body: `{
  "action": "pki",
  "common_name": "api.example.com",
  "organization": "Acme Corp",
  "organizational_unit": "Engineering",
  "country": "US",
  "state": "California",
  "city": "San Francisco",
  "key_algorithm": "ML-DSA",        // ML-DSA | SPHINCS+ | HYBRID | ED25519
  "validity_days": 365,
  "sans": ["www.example.com", "*.api.example.com"],
  "key_usage": ["digitalSignature", "keyEncipherment"],
  "extended_key_usage": ["serverAuth", "clientAuth"]
}`,
              response: `event: progress
data: {"percent":60,"stage":"Certificate Signing"}

event: result
data: {
  "certificate": {
    "serial_number": "A3F2...",
    "fingerprint_sha256": "B7:3A:...",
    "not_before": "2026-04-06T...",
    "not_after": "2027-04-06T...",
    "public_key_hex": "0a3f..."
  },
  "private_key": {
    "key_hex": "...",
    "algorithm": "ML-DSA",
    "bit_length": 2528
  },
  "quality_score": 0.991,
  "entropy_source": "QRNG"
}`,
            },
            {
              method: 'GET',
              path: '/api/v1/qrng/status',
              description: 'Health check — QRNG service availability, backend type, and entropy quality metrics',
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

// 1. Issue a post-quantum certificate via QRNG stream
async function issueCertificate(subject) {
  const res = await fetch(\`\${BASE}/api/v1/qrng/generate/stream\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify({
      action: 'pki',
      common_name: subject.cn,
      organization: subject.org,
      organizational_unit: subject.ou,
      country: subject.country || 'US',
      state: subject.state,
      city: subject.city,
      key_algorithm: 'ML-DSA',
      validity_days: 365,
      sans: subject.sans || [],
      key_usage: ['digitalSignature', 'keyEncipherment'],
      extended_key_usage: ['serverAuth'],
    }),
  })

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let cert = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    for (const part of text.split('\\n\\n')) {
      if (part.includes('event: progress')) {
        const d = JSON.parse(part.split('data: ')[1])
        console.log(\`[\${d.percent}%] \${d.stage} — \${d.detail}\`)
      }
      if (part.includes('event: result')) {
        cert = JSON.parse(part.split('data: ')[1])
      }
    }
  }
  return cert
}

// 2. Verify certificate fingerprint
function verifyCert(cert) {
  console.log('Subject:    ', cert.certificate.common_name)
  console.log('Fingerprint:', cert.certificate.fingerprint_sha256)
  console.log('Algorithm:  ', cert.private_key.algorithm)
  console.log('Valid until:', cert.certificate.not_after)
  console.log('Quality:    ', (cert.quality_score * 100).toFixed(1) + '%')
  console.log('Entropy:    ', cert.entropy_source)
}

// Usage: issue cert for TLS server
const cert = await issueCertificate({
  cn: 'api.example.com',
  org: 'Acme Corp',
  ou: 'Engineering',
  country: 'US',
  state: 'California',
  city: 'San Francisco',
  sans: ['www.example.com', '*.api.example.com'],
})
verifyCert(cert)`}
          pyExample={`import requests, json, sseclient

BASE = "http://localhost:4000"
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}

# 1. Issue post-quantum certificate via QRNG stream
def issue_certificate(subject: dict) -> dict:
    res = requests.post(
        f"{BASE}/api/v1/qrng/generate/stream",
        json={
            "action": "pki",
            "common_name": subject["cn"],
            "organization": subject.get("org", ""),
            "organizational_unit": subject.get("ou", ""),
            "country": subject.get("country", "US"),
            "state": subject.get("state", ""),
            "city": subject.get("city", ""),
            "key_algorithm": subject.get("algorithm", "ML-DSA"),
            "validity_days": subject.get("validity_days", 365),
            "sans": subject.get("sans", []),
            "key_usage": ["digitalSignature", "keyEncipherment"],
            "extended_key_usage": ["serverAuth"],
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

# 2. Verify and display certificate
def display_cert(cert: dict):
    c = cert["certificate"]
    pk = cert["private_key"]
    print(f"Subject:     {c['common_name']}")
    print(f"Fingerprint: {c['fingerprint_sha256']}")
    print(f"Algorithm:   {pk['algorithm']} ({pk['bit_length']}-bit)")
    print(f"Valid:       {c['not_before']} → {c['not_after']}")
    print(f"Quality:     {cert['quality_score'] * 100:.1f}%")
    print(f"Entropy:     {cert.get('entropy_source', 'CSPRNG')}")

# Usage
cert = issue_certificate({
    "cn": "api.example.com",
    "org": "Acme Corp",
    "algorithm": "ML-DSA",
    "validity_days": 365,
    "sans": ["www.example.com"],
})
display_cert(cert)`}
          curlExample={`# Check QRNG service health
curl -s http://localhost:4000/api/v1/qrng/status | jq

# Issue a post-quantum certificate (SSE stream)
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "pki",
    "common_name": "api.example.com",
    "organization": "Acme Corp",
    "organizational_unit": "Engineering",
    "country": "US",
    "key_algorithm": "ML-DSA",
    "validity_days": 365,
    "sans": ["www.example.com"],
    "key_usage": ["digitalSignature", "keyEncipherment"],
    "extended_key_usage": ["serverAuth"]
  }'

# Issue with SPHINCS+ (hash-based, stateless)
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "pki",
    "common_name": "signing.example.com",
    "key_algorithm": "SPHINCS+",
    "validity_days": 730,
    "key_usage": ["digitalSignature"],
    "extended_key_usage": ["codeSigning"]
  }'`}
        />
      )}

      {activeTab === 'settings' && (
        <ServiceSettingsPanel
          serviceKey="pki"
          settings={svcSettings}
          onSave={saveSettings}
          complianceBadges={(d) => [
            { badge: 'NIST SP 800-22', active: d.entropyValidation },
            { badge: 'NIST SP 800-90B', active: d.quantumCertification },
            { badge: 'FIPS 140-2', active: d.fips140Mode },
            { badge: 'X.509 v3', active: true },
            { badge: 'FIPS 204 (ML-DSA)', active: true },
            { badge: 'FIPS 205 (SLH-DSA)', active: true },
          ]}
        />
      )}
    </div>
  )
}
