'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'

// ─── Endpoint definitions ────────────────────────────────────────────────────

const SESSION_KEYS: EndpointDoc = {
  method: 'POST',
  path: '/api/v1/qrng/generate/stream',
  title: 'Generate Session Keys',
  description:
    'Stream QRNG-backed session keys for AEAD-protected channels. Supports 128–512 bit key material with derived IV, HMAC key, and HKDF info. Standard tier: 60 req/min. Enterprise tier: 600 req/min.',
  auth: 'jwt',
  rateLimit: '60 req/min · 600 Enterprise',
  isSSE: true,
  requestBody: {
    action: 'comm-keys',
    key_type: 'session',
    bit_length: 256,
    purpose: 'tls',
    aead_mode: 'gcm',
  },
  requestFields: [
    {
      field: 'action',
      type: 'string',
      required: true,
      description: 'Must be "comm-keys" to invoke the communications key pipeline.',
      example: '"comm-keys"',
    },
    {
      field: 'key_type',
      type: 'string',
      required: true,
      description: 'Key category. Use "session" for AEAD-protected channel keys.',
      example: '"session"',
    },
    {
      field: 'bit_length',
      type: 'number',
      required: true,
      description: 'Key size in bits. Allowed values: 128, 256, 384, 512.',
      example: '256',
    },
    {
      field: 'purpose',
      type: 'string',
      required: true,
      description: 'Intended use context. Affects HKDF label. One of: tls, app, storage, api, websocket.',
      example: '"tls"',
    },
    {
      field: 'aead_mode',
      type: 'string',
      required: true,
      description: 'AEAD cipher mode. One of: gcm, ccm, siv, chacha (ChaCha20-Poly1305).',
      example: '"gcm"',
    },
  ],
  responseFields: [
    {
      field: 'encryption_key',
      type: 'string',
      required: true,
      description: 'Base64-encoded QRNG-derived encryption key.',
    },
    {
      field: 'iv',
      type: 'string',
      required: true,
      description: 'Base64-encoded initialisation vector sized for the chosen AEAD mode.',
    },
    {
      field: 'hmac_key',
      type: 'string',
      required: true,
      description: 'Separate QRNG-derived HMAC key for additional integrity protection.',
    },
    {
      field: 'hkdf_info',
      type: 'string',
      required: true,
      description: 'HKDF context string encoding purpose and aead_mode.',
    },
    {
      field: 'quality_score',
      type: 'number',
      required: true,
      description: 'Entropy quality score between 0 and 1 from the QRNG source.',
    },
    {
      field: 'entropy_source',
      type: 'string',
      required: true,
      description: 'Identifier of the quantum entropy source used for this request.',
    },
  ],
}

const VPN_KEYS: EndpointDoc = {
  method: 'POST',
  path: '/api/v1/qrng/generate/stream',
  title: 'Generate VPN Tunnel Keys',
  description:
    'Stream protocol-specific VPN tunnel key material. Supports WireGuard, OpenVPN, IKEv2, and Shadowsocks. Optional Perfect Forward Secrecy (PFS) ephemeral key pairs are included when requested. Rate limit: 60 req/min.',
  auth: 'jwt',
  rateLimit: '60 req/min',
  isSSE: true,
  requestBody: {
    action: 'comm-keys',
    key_type: 'vpn',
    protocol: 'wireguard',
    bit_length: 256,
    pfs: true,
  },
  requestFields: [
    {
      field: 'action',
      type: 'string',
      required: true,
      description: 'Must be "comm-keys".',
      example: '"comm-keys"',
    },
    {
      field: 'key_type',
      type: 'string',
      required: true,
      description: 'Must be "vpn" to select the VPN key pipeline.',
      example: '"vpn"',
    },
    {
      field: 'protocol',
      type: 'string',
      required: true,
      description: 'VPN protocol. One of: wireguard, openvpn, ikev2, shadowsocks.',
      example: '"wireguard"',
    },
    {
      field: 'bit_length',
      type: 'number',
      required: true,
      description: 'Key length in bits. Must be 256 for VPN keys.',
      example: '256',
    },
    {
      field: 'pfs',
      type: 'boolean',
      required: false,
      description: 'When true, includes a QRNG-derived ephemeral Diffie-Hellman key pair for Perfect Forward Secrecy.',
      example: 'true',
    },
  ],
  responseFields: [
    {
      field: 'vpn_key',
      type: 'string',
      required: true,
      description: 'Base64-encoded 256-bit VPN tunnel key.',
    },
    {
      field: 'protocol',
      type: 'string',
      required: true,
      description: 'Echo of the requested VPN protocol.',
    },
    {
      field: 'pfs_enabled',
      type: 'boolean',
      required: true,
      description: 'Indicates whether an ephemeral PFS key pair was generated.',
    },
    {
      field: 'quality_score',
      type: 'number',
      required: true,
      description: 'Entropy quality score between 0 and 1.',
    },
  ],
}

const EMAIL_KEYS: EndpointDoc = {
  method: 'POST',
  path: '/api/v1/qrng/generate/stream',
  title: 'Generate Email Encryption Keys',
  description:
    'Stream QRNG-backed email encryption key material for S/MIME, PGP, and post-quantum PQC Mail. Supports hybrid classical/PQC algorithms and configurable key expiry. Rate limit: 60 req/min.',
  auth: 'jwt',
  rateLimit: '60 req/min',
  isSSE: true,
  requestBody: {
    action: 'comm-keys',
    key_type: 'email',
    standard: 'smime',
    algorithm: 'hybrid',
    expiry_days: 365,
  },
  requestFields: [
    {
      field: 'action',
      type: 'string',
      required: true,
      description: 'Must be "comm-keys".',
      example: '"comm-keys"',
    },
    {
      field: 'key_type',
      type: 'string',
      required: true,
      description: 'Must be "email" to select the email key pipeline.',
      example: '"email"',
    },
    {
      field: 'standard',
      type: 'string',
      required: true,
      description: 'Email encryption standard. One of: smime, pgp, pqcmail.',
      example: '"smime"',
    },
    {
      field: 'algorithm',
      type: 'string',
      required: true,
      description: 'Key algorithm. One of: hybrid (ML-KEM + classical), mlkem, rsa, ecc.',
      example: '"hybrid"',
    },
    {
      field: 'expiry_days',
      type: 'number',
      required: false,
      description: 'Key validity period in days. One of: 90, 180, 365, 730.',
      example: '365',
    },
  ],
  responseFields: [
    {
      field: 'email_key',
      type: 'string',
      required: true,
      description: 'Base64-encoded email encryption key material.',
    },
    {
      field: 'standard',
      type: 'string',
      required: true,
      description: 'Echo of the email encryption standard used.',
    },
    {
      field: 'algorithm',
      type: 'string',
      required: true,
      description: 'Algorithm used to generate the key.',
    },
    {
      field: 'expiry_days',
      type: 'number',
      required: true,
      description: 'Validity period applied to the key.',
    },
    {
      field: 'quality_score',
      type: 'number',
      required: true,
      description: 'Entropy quality score between 0 and 1.',
    },
  ],
}

const HEALTH_CHECK: EndpointDoc = {
  method: 'GET',
  path: '/api/v1/qrng/status',
  title: 'QRNG Health Check',
  description:
    'Returns the operational status of the QRNG entropy source, current throughput, and queue depth. No authentication required. Suitable for uptime monitoring and load-balancer health probes.',
  auth: 'none',
  rateLimit: '300 req/min',
  responseFields: [
    {
      field: 'status',
      type: 'string',
      required: true,
      description: 'Overall QRNG status. One of: healthy, degraded, unavailable.',
    },
    {
      field: 'entropy_source',
      type: 'string',
      required: true,
      description: 'Active entropy source identifier.',
    },
    {
      field: 'throughput_bps',
      type: 'number',
      required: true,
      description: 'Current QRNG throughput in bits per second.',
    },
    {
      field: 'queue_depth',
      type: 'number',
      required: true,
      description: 'Number of pending entropy requests in the QRNG queue.',
    },
    {
      field: 'uptime_seconds',
      type: 'number',
      required: true,
      description: 'Seconds since the QRNG service last restarted.',
    },
  ],
}

// ─── Deep Dive content ───────────────────────────────────────────────────────

function DeepDiveSummary() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 15,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
      }}>
        Communication Key Architecture
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        All communication keys are derived from raw QRNG entropy using HKDF (RFC 5869). Each key
        generation request is isolated — no key material is reused across requests. The
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)', margin: '0 4px' }}>
          aead_mode
        </code>
        , VPN protocol, and email standard parameters determine the HKDF label, output length, and
        any additional derived sub-keys. Expand below for cipher-level comparisons and protocol
        requirements.
      </p>
    </div>
  )
}

function DeepDiveDetail() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* AEAD Mode Comparison */}
      <section>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--qg-cyan)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          AEAD Mode Comparison
        </div>
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--qg-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(0,212,255,0.06)' }}>
                {['Mode', 'IV Size', 'Tag Size', 'Nonce Reuse Safe', 'Best For'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--qg-cyan)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--qg-border)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  mode: 'GCM',
                  iv: '96 bits',
                  tag: '128 bits',
                  safe: 'No',
                  use: 'TLS 1.3, HTTPS, high-throughput channels',
                },
                {
                  mode: 'CCM',
                  iv: '56–104 bits',
                  tag: '32–128 bits',
                  safe: 'No',
                  use: 'IEEE 802.15.4, constrained IoT devices',
                },
                {
                  mode: 'SIV',
                  iv: 'N/A (deterministic)',
                  tag: '128 bits',
                  safe: 'Yes',
                  use: 'Key wrapping, offline storage, nonce-misuse resistance',
                },
                {
                  mode: 'ChaCha20-Poly1305',
                  iv: '96 bits',
                  tag: '128 bits',
                  safe: 'No',
                  use: 'Mobile, embedded systems, WireGuard, software-only environments',
                },
              ].map((row, i, arr) => (
                <tr
                  key={row.mode}
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}
                >
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-violet)', whiteSpace: 'nowrap' }}>
                    {row.mode}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-primary)' }}>
                    {row.iv}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-primary)' }}>
                    {row.tag}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: row.safe === 'Yes' ? 'rgba(52,211,153,0.15)' : 'rgba(255,45,85,0.12)',
                      color: row.safe === 'Yes' ? 'var(--qg-green)' : 'var(--qg-red)',
                    }}>
                      {row.safe}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--qg-text-secondary)', lineHeight: 1.5 }}>
                    {row.use}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PFS Explanation */}
      <section>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--qg-cyan)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          Perfect Forward Secrecy (PFS)
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
          When <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)', margin: '0 2px' }}>pfs: true</code>
          {' '}is set, the API generates an ephemeral Diffie-Hellman (or ML-KEM ephemeral) key pair using
          QRNG seeding in addition to the tunnel key. Each session negotiates a unique ephemeral secret
          that is discarded after the handshake. Compromise of the long-term tunnel key does not decrypt
          past sessions — each session's traffic remains individually protected.
        </p>
        <div style={{
          marginTop: 12,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.2)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--qg-violet)',
          lineHeight: 1.7,
        }}>
          Recommendation: always enable PFS for long-lived VPN tunnels and any session carrying
          sensitive data. The computational overhead on modern hardware is negligible.
        </div>
      </section>

      {/* VPN Protocol Key Requirements */}
      <section>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--qg-cyan)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          VPN Protocol Key Requirements
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            {
              protocol: 'WireGuard',
              algo: 'Curve25519 + ChaCha20-Poly1305',
              notes: 'Fixed 256-bit static key. QRNG seed replaces OS /dev/urandom for keypair generation.',
            },
            {
              protocol: 'OpenVPN',
              algo: 'AES-256-GCM + TLS 1.3',
              notes: 'Pre-shared key (TLS-auth / TLS-crypt) generated from QRNG. Supports PFS via ECDHE.',
            },
            {
              protocol: 'IKEv2',
              algo: 'AES-256-GCM + SHA-384 + ECDHE',
              notes: 'IKE_SA and CHILD_SA keys seeded with QRNG. PFS uses ML-KEM ephemeral when enabled.',
            },
            {
              protocol: 'Shadowsocks',
              algo: 'ChaCha20-IETF-Poly1305',
              notes: '256-bit pre-shared key. QRNG provides the full key directly — no key derivation step.',
            },
          ].map(row => (
            <div key={row.protocol} style={{
              padding: '12px 14px',
              borderRadius: 8,
              border: '1px solid var(--qg-border)',
              background: 'rgba(10,10,26,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--qg-text-primary)',
                }}>
                  {row.protocol}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--qg-violet)',
                  background: 'rgba(139,92,246,0.1)',
                  padding: '1px 7px',
                  borderRadius: 4,
                }}>
                  {row.algo}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--qg-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                {row.notes}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Email Encryption Standards Comparison */}
      <section>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--qg-cyan)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          Email Encryption Standards
        </div>
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--qg-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(0,212,255,0.06)' }}>
                {['Standard', 'Key Format', 'PQC Support', 'Infrastructure', 'Use Case'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--qg-cyan)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid var(--qg-border)',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                {
                  std: 'S/MIME',
                  fmt: 'X.509 Certificate',
                  pqc: 'Hybrid (ML-KEM)',
                  infra: 'PKI / CA required',
                  use: 'Enterprise email (Outlook, Apple Mail)',
                },
                {
                  std: 'PGP / OpenPGP',
                  fmt: 'OpenPGP key ring',
                  pqc: 'Hybrid (ML-KEM + Kyber)',
                  infra: 'Web of Trust',
                  use: 'Developer & activist communities',
                },
                {
                  std: 'PQC Mail',
                  fmt: 'ML-KEM-1024 raw key',
                  pqc: 'Native (ML-KEM-1024)',
                  infra: 'None — key exchange out-of-band',
                  use: 'High-security, quantum-resistant channels',
                },
              ].map((row, i, arr) => (
                <tr
                  key={row.std}
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}
                >
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-violet)', whiteSpace: 'nowrap' }}>
                    {row.std}
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-text-primary)' }}>
                    {row.fmt}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--qg-text-secondary)' }}>
                    {row.pqc}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--qg-text-secondary)' }}>
                    {row.infra}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--qg-text-secondary)', lineHeight: 1.5 }}>
                    {row.use}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CommPage() {
  return (
    <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 40 }}>

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
          Secure Communications
        </h1>
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--qg-text-secondary)',
          marginTop: 12,
          maxWidth: 640,
        }}>
          Generate QRNG-backed key material for session encryption, VPN tunnels, and email
          security. All keys are derived from hardware quantum entropy and delivered over a
          Server-Sent Events stream for low-latency integration.
        </p>
      </div>

      {/* Quick Start */}
      <div style={{
        padding: '20px',
        borderRadius: 10,
        border: '1px solid var(--qg-border)',
        background: 'rgba(0,212,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
        }}>
          Quick Start
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { label: 'Base URL', value: 'http://localhost:4000' },
            { label: 'Stream endpoint', value: '/api/v1/qrng/generate/stream' },
            { label: 'Auth', value: 'Bearer JWT (header)' },
            { label: 'Transport', value: 'SSE (text/event-stream)' },
          ].map(item => (
            <div key={item.label} style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--qg-border)',
              background: 'rgba(3,3,8,0.6)',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 600,
                color: 'var(--qg-text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                {item.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: 'var(--qg-cyan)',
              }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Endpoints */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <EndpointCard endpoint={SESSION_KEYS} />
        <EndpointCard endpoint={VPN_KEYS} />
        <EndpointCard endpoint={EMAIL_KEYS} />
        <EndpointCard endpoint={HEALTH_CHECK} />
      </div>

      {/* Deep Dive */}
      <DeepDive
        summary={<DeepDiveSummary />}
        detail={<DeepDiveDetail />}
        label="Show Architecture & Cipher Details"
      />

    </div>
  )
}
