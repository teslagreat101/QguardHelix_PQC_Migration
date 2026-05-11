export default function ChangelogPage() {
  const RELEASES = [
    {
      version: 'v1.0.0',
      date: '2026-04-07',
      tag: 'Current',
      tagColor: 'var(--qg-green)',
      description: 'Initial public release of the QGuard API.',
      sections: [
        {
          title: 'OTP Service',
          color: 'var(--qg-cyan)',
          items: [
            'POST /api/v1/qrng/generate — Single quantum OTP generation',
            'POST /api/v1/qrng/generate/batch — Batch OTP generation (up to 1000)',
            'POST /api/v1/qrng/generate/stream — SSE streaming OTP generation',
            'POST /api/v1/qrng/validate — Timing-safe OTP validation',
            'GET /api/v1/qrng/entropy/health — Entropy quality monitoring',
            'GET /api/v1/qrng/stats — Usage statistics',
            'POST /api/v1/qrng/session/create — Session management',
            'POST /api/v1/qrng/session/rotate — Session rotation',
          ],
        },
        {
          title: 'Key Management',
          color: 'var(--qg-green)',
          items: [
            'POST /api/v1/qrng/keys/generate — ML-KEM, ML-DSA, AES key generation',
            'GET /api/v1/qrng/keys/list — List all keys with filtering',
            'POST /api/v1/qrng/keys/rotate — Key rotation with audit trail',
            'DELETE /api/v1/qrng/keys/{keyId} — Key revocation',
            'GET /api/v1/qrng/keys/{keyId}/export — Key export (PEM, DER, JWK)',
          ],
        },
        {
          title: 'PKI Certificate Authority',
          color: 'var(--qg-violet)',
          items: [
            'POST /api/v1/qrng/pki/csr/sign — PQC certificate issuance (ML-DSA, SPHINCS+)',
            'GET /api/v1/qrng/pki/certificates — Certificate listing',
            'POST /api/v1/qrng/pki/certificates/{certId}/revoke — Certificate revocation',
            'GET /api/v1/qrng/pki/crl — Certificate Revocation List',
          ],
        },
        {
          title: 'Tokenization',
          color: 'var(--qg-amber)',
          items: [
            'POST /api/v1/qrng/tokenize — Format-preserving encryption (FF3-1)',
            'POST /api/v1/qrng/tokenize/batch — Batch tokenization (up to 500)',
            'PCI-DSS compliant tokenization with HMAC integrity binding',
          ],
        },
        {
          title: 'Secure Communications',
          color: 'var(--qg-cyan)',
          items: [
            'POST /api/v1/qrng/comm/session-keys — E2E session key generation',
            'POST /api/v1/qrng/comm/vpn-keys — VPN key pairs (WireGuard, IPSec)',
            'POST /api/v1/qrng/comm/email-keys — S/MIME and PGP email keys',
          ],
        },
        {
          title: 'Cloud Infrastructure',
          color: 'var(--qg-green)',
          items: [
            'GET /api/v1/qrng/cloud/seeds — SSE seed streaming for K8s and cloud',
            'POST /api/v1/qrng/cloud/seeds/direct — Direct seed generation',
            'Supports AWS KMS, Azure Key Vault, GCP Cloud KMS import',
          ],
        },
        {
          title: 'Quantum Vault',
          color: 'var(--qg-violet)',
          items: [
            'Full CRUD operations with ML-KEM-1024 zero-knowledge encryption',
            'POST encrypt/decrypt with AES-256-GCM envelope encryption',
            'POST verify — Merkle tree integrity verification',
            'GET audit — Immutable audit trail per item',
            'POST share — Time-limited encrypted share links',
            'GET download — Secure file retrieval',
          ],
        },
        {
          title: 'Vulnerability Scanner',
          color: 'var(--qg-amber)',
          items: [
            'POST /api/v1/scanner/scan — Initiate quantum vulnerability scan',
            'GET /api/v1/scanner/scans — List scan history',
            'GET /api/v1/scanner/scans/{scanId} — Detailed scan results',
            'GET /api/v1/scanner/scans/{scanId}/report — PDF/JSON report export',
          ],
        },
        {
          title: 'Admin API',
          color: 'var(--qg-red)',
          items: [
            'GET /api/v1/admin/users — User management (admin role required)',
            'GET /api/v1/admin/usage — Platform usage metrics',
            'GET /api/v1/admin/audit — System audit logs',
            'POST /api/v1/admin/config — Runtime configuration',
          ],
        },
        {
          title: 'Authentication & Cross-cutting',
          color: 'var(--qg-cyan)',
          items: [
            'JWT authentication via Supabase for user-facing endpoints',
            'API Key authentication (x-qrng-api-key) for QRNG service',
            'Consistent error format: { code, message, details, request_id }',
            'Rate limiting with 429 responses and Retry-After headers',
            'SSE streaming support for real-time endpoints',
            'Health check endpoints on every service',
          ],
        },
      ],
    },
  ] as const

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--qg-violet)', letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          Reference
        </span>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 3vw, 36px)',
          fontWeight: 800, marginTop: 8, marginBottom: 12,
          letterSpacing: '-0.02em', color: 'var(--qg-text-primary)',
        }}>
          API Changelog
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--qg-text-secondary)', maxWidth: 600 }}>
          Track changes, new endpoints, and deprecations across QGuard API releases.
        </p>
      </div>

      {/* Releases */}
      {RELEASES.map((release) => (
        <div key={release.version} style={{ position: 'relative', paddingLeft: 32, marginBottom: 48 }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute', left: 7, top: 8, bottom: 0, width: 2,
            background: 'linear-gradient(to bottom, var(--qg-cyan), transparent)',
          }} />
          {/* Timeline dot */}
          <div style={{
            position: 'absolute', left: 0, top: 6, width: 16, height: 16,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--qg-cyan), var(--qg-violet))',
            border: '3px solid var(--qg-black)',
          }} />

          {/* Version header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
              color: 'var(--qg-text-primary)', margin: 0,
            }}>
              {release.version}
            </h2>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
              padding: '2px 8px', borderRadius: 4,
              background: `${release.tagColor}1a`,
              color: release.tagColor,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {release.tag}
            </span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--qg-text-muted)', marginBottom: 16,
          }}>
            {release.date}
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--qg-text-secondary)', marginBottom: 24 }}>
            {release.description}
          </p>

          {/* Service sections */}
          {release.sections.map((section) => (
            <div key={section.title} style={{
              marginBottom: 20, padding: '16px 20px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--qg-border)', borderRadius: 10,
            }}>
              <h3 style={{
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                color: section.color, margin: 0, marginBottom: 12,
              }}>
                {section.title}
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {section.items.map((item) => (
                  <li key={item} style={{
                    fontSize: 13, lineHeight: 1.6,
                    color: 'var(--qg-text-secondary)', listStyleType: 'disc',
                  }}>
                    {item.includes('/api/') ? (
                      <>
                        <code style={{
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          background: 'rgba(0,212,255,0.08)',
                          border: '1px solid rgba(0,212,255,0.15)',
                          borderRadius: 4, padding: '1px 5px',
                          color: 'var(--qg-cyan)',
                        }}>
                          {item.split(' — ')[0]}
                        </code>
                        {item.includes(' — ') && (
                          <span style={{ marginLeft: 8 }}>{item.split(' — ')[1]}</span>
                        )}
                      </>
                    ) : (
                      item
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
