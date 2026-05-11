'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'

// ─── Endpoint definitions ─────────────────────────────────────────────────────

const ENDPOINTS: EndpointDoc[] = [
  // 1. Start Scan
  {
    method: 'POST',
    path: '/api/v1/scan',
    title: 'Start Scan',
    description:
      'Initiate a quantum vulnerability scan against a target. Choose the scan scope to target device files, cloud storage buckets, Git repositories, TLS certificates, or a custom path. Returns a scan_id to track progress via the stream endpoint.',
    auth: 'jwt',
    rateLimit: '10 req/min',
    requestFields: [
      {
        field: 'scope',
        type: 'enum',
        required: true,
        description:
          'Target surface to scan. One of: device-files | cloud-storage | git-repo | tls-certs | custom-path',
        example: 'tls-certs',
      },
      {
        field: 'target',
        type: 'string',
        required: true,
        description:
          'Scan target — a hostname, bucket URI, repo URL, file-system path, or domain depending on scope',
        example: 'example.com',
      },
      {
        field: 'deep_scan',
        type: 'boolean',
        required: false,
        description:
          'When true, performs recursive deep analysis including transitive dependencies and chained certificate chains. Increases scan duration.',
        example: 'true',
      },
    ],
    responseFields: [
      {
        field: 'scan_id',
        type: 'string (UUID)',
        required: true,
        description: 'Unique identifier for this scan job. Use with the stream and results endpoints.',
        example: '3f6a1b2c-4d5e-7890-abcd-ef1234567890',
      },
      {
        field: 'status',
        type: 'string',
        required: true,
        description: 'Initial scan status — always "running" on successful creation.',
        example: '"running"',
      },
      {
        field: 'started_at',
        type: 'string (ISO 8601)',
        required: true,
        description: 'UTC timestamp when the scan job was enqueued.',
      },
    ],
    requestBody: {
      scope: 'tls-certs',
      target: 'example.com',
      deep_scan: true,
    },
  },

  // 2. Scan Progress Stream
  {
    method: 'GET',
    path: '/api/v1/scan/stream',
    title: 'Scan Progress Stream',
    description:
      'Subscribe to a Server-Sent Events stream for real-time scan progress. The stream emits progress events as each stage completes and a final complete event containing the Q-Score and total findings count.',
    auth: 'jwt',
    rateLimit: '10 concurrent connections',
    isSSE: true,
    requestFields: [
      {
        field: 'scan_id',
        type: 'string (UUID)',
        required: true,
        description: 'The scan job identifier returned by POST /api/v1/scan. Passed as a query parameter.',
        example: '3f6a1b2c-4d5e-7890-abcd-ef1234567890',
      },
    ],
    responseFields: [
      {
        field: 'progress',
        type: 'event',
        required: false,
        description:
          'Emitted after each scan stage completes. Payload includes: percent (0–100), stage (string label), findings_count (running total of vulnerabilities found so far).',
      },
      {
        field: 'complete',
        type: 'event',
        required: false,
        description:
          'Emitted once when the scan finishes. Payload includes: q_score (0–100 quantum risk score) and total_findings (final count of all detected vulnerabilities).',
      },
    ],
  },

  // 3. Scan History
  {
    method: 'GET',
    path: '/api/v1/scan/history',
    title: 'Scan History',
    description:
      'Retrieve a paginated list of all past scans for the authenticated user. Results are ordered by completion time descending.',
    auth: 'jwt',
    rateLimit: '100 req/min',
    requestFields: [
      {
        field: 'limit',
        type: 'number',
        required: false,
        description: 'Maximum number of scan records to return (1–100, default 20).',
        example: '20',
      },
      {
        field: 'offset',
        type: 'number',
        required: false,
        description: 'Pagination offset — number of records to skip before returning results.',
        example: '0',
      },
    ],
    responseFields: [
      {
        field: 'scans',
        type: 'ScanSummary[]',
        required: true,
        description: 'Array of past scan summaries.',
      },
      {
        field: 'scans[].id',
        type: 'string (UUID)',
        required: true,
        description: 'Unique scan identifier.',
      },
      {
        field: 'scans[].scope',
        type: 'string',
        required: true,
        description: 'Scan scope used: device-files | cloud-storage | git-repo | tls-certs | custom-path.',
      },
      {
        field: 'scans[].q_score',
        type: 'number',
        required: true,
        description: 'Quantum risk score assigned to this scan (0 = no risk, 100 = critically vulnerable).',
        example: '72',
      },
      {
        field: 'scans[].findings_count',
        type: 'number',
        required: true,
        description: 'Total number of vulnerabilities detected.',
        example: '14',
      },
      {
        field: 'scans[].completed_at',
        type: 'string (ISO 8601)',
        required: true,
        description: 'UTC timestamp when the scan completed.',
      },
      {
        field: 'total',
        type: 'number',
        required: true,
        description: 'Total number of scans available (for pagination).',
        example: '42',
      },
    ],
  },

  // 4. Scan Results
  {
    method: 'GET',
    path: '/api/v1/scan/results',
    title: 'Scan Results',
    description:
      'Fetch the full findings list for a completed scan. Filter by severity to focus on the most critical vulnerabilities first. Each finding includes the quantum-vulnerable algorithm detected, its location, estimated years until breakable by a quantum computer, and the NIST-recommended post-quantum replacement.',
    auth: 'jwt',
    rateLimit: '100 req/min',
    requestFields: [
      {
        field: 'scan_id',
        type: 'string (UUID)',
        required: true,
        description: 'The scan job identifier returned by POST /api/v1/scan.',
        example: '3f6a1b2c-4d5e-7890-abcd-ef1234567890',
      },
      {
        field: 'severity',
        type: 'enum',
        required: false,
        description:
          'Filter findings by severity level. One of: critical | high | medium | low. Omit to return all severities.',
        example: 'critical',
      },
    ],
    responseFields: [
      {
        field: 'findings',
        type: 'Finding[]',
        required: true,
        description: 'Array of detected quantum vulnerability findings.',
      },
      {
        field: 'findings[].algorithm',
        type: 'string',
        required: true,
        description: 'The quantum-vulnerable cryptographic algorithm detected.',
        example: 'RSA-2048',
      },
      {
        field: 'findings[].location',
        type: 'string',
        required: true,
        description: 'File path, hostname, or resource URI where the vulnerable algorithm was found.',
        example: 'example.com:443 (TLS Certificate)',
      },
      {
        field: 'findings[].severity',
        type: 'string',
        required: true,
        description: 'Risk severity: critical | high | medium | low.',
        example: 'critical',
      },
      {
        field: 'findings[].years_until_breakable',
        type: 'number',
        required: true,
        description:
          'Estimated years until a sufficiently capable quantum computer could break this algorithm under current trajectory models.',
        example: '7',
      },
      {
        field: 'findings[].recommended_replacement',
        type: 'string',
        required: true,
        description: 'NIST-approved post-quantum algorithm recommended to replace the vulnerable one.',
        example: 'ML-KEM-1024',
      },
      {
        field: 'total',
        type: 'number',
        required: true,
        description: 'Total number of findings matching the query (before any limit/offset).',
        example: '14',
      },
    ],
  },
]

// ─── Quick-start code snippet ─────────────────────────────────────────────────

const QUICKSTART_SNIPPET = `// 1. Start a TLS certificate scan
const start = await fetch('http://localhost:4000/api/v1/scan', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <jwt>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    scope: 'tls-certs',
    target: 'example.com',
    deep_scan: true,
  }),
})
const { scan_id } = await start.json()

// 2. Stream real-time progress
const stream = new EventSource(
  \`http://localhost:4000/api/v1/scan/stream?scan_id=\${scan_id}\`,
  { headers: { Authorization: 'Bearer <jwt>' } }
)

stream.addEventListener('progress', (e) => {
  const { percent, stage, findings_count } = JSON.parse(e.data)
  console.log(\`[\${percent}%] \${stage} — \${findings_count} findings so far\`)
})

stream.addEventListener('complete', async (e) => {
  const { q_score, total_findings } = JSON.parse(e.data)
  console.log(\`Scan complete — Q-Score: \${q_score}, Total: \${total_findings}\`)
  stream.close()

  // 3. Fetch critical findings
  const res = await fetch(
    \`http://localhost:4000/api/v1/scan/results?scan_id=\${scan_id}&severity=critical\`,
    { headers: { Authorization: 'Bearer <jwt>' } }
  )
  const { findings } = await res.json()
  findings.forEach(f => {
    console.log(\`\${f.algorithm} @ \${f.location} → replace with \${f.recommended_replacement}\`)
  })
})`

// ─── DeepDive content ─────────────────────────────────────────────────────────

const deepDiveSummary = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--qg-text-primary)',
    }}>
      Scanner Architecture, Q-Score &amp; NIST Compliance
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      The Quantum Vulnerability Scanner inspects cryptographic primitives across your entire
      infrastructure and assigns a Q-Score — a single risk metric that quantifies your
      quantum exposure. Findings are mapped directly to NIST Post-Quantum Cryptography
      standards, enabling automated compliance report generation.
    </p>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[
        { label: 'Detection Engine', value: 'Static + Dynamic' },
        { label: 'Q-Score Range', value: '0 – 100' },
        { label: 'NIST Alignment', value: 'FIPS 203 / 204 / 205' },
        { label: 'Scopes', value: '5 target types' },
      ].map(({ label, value }) => (
        <div key={label} style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--qg-border)',
          background: 'rgba(0,212,255,0.04)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--qg-text-muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            {label}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--qg-cyan)',
            fontWeight: 600,
          }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  </div>
)

const deepDiveDetail = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

    {/* Scan pipeline */}
    <section>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
        marginBottom: 10,
      }}>
        1. Scan Pipeline
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        Each scan job passes through five sequential stages. Progress events are emitted after
        each stage completes, giving real-time visibility into the pipeline state:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          {
            stage: '1. Discovery',
            detail: 'Enumerate all assets reachable from the target — TLS endpoints, file paths, Git objects, or cloud objects — building a complete inventory of cryptographic surface area.',
          },
          {
            stage: '2. Extraction',
            detail: 'Extract cryptographic primitives from each asset: certificate public key algorithms, cipher suites, key sizes, hash functions, and signing schemes.',
          },
          {
            stage: '3. Classification',
            detail: 'Map each primitive against the QGuard vulnerability database to determine quantum breakability. Algorithms are tagged with their estimated cryptographic lifetime under CRQC (Cryptographically Relevant Quantum Computer) trajectory models.',
          },
          {
            stage: '4. Scoring',
            detail: 'Compute per-finding severity (critical / high / medium / low) based on algorithm type, key size, exposure surface, and time-to-breakable. Aggregate into the Q-Score.',
          },
          {
            stage: '5. Reporting',
            detail: 'Persist findings, generate the NIST compliance report, and emit the complete SSE event to all subscribed stream clients.',
          },
        ].map(({ stage, detail }) => (
          <div key={stage} style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid var(--qg-border)',
            background: 'rgba(255,255,255,0.015)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--qg-violet)',
              marginBottom: 4,
            }}>
              {stage}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--qg-text-secondary)' }}>
              {detail}
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Q-Score formula */}
    <section>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
        marginBottom: 10,
      }}>
        2. Q-Score Formula
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        The Q-Score is a weighted risk metric bounded between 0 (no quantum exposure) and 100
        (critically vulnerable). It is calculated as follows:
      </p>
      <div style={{
        padding: '16px',
        borderRadius: 8,
        background: 'rgba(3,3,8,0.85)',
        border: '1px solid var(--qg-border)',
        marginBottom: 12,
      }}>
        <pre style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          lineHeight: 1.8,
          color: 'var(--qg-cyan)',
          overflowX: 'auto',
          whiteSpace: 'pre',
        }}>
{`Q-Score = min(100,
  Σ( finding_weight(severity) × exposure_factor(location) )
    × time_urgency_multiplier(years_until_breakable)
    / total_assets
  × 100
)

Severity weights:
  critical → 1.0
  high     → 0.65
  medium   → 0.35
  low      → 0.10

time_urgency_multiplier:
  years ≤ 5   → 2.0   (imminent threat)
  years 6–10  → 1.5
  years 11–15 → 1.0
  years > 15  → 0.7`}
        </pre>
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        The <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-violet)' }}>exposure_factor</code> is
        a 0.0–1.0 multiplier based on asset reachability: internet-facing TLS endpoints score 1.0,
        internal services 0.6, and offline/cold-storage assets 0.2.
      </p>
    </section>

    {/* NIST compliance report generation */}
    <section>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
        marginBottom: 10,
      }}>
        3. NIST Compliance Report Generation
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        On scan completion, QGuard automatically generates a NIST Post-Quantum Cryptography
        compliance report aligned with FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), and FIPS 205
        (SLH-DSA). Each finding is annotated with:
      </p>
      <ul style={{ paddingLeft: 20, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          'The vulnerable algorithm and its NIST deprecation status (deprecated | harvest-now-decrypt-later risk | sunset-scheduled).',
          'The NIST-approved replacement algorithm and the migration complexity estimate (low / medium / high).',
          'A machine-readable remediation plan in JSON and PDF format for submission to compliance auditors.',
          'A crypto-agility readiness score — measuring how easily your codebase can be migrated without architectural changes.',
        ].map((item, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            {item}
          </li>
        ))}
      </ul>
      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'KEM Standard', value: 'FIPS 203 — ML-KEM' },
          { label: 'Signature Standard', value: 'FIPS 204 — ML-DSA' },
          { label: 'Hash-Sig Standard', value: 'FIPS 205 — SLH-DSA' },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--qg-border)',
            background: 'rgba(139,92,246,0.06)',
            flex: 1,
            minWidth: 180,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--qg-text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--qg-violet)',
              fontWeight: 600,
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>

  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScannerApiPage() {
  return (
    <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 40 }}>

      {/* Header */}
      <div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--qg-cyan)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          API Reference
        </span>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 800,
          marginTop: 8,
          letterSpacing: '-0.02em',
          color: 'var(--qg-text-primary)',
        }}>
          Quantum Vulnerability Scanner
        </h1>
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--qg-text-secondary)',
          marginTop: 12,
          maxWidth: 640,
        }}>
          Detect quantum-vulnerable cryptography across your infrastructure. Scan TLS certificates,
          device files, cloud storage, Git repositories, and custom paths. Results include
          per-finding severity, estimated years until breakable, and NIST-approved replacement
          recommendations — with a real-time SSE stream and a single Q-Score for your posture.
        </p>
      </div>

      {/* Quick start */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 24,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Quick Start
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
        }}>
          {[
            { label: 'Base URL', value: 'http://localhost:4000' },
            { label: 'Auth', value: 'Bearer JWT' },
            { label: 'Streaming', value: 'Server-Sent Events' },
            { label: 'Rate Limit', value: '10–100 req/min' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              padding: '14px 16px',
              borderRadius: 10,
              border: '1px solid var(--qg-border)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--qg-text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}>
                {label}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--qg-text-primary)',
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Quickstart callout */}
        <div style={{
          borderRadius: 10,
          border: '1px solid rgba(255,45,85,0.25)',
          overflow: 'hidden',
          background: 'rgba(255,45,85,0.03)',
        }}>
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255,45,85,0.15)',
            background: 'rgba(255,45,85,0.06)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--qg-red)',
            letterSpacing: '0.08em',
          }}>
            JavaScript — Scan, Stream &amp; Retrieve Findings
          </div>
          <pre style={{
            margin: 0,
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.7,
            color: 'var(--qg-text-primary)',
            overflowX: 'auto',
            whiteSpace: 'pre',
          }}>
            {QUICKSTART_SNIPPET}
          </pre>
        </div>
      </section>

      {/* Endpoint cards */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 24,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Endpoints
        </h2>
        {ENDPOINTS.map((ep) => (
          <EndpointCard key={`${ep.method}:${ep.path}`} endpoint={ep} />
        ))}
      </section>

      {/* DeepDive */}
      <section style={{ paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          marginBottom: 16,
        }}>
          Architecture Deep Dive
        </h2>
        <DeepDive
          summary={deepDiveSummary}
          detail={deepDiveDetail}
          label="Show Technical Architecture Detail"
        />
      </section>

    </div>
  )
}
