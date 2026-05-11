-- ============================================================================
-- Qguard Helix Quantum Vault — Complete Supabase SQL Schema
-- Post-Quantum Encrypted File Storage
-- ML-KEM-768 + AES-256-GCM Envelope Encryption with ML-DSA-65 Signatures
-- ============================================================================
-- Run this entire script in the Supabase SQL Editor.
-- ============================================================================

-- ─── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Helper: auto-update updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Helper: current user id (for RLS) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE public.encryption_status AS ENUM (
    'pending','encrypting','encrypted','failed','rotating','revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.signature_verification_status AS ENUM (
    'unverified','verified','failed','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vault_key_type AS ENUM (
    'encryption','signing','recovery','device_bound'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vault_key_status AS ENUM (
    'active','inactive','rotated','revoked','expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.share_permission AS ENUM (
    'view','download','upload','edit','reshare','revoke'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_severity AS ENUM (
    'info','warning','critical','emergency'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_result AS ENUM (
    'success','failure'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.file_processing_status AS ENUM (
    'queued','uploading','processing','encrypting','encrypted',
    'decrypting','verifying','complete','failed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vault_session_status AS ENUM (
    'active','expired','locked','revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. VAULT USER PROFILE & STORAGE QUOTA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_user_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT,
  storage_used    BIGINT NOT NULL DEFAULT 0,
  storage_quota   BIGINT NOT NULL DEFAULT 104857600,  -- 100 MB free tier
  file_count      INT NOT NULL DEFAULT 0,
  folder_count    INT NOT NULL DEFAULT 0,
  vault_created   BOOLEAN NOT NULL DEFAULT FALSE,
  vault_locked    BOOLEAN NOT NULL DEFAULT TRUE,
  kdf_algorithm   TEXT DEFAULT 'PBKDF2-SHA256',
  kdf_iterations  INT DEFAULT 600000,
  vault_password_version INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_vault_user_profiles_updated
  BEFORE UPDATE ON public.vault_user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

-- ============================================================================
-- 3. VAULT AUTHENTICATION & UNLOCK SESSIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_unlock_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          public.vault_session_status NOT NULL DEFAULT 'active',
  device_id       TEXT,
  ip_address      INET,
  user_agent      TEXT,
  trust_level     TEXT DEFAULT 'standard',
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_sessions_user ON public.vault_unlock_sessions(user_id, status);
CREATE INDEX idx_vault_sessions_expires ON public.vault_unlock_sessions(expires_at);

ALTER TABLE public.vault_unlock_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions"
  ON public.vault_unlock_sessions FOR ALL
  USING (user_id = auth.uid());

-- Failed unlock attempts tracking
CREATE TABLE IF NOT EXISTS public.vault_failed_attempts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_type TEXT NOT NULL DEFAULT 'unlock',
  ip_address  INET,
  user_agent  TEXT,
  device_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_failed_user ON public.vault_failed_attempts(user_id, created_at DESC);

ALTER TABLE public.vault_failed_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own failed attempts"
  ON public.vault_failed_attempts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own failed attempts"
  ON public.vault_failed_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Device trust records
CREATE TABLE IF NOT EXISTS public.vault_trusted_devices (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id     TEXT NOT NULL,
  device_name   TEXT,
  device_fingerprint TEXT,
  trust_level   TEXT NOT NULL DEFAULT 'standard',
  is_revoked    BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

ALTER TABLE public.vault_trusted_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own devices"
  ON public.vault_trusted_devices FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- 4. VAULT FOLDERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_folders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  path        TEXT NOT NULL DEFAULT '/',
  depth       INT NOT NULL DEFAULT 0,
  is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_folders_user ON public.vault_folders(user_id, is_deleted);
CREATE INDEX idx_vault_folders_parent ON public.vault_folders(parent_id);

CREATE TRIGGER trg_vault_folders_updated
  BEFORE UPDATE ON public.vault_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vault_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own folders"
  ON public.vault_folders FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- 5. VAULT FILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_files (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id             UUID REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  original_filename     TEXT NOT NULL,
  encrypted_filename    TEXT,
  mime_type             TEXT NOT NULL DEFAULT 'application/octet-stream',
  original_size         BIGINT NOT NULL DEFAULT 0,
  encrypted_size        BIGINT,
  storage_path          TEXT,
  checksum_sha256       TEXT,
  -- Encryption metadata (ML-KEM-768 + AES-256-GCM)
  encryption_status     public.encryption_status NOT NULL DEFAULT 'pending',
  encryption_algorithm  TEXT DEFAULT 'ML-KEM-768+AES-256-GCM',
  algorithm_version     TEXT DEFAULT 'v1',
  kem_ciphertext        TEXT,    -- ML-KEM-768 encapsulated key ciphertext (hex)
  aes_nonce             TEXT,    -- AES-256-GCM nonce / IV (hex)
  aes_auth_tag          TEXT,    -- AES-256-GCM authentication tag (hex)
  aad_hash              TEXT,    -- associated data hash
  content_hash          TEXT,    -- SHA-256 of original plaintext
  encrypted_content_hash TEXT,   -- SHA-256 of encrypted data
  encryption_key_id     UUID,    -- reference to vault_keys
  key_derivation_meta   JSONB,   -- KDF parameters used
  envelope_meta         JSONB,   -- envelope encryption metadata
  -- Signature (ML-DSA-65)
  signature             TEXT,    -- ML-DSA-65 signature (hex)
  signing_key_id        UUID,    -- reference to vault_keys
  ml_dsa_public_key_ref TEXT,    -- public key reference for verification
  signature_status      public.signature_verification_status DEFAULT 'unverified',
  -- Key rotation
  key_rotation_status   TEXT DEFAULT 'current',
  last_rotated_at       TIMESTAMPTZ,
  -- Soft delete / trash
  is_deleted            BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at            TIMESTAMPTZ,
  permanent_delete_after TIMESTAMPTZ,
  -- Versioning
  version               INT NOT NULL DEFAULT 1,
  is_latest             BOOLEAN NOT NULL DEFAULT TRUE,
  parent_version_id     UUID REFERENCES public.vault_files(id),
  -- Status
  processing_status     public.file_processing_status DEFAULT 'queued',
  error_message         TEXT,
  retry_count           INT NOT NULL DEFAULT 0,
  -- Timestamps
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_files_user ON public.vault_files(user_id, is_deleted);
CREATE INDEX idx_vault_files_folder ON public.vault_files(folder_id);
CREATE INDEX idx_vault_files_status ON public.vault_files(encryption_status);
CREATE INDEX idx_vault_files_processing ON public.vault_files(processing_status);
CREATE INDEX idx_vault_files_latest ON public.vault_files(user_id, is_latest, is_deleted);

CREATE TRIGGER trg_vault_files_updated
  BEFORE UPDATE ON public.vault_files
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vault_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own files"
  ON public.vault_files FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- 6. FILE METADATA (extensible JSONB metadata per file)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_file_metadata (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id     UUID NOT NULL REFERENCES public.vault_files(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(file_id, key)
);

ALTER TABLE public.vault_file_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own file metadata"
  ON public.vault_file_metadata FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- 7. FILE UPLOAD SESSIONS (resumable uploads & progress tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_upload_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id         UUID REFERENCES public.vault_files(id) ON DELETE SET NULL,
  folder_id       UUID REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  filename        TEXT NOT NULL,
  mime_type       TEXT,
  total_size      BIGINT NOT NULL DEFAULT 0,
  uploaded_bytes  BIGINT NOT NULL DEFAULT 0,
  chunk_count     INT NOT NULL DEFAULT 0,
  status          public.file_processing_status NOT NULL DEFAULT 'uploading',
  progress_pct    INT NOT NULL DEFAULT 0,
  encryption_progress_pct INT NOT NULL DEFAULT 0,
  stage           TEXT DEFAULT 'uploading',
  error_message   TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_upload_sessions_user ON public.vault_upload_sessions(user_id, status);

CREATE TRIGGER trg_upload_sessions_updated
  BEFORE UPDATE ON public.vault_upload_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vault_upload_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own upload sessions"
  ON public.vault_upload_sessions FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- 8. KEY VAULT — User Vault Keys & Key Rotation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_type        public.vault_key_type NOT NULL,
  algorithm       TEXT NOT NULL,
  fingerprint     TEXT NOT NULL,
  public_key_hex  TEXT,    -- public key (hex), safe to store
  -- Wrapped (encrypted) private key — NEVER plaintext
  wrapped_secret_key TEXT,
  wrapping_nonce     TEXT,
  wrapping_algorithm TEXT DEFAULT 'AES-256-GCM',
  -- Status
  status          public.vault_key_status NOT NULL DEFAULT 'active',
  version         INT NOT NULL DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Device binding
  device_id       TEXT,
  -- Rotation
  rotated_from_id UUID REFERENCES public.vault_keys(id),
  rotated_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  revocation_reason TEXT,
  -- Expiration
  expires_at      TIMESTAMPTZ,
  last_used_at    TIMESTAMPTZ,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_keys_user ON public.vault_keys(user_id, key_type, is_active);
CREATE INDEX idx_vault_keys_fingerprint ON public.vault_keys(fingerprint);
CREATE INDEX idx_vault_keys_status ON public.vault_keys(user_id, status);

CREATE TRIGGER trg_vault_keys_updated
  BEFORE UPDATE ON public.vault_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vault_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own keys"
  ON public.vault_keys FOR ALL
  USING (user_id = auth.uid());

-- User-level wrapped master keys (ZK passphrase-protected blob)
CREATE TABLE IF NOT EXISTS public.vault_user_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  wrapped_bundle  TEXT NOT NULL,   -- base64 of AES-GCM encrypted JSON with salt/iv
  enc_public_key  TEXT,            -- ML-KEM-768 public key (hex)
  sign_public_key TEXT,            -- ML-DSA-65 public key (hex)
  key_version     INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_vault_user_keys_updated
  BEFORE UPDATE ON public.vault_user_keys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vault_user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own user keys"
  ON public.vault_user_keys FOR ALL
  USING (user_id = auth.uid());

-- Key rotation history
CREATE TABLE IF NOT EXISTS public.vault_key_rotations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_key_id      UUID REFERENCES public.vault_keys(id),
  new_key_id      UUID REFERENCES public.vault_keys(id),
  key_type        public.vault_key_type NOT NULL,
  reason          TEXT,
  progress_pct    INT DEFAULT 0,
  status          TEXT DEFAULT 'pending',
  files_re_encrypted INT DEFAULT 0,
  total_files     INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

ALTER TABLE public.vault_key_rotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own rotations"
  ON public.vault_key_rotations FOR ALL
  USING (user_id = auth.uid());

-- Recovery key metadata
CREATE TABLE IF NOT EXISTS public.vault_recovery_keys (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recovery_type   TEXT NOT NULL DEFAULT 'mnemonic',
  verification_hash TEXT NOT NULL,
  is_used         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ
);

ALTER TABLE public.vault_recovery_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recovery keys"
  ON public.vault_recovery_keys FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- 9. SECURE SHARING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_shared_links (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id               UUID REFERENCES public.vault_files(id) ON DELETE SET NULL,
  folder_id             UUID REFERENCES public.vault_folders(id) ON DELETE SET NULL,
  token                 TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  -- Share options
  permissions           public.share_permission[] DEFAULT ARRAY['view','download']::public.share_permission[],
  is_password_protected BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash         TEXT,
  max_downloads         INT,
  download_count        INT NOT NULL DEFAULT 0,
  -- One-time link
  is_one_time           BOOLEAN NOT NULL DEFAULT FALSE,
  -- Encrypted data for ZK sharing
  encrypted_file_data   BYTEA,
  original_filename     TEXT,
  original_size         BIGINT,
  mime_type             TEXT,
  encryption_metadata   JSONB,
  -- Status
  is_revoked            BOOLEAN NOT NULL DEFAULT FALSE,
  is_destroyed          BOOLEAN NOT NULL DEFAULT FALSE,
  failed_password_attempts INT NOT NULL DEFAULT 0,
  -- Timestamps
  expires_at            TIMESTAMPTZ,
  last_accessed_at      TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shared_links_user ON public.vault_shared_links(user_id);
CREATE INDEX idx_shared_links_token ON public.vault_shared_links(token);
CREATE INDEX idx_shared_links_file ON public.vault_shared_links(file_id);

ALTER TABLE public.vault_shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own shared links"
  ON public.vault_shared_links FOR ALL
  USING (user_id = auth.uid());

-- Access grants for sharing with specific users
CREATE TABLE IF NOT EXISTS public.vault_access_grants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_email   TEXT,
  file_id         UUID REFERENCES public.vault_files(id) ON DELETE CASCADE,
  folder_id       UUID REFERENCES public.vault_folders(id) ON DELETE CASCADE,
  permissions     public.share_permission[] DEFAULT ARRAY['view']::public.share_permission[],
  is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ
);

ALTER TABLE public.vault_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their grants"
  ON public.vault_access_grants FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Grantees view their grants"
  ON public.vault_access_grants FOR SELECT
  USING (grantee_id = auth.uid());

-- ============================================================================
-- 10. AUDIT LOGGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'info',
  result          TEXT DEFAULT 'success',
  resource_type   TEXT,
  resource_id     TEXT,
  description     TEXT,
  ip_address      TEXT,
  user_agent      TEXT,
  device_id       TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON public.vault_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_type ON public.vault_audit_logs(event_type);
CREATE INDEX idx_audit_logs_resource ON public.vault_audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_severity ON public.vault_audit_logs(severity);

ALTER TABLE public.vault_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own audit logs"
  ON public.vault_audit_logs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own audit logs"
  ON public.vault_audit_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 11. REALTIME TELEMETRY — processing status for live UI updates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vault_processing_status (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation       TEXT NOT NULL,  -- 'upload','encrypt','decrypt','verify','rotate'
  resource_id     TEXT,
  resource_name   TEXT,
  stage           TEXT NOT NULL DEFAULT 'pending',
  progress_pct    INT NOT NULL DEFAULT 0,
  message         TEXT,
  error_message   TEXT,
  retry_count     INT NOT NULL DEFAULT 0,
  is_complete     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_processing_user ON public.vault_processing_status(user_id, is_complete);

CREATE TRIGGER trg_processing_status_updated
  BEFORE UPDATE ON public.vault_processing_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.vault_processing_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own processing status"
  ON public.vault_processing_status FOR ALL
  USING (user_id = auth.uid());

-- ============================================================================
-- 12. STORAGE BUCKET SETUP
-- ============================================================================
-- NOTE: Bucket creation is done via Supabase Dashboard or API.
-- Storage paths: vault/{user_id}/{file_id}/{encrypted_filename}
-- Below are RLS policies for storage.objects.

-- Create the vault bucket (if using SQL — may need dashboard instead)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vault-encrypted',
  'vault-encrypted',
  FALSE,
  52428800,  -- 50 MB per file
  NULL       -- allow all MIME types (files are encrypted blobs)
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users upload own vault objects"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vault-encrypted'
    AND (storage.foldername(name))[1] = 'vault'
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );

CREATE POLICY "Users read own vault objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vault-encrypted'
    AND (storage.foldername(name))[1] = 'vault'
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );

CREATE POLICY "Users delete own vault objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vault-encrypted'
    AND (storage.foldername(name))[1] = 'vault'
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );

-- ============================================================================
-- 13. AUTO-CREATE VAULT PROFILE ON FIRST ACCESS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ensure_vault_profile()
RETURNS UUID AS $$
DECLARE
  profile_id UUID;
BEGIN
  SELECT id INTO profile_id
  FROM public.vault_user_profiles
  WHERE user_id = auth.uid();

  IF profile_id IS NULL THEN
    INSERT INTO public.vault_user_profiles (user_id)
    VALUES (auth.uid())
    RETURNING id INTO profile_id;
  END IF;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 14. HELPER: Count folder items
-- ============================================================================

CREATE OR REPLACE FUNCTION public.vault_folder_item_count(folder_uuid UUID)
RETURNS INT AS $$
  SELECT (
    (SELECT COUNT(*)::INT FROM public.vault_folders
     WHERE parent_id = folder_uuid AND user_id = auth.uid() AND NOT is_deleted)
    +
    (SELECT COUNT(*)::INT FROM public.vault_files
     WHERE folder_id = folder_uuid AND user_id = auth.uid() AND NOT is_deleted)
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 15. REALTIME PUBLICATION
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_keys;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_shared_links;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_audit_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_processing_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_upload_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vault_user_profiles;

-- ============================================================================
-- DONE — Schema ready for production deployment
-- ============================================================================
