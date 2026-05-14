-- QGuard Helix Generated Records Schema
-- Supports Express-backed keys, OTP, PKI, tokenization, secure comms, cloud seeds, and SSE telemetry.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS generated_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    algorithm VARCHAR(100) NOT NULL,
    bit_length INTEGER NOT NULL DEFAULT 256,
    entropy_source VARCHAR(50) NOT NULL DEFAULT 'QRNG',
    quality_score NUMERIC(6, 5) NOT NULL DEFAULT 0,
    fingerprint TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    rotated_from UUID REFERENCES generated_keys(id) ON DELETE SET NULL,
    label TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE generated_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS generated_keys_user_select ON generated_keys;
CREATE POLICY generated_keys_user_select ON generated_keys
    FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS generated_keys_user_insert ON generated_keys;
CREATE POLICY generated_keys_user_insert ON generated_keys
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS generated_keys_user_update ON generated_keys;
CREATE POLICY generated_keys_user_update ON generated_keys
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS generated_keys_user_delete ON generated_keys;
CREATE POLICY generated_keys_user_delete ON generated_keys
    FOR DELETE
    USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_generated_keys_user_id ON generated_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_keys_algorithm ON generated_keys(algorithm);
CREATE INDEX IF NOT EXISTS idx_generated_keys_status ON generated_keys(status);
CREATE INDEX IF NOT EXISTS idx_generated_keys_created_at ON generated_keys(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_keys_user_algorithm_created ON generated_keys(user_id, algorithm, created_at DESC);

CREATE OR REPLACE FUNCTION set_generated_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generated_keys_updated_at ON generated_keys;
CREATE TRIGGER generated_keys_updated_at
BEFORE UPDATE ON generated_keys
FOR EACH ROW
EXECUTE FUNCTION set_generated_keys_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'generated_keys'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE generated_keys;
  END IF;
END $$;
