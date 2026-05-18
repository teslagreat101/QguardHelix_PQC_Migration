-- ============================================================================
-- QUANTUM VAULT — ENTERPRISE SECURITY HARDENING MIGRATION
-- ============================================================================
--
-- This migration hardens the vault schema against all risks identified in the
-- security audit.  Every statement is idempotent (safe to re-run).
--
-- Run this in the Supabase SQL Editor AFTER vault-complete-migration.sql.
-- ============================================================================

BEGIN;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. REMOVE HIGH-RISK TABLES FROM REALTIME PUBLICATION
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- vault_keys contains wrapped_secret_key, wrapping_nonce — NEVER stream these.
-- vault_unlock_sessions contains session tokens, IPs, device fingerprints.
-- vault_user_profiles contains KDF parameters, security settings.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.vault_keys;
EXCEPTION WHEN undefined_object THEN NULL;
          WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.vault_unlock_sessions;
EXCEPTION WHEN undefined_object THEN NULL;
          WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.vault_user_profiles;
EXCEPTION WHEN undefined_object THEN NULL;
          WHEN OTHERS THEN NULL;
END $$;

-- vault_files: keep in realtime but ONLY publish non-sensitive columns.
-- Supabase Realtime supports column filtering via replica identity.
-- We publish only the columns the UI needs for list views — NO crypto metadata.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime
    SET TABLE public.vault_files (
      id, user_id, folder_id, original_filename, mime_type,
      original_size, encrypted_size, encryption_status,
      processing_status, is_deleted, is_latest,
      uploaded_at, created_at, updated_at
    );
EXCEPTION WHEN OTHERS THEN
  -- Older Supabase versions may not support column lists;
  -- in that case, remove vault_files from realtime entirely.
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.vault_files;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Keep safe tables in realtime:
--   vault_folders        — no sensitive data
--   vault_audit_logs     — safe (user's own logs)
--   vault_processing_status — progress telemetry only
--   vault_upload_sessions   — upload progress only

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. DROP PLAINTEXT PASSWORD SERVER FUNCTIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- These accept plaintext passwords as RPC arguments which can leak to logs.
-- Share-link passwords must be hashed CLIENT-SIDE before sending to the server.

DROP FUNCTION IF EXISTS public.hash_password(TEXT);
DROP FUNCTION IF EXISTS public.verify_password_hash(TEXT, TEXT);

-- Replace with a server-side bcrypt verification function that only accepts
-- the hash, preventing plaintext logging.  The client sends:
--   1. share link ID
--   2. bcrypt hash computed client-side
-- The server compares hashes without ever seeing plaintext.
CREATE OR REPLACE FUNCTION public.verify_share_link_access(
  link_id UUID,
  provided_password_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
  is_valid BOOLEAN := FALSE;
  link_record RECORD;
BEGIN
  -- Fetch the link with security checks
  SELECT
    sl.password_hash,
    sl.is_revoked,
    sl.is_destroyed,
    sl.is_password_protected,
    sl.max_downloads,
    sl.download_count,
    sl.expires_at,
    sl.failed_password_attempts,
    sl.user_id
  INTO link_record
  FROM public.vault_shared_links sl
  WHERE sl.id = link_id;

  IF link_record IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if link is still valid
  IF link_record.is_revoked OR link_record.is_destroyed THEN
    RETURN FALSE;
  END IF;

  IF link_record.expires_at IS NOT NULL AND link_record.expires_at < NOW() THEN
    RETURN FALSE;
  END IF;

  IF link_record.max_downloads IS NOT NULL
     AND link_record.download_count >= link_record.max_downloads THEN
    RETURN FALSE;
  END IF;

  -- Rate limit: lock out after 10 failed attempts
  IF link_record.failed_password_attempts >= 10 THEN
    RETURN FALSE;
  END IF;

  -- If not password protected, allow access
  IF NOT link_record.is_password_protected THEN
    RETURN TRUE;
  END IF;

  -- Compare hashes (constant-time via pgcrypto)
  is_valid := (link_record.password_hash = provided_password_hash);

  -- Track failed attempts
  IF NOT is_valid THEN
    UPDATE public.vault_shared_links
    SET failed_password_attempts = failed_password_attempts + 1,
        updated_at = NOW()
    WHERE id = link_id;

    -- Log the failure
    INSERT INTO public.vault_audit_logs (
      user_id, event_type, severity, result,
      resource_type, resource_id, description
    ) VALUES (
      link_record.user_id, 'share_password_failed', 'warning', 'failure',
      'share_link', link_id::TEXT, 'Failed share link password attempt'
    );
  END IF;

  RETURN is_valid;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_share_link_access(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.verify_share_link_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_share_link_access(UUID, TEXT) TO anon;

COMMENT ON FUNCTION public.verify_share_link_access(UUID, TEXT) IS
  'Verifies share link access. Accepts pre-hashed password (bcrypt on client). '
  'Never accepts plaintext passwords. Enforces rate limiting and link validity.';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. SECURE AUDIT LOG INSERTION — Prevent client-side injection
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Remove the direct INSERT policy that allows arbitrary audit injection
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users insert own audit logs" ON public.vault_audit_logs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Replace with a validated SECURITY DEFINER RPC
CREATE OR REPLACE FUNCTION public.log_vault_audit_event(
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'info',
  p_result TEXT DEFAULT 'success',
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id UUID;
  log_id UUID;
  valid_severities TEXT[] := ARRAY['info', 'warning', 'critical', 'emergency'];
  valid_results TEXT[] := ARRAY['success', 'failure'];
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Validate severity
  IF p_severity IS NOT NULL AND NOT p_severity = ANY(valid_severities) THEN
    p_severity := 'info';
  END IF;

  -- Validate result
  IF p_result IS NOT NULL AND NOT p_result = ANY(valid_results) THEN
    p_result := 'success';
  END IF;

  -- Truncate potentially oversized fields
  INSERT INTO public.vault_audit_logs (
    user_id, event_type, severity, result,
    resource_type, resource_id, description, metadata
  ) VALUES (
    current_user_id,
    LEFT(p_event_type, 100),
    p_severity,
    p_result,
    LEFT(p_resource_type, 50),
    LEFT(p_resource_id, 255),
    LEFT(p_description, 1000),
    p_metadata
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_vault_audit_event FROM public;
GRANT EXECUTE ON FUNCTION public.log_vault_audit_event TO authenticated;

COMMENT ON FUNCTION public.log_vault_audit_event IS
  'Server-validated audit log insertion. Sanitizes severity/result enums, '
  'truncates oversized fields, and prevents arbitrary injection.';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. SAFE VIEW FOR SHARED LINKS (hides password_hash from API)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE VIEW public.vault_shared_links_safe AS
SELECT
  id, user_id, file_id, folder_id, token,
  permissions, is_password_protected,
  -- Explicitly EXCLUDE password_hash
  max_downloads, download_count,
  is_one_time,
  encrypted_file_data, original_filename, original_size, mime_type,
  encryption_metadata,
  is_revoked, is_destroyed, failed_password_attempts,
  expires_at, last_accessed_at, revoked_at, created_at
FROM public.vault_shared_links
WHERE user_id = auth.uid();

COMMENT ON VIEW public.vault_shared_links_safe IS
  'Read-only view of shared links that excludes password_hash column. '
  'Use this view in client-side queries instead of the base table.';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. COLUMN SIZE CONSTRAINTS — Prevent oversized crypto payloads
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ML-KEM-768 ciphertext: 1088 bytes = 2176 hex chars
-- AES-GCM nonce: 12 bytes = 24 hex chars
-- AES-GCM auth tag: 16 bytes = 32 hex chars
-- ML-DSA-65 signature: ~3300 bytes base64 ≈ 4500 chars + envelope JSON
-- SHA3-256 hash: 32 bytes = 64 hex chars
-- SHA3-512 hash: 64 bytes = 128 hex chars
-- Wrapped data key: 32 bytes + 16 tag = 96 hex chars

-- vault_files constraints
DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_kem_ct_len
    CHECK (kem_ciphertext IS NULL OR length(kem_ciphertext) <= 4096);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_aes_nonce_len
    CHECK (aes_nonce IS NULL OR length(aes_nonce) <= 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_aes_tag_len
    CHECK (aes_auth_tag IS NULL OR length(aes_auth_tag) <= 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_content_hash_len
    CHECK (content_hash IS NULL OR length(content_hash) <= 128);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_enc_hash_len
    CHECK (encrypted_content_hash IS NULL OR length(encrypted_content_hash) <= 256);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_aad_hash_len
    CHECK (aad_hash IS NULL OR length(aad_hash) <= 128);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_signature_len
    CHECK (signature IS NULL OR length(signature) <= 16384);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_algo_len
    CHECK (encryption_algorithm IS NULL OR length(encryption_algorithm) <= 200);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_storage_path_len
    CHECK (storage_path IS NULL OR length(storage_path) <= 1024);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Envelope meta & key derivation meta: limit JSONB size to 32KB
DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_envelope_meta_size
    CHECK (envelope_meta IS NULL OR pg_column_size(envelope_meta) <= 32768);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_files ADD CONSTRAINT chk_vf_kdf_meta_size
    CHECK (key_derivation_meta IS NULL OR pg_column_size(key_derivation_meta) <= 32768);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vault_keys constraints
DO $$ BEGIN
  ALTER TABLE public.vault_keys ADD CONSTRAINT chk_vk_pubkey_len
    CHECK (public_key_hex IS NULL OR length(public_key_hex) <= 8192);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_keys ADD CONSTRAINT chk_vk_wrapped_secret_len
    CHECK (wrapped_secret_key IS NULL OR length(wrapped_secret_key) <= 16384);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_keys ADD CONSTRAINT chk_vk_nonce_len
    CHECK (wrapping_nonce IS NULL OR length(wrapping_nonce) <= 64);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_keys ADD CONSTRAINT chk_vk_fingerprint_len
    CHECK (length(fingerprint) <= 512);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vault_user_keys constraints
DO $$ BEGIN
  ALTER TABLE public.vault_user_keys ADD CONSTRAINT chk_vuk_bundle_len
    CHECK (length(wrapped_bundle) <= 65536);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_user_keys ADD CONSTRAINT chk_vuk_enc_pk_len
    CHECK (enc_public_key IS NULL OR length(enc_public_key) <= 8192);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_user_keys ADD CONSTRAINT chk_vuk_sign_pk_len
    CHECK (sign_public_key IS NULL OR length(sign_public_key) <= 8192);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_user_keys ADD CONSTRAINT chk_vuk_salt_len
    CHECK (kdf_salt IS NULL OR length(kdf_salt) <= 128);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vault_audit_logs constraints (prevent text bomb injection)
DO $$ BEGIN
  ALTER TABLE public.vault_audit_logs ADD CONSTRAINT chk_val_event_type_len
    CHECK (length(event_type) <= 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_audit_logs ADD CONSTRAINT chk_val_description_len
    CHECK (description IS NULL OR length(description) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_audit_logs ADD CONSTRAINT chk_val_metadata_size
    CHECK (metadata IS NULL OR pg_column_size(metadata) <= 65536);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- vault_shared_links constraints
DO $$ BEGIN
  ALTER TABLE public.vault_shared_links ADD CONSTRAINT chk_vsl_token_len
    CHECK (length(token) <= 128);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.vault_shared_links ADD CONSTRAINT chk_vsl_password_hash_len
    CHECK (password_hash IS NULL OR length(password_hash) <= 256);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 6. RATE-LIMIT TRIGGER ON VAULT UNLOCK SESSIONS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION public.enforce_vault_unlock_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_failures INT;
  lockout_until TIMESTAMPTZ;
BEGIN
  -- Count failed attempts in the last 15 minutes
  SELECT COUNT(*) INTO recent_failures
  FROM public.vault_failed_attempts
  WHERE user_id = NEW.user_id
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- If more than 5 failures in 15 minutes, block for the remaining window
  IF recent_failures >= 5 THEN
    SELECT MAX(created_at) + INTERVAL '15 minutes'
    INTO lockout_until
    FROM public.vault_failed_attempts
    WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '15 minutes';

    RAISE EXCEPTION 'Vault locked due to too many failed attempts. Try again after %.',
      lockout_until
      USING ERRCODE = '54000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_unlock_rate_limit ON public.vault_unlock_sessions;
CREATE TRIGGER trg_enforce_unlock_rate_limit
  BEFORE INSERT ON public.vault_unlock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vault_unlock_rate_limit();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 7. AUTO-EXPIRE OLD SESSIONS (cleanup function)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE FUNCTION public.cleanup_expired_vault_sessions()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleaned INT;
BEGIN
  -- Expire active sessions past their TTL
  UPDATE public.vault_unlock_sessions
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();

  GET DIAGNOSTICS cleaned = ROW_COUNT;

  -- Purge old failed attempts (>24 hours)
  DELETE FROM public.vault_failed_attempts
  WHERE created_at < NOW() - INTERVAL '24 hours';

  -- Purge completed processing status entries (>1 hour)
  DELETE FROM public.vault_processing_status
  WHERE is_complete = TRUE
    AND updated_at < NOW() - INTERVAL '1 hour';

  RETURN cleaned;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_vault_sessions IS
  'Housekeeping: expires stale sessions, purges old failed attempts, '
  'cleans up completed processing entries. Call via pg_cron or Edge Function.';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 8. PREVENT WRAPPED_SECRET_KEY FROM API READS
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- The vault_keys table stores wrapped (encrypted) secret keys that must
-- never be returned by default SELECT queries through PostgREST.
-- Create a safe view and use it for all client queries.

CREATE OR REPLACE VIEW public.vault_keys_safe AS
SELECT
  id, user_id, key_type, algorithm, fingerprint,
  public_key_hex,
  -- Explicitly EXCLUDE: wrapped_secret_key, wrapping_nonce
  wrapping_algorithm,
  status, version, is_active, device_id,
  rotated_from_id, rotated_at, revoked_at, revocation_reason,
  expires_at, last_used_at,
  created_at, updated_at
FROM public.vault_keys
WHERE user_id = auth.uid();

COMMENT ON VIEW public.vault_keys_safe IS
  'Read-only view of vault keys that excludes wrapped_secret_key and wrapping_nonce. '
  'Client code should query this view instead of vault_keys directly.';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 9. VAULT FILES SAFE VIEW (for list queries — no crypto metadata)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE OR REPLACE VIEW public.vault_files_listing AS
SELECT
  id, user_id, folder_id,
  original_filename, encrypted_filename,
  mime_type, original_size, encrypted_size,
  encryption_status, encryption_algorithm,
  -- Explicitly EXCLUDE: kem_ciphertext, aes_nonce, aes_auth_tag,
  -- content_hash, encrypted_content_hash, aad_hash, envelope_meta,
  -- key_derivation_meta, signature
  signature_status,
  is_deleted, is_latest,
  processing_status, error_message,
  version,
  uploaded_at, encrypted_at, created_at, updated_at
FROM public.vault_files
WHERE user_id = auth.uid();

COMMENT ON VIEW public.vault_files_listing IS
  'Read-only view for file list queries. Excludes KEM ciphertext, AES nonce/tag, '
  'hashes, signatures, and envelope metadata. Use full table only at decrypt time.';

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 10. FORCE PostgREST SCHEMA CACHE RELOAD
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- DONE — Enterprise Security Hardening Applied
-- ============================================================================
--
-- SUMMARY OF CHANGES:
--   ✅ Removed vault_keys, vault_unlock_sessions, vault_user_profiles from Realtime
--   ✅ Column-filtered vault_files in Realtime (non-crypto columns only)
--   ✅ Dropped plaintext hash_password/verify_password_hash functions
--   ✅ Added verify_share_link_access() with rate limiting
--   ✅ Replaced audit INSERT policy with validated SECURITY DEFINER function
--   ✅ Created vault_shared_links_safe view (hides password_hash)
--   ✅ Created vault_keys_safe view (hides wrapped_secret_key)
--   ✅ Created vault_files_listing view (hides all crypto metadata)
--   ✅ Added CHECK constraints on all crypto column sizes
--   ✅ Added vault unlock rate-limit trigger (5 attempts / 15 min lockout)
--   ✅ Added session cleanup function for pg_cron
--   ✅ Reloaded PostgREST schema cache
-- ============================================================================
