'use client'

import { DeepDive } from '@/components/docs/DeepDive'
import { CodeBlock } from '@/components/docs/CodeBlock'

// ─── Static data ──────────────────────────────────────────────────────────────

const ENCRYPTION_STANDARDS = [
  { algorithm: 'ML-KEM-1024',  role: 'Vault encryption (KEM)',        standard: 'FIPS 203',    color: 'var(--qg-cyan)' },
  { algorithm: 'AES-256-GCM',  role: 'Symmetric payload encryption',  standard: 'NIST SP 800-38D', color: 'var(--qg-green)' },
  { algorithm: 'SHA-3',        role: 'Hashing & Merkle integrity',    standard: 'FIPS 202',    color: 'var(--qg-violet)' },
  { algorithm: 'ML-DSA-65',    role: 'Digital signatures',            standard: 'FIPS 204',    color: 'var(--qg-amber)' },
  { algorithm: 'SPHINCS+',     role: 'Stateless hash-based sigs',     standard: 'FIPS 205',    color: 'var(--qg-orange)' },
]

const NIST_STANDARDS = [
  { id: 'FIPS 203',      title: 'ML-KEM',         desc: 'Module-Lattice-Based Key-Encapsulation Mechanism — primary vault encryption.' },
  { id: 'FIPS 204',      title: 'ML-DSA',         desc: 'Module-Lattice-Based Digital Signature Algorithm — document and API signing.' },
  { id: 'FIPS 205',      title: 'SPHINCS+',       desc: 'Stateless hash-based digital signature standard — long-term signing.' },
  { id: 'SP 800-90B',    title: 'Entropy Source', desc: 'QRNG entropy source validation — governs the hardware RNG used for key generation.' },
  { id: 'SP 800-208',    title: 'LMS / HSS',      desc: 'Leighton-Micali Signature scheme recommendations for stateful signing.' },
]

const ZK_VAULT_CODE = `// Client-side zero-knowledge encryption flow
async function encryptForVault(plaintext: Uint8Array, userPublicKey: Uint8Array) {
  // 1. Generate 256-bit DEK from QRNG
  const dek = await qrng.generateKey(256)

  // 2. Encrypt payload with AES-256-GCM
  const { ciphertext, iv, tag } = await aesGcm.encrypt(plaintext, dek)

  // 3. Encapsulate DEK under user's ML-KEM-1024 public key
  const { kemCiphertext, sharedSecret } = await mlKem1024.encapsulate(userPublicKey)
  const wrappedDek = xor(dek, sharedSecret) // DEK never leaves client in plaintext

  // 4. Transmit — server receives ONLY ciphertext + wrapped DEK
  return { ciphertext, iv, tag, kemCiphertext, wrappedDek }
  // Server compromise → attacker sees only ciphertext, not plaintext
}`

// ─── STRIDE Threat Model ──────────────────────────────────────────────────────

const STRIDE_ROWS = [
  {
    category: 'Spoofing',
    threat: 'Impersonation of users or services',
    mitigation: 'Supabase JWT with short expiry, ML-DSA-65 API request signing, hardware key 2FA',
  },
  {
    category: 'Tampering',
    threat: 'Modification of vault data or API payloads',
    mitigation: 'SHA-3 Merkle proofs on all vault items, AES-256-GCM authentication tags, TLS 1.3',
  },
  {
    category: 'Repudiation',
    threat: 'Denial of actions performed on the system',
    mitigation: 'Tamper-evident append-only audit log, ML-DSA-65 signed log entries',
  },
  {
    category: 'Info Disclosure',
    threat: 'Exposure of plaintext data',
    mitigation: 'Zero-knowledge architecture — server stores only ciphertext; client-side decryption',
  },
  {
    category: 'Denial of Service',
    threat: 'Resource exhaustion on API endpoints',
    mitigation: 'Per-endpoint rate limiting, QRNG connection pooling, CDN-layer DDoS protection',
  },
  {
    category: 'Elevation of Privilege',
    threat: 'Unauthorized access escalation',
    mitigation: 'Row-Level Security in Supabase, scoped API keys, least-privilege service accounts',
  },
]

const strideTableDetail = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 8, border: '1px solid var(--qg-border)', overflow: 'hidden' }}>
    {/* Header */}
    <div style={{
      display: 'grid',
      gridTemplateColumns: '130px 1fr 1fr',
      gap: 0,
      padding: '10px 16px',
      background: 'rgba(0,212,255,0.06)',
      borderBottom: '1px solid var(--qg-border)',
    }}>
      {['Category', 'Threat', 'QGuard Mitigation'].map((h) => (
        <span key={h} style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--qg-text-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {h}
        </span>
      ))}
    </div>
    {STRIDE_ROWS.map((row, i) => (
      <div key={row.category} style={{
        display: 'grid',
        gridTemplateColumns: '130px 1fr 1fr',
        gap: 12,
        padding: '12px 16px',
        borderBottom: i < STRIDE_ROWS.length - 1 ? '1px solid var(--qg-border)' : 'none',
        background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
        alignItems: 'start',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--qg-cyan)',
        }}>
          {row.category}
        </span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--qg-text-secondary)' }}>
          {row.threat}
        </span>
        <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--qg-text-secondary)' }}>
          {row.mitigation}
        </span>
      </div>
    ))}
  </div>
)

const strideSummary = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)' }}>
      Threat Model (STRIDE)
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      Systematic analysis across all QGuard services using the STRIDE framework — covering
      Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and
      Elevation of Privilege.
    </p>
  </div>
)

// ─── Zero-Knowledge Vault DeepDive ────────────────────────────────────────────

const zkSummary = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)' }}>
      Zero-Knowledge Vault
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      The server never sees plaintext data. All encryption and decryption is performed on the
      client using ML-KEM-1024 key encapsulation — a server breach reveals only ciphertext.
    </p>
  </div>
)

const zkDetail = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      The vault uses a hybrid encryption scheme: a random Data Encryption Key (DEK) encrypts the
      payload with AES-256-GCM, while the DEK itself is encapsulated under the user&apos;s
      ML-KEM-1024 public key. The server stores only the AES ciphertext and the KEM-wrapped DEK.
      Even full database access yields zero plaintext.
    </p>
    <CodeBlock
      code={ZK_VAULT_CODE}
      language="typescript"
      title="client-side encryption flow"
    />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--qg-text-primary)' }}>
        Key derivation from user password
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        The ML-KEM private key is derived from the user&apos;s master password using Argon2id
        (memory: 64 MiB, iterations: 3, parallelism: 4). The derived key never leaves the
        client and is never stored server-side — password reset requires re-encryption of all
        wrapped DEKs from a recovery key.
      </p>
    </div>
  </div>
)

// ─── HNDL Attack Mitigation DeepDive ─────────────────────────────────────────

const hndlSummary = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)' }}>
      HNDL Attack Mitigation
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      Harvest Now, Decrypt Later (HNDL) defense strategy — ensuring today&apos;s encrypted data
      remains secure against future quantum adversaries.
    </p>
  </div>
)

const hndlDetail = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      HNDL attacks involve adversaries collecting ciphertext today intending to decrypt it once
      cryptographically-relevant quantum computers become available. QGuard addresses this through
      three layered strategies:
    </p>
    {[
      {
        title: 'Post-Quantum Algorithms from Day One',
        body: 'All vault encryption uses ML-KEM-1024 (FIPS 203), which is designed to resist attacks from both classical and quantum computers. RSA and elliptic-curve-based schemes are not used for long-term data protection.',
        color: 'var(--qg-cyan)',
      },
      {
        title: 'Hybrid Mode for Protocol Transitions',
        body: 'During TLS handshakes and API authentication, QGuard supports hybrid key exchange (X25519 + ML-KEM-768) for clients transitioning from classical to post-quantum. This ensures forward security even if one primitive is broken.',
        color: 'var(--qg-green)',
      },
      {
        title: 'Proactive Key Rotation',
        body: 'Vault keys should be rotated at minimum every 90 days. Automated rotation re-wraps all DEKs under a fresh ML-KEM-1024 key pair, limiting the blast radius of any future cryptographic breakthrough to the rotation window.',
        color: 'var(--qg-violet)',
      },
    ].map(({ title, body, color }) => (
      <div key={title} style={{
        padding: '14px 16px',
        borderRadius: 8,
        border: '1px solid var(--qg-border)',
        borderLeft: `3px solid ${color}`,
        background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color, marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
          {body}
        </div>
      </div>
    ))}
  </div>
)

// ─── Compliance Mapping DeepDive ──────────────────────────────────────────────

const complianceSummary = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'var(--qg-text-primary)' }}>
      Compliance Mapping
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      Regulatory framework alignment across NIST CSF, SOC 2, GDPR, and HIPAA — supporting
      QGuard deployments in regulated industries.
    </p>
  </div>
)

const COMPLIANCE_ROWS = [
  {
    framework: 'NIST CSF 2.0',
    area: 'Identify / Protect / Detect',
    alignment: 'Asset inventory via vault audit trail, PQC controls for data-at-rest, real-time anomaly detection via SSE streams',
    color: 'var(--qg-cyan)',
  },
  {
    framework: 'SOC 2 Type II',
    area: 'Security, Availability, Confidentiality',
    alignment: 'Encryption of all stored data (CC6.1), tamper-evident audit logs (CC7.2), rate limiting and DDoS mitigation (A1.2)',
    color: 'var(--qg-green)',
  },
  {
    framework: 'GDPR',
    area: 'Data Protection by Design',
    alignment: 'Zero-knowledge architecture ensures no plaintext personal data is processed server-side; right to erasure via cryptographic shredding (Art. 17)',
    color: 'var(--qg-violet)',
  },
  {
    framework: 'HIPAA',
    area: 'Technical Safeguards (§164.312)',
    alignment: 'AES-256-GCM encryption satisfies §164.312(a)(2)(iv) encryption/decryption; ML-KEM-1024 exceeds NIST 800-111 recommendations for healthcare data at rest',
    color: 'var(--qg-amber)',
  },
]

const complianceDetail = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      QGuard&apos;s security architecture is designed to satisfy the technical controls required
      by major regulatory frameworks. The table below maps QGuard features to specific framework
      requirements.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {COMPLIANCE_ROWS.map(({ framework, area, alignment, color }) => (
        <div key={framework} style={{
          padding: '14px 16px',
          borderRadius: 8,
          border: '1px solid var(--qg-border)',
          borderLeft: `3px solid ${color}`,
          background: 'rgba(255,255,255,0.015)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color }}>
              {framework}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--qg-text-muted)',
              background: 'rgba(255,255,255,0.05)',
              padding: '2px 8px',
              borderRadius: 4,
              letterSpacing: '0.06em',
            }}>
              {area}
            </span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            {alignment}
          </div>
        </div>
      ))}
    </div>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SecurityPage() {
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
          Security Design
        </h1>
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--qg-text-secondary)',
          marginTop: 12,
          maxWidth: 640,
        }}>
          QGuard is built security-first using NIST Post-Quantum Cryptography standards,
          a zero-knowledge vault architecture, and defense-in-depth across every service
          boundary. Encryption is not a feature — it is the foundation.
        </p>
      </div>

      {/* Encryption Standards */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 24,
          borderTop: '1px solid var(--qg-border)',
          marginBottom: 0,
        }}>
          Encryption Standards
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
          Every cryptographic primitive used in QGuard is drawn from the NIST PQC finalists or
          existing NIST-standardised symmetric schemes. No legacy RSA or classical elliptic-curve
          algorithms are used for long-term data protection.
        </p>

        {/* Algorithm table */}
        <div style={{ borderRadius: 10, border: '1px solid var(--qg-border)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '160px 1fr 120px',
            padding: '10px 20px',
            background: 'rgba(0,212,255,0.06)',
            borderBottom: '1px solid var(--qg-border)',
          }}>
            {['Algorithm', 'Role', 'Standard'].map((h) => (
              <span key={h} style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--qg-text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                {h}
              </span>
            ))}
          </div>
          {/* Table rows */}
          {ENCRYPTION_STANDARDS.map(({ algorithm, role, standard, color }, i) => (
            <div key={algorithm} style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr 120px',
              padding: '14px 20px',
              borderBottom: i < ENCRYPTION_STANDARDS.length - 1 ? '1px solid var(--qg-border)' : 'none',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
              alignItems: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 700,
                color,
              }}>
                {algorithm}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--qg-text-secondary)' }}>
                {role}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--qg-text-muted)',
                background: 'rgba(255,255,255,0.04)',
                padding: '3px 8px',
                borderRadius: 4,
                display: 'inline-block',
              }}>
                {standard}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Authentication */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 24,
          borderTop: '1px solid var(--qg-border)',
          marginBottom: 0,
        }}>
          Authentication
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {[
            {
              label: 'User Sessions',
              value: 'JWT via Supabase',
              detail: 'Short-lived access tokens (1 h) with rotating refresh tokens. All tokens are verified server-side on every request.',
              color: 'var(--qg-cyan)',
            },
            {
              label: 'QRNG Service',
              value: 'API Key Auth',
              detail: 'Scoped API keys with per-key rate limits and IP allowlisting. Keys are never logged or embedded in client bundles.',
              color: 'var(--qg-green)',
            },
            {
              label: 'Two-Factor Auth',
              value: 'TOTP + Hardware Keys',
              detail: 'TOTP (RFC 6238) via authenticator apps and FIDO2/WebAuthn hardware security keys (YubiKey, Passkey). 2FA is enforced for privileged actions.',
              color: 'var(--qg-violet)',
            },
          ].map(({ label, value, detail, color }) => (
            <div key={label} style={{
              padding: '16px',
              borderRadius: 10,
              border: '1px solid var(--qg-border)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--qg-text-muted)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                {label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color }}>
                {value}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--qg-text-secondary)' }}>
                {detail}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NIST Compliance */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 24,
          borderTop: '1px solid var(--qg-border)',
          marginBottom: 0,
        }}>
          NIST Compliance
        </h2>
        <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
          QGuard aligns with the NIST Post-Quantum Cryptography standardisation process and
          relevant Special Publications governing key management, entropy, and signature schemes.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {NIST_STANDARDS.map(({ id, title, desc }) => (
            <div key={id} style={{
              display: 'flex',
              gap: 16,
              padding: '14px 16px',
              borderRadius: 8,
              border: '1px solid var(--qg-border)',
              background: 'rgba(255,255,255,0.015)',
              alignItems: 'flex-start',
            }}>
              <div style={{ flexShrink: 0, width: 100 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--qg-cyan)',
                }}>
                  {id}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--qg-text-muted)',
                  marginTop: 2,
                }}>
                  {title}
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DeepDive sections */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          margin: 0,
        }}>
          Technical Deep Dives
        </h2>

        {/* 1. STRIDE */}
        <DeepDive
          summary={strideSummary}
          detail={strideTableDetail}
          label="Show STRIDE Analysis"
        />

        {/* 2. Zero-Knowledge Vault */}
        <DeepDive
          summary={zkSummary}
          detail={zkDetail}
          label="Show Zero-Knowledge Architecture"
        />

        {/* 3. HNDL */}
        <DeepDive
          summary={hndlSummary}
          detail={hndlDetail}
          label="Show HNDL Defense Strategy"
        />

        {/* 4. Compliance Mapping */}
        <DeepDive
          summary={complianceSummary}
          detail={complianceDetail}
          label="Show Compliance Mapping"
        />
      </section>

    </div>
  )
}
