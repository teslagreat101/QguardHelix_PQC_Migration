'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  useQRNG, QuantumTerminal, CopyButton, ErrorResult, ProgressIndicator, ComplianceBadges,
  QRNGPageHeader, QRNGStatusBanner,
  useLocalHistory, ServiceHistoryPanel, ServiceAPIPanel, ServiceSettingsPanel, TabNav,
  useServiceSettings, buildSettingsParams, type ServiceSettings,
  type HistoryRecord,
  inputStyle, labelStyle, sectionTitle, resultMetaStyle, resultMetaItem, resultMetaLabel, resultMetaValue, hexBoxStyle,
} from '@/components/qrng/shared'

// ── Types ──────────────────────────────────────────────────────────────────────

type PageTab = 'generate' | 'history' | 'api' | 'settings'

interface TokenRecord {
  id: string
  original_hint: string
  token_id: string
  token_value: string
  data_type: string
  format_preserving: boolean
  created_at: string
}

// ── Token Result ───────────────────────────────────────────────────────────────

function TokenResult({ result, dataType, original, onSave }: {
  result: Record<string, unknown>
  dataType: string
  original: string
  onSave: (r: TokenRecord) => void
}) {
  // Use a ref to ensure save fires exactly once after mount (not during render,
  // which would violate React's rules and cause "Cannot update while rendering" errors).
  const hasSaved = useRef(false)
  useEffect(() => {
    if (hasSaved.current) return
    hasSaved.current = true
    onSave({
      id: crypto.randomUUID(),
      original_hint: original.length > 4 ? `${'*'.repeat(original.length - 4)}${original.slice(-4)}` : '****',
      token_id: String(result.token_id || ''),
      token_value: String(result.token_value || ''),
      data_type: dataType,
      format_preserving: Boolean(result.format_preserving),
      created_at: new Date().toISOString(),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty – save exactly once on mount

  return (
    <div className="q-card" style={{ borderColor: 'var(--qg-cyan)' }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
        &#x2705; Tokenization Complete
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: 'var(--qg-surface)', borderRadius: 8, padding: 16, border: '1px solid var(--qg-border)' }}>
          <div style={resultMetaLabel}>Token ID</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-cyan)', wordBreak: 'break-all', marginBottom: 8 }}>
            {String(result.token_id || '-')}
          </div>
          <CopyButton text={String(result.token_id || '')} label="Copy ID" />
        </div>
        <div style={{ background: 'var(--qg-surface)', borderRadius: 8, padding: 16, border: '1px solid var(--qg-border)' }}>
          <div style={resultMetaLabel}>Token Value</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-text)', wordBreak: 'break-all', marginBottom: 8 }}>
            {String(result.token_value || '-')}
          </div>
          <CopyButton text={String(result.token_value || '')} label="Copy Value" />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={resultMetaLabel}>HMAC Binding (tamper-proof)</div>
          <CopyButton text={String(result.binding_hmac || '')} label="Copy" />
        </div>
        <div style={hexBoxStyle}>{String(result.binding_hmac || '-')}</div>
      </div>

      <div style={resultMetaStyle}>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Format Preserving</div><div style={{ ...resultMetaValue, color: result.format_preserving ? 'var(--qg-green)' : 'var(--qg-text-muted)' }}>{result.format_preserving ? 'Yes' : 'No'}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Original Length</div><div style={resultMetaValue}>{String(result.original_length || '-')} chars</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Quality</div><div style={{ ...resultMetaValue, color: Number(result.quality_score || 0) > 0.9 ? 'var(--qg-green)' : 'var(--qg-amber)' }}>{((result.quality_score as number || 0) * 100).toFixed(1)}%</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Entropy Source</div><div style={{ ...resultMetaValue, color: String(result.entropy_source || '') === 'QRNG' ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>{String(result.entropy_source || 'CSPRNG')}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Data Type</div><div style={resultMetaValue}>{dataType}</div></div>
      </div>
      <ComplianceBadges result={result} />
    </div>
  )
}

// ── Batch Token Result ─────────────────────────────────────────────────────────

function BatchTokenResult({ results, dataType, entropySource, onSave }: {
  results: Array<Record<string, unknown>>
  dataType: string
  entropySource?: string
  onSave?: (r: TokenRecord) => void
}) {
  const savedRef = useRef(false)
  const source = entropySource || 'CSPRNG'

  // Persist each batch token to vault + history on first render
  useEffect(() => {
    if (savedRef.current || !onSave) return
    savedRef.current = true
    for (const r of results) {
      const originalLen = Number(r.original_length || 0)
      onSave({
        id: crypto.randomUUID(),
        original_hint: originalLen > 4 ? `${'*'.repeat(originalLen - 4)}••••` : '****',
        token_id: String(r.token_id || ''),
        token_value: String(r.token_value || ''),
        data_type: String(r.data_type || dataType),
        format_preserving: Boolean(r.format_preserving),
        created_at: new Date().toISOString(),
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="q-card" style={{ borderColor: 'var(--qg-cyan)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          &#x2705; {results.length} Values Tokenized
        </span>
        <CopyButton
          text={results.map(r => `${r.token_id}\t${r.token_value}`).join('\n')}
          label="Copy TSV" />
      </div>

      <div style={resultMetaStyle}>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Count</div><div style={resultMetaValue}>{results.length}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Data Type</div><div style={resultMetaValue}>{dataType}</div></div>
        <div style={resultMetaItem}>
          <div style={resultMetaLabel}>Entropy Source</div>
          <div style={{ ...resultMetaValue, color: source === 'QRNG' ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>{source}</div>
        </div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Format Preserving</div><div style={{ ...resultMetaValue, color: results[0]?.format_preserving ? 'var(--qg-green)' : 'var(--qg-text-muted)' }}>{results[0]?.format_preserving ? 'Yes' : 'No'}</div></div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--qg-border)' }}>
              {['#', 'Token ID', 'Token Value', 'HMAC', 'Quality', ''].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--qg-text-muted)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--qg-border-dim, rgba(255,255,255,0.04))' }}>
                <td style={{ padding: '8px 10px', color: 'var(--qg-text-muted)' }}>{i + 1}</td>
                <td style={{ padding: '8px 10px', color: 'var(--qg-cyan)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r.token_id || '-')}</td>
                <td style={{ padding: '8px 10px', color: 'var(--qg-text)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(r.token_value || '-')}</td>
                <td style={{ padding: '8px 10px', color: 'var(--qg-text-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }}>{String(r.binding_hmac || '-').slice(0, 16)}…</td>
                <td style={{ padding: '8px 10px', color: 'var(--qg-green)' }}>{((r.quality_score as number || 0) * 100).toFixed(1)}%</td>
                <td style={{ padding: '8px 10px' }}><CopyButton text={String(r.token_value || '')} label="Copy" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TokenizePage() {
  const { settings: svcSettings, saveSettings } = useServiceSettings('tokenize')
  const {
    qrngStatus, liveTelemetry,
    terminalLogs, setTerminalLogs, terminalActive,
    serviceLoading, serviceResult, setServiceResult,
    callQRNGStreaming, fetchQRNGStatus, progress, retryCount, cancelOperation, resetState,
  } = useQRNG({ maxRetries: svcSettings.retryAttempts, retryDelayMs: 800 })

  const [activeTab, setActiveTab] = useState<PageTab>('generate')
  const { history: localHistory, addRecord, removeRecord, clearHistory } = useLocalHistory<HistoryRecord>('tokenize')

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
      const res = await fetch('/api/v1/tokenize?limit=100', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await res.json()
      if (json.data) {
        setDbHistory(json.data.map((r: any) => ({
          id: r.id,
          label: r.token_id || 'Token',
          sublabel: `${r.data_type} • ${r.original_hint}`,
          badge: r.data_type,
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

  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [dataType, setDataType] = useState('credit-card')
  const [sensitiveData, setSensitiveData] = useState('')
  const [batchInput, setBatchInput] = useState('')
  const [formatPreserving, setFormatPreserving] = useState(true)
  const [tokenPrefix, setTokenPrefix] = useState('tok_')
  const [sessionVault, setSessionVault] = useState<TokenRecord[]>([])

  const DATA_TYPES = [
    { id: 'credit-card', label: 'Credit Card', placeholder: '4111-1111-1111-1111', pattern: 'xxxx-xxxx-xxxx-LAST4' },
    { id: 'ssn', label: 'SSN', placeholder: '123-45-6789', pattern: 'xxx-xx-LAST4' },
    { id: 'phone', label: 'Phone Number', placeholder: '+1 (555) 000-0000', pattern: 'xxx-xxx-LAST4' },
    { id: 'account', label: 'Bank Account', placeholder: '000123456789', pattern: 'xxxxxx-LAST4' },
    { id: 'email', label: 'Email Address', placeholder: 'user@example.com', pattern: 'u***@domain' },
    { id: 'custom', label: 'Custom Data', placeholder: 'Any sensitive value', pattern: 'custom' },
  ]

  const currentType = DATA_TYPES.find(t => t.id === dataType) || DATA_TYPES[0]

  const handleGenerate = () => {
    const sp = buildSettingsParams(svcSettings)
    if (mode === 'batch') {
      const lines = batchInput.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length === 0) return
      callQRNGStreaming('token', {
        sensitive_data: lines[0],
        sensitive_data_batch: lines,
        data_type: dataType,
        format_preserving: formatPreserving,
        token_prefix: tokenPrefix,
        batch: true,
        ...sp,
      })
    } else {
      callQRNGStreaming('token', {
        sensitive_data: sensitiveData || currentType.placeholder,
        data_type: dataType,
        format_preserving: formatPreserving,
        token_prefix: tokenPrefix,
        ...sp,
      })
    }
  }

  const saveToVault = (r: TokenRecord) => {
    setSessionVault(prev => [r, ...prev].slice(0, 100))
    addRecord({
      id: r.id,
      label: r.token_id || 'Token',
      sublabel: `${r.data_type} • ${r.original_hint}`,
      badge: r.data_type,
      badgeColor: 'var(--qg-cyan)',
      quality_score: serviceResult && !('error' in serviceResult) ? Number(serviceResult.quality_score || 0) : undefined,
      entropy_source: serviceResult && !('error' in serviceResult) ? String(serviceResult.entropy_source || 'CSPRNG') : 'CSPRNG',
      created_at: r.created_at,
    })
    // Persist to DB (non-blocking)
    fetch('/api/v1/tokenize', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        token_id: r.token_id,
        token_value: r.token_value,
        data_type: r.data_type,
        format_preserving: r.format_preserving,
        original_hint: r.original_hint,
        quality_score: serviceResult && !('error' in serviceResult) ? Number(serviceResult.quality_score || 0) : 0,
        entropy_source: serviceResult && !('error' in serviceResult) ? String(serviceResult.entropy_source || 'QRNG') : 'QRNG',
      }),
    }).then(() => setTimeout(fetchDbHistory, 500)).catch(() => {})
  }

  const batchResults = serviceResult && Array.isArray(serviceResult.tokens)
    ? (serviceResult.tokens as Array<Record<string, unknown>>)
    : null

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <QRNGPageHeader
        title="Tokenization"
        subtitle="Quantum-random data masking — replace sensitive values with cryptographically bound tokens"
        qrngStatus={qrngStatus}
        onRefresh={fetchQRNGStatus}
      />

      <QRNGStatusBanner qrngStatus={qrngStatus} liveTelemetry={liveTelemetry} />

      <TabNav<PageTab>
        tabs={[
          { id: 'generate', label: 'Tokenize', icon: '\uD83C\uDFAD' },
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Left — Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Mode */}
          <div className="q-card animate-fade-in-up">
            <div style={sectionTitle}>Tokenization Mode</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['single', 'batch'] as const).map(m => (
                <button key={m} type="button"
                  className={`q-btn ${mode === m ? 'q-btn-primary' : 'q-btn-ghost'}`}
                  style={{ flex: 1 }} onClick={() => setMode(m)}>
                  {m === 'single' ? 'Single Value' : 'Batch (CSV/Lines)'}
                </button>
              ))}
            </div>

            {/* Data Type */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Data Type Preset</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {DATA_TYPES.map(t => (
                  <button key={t.id} type="button"
                    className={`q-btn q-btn-ghost`}
                    style={{ fontSize: 11, padding: '8px', textAlign: 'center', ...(dataType === t.id ? { borderColor: 'var(--qg-cyan)', color: 'var(--qg-cyan)', background: 'rgba(212,175,55,0.08)' } : {}) }}
                    onClick={() => setDataType(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'single' ? (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Sensitive Data</label>
                <input value={sensitiveData} onChange={e => setSensitiveData(e.target.value)}
                  placeholder={currentType.placeholder} style={inputStyle} />
                <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  Output pattern: {currentType.pattern}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Batch Input (one value per line)</label>
                <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)}
                  placeholder={`${currentType.placeholder}\n${currentType.placeholder}\n...`}
                  style={{ ...inputStyle, minHeight: 120, resize: 'vertical' }} />
                <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  {batchInput.split('\n').filter(Boolean).length} values to tokenize
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Token Prefix</label>
                <input value={tokenPrefix} onChange={e => setTokenPrefix(e.target.value)}
                  placeholder="tok_" style={inputStyle} maxLength={16} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
                <input type="checkbox" id="fp-toggle" checked={formatPreserving} onChange={e => setFormatPreserving(e.target.checked)} />
                <label htmlFor="fp-toggle" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', cursor: 'pointer' }}>
                  Format-preserving
                </label>
              </div>
            </div>

            <button type="button" className="q-btn q-btn-primary" onClick={handleGenerate} disabled={serviceLoading} style={{ width: '100%' }}>
              {serviceLoading ? '\u23f3 Tokenizing...' : '\u{1f3ad} Tokenize Data'}
            </button>
          </div>

          {/* Info */}
          <div className="q-card" style={{ background: 'rgba(212,175,55,0.03)', borderColor: 'rgba(212,175,55,0.1)' }}>
            <div style={sectionTitle}>Security Properties</div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 2 }}>
              <div>&#x2022; Tokens are QRNG-seeded — unpredictable by design</div>
              <div>&#x2022; HMAC binding prevents token forgery</div>
              <div>&#x2022; Original data is never stored in the token</div>
              <div>&#x2022; Format-preserving maintains data structure</div>
              <div>&#x2022; Quantum-safe against future attacks</div>
            </div>
          </div>
        </div>

        {/* Right — Result + Vault */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Progress Indicator */}
          {terminalActive && (
            <ProgressIndicator
              progress={progress}
              isRunning={terminalActive}
              onCancel={cancelOperation}
              retryCount={retryCount}
            />
          )}

          {/* Result */}
          {serviceResult && (
            'error' in serviceResult
              ? <ErrorResult message={String(serviceResult.error)} />
              : batchResults
                ? <BatchTokenResult results={batchResults} dataType={dataType} entropySource={String(serviceResult.entropy_source || '')} onSave={saveToVault} />
                : <TokenResult result={serviceResult} dataType={dataType} original={sensitiveData} onSave={saveToVault} />
          )}

          {/* Session Vault */}
          <div className="q-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={sectionTitle}>Session Token Vault ({sessionVault.length})</div>
              {sessionVault.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <CopyButton
                    text={sessionVault.map(v => `${v.original_hint}\t${v.token_value}\t${v.token_id}`).join('\n')}
                    label="Export TSV" />
                  <button type="button" className="q-btn q-btn-ghost" style={{ fontSize: 11 }}
                    onClick={() => setSessionVault([])}>Clear</button>
                </div>
              )}
            </div>
            {sessionVault.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                Tokenized values appear here
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {['Token ID', 'Original', 'Token Value', 'Type', 'FP', 'Status', 'Time'].map(h => (
                        <th key={h} style={{ padding: '12px', textAlign: 'left', color: '#D4AF37', fontWeight: 800, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionVault.map(v => (
                      <tr key={v.id} style={{ background: 'rgba(255,255,255,0.02)', transition: 'background 0.2s' }} className="hover:bg-white/[0.05]">
                        <td style={{ padding: '12px', color: '#00d4ff', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.token_id}</td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.4)' }}>{v.original_hint}</td>
                        <td style={{ padding: '12px', color: '#fff', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.token_value}</td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.6)' }}>{v.data_type}</td>
                        <td style={{ padding: '12px', color: v.format_preserving ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>{v.format_preserving ? 'Yes' : 'No'}</td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontWeight: 800, textTransform: 'uppercase', border: '1px solid currentColor', opacity: 0.8 }}>active</span>
                        </td>
                        <td style={{ padding: '12px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', fontSize: 10 }}>{new Date(v.created_at).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
          emptyMessage="No tokens yet — tokenize your first sensitive value above."
        />
      )}

      {activeTab === 'api' && (
        <ServiceAPIPanel
          serviceName="Data Tokenization"
          sdkPackage="@qguard/sdk"
          basePathNote="SSE streaming + batch tokenization"
          endpoints={[
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Tokenize sensitive data with QRNG entropy. Supports single and batch mode with format-preserving encryption (FPE).',
              rateLimit: '60 req/min (Standard), 500 req/min (Enterprise)',
              body: `{
  "action": "tokenize",
  "sensitive_data": "4111-1111-1111-1111",
  "data_type": "credit-card",     // credit-card | ssn | phone | email | account | custom
  "format_preserving": true,      // maintain original format structure
  "token_prefix": "tok_"          // custom token prefix
}`,
              response: `event: progress
data: {"percent":75,"stage":"HMAC Binding"}

event: result
data: {
  "token_id": "tok_a3f2b...",
  "token_value": "tok_9x8y7z...",
  "binding_hmac": "B7A3F2...",
  "format_preserving": true,
  "data_type": "credit-card",
  "quality_score": 0.987,
  "entropy_source": "CSPRNG"
}`,
            },
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Batch tokenization — tokenize multiple values in a single request with per-item progress tracking',
              rateLimit: '20 req/min (batch limited)',
              body: `{
  "action": "tokenize",
  "batch": true,
  "sensitive_data_batch": [
    "4111-1111-1111-1111",
    "4222-2222-2222-2222",
    "4333-3333-3333-3333"
  ],
  "data_type": "credit-card",
  "format_preserving": true,
  "token_prefix": "tok_"
}`,
              response: `event: result
data: {
  "tokens": [ { "token_id": "...", "token_value": "..." }, ... ],
  "count": 3,
  "quality_score": 0.991,
  "entropy_source": "CSPRNG"
}`,
            },
            {
              method: 'GET',
              path: '/api/v1/qrng/status',
              description: 'Health check — QRNG service availability and entropy quality metrics',
              rateLimit: '300 req/min',
              auth: false,
            },
          ]}
          jsExample={`const BASE = 'http://localhost:4000'

// 1. Tokenize single value via QRNG stream
async function tokenize(data, dataType = 'credit-card', options = {}) {
  const res = await fetch(\`\${BASE}/api/v1/qrng/generate/stream\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify({
      action: 'tokenize',
      sensitive_data: data,
      data_type: dataType,
      format_preserving: options.fpe ?? true,
      token_prefix: options.prefix || 'tok_',
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

// 2. Batch tokenize multiple values
async function batchTokenize(values, dataType = 'credit-card') {
  const res = await fetch(\`\${BASE}/api/v1/qrng/generate/stream\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify({
      action: 'tokenize',
      batch: true,
      sensitive_data_batch: values,
      data_type: dataType,
      format_preserving: true,
      token_prefix: 'tok_',
    }),
  })

  // Parse SSE stream...
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let result = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    if (text.includes('event: result')) {
      result = JSON.parse(text.split('data: ')[1])
    }
  }
  return result  // { tokens: [...], count, quality_score }
}

// Usage: PCI-DSS compliant credit card tokenization
const token = await tokenize('4111-1111-1111-1111', 'credit-card')
console.log(token.token_id, token.token_value, token.binding_hmac)

// Batch: tokenize a list of SSNs
const batch = await batchTokenize(
  ['123-45-6789', '987-65-4321', '555-12-3456'],
  'ssn'
)
batch.tokens.forEach(t => console.log(t.token_id, t.token_value))`}
          pyExample={`import requests, json, sseclient

BASE = "http://localhost:4000"
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}

# 1. Tokenize single value
def tokenize(data: str, data_type="credit-card", fpe=True, prefix="tok_") -> dict:
    res = requests.post(
        f"{BASE}/api/v1/qrng/generate/stream",
        json={
            "action": "tokenize",
            "sensitive_data": data,
            "data_type": data_type,
            "format_preserving": fpe,
            "token_prefix": prefix,
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

# 2. Batch tokenize
def batch_tokenize(values: list, data_type="credit-card") -> dict:
    res = requests.post(
        f"{BASE}/api/v1/qrng/generate/stream",
        json={
            "action": "tokenize",
            "batch": True,
            "sensitive_data_batch": values,
            "data_type": data_type,
            "format_preserving": True,
            "token_prefix": "tok_",
        },
        headers=HEADERS, stream=True,
    )
    client = sseclient.SSEClient(res)
    for event in client.events():
        if event.event == "result":
            return json.loads(event.data)

# Usage
token = tokenize("4111-1111-1111-1111", "credit-card")
print(f"Token ID: {token['token_id']}")
print(f"Token:    {token['token_value']}")
print(f"HMAC:     {token['binding_hmac']}")

# Batch SSN tokenization
batch = batch_tokenize(["123-45-6789", "987-65-4321"], "ssn")
for t in batch["tokens"]:
    print(f"{t['token_id']} → {t['token_value']}")`}
          curlExample={`# Single tokenization (SSE stream)
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "tokenize",
    "sensitive_data": "4111-1111-1111-1111",
    "data_type": "credit-card",
    "format_preserving": true,
    "token_prefix": "tok_"
  }'

# Batch tokenization (multiple values)
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "tokenize",
    "batch": true,
    "sensitive_data_batch": [
      "4111-1111-1111-1111",
      "4222-2222-2222-2222"
    ],
    "data_type": "credit-card",
    "format_preserving": true,
    "token_prefix": "tok_"
  }'

# SSN tokenization
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "tokenize",
    "sensitive_data": "123-45-6789",
    "data_type": "ssn",
    "format_preserving": true
  }'

# Check QRNG status
curl -s http://localhost:4000/api/v1/qrng/status | jq`}
        />
      )}

      {activeTab === 'settings' && (
        <ServiceSettingsPanel
          serviceKey="tokenize"
          settings={svcSettings}
          onSave={saveSettings}
          complianceBadges={(d) => [
            { badge: 'NIST SP 800-22', active: d.entropyValidation },
            { badge: 'NIST SP 800-90B', active: d.quantumCertification },
            { badge: 'FIPS 140-2', active: d.fips140Mode },
            { badge: 'PCI DSS 4.0', active: true },
            { badge: 'OWASP Data Protection', active: d.auditLogging },
          ]}
        />
      )}
    </div>
  )
}
