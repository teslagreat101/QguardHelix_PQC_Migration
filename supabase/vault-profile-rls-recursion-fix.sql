-- QGuard Vault profile RLS repair.
--
-- Apply this once in Supabase SQL Editor if uploads fail with:
-- "infinite recursion detected in policy for relation vault_user_profiles".
--
-- The repair removes recursive policies on the profile table, reinstalls simple
-- user-owned RLS rules, and provides SECURITY DEFINER RPC helpers used by the
-- browser vault service. The helpers only operate on auth.uid(), preserving
-- user isolation while avoiding policy self-reference.

BEGIN;

ALTER TABLE public.vault_user_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vault_user_profiles'
      AND column_name = 'kdf_algorithm'
  ) THEN
    ALTER TABLE public.vault_user_profiles
      ALTER COLUMN kdf_algorithm SET DEFAULT 'PBKDF2-SHA3-256+HKDF-SHA3-256';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vault_user_keys'
      AND column_name = 'kdf_algorithm'
  ) THEN
    ALTER TABLE public.vault_user_keys
      ALTER COLUMN kdf_algorithm SET DEFAULT 'PBKDF2-SHA3-256+HKDF-SHA3-256';
  END IF;
END $$;

DO $$
DECLARE
  policy_name text;
BEGIN
  FOR policy_name IN
    SELECT polname
    FROM pg_policy
    WHERE polrelid = 'public.vault_user_profiles'::regclass
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.vault_user_profiles', policy_name);
  END LOOP;
END $$;

CREATE POLICY vault_user_profiles_select_own
  ON public.vault_user_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY vault_user_profiles_insert_own
  ON public.vault_user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY vault_user_profiles_update_own
  ON public.vault_user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.ensure_vault_profile()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid;
  profile_id uuid;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT id
  INTO profile_id
  FROM public.vault_user_profiles
  WHERE user_id = current_user_id;

  IF profile_id IS NULL THEN
    INSERT INTO public.vault_user_profiles (user_id, vault_created, vault_locked)
    VALUES (current_user_id, true, true)
    RETURNING id INTO profile_id;
  END IF;

  RETURN profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_vault_profile()
RETURNS public.vault_user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid;
  profile public.vault_user_profiles;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO profile
  FROM public.vault_user_profiles
  WHERE user_id = current_user_id;

  IF profile.id IS NULL THEN
    INSERT INTO public.vault_user_profiles (user_id, vault_created, vault_locked)
    VALUES (current_user_id, true, true)
    RETURNING * INTO profile;
  END IF;

  RETURN profile;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_vault_profile() FROM public;
REVOKE ALL ON FUNCTION public.get_or_create_vault_profile() FROM public;
GRANT EXECUTE ON FUNCTION public.ensure_vault_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_vault_profile() TO authenticated;

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
    COUNT(*) FILTER (WHERE vf.encryption_status = 'encrypted')::int
  INTO v_total_size, v_file_count, v_encrypted_count
  FROM public.vault_files AS vf
  WHERE vf.user_id = v_user_id
    AND NOT vf.is_deleted;

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

COMMIT;
