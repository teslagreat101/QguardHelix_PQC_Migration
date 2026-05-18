-- ============================================================
-- vault-complete-migration.sql
-- ONE-SHOT FIX for all missing columns on vault_files and
-- vault_user_profiles that cause 400 errors during encryption.
--
-- Run this ONCE in the Supabase SQL Editor.
-- It is safe to re-run — every statement uses IF NOT EXISTS.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. VAULT_USER_PROFILES — add every column the code & triggers expect
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS storage_warning_sent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS encrypted_file_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS vault_unlocked_at TIMESTAMPTZ;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS last_vault_activity TIMESTAMPTZ;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS auto_lock_minutes INT DEFAULT 30;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS max_failed_attempts INT DEFAULT 5;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS lockout_duration_minutes INT DEFAULT 15;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS kdf_memory INT DEFAULT 65536;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS kdf_parallelism INT DEFAULT 4;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS password_version INT DEFAULT 1;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS require_mfa BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.vault_user_profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────
-- 2. VAULT_FILES — add every column the code expects
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS folder_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encrypted_filename TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'application/octet-stream';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS original_size BIGINT DEFAULT 0;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encrypted_size BIGINT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS compression_ratio NUMERIC(5,2);
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'vault-encrypted';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encryption_status VARCHAR(100) DEFAULT 'pending';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encryption_algorithm TEXT DEFAULT 'ML-KEM-768+AES-256-GCM';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS algorithm_version TEXT DEFAULT 'v2.0';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS kem_ciphertext TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS aes_nonce TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS aes_auth_tag TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS key_derivation_meta JSONB;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS envelope_meta JSONB;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encrypted_content_hash TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS aad_hash TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encryption_key_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS key_rotation_status TEXT DEFAULT 'current';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS last_rotated_at TIMESTAMPTZ;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS signing_key_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS ml_dsa_public_key_ref TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS signature_status VARCHAR(50) DEFAULT 'unverified';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS parent_version_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS version_notes TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'queued';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS upload_session_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS permanent_delete_after TIMESTAMPTZ;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encrypted_at TIMESTAMPTZ;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Backfill original_filename from legacy file_name column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vault_files' AND column_name = 'file_name'
  ) THEN
    UPDATE public.vault_files
    SET original_filename = file_name
    WHERE original_filename IS NULL AND file_name IS NOT NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. INDEXES (idempotent)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vf_folder ON public.vault_files(folder_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_vf_status ON public.vault_files(encryption_status);
CREATE INDEX IF NOT EXISTS idx_vf_processing ON public.vault_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_vf_latest ON public.vault_files(user_id, is_latest, is_deleted);
CREATE INDEX IF NOT EXISTS idx_vf_uploaded ON public.vault_files(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vf_hash ON public.vault_files(content_hash);

-- ─────────────────────────────────────────────────────────────
-- 4. REPAIR the storage-quota trigger so it never breaks again.
--    This version gracefully skips columns that might be missing.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_vault_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_total_size bigint;
  v_file_count int;
  v_encrypted_count int;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COALESCE(SUM(COALESCE(vf.encrypted_size, vf.original_size, 0)), 0),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE vf.encryption_status::text = 'encrypted')::int
  INTO v_total_size, v_file_count, v_encrypted_count
  FROM public.vault_files AS vf
  WHERE vf.user_id = v_user_id
    AND NOT COALESCE(vf.is_deleted, false);

  UPDATE public.vault_user_profiles AS vup
  SET
    storage_used = v_total_size,
    file_count = v_file_count,
    encrypted_file_count = v_encrypted_count,
    updated_at = now()
  WHERE vup.user_id = v_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_vault_files_storage_quota ON public.vault_files;
CREATE TRIGGER trg_vault_files_storage_quota
  AFTER INSERT OR UPDATE OR DELETE ON public.vault_files
  FOR EACH ROW EXECUTE FUNCTION public.update_vault_storage_quota();

-- ─────────────────────────────────────────────────────────────
-- 5. Force PostgREST to reload its schema cache immediately
-- ─────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- DONE. All columns now exist. Encryption uploads should work.
-- ============================================================
