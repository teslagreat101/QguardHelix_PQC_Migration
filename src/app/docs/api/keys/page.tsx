'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'
import type { SchemaField } from '@/components/docs/SchemaTable'

// ─── Endpoint 1: Generate PQC Key Pair ───────────────────────────────────────

const GENERATE_KEY_REQUEST: SchemaField[] = [
  {
    field: 'algorithm',
    type: 'enum',
    required: true,
    description: 'Post-quantum algorithm to use for key generation.',
    example: 'ML-KEM | ML-DSA | SPHINCS+ | HYBRID',
  },
  {
    field: 'bitLength',
    type: 'enum',
    required: true,
    description: 'Security parameter in bits. Higher values increase quantum resistance.',
    example: '128 | 256 | 384 | 512 | 768',
  },
  {
    field: 'label',
    type: 'string',
    required: false,
    description: 'Human-readable identifier for this key pair. Stored as metadata; not used cryptographically.',
    example: 'API Server Key',
  },
  {
    field: 'purpose',
    type: 'enum',
    required: true,
    description: 'Intended cryptographic use of the key pair. Enforced at the policy layer.',
    example: 'encryption | signing | key-agreement',
  },
]

const GENERATE_KEY_RESPONSE: SchemaField[] = [
  {
    field: 'publicKey',
    type: 'string (base64)',
    required: true,
    description: 'Base64-encoded public key. Safe to distribute. Share with counterparties for encryption or signature verification.',
    example: 'base64-encoded-public-key',
  },
  {
    field: 'fingerprint',
    type: 'string (hex)',
    required: true,
    description: 'SHA-256 fingerprint of the public key. Use for key pinning and identity binding.',
    example: 'a3f2b1...',
  },
  {
    field: 'algorithm',
    type: 'string',
    required: true,
    description: 'Algorithm used for the generated key pair, echoed from the request.',
    example: 'ML-KEM',
  },
  {
    field: 'qualityScore',
    type: 'number (0–1)',
    required: true,
    description: 'QRNG entropy quality score at time of key generation. Values below 0.8 trigger automatic re-seeding.',
    example: '0.97',
  },
  {
    field: 'entropySource',
    type: 'string',
    required: true,
    description: 'Identifier of the QRNG entropy pool that seeded this key generation.',
    example: 'qrng-pool-primary',
  },
  {
    field: 'createdAt',
    type: 'string (ISO 8601)',
    required: true,
    description: 'UTC timestamp of key creation.',
    example: '2026-04-07T12:00:00Z',
  },
]

// ─── Endpoint 2: Stream Key Generation ───────────────────────────────────────

const STREAM_KEY_REQUEST: SchemaField[] = [
  {
    field: 'action',
    type: 'string',
    required: true,
    description: 'Must be "key" to invoke the key generation pipeline via the stream endpoint.',
    example: '"key"',
  },
  {
    field: 'algorithm',
    type: 'enum',
    required: true,
    description: 'Post-quantum algorithm to use for key generation.',
    example: 'ML-KEM | ML-DSA | SPHINCS+ | HYBRID',
  },
  {
    field: 'bit_length',
    type: 'number',
    required: true,
    description: 'Security parameter in bits for the generated key.',
    example: '256',
  },
]

// ─── Endpoint 3: List Keys ────────────────────────────────────────────────────

const LIST_KEYS_REQUEST: SchemaField[] = [
  {
    field: 'limit',
    type: 'number',
    required: false,
    description: 'Maximum number of keys to return. Defaults to 20, maximum 100.',
    example: '20',
  },
  {
    field: 'offset',
    type: 'number',
    required: false,
    description: 'Number of keys to skip for pagination.',
    example: '0',
  },
  {
    field: 'status',
    type: 'enum',
    required: false,
    description: 'Filter keys by lifecycle status.',
    example: 'active | revoked',
  },
  {
    field: 'algorithm',
    type: 'string',
    required: false,
    description: 'Filter keys by algorithm type.',
    example: 'ML-KEM',
  },
]

// ─── Endpoint 4: Revoke or Rotate Key ────────────────────────────────────────

const REVOKE_ROTATE_REQUEST: SchemaField[] = [
  {
    field: 'keyId',
    type: 'string (UUID)',
    required: true,
    description: 'Unique identifier of the key to act upon.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  },
  {
    field: 'action',
    type: 'enum',
    required: true,
    description: '"revoke" marks the key as inactive and blocks future use. "rotate" generates a replacement key and links it to the revoked predecessor.',
    example: 'revoke | rotate',
  },
]

// ─── Endpoint 5: Delete Revoked Key ──────────────────────────────────────────

const DELETE_KEY_REQUEST: SchemaField[] = [
  {
    field: 'keyId',
    type: 'string (UUID)',
    required: true,
    description: 'Unique identifier of the revoked key to permanently delete. Key must be in revoked status; active keys cannot be deleted.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  },
]

// ─── Endpoints Array ─────────────────────────────────────────────────────────

const ENDPOINTS: EndpointDoc[] = [
  {
    method: 'POST',
    path: '/api/v1/keys',
    title: 'Generate PQC Key Pair',
    description:
      'Generates a post-quantum cryptographic key pair seeded with true quantum entropy from the QRNG service. The private key is stored encrypted in the HSM-backed vault and never returned in plaintext. Returns the public key, fingerprint, and entropy metadata.',
    auth: 'jwt',
    rateLimit: '60 req/min Standard · 600 req/min Enterprise',
    requestFields: GENERATE_KEY_REQUEST,
    responseFields: GENERATE_KEY_RESPONSE,
    requestBody: {
      algorithm: 'ML-KEM',
      bitLength: 768,
      label: 'API Server Key',
      purpose: 'encryption',
    },
  },
  {
    method: 'POST',
    path: '/api/v1/qrng/generate/stream',
    title: 'Stream Key Generation',
    description:
      'Generates a PQC key pair via the unified QRNG stream endpoint. Set action to "key" to invoke the key generation pipeline. Responses are emitted as Server-Sent Events — suitable for long-running key generation with real-time progress feedback.',
    auth: 'jwt',
    rateLimit: '30 req/min',
    isSSE: true,
    requestFields: STREAM_KEY_REQUEST,
    requestBody: {
      action: 'key',
      algorithm: 'ML-KEM',
      bit_length: 256,
    },
  },
  {
    method: 'GET',
    path: '/api/v1/keys',
    title: 'List Keys',
    description:
      'Returns a paginated list of PQC key pairs associated with the authenticated account. Supports filtering by lifecycle status and algorithm. Use the offset and limit parameters for cursor-free pagination.',
    auth: 'jwt',
    rateLimit: '200 req/min',
    requestFields: LIST_KEYS_REQUEST,
  },
  {
    method: 'PATCH',
    path: '/api/v1/keys',
    title: 'Revoke or Rotate Key',
    description:
      'Revokes or rotates an existing key pair. Revocation immediately marks the key inactive and prevents any further cryptographic operations. Rotation generates a successor key pair and preserves a cryptographic chain of custody linking the old and new keys.',
    auth: 'jwt',
    rateLimit: '30 req/min',
    requestFields: REVOKE_ROTATE_REQUEST,
    requestBody: {
      keyId: 'uuid-here',
      action: 'revoke',
    },
  },
  {
    method: 'DELETE',
    path: '/api/v1/keys',
    title: 'Delete Revoked Key',
    description:
      'Permanently and irreversibly deletes a revoked key pair from the vault. Only keys in revoked status are eligible. This operation purges all key material, metadata, and audit linkages. Ensure all dependent services have migrated to a successor key before deletion.',
    auth: 'jwt',
    rateLimit: '30 req/min',
    requestFields: DELETE_KEY_REQUEST,
    requestBody: {
      keyId: 'uuid-here',
    },
  },
  {
    method: 'GET',
    path: '/api/v1/qrng/status',
    title: 'QRNG Health Check',
    description:
      'Returns the current health and entropy quality score of the underlying QRNG service. No authentication required. Verify QRNG availability and pool quality before initiating key generation workflows, especially in automated pipelines.',
    auth: 'none',
    rateLimit: '300 req/min',
  },
]

// ─── DeepDive Content ─────────────────────────────────────────────────────────

const ALGORITHM_ROWS = [
  ['ML-KEM', 'CRYSTALS-Kyber (NIST FIPS 203)', 'Key encapsulation', 'encryption, key-agreement'],
  ['ML-DSA', 'CRYSTALS-Dilithium (NIST FIPS 204)', 'Digital signatures', 'signing'],
  ['SPHINCS+', 'Hash-based (NIST FIPS 205)', 'Stateless signatures', 'signing'],
  ['HYBRID', 'ML-KEM + X25519 combined', 'Hybrid KEM', 'encryption, key-agreement'],
]

const DEEP_DIVE_SUMMARY = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--qg-text-primary)',
    }}>
      Key Generation Pipeline
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      Every QGuard key pair is generated through a four-stage pipeline: quantum entropy collection
      from the QRNG service, algorithm-specific key derivation seeded with that entropy, HSM-backed
      private key encryption and storage, and fingerprint computation for identity binding.
      No deterministic pseudo-random source is ever used.
    </p>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexWrap: 'wrap',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
    }}>
      {['QRNG Entropy', '→', 'Key Derivation', '→', 'HSM Storage', '→', 'Key Issued'].map((s, i) => (
        <span key={i} style={{
          color: s === '→' ? 'var(--qg-text-muted)' : 'var(--qg-violet)',
          background: s === '→' ? 'none' : 'rgba(139,92,246,0.08)',
          padding: s === '→' ? '0' : '4px 10px',
          borderRadius: s === '→' ? 0 : 6,
        }}>
          {s}
        </span>
      ))}
    </div>
  </div>
)

const DEEP_DIVE_DETAIL = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

    {/* Supported Algorithms */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Supported Algorithms
      </div>
      <div style={{ borderRadius: 8, border: '1px solid var(--qg-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(0,212,255,0.06)' }}>
              {['Algorithm', 'Standard', 'Primitive', 'Valid Purposes'].map(h => (
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
            {ALGORITHM_ROWS.map(([algo, standard, primitive, purposes], i) => (
              <tr key={algo} style={{ borderBottom: i < ALGORITHM_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-violet)', whiteSpace: 'nowrap' }}>{algo}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--qg-text-secondary)', lineHeight: 1.5 }}>{standard}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--qg-text-secondary)', lineHeight: 1.5 }}>{primitive}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-muted)', lineHeight: 1.5 }}>{purposes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    {/* Key Storage */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Key Storage and Private Key Protection
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        Private keys are encrypted with AES-256-GCM immediately after generation using a key-encryption
        key (KEK) held exclusively in the HSM. The plaintext private key is never written to disk or
        transmitted over the network. The API returns only the public key and a SHA-256 fingerprint.
        To use the private key for decryption or signing, operations are dispatched to the HSM and
        only the result (plaintext or signature) is returned — the private key material remains
        within the HSM boundary at all times.
      </p>
    </section>

    {/* Key Rotation */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Key Rotation and Chain of Custody
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        When{' '}
        <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--qg-cyan)', fontSize: 12 }}>action: &quot;rotate&quot;</code>{' '}
        is called, QGuard generates a new key pair using fresh QRNG entropy, revokes the predecessor,
        and records a cryptographic linkage between the old and new key fingerprints. This chain of
        custody enables audit trails across key lifecycle events. Automated rotation policies can be
        configured per key via the Admin API to enforce maximum key age, minimizing exposure windows
        without manual intervention.
      </p>
    </section>

    {/* HSM Export */}
    <section>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        HSM Export and BYOK
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        Enterprise plans support Bring Your Own Key (BYOK) and HSM export via PKCS#11-wrapped key
        bundles. Exported key material is wrapped using the customer&apos;s HSM public key before
        transmission, ensuring the QGuard infrastructure never holds an unwrapped copy of the
        customer&apos;s private key. FIPS 140-3 Level 3 HSM attestation certificates are available
        on request for compliance audits.
      </p>
    </section>

  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KeysApiPage() {
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
          Encryption Key Management
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginTop: 12 }}>
          Generate, manage, and rotate post-quantum cryptographic key pairs seeded with true quantum
          entropy. Supports NIST-standardized PQC algorithms including ML-KEM, ML-DSA, SPHINCS+,
          and hybrid classical-quantum modes. Private keys never leave the HSM boundary.
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
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            <>Authenticate and obtain a Bearer JWT from the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>/api/v1/auth/login</code> endpoint.</>,
            <>Send a <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>POST /api/v1/keys</code> request with your chosen <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>algorithm</code>, <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>bitLength</code>, and <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>purpose</code>.</>,
            <>Download and distribute the returned <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>publicKey</code>. The private key is stored securely in the HSM vault — never transmitted in plaintext.</>,
          ].map((step, i) => (
            <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
              {step}
            </li>
          ))}
        </ol>
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

        {ENDPOINTS.map((ep, idx) => (
          <EndpointCard key={`${ep.method}:${ep.path}:${idx}`} endpoint={ep} />
        ))}
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
