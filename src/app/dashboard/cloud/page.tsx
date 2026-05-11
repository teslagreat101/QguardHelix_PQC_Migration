'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import {
  useQRNG, QuantumTerminal, CopyButton, DownloadButton, ErrorResult, ProgressIndicator, ComplianceBadges,
  QRNGPageHeader, QRNGStatusBanner,
  useLocalHistory, ServiceHistoryPanel, ServiceAPIPanel, ServiceSettingsPanel, TabNav,
  useServiceSettings, buildSettingsParams, type ServiceSettings,
  type HistoryRecord,
  inputStyle, labelStyle, sectionTitle,
  resultMetaStyle, resultMetaItem, resultMetaLabel, resultMetaValue,
} from '@/components/qrng/shared'

// ── Types ──────────────────────────────────────────────────────────────────────

type PageTab = 'generate' | 'history' | 'api' | 'settings'
type CloudTarget = 'generic' | 'aws' | 'gcp' | 'azure' | 'kubernetes' | 'docker'
type SeedFormat = 'hex' | 'base64' | 'base32' | 'env'

interface ContainerSeed {
  seed_hex: string
  encryption_key_hex: string
  hmac_key_hex: string
  nonce_hex: string
  quality_score: number
  seed_bits?: number
}

// ── Container Seed Card ────────────────────────────────────────────────────────

function ContainerCard({ seed, index, prefix, format }: {
  seed: ContainerSeed
  index: number
  prefix: string
  format: SeedFormat
}) {
  const name = prefix ? `${prefix}-${index}` : `container-${index}`
  const [expanded, setExpanded] = useState(false)

  const formatValue = (hex: string) => {
    if (!hex) return '-'
    switch (format) {
      case 'base64': return btoa(hex.match(/.{1,2}/g)!.map(h => String.fromCharCode(parseInt(h, 16))).join(''))
      case 'base32': {
        // Simple base32 approximation from hex
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
        let result = ''
        for (let i = 0; i < Math.min(hex.length, 40); i += 2) {
          result += chars[parseInt(hex.slice(i, i + 2), 16) % 32]
        }
        return result + '...'
      }
      case 'env': return hex.toUpperCase()
      default: return hex
    }
  }

  const envBlock = [
    `${name.toUpperCase().replace(/-/g, '_')}_SEED=${formatValue(seed.seed_hex)}`,
    `${name.toUpperCase().replace(/-/g, '_')}_ENC_KEY=${formatValue(seed.encryption_key_hex)}`,
    `${name.toUpperCase().replace(/-/g, '_')}_HMAC_KEY=${formatValue(seed.hmac_key_hex)}`,
    `${name.toUpperCase().replace(/-/g, '_')}_NONCE=${formatValue(seed.nonce_hex)}`,
  ].join('\n')

  return (
    <div style={{ background: 'var(--qg-surface)', borderRadius: 8, border: '1px solid var(--qg-border)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}>
        <span style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,243,193,0.15)', color: '#fff3c1', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {index}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-text)', flex: 1 }}>{name}</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: seed.quality_score > 0.9 ? 'var(--qg-green)' : 'var(--qg-amber)', marginRight: 8 }}>
          {(seed.quality_score * 100).toFixed(1)}%
        </span>
        <CopyButton text={envBlock} label="Copy .env" />
        <span style={{ fontSize: 14, color: 'var(--qg-text-muted)', marginLeft: 4 }}>{expanded ? '▾' : '▸'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--qg-border)' }}>
          <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Seed', value: seed.seed_hex, color: 'var(--qg-cyan)' },
              { label: 'Encryption Key', value: seed.encryption_key_hex, color: 'var(--qg-cyan)' },
              { label: 'HMAC Key', value: seed.hmac_key_hex, color: 'var(--qg-violet)' },
              { label: 'Nonce', value: seed.nonce_hex, color: 'var(--qg-amber)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)', minWidth: 110, flexShrink: 0 }}>{item.label}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: item.color, wordBreak: 'break-all', flex: 1, lineHeight: 1.6 }}>
                  {formatValue(item.value)}
                </span>
                <CopyButton text={formatValue(item.value)} label="Copy" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cloud Result ───────────────────────────────────────────────────────────────

function CloudResult({ result, prefix, format, target }: {
  result: Record<string, unknown>
  prefix: string
  format: SeedFormat
  target: CloudTarget
}) {
  // API may return either "containers" (new) or "seeds" (legacy) – handle both
  const containers = ((result.containers ?? result.seeds) || []) as ContainerSeed[]

  const generateK8sYAML = () => {
    const secrets = containers.map((c, i) => {
      const name = prefix ? `${prefix}-${i}` : `container-${i}`
      return `apiVersion: v1
kind: Secret
metadata:
  name: ${name}-seed
  namespace: default
type: Opaque
stringData:
  SEED: "${c.seed_hex}"
  ENC_KEY: "${c.encryption_key_hex}"
  HMAC_KEY: "${c.hmac_key_hex}"
  NONCE: "${c.nonce_hex}"
---`
    }).join('\n')
    return secrets
  }

  const generateEnvFile = () => {
    return containers.map((c, i) => {
      const name = (prefix ? `${prefix}-${i}` : `container-${i}`).toUpperCase().replace(/-/g, '_')
      return `# Container ${i}
${name}_SEED=${c.seed_hex}
${name}_ENC_KEY=${c.encryption_key_hex}
${name}_HMAC_KEY=${c.hmac_key_hex}
${name}_NONCE=${c.nonce_hex}`
    }).join('\n\n')
  }

  const generateJSON = () => JSON.stringify({
    target,
    containers: containers.map((c, i) => ({
      name: prefix ? `${prefix}-${i}` : `container-${i}`,
      seed: c.seed_hex,
      encryption_key: c.encryption_key_hex,
      hmac_key: c.hmac_key_hex,
      nonce: c.nonce_hex,
      quality_score: c.quality_score,
    })),
    generated_at: new Date().toISOString(),
  }, null, 2)

  return (
    <div className="q-card" style={{ borderColor: 'var(--qg-cyan)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            &#x2705; {containers.length} Container Seed{containers.length !== 1 ? 's' : ''} Generated
          </div>
          <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            Target: {target} &bull; Format: {format} &bull; {String(result.seed_bits || 256)}-bit
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {target === 'kubernetes' && (
            <DownloadButton data={generateK8sYAML()} filename="seeds.k8s.yaml" />
          )}
          <DownloadButton data={generateEnvFile()} filename=".env.seeds" />
          <DownloadButton data={generateJSON()} filename="seeds.json" />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {containers.map((c, i) => (
          <ContainerCard key={i} seed={c} index={i} prefix={prefix} format={format} />
        ))}
      </div>

      {/* Metadata */}
      <div style={{ ...resultMetaStyle, marginTop: 16 }}>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Target</div><div style={resultMetaValue}>{target.toUpperCase()}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Containers</div><div style={resultMetaValue}>{containers.length}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Seed Bits</div><div style={resultMetaValue}>{String(result.seed_bits || 256)}-bit</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Format</div><div style={resultMetaValue}>{format.toUpperCase()}</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Quality</div><div style={{ ...resultMetaValue, color: Number(result.quality_score || 0) > 0.9 ? 'var(--qg-green)' : 'var(--qg-amber)' }}>{((Number(result.quality_score) || 0) * 100).toFixed(1)}%</div></div>
        <div style={resultMetaItem}><div style={resultMetaLabel}>Entropy Source</div><div style={{ ...resultMetaValue, color: String(result.entropy_source || '') === 'QRNG' ? 'var(--qg-cyan)' : 'var(--qg-amber)' }}>{String(result.entropy_source || 'CSPRNG')}</div></div>
        {result.generation_time_ms ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Gen Time</div><div style={resultMetaValue}>{Number(result.generation_time_ms).toFixed(1)}ms</div></div>
        ) : null}
        {prefix ? (
          <div style={resultMetaItem}><div style={resultMetaLabel}>Prefix</div><div style={resultMetaValue}>{prefix}</div></div>
        ) : null}
      </div>
      <ComplianceBadges result={result} />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CloudPage() {
  const { settings: svcSettings, saveSettings } = useServiceSettings('cloud')
  const {
    qrngStatus, liveTelemetry,
    terminalLogs, setTerminalLogs, terminalActive,
    serviceLoading, serviceResult, setServiceResult,
    callQRNGStreaming, fetchQRNGStatus, progress, retryCount, cancelOperation, resetState,
  } = useQRNG({ maxRetries: svcSettings.retryAttempts, retryDelayMs: 800 })

  const [pageTab, setPageTab] = useState<PageTab>('generate')
  const { history: localHistory, addRecord, removeRecord, clearHistory } = useLocalHistory<HistoryRecord>('cloud')

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
      const res = await fetch('/api/v1/cloud?limit=100', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await res.json()
      if (json.data) {
        const targetColors: Record<string, string> = {
          generic: 'var(--qg-violet)', kubernetes: '#326ce5', docker: '#2496ed',
          aws: '#ff9900', gcp: '#4285f4', azure: '#0089d6',
        }
        setDbHistory(json.data.map((r: any) => ({
          id: r.id,
          label: `${r.container_count || 1} Container Seed${r.container_count !== 1 ? 's' : ''}`,
          sublabel: `${(r.target || 'generic').toUpperCase()} • ${r.seed_bits}-bit • ${r.entropy_source}`,
          badge: r.target || 'generic',
          badgeColor: targetColors[r.target || 'generic'] || 'var(--qg-violet)',
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

  const [target, setTarget] = useState<CloudTarget>('generic')
  const [containerCount, setContainerCount] = useState(3)
  const [seedBits, setSeedBits] = useState(256)
  const [format, setFormat] = useState<SeedFormat>('hex')
  const [prefix, setPrefix] = useState('')

  useEffect(() => {
    if (!serviceResult || 'error' in serviceResult) return
    const containers = ((serviceResult.containers ?? serviceResult.seeds) || []) as Array<{ quality_score?: number }>
    const avgQuality = containers.length > 0
      ? containers.reduce((s, c) => s + (c.quality_score || 0), 0) / containers.length
      : Number(serviceResult.quality_score || 0)

    const resultTarget = String(serviceResult.target || target)
    const resultBits = Number(serviceResult.seed_bits || seedBits)
    const resultFormat = String(serviceResult.format || format)
    const resultPrefix = String(serviceResult.prefix || prefix)

    const details: string[] = [
      resultTarget.toUpperCase(),
      `${resultBits}-bit`,
      resultFormat.toUpperCase(),
      String(serviceResult.entropy_source || 'CSPRNG'),
    ]
    if (resultPrefix) details.push(`prefix="${resultPrefix}"`)

    const targetColors: Record<string, string> = {
      generic: 'var(--qg-violet)', kubernetes: '#326ce5', docker: '#2496ed',
      aws: '#ff9900', gcp: '#4285f4', azure: '#0089d6',
    }

    addRecord({
      id: crypto.randomUUID(),
      label: `${containers.length} Container Seed${containers.length !== 1 ? 's' : ''}`,
      sublabel: details.join(' • '),
      badge: resultTarget,
      badgeColor: targetColors[resultTarget] || 'var(--qg-violet)',
      quality_score: avgQuality,
      entropy_source: String(serviceResult.entropy_source || 'CSPRNG'),
      created_at: new Date().toISOString(),
    })

    // Persist to DB (non-blocking)
    fetch('/api/v1/cloud', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        target: resultTarget,
        container_count: containers.length,
        seed_bits: resultBits,
        prefix: resultPrefix,
        quality_score: avgQuality,
        entropy_source: String(serviceResult.entropy_source || 'QRNG'),
      }),
    }).then(() => setTimeout(fetchDbHistory, 500)).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceResult])

  const TARGETS: { id: CloudTarget; label: string; icon: string; desc: string }[] = [
    { id: 'generic', icon: '\uD83D\uDCE6', label: 'Generic', desc: 'Universal seed format' },
    { id: 'kubernetes', icon: '\u2388', label: 'Kubernetes', desc: 'K8s Secrets YAML export' },
    { id: 'docker', icon: '\uD83D\uDC33', label: 'Docker', desc: 'Docker Swarm secrets' },
    { id: 'aws', icon: '\uD83C\uDDFA', label: 'AWS', desc: 'Secrets Manager format' },
    { id: 'gcp', icon: '\uD83C\uDDEC', label: 'GCP', desc: 'Secret Manager format' },
    { id: 'azure', icon: '\uD83C\uDF0A', label: 'Azure', desc: 'Key Vault format' },
  ]

  const handleGenerate = () => {
    callQRNGStreaming('seed', {
      container_count: containerCount,
      seed_bits: seedBits,
      target,
      prefix: prefix || undefined,
      format,
      ...buildSettingsParams(svcSettings),
    })
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <QRNGPageHeader
        title="Cloud Security"
        subtitle="QRNG-seeded cryptographic material for containers, cloud infrastructure, and orchestration platforms"
        qrngStatus={qrngStatus}
        onRefresh={fetchQRNGStatus}
      />

      <QRNGStatusBanner qrngStatus={qrngStatus} liveTelemetry={liveTelemetry} />

      <TabNav<PageTab>
        tabs={[
          { id: 'generate', label: 'Generate', icon: '\u2601' },
          { id: 'history', label: 'History', icon: '\uD83D\uDCCB' },
          { id: 'api', label: 'API', icon: '\uD83D\uDCD6' },
          { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F' },
        ]}
        active={pageTab}
        onChange={setPageTab}
        counts={{ history: history.length }}
      />

      {pageTab === 'generate' && (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 }}>

        {/* Left — Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Cloud Target */}
          <div className="q-card animate-fade-in-up">
            <div style={sectionTitle}>Cloud Target</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
              {TARGETS.map(t => (
                <button key={t.id} type="button"
                  className="q-btn q-btn-ghost"
                  style={{
                    padding: '10px 8px', flexDirection: 'column', gap: 4, textAlign: 'center', fontSize: 11,
                    ...(target === t.id ? { borderColor: 'var(--qg-cyan)', color: 'var(--qg-cyan)', background: 'rgba(212,175,55,0.08)' } : {}),
                  }}
                  onClick={() => setTarget(t.id)}>
                  <span style={{ fontSize: 18, display: 'block' }}>{t.icon}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{t.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 8, padding: '8px 12px', background: 'rgba(212,175,55,0.04)', borderRadius: 6 }}>
              {TARGETS.find(t => t.id === target)?.desc}
            </div>
          </div>

          {/* Seed Config */}
          <div className="q-card animate-fade-in-up">
            <div style={sectionTitle}>Seed Configuration</div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label htmlFor="container-count" style={labelStyle}>Number of Containers / Secrets</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input id="container-count" type="range" min={1} max={20} value={containerCount}
                    onChange={e => setContainerCount(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--qg-cyan)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--qg-cyan)', minWidth: 32 }}>{containerCount}</span>
                </div>
              </div>

              <div>
                <label htmlFor="seed-bits" style={labelStyle}>Seed Strength</label>
                <select id="seed-bits" value={seedBits} onChange={e => setSeedBits(Number(e.target.value))} style={inputStyle}>
                  <option value={128}>128-bit — NIST Level 1</option>
                  <option value={256}>256-bit — NIST Level 3 (Recommended)</option>
                  <option value={512}>512-bit — Maximum</option>
                </select>
              </div>

              <div>
                <label htmlFor="seed-format" style={labelStyle}>Output Format</label>
                <select id="seed-format" value={format} onChange={e => setFormat(e.target.value as SeedFormat)} style={inputStyle}>
                  <option value="hex">Hexadecimal (raw bytes)</option>
                  <option value="base64">Base64 (compact, common)</option>
                  <option value="base32">Base32 (case-insensitive)</option>
                  <option value="env">ENV format (uppercase hex)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Container Naming Prefix (optional)</label>
                <input value={prefix} onChange={e => setPrefix(e.target.value)}
                  placeholder="e.g. prod-api, staging-worker" style={inputStyle} maxLength={32} />
                <div style={{ fontSize: 10, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  Seeds will be named: {prefix || 'container'}-0, {prefix || 'container'}-1 ...
                </div>
              </div>
            </div>
          </div>

          <button type="button" className="q-btn q-btn-primary" onClick={handleGenerate} disabled={serviceLoading} style={{ width: '100%' }}>
            {serviceLoading ? '\u23f3 Generating Seeds...' : `\u2601 Generate ${containerCount} Container Seed${containerCount !== 1 ? 's' : ''}`}
          </button>

          {/* Info */}
          <div className="q-card" style={{ background: 'rgba(212,175,55,0.03)', borderColor: 'rgba(212,175,55,0.1)' }}>
            <div style={sectionTitle}>Per-Container Output</div>
            <div style={{ fontSize: 12, color: 'var(--qg-text-muted)', fontFamily: 'var(--font-mono)', lineHeight: 2 }}>
              {[
                'Unique seed per container',
                'Dedicated encryption key',
                'Independent HMAC key',
                'Cryptographic nonce',
              ].map(item => (
                <div key={item}>&#x2022; {item}</div>
              ))}
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
              : <CloudResult result={serviceResult} prefix={prefix} format={format} target={target} />
          )}
          {!serviceResult && (
            <div className="q-card" style={{ textAlign: 'center', padding: 60, color: 'var(--qg-text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2601;</div>
              <div style={{ fontSize: 14, marginBottom: 8 }}>Container seeds will appear here</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 20 }}>
                Configure target and count, then click Generate
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                {[
                  { label: resultMetaLabel, text: 'Each container gets isolated cryptographic material' },
                  { label: resultMetaLabel, text: 'Export as K8s YAML, .env, or JSON' },
                  { label: resultMetaLabel, text: 'QRNG entropy — quantum-safe randomness' },
                ].map((item, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--qg-text-muted)' }}>
                    &#x2022; {item.text}
                  </div>
                ))}
              </div>
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

      {pageTab === 'history' && (
        <ServiceHistoryPanel
          records={history}
          onDelete={removeRecord}
          onClear={clearHistory}
          emptyMessage="No cloud seeds yet — generate your first container seeds above."
        />
      )}

      {pageTab === 'api' && (
        <ServiceAPIPanel
          serviceName="Cloud Infrastructure Seeding"
          sdkPackage="@qguard/sdk"
          basePathNote="SSE streaming + multi-target export"
          endpoints={[
            {
              method: 'POST',
              path: '/api/v1/qrng/generate/stream',
              description: 'Generate QRNG-seeded cryptographic material for cloud containers. Each container receives an isolated seed, encryption key, HMAC key, and nonce via HKDF.',
              rateLimit: '30 req/min (Standard), 300 req/min (Enterprise)',
              body: `{
  "action": "cloud-seeds",
  "container_count": 3,           // 1–20 containers per request
  "seed_bits": 256,               // 128 | 256 | 512
  "target": "kubernetes",         // generic | kubernetes | docker | aws | gcp | azure
  "prefix": "prod-api",           // optional naming prefix
  "format": "hex"                 // hex | base64 | base32 | env
}`,
              response: `event: progress
data: {"percent":70,"stage":"Generating Seeds","detail":"2/3 — prod-api-1"}

event: result
data: {
  "container_count": 3,
  "seed_bits": 256,
  "target": "kubernetes",
  "prefix": "prod-api",
  "format": "hex",
  "containers": [
    {
      "seed_hex": "a3f2b7...",
      "encryption_key_hex": "d9e1c4...",
      "hmac_key_hex": "f7a2b3...",
      "nonce_hex": "c1d2e3...",
      "quality_score": 0.991
    }
  ],
  "quality_score": 0.989,
  "entropy_source": "QRNG"
}`,
            },
            {
              method: 'POST',
              path: '/api/v1/qrng/cloud/seeds',
              description: 'Direct (non-streaming) cloud seed generation endpoint. Returns seeds immediately without SSE progress events.',
              rateLimit: '20 req/min',
              body: `{
  "container_count": 5,
  "seed_bits": 256,
  "target": "aws",
  "prefix": "staging-worker"
}`,
            },
            {
              method: 'GET',
              path: '/api/v1/qrng/status',
              description: 'Health check — QRNG availability, Qiskit backend status, and entropy quality metrics',
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

// 1. Generate container seeds via QRNG stream
async function generateCloudSeeds(config) {
  const {
    count = 3, bits = 256, target = 'kubernetes',
    prefix = '', format = 'hex'
  } = config

  const res = await fetch(\`\${BASE}/api/v1/qrng/generate/stream\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${JWT_TOKEN}\`,
    },
    body: JSON.stringify({
      action: 'cloud-seeds',
      container_count: count,
      seed_bits: bits,
      target,
      prefix: prefix || undefined,
      format,
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
        console.log(\`[\${d.percent}%] \${d.stage} — \${d.detail}\`)
      }
      if (part.includes('event: result')) {
        result = JSON.parse(part.split('data: ')[1])
      }
    }
  }
  return result
}

// 2. Export as Kubernetes Secrets YAML
function toK8sSecrets(seeds, namespace = 'default') {
  return seeds.containers.map((c, i) => {
    const name = seeds.prefix ? \`\${seeds.prefix}-\${i}\` : \`container-\${i}\`
    return \`apiVersion: v1
kind: Secret
metadata:
  name: \${name}-seed
  namespace: \${namespace}
type: Opaque
stringData:
  SEED: "\${c.seed_hex}"
  ENC_KEY: "\${c.encryption_key_hex}"
  HMAC_KEY: "\${c.hmac_key_hex}"
  NONCE: "\${c.nonce_hex}"\`
  }).join('\\n---\\n')
}

// 3. Export as .env file
function toEnvFile(seeds) {
  return seeds.containers.map((c, i) => {
    const name = (seeds.prefix || \`container-\${i}\`).toUpperCase().replace(/-/g, '_')
    return \`\${name}_SEED=\${c.seed_hex}
\${name}_ENC_KEY=\${c.encryption_key_hex}
\${name}_HMAC_KEY=\${c.hmac_key_hex}
\${name}_NONCE=\${c.nonce_hex}\`
  }).join('\\n\\n')
}

// Usage: provision 5 K8s containers
const seeds = await generateCloudSeeds({
  count: 5, bits: 256, target: 'kubernetes', prefix: 'prod-api',
})
console.log(toK8sSecrets(seeds, 'production'))
console.log(\`Quality: \${(seeds.quality_score * 100).toFixed(1)}%\`)
console.log(\`Entropy: \${seeds.entropy_source}\`)`}
          pyExample={`import requests, json, sseclient

BASE = "http://localhost:4000"
HEADERS = {"Authorization": f"Bearer {JWT_TOKEN}", "Content-Type": "application/json"}

# 1. Generate container seeds via QRNG stream
def generate_cloud_seeds(count=3, bits=256, target="kubernetes", prefix="", fmt="hex"):
    res = requests.post(
        f"{BASE}/api/v1/qrng/generate/stream",
        json={
            "action": "cloud-seeds",
            "container_count": count,
            "seed_bits": bits,
            "target": target,
            "prefix": prefix or None,
            "format": fmt,
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

# 2. Export as .env file
def to_env_file(seeds: dict) -> str:
    lines = []
    for i, c in enumerate(seeds["containers"]):
        name = f"{seeds.get('prefix', '')}-{i}" if seeds.get("prefix") else f"container-{i}"
        name = name.upper().replace("-", "_")
        lines.append(f"{name}_SEED={c['seed_hex']}")
        lines.append(f"{name}_ENC_KEY={c['encryption_key_hex']}")
        lines.append(f"{name}_HMAC_KEY={c['hmac_key_hex']}")
        lines.append(f"{name}_NONCE={c['nonce_hex']}")
        lines.append("")
    return "\\n".join(lines)

# 3. Export as K8s Secrets YAML
def to_k8s_yaml(seeds: dict, namespace="default") -> str:
    docs = []
    for i, c in enumerate(seeds["containers"]):
        name = f"{seeds.get('prefix', '')}-{i}" if seeds.get("prefix") else f"container-{i}"
        docs.append(f\"\"\"apiVersion: v1
kind: Secret
metadata:
  name: {name}-seed
  namespace: {namespace}
type: Opaque
stringData:
  SEED: "{c['seed_hex']}"
  ENC_KEY: "{c['encryption_key_hex']}"
  HMAC_KEY: "{c['hmac_key_hex']}"
  NONCE: "{c['nonce_hex']}\"
\"\"\")
    return "---\\n".join(docs)

# Usage
seeds = generate_cloud_seeds(count=5, bits=256, target="kubernetes", prefix="prod-api")
print(f"Generated {seeds['container_count']} seeds")
print(f"Quality:  {seeds['quality_score'] * 100:.1f}%")
print(f"Entropy:  {seeds.get('entropy_source', 'CSPRNG')}")
print(to_env_file(seeds))`}
          curlExample={`# Generate 3 K8s container seeds (SSE stream)
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "cloud-seeds",
    "container_count": 3,
    "seed_bits": 256,
    "target": "kubernetes",
    "prefix": "prod-api",
    "format": "hex"
  }'

# Generate AWS secrets (5 containers, 512-bit)
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "cloud-seeds",
    "container_count": 5,
    "seed_bits": 512,
    "target": "aws",
    "prefix": "staging-worker"
  }'

# Generate Docker Swarm secrets
curl -N -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{
    "action": "cloud-seeds",
    "container_count": 10,
    "seed_bits": 256,
    "target": "docker",
    "prefix": "swarm-node"
  }'

# Direct (non-streaming) endpoint
curl -X POST http://localhost:4000/api/v1/qrng/cloud/seeds \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -d '{"container_count": 3, "seed_bits": 256, "target": "azure"}'

# Check QRNG status
curl -s http://localhost:4000/api/v1/qrng/status | jq`}
        />
      )}

      {pageTab === 'settings' && (
        <ServiceSettingsPanel
          serviceKey="cloud"
          settings={svcSettings}
          onSave={saveSettings}
          complianceBadges={(d) => [
            { badge: 'NIST SP 800-22', active: d.entropyValidation },
            { badge: 'NIST SP 800-90B', active: d.quantumCertification },
            { badge: 'FIPS 140-2', active: d.fips140Mode },
            { badge: 'CIS Benchmarks', active: true },
            { badge: 'SOC 2 Type II', active: d.auditLogging },
          ]}
        />
      )}
    </div>
  )
}
