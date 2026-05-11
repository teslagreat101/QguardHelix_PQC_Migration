'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'

// ─── Endpoint definitions ─────────────────────────────────────────────────────

const endpoints: EndpointDoc[] = [
  {
    method: 'POST',
    path: '/api/v1/qrng/generate/stream',
    title: 'Generate X.509 Certificate',
    description:
      'Stream a quantum-random X.509 certificate and private key pair via Server-Sent Events. ' +
      'The QRNG microservice draws entropy from a hardware quantum source, applies NIST SP 800-90B ' +
      'health checks, then constructs the certificate using the specified post-quantum or hybrid ' +
      'algorithm. Supports ML-DSA (FIPS 204), SPHINCS+ (FIPS 205), HYBRID (classical + PQ), and ' +
      'ED25519 for compatibility.',
    auth: 'jwt',
    isSSE: true,
    rateLimit: '20 req/min Standard · 200 req/min Enterprise',
    requestFields: [
      {
        field: 'action',
        type: '"pki"',
        required: true,
        description: 'Must be the literal string "pki"',
        example: '"pki"',
      },
      {
        field: 'common_name',
        type: 'string',
        required: true,
        description: 'The fully-qualified domain name or entity name for the certificate subject (CN)',
        example: '"api.example.com"',
      },
      {
        field: 'organization',
        type: 'string',
        required: true,
        description: 'Legal organization name to embed in the subject (O)',
        example: '"Example Corp"',
      },
      {
        field: 'country',
        type: 'string (2-letter ISO 3166-1)',
        required: true,
        description: 'Two-letter ISO 3166-1 alpha-2 country code for the subject (C)',
        example: '"US"',
      },
      {
        field: 'key_algorithm',
        type: '"ML-DSA" | "SPHINCS+" | "HYBRID" | "ED25519"',
        required: true,
        description:
          'Signature algorithm for the keypair. ML-DSA and SPHINCS+ are NIST-standardized post-quantum algorithms. HYBRID pairs a classical algorithm with a PQ algorithm for transition compatibility.',
        example: '"ML-DSA"',
      },
      {
        field: 'validity_days',
        type: 'number (1–3650)',
        required: true,
        description: 'Certificate validity period in days from the time of issuance',
        example: '365',
      },
      {
        field: 'sans',
        type: 'string[]',
        required: false,
        description:
          'Subject Alternative Names to include in the SAN extension. Supports DNS names, IP addresses, and email addresses.',
        example: '["www.example.com", "192.168.1.1"]',
      },
      {
        field: 'key_usage',
        type: 'string[]',
        required: false,
        description:
          'X.509 Key Usage extension values. Valid entries: digitalSignature, contentCommitment, keyEncipherment, dataEncipherment, keyAgreement, keyCertSign, cRLSign.',
        example: '["digitalSignature"]',
      },
      {
        field: 'extended_key_usage',
        type: 'string[]',
        required: false,
        description:
          'X.509 Extended Key Usage OID names. Valid entries: serverAuth, clientAuth, codeSigning, emailProtection, timeStamping, OCSPSigning.',
        example: '["serverAuth"]',
      },
    ],
    responseFields: [
      {
        field: 'certificate',
        type: 'string (PEM)',
        required: true,
        description: 'PEM-encoded X.509 certificate ready for deployment',
        example: '"-----BEGIN CERTIFICATE-----\\n..."',
      },
      {
        field: 'private_key',
        type: 'string (PEM)',
        required: true,
        description: 'PEM-encoded private key corresponding to the certificate public key. Handle with care — store in a secrets manager, never in source control.',
        example: '"-----BEGIN PRIVATE KEY-----\\n..."',
      },
      {
        field: 'fingerprint',
        type: 'string (SHA-256 hex)',
        required: true,
        description: 'SHA-256 fingerprint of the DER-encoded certificate for identity pinning',
        example: '"A1:B2:C3:..."',
      },
      {
        field: 'algorithm',
        type: 'string',
        required: true,
        description: 'The algorithm actually used to generate the keypair',
        example: '"ML-DSA-65"',
      },
      {
        field: 'validity_days',
        type: 'number',
        required: true,
        description: 'Validity period encoded in the certificate',
        example: '365',
      },
      {
        field: 'quality_score',
        type: 'number (0–1)',
        required: true,
        description: 'NIST entropy quality rating for the quantum entropy used during key generation',
        example: '0.99',
      },
      {
        field: 'entropy_source',
        type: 'string',
        required: true,
        description: 'Hardware entropy source identifier used during generation',
        example: '"qrng-v2"',
      },
    ],
    requestBody: {
      action: 'pki',
      common_name: 'api.example.com',
      organization: 'Example Corp',
      country: 'US',
      key_algorithm: 'ML-DSA',
      validity_days: 365,
      sans: ['www.example.com'],
      key_usage: ['digitalSignature'],
      extended_key_usage: ['serverAuth'],
    },
    responseExample: JSON.stringify(
      {
        certificate: '-----BEGIN CERTIFICATE-----\nMIID...truncated...\n-----END CERTIFICATE-----',
        private_key: '-----BEGIN PRIVATE KEY-----\nMIIE...truncated...\n-----END PRIVATE KEY-----',
        fingerprint: 'A1:B2:C3:D4:E5:F6:...',
        algorithm: 'ML-DSA-65',
        validity_days: 365,
        quality_score: 0.99,
        entropy_source: 'qrng-v2',
      },
      null,
      2,
    ),
  },
  {
    method: 'GET',
    path: '/api/v1/qrng/status',
    title: 'QRNG Health Check',
    description:
      'Returns the current operational status of the QRNG hardware entropy source. ' +
      'No authentication required — designed for uptime monitors, load-balancer health probes, ' +
      'and pre-flight checks before initiating certificate generation.',
    auth: 'none',
    rateLimit: '300 req/min',
    requestFields: [],
    responseFields: [
      {
        field: 'status',
        type: '"ok" | "degraded" | "offline"',
        required: true,
        description: 'Current operational state of the QRNG service',
        example: '"ok"',
      },
      {
        field: 'entropy_source',
        type: 'string',
        required: true,
        description: 'Active hardware entropy source identifier',
        example: '"qrng-v2"',
      },
      {
        field: 'uptime',
        type: 'number',
        required: true,
        description: 'Seconds the service has been running without interruption',
        example: '864000',
      },
    ],
    requestBody: undefined,
    responseExample: JSON.stringify(
      { status: 'ok', entropy_source: 'qrng-v2', uptime: 864000 },
      null,
      2,
    ),
  },
]

// ─── Shared styles ────────────────────────────────────────────────────────────

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

// ─── DeepDive content ─────────────────────────────────────────────────────────

const deepDiveSummary = (
  <div>
    <div style={sectionHeadingStyle}>PKI Certificate Generation Overview</div>
    <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)' }}>
      QGuard&apos;s PKI API issues quantum-hardened X.509 certificates using entropy drawn directly
      from a hardware quantum random number generator. The pipeline from entropy to PEM is:
    </p>
    <ol style={{ paddingLeft: 20, marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[
        'QRNG hardware generates raw entropy at ~10 Mbit/s',
        'NIST SP 800-90B health checks validate entropy quality on every 512-bit block',
        'Validated entropy seeds key generation for the chosen algorithm (ML-DSA, SPHINCS+, HYBRID, or ED25519)',
        'X.509 structure is constructed with the requested subject, SANs, and extensions',
        'Certificate and private key are PEM-encoded and streamed via Server-Sent Events',
        'A SHA-256 fingerprint and quality score are returned alongside the certificate',
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
  <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

    {/* Certificate generation pipeline */}
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Certificate Generation Pipeline
      </div>
      <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { step: 'Entropy ingestion', detail: 'Hardware photon-counting module provides quantum shot noise at ~10 Mbit/s. A Von Neumann extractor removes statistical bias.' },
          { step: 'NIST SP 800-90B validation', detail: 'Adaptive proportion test and repetition count test run on every 512-bit block before the entropy is consumed for key material.' },
          { step: 'Key material derivation', detail: 'Validated entropy directly seeds the key generation function of the target algorithm — no intermediate CSPRNG step for ML-DSA or SPHINCS+ in FIPS-approved mode.' },
          { step: 'X.509 construction', detail: 'Subject DN, validity window, SANs, Key Usage, and Extended Key Usage extensions are assembled per RFC 5280.' },
          { step: 'Self-signing or CA signing', detail: 'The certificate is signed with the generated private key (self-signed) or can be submitted to a CA as a CSR. PEM output covers both flows.' },
          { step: 'Fingerprint computation', detail: 'SHA-256 digest of the DER-encoded certificate is returned for use in certificate pinning and audit logs.' },
          { step: 'SSE emission', detail: 'The full certificate bundle is streamed to the caller as a single SSE data event with JSON payload.' },
        ].map(({ step, detail }, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)', marginBottom: 4 }}>
            <span style={{ ...monoSmall, marginRight: 6 }}>{i + 1}.</span>
            <strong style={{ color: 'var(--qg-text-primary)' }}>{step}</strong> — {detail}
          </li>
        ))}
      </ol>
    </div>

    {/* X.509 extensions */}
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        X.509 Extensions
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginBottom: 12 }}>
        QGuard populates the following extensions in every generated certificate. All extensions conform to RFC 5280.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          {
            ext: 'Subject Alternative Name (SAN)',
            oid: '2.5.29.17',
            detail: 'Populated from the sans[] field. Supports dNSName, iPAddress, and rfc822Name (email). Modern TLS clients rely on SAN over CN for hostname validation.',
          },
          {
            ext: 'Key Usage',
            oid: '2.5.29.15',
            detail: 'Constrains how the key may be used. Common values: digitalSignature (TLS, code signing), keyCertSign + cRLSign (CA certificates). Marked critical.',
          },
          {
            ext: 'Extended Key Usage',
            oid: '2.5.29.37',
            detail: 'Further narrows usage via OID: serverAuth (1.3.6.1.5.5.7.3.1), clientAuth (1.3.6.1.5.5.7.3.2), codeSigning, emailProtection, timeStamping, OCSPSigning.',
          },
          {
            ext: 'Subject Key Identifier',
            oid: '2.5.29.14',
            detail: 'SHA-1 hash of the public key bit string, used to link certificates in a chain without relying on DN matching.',
          },
          {
            ext: 'Basic Constraints',
            oid: '2.5.29.19',
            detail: 'Set to CA:FALSE for end-entity certificates. CA certificates set CA:TRUE with an optional pathLenConstraint.',
          },
        ].map(({ ext, oid, detail }) => (
          <div key={oid} style={{ borderRadius: 8, border: '1px solid var(--qg-border)', padding: '12px 16px', background: 'rgba(0,212,255,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--qg-text-primary)' }}>{ext}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)', background: 'rgba(139,92,246,0.1)', padding: '2px 6px', borderRadius: 4 }}>{oid}</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>{detail}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Supported algorithms */}
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Supported Algorithms
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          {
            algo: 'ML-DSA',
            standard: 'NIST FIPS 204',
            detail: 'Module-Lattice-Based Digital Signature Algorithm. Three security levels: ML-DSA-44 (NIST Level 2), ML-DSA-65 (Level 3), ML-DSA-87 (Level 5). Recommended for new deployments requiring post-quantum security.',
            color: 'var(--qg-cyan)',
          },
          {
            algo: 'SPHINCS+',
            standard: 'NIST FIPS 205',
            detail: 'Stateless hash-based signature scheme. Conservative security based on hash function security alone — no lattice assumptions. Larger signatures (~8–50 KB) but minimal attack surface. Use when algorithm diversity is required.',
            color: 'var(--qg-green)',
          },
          {
            algo: 'HYBRID',
            standard: 'IETF draft-ietf-lamps-pq-composite-sigs',
            detail: 'Combines a classical algorithm (ED25519 or ECDSA P-256) with ML-DSA in a composite signature. Both signatures must validate for the certificate to be accepted. Ideal for transition environments where legacy systems coexist with PQ-capable infrastructure.',
            color: 'var(--qg-amber)',
          },
          {
            algo: 'ED25519',
            standard: 'RFC 8410',
            detail: 'Classical Edwards-curve signature scheme. Not quantum-resistant, but widely supported across TLS stacks, browsers, and HSMs. Use only when compatibility with legacy systems is required and quantum threat is not yet in scope.',
            color: 'var(--qg-text-muted)',
          },
        ].map(({ algo, standard, detail, color }) => (
          <div key={algo} style={{ borderRadius: 8, border: '1px solid var(--qg-border)', padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color }}>{algo}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>{standard}</span>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>{detail}</div>
          </div>
        ))}
      </div>
    </div>

    {/* NIST standards callout */}
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        NIST Post-Quantum Cryptography Standards
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          {
            label: 'NIST FIPS 204 — ML-DSA',
            detail: 'Finalized August 2024. Standardizes the ML-DSA signature algorithm (formerly CRYSTALS-Dilithium) at three security levels. QGuard defaults to ML-DSA-65 (NIST Security Level 3, 192-bit classical equivalent).',
          },
          {
            label: 'NIST FIPS 205 — SLH-DSA (SPHINCS+)',
            detail: 'Finalized August 2024. Standardizes the Stateless Hash-Based Digital Signature Algorithm. QGuard supports SLH-DSA-SHA2-128s (small), SLH-DSA-SHA2-128f (fast), and higher parameter sets.',
          },
          {
            label: 'NIST SP 800-90B — Entropy Source Validation',
            detail: 'QGuard applies the adaptive proportion test and repetition count test from SP 800-90B to every 512-bit block of raw QRNG output before it is used as key material. The quality_score field in the response reflects the Shannon entropy of the validated block.',
          },
        ].map(({ label, detail }) => (
          <div key={label} style={{ borderRadius: 8, border: '1px solid rgba(0,212,255,0.15)', padding: '12px 16px', background: 'rgba(0,212,255,0.03)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--qg-cyan)', marginBottom: 4, letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>{detail}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Security considerations */}
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        Security Considerations
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          {
            threat: 'Private Key Exposure',
            mitigation: 'The private key is returned in a single SSE event over TLS and is never logged or stored server-side. Store the key immediately in a hardware security module (HSM) or encrypted secrets manager. Treat it as a single-use delivery.',
          },
          {
            threat: 'Harvest-Now-Decrypt-Later (HNDL)',
            mitigation: 'Certificates signed with ML-DSA or SPHINCS+ remain secure against quantum adversaries who collect ciphertext today for future decryption. Use HYBRID mode during the transition period to retain compatibility with classical verifiers.',
          },
          {
            threat: 'Algorithm Downgrade',
            mitigation: 'The key_algorithm field is validated server-side and cannot be overridden by a downstream proxy. The algorithm field in the response confirms what was actually used — verify it matches your request before deploying the certificate.',
          },
          {
            threat: 'Certificate Pinning Drift',
            mitigation: 'Use the fingerprint field to pin certificates in mobile apps or embedded clients. Rotate pins before validity_days expires using a staged rollout to avoid service disruption.',
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

export default function PKIApiPage() {
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
          PKI Certificate Authority
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginTop: 12 }}>
          Issue quantum-hardened X.509 certificates backed by hardware quantum random number generation.
          Key material is derived from QRNG entropy validated against NIST SP 800-90B, then used to
          construct certificates with ML-DSA (FIPS 204), SPHINCS+ (FIPS 205), HYBRID, or classical
          ED25519 algorithms. Certificates are delivered via Server-Sent Events with full PEM output,
          SHA-256 fingerprint, and entropy quality metadata.
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
            <strong style={{ color: 'var(--qg-text-primary)' }}>Check health</strong> — Call{' '}
            <code style={monoSmall}>GET /api/v1/qrng/status</code> to confirm the QRNG hardware is
            online before initiating certificate generation.
          </li>
          <li style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            <strong style={{ color: 'var(--qg-text-primary)' }}>Generate</strong> — Call{' '}
            <code style={monoSmall}>POST /api/v1/qrng/generate/stream</code> with{' '}
            <code style={monoSmall}>action: &quot;pki&quot;</code> and your subject details. Choose{' '}
            <code style={monoSmall}>key_algorithm: &quot;ML-DSA&quot;</code> for post-quantum security or{' '}
            <code style={monoSmall}>&quot;HYBRID&quot;</code> during transition periods.
          </li>
          <li style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            <strong style={{ color: 'var(--qg-text-primary)' }}>Secure the private key</strong> — Store the
            returned <code style={monoSmall}>private_key</code> PEM immediately in an HSM or encrypted
            secrets manager. Verify the <code style={monoSmall}>algorithm</code> field matches your request
            and pin the <code style={monoSmall}>fingerprint</code> in your clients.
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
          label="Show Technical Detail — Generation Pipeline, X.509 Extensions, Algorithms & NIST Standards"
        />
      </section>
    </div>
  )
}
