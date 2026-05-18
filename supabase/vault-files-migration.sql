-- ============================================================
-- vault-files-migration.sql
-- Adds missing columns to the existing vault_files table so that
-- vault-service-enhanced.ts can insert records without errors.
--
-- Run this in your Supabase SQL Editor to fix:
--   "Could not find the 'signed_at' column of 'vault_files' in the schema cache"
-- ============================================================

-- Original File Info
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS folder_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encrypted_filename TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'application/octet-stream';

-- Size Information
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS original_size BIGINT DEFAULT 0;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encrypted_size BIGINT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS compression_ratio NUMERIC(5,2);

-- Storage
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'vault-encrypted';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT;

-- Post-Quantum Encryption Metadata
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encryption_status VARCHAR(100) DEFAULT 'pending';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encryption_algorithm TEXT DEFAULT 'ML-KEM-768+AES-256-GCM';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS algorithm_version TEXT DEFAULT 'v2.0';

-- ML-KEM-768 Encapsulated Key
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS kem_ciphertext TEXT;

-- AES-256-GCM Parameters
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS aes_nonce TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS aes_auth_tag TEXT;

-- Envelope Encryption Metadata
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS key_derivation_meta JSONB;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS envelope_meta JSONB;

-- Integrity Verification
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encrypted_content_hash TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS aad_hash TEXT;

-- Key References
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encryption_key_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS key_rotation_status TEXT DEFAULT 'current';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS last_rotated_at TIMESTAMPTZ;

-- ML-DSA-65 Signature Metadata
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS signing_key_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS ml_dsa_public_key_ref TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS signature_status VARCHAR(50) DEFAULT 'unverified';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- Versioning
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS parent_version_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS version_notes TEXT;

-- Processing & Status
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT 'queued';
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS upload_session_id UUID;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 3;

-- Soft Delete / Trash
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS permanent_delete_after TIMESTAMPTZ;

-- Timestamps
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS encrypted_at TIMESTAMPTZ;
ALTER TABLE public.vault_files ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Make original_filename nullable temporarily so existing rows don't break
-- Then backfill from the old file_name column
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vf_folder ON public.vault_files(folder_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_vf_status ON public.vault_files(encryption_status);
CREATE INDEX IF NOT EXISTS idx_vf_processing ON public.vault_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_vf_latest ON public.vault_files(user_id, is_latest, is_deleted);
CREATE INDEX IF NOT EXISTS idx_vf_uploaded ON public.vault_files(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vf_hash ON public.vault_files(content_hash);

-- Reload PostgREST schema cache so the API immediately sees the new columns
NOTIFY pgrst, 'reload schema';

-- Done! The vault_files table now has all columns required by vault-service-enhanced.ts
