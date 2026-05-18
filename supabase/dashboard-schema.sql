-- QGuard Helix Dashboard — Production Schema with RLS
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Compatibility guard for existing projects.
-- CREATE TABLE IF NOT EXISTS does not add missing columns to tables that already
-- exist, so old/partial tables can make the RLS policies below fail with:
-- ERROR 42703: column "user_id" does not exist.
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'assets', 'asset_relationships', 'crypto_inventory', 'crypto_exposures',
        'vulnerabilities', 'certificates', 'migration_jobs', 'migration_events',
        'pqc_scan_sessions', 'pqc_scan_results', 'vault_files', 'vault_audit_logs',
        'qrng_events', 'security_events', 'compliance_evidence', 'audit_logs',
        'user_devices', 'auth_events', 'scanner_agents', 'agent_heartbeats',
        'connector_accounts', 'scanner_evidence', 'scanner_alerts',
        'scanner_agent_policies'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS user_id UUID', tbl);
        END IF;
    END LOOP;

    IF to_regclass('public.assets') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS name VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS type VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS environment VARCHAR(50)';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS region VARCHAR(50)';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS service_owner VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS criticality VARCHAR(20) DEFAULT ''medium''';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT ''active''';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.asset_relationships') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.asset_relationships ADD COLUMN IF NOT EXISTS source_asset_id UUID';
        EXECUTE 'ALTER TABLE public.asset_relationships ADD COLUMN IF NOT EXISTS target_asset_id UUID';
        EXECUTE 'ALTER TABLE public.asset_relationships ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.asset_relationships ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.asset_relationships ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.crypto_inventory') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS asset_id UUID';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS item_type VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS name VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS algorithm VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS key_size INTEGER';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS protocol VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS exposure_level VARCHAR(50)';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS is_vulnerable BOOLEAN DEFAULT TRUE';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS is_quantum_safe BOOLEAN DEFAULT FALSE';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.crypto_inventory ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.crypto_exposures') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.crypto_exposures ADD COLUMN IF NOT EXISTS asset_id UUID';
        EXECUTE 'ALTER TABLE public.crypto_exposures ADD COLUMN IF NOT EXISTS exposure_type VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.crypto_exposures ADD COLUMN IF NOT EXISTS severity VARCHAR(20)';
        EXECUTE 'ALTER TABLE public.crypto_exposures ADD COLUMN IF NOT EXISTS description TEXT';
        EXECUTE 'ALTER TABLE public.crypto_exposures ADD COLUMN IF NOT EXISTS detected_value TEXT';
        EXECUTE 'ALTER TABLE public.crypto_exposures ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.crypto_exposures ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.crypto_exposures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.vulnerabilities') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS asset_id UUID';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS title VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS description TEXT';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS severity VARCHAR(20)';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS cvss_score NUMERIC(4,2)';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT ''open''';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS source VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.vulnerabilities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.certificates') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS asset_id UUID';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS name VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS algorithm VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS key_size INTEGER';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS issuer VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS subject VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS serial_number VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS not_before TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS not_after TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS is_quantum_safe BOOLEAN DEFAULT FALSE';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS is_expiring_soon BOOLEAN DEFAULT FALSE';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT ''active''';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.pqc_scan_sessions') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT ''pending''';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS target_scope TEXT';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS total_assets INTEGER DEFAULT 0';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS scanned_assets INTEGER DEFAULT 0';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS findings_count INTEGER DEFAULT 0';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.pqc_scan_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.pqc_scan_results') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS scan_session_id UUID';
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS asset_id UUID';
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS finding_type VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS algorithm VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS threat_level VARCHAR(20)';
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS description TEXT';
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS remediation TEXT';
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.pqc_scan_results ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.scanner_agents') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS name VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS token_hash TEXT';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT ''active''';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS hostname VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS platform VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS version VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS policy JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.scanner_agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.agent_heartbeats') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS agent_id UUID';
        EXECUTE 'ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT ''online''';
        EXECUTE 'ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS telemetry JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS ip_address INET';
        EXECUTE 'ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS user_agent TEXT';
        EXECUTE 'ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS observed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.agent_heartbeats ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.connector_accounts') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS provider VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS provider_account_id VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT ''connected''';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT ''{}''';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS token_ref TEXT';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS policy JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.connector_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.scanner_evidence') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS agent_id UUID';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS connector_account_id UUID';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS source_type VARCHAR(50)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS asset_name VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS asset_type VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS target TEXT';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS host VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS port INTEGER';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS protocol VARCHAR(50)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS observed_algorithm VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS key_size INTEGER';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS certificate_fingerprint TEXT';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS file_path TEXT';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS package_name VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS package_version VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS confidence VARCHAR(20) DEFAULT ''medium''';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS raw_evidence JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS observed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.scanner_evidence ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.scanner_alerts') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS agent_id UUID';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS connector_account_id UUID';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS evidence_id UUID';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS severity VARCHAR(20)';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS category VARCHAR(100)';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS title VARCHAR(255)';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS message TEXT';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS recommendation TEXT';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT ''open''';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.scanner_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;

    IF to_regclass('public.scanner_agent_policies') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS agent_id UUID';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT ''Default scanner policy''';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS interval_seconds INTEGER DEFAULT 300';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS allowed_targets JSONB DEFAULT ''[]''::jsonb';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS allowed_paths JSONB DEFAULT ''[]''::jsonb';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS scan_types TEXT[] DEFAULT ARRAY[''tls'', ''ssh'', ''packages'', ''configs'']';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS alert_threshold VARCHAR(20) DEFAULT ''moderate''';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT ''{}''::jsonb';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.scanner_agent_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
    END IF;
END;
$$;

-- ============================================================
-- 1. ASSETS
-- ============================================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- server, api, database, application, cloud_resource, certificate, vault, etc.
    environment VARCHAR(50), -- production, staging, development
    region VARCHAR(50),
    ip_address VARCHAR(45),
    service_owner VARCHAR(255),
    criticality VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assets_user_isolation ON assets;
CREATE POLICY assets_user_isolation ON assets
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);

-- ============================================================
-- 2. ASSET RELATIONSHIPS (for exposure map)
-- ============================================================
CREATE TABLE IF NOT EXISTS asset_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    source_asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    target_asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    relationship_type VARCHAR(100) NOT NULL, -- depends_on, communicates_with, hosts, signs_for, etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE asset_relationships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_relationships_user_isolation ON asset_relationships;
CREATE POLICY asset_relationships_user_isolation ON asset_relationships
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_asset_rel_user ON asset_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_source ON asset_relationships(source_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_target ON asset_relationships(target_asset_id);

-- ============================================================
-- 3. CRYPTO INVENTORY (CBOM)
-- ============================================================
CREATE TABLE IF NOT EXISTS crypto_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    item_type VARCHAR(100) NOT NULL, -- algorithm, certificate, key, library, protocol, tls_endpoint, signing_system, encryption_service, vault_object, tokenization_service
    name VARCHAR(255) NOT NULL,
    algorithm VARCHAR(100),
    key_size INTEGER,
    protocol VARCHAR(100),
    exposure_level VARCHAR(50), -- critical, high, moderate, low, safe
    is_vulnerable BOOLEAN DEFAULT TRUE,
    is_quantum_safe BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE crypto_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crypto_inventory_user_isolation ON crypto_inventory;
CREATE POLICY crypto_inventory_user_isolation ON crypto_inventory
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ci_user ON crypto_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_ci_asset ON crypto_inventory(asset_id);
CREATE INDEX IF NOT EXISTS idx_ci_vulnerable ON crypto_inventory(is_vulnerable);

-- ============================================================
-- 4. CRYPTO EXPOSURES
-- ============================================================
CREATE TABLE IF NOT EXISTS crypto_exposures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    exposure_type VARCHAR(100) NOT NULL, -- rsa, ecc, dh, weak_tls, sha1, md5, deprecated_lib, exposed_cert, insecure_key_mgmt
    severity VARCHAR(20) NOT NULL, -- critical, high, moderate, low
    description TEXT,
    detected_value TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE crypto_exposures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS crypto_exposures_user_isolation ON crypto_exposures;
CREATE POLICY crypto_exposures_user_isolation ON crypto_exposures
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ce_user ON crypto_exposures(user_id);
CREATE INDEX IF NOT EXISTS idx_ce_asset ON crypto_exposures(asset_id);
CREATE INDEX IF NOT EXISTS idx_ce_severity ON crypto_exposures(severity);

-- ============================================================
-- 5. VULNERABILITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    cvss_score NUMERIC(4,2),
    status VARCHAR(50) DEFAULT 'open', -- open, in_progress, resolved, false_positive
    source VARCHAR(100), -- scan, manual, threat_intel
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vulnerabilities_user_isolation ON vulnerabilities;
CREATE POLICY vulnerabilities_user_isolation ON vulnerabilities
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_vuln_user ON vulnerabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_vuln_status ON vulnerabilities(status);
CREATE INDEX IF NOT EXISTS idx_vuln_severity ON vulnerabilities(severity);

-- ============================================================
-- 6. CERTIFICATES
-- ============================================================
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    algorithm VARCHAR(100),
    key_size INTEGER,
    issuer VARCHAR(255),
    subject VARCHAR(255),
    serial_number VARCHAR(255),
    not_before TIMESTAMP WITH TIME ZONE,
    not_after TIMESTAMP WITH TIME ZONE,
    is_quantum_safe BOOLEAN DEFAULT FALSE,
    is_expiring_soon BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS certificates_user_isolation ON certificates;
CREATE POLICY certificates_user_isolation ON certificates
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_cert_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_expiry ON certificates(not_after);

-- ============================================================
-- 7. MIGRATION JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS migration_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    job_type VARCHAR(100) NOT NULL, -- key_rotation, cert_transition, encryption_upgrade, protocol_upgrade, vault_migration
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    target_algorithm VARCHAR(100),
    strategy VARCHAR(100),
    progress INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE migration_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS migration_jobs_user_isolation ON migration_jobs;
CREATE POLICY migration_jobs_user_isolation ON migration_jobs
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_mj_user ON migration_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_mj_status ON migration_jobs(status);

-- ============================================================
-- 8. MIGRATION EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS migration_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    migration_id UUID REFERENCES migration_jobs(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE migration_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS migration_events_user_isolation ON migration_events;
CREATE POLICY migration_events_user_isolation ON migration_events
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_me_user ON migration_events(user_id);
CREATE INDEX IF NOT EXISTS idx_me_migration ON migration_events(migration_id);

-- ============================================================
-- 9. PQC SCAN SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS pqc_scan_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    target_scope TEXT,
    progress INTEGER DEFAULT 0,
    total_assets INTEGER DEFAULT 0,
    scanned_assets INTEGER DEFAULT 0,
    findings_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pqc_scan_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pqc_scan_sessions_user_isolation ON pqc_scan_sessions;
CREATE POLICY pqc_scan_sessions_user_isolation ON pqc_scan_sessions
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_pss_user ON pqc_scan_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_pss_status ON pqc_scan_sessions(status);

-- ============================================================
-- 10. PQC SCAN RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS pqc_scan_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    scan_session_id UUID REFERENCES pqc_scan_sessions(id) ON DELETE CASCADE,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    finding_type VARCHAR(100) NOT NULL,
    algorithm VARCHAR(100),
    threat_level VARCHAR(20),
    description TEXT,
    remediation TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pqc_scan_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pqc_scan_results_user_isolation ON pqc_scan_results;
CREATE POLICY pqc_scan_results_user_isolation ON pqc_scan_results
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_psr_user ON pqc_scan_results(user_id);
CREATE INDEX IF NOT EXISTS idx_psr_scan ON pqc_scan_results(scan_session_id);

-- ============================================================
-- 11. VAULT FILES
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    folder_id UUID,

    -- Original File Info
    original_filename TEXT NOT NULL,
    encrypted_filename TEXT,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',

    -- Size Information
    original_size BIGINT NOT NULL DEFAULT 0,
    encrypted_size BIGINT,
    compression_ratio NUMERIC(5,2),

    -- Storage
    storage_path TEXT,
    storage_bucket TEXT DEFAULT 'vault-encrypted',
    checksum_sha256 TEXT,

    -- Post-Quantum Encryption Metadata
    encryption_status VARCHAR(100) NOT NULL DEFAULT 'pending',
    encryption_algorithm TEXT DEFAULT 'ML-KEM-768+AES-256-GCM',
    algorithm_version TEXT DEFAULT 'v2.0',

    -- ML-KEM-768 Encapsulated Key
    kem_ciphertext TEXT,

    -- AES-256-GCM Parameters
    aes_nonce TEXT,
    aes_auth_tag TEXT,

    -- Envelope Encryption Metadata
    key_derivation_meta JSONB,
    envelope_meta JSONB,

    -- Integrity Verification
    content_hash TEXT,
    encrypted_content_hash TEXT,
    aad_hash TEXT,

    -- Key References
    encryption_key_id UUID,
    key_rotation_status TEXT DEFAULT 'current',
    last_rotated_at TIMESTAMP WITH TIME ZONE,

    -- ML-DSA-65 Signature Metadata
    signature TEXT,
    signing_key_id UUID,
    ml_dsa_public_key_ref TEXT,
    signature_status VARCHAR(50) DEFAULT 'unverified',
    signed_at TIMESTAMP WITH TIME ZONE,

    -- Versioning
    version INT NOT NULL DEFAULT 1,
    is_latest BOOLEAN NOT NULL DEFAULT TRUE,
    parent_version_id UUID,
    version_notes TEXT,

    -- Processing & Status
    processing_status VARCHAR(50) DEFAULT 'queued',
    upload_session_id UUID,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,

    -- Soft Delete / Trash
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    permanent_delete_after TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    encrypted_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Legacy compatibility columns
    file_name VARCHAR(255),
    file_size BIGINT,
    is_locked BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'
);

ALTER TABLE vault_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vault_files_user_isolation ON vault_files;
CREATE POLICY vault_files_user_isolation ON vault_files
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_vf_user ON vault_files(user_id);
CREATE INDEX IF NOT EXISTS idx_vf_folder ON vault_files(folder_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_vf_status ON vault_files(encryption_status);
CREATE INDEX IF NOT EXISTS idx_vf_processing ON vault_files(processing_status);
CREATE INDEX IF NOT EXISTS idx_vf_latest ON vault_files(user_id, is_latest, is_deleted);
CREATE INDEX IF NOT EXISTS idx_vf_uploaded ON vault_files(user_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vf_hash ON vault_files(content_hash);

-- ============================================================
-- 12. VAULT AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS vault_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- encrypt, decrypt, unlock, access_denied, share, download
    file_id UUID REFERENCES vault_files(id) ON DELETE SET NULL,
    operation VARCHAR(100),
    status VARCHAR(50),
    details TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE vault_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vault_audit_logs_user_isolation ON vault_audit_logs;
CREATE POLICY vault_audit_logs_user_isolation ON vault_audit_logs
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_val_user ON vault_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_val_event ON vault_audit_logs(event_type);

-- ============================================================
-- 13. QRNG EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS qrng_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- key_generated, entropy_harvested, quality_check
    key_type VARCHAR(100),
    algorithm VARCHAR(100),
    key_length INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE qrng_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qrng_events_user_isolation ON qrng_events;
CREATE POLICY qrng_events_user_isolation ON qrng_events
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_qe_user ON qrng_events(user_id);

-- ============================================================
-- 14. SECURITY EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- critical, warning, info, success
    message TEXT NOT NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    resource_name VARCHAR(255),
    resource_type VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS security_events_user_isolation ON security_events;
CREATE POLICY security_events_user_isolation ON security_events
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_se_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_se_created ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_se_severity ON security_events(severity);

-- ============================================================
-- 15. COMPLIANCE EVIDENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    framework VARCHAR(100) NOT NULL, -- NIST, ISO27001, PCI-DSS, etc.
    control_id VARCHAR(50) NOT NULL,
    evidence_type VARCHAR(100),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compliance_evidence_user_isolation ON compliance_evidence;
CREATE POLICY compliance_evidence_user_isolation ON compliance_evidence
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_cev_user ON compliance_evidence(user_id);

-- ============================================================
-- 16. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_user_isolation ON audit_logs;
CREATE POLICY audit_logs_user_isolation ON audit_logs
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_al_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_al_created ON audit_logs(created_at DESC);

-- ============================================================
-- 17. USER DEVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(100),
    fingerprint VARCHAR(255),
    last_active TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_devices_user_isolation ON user_devices;
CREATE POLICY user_devices_user_isolation ON user_devices
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ud_user ON user_devices(user_id);

-- ============================================================
-- 18. AUTH EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- login, logout, failed_login, mfa_challenge, password_change
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_events_user_isolation ON auth_events;
CREATE POLICY auth_events_user_isolation ON auth_events
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ae_user ON auth_events(user_id);

-- ============================================================
-- 19. SCANNER AGENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS scanner_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    token_hash TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, degraded, offline, revoked
    hostname VARCHAR(255),
    platform VARCHAR(100),
    version VARCHAR(100),
    capabilities JSONB DEFAULT '{}',
    policy JSONB DEFAULT '{}',
    last_seen_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE scanner_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scanner_agents_user_isolation ON scanner_agents;
CREATE POLICY scanner_agents_user_isolation ON scanner_agents
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_scanner_agents_user ON scanner_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_scanner_agents_status ON scanner_agents(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scanner_agents_token_hash ON scanner_agents(token_hash);

-- ============================================================
-- 20. AGENT HEARTBEATS
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    agent_id UUID REFERENCES scanner_agents(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'online',
    telemetry JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE agent_heartbeats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_heartbeats_user_isolation ON agent_heartbeats;
CREATE POLICY agent_heartbeats_user_isolation ON agent_heartbeats
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_user ON agent_heartbeats(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_heartbeats_agent ON agent_heartbeats(agent_id, observed_at DESC);

-- ============================================================
-- 21. CONNECTOR ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS connector_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    provider VARCHAR(100) NOT NULL,
    provider_account_id VARCHAR(255),
    display_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'connected', -- connected, disconnected, expired, error, revoked
    scopes TEXT[] DEFAULT '{}',
    token_ref TEXT,
    capabilities JSONB DEFAULT '{}',
    policy JSONB DEFAULT '{}',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE connector_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS connector_accounts_user_isolation ON connector_accounts;
CREATE POLICY connector_accounts_user_isolation ON connector_accounts
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_connector_accounts_user ON connector_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connector_accounts_provider ON connector_accounts(user_id, provider);

-- ============================================================
-- 22. SCANNER EVIDENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS scanner_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    agent_id UUID REFERENCES scanner_agents(id) ON DELETE SET NULL,
    connector_account_id UUID REFERENCES connector_accounts(id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL, -- local-agent, connector, scanner-api
    evidence_type VARCHAR(100) NOT NULL, -- tls-certificate, ssh-metadata, package-manifest, config-reference
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(100),
    target TEXT,
    host VARCHAR(255),
    port INTEGER,
    protocol VARCHAR(50),
    observed_algorithm VARCHAR(100),
    key_size INTEGER,
    certificate_fingerprint TEXT,
    file_path TEXT,
    package_name VARCHAR(255),
    package_version VARCHAR(100),
    confidence VARCHAR(20) DEFAULT 'medium',
    raw_evidence JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE scanner_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scanner_evidence_user_isolation ON scanner_evidence;
CREATE POLICY scanner_evidence_user_isolation ON scanner_evidence
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_scanner_evidence_user ON scanner_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_scanner_evidence_agent ON scanner_evidence(agent_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_scanner_evidence_algorithm ON scanner_evidence(observed_algorithm);
CREATE INDEX IF NOT EXISTS idx_scanner_evidence_type ON scanner_evidence(evidence_type);

-- ============================================================
-- 23. SCANNER ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS scanner_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    agent_id UUID REFERENCES scanner_agents(id) ON DELETE SET NULL,
    connector_account_id UUID REFERENCES connector_accounts(id) ON DELETE SET NULL,
    evidence_id UUID REFERENCES scanner_evidence(id) ON DELETE SET NULL,
    severity VARCHAR(20) NOT NULL, -- critical, high, moderate, low, safe
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    recommendation TEXT,
    status VARCHAR(50) DEFAULT 'open', -- open, acknowledged, resolved, suppressed
    metadata JSONB DEFAULT '{}',
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE scanner_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scanner_alerts_user_isolation ON scanner_alerts;
CREATE POLICY scanner_alerts_user_isolation ON scanner_alerts
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_scanner_alerts_user ON scanner_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_scanner_alerts_status ON scanner_alerts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scanner_alerts_severity ON scanner_alerts(severity);

-- ============================================================
-- 24. SCANNER AGENT POLICIES
-- ============================================================
CREATE TABLE IF NOT EXISTS scanner_agent_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    agent_id UUID REFERENCES scanner_agents(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'Default scanner policy',
    enabled BOOLEAN DEFAULT TRUE,
    interval_seconds INTEGER DEFAULT 300,
    allowed_targets JSONB DEFAULT '[]',
    allowed_paths JSONB DEFAULT '[]',
    scan_types TEXT[] DEFAULT ARRAY['tls', 'ssh', 'packages', 'configs'],
    alert_threshold VARCHAR(20) DEFAULT 'moderate',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE scanner_agent_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scanner_agent_policies_user_isolation ON scanner_agent_policies;
CREATE POLICY scanner_agent_policies_user_isolation ON scanner_agent_policies
    FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_scanner_agent_policies_user ON scanner_agent_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_scanner_agent_policies_agent ON scanner_agent_policies(agent_id);

-- ============================================================
-- RPC FUNCTIONS
-- ============================================================

-- Calculate quantum risk score for a user
CREATE OR REPLACE FUNCTION calculate_quantum_risk_score(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_assets INTEGER := 0;
    vulnerable_assets INTEGER := 0;
    total_cbom INTEGER := 0;
    critical_exposures INTEGER := 0;
    high_exposures INTEGER := 0;
    unresolved_vulns INTEGER := 0;
    expiring_certs INTEGER := 0;
    failed_migrations INTEGER := 0;
    active_migrations INTEGER := 0;
    score INTEGER := 1000;
    risk_band TEXT;
    previous_score INTEGER := 0;
    trend INTEGER := 0;
BEGIN
    -- Count assets
    SELECT COUNT(*) INTO total_assets FROM assets WHERE user_id = p_user_id AND status = 'active';
    SELECT COUNT(DISTINCT asset_id) INTO vulnerable_assets FROM crypto_exposures WHERE user_id = p_user_id AND severity IN ('critical', 'high');

    -- Count CBOM items
    SELECT COUNT(*) INTO total_cbom FROM crypto_inventory WHERE user_id = p_user_id;

    -- Count exposures
    SELECT COUNT(*) INTO critical_exposures FROM crypto_exposures WHERE user_id = p_user_id AND severity = 'critical';
    SELECT COUNT(*) INTO high_exposures FROM crypto_exposures WHERE user_id = p_user_id AND severity = 'high';

    -- Count unresolved vulnerabilities
    SELECT COUNT(*) INTO unresolved_vulns FROM vulnerabilities WHERE user_id = p_user_id AND status IN ('open', 'in_progress');

    -- Count expiring certificates (within 30 days)
    SELECT COUNT(*) INTO expiring_certs FROM certificates WHERE user_id = p_user_id AND not_after < NOW() + INTERVAL '30 days' AND status = 'active';

    -- Count migrations
    SELECT COUNT(*) INTO failed_migrations FROM migration_jobs WHERE user_id = p_user_id AND status = 'failed';
    SELECT COUNT(*) INTO active_migrations FROM migration_jobs WHERE user_id = p_user_id AND status IN ('pending', 'running');

    -- Calculate score (start from 1000, deduct)
    score := score - (critical_exposures * 80);
    score := score - (high_exposures * 40);
    score := score - (unresolved_vulns * 20);
    score := score - (expiring_certs * 15);
    score := score - (failed_migrations * 30);
    score := GREATEST(0, LEAST(1000, score));

    -- Determine risk band
    IF score >= 900 THEN risk_band := 'Quantum Ready';
    ELSIF score >= 700 THEN risk_band := 'Low Risk';
    ELSIF score >= 400 THEN risk_band := 'High Risk';
    ELSE risk_band := 'Critical Risk';
    END IF;

    RETURN jsonb_build_object(
        'score', score,
        'riskBand', risk_band,
        'totalAssets', total_assets,
        'vulnerableAssets', vulnerable_assets,
        'totalCbomItems', total_cbom,
        'criticalExposures', critical_exposures,
        'highExposures', high_exposures,
        'unresolvedVulns', unresolved_vulns,
        'expiringCerts', expiring_certs,
        'failedMigrations', failed_migrations,
        'activeMigrations', active_migrations,
        'trend', trend
    );
END;
$$;

-- Get dashboard summary for a user
CREATE OR REPLACE FUNCTION get_dashboard_summary(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    risk_data JSONB;
    last_scan TIMESTAMP WITH TIME ZONE;
BEGIN
    risk_data := calculate_quantum_risk_score(p_user_id);

    SELECT MAX(completed_at) INTO last_scan FROM pqc_scan_sessions WHERE user_id = p_user_id AND status = 'completed';

    RETURN jsonb_build_object(
        'quantumRiskScore', risk_data->>'score',
        'riskBand', risk_data->>'riskBand',
        'vulnerableAssetsCount', (risk_data->>'vulnerableAssets')::INTEGER,
        'newVulnerableAssets', 0,
        'totalCbomItems', (risk_data->>'totalCbomItems')::INTEGER,
        'activeMigrations', (risk_data->>'activeMigrations')::INTEGER,
        'failedMigrations', (risk_data->>'failedMigrations')::INTEGER,
        'criticalExposures', (risk_data->>'criticalExposures')::INTEGER,
        'highExposures', (risk_data->>'highExposures')::INTEGER,
        'unresolvedVulns', (risk_data->>'unresolvedVulns')::INTEGER,
        'expiringCerts', (risk_data->>'expiringCerts')::INTEGER,
        'totalAssets', (risk_data->>'totalAssets')::INTEGER,
        'lastScanAt', last_scan,
        'monitoringStatus', 'active'
    );
END;
$$;

-- Get exposure map data for a user
CREATE OR REPLACE FUNCTION get_exposure_map(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    nodes JSONB := '[]'::JSONB;
    edges JSONB := '[]'::JSONB;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'type', a.type,
        'environment', a.environment,
        'criticality', a.criticality,
        'status', a.status,
        'riskScore', COALESCE((
            SELECT COUNT(*) FROM crypto_exposures ce WHERE ce.asset_id = a.id AND ce.severity = 'critical'
        ), 0)
    )) INTO nodes
    FROM assets a WHERE a.user_id = p_user_id;

    SELECT jsonb_agg(jsonb_build_object(
        'source', ar.source_asset_id,
        'target', ar.target_asset_id,
        'type', ar.relationship_type
    )) INTO edges
    FROM asset_relationships ar WHERE ar.user_id = p_user_id;

    RETURN jsonb_build_object('nodes', COALESCE(nodes, '[]'::JSONB), 'edges', COALESCE(edges, '[]'::JSONB));
END;
$$;

-- Get recent security events for a user
CREATE OR REPLACE FUNCTION get_recent_security_events(p_user_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    events JSONB;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'id', se.id,
        'eventType', se.event_type,
        'severity', se.severity,
        'message', se.message,
        'assetId', se.asset_id,
        'resourceName', se.resource_name,
        'resourceType', se.resource_type,
        'metadata', se.metadata,
        'isRead', se.is_read,
        'createdAt', se.created_at
    ) ORDER BY se.created_at DESC) INTO events
    FROM security_events se WHERE se.user_id = p_user_id LIMIT p_limit;

    RETURN COALESCE(events, '[]'::JSONB);
END;
$$;

-- Enable realtime for all new tables
DO $$
DECLARE
    tbl TEXT;
    tables TEXT[] := ARRAY[
        'assets', 'asset_relationships', 'crypto_inventory', 'crypto_exposures',
        'vulnerabilities', 'certificates', 'migration_jobs', 'migration_events',
        'pqc_scan_sessions', 'pqc_scan_results', 'vault_files', 'vault_audit_logs',
        'qrng_events', 'security_events', 'compliance_evidence', 'audit_logs',
        'user_devices', 'auth_events', 'scanner_agents', 'agent_heartbeats',
        'connector_accounts', 'scanner_evidence', 'scanner_alerts',
        'scanner_agent_policies'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION WHEN OTHERS THEN
            -- Table may already be in publication, or realtime may be unavailable.
            NULL;
        END;
    END LOOP;
END;
$$;
