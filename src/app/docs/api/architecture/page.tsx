'use client'

import { DeepDive } from '@/components/docs/DeepDive'
import { CodeBlock } from '@/components/docs/CodeBlock'

const SYSTEM_DIAGRAM = `Client Browser / SDK
        │
        ▼
┌─────────────────────┐
│  Next.js App        │  port 4000
│  (App Router)       │
│                     │
│  ┌───────────────┐  │
│  │  API Routes   │  │
│  │  /api/v1/*    │  │
│  └──────┬────────┘  │
└─────────┼───────────┘
          │
          ├─────────────────────────────┐
          │                             │
          ▼                             ▼
┌─────────────────────┐     ┌──────────────────────┐
│  QRNG FastAPI       │     │  Supabase PostgreSQL  │
│  Service            │     │                       │
│  port 8420          │     │  generated_keys       │
│                     │     │  otp_records          │
│  Qiskit             │     │  vault_items          │
│  AerSimulator       │     │  scan_results         │
└─────────────────────┘     └──────────────────────┘`

const AUTH_FLOW_DIAGRAM = `Client
  │
  │  POST /auth/v1/token (credentials)
  ▼
Supabase Auth
  │
  │  JWT (signed, expiring)
  ▼
Client stores token
  │
  │  request + Authorization: Bearer <JWT>
  ▼
Next.js API Middleware
  │
  │  verify signature + claims
  ▼
Service handler`

const SSE_DIAGRAM = `Client
  │
  │  POST /api/v1/qrng/generate/stream
  │  { action, length, format }
  ▼
QRNG FastAPI (port 8420)
  │
  │  Content-Type: text/event-stream
  │
  ├── event: progress  data: {"step":"circuit_creation","pct":14}
  ├── event: progress  data: {"step":"measurement","pct":28}
  ├── event: progress  data: {"step":"bit_extraction","pct":42}
  ├── event: progress  data: {"step":"nist_test","pct":57}
  ├── event: progress  data: {"step":"entropy_calc","pct":71}
  ├── event: progress  data: {"step":"quality_score","pct":85}
  └── event: result    data: {"value":"...","entropy":7.94,"quality":0.98}`

const RLS_PATTERN = `-- Row Level Security pattern (all key tables)
ALTER TABLE generated_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_rows" ON generated_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);`

const SLOWAPI_SNIPPET = `# slowapi middleware applied per-endpoint
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/generate/stream")
@limiter.limit("60/minute")          # Standard tier default
async def generate_stream(request: Request, ...):
    ...`

export default function ArchitecturePage() {
  return (
    <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Header */}
      <div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--qg-cyan)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          Architecture
        </span>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 800,
          marginTop: 8,
          letterSpacing: '-0.02em',
          color: 'var(--qg-text-primary)',
        }}>
          System Architecture
        </h1>
      </div>

      {/* High-level overview */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* System components */}
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--qg-text-primary)',
            marginBottom: 12,
            paddingTop: 24,
            borderTop: '1px solid var(--qg-border)',
          }}>
            System Components
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)' }}>
            QGuard is composed of four primary layers. The <strong style={{ color: 'var(--qg-text-primary)' }}>Next.js frontend and API routes</strong> run on port 4000 and handle all client-facing requests, authentication middleware, and proxying to downstream services. The <strong style={{ color: 'var(--qg-text-primary)' }}>QRNG FastAPI microservice</strong> runs on port 8420 and owns all quantum entropy generation via Qiskit AerSimulator. <strong style={{ color: 'var(--qg-text-primary)' }}>Supabase PostgreSQL</strong> provides the persistence layer with Row Level Security enforced at the database level.
          </p>
        </div>

        {/* ASCII architecture diagram */}
        <CodeBlock
          language="bash"
          title="System topology"
          code={SYSTEM_DIAGRAM}
        />

        {/* Authentication flow */}
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--qg-text-primary)',
            marginBottom: 12,
            paddingTop: 24,
            borderTop: '1px solid var(--qg-border)',
          }}>
            Authentication Flow
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginBottom: 16 }}>
            Clients authenticate against Supabase Auth to receive a signed JWT. That token is attached to every subsequent request and verified by Next.js API middleware before any service handler is invoked.
          </p>
          <CodeBlock
            language="bash"
            title="JWT authentication flow"
            code={AUTH_FLOW_DIAGRAM}
          />
        </div>

        {/* SSE streaming */}
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--qg-text-primary)',
            marginBottom: 12,
            paddingTop: 24,
            borderTop: '1px solid var(--qg-border)',
          }}>
            SSE Streaming
          </h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginBottom: 16 }}>
            Long-running generation requests use Server-Sent Events. A single <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>POST</code> opens a persistent <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>text/event-stream</code> response. The server emits <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>progress</code> events at each pipeline step and a final <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>result</code> event carrying the entropy output.
          </p>
          <CodeBlock
            language="bash"
            title="SSE event sequence"
            code={SSE_DIAGRAM}
          />
        </div>
      </section>

      {/* DeepDive 1: QRNG Entropy Pipeline */}
      <section style={{ paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          marginBottom: 16,
        }}>
          QRNG Entropy Pipeline
        </h2>
        <DeepDive
          summary={
            <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
              Quantum entropy is sourced from <strong style={{ color: 'var(--qg-text-primary)' }}>Qiskit AerSimulator</strong> and validated against <strong style={{ color: 'var(--qg-text-primary)' }}>NIST SP 800-90B</strong> before any value is returned to a caller. When the simulator is unavailable the service falls back to a <strong style={{ color: 'var(--qg-text-primary)' }}>CSPRNG</strong> and marks the response accordingly.
            </p>
          }
          detail={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
                The pipeline executes seven sequential steps for every generation request:
              </p>
              <ol style={{ fontSize: 14, lineHeight: 2, color: 'var(--qg-text-secondary)', paddingLeft: 20, margin: 0 }}>
                <li><strong style={{ color: 'var(--qg-cyan)' }}>Circuit creation</strong> — a parameterised Hadamard circuit is built for the requested bit width.</li>
                <li><strong style={{ color: 'var(--qg-cyan)' }}>Measurement</strong> — AerSimulator runs the circuit and produces a shot distribution.</li>
                <li><strong style={{ color: 'var(--qg-cyan)' }}>Bit extraction</strong> — raw measurement outcomes are flattened into a bitstring.</li>
                <li><strong style={{ color: 'var(--qg-cyan)' }}>NIST frequency test</strong> — SP 800-90B monobit frequency test is applied; samples that fail are discarded.</li>
                <li><strong style={{ color: 'var(--qg-cyan)' }}>Shannon entropy calculation</strong> — per-symbol entropy is computed over the accepted bit pool.</li>
                <li><strong style={{ color: 'var(--qg-cyan)' }}>Quality scoring</strong> — a composite score (0–1) is derived from frequency, entropy, and run-length metrics.</li>
                <li><strong style={{ color: 'var(--qg-cyan)' }}>Format mapping</strong> — the bit pool is converted to the requested output format (numeric, hex, base64, uuid, passphrase).</li>
              </ol>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
                If AerSimulator is unavailable at step 2 the service substitutes <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-amber)' }}>secrets.token_bytes</code> (OS CSPRNG) and sets <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-amber)' }}>source: "csprng_fallback"</code> in the result payload so callers can detect the downgrade.
              </p>
            </div>
          }
          label="Show Pipeline Detail"
        />
      </section>

      {/* DeepDive 2: Database Architecture */}
      <section style={{ paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          marginBottom: 16,
        }}>
          Database Architecture
        </h2>
        <DeepDive
          summary={
            <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
              All persistent state lives in <strong style={{ color: 'var(--qg-text-primary)' }}>Supabase PostgreSQL</strong> with <strong style={{ color: 'var(--qg-text-primary)' }}>Row Level Security</strong> enabled on every user-owned table. No application-level filter is trusted as the sole access control boundary.
            </p>
          }
          detail={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
                Key tables and their responsibilities:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { table: 'generated_keys', desc: 'Persisted cryptographic key records with metadata, expiry, and revocation status.' },
                  { table: 'otp_records', desc: 'One-time password records with TTL, usage count, and HMAC verification hash.' },
                  { table: 'vault_items', desc: 'AES-256-GCM encrypted secrets; ciphertext stored, plaintext never written to disk.' },
                  { table: 'scan_results', desc: 'Entropy and vulnerability scan outputs linked to the triggering user and key.' },
                ].map(({ table, desc }) => (
                  <div key={table} style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(0,212,255,0.04)',
                    border: '1px solid var(--qg-border)',
                  }}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)', whiteSpace: 'nowrap', alignSelf: 'flex-start', paddingTop: 1 }}>{table}</code>
                    <span style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>{desc}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
                RLS policy pattern applied to all user-owned tables:
              </p>
              <CodeBlock language="bash" title="RLS policy pattern" code={RLS_PATTERN} />
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
                Supabase connection pooling (PgBouncer in transaction mode) is used for all API route connections. Long-running background jobs use a dedicated direct connection to avoid pool exhaustion.
              </p>
            </div>
          }
          label="Show Database Detail"
        />
      </section>

      {/* DeepDive 3: Rate Limiting & Scaling */}
      <section style={{ paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          marginBottom: 16,
        }}>
          Rate Limiting &amp; Scaling
        </h2>
        <DeepDive
          summary={
            <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
              Limits are enforced <strong style={{ color: 'var(--qg-text-primary)' }}>per-user, per-tier, and per-endpoint</strong>. The QRNG service applies limits via <strong style={{ color: 'var(--qg-text-primary)' }}>slowapi</strong> middleware; the Next.js API layer enforces tier checks against the user record before proxying requests downstream.
            </p>
          }
          detail={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
                Tier limits (requests per minute, per endpoint unless noted):
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--qg-border)' }}>
                      {['Tier', 'QRNG Generate', 'Key Operations', 'Vault', 'Scan'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--qg-text-muted)', fontWeight: 600, letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tier: 'Standard', qrng: '60 / min', keys: '30 / min', vault: '20 / min', scan: '10 / min' },
                      { tier: 'Pro', qrng: '300 / min', keys: '150 / min', vault: '100 / min', scan: '50 / min' },
                      { tier: 'Enterprise', qrng: 'unlimited', keys: 'unlimited', vault: 'unlimited', scan: 'unlimited' },
                    ].map(row => (
                      <tr key={row.tier} style={{ borderBottom: '1px solid var(--qg-border)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--qg-cyan)' }}>{row.tier}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--qg-text-secondary)' }}>{row.qrng}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--qg-text-secondary)' }}>{row.keys}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--qg-text-secondary)' }}>{row.vault}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--qg-text-secondary)' }}>{row.scan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CodeBlock language="python" title="slowapi middleware (QRNG service)" code={SLOWAPI_SNIPPET} />
              <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
                Horizontal scaling considerations: the Next.js layer is stateless and scales behind any load balancer. The QRNG service maintains no persistent state between requests and can be replicated freely. Shared rate-limit counters require a Redis backend (configured via <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>REDIS_URL</code>) when running more than one QRNG replica; single-replica deployments use in-process memory counters by default.
              </p>
            </div>
          }
          label="Show Rate Limiting Detail"
        />
      </section>

    </div>
  )
}
