'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'

// ─── Endpoint definitions ────────────────────────────────────────────────────

const ENDPOINTS: EndpointDoc[] = [
  // 1. Upload to Vault
  {
    method: 'POST',
    path: '/api/v1/vault',
    title: 'Upload to Vault',
    description: 'Upload a file to the Quantum Vault. The file is encrypted client-side with ML-KEM-1024 before transmission. A Merkle hash is computed and stored for integrity verification.',
    auth: 'jwt',
    rateLimit: '30 req/min',
    requestFields: [
      { field: 'file', type: 'binary | base64', required: true, description: 'File content as raw binary or base64-encoded string' },
      { field: 'filename', type: 'string', required: true, description: 'Original filename with extension', example: 'report.pdf' },
      { field: 'folder_path', type: 'string', required: false, description: 'Destination folder path inside the vault', example: '/documents/reports' },
      { field: 'tags', type: 'string[]', required: false, description: 'Array of string tags for categorisation', example: '["finance","2025"]' },
    ],
    responseFields: [
      { field: 'id', type: 'string', required: true, description: 'Unique vault item identifier (UUID)' },
      { field: 'filename', type: 'string', required: true, description: 'Stored filename' },
      { field: 'size', type: 'number', required: true, description: 'File size in bytes' },
      { field: 'encrypted', type: 'boolean', required: true, description: 'Always true — all vault items are encrypted', example: 'true' },
      { field: 'merkle_hash', type: 'string', required: true, description: 'SHA-3 Merkle root hash of the encrypted content' },
      { field: 'created_at', type: 'string (ISO 8601)', required: true, description: 'Upload timestamp' },
    ],
    requestBody: { file: '<base64-encoded-content>', filename: 'report.pdf', folder_path: '/documents', tags: ['finance', '2025'] },
    responseExample: '{"id":"vault_abc123","filename":"report.pdf","size":204800,"encrypted":true,"merkle_hash":"0xabc...","created_at":"2026-04-07T10:00:00Z"}',
  },

  // 2. List Vault Items
  {
    method: 'GET',
    path: '/api/v1/vault',
    title: 'List Vault Items',
    description: 'Retrieve a paginated list of items stored in the vault. Supports filtering by folder and full-text search over filenames and tags.',
    auth: 'jwt',
    rateLimit: '200 req/min',
    requestFields: [
      { field: 'limit', type: 'number', required: false, description: 'Max items to return (1–100, default 20)', example: '20' },
      { field: 'offset', type: 'number', required: false, description: 'Pagination offset', example: '0' },
      { field: 'folder', type: 'string', required: false, description: 'Filter by folder path', example: '/documents' },
      { field: 'search', type: 'string', required: false, description: 'Full-text search over filenames and tags', example: 'finance' },
    ],
    responseFields: [
      { field: 'items', type: 'VaultItem[]', required: true, description: 'Array of vault item objects matching the query' },
      { field: 'total', type: 'number', required: true, description: 'Total number of matching items (for pagination)' },
    ],
    responseExample: '{"items":[{"id":"vault_abc123","filename":"report.pdf","size":204800,"encrypted":true,"merkle_hash":"0xabc...","created_at":"2026-04-07T10:00:00Z"}],"total":1}',
  },

  // 3. Real-Time Vault Stream
  {
    method: 'GET',
    path: '/api/v1/vault/stream',
    title: 'Real-Time Vault Stream',
    description: 'Subscribe to a Server-Sent Events stream for real-time vault activity. The first event is always a full snapshot of the current vault state, followed by incremental change events.',
    auth: 'jwt',
    rateLimit: '10 concurrent connections',
    isSSE: true,
    responseFields: [
      { field: 'snapshot', type: 'event', required: false, description: 'Full vault state snapshot emitted on initial connection' },
      { field: 'item_added', type: 'event', required: false, description: 'Emitted when a new item is uploaded to the vault' },
      { field: 'item_deleted', type: 'event', required: false, description: 'Emitted when an item is permanently deleted from the vault' },
    ],
    responseExample: 'event: snapshot\ndata: {"items":[...],"total":42}\n\nevent: item_added\ndata: {"id":"vault_xyz","filename":"key.pem","size":1234,"encrypted":true,"merkle_hash":"0xdef...","created_at":"2026-04-07T10:01:00Z"}',
  },

  // 4. Encrypt Data
  {
    method: 'POST',
    path: '/api/v1/vault/encrypt',
    title: 'Encrypt Data',
    description: 'Encrypt an arbitrary payload using post-quantum ML-KEM-1024. Returns ciphertext and a key identifier for later decryption. The plaintext is never stored.',
    auth: 'jwt',
    rateLimit: '60 req/min',
    requestFields: [
      { field: 'data', type: 'string | base64', required: true, description: 'Plaintext data to encrypt (UTF-8 string or base64-encoded bytes)' },
      { field: 'algorithm', type: 'string', required: false, description: 'Encryption algorithm to use (default: ML-KEM-1024)', example: 'ML-KEM-1024' },
    ],
    responseFields: [
      { field: 'ciphertext', type: 'string (base64)', required: true, description: 'Base64-encoded encrypted payload' },
      { field: 'algorithm', type: 'string', required: true, description: 'Algorithm used for encryption', example: 'ML-KEM-1024' },
      { field: 'key_id', type: 'string', required: true, description: 'Identifier of the wrapping key — required for decryption' },
    ],
    requestBody: { data: 'sensitive payload', algorithm: 'ML-KEM-1024' },
    responseExample: '{"ciphertext":"base64==","algorithm":"ML-KEM-1024","key_id":"key_abc123"}',
  },

  // 5. Decrypt Data
  {
    method: 'POST',
    path: '/api/v1/vault/decrypt',
    title: 'Decrypt Data',
    description: 'Decrypt a previously encrypted ciphertext using the associated key. The key is identified by the key_id returned during encryption.',
    auth: 'jwt',
    rateLimit: '60 req/min',
    requestFields: [
      { field: 'ciphertext', type: 'string (base64)', required: true, description: 'Base64-encoded ciphertext from the encrypt endpoint' },
      { field: 'key_id', type: 'string', required: true, description: 'Key identifier returned by the encrypt endpoint' },
    ],
    responseFields: [
      { field: 'plaintext', type: 'string', required: true, description: 'Decrypted plaintext (UTF-8)' },
      { field: 'verified', type: 'boolean', required: true, description: 'True if ciphertext integrity was successfully verified before decryption' },
    ],
    requestBody: { ciphertext: 'base64==', key_id: 'key_abc123' },
    responseExample: '{"plaintext":"sensitive payload","verified":true}',
  },

  // 6. List Vault Keys
  {
    method: 'GET',
    path: '/api/v1/vault/keys',
    title: 'List Vault Keys',
    description: 'List all ML-KEM encryption keys associated with the authenticated user\'s vault, including their status and creation timestamps.',
    auth: 'jwt',
    rateLimit: '100 req/min',
    responseFields: [
      { field: 'keys', type: 'VaultKey[]', required: true, description: 'Array of key objects' },
      { field: 'keys[].id', type: 'string', required: true, description: 'Unique key identifier' },
      { field: 'keys[].algorithm', type: 'string', required: true, description: 'Key algorithm', example: 'ML-KEM-1024' },
      { field: 'keys[].created_at', type: 'string (ISO 8601)', required: true, description: 'Key creation timestamp' },
      { field: 'keys[].status', type: 'string', required: true, description: 'Key status: active | rotated | revoked', example: 'active' },
    ],
    responseExample: '{"keys":[{"id":"key_abc123","algorithm":"ML-KEM-1024","created_at":"2026-01-01T00:00:00Z","status":"active"}]}',
  },

  // 7. Verify Integrity
  {
    method: 'POST',
    path: '/api/v1/vault/verify',
    title: 'Verify Integrity',
    description: 'Run a Merkle-proof integrity check on a vault item. Confirms that the stored content has not been tampered with since upload.',
    auth: 'jwt',
    rateLimit: '100 req/min',
    requestFields: [
      { field: 'item_id', type: 'string', required: true, description: 'Vault item ID to verify', example: 'vault_abc123' },
    ],
    responseFields: [
      { field: 'verified', type: 'boolean', required: true, description: 'True if the item passes the Merkle integrity check' },
      { field: 'merkle_proof', type: 'string[]', required: true, description: 'Ordered array of sibling hashes forming the Merkle proof path' },
      { field: 'hash', type: 'string', required: true, description: 'Current SHA-3 root hash of the item' },
    ],
    requestBody: { item_id: 'vault_abc123' },
    responseExample: '{"verified":true,"merkle_proof":["0xaaa...","0xbbb..."],"hash":"0xccc..."}',
  },

  // 8. Audit Trail
  {
    method: 'GET',
    path: '/api/v1/vault/audit',
    title: 'Audit Trail',
    description: 'Retrieve a tamper-evident audit log of all actions performed on vault items. Supports filtering by item, action type, and date range.',
    auth: 'jwt',
    rateLimit: '50 req/min',
    requestFields: [
      { field: 'item_id', type: 'string', required: false, description: 'Filter events to a specific vault item', example: 'vault_abc123' },
      { field: 'action_type', type: 'string', required: false, description: 'Filter by action: upload | download | delete | share | verify', example: 'download' },
      { field: 'date_from', type: 'string (ISO 8601)', required: false, description: 'Start of date range filter', example: '2026-01-01T00:00:00Z' },
      { field: 'date_to', type: 'string (ISO 8601)', required: false, description: 'End of date range filter', example: '2026-04-07T23:59:59Z' },
    ],
    responseFields: [
      { field: 'events', type: 'AuditEvent[]', required: true, description: 'Array of audit log entries' },
      { field: 'events[].action', type: 'string', required: true, description: 'Action performed', example: 'download' },
      { field: 'events[].user', type: 'string', required: true, description: 'User ID who performed the action' },
      { field: 'events[].timestamp', type: 'string (ISO 8601)', required: true, description: 'When the action occurred' },
      { field: 'events[].ip', type: 'string', required: true, description: 'IP address of the request origin' },
    ],
    responseExample: '{"events":[{"action":"download","user":"usr_xyz","timestamp":"2026-04-07T11:00:00Z","ip":"203.0.113.5"}]}',
  },

  // 9. Create Share Link
  {
    method: 'POST',
    path: '/api/v1/vault/share',
    title: 'Create Share Link',
    description: 'Generate a time-limited, optionally password-protected share link for a vault item. The link uses an ephemeral wrapped key — the server never sees the plaintext.',
    auth: 'jwt',
    rateLimit: '30 req/min',
    requestFields: [
      { field: 'item_id', type: 'string', required: true, description: 'ID of the vault item to share', example: 'vault_abc123' },
      { field: 'expires_in_hours', type: 'number', required: true, description: 'Link TTL in hours — must be between 1 and 720', example: '24' },
      { field: 'password', type: 'string', required: false, description: 'Optional password to restrict access to the share link' },
    ],
    responseFields: [
      { field: 'share_url', type: 'string', required: true, description: 'Fully-qualified share URL to send to the recipient' },
      { field: 'share_id', type: 'string', required: true, description: 'Unique share identifier' },
      { field: 'expires_at', type: 'string (ISO 8601)', required: true, description: 'Expiry timestamp of the share link' },
    ],
    requestBody: { item_id: 'vault_abc123', expires_in_hours: 24, password: 'optional-secret' },
    responseExample: '{"share_url":"https://app.qguard.io/share/shr_xyz","share_id":"shr_xyz","expires_at":"2026-04-08T10:00:00Z"}',
  },

  // 10. Access Public Share
  {
    method: 'GET',
    path: '/api/v1/vault/share/public',
    title: 'Access Public Share',
    description: 'Retrieve file metadata and a one-time download URL for a shared vault item. No authentication required — access is gated by the share_id and optional password.',
    auth: 'none',
    rateLimit: '100 req/min',
    requestFields: [
      { field: 'share_id', type: 'string', required: true, description: 'Share identifier from the share link', example: 'shr_xyz' },
      { field: 'password', type: 'string', required: false, description: 'Password if the share link was created with one' },
    ],
    responseFields: [
      { field: 'filename', type: 'string', required: true, description: 'Original filename of the shared item' },
      { field: 'size', type: 'number', required: true, description: 'File size in bytes' },
      { field: 'encrypted', type: 'boolean', required: true, description: 'Whether the download requires client-side decryption' },
      { field: 'download_url', type: 'string', required: true, description: 'Pre-signed, time-limited URL to download the encrypted file' },
    ],
    responseExample: '{"filename":"report.pdf","size":204800,"encrypted":true,"download_url":"https://cdn.qguard.io/tmp/dl_signed_token"}',
  },

  // 11. Share Events Stream
  {
    method: 'GET',
    path: '/api/v1/vault/share/events',
    title: 'Share Events Stream',
    description: 'Subscribe to a Server-Sent Events stream scoped to share link activity for the authenticated user. Receive real-time notifications when shares are accessed or expire.',
    auth: 'jwt',
    isSSE: true,
    responseFields: [
      { field: 'share_accessed', type: 'event', required: false, description: 'Emitted when a recipient opens a share link (includes share_id and recipient IP)' },
      { field: 'share_expired', type: 'event', required: false, description: 'Emitted when a share link reaches its expiry time' },
    ],
    responseExample: 'event: share_accessed\ndata: {"share_id":"shr_xyz","ip":"198.51.100.22","accessed_at":"2026-04-07T12:00:00Z"}\n\nevent: share_expired\ndata: {"share_id":"shr_xyz","expired_at":"2026-04-08T10:00:00Z"}',
  },

  // 12. Download File
  {
    method: 'GET',
    path: '/api/v1/vault/download',
    title: 'Download File',
    description: 'Stream the encrypted binary content of a vault item directly to the client. The client is responsible for decrypting the payload using the corresponding vault key.',
    auth: 'jwt',
    rateLimit: '50 req/min',
    requestFields: [
      { field: 'item_id', type: 'string', required: true, description: 'ID of the vault item to download', example: 'vault_abc123' },
    ],
    responseFields: [
      { field: '(binary stream)', type: 'application/octet-stream', required: true, description: 'Raw encrypted file bytes streamed in the response body' },
    ],
    responseExample: '<binary encrypted file stream>',
  },
]

// ─── Quick-start code snippet ─────────────────────────────────────────────────

const QUICKSTART_SNIPPET = `// 1. Upload a file to the Quantum Vault
const form = new FormData()
form.append('file', fileBlob)
form.append('filename', 'report.pdf')
form.append('folder_path', '/documents')

const upload = await fetch('http://localhost:4000/api/v1/vault', {
  method: 'POST',
  headers: { Authorization: 'Bearer <jwt>' },
  body: form,
})
const { id, merkle_hash } = await upload.json()

// 2. Verify integrity at any time
const verify = await fetch('http://localhost:4000/api/v1/vault/verify', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer <jwt>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ item_id: id }),
})
const { verified } = await verify.json()
console.log('Integrity check:', verified) // true`

// ─── DeepDive content ─────────────────────────────────────────────────────────

const deepDiveSummary = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--qg-text-primary)',
    }}>
      Zero-Knowledge Vault Architecture
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      The Quantum Vault is built on a zero-knowledge principle: all encryption and decryption
      happens on the client. The server stores only ciphertext and Merkle proof data —
      it can never read your files. Post-quantum ML-KEM-1024 key encapsulation ensures
      your data remains secure against both classical and quantum adversaries.
    </p>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[
        { label: 'Algorithm', value: 'ML-KEM-1024' },
        { label: 'Integrity', value: 'SHA-3 Merkle Tree' },
        { label: 'Key Storage', value: 'Client-Side Only' },
        { label: 'Server Knowledge', value: 'Zero' },
      ].map(({ label, value }) => (
        <div key={label} style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--qg-border)',
          background: 'rgba(0,212,255,0.04)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)', fontWeight: 600 }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  </div>
)

const deepDiveDetail = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

    {/* Client-side encryption flow */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        1. Client-Side Encryption Flow
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        Before a file leaves the browser or SDK, the client performs the following steps:
      </p>
      <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          'Generate a random 256-bit Data Encryption Key (DEK) using the QRNG service.',
          'Encrypt the file payload with AES-256-GCM using the DEK.',
          'Encapsulate the DEK using the user\'s ML-KEM-1024 public key to produce a Key Encapsulation Mechanism (KEM) ciphertext.',
          'Transmit the AES ciphertext + KEM-wrapped DEK to the server. The server never sees the DEK or the plaintext.',
          'On download, the client decapsulates the KEM ciphertext with its private key to recover the DEK, then decrypts the file locally.',
        ].map((step, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            {step}
          </li>
        ))}
      </ol>
    </section>

    {/* Merkle tree construction */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        2. Merkle Tree Integrity Construction
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        Every uploaded file is split into 1 MiB chunks. Each chunk is hashed with SHA-3-256 to
        form the Merkle leaf nodes. The binary tree is constructed bottom-up, with each parent
        node holding the hash of its two children. The Merkle root is stored on the server alongside
        the ciphertext.
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        When integrity verification is requested, the server returns the sibling-hash proof path.
        The client recomputes the root from the downloaded ciphertext and compares it against the
        stored root — any single-byte tampering produces a mismatched root and a{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-red)' }}>verified: false</code> response.
      </p>
    </section>

    {/* Encrypted share link mechanism */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        3. Encrypted Share Link Mechanism
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        Share links are built without the server ever holding the decryption key:
      </p>
      <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          'The originating client generates an ephemeral EC key pair for the share.',
          'The file\'s DEK is re-wrapped (encrypted) with the ephemeral public key and stored server-side under the share_id.',
          'The ephemeral private key is embedded in the share URL fragment (never sent to the server).',
          'When the recipient opens the link, their browser extracts the private key from the fragment, fetches the wrapped DEK, and decrypts it locally.',
          'If a password is set, the ephemeral private key is additionally encrypted with PBKDF2-HMAC-SHA256 derived from the password before embedding.',
        ].map((step, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            {step}
          </li>
        ))}
      </ol>
    </section>

    {/* Key wrapping for family sharing */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        4. Key Wrapping for Multi-User (Family) Sharing
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        To share a vault item with another QGuard user, the owner fetches the recipient's
        ML-KEM-1024 public key from the key directory and re-encapsulates the file's DEK under
        that public key. The resulting wrapped key is stored server-side as an additional access
        grant. Both the owner and recipient have independent wrapped copies of the DEK — revoking
        access simply deletes the recipient's grant without affecting the owner's copy or the
        underlying ciphertext.
      </p>
    </section>

    {/* Data retention and deletion policies */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        5. Data Retention and Deletion Policies
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { term: 'Soft Delete', def: 'DELETE /api/v1/vault/:id marks the item as deleted and removes it from listings immediately, but retains ciphertext for 7 days to allow recovery.' },
          { term: 'Hard Delete', def: 'After the 7-day retention window (or on explicit purge request), all ciphertext blocks, wrapped DEKs, Merkle nodes, and audit entries are cryptographically shredded using multiple overwrite passes.' },
          { term: 'Key Rotation', def: 'When a user rotates their ML-KEM key pair, all existing wrapped DEKs are automatically re-wrapped under the new public key in a background job before the old key is revoked.' },
          { term: 'Expired Shares', def: 'Ephemeral share keys and wrapped DEK grants are deleted immediately on expiry. The underlying vault item is not affected.' },
        ].map(({ term, def }) => (
          <div key={term} style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid var(--qg-border)',
            background: 'rgba(255,255,255,0.015)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--qg-violet)', marginBottom: 4 }}>
              {term}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--qg-text-secondary)' }}>
              {def}
            </div>
          </div>
        ))}
      </div>
    </section>
  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VaultApiPage() {
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
          Quantum Vault
        </h1>
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--qg-text-secondary)',
          marginTop: 12,
          maxWidth: 640,
        }}>
          Zero-knowledge encrypted file storage backed by ML-KEM-1024. All encryption happens
          on the client — the server stores only ciphertext and Merkle integrity proofs.
          Includes real-time streaming, share links, and a full audit trail.
        </p>
      </div>

      {/* Quick-start */}
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
            { label: 'Encryption', value: 'ML-KEM-1024' },
            { label: 'Integrity', value: 'SHA-3 Merkle' },
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

        {/* Quickstart code block */}
        <div style={{
          borderRadius: 10,
          border: '1px solid var(--qg-border)',
          overflow: 'hidden',
          background: 'rgba(3,3,8,0.85)',
        }}>
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--qg-border)',
            background: 'rgba(0,212,255,0.04)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--qg-text-muted)',
            letterSpacing: '0.08em',
          }}>
            JavaScript — Upload &amp; Verify
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
