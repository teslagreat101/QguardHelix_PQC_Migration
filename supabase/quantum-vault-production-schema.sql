-- ============================================================================
-- QUANTUM VAULT — ENTERPRISE-GRADE SUPABASE SQL SCHEMA
-- Post-Quantum Encrypted File Storage: ML-KEM-768 + AES-256-GCM + ML-DSA-65
-- Version: 2.0 Production-Ready
-- ============================================================================
-- 
-- EXECUTION INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Run as a single transaction
-- 4. Verify no errors in output
--
-- ============================================================================

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 0: CLEANUP (Optional - use only for fresh installs)
-- ───────────────────────────────────────────────────────────────────────────

-- Uncomment below to reset (DANGER: destroys all vault data)
-- DROP TABLE IF EXISTS public.vault_processing_status CASCADE;
-- DROP TABLE IF EXISTS public.vault_audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.vault_access_grants CASCADE;
-- DROP TABLE IF EXISTS public.vault_shared_links CASCADE;
-- DROP TABLE IF EXISTS public.vault_recovery_keys CASCADE;
-- DROP TABLE IF EXISTS public.vault_key_rotations CASCADE;
-- DROP TABLE IF EXISTS public.vault_user_keys CASCADE;
-- DROP TABLE IF EXISTS public.vault_keys CASCADE;
-- DROP TABLE IF EXISTS public.vault_upload_sessions CASCADE;
-- DROP TABLE IF EXISTS public.vault_file_metadata CASCADE;
-- DROP TABLE IF EXISTS public.vault_files CASCADE;
-- DROP TABLE IF EXISTS public.vault_folders CASCADE;
-- DROP TABLE IF EXISTS public.vault_trusted_devices CASCADE;
-- DROP TABLE IF EXISTS public.vault_failed_attempts CASCADE;
-- DROP TABLE IF EXISTS public.vault_unlock_sessions CASCADE;
-- DROP TABLE IF EXISTS public.vault_user_profiles CASCADE;
-- DROP TYPE IF EXISTS public.encryption_status CASCADE;
-- DROP TYPE IF EXISTS public.signature_verification_status CASCADE;
-- DROP TYPE IF EXISTS public.vault_key_type CASCADE;
-- DROP TYPE IF EXISTS public.vault_key_status CASCADE;
-- DROP TYPE IF EXISTS public.share_permission CASCADE;
-- DROP TYPE IF EXISTS public.audit_severity CASCADE;
-- DROP TYPE IF EXISTS public.audit_result CASCADE;
-- DROP TYPE IF EXISTS public.file_processing_status CASCADE;
-- DROP TYPE IF EXISTS public.vault_session_status CASCADE;
-- DROP TYPE IF EXISTS public.vault_auth_method CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 1: REQUIRED EXTENSIONS
-- ───────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation for secure identifiers';
COMMENT ON EXTENSION "pgcrypto" IS 'Cryptographic functions for hashing and random bytes';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 2: HELPER FUNCTIONS
-- ───────────────────────────────────────────────────────────────────────────

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_updated_at() IS 'Trigger function to automatically update the updated_at column';

-- Get current authenticated user ID
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.requesting_user_id() IS 'Returns the current authenticated user UUID from JWT';

-- Generate secure random token
CREATE OR REPLACE FUNCTION public.generate_secure_token(length INT DEFAULT 32)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(gen_random_bytes(length), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_secure_token(INT) IS 'Generates a cryptographically secure random hex token';

-- Hash password with bcrypt (for share link passwords)
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf', 10));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.hash_password(TEXT) IS 'Hashes a password using bcrypt (for share link passwords)';

-- Verify password hash
CREATE OR REPLACE FUNCTION public.verify_password_hash(password TEXT, hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.verify_password_hash(TEXT, TEXT) IS 'Verifies a password against its bcrypt hash';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 3: CUSTOM ENUM TYPES
-- ───────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.encryption_status AS ENUM (
    'pending',      -- Waiting for encryption
    'encrypting',   -- Encryption in progress
    'encrypted',    -- Successfully encrypted
    'failed',       -- Encryption failed
    'rotating',     -- Key rotation in progress
    'revoked'       -- Encryption revoked
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.signature_verification_status AS ENUM (
    'unverified',   -- Not yet verified
    'verified',     -- Signature valid
    'failed',       -- Signature invalid
    'expired'       -- Signature expired
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vault_key_type AS ENUM (
    'encryption',   -- ML-KEM for encryption
    'signing',      -- ML-DSA for signatures
    'recovery',     -- Recovery key
    'device_bound', -- Device-specific key
    'master'        -- Master key derivation
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vault_key_status AS ENUM (
    'active',       -- Currently in use
    'inactive',     -- Not in active use
    'rotated',      -- Replaced by newer key
    'revoked',      -- Explicitly revoked
    'expired',      -- Past expiration date
    'compromised'   -- Security breach
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.share_permission AS ENUM (
    'view',         -- View file metadata
    'download',     -- Download file
    'upload',       -- Upload to folder
    'edit',         -- Modify file
    'reshare',      -- Create share links
    'revoke',       -- Revoke access
    'admin'         -- Full control
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_severity AS ENUM (
    'info',         -- Informational
    'warning',      -- Warning
    'critical',     -- Critical event
    'emergency'     -- Immediate attention
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_result AS ENUM (
    'success',      -- Operation succeeded
    'failure',      -- Operation failed
    'blocked',      -- Blocked by policy
    'timeout'       -- Operation timed out
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.file_processing_status AS ENUM (
    'queued',       -- Waiting to process
    'uploading',    -- Upload in progress
    'processing',   -- Processing
    'encrypting',   -- Encrypting
    'encrypted',    -- Encrypted
    'decrypting',   -- Decrypting
    'verifying',    -- Verifying integrity
    'complete',     -- Complete
    'failed',       -- Failed
    'cancelled',    -- Cancelled
    'paused'        -- Paused
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vault_session_status AS ENUM (
    'active',       -- Session valid
    'expired',      -- Session expired
    'locked',       -- Vault locked
    'revoked',      -- Session revoked
    'suspended'     -- Temporarily suspended
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vault_auth_method AS ENUM (
    'password',     -- Password unlock
    'biometric',    -- Biometric auth
    'hardware_key', -- Hardware security key
    'recovery',     -- Recovery phrase
    'sso',          -- Single sign-on
    'mfa'           -- Multi-factor auth
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 4: VAULT USER PROFILES (Storage Quota & Settings)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_user_profiles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Display & Settings
  display_name          TEXT,
  timezone              TEXT DEFAULT 'UTC',
  language              TEXT DEFAULT 'en',
  
  -- Storage Quota (bytes)
  storage_used          BIGINT NOT NULL DEFAULT 0,
  storage_quota         BIGINT NOT NULL DEFAULT 10737418240,  -- 10 GB default
  storage_warning_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- File/Folder Counts
  file_count            INT NOT NULL DEFAULT 0,
  folder_count          INT NOT NULL DEFAULT 0,
  encrypted_file_count  INT NOT NULL DEFAULT 0,
  
  -- Vault State
  vault_created         BOOLEAN NOT NULL DEFAULT FALSE,
  vault_locked          BOOLEAN NOT NULL DEFAULT TRUE,
  vault_unlocked_at     TIMESTAMPTZ,
  last_vault_activity   TIMESTAMPTZ,
  
  -- Password/KDF Settings (metadata only - NO PLAINTEXT PASSWORDS)
  kdf_algorithm         TEXT DEFAULT 'Argon2id',
  kdf_iterations        INT DEFAULT 3,      -- Argon2id memory cost
  kdf_memory            INT DEFAULT 65536,  -- Argon2id memory (64MB)
  kdf_parallelism       INT DEFAULT 4,      -- Argon2id parallelism
  password_version      INT NOT NULL DEFAULT 1,
  password_changed_at   TIMESTAMPTZ,
  password_change_required BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Security Settings
  require_mfa           BOOLEAN NOT NULL DEFAULT FALSE,
  auto_lock_minutes     INT DEFAULT 30,
  max_failed_attempts   INT DEFAULT 5,
  lockout_duration_minutes INT DEFAULT 15,
  
  -- Audit & Compliance
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  is_deleted            BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE INDEX idx_vault_profiles_user ON public.vault_user_profiles(user_id);
CREATE INDEX idx_vault_profiles_storage ON public.vault_user_profiles(storage_used, storage_quota);

-- Triggers
CREATE TRIGGER trg_vault_user_profiles_updated
  BEFORE UPDATE ON public.vault_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row Level Security
ALTER TABLE public.vault_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.vault_user_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.vault_user_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.vault_user_profiles FOR UPDATE
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_user_profiles IS 'Per-user vault configuration, storage quotas, and security settings';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 5: VAULT AUTHENTICATION & UNLOCK SESSIONS
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_unlock_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session State
  status                public.vault_session_status NOT NULL DEFAULT 'active',
  auth_method           public.vault_auth_method DEFAULT 'password',
  
  -- Device Information
  device_id             TEXT,
  device_name           TEXT,
  device_fingerprint    TEXT,
  device_type           TEXT,  -- mobile, desktop, web, api
  
  -- Network Context
  ip_address            INET,
  user_agent            TEXT,
  country_code          TEXT,
  
  -- Trust & Security
  trust_level           TEXT DEFAULT 'standard',  -- untrusted, standard, trusted, highly_trusted
  is_trusted_device     BOOLEAN NOT NULL DEFAULT FALSE,
  requires_reauth       BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Session Timing
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  last_activity         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extended_until        TIMESTAMPTZ,
  
  -- Revocation
  revoked_at            TIMESTAMPTZ,
  revocation_reason     TEXT
);

-- Indexes
CREATE INDEX idx_vault_sessions_user ON public.vault_unlock_sessions(user_id, status);
CREATE INDEX idx_vault_sessions_expires ON public.vault_unlock_sessions(expires_at);
CREATE INDEX idx_vault_sessions_device ON public.vault_unlock_sessions(device_id);

-- Triggers
CREATE TRIGGER trg_vault_sessions_updated
  BEFORE UPDATE ON public.vault_unlock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_unlock_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON public.vault_unlock_sessions FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_unlock_sessions IS 'Active vault unlock sessions with device tracking and expiration';

-- Failed Unlock Attempts (Security Monitoring)
CREATE TABLE IF NOT EXISTS public.vault_failed_attempts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  attempt_type          TEXT NOT NULL DEFAULT 'unlock',  -- unlock, share_access, key_operation
  failure_reason        TEXT,
  
  -- Context
  ip_address            INET,
  user_agent            TEXT,
  device_id             TEXT,
  session_id            UUID REFERENCES public.vault_unlock_sessions(id),
  
  -- Rate Limiting
  attempt_count         INT NOT NULL DEFAULT 1,
  window_start          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vault_failed_user ON public.vault_failed_attempts(user_id, created_at DESC);
CREATE INDEX idx_vault_failed_ip ON public.vault_failed_attempts(ip_address, created_at DESC);
CREATE INDEX idx_vault_failed_window ON public.vault_failed_attempts(user_id, window_start);

-- RLS
ALTER TABLE public.vault_failed_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own failed attempts"
  ON public.vault_failed_attempts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System insert failed attempts"
  ON public.vault_failed_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.vault_failed_attempts IS 'Security log of failed vault access attempts for intrusion detection';

-- Trusted Devices
CREATE TABLE IF NOT EXISTS public.vault_trusted_devices (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  device_id             TEXT NOT NULL,
  device_name           TEXT NOT NULL,
  device_type           TEXT,
  device_fingerprint    TEXT,
  
  -- Trust Level
  trust_level           TEXT NOT NULL DEFAULT 'standard',  -- untrusted, standard, trusted, highly_trusted
  is_revoked            BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Verification
  verified_at           TIMESTAMPTZ,
  verification_method   TEXT,
  
  -- Usage
  last_used_at          TIMESTAMPTZ,
  last_ip_address       INET,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at            TIMESTAMPTZ,
  
  UNIQUE(user_id, device_id)
);

-- Indexes
CREATE INDEX idx_vault_devices_user ON public.vault_trusted_devices(user_id, is_revoked);

-- Triggers
CREATE TRIGGER trg_vault_devices_updated
  BEFORE UPDATE ON public.vault_trusted_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own devices"
  ON public.vault_trusted_devices FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_trusted_devices IS 'User-authorized devices with trust levels for device-bound encryption';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 6: VAULT FOLDERS (Hierarchical Structure)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_folders (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Hierarchy
  name                  TEXT NOT NULL,
  parent_id             UUID REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  path                  TEXT NOT NULL DEFAULT '/',
  depth                 INT NOT NULL DEFAULT 0,
  
  -- Security
  is_encrypted          BOOLEAN NOT NULL DEFAULT FALSE,
  encryption_key_id     UUID,
  
  -- Soft Delete / Trash
  is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at            TIMESTAMPTZ,
  permanent_delete_after TIMESTAMPTZ,
  
  -- Metadata
  color                 TEXT,  -- UI color tag
  icon                  TEXT,  -- UI icon
  
  -- Stats
  file_count            INT NOT NULL DEFAULT 0,
  total_size            BIGINT NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vault_folders_user ON public.vault_folders(user_id, is_deleted);
CREATE INDEX idx_vault_folders_parent ON public.vault_folders(parent_id);
CREATE INDEX idx_vault_folders_path ON public.vault_folders(user_id, path);

-- Triggers
CREATE TRIGGER trg_vault_folders_updated
  BEFORE UPDATE ON public.vault_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folders"
  ON public.vault_folders FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_folders IS 'Hierarchical folder structure for vault organization';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 7: VAULT FILES (Core Encrypted File Storage)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_files (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id               UUID REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  
  -- Original File Info
  original_filename       TEXT NOT NULL,
  encrypted_filename      TEXT,
  mime_type               TEXT NOT NULL DEFAULT 'application/octet-stream',
  
  -- Size Information
  original_size           BIGINT NOT NULL DEFAULT 0,
  encrypted_size          BIGINT,
  compression_ratio       NUMERIC(5,2),  -- e.g., 0.95 = 95% of original
  
  -- Storage
  storage_path            TEXT,  -- Supabase Storage path
  storage_bucket          TEXT DEFAULT 'vault-encrypted',
  checksum_sha256         TEXT,  -- SHA-256 of original file
  
  -- ─────────────────────────────────────────────────────────────────
  -- POST-QUANTUM ENCRYPTION METADATA (ML-KEM-768 + AES-256-GCM)
  -- ─────────────────────────────────────────────────────────────────
  
  encryption_status       public.encryption_status NOT NULL DEFAULT 'pending',
  encryption_algorithm    TEXT DEFAULT 'ML-KEM-768+AES-256-GCM',
  algorithm_version       TEXT DEFAULT 'v2.0',
  
  -- ML-KEM-768 Encapsulated Key (ciphertext)
  kem_ciphertext          TEXT,  -- Hex-encoded ML-KEM-768 encapsulated key
  
  -- AES-256-GCM Parameters
  aes_nonce               TEXT,  -- Hex-encoded 96-bit IV/nonce
  aes_auth_tag            TEXT,  -- Hex-encoded 128-bit authentication tag
  
  -- Envelope Encryption Metadata
  key_derivation_meta     JSONB,  -- {"salt": "...", "kdf": "Argon2id", "params": {...}}
  envelope_meta           JSONB,  -- {"wrapped_key": "...", "key_version": 1}
  
  -- Integrity Verification
  content_hash            TEXT,  -- SHA-256 of original plaintext
  encrypted_content_hash TEXT,  -- SHA-256 of encrypted data
  aad_hash                TEXT,  -- Associated data hash for AEAD
  
  -- Key References (FKs added after vault_keys is created in Section 11)
  encryption_key_id       UUID,
  key_rotation_status     TEXT DEFAULT 'current',  -- current, rotating, rotated
  last_rotated_at         TIMESTAMPTZ,
  
  -- ─────────────────────────────────────────────────────────────────
  -- ML-DSA-65 SIGNATURE METADATA
  -- ─────────────────────────────────────────────────────────────────
  
  signature               TEXT,  -- Hex-encoded ML-DSA-65 signature
  signing_key_id          UUID,
  ml_dsa_public_key_ref   TEXT,  -- Reference to verification key
  signature_status        public.signature_verification_status DEFAULT 'unverified',
  signed_at               TIMESTAMPTZ,
  
  -- ─────────────────────────────────────────────────────────────────
  -- VERSIONING
  -- ─────────────────────────────────────────────────────────────────
  
  version                 INT NOT NULL DEFAULT 1,
  is_latest               BOOLEAN NOT NULL DEFAULT TRUE,
  parent_version_id       UUID REFERENCES public.vault_files(id),
  version_notes           TEXT,
  
  -- ─────────────────────────────────────────────────────────────────
  -- PROCESSING & STATUS
  -- ─────────────────────────────────────────────────────────────────
  
  processing_status       public.file_processing_status DEFAULT 'queued',
  upload_session_id       UUID,
  error_message           TEXT,
  retry_count             INT NOT NULL DEFAULT 0,
  max_retries             INT NOT NULL DEFAULT 3,
  
  -- ─────────────────────────────────────────────────────────────────
  -- SOFT DELETE / TRASH
  -- ─────────────────────────────────────────────────────────────────
  
  is_deleted              BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at              TIMESTAMPTZ,
  deleted_by_session_id   UUID REFERENCES public.vault_unlock_sessions(id),
  permanent_delete_after  TIMESTAMPTZ,
  
  -- ─────────────────────────────────────────────────────────────────
  -- TIMESTAMPS
  -- ─────────────────────────────────────────────────────────────────
  
  uploaded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  encrypted_at            TIMESTAMPTZ,
  processed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (Performance Critical)
CREATE INDEX idx_vault_files_user ON public.vault_files(user_id, is_deleted);
CREATE INDEX idx_vault_files_folder ON public.vault_files(folder_id, is_deleted);
CREATE INDEX idx_vault_files_status ON public.vault_files(encryption_status);
CREATE INDEX idx_vault_files_processing ON public.vault_files(processing_status);
CREATE INDEX idx_vault_files_latest ON public.vault_files(user_id, is_latest, is_deleted);
CREATE INDEX idx_vault_files_version ON public.vault_files(parent_version_id);
CREATE INDEX idx_vault_files_uploaded ON public.vault_files(user_id, uploaded_at DESC);
CREATE INDEX idx_vault_files_hash ON public.vault_files(content_hash);

-- Triggers
CREATE TRIGGER trg_vault_files_updated
  BEFORE UPDATE ON public.vault_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own files"
  ON public.vault_files FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_files IS 'Encrypted file storage with ML-KEM-768 + AES-256-GCM encryption metadata';
COMMENT ON COLUMN public.vault_files.kem_ciphertext IS 'ML-KEM-768 encapsulated key (hex) - used to derive AES key';
COMMENT ON COLUMN public.vault_files.aes_nonce IS 'AES-256-GCM nonce/IV (hex) - must be unique per encryption';
COMMENT ON COLUMN public.vault_files.aes_auth_tag IS 'AES-256-GCM authentication tag (hex) - ensures integrity';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 8: FILE METADATA (Extensible Key-Value Storage)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_file_metadata (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id               UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  key                   TEXT NOT NULL,
  value                 JSONB NOT NULL DEFAULT '{}',
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(file_id, key)
);

-- Triggers
CREATE TRIGGER trg_vault_file_metadata_updated
  BEFORE UPDATE ON public.vault_file_metadata
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_file_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own file metadata"
  ON public.vault_file_metadata FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_file_metadata IS 'Extensible metadata storage for files (EXIF, tags, custom data)';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 9: FILE VERSIONS (History Tracking)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_file_versions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id               UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  version_number        INT NOT NULL,
  storage_path          TEXT NOT NULL,
  size                  BIGINT NOT NULL,
  
  -- Change Info
  change_type           TEXT NOT NULL,  -- created, modified, renamed, encrypted, rotated
  change_summary        TEXT,
  
  -- Encryption State at this version
  encryption_key_id     UUID,
  kem_ciphertext        TEXT,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(file_id, version_number)
);

-- Indexes
CREATE INDEX idx_vault_versions_file ON public.vault_file_versions(file_id, version_number DESC);

-- RLS
ALTER TABLE public.vault_file_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own file versions"
  ON public.vault_file_versions FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_file_versions IS 'Complete version history for encrypted files';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 10: UPLOAD SESSIONS (Resumable Uploads)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_upload_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File Info
  file_id               UUID REFERENCES public.vault_files(id) ON DELETE SET NULL,
  folder_id             UUID REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  
  filename              TEXT NOT NULL,
  mime_type             TEXT,
  total_size            BIGINT NOT NULL,
  chunk_size            INT DEFAULT 5242880,  -- 5MB chunks
  total_chunks          INT NOT NULL,
  
  -- Progress
  uploaded_chunks       INT[] DEFAULT ARRAY[]::INT[],
  uploaded_bytes        BIGINT NOT NULL DEFAULT 0,
  progress_pct          INT NOT NULL DEFAULT 0,
  
  -- Status
  status                public.file_processing_status DEFAULT 'uploading',
  is_multipart          BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Encryption Settings
  encryption_requested  BOOLEAN NOT NULL DEFAULT TRUE,
  encryption_key_id     UUID,
  
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes
CREATE INDEX idx_vault_uploads_user ON public.vault_upload_sessions(user_id, status);
CREATE INDEX idx_vault_uploads_expires ON public.vault_upload_sessions(expires_at);

-- Triggers
CREATE TRIGGER trg_vault_uploads_updated
  BEFORE UPDATE ON public.vault_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_upload_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own upload sessions"
  ON public.vault_upload_sessions FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_upload_sessions IS 'Resumable upload sessions with chunked upload support';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 11: VAULT KEYS (PQC Key Management)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_keys (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Key Identity
  key_type              public.vault_key_type NOT NULL,
  algorithm             TEXT NOT NULL,  -- ML-KEM-768, ML-DSA-65, AES-256-GCM
  fingerprint           TEXT NOT NULL,  -- Public key fingerprint
  
  -- Public Key (safe to store)
  public_key_hex        TEXT,
  public_key_der        BYTEA,
  
  -- Wrapped Private Key (NEVER store plaintext)
  wrapped_secret_key    TEXT,  -- Base64-encoded, encrypted with user master key
  wrapped_secret_der    BYTEA,
  wrapping_nonce        TEXT,  -- AES-GCM nonce
  wrapping_algorithm    TEXT DEFAULT 'AES-256-GCM',
  
  -- Device Binding
  device_id             TEXT,
  is_device_bound       BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Status
  status                public.vault_key_status NOT NULL DEFAULT 'active',
  version               INT NOT NULL DEFAULT 1,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Rotation Chain
  rotated_from_id       UUID REFERENCES public.vault_keys(id),
  rotated_at            TIMESTAMPTZ,
  
  -- Revocation
  revoked_at            TIMESTAMPTZ,
  revocation_reason     TEXT,
  
  -- Expiration
  expires_at            TIMESTAMPTZ,
  last_used_at          TIMESTAMPTZ,
  
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vault_keys_user ON public.vault_keys(user_id, key_type, is_active);
CREATE INDEX idx_vault_keys_fingerprint ON public.vault_keys(fingerprint);
CREATE INDEX idx_vault_keys_status ON public.vault_keys(user_id, status);
CREATE INDEX idx_vault_keys_version ON public.vault_keys(user_id, key_type, version DESC);

-- Triggers
CREATE TRIGGER trg_vault_keys_updated
  BEFORE UPDATE ON public.vault_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own keys"
  ON public.vault_keys FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_keys IS 'Post-quantum cryptographic keys (ML-KEM, ML-DSA) with wrapped private keys';
COMMENT ON COLUMN public.vault_keys.wrapped_secret_key IS 'Private key encrypted with user master key - NEVER plaintext';

-- Deferred FKs: vault_files references vault_keys (vault_files created in Section 7, vault_keys in Section 11)
ALTER TABLE public.vault_files
  ADD CONSTRAINT fk_vault_files_encryption_key
  FOREIGN KEY (encryption_key_id) REFERENCES public.vault_keys(id) ON DELETE SET NULL;

ALTER TABLE public.vault_files
  ADD CONSTRAINT fk_vault_files_signing_key
  FOREIGN KEY (signing_key_id) REFERENCES public.vault_keys(id) ON DELETE SET NULL;

-- User Master Keys (ZK Passphrase-Protected)
CREATE TABLE IF NOT EXISTS public.vault_user_keys (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Wrapped Master Key Bundle
  wrapped_bundle        TEXT NOT NULL,  -- Base64: {enc_sk, sig_sk, salt, iv}
  bundle_format         TEXT DEFAULT 'v1',
  
  -- Public Keys (for verification)
  enc_public_key        TEXT,  -- ML-KEM-768 public key (hex)
  sign_public_key       TEXT,  -- ML-DSA-65 public key (hex)
  
  -- KDF Metadata (for key derivation)
  kdf_salt              TEXT,
  kdf_algorithm         TEXT DEFAULT 'Argon2id',
  kdf_params            JSONB DEFAULT '{"memory": 65536, "iterations": 3, "parallelism": 4}',
  
  -- Versioning
  key_version           INT NOT NULL DEFAULT 1,
  previous_version_id   UUID,
  
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at            TIMESTAMPTZ
);

-- Triggers
CREATE TRIGGER trg_vault_user_keys_updated
  BEFORE UPDATE ON public.vault_user_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own user keys"
  ON public.vault_user_keys FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_user_keys IS 'User master key bundle encrypted with passphrase (Zero-Knowledge)';

-- Key Rotation History
CREATE TABLE IF NOT EXISTS public.vault_key_rotations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  old_key_id            UUID REFERENCES public.vault_keys(id),
  new_key_id            UUID REFERENCES public.vault_keys(id),
  key_type              public.vault_key_type NOT NULL,
  
  -- Rotation Progress
  reason                TEXT,
  progress_pct          INT DEFAULT 0,
  status                TEXT DEFAULT 'pending',  -- pending, in_progress, complete, failed
  files_re_encrypted    INT DEFAULT 0,
  total_files           INT DEFAULT 0,
  
  -- Error Tracking
  error_message         TEXT,
  retry_count           INT DEFAULT 0,
  
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_vault_rotations_user ON public.vault_key_rotations(user_id, status);

-- RLS
ALTER TABLE public.vault_key_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rotations"
  ON public.vault_key_rotations FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_key_rotations IS 'Track key rotation operations with progress for large vaults';

-- Recovery Keys
CREATE TABLE IF NOT EXISTS public.vault_recovery_keys (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  recovery_type         TEXT NOT NULL DEFAULT 'mnemonic',  -- mnemonic, hardware, social
  
  -- Verification (NOT the actual recovery key)
  verification_hash     TEXT NOT NULL,  -- Hash of recovery key for verification
  verification_salt     TEXT,
  
  -- Status
  is_used               BOOLEAN NOT NULL DEFAULT FALSE,
  used_at               TIMESTAMPTZ,
  used_from_ip          INET,
  
  -- Security
  max_uses              INT DEFAULT 1,
  use_count             INT DEFAULT 0,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.vault_recovery_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recovery keys"
  ON public.vault_recovery_keys FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_recovery_keys IS 'Recovery key verification metadata (actual keys held by user only)';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 12: SECURE SHARING
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_shared_links (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Link Target (file or folder)
  file_id               UUID REFERENCES public.vault_files(id) ON DELETE SET NULL,
  folder_id             UUID REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  
  -- Access Token
  token                 TEXT NOT NULL UNIQUE DEFAULT public.generate_secure_token(32),
  
  -- Permissions (array of enum)
  permissions           public.share_permission[] DEFAULT ARRAY['view','download']::public.share_permission[],
  
  -- Password Protection
  is_password_protected BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash         TEXT,  -- bcrypt hash
  password_hint         TEXT,
  
  -- Download Limits
  max_downloads         INT,
  download_count        INT NOT NULL DEFAULT 0,
  
  -- One-Time Link
  is_one_time           BOOLEAN NOT NULL DEFAULT FALSE,
  is_used               BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Security
  is_revoked            BOOLEAN NOT NULL DEFAULT FALSE,
  is_destroyed          BOOLEAN NOT NULL DEFAULT FALSE,
  failed_password_attempts INT NOT NULL DEFAULT 0,
  max_failed_attempts   INT DEFAULT 5,
  
  -- Encrypted Data for Zero-Knowledge Sharing
  encrypted_file_data   BYTEA,  -- Re-encrypted with share-specific key
  encryption_metadata   JSONB,  -- Nonce, key encapsulation for recipient
  
  -- Original File Info (for display)
  original_filename     TEXT,
  original_size         BIGINT,
  mime_type             TEXT,
  
  -- Access Tracking
  first_accessed_at     TIMESTAMPTZ,
  last_accessed_at      TIMESTAMPTZ,
  access_count          INT DEFAULT 0,
  
  -- Timestamps
  expires_at            TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  destroyed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shared_links_user ON public.vault_shared_links(user_id, is_revoked, is_destroyed);
CREATE INDEX idx_shared_links_token ON public.vault_shared_links(token);
CREATE INDEX idx_shared_links_file ON public.vault_shared_links(file_id);
CREATE INDEX idx_shared_links_expires ON public.vault_shared_links(expires_at);

-- RLS
ALTER TABLE public.vault_shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own shared links"
  ON public.vault_shared_links FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_shared_links IS 'Time-limited, password-protected share links with access controls';

-- Access Grants (Direct User-to-User Sharing)
CREATE TABLE IF NOT EXISTS public.vault_access_grants (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Grantee (can be registered user or pending email)
  grantee_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_email         TEXT,
  
  -- Target
  file_id               UUID REFERENCES public.vault_files(id) ON DELETE CASCADE,
  folder_id             UUID REFERENCES public.vault_folders(id) ON DELETE CASCADE,
  
  -- Permissions
  permissions           public.share_permission[] DEFAULT ARRAY['view']::public.share_permission[],
  
  -- Status
  is_revoked            BOOLEAN NOT NULL DEFAULT FALSE,
  is_accepted           BOOLEAN,  -- NULL = pending, TRUE = accepted, FALSE = declined
  
  -- Encrypted Key for Grantee
  wrapped_file_key      TEXT,  -- File key wrapped for grantee's public key
  
  -- Timestamps
  expires_at            TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_access_grants_owner ON public.vault_access_grants(owner_id, is_revoked);
CREATE INDEX idx_access_grants_grantee ON public.vault_access_grants(grantee_id, is_revoked);

-- RLS
ALTER TABLE public.vault_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their grants"
  ON public.vault_access_grants FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Grantees view their grants"
  ON public.vault_access_grants FOR SELECT
  USING (grantee_id = auth.uid());

COMMENT ON TABLE public.vault_access_grants IS 'Direct sharing permissions between users with wrapped encryption keys';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 13: AUDIT LOGGING (Enterprise Compliance)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_audit_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event Classification
  event_type            TEXT NOT NULL,  -- file_uploaded, file_encrypted, key_rotated, etc.
  severity              public.audit_severity NOT NULL DEFAULT 'info',
  result                public.audit_result DEFAULT 'success',
  
  -- Resource Reference
  resource_type         TEXT,  -- file, folder, key, share_link, session
  resource_id           TEXT,
  
  -- Description
  description           TEXT,
  
  -- Context
  ip_address            TEXT,
  user_agent            TEXT,
  device_id             TEXT,
  session_id            UUID,
  
  -- Geographic (if available)
  country_code          TEXT,
  city                  TEXT,
  
  -- Extended Data
  metadata              JSONB DEFAULT '{}',
  
  -- Compliance
  retention_class       TEXT DEFAULT 'standard',  -- standard, legal_hold, archived
  archived_at           TIMESTAMPTZ,
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (Critical for query performance)
CREATE INDEX idx_audit_logs_user ON public.vault_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_type ON public.vault_audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.vault_audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_severity ON public.vault_audit_logs(severity, created_at DESC);
CREATE INDEX idx_audit_logs_ip ON public.vault_audit_logs(ip_address, created_at DESC);

-- Partitioning (optional, for high-volume deployments)
-- This requires pg_partman or manual setup for production

-- RLS
ALTER TABLE public.vault_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own audit logs"
  ON public.vault_audit_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own audit logs"
  ON public.vault_audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.vault_audit_logs IS 'Comprehensive security audit trail for compliance and forensics';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 14: REALTIME TELEMETRY (Live Progress Updates)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vault_processing_status (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Operation Type
  operation             TEXT NOT NULL,  -- upload, encrypt, decrypt, verify, rotate, integrity_check
  
  -- Resource
  resource_type         TEXT NOT NULL,  -- file, folder, key, batch
  resource_id           TEXT,
  resource_name         TEXT,
  
  -- Progress
  stage                 TEXT NOT NULL DEFAULT 'pending',  -- preparing, processing, finalizing, complete
  progress_pct          INT NOT NULL DEFAULT 0,
  
  -- Status
  message               TEXT,
  error_message         TEXT,
  retry_count           INT NOT NULL DEFAULT 0,
  is_complete           BOOLEAN NOT NULL DEFAULT FALSE,
  is_cancelled          BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Performance
  bytes_processed       BIGINT DEFAULT 0,
  total_bytes           BIGINT,
  speed_mbps          NUMERIC(10,2),
  eta_seconds         INT,
  
  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_processing_user ON public.vault_processing_status(user_id, is_complete);
CREATE INDEX idx_processing_resource ON public.vault_processing_status(resource_id, operation);

-- Triggers
CREATE TRIGGER trg_processing_status_updated
  BEFORE UPDATE ON public.vault_processing_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.vault_processing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own processing status"
  ON public.vault_processing_status FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE public.vault_processing_status IS 'Real-time progress tracking for long-running operations';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 15: SUPABASE STORAGE INTEGRATION
-- ───────────────────────────────────────────────────────────────────────────
-- NOTE: Supabase restricts direct SQL on the storage schema.
--       If the statements below fail, create the bucket + policies manually
--       via the Supabase Dashboard (Storage → Buckets → New Bucket).
-- ───────────────────────────────────────────────────────────────────────────

-- Attempt to create the vault storage bucket via SQL (may fail with 42501)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, avif_autodetection)
  VALUES (
    'vault-encrypted',
    'vault-encrypted',
    FALSE,
    1073741824,
    NULL,
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    public = FALSE,
    file_size_limit = 1073741824;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping bucket creation: insufficient privileges. Create bucket manually via Supabase Dashboard → Storage.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping bucket creation: %', SQLERRM;
END $$;

-- Attempt to create storage RLS policies via SQL (may fail with 42501)
-- These enforce: users can only access vault/{user_id}/ paths
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users upload own vault objects" ON storage.objects;
  CREATE POLICY "Users upload own vault objects"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'vault-encrypted'
      AND (storage.foldername(name))[1] = 'vault'
      AND (storage.foldername(name))[2] = auth.uid()::TEXT
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage policies: insufficient privileges. Set policies manually via Supabase Dashboard → Storage → Policies.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping storage policy (upload): %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users read own vault objects" ON storage.objects;
  CREATE POLICY "Users read own vault objects"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'vault-encrypted'
      AND (storage.foldername(name))[1] = 'vault'
      AND (storage.foldername(name))[2] = auth.uid()::TEXT
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage policies: insufficient privileges.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping storage policy (read): %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users update own vault objects" ON storage.objects;
  CREATE POLICY "Users update own vault objects"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'vault-encrypted'
      AND (storage.foldername(name))[1] = 'vault'
      AND (storage.foldername(name))[2] = auth.uid()::TEXT
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage policies: insufficient privileges.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping storage policy (update): %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users delete own vault objects" ON storage.objects;
  CREATE POLICY "Users delete own vault objects"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'vault-encrypted'
      AND (storage.foldername(name))[1] = 'vault'
      AND (storage.foldername(name))[2] = auth.uid()::TEXT
    );
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage policies: insufficient privileges.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping storage policy (delete): %', SQLERRM;
END $$;

DO $$
BEGIN
  COMMENT ON TABLE storage.objects IS 'Encrypted vault files stored with user-isolated paths: vault/{user_id}/{file_id}/...';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping storage comment: insufficient privileges.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping storage comment: %', SQLERRM;
END $$;

/* ─── MANUAL FALLBACK INSTRUCTIONS ─────────────────────────────────────────

If the SQL above failed with "must be owner of table objects",
complete these steps manually in the Supabase Dashboard:

1. Create the Bucket:
   Dashboard → Storage → New Bucket
   - Name: vault-encrypted
   - Public: OFF (private)
   - File size limit: 1073741824 (1 GB)

2. Add Storage Policies:
   Dashboard → Storage → Policies → New Policy

   INSERT policy (name: "Users upload own vault objects"):
   WITH CHECK (
     bucket_id = 'vault-encrypted'
     AND (storage.foldername(name))[1] = 'vault'
     AND (storage.foldername(name))[2] = auth.uid()::TEXT
   )

   SELECT policy (name: "Users read own vault objects"):
   USING (
     bucket_id = 'vault-encrypted'
     AND (storage.foldername(name))[1] = 'vault'
     AND (storage.foldername(name))[2] = auth.uid()::TEXT
   )

   UPDATE policy (name: "Users update own vault objects"):
   USING (
     bucket_id = 'vault-encrypted'
     AND (storage.foldername(name))[1] = 'vault'
     AND (storage.foldername(name))[2] = auth.uid()::TEXT
   )

   DELETE policy (name: "Users delete own vault objects"):
   USING (
     bucket_id = 'vault-encrypted'
     AND (storage.foldername(name))[1] = 'vault'
     AND (storage.foldername(name))[2] = auth.uid()::TEXT
   )

─────────────────────────────────────────────────────────────────────────── */

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 16: HELPER FUNCTIONS FOR APPLICATION
-- ───────────────────────────────────────────────────────────────────────────

-- Ensure vault profile exists (auto-create on first access)
CREATE OR REPLACE FUNCTION public.ensure_vault_profile()
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT id INTO profile_id
  FROM public.vault_user_profiles
  WHERE user_id = current_user_id;

  IF profile_id IS NULL THEN
    INSERT INTO public.vault_user_profiles (user_id)
    VALUES (current_user_id)
    RETURNING id INTO profile_id;
  END IF;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.ensure_vault_profile() IS 'Auto-creates vault profile if missing; returns profile ID';

-- Count items in folder
CREATE OR REPLACE FUNCTION public.vault_folder_item_count(folder_uuid UUID)
RETURNS TABLE(item_count BIGINT, file_count BIGINT, folder_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::BIGINT FROM public.vault_files 
     WHERE folder_id = folder_uuid AND user_id = auth.uid() AND NOT is_deleted)
    +
    (SELECT COUNT(*)::BIGINT FROM public.vault_folders 
     WHERE parent_id = folder_uuid AND user_id = auth.uid() AND NOT is_deleted)
    AS item_count,
    (SELECT COUNT(*)::BIGINT FROM public.vault_files 
     WHERE folder_id = folder_uuid AND user_id = auth.uid() AND NOT is_deleted)
    AS file_count,
    (SELECT COUNT(*)::BIGINT FROM public.vault_folders 
     WHERE parent_id = folder_uuid AND user_id = auth.uid() AND NOT is_deleted)
    AS folder_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.vault_folder_item_count(UUID) IS 'Returns file and folder counts for a given folder';

-- Get folder path as array
CREATE OR REPLACE FUNCTION public.vault_folder_path_array(folder_uuid UUID)
RETURNS TABLE(id UUID, name TEXT, depth INT) AS $$
WITH RECURSIVE folder_tree AS (
  -- Base case: start with the given folder
  SELECT f.id, f.name, f.parent_id, f.depth, 0 AS level
  FROM public.vault_folders f
  WHERE f.id = folder_uuid AND f.user_id = auth.uid()
  
  UNION ALL
  
  -- Recursive case: get parent folders
  SELECT f.id, f.name, f.parent_id, f.depth, ft.level + 1
  FROM public.vault_folders f
  INNER JOIN folder_tree ft ON f.id = ft.parent_id
  WHERE f.user_id = auth.uid()
)
SELECT ft.id, ft.name, ft.level
FROM folder_tree ft
ORDER BY ft.level DESC;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.vault_folder_path_array(UUID) IS 'Returns breadcrumb path for a folder (root to target)';

-- Check active unlock session
CREATE OR REPLACE FUNCTION public.has_active_vault_session(check_device_id TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  has_session BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.vault_unlock_sessions
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND expires_at > NOW()
    AND (check_device_id IS NULL OR device_id = check_device_id)
  ) INTO has_session;
  
  RETURN has_session;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.has_active_vault_session(TEXT) IS 'Returns true if user has an active vault unlock session';

-- Update storage quota
CREATE OR REPLACE FUNCTION public.update_vault_storage_quota()
RETURNS TRIGGER AS $$
DECLARE
  total_size BIGINT;
  file_count INT;
  encrypted_count INT;
BEGIN
  -- Calculate totals for the user
  SELECT 
    COALESCE(SUM(encrypted_size), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE encryption_status = 'encrypted')
  INTO total_size, file_count, encrypted_count
  FROM public.vault_files
  WHERE user_id = NEW.user_id AND NOT is_deleted;

  -- Update profile
  UPDATE public.vault_user_profiles
  SET 
    storage_used = total_size,
    file_count = file_count,
    encrypted_file_count = encrypted_count,
    updated_at = NOW()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update storage quota
DROP TRIGGER IF EXISTS trg_vault_files_storage_quota ON public.vault_files;
CREATE TRIGGER trg_vault_files_storage_quota
  AFTER INSERT OR UPDATE OR DELETE ON public.vault_files
  FOR EACH ROW EXECUTE FUNCTION public.update_vault_storage_quota();

-- Check if user is rate limited
CREATE OR REPLACE FUNCTION public.check_vault_rate_limit(
  action_type TEXT,
  max_attempts INT DEFAULT 10,
  window_minutes INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INT;
BEGIN
  SELECT COUNT(*) INTO attempt_count
  FROM public.vault_audit_logs
  WHERE user_id = auth.uid()
  AND event_type = action_type
  AND created_at > NOW() - INTERVAL '1 minute' * window_minutes;
  
  RETURN attempt_count >= max_attempts;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.check_vault_rate_limit(TEXT, INT, INT) IS 'Checks if user has exceeded rate limit for an action';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 17: REALTIME PUBLICATION
-- ───────────────────────────────────────────────────────────────────────────

-- Enable realtime for all vault tables
DO $$
BEGIN
  -- Add tables to realtime publication (ignore errors if already added)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_files;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_folders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_keys;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_shared_links;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_audit_logs;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_processing_status;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_upload_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_user_profiles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_unlock_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 18: VIEWS FOR CONVENIENT QUERIES
-- ───────────────────────────────────────────────────────────────────────────

-- Vault statistics summary
CREATE OR REPLACE VIEW public.vault_stats AS
SELECT 
  p.user_id,
  p.storage_used,
  p.storage_quota,
  p.file_count,
  p.folder_count,
  p.encrypted_file_count,
  (p.storage_used::NUMERIC / p.storage_quota * 100)::NUMERIC(5,2) AS storage_pct,
  COUNT(DISTINCT f.id) FILTER (WHERE f.encryption_status = 'encrypted' AND NOT f.is_deleted) AS encrypted_files,
  COUNT(DISTINCT k.id) FILTER (WHERE k.is_active) AS active_keys,
  COUNT(DISTINCT s.id) FILTER (WHERE NOT s.is_revoked AND NOT s.is_destroyed) AS active_shares,
  COUNT(DISTINCT d.id) FILTER (WHERE NOT d.is_revoked) AS trusted_devices
FROM public.vault_user_profiles p
LEFT JOIN public.vault_files f ON f.user_id = p.user_id
LEFT JOIN public.vault_keys k ON k.user_id = p.user_id
LEFT JOIN public.vault_shared_links s ON s.user_id = p.user_id
LEFT JOIN public.vault_trusted_devices d ON d.user_id = p.user_id
WHERE p.user_id = auth.uid()
GROUP BY p.user_id, p.storage_used, p.storage_quota, p.file_count, p.folder_count, p.encrypted_file_count;

COMMENT ON VIEW public.vault_stats IS 'Comprehensive vault statistics for dashboard';

-- Recent activity summary
CREATE OR REPLACE VIEW public.vault_recent_activity AS
SELECT 
  a.id,
  a.event_type,
  a.severity,
  a.resource_type,
  a.resource_id,
  a.description,
  a.ip_address,
  a.created_at
FROM public.vault_audit_logs a
WHERE a.user_id = auth.uid()
ORDER BY a.created_at DESC
LIMIT 100;

COMMENT ON VIEW public.vault_recent_activity IS 'Recent vault activity for dashboard display';

-- Active sessions view
CREATE OR REPLACE VIEW public.vault_active_sessions AS
SELECT 
  s.id,
  s.device_name,
  s.device_type,
  s.trust_level,
  s.ip_address,
  s.created_at,
  s.expires_at,
  s.last_activity,
  CASE 
    WHEN s.expires_at < NOW() THEN 'expired'
    WHEN s.status = 'active' THEN 'active'
    ELSE s.status::TEXT
  END AS effective_status
FROM public.vault_unlock_sessions s
WHERE s.user_id = auth.uid()
AND s.status = 'active'
ORDER BY s.created_at DESC;

COMMENT ON VIEW public.vault_active_sessions IS 'Currently active vault unlock sessions';

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 19: SECURITY CONSIDERATIONS & NOTES
-- ───────────────────────────────────────────────────────────────────────────

/*
IMPORTANT SECURITY NOTES:

1. ENCRYPTION METADATA ONLY
   - This schema stores ONLY encryption metadata (ciphertexts, nonces, hashes)
   - NEVER store: plaintext AES keys, plaintext passwords, decrypted content
   - All encryption/decryption happens client-side (Zero-Knowledge)

2. ROW LEVEL SECURITY (RLS)
   - Every table has RLS enabled with user_id = auth.uid() checks
   - Users can NEVER access another user's data through SQL
   - Service role bypasses RLS - use only for admin functions

3. STORAGE ISOLATION
   - Storage path format: vault/{user_id}/{file_id}/{filename}
   - RLS policies enforce strict user-scoped access
   - Files are encrypted blobs - no MIME type validation needed

4. AUDIT LOGGING
   - All security events logged with user_id, IP, user_agent
   - Failed attempts tracked for intrusion detection
   - Compliance-ready with retention classes

5. KEY MANAGEMENT
   - Private keys are wrapped (encrypted) with user master key
   - Master key is derived from user passphrase (Argon2id)
   - Key rotation tracked with progress for large vaults

6. SESSION MANAGEMENT
   - Vault sessions expire after 30 minutes of inactivity
   - Device fingerprinting for trusted device recognition
   - Failed attempt lockout protection

7. COMPLIANCE
   - GDPR: Right to erasure via soft delete + permanent_delete_after
   - SOC 2: Complete audit trail
   - FIPS 203: ML-KEM/ML-DSA for post-quantum security
*/

-- ───────────────────────────────────────────────────────────────────────────
-- SECTION 20: COMPLETION
-- ───────────────────────────────────────────────────────────────────────────

SELECT 'Quantum Vault Production Schema v2.0 Installed Successfully' AS status;
