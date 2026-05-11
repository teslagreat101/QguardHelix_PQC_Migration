-- Qguard Helix Quantum Migration Engine - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Assets Table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    service_owner VARCHAR(255),
    environment VARCHAR(50),
    region VARCHAR(50),
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crypto Inventory Table (CBOM)
CREATE TABLE IF NOT EXISTS crypto_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    algorithm VARCHAR(100) NOT NULL,
    key_size INTEGER,
    protocol VARCHAR(100),
    exposure_level VARCHAR(50),
    is_vulnerable BOOLEAN DEFAULT TRUE,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Risk Engine Scores
CREATE TABLE IF NOT EXISTS risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    score INTEGER NOT NULL, -- 0-1000
    level VARCHAR(20) NOT NULL, -- Critical, Vulnerable, Moderate, Quantum Safe
    risk_factors JSONB,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Migrations
CREATE TABLE IF NOT EXISTS migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id),
    status VARCHAR(50) NOT NULL DEFAULT 'PLANNED', -- PLANNED, IN_PROGRESS, COMPLETED, FAILED, ROLLED_BACK
    target_algorithm VARCHAR(100) NOT NULL,
    strategy VARCHAR(100) NOT NULL, -- e.g., Hybrid X25519+ML-KEM
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Migration Logs
CREATE TABLE IF NOT EXISTS migration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID REFERENCES migrations(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL DEFAULT 'INFO',
    message TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Telemetry (For Real-Time Monitor)
CREATE TABLE IF NOT EXISTS telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID REFERENCES assets(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value FLOAT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Quantum Governance Assets
CREATE TABLE IF NOT EXISTS quantum_governance_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    environment VARCHAR(50),
    business_owner VARCHAR(255),
    technical_owner VARCHAR(255),
    criticality VARCHAR(20) NOT NULL,
    data_classification VARCHAR(50),
    algorithm VARCHAR(100),
    pqc_readiness INTEGER DEFAULT 0,
    risk_score INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. PKI Debt Tracking
CREATE TABLE IF NOT EXISTS quantum_governance_pki_debt (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    impact VARCHAR(20),
    blocking_pqc BOOLEAN DEFAULT FALSE,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Compliance Controls
CREATE TABLE IF NOT EXISTS quantum_governance_controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    framework VARCHAR(100) NOT NULL,
    control_id VARCHAR(50) NOT NULL,
    name TEXT NOT NULL,
    status VARCHAR(50),
    evidence_status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Policy Exceptions
CREATE TABLE IF NOT EXISTS quantum_governance_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    asset_id UUID REFERENCES quantum_governance_assets(id),
    policy_violated TEXT,
    justification TEXT,
    expiration_date DATE,
    status VARCHAR(50) DEFAULT 'requested',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for new tables
alter publication supabase_realtime add table quantum_governance_assets;
alter publication supabase_realtime add table quantum_governance_pki_debt;
alter publication supabase_realtime add table quantum_governance_controls;
alter publication supabase_realtime add table quantum_governance_exceptions;
