-- QGuard Helix Profile & Security Settings Schema
-- Run in Supabase SQL Editor after the base dashboard schema.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.qguard_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Core user profile
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  full_name TEXT,
  username TEXT,
  role TEXT,
  company TEXT,
  phone TEXT,
  location TEXT,
  department TEXT,
  job_title TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  tier TEXT NOT NULL DEFAULT 'free',
  q_score INTEGER NOT NULL DEFAULT 0,
  badges JSONB NOT NULL DEFAULT '[]'::JSONB,
  keys_generated_today INTEGER NOT NULL DEFAULT 0,
  max_keys_per_day INTEGER NOT NULL DEFAULT 10,
  vault_storage_used BIGINT NOT NULL DEFAULT 0,
  max_vault_storage BIGINT NOT NULL DEFAULT 104857600,
  paypal_payer_id TEXT,
  paypal_subscription_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS q_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS keys_generated_today INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_keys_per_day INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vault_storage_used BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_vault_storage BIGINT NOT NULL DEFAULT 104857600;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paypal_payer_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL AND username <> '';
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.qguard_set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'gold' CHECK (theme IN ('dark', 'gold', 'light', 'cyber')),
  language TEXT NOT NULL DEFAULT 'en',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  dashboard_density TEXT NOT NULL DEFAULT 'comfortable' CHECK (dashboard_density IN ('compact', 'comfortable', 'expanded')),
  default_dashboard_view TEXT NOT NULL DEFAULT 'overview',
  notification_email BOOLEAN NOT NULL DEFAULT TRUE,
  notification_push BOOLEAN NOT NULL DEFAULT FALSE,
  notification_sms BOOLEAN NOT NULL DEFAULT FALSE,
  security_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  product_updates BOOLEAN NOT NULL DEFAULT FALSE,
  telemetry_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.qguard_set_updated_at();

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_preferences_own ON public.user_preferences;
CREATE POLICY user_preferences_own ON public.user_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Security settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_security_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enforced BOOLEAN NOT NULL DEFAULT FALSE,
  suspicious_login_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  security_email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  trusted_device_expiry_days INTEGER NOT NULL DEFAULT 30 CHECK (trusted_device_expiry_days BETWEEN 1 AND 365),
  password_changed_at TIMESTAMPTZ,
  recovery_codes_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_security_settings_updated_at ON public.user_security_settings;
CREATE TRIGGER trg_user_security_settings_updated_at
  BEFORE UPDATE ON public.user_security_settings
  FOR EACH ROW EXECUTE FUNCTION public.qguard_set_updated_at();

ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_security_settings_own ON public.user_security_settings;
CREATE POLICY user_security_settings_own ON public.user_security_settings
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Devices and sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT,
  device_type TEXT,
  fingerprint TEXT,
  trusted BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  last_active TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS trusted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS ip_address INET;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_user_fingerprint ON public.user_devices(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_active ON public.user_devices(user_id, last_active DESC);

DROP TRIGGER IF EXISTS trg_user_devices_updated_at ON public.user_devices;
CREATE TRIGGER trg_user_devices_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.qguard_set_updated_at();

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_devices_own ON public.user_devices;
CREATE POLICY user_devices_own ON public.user_devices
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.user_devices(id) ON DELETE SET NULL,
  device_name TEXT,
  session_token_hash TEXT NOT NULL UNIQUE,
  trusted BOOLEAN NOT NULL DEFAULT FALSE,
  ip_address INET,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_seen ON public.user_sessions(user_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked ON public.user_sessions(revoked_at);

DROP TRIGGER IF EXISTS trg_user_sessions_updated_at ON public.user_sessions;
CREATE TRIGGER trg_user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.qguard_set_updated_at();

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_sessions_own ON public.user_sessions;
CREATE POLICY user_sessions_own ON public.user_sessions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Account security events and recovery codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'success', 'warning', 'critical')),
  message TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_security_events_user_created
  ON public.user_security_events(user_id, created_at DESC);

ALTER TABLE public.user_security_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_security_events_select_own ON public.user_security_events;
DROP POLICY IF EXISTS user_security_events_insert_own ON public.user_security_events;
CREATE POLICY user_security_events_select_own ON public.user_security_events
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY user_security_events_insert_own ON public.user_security_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.user_mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_suffix TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_recovery_codes_user_unused
  ON public.user_mfa_recovery_codes(user_id, used_at);

ALTER TABLE public.user_mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_mfa_recovery_codes_own ON public.user_mfa_recovery_codes;
CREATE POLICY user_mfa_recovery_codes_own ON public.user_mfa_recovery_codes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Optional compatibility table used by existing dashboard activity aggregation.
CREATE TABLE IF NOT EXISTS public.auth_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_events_user_created ON public.auth_events(user_id, created_at DESC);
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_events_own ON public.auth_events;
CREATE POLICY auth_events_own ON public.auth_events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage buckets for profile media
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('profile-banners', 'profile-banners', TRUE, 4194304, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_media_public_read ON storage.objects;
DROP POLICY IF EXISTS profile_media_insert_own ON storage.objects;
DROP POLICY IF EXISTS profile_media_update_own ON storage.objects;
DROP POLICY IF EXISTS profile_media_delete_own ON storage.objects;

CREATE POLICY profile_media_public_read ON storage.objects
  FOR SELECT USING (bucket_id IN ('avatars', 'profile-banners'));

CREATE POLICY profile_media_insert_own ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('avatars', 'profile-banners')
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY profile_media_update_own ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('avatars', 'profile-banners')
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  ) WITH CHECK (
    bucket_id IN ('avatars', 'profile-banners')
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY profile_media_delete_own ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('avatars', 'profile-banners')
    AND auth.uid()::TEXT = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Auth user bootstrap
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qguard_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_security_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_security_events (user_id, event_type, severity, message)
  VALUES (NEW.id, 'account.created', 'success', 'Account profile initialized')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created_qguard_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_qguard_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.qguard_handle_new_user();

-- ---------------------------------------------------------------------------
-- Snapshot RPC for admin/support diagnostics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_security_snapshot(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_row JSONB;
  preference_row JSONB;
  security_row JSONB;
  active_sessions INTEGER;
  trusted_devices INTEGER;
  recent_events JSONB;
BEGIN
  SELECT to_jsonb(p) INTO profile_row FROM public.profiles p WHERE p.id = p_user_id;
  SELECT to_jsonb(up) INTO preference_row FROM public.user_preferences up WHERE up.user_id = p_user_id;
  SELECT to_jsonb(uss) INTO security_row FROM public.user_security_settings uss WHERE uss.user_id = p_user_id;
  SELECT COUNT(*) INTO active_sessions FROM public.user_sessions WHERE user_id = p_user_id AND revoked_at IS NULL;
  SELECT COUNT(*) INTO trusted_devices FROM public.user_devices WHERE user_id = p_user_id AND trusted = TRUE AND revoked_at IS NULL;

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::JSONB)
  INTO recent_events
  FROM (
    SELECT * FROM public.user_security_events
    WHERE user_id = p_user_id
    ORDER BY created_at DESC
    LIMIT 20
  ) e;

  RETURN jsonb_build_object(
    'profile', profile_row,
    'preferences', preference_row,
    'security', security_row,
    'activeSessions', COALESCE(active_sessions, 0),
    'trustedDevices', COALESCE(trusted_devices, 0),
    'recentEvents', recent_events
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'profiles',
    'user_preferences',
    'user_security_settings',
    'user_devices',
    'user_sessions',
    'user_security_events',
    'user_mfa_recovery_codes',
    'auth_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE FORMAT('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
END;
$$;
