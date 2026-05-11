# Quantum Vault Integration Guide

## 📋 Deliverables Summary

This implementation provides a **production-grade, enterprise-ready Quantum Vault system** with Supabase SQL schema and complete frontend/backend integration.

---

## A. Complete Supabase SQL Schema

**File:** `supabase/quantum-vault-production-schema.sql`

Run this entire script in your Supabase Dashboard → SQL Editor.

### What's Included:

| Section | Description |
|---------|-------------|
| 1. Extensions | `uuid-ossp`, `pgcrypto` for cryptographic functions |
| 2. Helper Functions | `set_updated_at()`, `requesting_user_id()`, `generate_secure_token()` |
| 3. Custom Enums | `encryption_status`, `vault_key_type`, `audit_severity`, `share_permission`, etc. |
| 4. Vault Profiles | User storage quotas, KDF settings, security preferences |
| 5. Unlock Sessions | Device-tracked vault sessions with expiration |
| 6. Folders | Hierarchical folder structure with path tracking |
| 7. Files | Core encrypted file storage with ML-KEM-768 metadata |
| 8. File Metadata | Extensible JSONB metadata storage |
| 9. File Versions | Complete version history |
| 10. Upload Sessions | Resumable chunked uploads |
| 11. Key Vault | ML-KEM/ML-DSA key management with wrapped private keys |
| 12. User Master Keys | ZK passphrase-protected key bundles |
| 13. Key Rotation | Progress-tracked key rotation |
| 14. Recovery Keys | Recovery key verification metadata |
| 15. Secure Sharing | Password-protected, expiring share links |
| 16. Access Grants | Direct user-to-user sharing |
| 17. Audit Logging | Enterprise compliance audit trail |
| 18. Realtime Telemetry | Live progress tracking |
| 19. Storage Bucket | `vault-encrypted` bucket with RLS policies |
| 20. RLS Policies | Strict user isolation on all tables |
| 21. Realtime Pub | Supabase Realtime configuration |
| 22. Helper Views | `vault_stats`, `vault_recent_activity` |

---

## B. Table Explanation

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `vault_user_profiles` | Per-user vault settings & quotas | `storage_used`, `storage_quota`, `vault_locked` |
| `vault_files` | Encrypted file records | `kem_ciphertext`, `aes_nonce`, `signature` |
| `vault_folders` | Folder hierarchy | `parent_id`, `path`, `depth` |
| `vault_keys` | PQC keys (ML-KEM/ML-DSA) | `wrapped_secret_key`, `fingerprint` |
| `vault_user_keys` | Master key bundle | `wrapped_bundle`, `kdf_params` |
| `vault_shared_links` | Shareable links | `token`, `permissions`, `expires_at` |
| `vault_audit_logs` | Security audit trail | `event_type`, `severity`, `ip_address` |
| `vault_unlock_sessions` | Active vault sessions | `expires_at`, `device_id`, `trust_level` |
| `vault_processing_status` | Real-time progress | `progress_pct`, `operation`, `stage` |

### Security Metadata Stored (Never Plaintext)

```sql
-- ML-KEM-768 Encapsulated Key (hex)
kem_ciphertext TEXT

-- AES-256-GCM Parameters
aes_nonce TEXT       -- 96-bit IV
aes_auth_tag TEXT    -- 128-bit auth tag

-- ML-DSA-65 Signature
signature TEXT       -- Hex signature
signing_key_id UUID  -- Key reference

-- Integrity Verification
content_hash TEXT            -- SHA-256 of plaintext
encrypted_content_hash TEXT  -- SHA-256 of ciphertext
```

---

## C. Supabase Storage Bucket Configuration

### Bucket: `vault-encrypted`

```sql
-- Created automatically by the SQL script
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('vault-encrypted', 'vault-encrypted', FALSE, 1073741824);
```

### Storage Path Structure
```
vault/{user_id}/{file_id}/{encrypted_filename}

Example:
vault/550e8400-e29b-41d4-a716-446655440000/
     a1b2c3d4-e5f6-7890-abcd-ef1234567890/
     a1b2c3d4.enc
```

### Storage RLS Policies

| Operation | Policy |
|-----------|--------|
| INSERT | User can only upload to `vault/{their_user_id}/` |
| SELECT | User can only read from `vault/{their_user_id}/` |
| DELETE | User can only delete from `vault/{their_user_id}/` |

---

## D. Frontend Integration Plan

### Files Created/Updated

| File | Purpose |
|------|---------|
| `supabase/quantum-vault-production-schema.sql` | Complete SQL schema |
| `src/lib/vault/vault-service-enhanced.ts` | Enhanced service layer |
| `src/app/dashboard/vault/page.tsx` | Updated vault page |

### Key Integration Points

```typescript
// 1. Initialize vault on login
import * as vaultSvc from '@/lib/vault/vault-service-enhanced'

// Ensure profile exists
const profile = await vaultSvc.ensureVaultProfile()

// 2. Check if user has vault keys
const hasKeys = await vaultSvc.hasUserKeys()

// 3. Upload file (with optional encryption)
const uploaded = await vaultSvc.uploadVaultFile(file, {
  folderId: currentFolderId,
  encryptionData: {
    encryptedData: result.encryptedData,
    kemCiphertext: result.kemCiphertext,
    aesNonce: result.aesNonce,
    contentHash: result.integrityHash,
  },
  onProgress: (pct) => setProgress(pct)
})

// 4. Fetch files
const files = await vaultSvc.fetchAllVaultFiles()

// 5. Download & decrypt
const { data: blob, filename, mimeType } = await vaultSvc.downloadVaultFile(fileId)

// 6. Real-time updates
const subscription = vaultSvc.subscribeToVaultFiles((payload) => {
  console.log('File changed:', payload.event, payload.file)
})
```

---

## E. Backend/API Integration Plan

### File Operations

| Operation | Service Function | Database Action |
|-----------|------------------|-----------------|
| Upload | `uploadVaultFile()` | Insert to `vault_files`, upload to Storage |
| Download | `downloadVaultFile()` | Get from Storage, return Blob |
| Delete | `deleteVaultFile()` | Soft delete in DB |
| Permanent Delete | `permanentlyDeleteFile()` | Delete from DB + Storage |
| Move | `moveVaultFile()` | Update `folder_id` |
| Encrypt | Client-side + re-upload | Update encryption metadata |
| Decrypt | Client-side only | Never touches server plaintext |

### Key Operations

| Operation | Service Function | Description |
|-----------|------------------|-------------|
| Generate Keys | Client-side ML-KEM/ML-DSA | Generate PQC keypairs |
| Store Keys | `storeUserKeys()` | Save wrapped bundle |
| Fetch Keys | `fetchUserKeys()` | Retrieve wrapped keys |
| Create Key | `createVaultKey()` | Add new encryption/signing key |
| Revoke Key | `revokeVaultKey()` | Mark key as revoked |

### Audit Logging

```typescript
// Automatic audit logging on all operations
await logAudit(
  'file_encrypted',           // event_type
  'info',                     // severity: info|warning|critical
  'file',                     // resource_type
  fileId,                     // resource_id
  'Encrypted with ML-KEM-768' // description
)
```

---

## F. RLS Policy Explanation

### Core Principle: User Isolation

Every table has Row Level Security (RLS) enabled with policies like:

```sql
CREATE POLICY "Users manage own files"
  ON public.vault_files FOR ALL
  USING (user_id = auth.uid());
```

### Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| vault_user_profiles | Own | Own | Own | - |
| vault_files | Own | Own | Own | Own |
| vault_folders | Own | Own | Own | Own |
| vault_keys | Own | Own | Own | Own |
| vault_user_keys | Own | Own | Own | - |
| vault_shared_links | Own | Own | Own | Own |
| vault_access_grants | Own/Grantee | Own | Own | Own |
| vault_audit_logs | Own | Own | - | - |
| vault_unlock_sessions | Own | Own | Own | Own |

### Storage RLS

```sql
-- Users can only access their own path
CREATE POLICY "Users read own vault objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vault-encrypted'
    AND (storage.foldername(name))[1] = 'vault'
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );
```

---

## G. User Isolation Verification Checklist

### SQL Verification Queries

Run these in Supabase SQL Editor to verify isolation:

```sql
-- 1. Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE 'vault_%';

-- Expected: all rowsecurity = true

-- 2. Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename LIKE 'vault_%'
ORDER BY tablename;

-- 3. Test cross-user access (should return 0 rows)
-- As User A, check if you can see User B's files:
SELECT COUNT(*) FROM public.vault_files 
WHERE user_id != auth.uid();

-- Expected: 0

-- 4. Verify storage isolation
SELECT name, owner 
FROM storage.objects 
WHERE bucket_id = 'vault-encrypted';

-- Verify paths match owner UUID
```

### Frontend Verification

```typescript
// 1. Login as User A, upload a file
const file = await vaultSvc.uploadVaultFile(testFile)

// 2. Get User A's files
const userAFiles = await vaultSvc.fetchAllVaultFiles()
console.log('User A files:', userAFiles.length) // Should be >= 1

// 3. Login as User B (different account)
// 4. Fetch files as User B
const userBFiles = await vaultSvc.fetchAllVaultFiles()
console.log('User B files:', userBFiles.length) // Should be 0 (or only User B's files)

// 5. Verify User B cannot access User A's file by ID
try {
  await vaultSvc.downloadVaultFile(file.id) // User A's file ID
  console.error('SECURITY ISSUE: User B can access User A file!')
} catch (err) {
  console.log('PASS: User B correctly blocked from User A file')
}
```

### Security Checklist

- [ ] RLS enabled on all vault tables
- [ ] No `anon` role has access to vault tables
- [ ] Storage bucket is private (`public = false`)
- [ ] Storage RLS policies enforce user_id path matching
- [ ] No plaintext keys stored in database
- [ ] All private keys are wrapped (encrypted)
- [ ] Audit logging captures all file operations
- [ ] Failed unlock attempts are tracked
- [ ] Share links expire and have download limits
- [ ] Session expiration is enforced

---

## H. Post-Quantum Cryptography Details

### ML-KEM-768 (Key Encapsulation)

```
Algorithm: ML-KEM-768 (Kyber)
Security Level: NIST Level 3 (AES-192 equivalent)
Ciphertext Size: 1088 bytes
Public Key Size: 1184 bytes
Secret Key Size: 2400 bytes
```

### ML-DSA-65 (Digital Signatures)

```
Algorithm: ML-DSA-65 (Dilithium)
Security Level: NIST Level 2
Signature Size: 3293 bytes
Public Key Size: 1952 bytes
Secret Key Size: 4032 bytes
```

### AES-256-GCM (Symmetric Encryption)

```
Key Size: 256 bits (derived from ML-KEM shared secret)
Nonce/IV: 96 bits (random)
Auth Tag: 128 bits
Mode: Authenticated Encryption with Associated Data (AEAD)
```

### Envelope Encryption Flow

```
1. Generate ML-KEM keypair (client-side)
2. Encapsulate shared secret → kem_ciphertext
3. Derive AES-256 key from shared secret
4. Encrypt file with AES-256-GCM
5. Store: kem_ciphertext + aes_nonce + aes_auth_tag + encrypted_data
6. Sign with ML-DSA-65 → signature
```

---

## I. Environment Variables

Add to your `.env` file:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Custom storage bucket name
VITE_VAULT_BUCKET_NAME=vault-encrypted
```

---

## J. Testing the Implementation

### 1. Run SQL Schema

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Paste contents of `supabase/quantum-vault-production-schema.sql`
4. Click "Run"

### 2. Verify Storage Bucket

1. Go to Storage in Supabase Dashboard
2. Verify `vault-encrypted` bucket exists
3. Check bucket is private

### 3. Test Vault Access

1. Navigate to `/dashboard/vault`
2. Click "Open Quantum Vault"
3. Set passphrase (first time) or enter existing passphrase
4. Upload a file
5. Verify file appears in list
6. Verify encryption status shows correctly

### 4. Check Audit Logs

```sql
-- Query recent audit events
SELECT * FROM vault_audit_logs
ORDER BY created_at DESC
LIMIT 10;
```

---

## K. Troubleshooting

### "Vault Access Error: Could not connect to vault"

1. Check Supabase URL and Anon Key in environment variables
2. Verify user is authenticated: `const { data: { user } } = await supabase.auth.getUser()`
3. Check RLS policies are correctly applied
4. Ensure `vault_user_profiles` table exists

### Files not appearing after upload

1. Check browser console for errors
2. Verify file record was created: `SELECT * FROM vault_files WHERE user_id = 'your-uuid'`
3. Check storage upload succeeded
4. Verify RLS policy allows SELECT

### Encryption failing

1. Verify ML-KEM keys are generated: check `vault_user_keys` table
2. Check browser supports Web Crypto API
3. Verify `@noble/post-quantum` package is installed

---

## L. Production Deployment Checklist

Before deploying to production:

- [ ] SQL schema executed successfully in production project
- [ ] Storage bucket created and configured
- [ ] RLS policies verified with test queries
- [ ] User isolation verified (cross-user access blocked)
- [ ] Encryption/decryption tested end-to-end
- [ ] Audit logging confirmed working
- [ ] Session expiration tested
- [ ] Rate limiting verified
- [ ] Error handling tested
- [ ] Realtime subscriptions working
- [ ] Backup strategy configured for vault-encrypted bucket
- [ ] Point-in-time recovery enabled for database

---

## Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **ML-KEM/ML-DSA Spec:** NIST FIPS 203/204
- **Noble Post-Quantum:** https://github.com/paulmillr/noble-post-quantum
- **Web Crypto API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API

---

## License & Security Notice

This implementation follows:
- **NIST FIPS 203** (ML-KEM) for key encapsulation
- **NIST FIPS 204** (ML-DSA) for digital signatures
- **OWASP** security guidelines
- **Zero-Knowledge Architecture** principles

**CRITICAL:** Never store plaintext encryption keys or passwords in the database. Always use client-side encryption with wrapped keys.
