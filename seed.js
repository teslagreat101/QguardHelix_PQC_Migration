import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🌱 Seeding Qguard Helix Quantum Migration Engine data...');

  // 1. Clear existing data (optional, but good for fresh start)
  // await supabase.from('migration_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // await supabase.from('migrations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // await supabase.from('risk_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // await supabase.from('crypto_inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // await supabase.from('assets').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 2. Insert Assets
  const { data: assets, error: assetError } = await supabase.from('assets').insert([
    { name: 'production-api-gateway', type: 'API', service_owner: 'Infrastructure Team', environment: 'Production', ip_address: '10.0.4.22', region: 'us-east-1' },
    { name: 'customer-db-primary', type: 'Database', service_owner: 'Data Engineering', environment: 'Production', ip_address: '10.0.12.85', region: 'us-east-1' },
    { name: 'internal-auth-service', type: 'Cloud', service_owner: 'Security Team', environment: 'Staging', ip_address: '10.2.0.11', region: 'eu-central-1' },
    { name: 'legacy-payment-worker', type: 'Server', service_owner: 'Fintech Ops', environment: 'Legacy', ip_address: '192.168.1.45', region: 'on-premise' }
  ]).select();

  if (assetError) {
    console.error('Error seeding assets:', assetError);
    return;
  }

  console.log(`✅ Seeded ${assets.length} assets.`);

  // 3. Insert Crypto Inventory & Risk Scores
  for (const asset of assets) {
    let algorithms = [];
    let score = 0;
    let level = '';

    if (asset.name === 'production-api-gateway') {
      algorithms = [
        { algorithm: 'RSA', key_size: 2048, protocol: 'TLS 1.2', exposure_level: 'Public', is_vulnerable: true },
        { algorithm: 'ECDHE', key_size: 256, protocol: 'TLS 1.2', exposure_level: 'Public', is_vulnerable: true }
      ];
      score = 340;
      level = 'Critical';
    } else if (asset.name === 'customer-db-primary') {
      algorithms = [
        { algorithm: 'AES-GCM', key_size: 128, protocol: 'Disk Encryption', exposure_level: 'Internal', is_vulnerable: true },
        { algorithm: 'RSA', key_size: 4096, protocol: 'Backup Signing', exposure_level: 'Internal', is_vulnerable: true }
      ];
      score = 520;
      level = 'Vulnerable';
    } else if (asset.name === 'internal-auth-service') {
      algorithms = [
        { algorithm: 'ML-KEM', key_size: 768, protocol: 'TLS 1.3', exposure_level: 'Internal', is_vulnerable: false },
        { algorithm: 'Ed25519', key_size: 256, protocol: 'JWT Signing', exposure_level: 'Internal', is_vulnerable: false }
      ];
      score = 945;
      level = 'Quantum Safe';
    } else {
      algorithms = [
        { algorithm: 'SHA-1', protocol: 'Legacy Signatures', exposure_level: 'Public', is_vulnerable: true },
        { algorithm: 'RSA', key_size: 1024, protocol: 'S/MIME', exposure_level: 'Public', is_vulnerable: true }
      ];
      score = 120;
      level = 'Critical';
    }

    await supabase.from('crypto_inventory').insert(
      algorithms.map(algo => ({ ...algo, asset_id: asset.id }))
    );

    await supabase.from('risk_scores').insert({
      asset_id: asset.id,
      score,
      level,
      risk_factors: {
        hndl_risk: asset.type === 'Database' ? 'High' : 'Medium',
        public_exposure: asset.ip_address.startsWith('10.') ? 'Low' : 'High'
      }
    });
  }

  console.log('✅ Seeded Crypto Inventory and Risk Scores.');
  console.log('🚀 Seeding complete! Qguard Helix Platform is ready.');
}

seed();
