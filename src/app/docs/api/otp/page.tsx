'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'

const endpoints: EndpointDoc[] = [
  {
    method: 'POST',
    path: '/api/v1/qrng/generate/stream',
    title: 'Generate Single OTP',
    description:
      'Stream a single quantum-random OTP via Server-Sent Events. The QRNG microservice draws entropy directly from a hardware quantum source, applies NIST SP 800-90B health checks, then formats the output to the requested schema.',
    auth: 'jwt',
    isSSE: true,
    rateLimit: '60 req/min Standard · 600 req/min Enterprise',
    requestFields: [
      { field: 'action', type: '"otp"', required: true, description: 'Must be the literal string "otp"', example: '"otp"' },
      { field: 'length', type: '4 | 6 | 8 | 10 | 12', required: true, description: 'Number of characters in the generated OTP', example: '6' },
      { field: 'format', type: '"numeric" | "alphanumeric" | "hex" | "base32" | "pin"', required: true, description: 'Output encoding for the OTP', example: '"numeric"' },
      { field: 'purpose', type: '"login" | "transaction" | "password-reset" | "email-verify" | "device-pairing" | "admin-action"', required: true, description: 'Intended use-case — stored with the OTP for audit purposes', example: '"login"' },
      { field: 'expires_in_seconds', type: 'number (30–1800)', required: false, description: 'Validity window in seconds. Defaults to 300 (5 min).', example: '300' },
    ],
    responseFields: [
      { field: 'otp', type: 'string', required: true, description: 'The generated one-time password', example: '"482931"' },
      { field: 'format', type: 'string', required: true, description: 'Format used for this OTP', example: '"numeric"' },
      { field: 'length', type: 'number', required: true, description: 'Character length of the OTP', example: '6' },
      { field: 'quality_score', type: 'number (0–1)', required: true, description: 'NIST entropy quality rating for this token', example: '0.98' },
      { field: 'entropy_source', type: 'string', required: true, description: 'Hardware entropy source identifier', example: '"qrng-v2"' },
      { field: 'expires_in_seconds', type: 'number', required: true, description: 'Seconds until expiry', example: '300' },
    ],
    requestBody: { action: 'otp', length: 6, format: 'numeric', purpose: 'login', expires_in_seconds: 300 },
    responseExample: JSON.stringify({ otp: '482931', format: 'numeric', length: 6, quality_score: 0.98, entropy_source: 'qrng-v2', expires_in_seconds: 300 }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/qrng/generate/stream',
    title: 'Batch Generate OTPs',
    description:
      'Generate 2–50 quantum-random OTPs in a single SSE stream. Useful for pre-generating token pools or bulk-issuing codes for a campaign. Each token in the batch receives an independent entropy draw.',
    auth: 'jwt',
    isSSE: true,
    rateLimit: '20 req/min',
    requestFields: [
      { field: 'action', type: '"otp"', required: true, description: 'Must be the literal string "otp"', example: '"otp"' },
      { field: 'batch', type: 'true', required: true, description: 'Enable batch mode', example: 'true' },
      { field: 'count', type: 'number (2–50)', required: true, description: 'Number of OTPs to generate', example: '10' },
      { field: 'length', type: '4 | 6 | 8 | 10 | 12', required: true, description: 'Length of each OTP', example: '6' },
      { field: 'format', type: '"numeric" | "alphanumeric" | "hex" | "base32" | "pin"', required: true, description: 'Output encoding applied to every token in the batch', example: '"numeric"' },
      { field: 'purpose', type: 'string', required: true, description: 'Intended use-case for audit', example: '"email-verify"' },
      { field: 'expires_in_seconds', type: 'number (30–1800)', required: false, description: 'Shared validity window for all tokens', example: '600' },
    ],
    responseFields: [
      { field: 'otps', type: 'string[]', required: true, description: 'Array of generated one-time passwords', example: '["482931","773012"]' },
      { field: 'count', type: 'number', required: true, description: 'Number of OTPs returned', example: '10' },
      { field: 'quality_score', type: 'number (0–1)', required: true, description: 'Aggregate NIST entropy quality for the batch', example: '0.97' },
    ],
    requestBody: { action: 'otp', batch: true, count: 10, length: 6, format: 'numeric', purpose: 'email-verify', expires_in_seconds: 600 },
    responseExample: JSON.stringify({ otps: ['482931', '773012', '190283'], count: 10, quality_score: 0.97 }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/otp',
    title: 'Persist OTP',
    description:
      'Store a previously generated OTP in Supabase with full metadata. Persisted tokens are subject to Row-Level Security — only the authenticated user can read or mutate their own records.',
    auth: 'jwt',
    rateLimit: '100 req/min Pro · 1000 req/min Elite',
    requestFields: [
      { field: 'otp', type: 'string', required: true, description: 'The OTP value returned by the generate endpoint', example: '"482931"' },
      { field: 'format', type: 'string', required: true, description: 'Format of the OTP', example: '"numeric"' },
      { field: 'length', type: 'number', required: true, description: 'Character length', example: '6' },
      { field: 'purpose', type: 'string', required: true, description: 'Use-case identifier', example: '"login"' },
      { field: 'quality_score', type: 'number', required: true, description: 'NIST quality score from generation', example: '0.98' },
      { field: 'entropy_source', type: 'string', required: true, description: 'Source identifier from generation', example: '"qrng-v2"' },
      { field: 'expires_in_seconds', type: 'number', required: true, description: 'Validity window in seconds', example: '300' },
    ],
    responseFields: [
      { field: 'id', type: 'string (UUID)', required: true, description: 'Unique identifier for the persisted OTP record', example: '"550e8400-e29b-41d4-a716-446655440000"' },
      { field: 'otp', type: 'string', required: true, description: 'The stored OTP value', example: '"482931"' },
      { field: 'status', type: '"active" | "expired" | "used"', required: true, description: 'Current lifecycle status', example: '"active"' },
      { field: 'created_at', type: 'string (ISO 8601)', required: true, description: 'Timestamp of record creation', example: '"2026-04-07T10:00:00Z"' },
    ],
    requestBody: { otp: '482931', format: 'numeric', length: 6, purpose: 'login', quality_score: 0.98, entropy_source: 'qrng-v2', expires_in_seconds: 300 },
    responseExample: JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000', otp: '482931', status: 'active', created_at: '2026-04-07T10:00:00Z' }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/otp',
    title: 'List OTP History',
    description:
      'Retrieve a paginated list of OTP records belonging to the authenticated user, with optional status filtering and aggregate statistics.',
    auth: 'jwt',
    rateLimit: '200 req/min',
    requestFields: [
      { field: 'limit', type: 'number', required: false, description: 'Page size. Defaults to 50.', example: '50' },
      { field: 'offset', type: 'number', required: false, description: 'Pagination offset. Defaults to 0.', example: '0' },
      { field: 'status', type: '"active" | "expired" | "used"', required: false, description: 'Filter records by lifecycle status', example: '"active"' },
    ],
    responseFields: [
      { field: 'otps', type: 'object[]', required: true, description: 'Array of OTP records matching the query', example: '[{id, otp, status, created_at}]' },
      { field: 'total', type: 'number', required: true, description: 'Total count of records matching filters (ignoring pagination)', example: '142' },
      { field: 'stats', type: 'object', required: true, description: 'Aggregate breakdown: { active, expired, used }', example: '{"active":12,"expired":98,"used":32}' },
    ],
    requestBody: undefined,
    responseExample: JSON.stringify({ otps: [{ id: '550e8400-e29b-41d4-a716-446655440000', otp: '482931', status: 'active', created_at: '2026-04-07T10:00:00Z' }], total: 142, stats: { active: 12, expired: 98, used: 32 } }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/otp/validate',
    title: 'Validate OTP',
    description:
      'Verify a stored OTP against a submitted value using a constant-time comparison to prevent timing attacks. A successful validation immediately transitions the token status to "used", preventing replay.',
    auth: 'jwt',
    rateLimit: '50 req/min (security-limited)',
    requestFields: [
      { field: 'otp_id', type: 'string (UUID)', required: true, description: 'ID of the OTP record to validate', example: '"550e8400-e29b-41d4-a716-446655440000"' },
      { field: 'otp_value', type: 'string', required: true, description: 'The candidate OTP value provided by the user', example: '"482931"' },
    ],
    responseFields: [
      { field: 'valid', type: 'boolean', required: true, description: 'Whether the submitted value matches and the token is still active', example: 'true' },
      { field: 'reason', type: 'string', required: true, description: 'Human-readable result description', example: '"OTP validated successfully"' },
      { field: 'security_level', type: '"quantum"', required: true, description: 'Confirms quantum entropy source was used', example: '"quantum"' },
    ],
    requestBody: { otp_id: '550e8400-e29b-41d4-a716-446655440000', otp_value: '482931' },
    responseExample: JSON.stringify({ valid: true, reason: 'OTP validated successfully', security_level: 'quantum' }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/otp/stream',
    title: 'Real-Time OTP Stream',
    description:
      'Open a persistent SSE connection that pushes live OTP events for the authenticated user. An initial "snapshot" event delivers current active tokens; subsequent "new_otps" events arrive whenever new records are persisted.',
    auth: 'jwt',
    isSSE: true,
    rateLimit: '10 concurrent connections',
    requestFields: [
      { field: 'token', type: 'string (JWT)', required: true, description: 'JWT passed as a query parameter since EventSource cannot set headers', example: 'eyJhbGci...' },
    ],
    responseFields: [
      { field: 'snapshot', type: 'object[]', required: false, description: 'Initial batch of active OTP records sent on connection open', example: '[{id, otp, status}]' },
      { field: 'new_otps', type: 'object[]', required: false, description: 'Incremental array of new OTP records pushed in real time', example: '[{id, otp, status}]' },
    ],
    requestBody: undefined,
    responseExample: 'event: snapshot\ndata: [{"id":"550e8400...","otp":"482931","status":"active"}]\n\nevent: new_otps\ndata: [{"id":"660f9500...","otp":"837402","status":"active"}]',
  },
  {
    method: 'DELETE',
    path: '/api/v1/otp',
    title: 'Delete OTP',
    description:
      'Permanently remove a single OTP record belonging to the authenticated user. Row-Level Security ensures users can only delete their own tokens.',
    auth: 'jwt',
    rateLimit: '100 req/min',
    requestFields: [
      { field: 'id', type: 'string (UUID)', required: true, description: 'Query parameter — ID of the OTP record to delete', example: '550e8400-e29b-41d4-a716-446655440000' },
    ],
    responseFields: [
      { field: 'success', type: 'boolean', required: true, description: 'True when the record was found and deleted', example: 'true' },
    ],
    requestBody: undefined,
    responseExample: JSON.stringify({ success: true }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/qrng/status',
    title: 'QRNG Health Check',
    description:
      'Returns the current operational status of the QRNG hardware entropy source. No authentication required — designed for uptime monitors and load-balancer health probes.',
    auth: 'none',
    rateLimit: '300 req/min',
    requestFields: [],
    responseFields: [
      { field: 'status', type: '"ok" | "degraded" | "offline"', required: true, description: 'Current operational state of the QRNG service', example: '"ok"' },
      { field: 'entropy_source', type: 'string', required: true, description: 'Active hardware entropy source identifier', example: '"qrng-v2"' },
      { field: 'uptime', type: 'number', required: true, description: 'Seconds the service has been running without interruption', example: '864000' },
    ],
    requestBody: undefined,
    responseExample: JSON.stringify({ status: 'ok', entropy_source: 'qrng-v2', uptime: 864000 }, null, 2),
  },
]

// ─── Styles ──────────────────────────────────────────────────────────────────

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--qg-text-primary)',
  marginBottom: 12,
  paddingTop: 24,
  borderTop: '1px solid var(--qg-border)',
}

const monoSmall: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--qg-cyan)',
}

// ─── DeepDive content ────────────────────────────────────────────────────────

const deepDiveSummary = (
  <div>
    <div style={sectionHeadingStyle}>OTP Architecture Overview</div>
    <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)' }}>
      Every OTP in QGuard is derived from true quantum randomness. The pipeline flows as follows:
    </p>
    <ol style={{ paddingLeft: 20, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        'QRNG hardware generates raw entropy bits',
        'NIST SP 800-90B health checks validate entropy quality',
        'Format mapping converts bits to the requested schema (numeric, alphanumeric, hex, base32, or pin)',
        'The formatted token is emitted via Server-Sent Events',
        'The caller optionally persists the token to Supabase',
        'Supabase Row-Level Security restricts access to the owning user',
        'Validation uses constant-time comparison and immediately marks the token as used',
      ].map((step, i) => (
        <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
          <span style={{ ...monoSmall, marginRight: 8 }}>0{i + 1}.</span>
          {step}
        </li>
      ))}
    </ol>
  </div>
)

const deepDiveDetail = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
    {/* Entropy pipeline */}
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Entropy Pipeline (7-step flow)
      </div>
      <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { step: 'Photon detection', detail: 'Hardware photon-counting module captures quantum shot noise at ~10 Mbit/s' },
          { step: 'Raw bit extraction', detail: 'Von Neumann extractor removes bias from raw photon timing differences' },
          { step: 'NIST SP 800-90B validation', detail: 'Adaptive proportion test + repetition count test run on every 512-bit block' },
          { step: 'CSPRNG seeding', detail: 'Validated entropy seeds a ChaCha20-based CSPRNG for high-throughput output' },
          { step: 'Format mapping', detail: 'CSPRNG output is mapped to the target alphabet (numeric, base32, hex, etc.) using rejection sampling to avoid modulo bias' },
          { step: 'Quality scoring', detail: 'Shannon entropy of the final token is computed and returned as quality_score (0–1)' },
          { step: 'SSE emission', detail: 'Token is streamed to the client as a JSON SSE event with metadata' },
        ].map(({ step, detail }, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)', marginBottom: 4 }}>
            <span style={{ ...monoSmall, marginRight: 6 }}>{i + 1}.</span>
            <strong style={{ color: 'var(--qg-text-primary)' }}>{step}</strong> — {detail}
          </li>
        ))}
      </ol>
    </div>

    {/* Timing-safe validation */}
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Timing-Safe Validation
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)' }}>
        The <code style={monoSmall}>/api/v1/otp/validate</code> endpoint uses a constant-time string comparison (equivalent to Node.js{' '}
        <code style={monoSmall}>crypto.timingSafeEqual</code>) so that an attacker cannot infer the number of correct characters
        from response latency. The comparison always runs for the full token length regardless of where the first mismatch occurs.
        After a successful match, the record status is atomically set to <code style={monoSmall}>"used"</code> inside a Supabase
        transaction — preventing concurrent replay even under high-concurrency conditions.
      </p>
    </div>

    {/* Threat model */}
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Threat Model
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          {
            threat: 'Brute Force',
            mitigation: 'Validation is rate-limited to 50 req/min per user. After 5 consecutive failures the token is automatically invalidated.',
          },
          {
            threat: 'Replay Attack',
            mitigation: 'Each token transitions to "used" on first successful validation. Subsequent attempts return valid: false regardless of value.',
          },
          {
            threat: 'Interception / MITM',
            mitigation: 'All API traffic must be served over TLS. The QRNG SSE stream uses short-lived JWT bearer tokens transmitted only in headers (never in URLs), except for the streaming endpoint where a short-lived token query param is used.',
          },
          {
            threat: 'Timing Attack',
            mitigation: 'Constant-time comparison removes response-latency side channels. See Timing-Safe Validation section above.',
          },
        ].map(({ threat, mitigation }) => (
          <div key={threat} style={{ borderRadius: 8, border: '1px solid var(--qg-border)', padding: '12px 16px', background: 'rgba(0,212,255,0.02)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--qg-cyan)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {threat}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>{mitigation}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OTPApiPage() {
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
          OTP / Multi-Factor Authentication
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginTop: 12 }}>
          Generate, store, validate, and stream one-time passwords backed by hardware quantum randomness.
          Tokens are produced by the QRNG microservice, validated by NIST SP 800-90B health checks, and
          persisted in Supabase with Row-Level Security so each user controls only their own records.
        </p>
      </div>

      {/* Quick start callout */}
      <div style={{
        borderRadius: 10,
        border: '1px solid rgba(0,212,255,0.25)',
        background: 'rgba(0,212,255,0.04)',
        padding: '20px 24px',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--qg-cyan)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          Quick Start — 3 Steps
        </div>
        <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, margin: 0 }}>
          <li style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            <strong style={{ color: 'var(--qg-text-primary)' }}>Generate</strong> — Call{' '}
            <code style={monoSmall}>POST /api/v1/qrng/generate/stream</code> with{' '}
            <code style={monoSmall}>action: &quot;otp&quot;</code> to receive a quantum OTP via SSE.
          </li>
          <li style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            <strong style={{ color: 'var(--qg-text-primary)' }}>Persist</strong> — Call{' '}
            <code style={monoSmall}>POST /api/v1/otp</code> with the generated token to store it and receive a UUID.
          </li>
          <li style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            <strong style={{ color: 'var(--qg-text-primary)' }}>Validate</strong> — Call{' '}
            <code style={monoSmall}>POST /api/v1/otp/validate</code> with the UUID and the user-supplied value.
            A matching, non-expired token returns <code style={monoSmall}>valid: true</code> and is immediately consumed.
          </li>
        </ol>
      </div>

      {/* Endpoints */}
      <section>
        <h2 style={sectionHeadingStyle}>Endpoints</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {endpoints.map((ep, idx) => (
            <EndpointCard
              key={`${ep.method}:${ep.path}:${idx}`}
              endpoint={ep}
            />
          ))}
        </div>
      </section>

      {/* Deep dive */}
      <section>
        <h2 style={sectionHeadingStyle}>Architecture Deep Dive</h2>
        <DeepDive
          summary={deepDiveSummary}
          detail={deepDiveDetail}
          label="Show Technical Detail — Entropy Pipeline, Validation & Threat Model"
        />
      </section>
    </div>
  )
}
