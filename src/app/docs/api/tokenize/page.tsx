'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'
import type { SchemaField } from '@/components/docs/SchemaTable'

// ─── Endpoint 1: Tokenize Single Value ────────────────────────────────────────

const TOKENIZE_SINGLE_REQUEST: SchemaField[] = [
  {
    field: 'action',
    type: 'string',
    required: true,
    description: 'Must be set to "tokenize" to invoke the tokenization pipeline.',
    example: '"tokenize"',
  },
  {
    field: 'sensitive_data',
    type: 'string',
    required: true,
    description: 'The raw sensitive value to tokenize. Transmitted over TLS; never persisted.',
    example: '4111111111111111',
  },
  {
    field: 'data_type',
    type: 'enum',
    required: true,
    description: 'Semantic type of the value. Controls format-preserving rules and validation.',
    example: 'credit-card | ssn | phone | email | account | custom',
  },
  {
    field: 'format_preserving',
    type: 'boolean',
    required: false,
    description: 'When true, the returned token mirrors the structural format of the original value (length, separators, character classes).',
    example: 'true',
  },
  {
    field: 'token_prefix',
    type: 'string',
    required: false,
    description: 'Static prefix prepended to the generated token for namespace disambiguation.',
    example: '"tok_"',
  },
]

const TOKENIZE_SINGLE_RESPONSE: SchemaField[] = [
  {
    field: 'token_id',
    type: 'string (uuid)',
    required: true,
    description: 'Stable identifier for this token record. Use for detokenization lookups.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  },
  {
    field: 'token_value',
    type: 'string',
    required: true,
    description: 'The generated token. Format-preserved when format_preserving is true.',
    example: 'tok_4111XXXXXXXX1111',
  },
  {
    field: 'data_type',
    type: 'string',
    required: true,
    description: 'Echo of the data_type submitted in the request.',
    example: 'credit-card',
  },
  {
    field: 'format_preserving',
    type: 'boolean',
    required: true,
    description: 'Whether format-preserving encryption was applied.',
    example: 'true',
  },
  {
    field: 'binding_hmac',
    type: 'string (hex)',
    required: true,
    description: 'HMAC-SHA256 binding tag computed over token_id + token_value. Used for integrity verification.',
    example: 'a3f2b1...',
  },
  {
    field: 'quality_score',
    type: 'number (0–1)',
    required: true,
    description: 'Quantum entropy quality score from the QRNG source. Values below 0.8 trigger automatic re-seeding.',
    example: '0.97',
  },
  {
    field: 'entropy_source',
    type: 'string',
    required: true,
    description: 'Identifier of the QRNG entropy pool that seeded this token generation.',
    example: 'qrng-pool-primary',
  },
]

const TOKENIZE_SINGLE_ENDPOINT: EndpointDoc = {
  method: 'POST',
  path: '/api/v1/qrng/generate/stream',
  title: 'Tokenize Single Value',
  description:
    'Tokenizes a single sensitive value using QRNG-seeded entropy. Returns a structured SSE stream that emits one tokenization result event followed by a completion event. Supports format-preserving encryption for drop-in token compatibility.',
  auth: 'jwt',
  rateLimit: '60 req/min Standard · 500 req/min Enterprise',
  isSSE: true,
  requestFields: TOKENIZE_SINGLE_REQUEST,
  responseFields: TOKENIZE_SINGLE_RESPONSE,
  requestBody: {
    action: 'tokenize',
    sensitive_data: '4111111111111111',
    data_type: 'credit-card',
    format_preserving: true,
    token_prefix: 'tok_',
  },
}

// ─── Endpoint 2: Batch Tokenization ───────────────────────────────────────────

const TOKENIZE_BATCH_REQUEST: SchemaField[] = [
  {
    field: 'action',
    type: 'string',
    required: true,
    description: 'Must be "tokenize".',
    example: '"tokenize"',
  },
  {
    field: 'batch',
    type: 'boolean',
    required: true,
    description: 'Must be true to activate batch processing mode.',
    example: 'true',
  },
  {
    field: 'sensitive_data_batch',
    type: 'string[]',
    required: true,
    description: 'Array of raw sensitive values to tokenize. Maximum 500 items per request.',
    example: '["4111111111111111", "078-05-1120"]',
  },
  {
    field: 'data_type',
    type: 'enum',
    required: true,
    description: 'Applied uniformly to all items in the batch.',
    example: 'credit-card | ssn | phone | email | account | custom',
  },
  {
    field: 'format_preserving',
    type: 'boolean',
    required: false,
    description: 'Apply format-preserving encryption to every token in the batch.',
    example: 'true',
  },
  {
    field: 'token_prefix',
    type: 'string',
    required: false,
    description: 'Prefix applied to every token in the batch.',
    example: '"tok_"',
  },
]

const TOKENIZE_BATCH_RESPONSE: SchemaField[] = [
  {
    field: 'tokens',
    type: 'object[]',
    required: true,
    description: 'Array of tokenization results, one per input value. Each object contains token_id, token_value, binding_hmac, and quality_score.',
  },
  {
    field: 'count',
    type: 'number',
    required: true,
    description: 'Total number of tokens generated. Matches the length of sensitive_data_batch.',
    example: '2',
  },
  {
    field: 'quality_score',
    type: 'number (0–1)',
    required: true,
    description: 'Aggregate QRNG entropy quality score across the batch.',
    example: '0.95',
  },
]

const TOKENIZE_BATCH_ENDPOINT: EndpointDoc = {
  method: 'POST',
  path: '/api/v1/qrng/generate/stream',
  title: 'Batch Tokenization',
  description:
    'Tokenizes up to 500 sensitive values in a single streaming request. The SSE stream emits incremental progress events as tokens are generated, followed by a final summary event. Ideal for bulk data migration or nightly ETL pipelines.',
  auth: 'jwt',
  rateLimit: '20 req/min',
  isSSE: true,
  requestFields: TOKENIZE_BATCH_REQUEST,
  responseFields: TOKENIZE_BATCH_RESPONSE,
  requestBody: {
    action: 'tokenize',
    batch: true,
    sensitive_data_batch: ['4111111111111111', '078-05-1120'],
    data_type: 'credit-card',
    format_preserving: true,
    token_prefix: 'tok_',
  },
}

// ─── Endpoint 3: QRNG Health Check ────────────────────────────────────────────

const HEALTH_RESPONSE: SchemaField[] = [
  {
    field: 'status',
    type: 'string',
    required: true,
    description: '"ok" when all entropy pools are healthy, "degraded" when quality is below threshold.',
    example: 'ok',
  },
  {
    field: 'quality_score',
    type: 'number (0–1)',
    required: true,
    description: 'Current QRNG entropy quality score.',
    example: '0.98',
  },
  {
    field: 'pool',
    type: 'string',
    required: true,
    description: 'Active entropy pool identifier.',
    example: 'qrng-pool-primary',
  },
  {
    field: 'uptime_seconds',
    type: 'number',
    required: true,
    description: 'Seconds the QRNG service has been running since last restart.',
    example: '86400',
  },
]

const HEALTH_ENDPOINT: EndpointDoc = {
  method: 'GET',
  path: '/api/v1/qrng/status',
  title: 'QRNG Health Check',
  description:
    'Returns the current health and entropy quality of the underlying QRNG service. No authentication required. Use this endpoint to verify service availability and monitor quantum entropy pool quality before initiating tokenization workflows.',
  auth: 'none',
  rateLimit: '300 req/min',
  responseFields: HEALTH_RESPONSE,
}

// ─── DeepDive content ─────────────────────────────────────────────────────────

const DEEP_DIVE_SUMMARY = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--qg-text-primary)',
    }}>
      Tokenization Architecture Overview
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      QGuard tokenization is a three-stage pipeline: quantum entropy collection via the QRNG service,
      format-preserving encryption (FPE) using the FF3-1 algorithm seeded with that entropy, and
      HMAC-SHA256 binding to ensure token integrity across storage and retrieval. No raw sensitive
      data ever touches persistent storage.
    </p>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
    }}>
      {['QRNG Entropy', '→', 'FPE (FF3-1)', '→', 'HMAC Binding', '→', 'Token Issued'].map((s, i) => (
        <span key={i} style={{
          color: s === '→' ? 'var(--qg-text-muted)' : 'var(--qg-cyan)',
          background: s === '→' ? 'none' : 'rgba(0,212,255,0.08)',
          padding: s === '→' ? '0' : '4px 10px',
          borderRadius: s === '→' ? 0 : 6,
        }}>
          {s}
        </span>
      ))}
    </div>
  </div>
)

const COMPARISON_ROWS = [
  ['Reversibility', 'Via secure vault lookup', 'Via key (mathematical)'],
  ['Data exposure risk', 'Token is meaningless without vault', 'Ciphertext reveals length/structure'],
  ['Performance', 'Lookup latency on detokenize', 'Constant-time decrypt'],
  ['Format preservation', 'Native (FPE mode)', 'Requires padding'],
  ['PCI-DSS scope reduction', 'Yes — tokens out of scope', 'Depends on key management'],
  ['Key compromise impact', 'Vault integrity only', 'All ciphertext exposed'],
]

const DEEP_DIVE_DETAIL = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

    {/* Format-Preserving Encryption */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Format-Preserving Encryption (FPE)
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        When <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>format_preserving: true</code> is set,
        QGuard applies the NIST-standardized FF3-1 algorithm. The resulting token preserves the
        character set, length, and delimiter structure of the original value — a 16-digit credit card
        number produces a 16-digit token, an SSN in <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>XXX-XX-XXXX</code> format
        produces a token of the same format. This allows tokens to pass downstream format validation
        without schema changes.
      </p>
    </section>

    {/* Data Type Handling */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Data Type Handling
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        Each <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>data_type</code> maps
        to a dedicated alphabet and radix configuration for the FPE cipher. For example,{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>credit-card</code> uses
        a numeric radix-10 alphabet over 16 digits, while{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>email</code> tokenizes
        only the local-part to preserve the domain for deliverability testing. The{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>custom</code> type
        accepts any string and applies a base-62 alphabet without structural constraints.
      </p>
    </section>

    {/* HMAC Binding */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        HMAC Binding for Token Integrity
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        Every token is bound with an HMAC-SHA256 tag computed over{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>token_id || token_value</code>{' '}
        using a server-side binding key isolated in the HSM. On detokenization, the binding_hmac is
        re-verified before the vault lookup is executed. Tampered or forged tokens are rejected before
        any sensitive data is accessed, preventing token substitution attacks.
      </p>
    </section>

    {/* PCI-DSS */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        PCI-DSS Compliance Considerations
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        Tokens issued by QGuard are cryptographically one-way from the cardholder data perspective —
        the token vault is isolated in a dedicated PCI-compliant segment. Systems consuming tokens
        (rendering layers, analytics, CRMs) never enter CDE scope because they hold only tokens, not
        PANs. The <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>binding_hmac</code>{' '}
        field satisfies the PCI DSS v4.0 requirement for cryptographic token integrity controls
        (Requirement 3.5.1).
      </p>
    </section>

    {/* Comparison Table */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Tokenization vs. Encryption
      </div>
      <div style={{ borderRadius: 8, border: '1px solid var(--qg-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(0,212,255,0.06)' }}>
              {['Property', 'Tokenization (QGuard)', 'Symmetric Encryption'].map(h => (
                <th key={h} style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--qg-cyan)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--qg-border)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map(([prop, tok, enc], i) => (
              <tr key={prop} style={{ borderBottom: i < COMPARISON_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-muted)', whiteSpace: 'nowrap' }}>{prop}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--qg-text-secondary)', lineHeight: 1.5 }}>{tok}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--qg-text-secondary)', lineHeight: 1.5 }}>{enc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TokenizePage() {
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
          Data Tokenization
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginTop: 12 }}>
          Replace sensitive values with quantum-entropy-derived tokens. Tokens are format-preserving,
          HMAC-bound, and PCI-DSS compliant. The underlying QRNG service ensures each token is seeded
          with true quantum randomness — not pseudo-random approximations.
        </p>
      </div>

      {/* Quick Start Callout */}
      <div style={{
        borderRadius: 10,
        border: '1px solid rgba(0,212,255,0.25)',
        background: 'rgba(0,212,255,0.04)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--qg-cyan)',
            background: 'rgba(0,212,255,0.12)',
            padding: '3px 8px',
            borderRadius: 4,
          }}>
            Quick Start
          </span>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)', margin: 0 }}>
          All tokenization endpoints share the same path{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>
            POST /api/v1/qrng/generate/stream
          </code>{' '}
          and are differentiated by the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>action</code> field.
          Set <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>action: &quot;tokenize&quot;</code> and include a
          Bearer JWT in the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>Authorization</code> header.
          Responses are Server-Sent Events (SSE) — consume them with{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>EventSource</code> or
          any SSE-capable HTTP client. Verify the QRNG service health before bulk operations using the
          unauthenticated{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>
            GET /api/v1/qrng/status
          </code>{' '}
          endpoint.
        </p>
      </div>

      {/* Endpoints */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 8,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Endpoints
        </h2>

        <EndpointCard endpoint={TOKENIZE_SINGLE_ENDPOINT} />
        <EndpointCard endpoint={TOKENIZE_BATCH_ENDPOINT} />
        <EndpointCard endpoint={HEALTH_ENDPOINT} />
      </section>

      {/* Deep Dive */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 8,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Technical Deep Dive
        </h2>
        <DeepDive
          summary={DEEP_DIVE_SUMMARY}
          detail={DEEP_DIVE_DETAIL}
          label="Show Architecture Detail"
        />
      </section>

    </div>
  )
}
