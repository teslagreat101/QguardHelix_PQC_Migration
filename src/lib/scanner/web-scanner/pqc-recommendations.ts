/**
 * QGuard Web Scanner — Post-Quantum Cryptography Recommendation Engine
 * Generates PQC migration recommendations for detected quantum-vulnerable algorithms
 */

import type { WebScanFinding, PQCMigrationDetail, ThreatLevel } from './types'

// ─── PQC Migration Map ──────────────────────────────────────────────────────

const PQC_WEB_MIGRATION_MAP: Record<string, Omit<PQCMigrationDetail, 'currentAlgorithm'>> = {
  // RSA algorithms
  'RSA': {
    recommendedPQC: 'ML-KEM-768 (FIPS 203)',
    alternativePQC: ['ML-KEM-1024', 'FrodoKEM', 'Classic McEliece'],
    migrationType: 'Key Exchange / Encryption Replacement',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Deploy hybrid TLS with ML-KEM-768 + X25519 key exchange',
      'Issue post-quantum certificates from PQC-ready CA',
      'Rotate all RSA certificates and keys',
      'Disable RSA key exchange on servers',
      'Test backward compatibility with legacy clients',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '2-4 weeks',
  },
  'RSA-1024': {
    recommendedPQC: 'ML-KEM-768 (FIPS 203)',
    alternativePQC: ['ML-KEM-1024', 'FrodoKEM'],
    migrationType: 'Emergency Key Replacement',
    migrationComplexity: 'CRITICAL',
    migrationSteps: [
      'Immediately revoke all RSA-1024 keys',
      'Deploy ML-KEM-768 key encapsulation',
      'Issue replacement certificates with minimum RSA-4096 or PQC',
      'Update all dependent services and clients',
      'Verify no RSA-1024 fallback paths remain',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '1-2 weeks (urgent)',
  },
  'RSA-2048': {
    recommendedPQC: 'ML-KEM-768 (FIPS 203)',
    alternativePQC: ['ML-KEM-1024', 'FrodoKEM', 'BIKE', 'HQC'],
    migrationType: 'TLS Key Exchange Replacement',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Deploy hybrid TLS (X25519 + ML-KEM-768)',
      'Issue post-quantum certificates from PQC-ready CA',
      'Rotate classical RSA certificates',
      'Disable RSA key exchange on servers',
      'Monitor for compatibility issues',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '2-4 weeks',
  },
  'RSA-4096': {
    recommendedPQC: 'ML-KEM-1024 (FIPS 203)',
    alternativePQC: ['FrodoKEM-1344', 'Classic McEliece'],
    migrationType: 'High-Security Key Exchange Replacement',
    migrationComplexity: 'MEDIUM',
    migrationSteps: [
      'Plan hybrid deployment with ML-KEM-1024',
      'Test PQC key exchange performance impact',
      'Deploy hybrid TLS configuration',
      'Phase out RSA-4096 over transition period',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '3-6 weeks',
  },

  // ECDSA / ECC algorithms
  'ECDSA': {
    recommendedPQC: 'ML-DSA-65 (FIPS 204)',
    alternativePQC: ['ML-DSA-87', 'Falcon-512', 'SLH-DSA (SPHINCS+)'],
    migrationType: 'Digital Signature Replacement',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Deploy hybrid signature scheme: ML-DSA-65 + ECDSA',
      'Update certificate signing with ML-DSA signatures',
      'Migrate JWT signing from ES256 to ML-DSA',
      'Update signature verification in all clients',
      'Phase out ECDSA-only signatures',
    ],
    nistStandard: 'FIPS 204 (ML-DSA)',
    estimatedEffort: '3-6 weeks',
  },
  'ECDHE': {
    recommendedPQC: 'ML-KEM-768 + X25519 Hybrid',
    alternativePQC: ['ML-KEM-1024 + X448', 'FrodoKEM'],
    migrationType: 'Key Exchange Upgrade',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Enable X25519Kyber768 hybrid key exchange in TLS 1.3',
      'Update server TLS configuration (nginx/Apache/Caddy)',
      'Test with PQC-capable browsers and clients',
      'Monitor key exchange performance overhead',
      'Gradually disable ECDHE-only cipher suites',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '1-3 weeks',
  },
  'ECC': {
    recommendedPQC: 'ML-KEM-768 / ML-DSA-65',
    alternativePQC: ['Falcon-512', 'SLH-DSA'],
    migrationType: 'ECC Migration',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Inventory all ECC usage (key exchange vs signatures)',
      'Replace key exchange with ML-KEM-768',
      'Replace signatures with ML-DSA-65',
      'Update crypto libraries to PQC-enabled versions',
    ],
    nistStandard: 'FIPS 203/204',
    estimatedEffort: '4-8 weeks',
  },
  'P-256': {
    recommendedPQC: 'ML-KEM-768 (FIPS 203)',
    alternativePQC: ['ML-KEM-1024', 'FrodoKEM'],
    migrationType: 'NIST Curve Replacement',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Replace P-256 ECDH with ML-KEM-768 key encapsulation',
      'Replace P-256 ECDSA with ML-DSA-65 signatures',
      'Deploy hybrid X25519Kyber768 for TLS',
      'Update all applications using secp256r1',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '3-6 weeks',
  },

  // Diffie-Hellman
  'DHE': {
    recommendedPQC: 'ML-KEM-768 (FIPS 203)',
    alternativePQC: ['ML-KEM-1024', 'FrodoKEM'],
    migrationType: 'Key Exchange Replacement',
    migrationComplexity: 'MEDIUM',
    migrationSteps: [
      'Replace DHE with ML-KEM-768 hybrid key exchange',
      'Update server TLS configuration',
      'Remove DHE cipher suites from allowed list',
      'Test with all client applications',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '1-3 weeks',
  },
  'Diffie-Hellman': {
    recommendedPQC: 'ML-KEM-768 (FIPS 203)',
    alternativePQC: ['ML-KEM-1024', 'FrodoKEM'],
    migrationType: 'Key Exchange Replacement',
    migrationComplexity: 'MEDIUM',
    migrationSteps: [
      'Replace DH key agreement with ML-KEM key encapsulation',
      'Update application code to use PQC library',
      'Remove DH parameter generation',
      'Verify all key exchange paths use ML-KEM',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '2-4 weeks',
  },

  // DSA
  'DSA': {
    recommendedPQC: 'ML-DSA-65 (FIPS 204)',
    alternativePQC: ['SLH-DSA (SPHINCS+)', 'Falcon-512'],
    migrationType: 'Signature Algorithm Replacement',
    migrationComplexity: 'MEDIUM',
    migrationSteps: [
      'Replace DSA with ML-DSA-65 (Dilithium)',
      'Update all signature verification code',
      'Reissue certificates with PQC signatures',
      'Remove DSA key generation',
    ],
    nistStandard: 'FIPS 204 (ML-DSA)',
    estimatedEffort: '2-4 weeks',
  },

  // Hash algorithms
  'SHA-1': {
    recommendedPQC: 'SHA-3-256',
    alternativePQC: ['SHA-256', 'SHA-384', 'SHAKE256'],
    migrationType: 'Hash Algorithm Upgrade',
    migrationComplexity: 'MEDIUM',
    migrationSteps: [
      'Replace all SHA-1 usage with SHA-3-256 or SHA-256',
      'Update hash verification code',
      'Reissue certificates signed with SHA-256+',
      'Update HMAC constructions',
    ],
    nistStandard: 'FIPS 202 (SHA-3)',
    estimatedEffort: '1-2 weeks',
  },
  'MD5': {
    recommendedPQC: 'SHA-3-256',
    alternativePQC: ['SHA-256', 'BLAKE3'],
    migrationType: 'Hash Algorithm Replacement',
    migrationComplexity: 'LOW',
    migrationSteps: [
      'Replace all MD5 usage with SHA-3-256 or SHA-256',
      'Update hash verification code',
      'Audit for MD5 in password hashing (use Argon2id instead)',
    ],
    nistStandard: 'FIPS 202 (SHA-3)',
    estimatedEffort: '1 week',
  },

  // JWT algorithms
  'RS256': {
    recommendedPQC: 'ML-DSA-65 (FIPS 204)',
    alternativePQC: ['SLH-DSA', 'Falcon-512'],
    migrationType: 'JWT Signing Migration',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Add ML-DSA-65 signing support to JWT library',
      'Deploy hybrid JWT: RS256 + ML-DSA signature',
      'Update all token verification endpoints',
      'Phase out RS256-only JWT issuance',
      'Update JWKS endpoint with PQC keys',
    ],
    nistStandard: 'FIPS 204 (ML-DSA)',
    estimatedEffort: '3-6 weeks',
  },
  'ES256': {
    recommendedPQC: 'ML-DSA-65 (FIPS 204)',
    alternativePQC: ['SLH-DSA', 'Falcon-512'],
    migrationType: 'JWT Signing Migration',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Add ML-DSA-65 signing support to JWT library',
      'Deploy hybrid JWT: ES256 + ML-DSA signature',
      'Update all token verification endpoints',
      'Phase out ES256-only JWT issuance',
    ],
    nistStandard: 'FIPS 204 (ML-DSA)',
    estimatedEffort: '3-6 weeks',
  },

  // Blockchain
  'secp256k1': {
    recommendedPQC: 'ML-DSA-65 (FIPS 204) + Lattice-based KEM',
    alternativePQC: ['XMSS', 'SLH-DSA (SPHINCS+)'],
    migrationType: 'Blockchain Cryptography Migration',
    migrationComplexity: 'CRITICAL',
    migrationSteps: [
      'Monitor blockchain protocol PQC upgrade proposals',
      'Prepare wallet migration tooling',
      'Implement PQC signature verification',
      'Plan fund migration to PQC-protected addresses',
      'Coordinate with network consensus upgrade timeline',
    ],
    nistStandard: 'FIPS 204 (ML-DSA)',
    estimatedEffort: '6-12 months (protocol-dependent)',
  },

  // Symmetric (upgrade recommendation)
  'AES-128': {
    recommendedPQC: 'AES-256-GCM',
    alternativePQC: ['ChaCha20-Poly1305'],
    migrationType: 'Symmetric Key Size Upgrade',
    migrationComplexity: 'LOW',
    migrationSteps: [
      'Upgrade AES-128 to AES-256 for 128-bit quantum security',
      'Update key generation to produce 256-bit keys',
      'Re-encrypt stored data with AES-256-GCM',
    ],
    nistStandard: 'FIPS 197 (AES)',
    estimatedEffort: '1 week',
  },
  '3DES': {
    recommendedPQC: 'AES-256-GCM',
    alternativePQC: ['ChaCha20-Poly1305'],
    migrationType: 'Cipher Replacement',
    migrationComplexity: 'MEDIUM',
    migrationSteps: [
      'Replace all 3DES usage with AES-256-GCM',
      'Update encryption/decryption routines',
      'Re-encrypt stored data with AES-256',
      'Remove 3DES from cipher suite configuration',
    ],
    nistStandard: 'FIPS 197 (AES)',
    estimatedEffort: '1-2 weeks',
  },

  // Ed25519 / EdDSA
  'Ed25519': {
    recommendedPQC: 'ML-DSA-65 (FIPS 204)',
    alternativePQC: ['SLH-DSA (SPHINCS+)', 'Falcon-512'],
    migrationType: 'Signature Algorithm Replacement',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Replace Ed25519 signing with ML-DSA-65',
      'Update all signature verification code',
      'Migrate SSH keys from Ed25519 to PQC alternatives',
      'Update key distribution mechanisms',
    ],
    nistStandard: 'FIPS 204 (ML-DSA)',
    estimatedEffort: '3-6 weeks',
  },

  // X25519 key exchange
  'X25519': {
    recommendedPQC: 'ML-KEM-768 + X25519 Hybrid',
    alternativePQC: ['ML-KEM-1024 + X448'],
    migrationType: 'Key Exchange Upgrade',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Deploy X25519Kyber768 hybrid key exchange',
      'Update TLS configuration for hybrid mode',
      'Test with PQC-capable clients',
      'Gradually phase out X25519-only exchanges',
    ],
    nistStandard: 'FIPS 203 (ML-KEM)',
    estimatedEffort: '2-4 weeks',
  },

  // NaCl / Libsodium
  'NaCl': {
    recommendedPQC: 'ML-KEM-768 + ML-DSA-65',
    alternativePQC: ['liboqs integration'],
    migrationType: 'Library Migration',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Inventory all NaCl/Libsodium operations (box, sign, secretbox)',
      'Replace crypto_box (X25519+XSalsa20) with ML-KEM key exchange',
      'Replace crypto_sign (Ed25519) with ML-DSA signatures',
      'Keep crypto_secretbox (XSalsa20) — symmetric, quantum-safe',
      'Evaluate pqcrypto library as NaCl replacement',
    ],
    nistStandard: 'FIPS 203/204',
    estimatedEffort: '4-8 weeks',
  },
  'Libsodium': {
    recommendedPQC: 'ML-KEM-768 + ML-DSA-65',
    alternativePQC: ['liboqs integration'],
    migrationType: 'Library Migration',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Audit all Libsodium operations for asymmetric vs symmetric usage',
      'Replace asymmetric operations with PQC equivalents',
      'Symmetric operations (secretbox, aead) are quantum-safe — no change needed',
      'Plan migration to PQC-enabled fork or liboqs',
    ],
    nistStandard: 'FIPS 203/204',
    estimatedEffort: '4-8 weeks',
  },

  // OAuth / JWT general
  'OAuth': {
    recommendedPQC: 'ML-DSA-65 (FIPS 204)',
    alternativePQC: ['SLH-DSA', 'Falcon-512'],
    migrationType: 'OAuth Token Signing Migration',
    migrationComplexity: 'HIGH',
    migrationSteps: [
      'Audit OAuth token signing algorithms (RS256, ES256)',
      'Add ML-DSA signing support to OAuth library',
      'Deploy hybrid JWT: classical + ML-DSA signature',
      'Update all resource servers to verify PQC signatures',
      'Phase out classical-only token issuance',
    ],
    nistStandard: 'FIPS 204 (ML-DSA)',
    estimatedEffort: '4-8 weeks',
  },

  // RC4
  'RC4': {
    recommendedPQC: 'AES-256-GCM',
    alternativePQC: ['ChaCha20-Poly1305'],
    migrationType: 'Emergency Cipher Replacement',
    migrationComplexity: 'CRITICAL',
    migrationSteps: [
      'Immediately disable RC4 in all configurations',
      'Replace with AES-256-GCM or ChaCha20-Poly1305',
      'Verify no RC4 fallback paths remain',
      'Update all TLS cipher suite configurations',
    ],
    nistStandard: 'FIPS 197 (AES)',
    estimatedEffort: '1 week (urgent)',
  },
}

// ─── Recommendation Generator ───────────────────────────────────────────────

/**
 * Match an algorithm name to a PQC migration recommendation
 */
function matchAlgorithm(algorithm: string): Omit<PQCMigrationDetail, 'currentAlgorithm'> | null {
  // Direct match
  if (PQC_WEB_MIGRATION_MAP[algorithm]) {
    return PQC_WEB_MIGRATION_MAP[algorithm]
  }

  // Fuzzy matching
  const normalized = algorithm.toLowerCase()

  if (normalized.includes('rsa-1024') || (normalized.includes('rsa') && normalized.includes('1024'))) {
    return PQC_WEB_MIGRATION_MAP['RSA-1024']
  }
  if (normalized.includes('rsa-2048') || (normalized.includes('rsa') && normalized.includes('2048'))) {
    return PQC_WEB_MIGRATION_MAP['RSA-2048']
  }
  if (normalized.includes('rsa-4096') || (normalized.includes('rsa') && normalized.includes('4096'))) {
    return PQC_WEB_MIGRATION_MAP['RSA-4096']
  }
  if (normalized.includes('rsa')) return PQC_WEB_MIGRATION_MAP['RSA']
  if (normalized.includes('ecdsa') || normalized.includes('ec key')) return PQC_WEB_MIGRATION_MAP['ECDSA']
  if (normalized.includes('ecdhe') || normalized.includes('ecdh')) return PQC_WEB_MIGRATION_MAP['ECDHE']
  if (normalized.includes('p-256') || normalized.includes('secp256r1') || normalized.includes('prime256v1')) {
    return PQC_WEB_MIGRATION_MAP['P-256']
  }
  if (normalized.includes('secp256k1')) return PQC_WEB_MIGRATION_MAP['secp256k1']
  if (normalized.includes('dhe') || normalized.includes('diffie')) return PQC_WEB_MIGRATION_MAP['DHE']
  if (normalized.includes('dsa') && !normalized.includes('ecdsa')) return PQC_WEB_MIGRATION_MAP['DSA']
  if (normalized.includes('sha-1') || normalized.includes('sha1')) return PQC_WEB_MIGRATION_MAP['SHA-1']
  if (normalized.includes('md5')) return PQC_WEB_MIGRATION_MAP['MD5']
  if (normalized.includes('rs256')) return PQC_WEB_MIGRATION_MAP['RS256']
  if (normalized.includes('es256')) return PQC_WEB_MIGRATION_MAP['ES256']
  if (normalized.includes('aes-128') || normalized.includes('aes128')) return PQC_WEB_MIGRATION_MAP['AES-128']
  if (normalized.includes('3des') || normalized.includes('triple')) return PQC_WEB_MIGRATION_MAP['3DES']
  if (normalized.includes('ed25519')) return PQC_WEB_MIGRATION_MAP['Ed25519']
  if (normalized.includes('x25519') || normalized.includes('curve25519')) return PQC_WEB_MIGRATION_MAP['X25519']
  if (normalized.includes('nacl') || normalized.includes('tweetnacl')) return PQC_WEB_MIGRATION_MAP['NaCl']
  if (normalized.includes('libsodium') || normalized.includes('sodium')) return PQC_WEB_MIGRATION_MAP['Libsodium']
  if (normalized.includes('oauth')) return PQC_WEB_MIGRATION_MAP['OAuth']
  if (normalized.includes('rc4')) return PQC_WEB_MIGRATION_MAP['RC4']

  return null
}

/**
 * Generate PQC migration recommendations for all scan findings
 */
export function generatePqcRecommendations(findings: WebScanFinding[]): PQCMigrationDetail[] {
  const recommendations: PQCMigrationDetail[] = []
  const seen = new Set<string>()

  for (const finding of findings) {
    // Only recommend for quantum-vulnerable findings
    if (finding.threatLevel === 'SAFE') continue

    const migration = matchAlgorithm(finding.algorithm)
    if (!migration) continue

    // Deduplicate by algorithm family
    const key = `${migration.recommendedPQC}:${migration.migrationType}`
    if (seen.has(key)) continue
    seen.add(key)

    recommendations.push({
      currentAlgorithm: finding.algorithm,
      ...migration,
    })
  }

  // Sort by migration complexity (CRITICAL first)
  const complexityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  recommendations.sort((a, b) => complexityOrder[a.migrationComplexity] - complexityOrder[b.migrationComplexity])

  return recommendations
}
