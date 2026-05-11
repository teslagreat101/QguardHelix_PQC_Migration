/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * MANDATORY PQC CRYPTOGRAPHIC STACK
 * ==================================
 * Defines the approved post-quantum cryptographic primitives,
 * migration mappings, and validation rules per NIST FIPS 203/204/205.
 *
 * References:
 *   - Open Quantum Safe liboqs:  https://openquantumsafe.org/liboqs/
 *   - OQS-OpenSSL:               https://github.com/open-quantum-safe/openssl
 *   - OQS Provider:              https://github.com/open-quantum-safe/oqs-provider
 *   - liboqs source:             https://github.com/open-quantum-safe/liboqs
 */

// ─── NIST Security Levels ────────────────────────────────────────────────────

export const NIST_SECURITY_LEVELS = {
  0: { label: 'None',    description: 'No quantum resistance',                     color: '#ef4444' },
  1: { label: 'Level 1', description: 'At least as hard to break as AES-128',      color: '#f97316' },
  2: { label: 'Level 2', description: 'At least as hard to break as SHA-256',      color: '#eab308' },
  3: { label: 'Level 3', description: 'At least as hard to break as AES-192',      color: '#22c55e' },
  4: { label: 'Level 4', description: 'At least as hard to break as SHA-384',      color: '#06b6d4' },
  5: { label: 'Level 5', description: 'At least as hard to break as AES-256',      color: '#10b981' },
} as const;

// ─── Approved Key Exchange Mechanisms ────────────────────────────────────────

export type KEMAlgorithm = {
  id: string;
  name: string;
  standard: string;
  nistLevel: number;
  publicKeySize: number;  // bytes
  ciphertextSize: number; // bytes
  sharedSecretSize: number;
  oqsIdentifier: string;
  hybrid: boolean;
  classicalComponent: string | null;
};

export const APPROVED_KEM: KEMAlgorithm[] = [
  {
    id: 'ml-kem-512',
    name: 'ML-KEM-512',
    standard: 'FIPS 203',
    nistLevel: 1,
    publicKeySize: 800,
    ciphertextSize: 768,
    sharedSecretSize: 32,
    oqsIdentifier: 'OQS_KEM_alg_ml_kem_512',
    hybrid: false,
    classicalComponent: null,
  },
  {
    id: 'ml-kem-768',
    name: 'ML-KEM-768',
    standard: 'FIPS 203',
    nistLevel: 3,
    publicKeySize: 1184,
    ciphertextSize: 1088,
    sharedSecretSize: 32,
    oqsIdentifier: 'OQS_KEM_alg_ml_kem_768',
    hybrid: false,
    classicalComponent: null,
  },
  {
    id: 'ml-kem-1024',
    name: 'ML-KEM-1024',
    standard: 'FIPS 203',
    nistLevel: 5,
    publicKeySize: 1568,
    ciphertextSize: 1568,
    sharedSecretSize: 32,
    oqsIdentifier: 'OQS_KEM_alg_ml_kem_1024',
    hybrid: false,
    classicalComponent: null,
  },
  {
    id: 'x25519-ml-kem-768',
    name: 'X25519 + ML-KEM-768 Hybrid',
    standard: 'FIPS 203 + RFC 7748',
    nistLevel: 3,
    publicKeySize: 1216,
    ciphertextSize: 1120,
    sharedSecretSize: 64,
    oqsIdentifier: 'OQS_KEM_alg_ml_kem_768',
    hybrid: true,
    classicalComponent: 'X25519',
  },
];

// ─── Approved Digital Signature Algorithms ───────────────────────────────────

export type SignatureAlgorithm = {
  id: string;
  name: string;
  standard: string;
  nistLevel: number;
  publicKeySize: number;
  signatureSize: number;
  oqsIdentifier: string;
  hybrid: boolean;
  classicalComponent: string | null;
};

export const APPROVED_SIGNATURES: SignatureAlgorithm[] = [
  {
    id: 'ml-dsa-44',
    name: 'ML-DSA-44',
    standard: 'FIPS 204',
    nistLevel: 2,
    publicKeySize: 1312,
    signatureSize: 2420,
    oqsIdentifier: 'OQS_SIG_alg_ml_dsa_44',
    hybrid: false,
    classicalComponent: null,
  },
  {
    id: 'ml-dsa-65',
    name: 'ML-DSA-65',
    standard: 'FIPS 204',
    nistLevel: 3,
    publicKeySize: 1952,
    signatureSize: 3293,
    oqsIdentifier: 'OQS_SIG_alg_ml_dsa_65',
    hybrid: false,
    classicalComponent: null,
  },
  {
    id: 'ml-dsa-87',
    name: 'ML-DSA-87',
    standard: 'FIPS 204',
    nistLevel: 5,
    publicKeySize: 2592,
    signatureSize: 4595,
    oqsIdentifier: 'OQS_SIG_alg_ml_dsa_87',
    hybrid: false,
    classicalComponent: null,
  },
  {
    id: 'ed25519-ml-dsa-65',
    name: 'Ed25519 + ML-DSA-65 Hybrid',
    standard: 'FIPS 204 + RFC 8032',
    nistLevel: 3,
    publicKeySize: 1984,
    signatureSize: 3357,
    oqsIdentifier: 'OQS_SIG_alg_ml_dsa_65',
    hybrid: true,
    classicalComponent: 'Ed25519',
  },
];

// ─── Approved Symmetric Algorithms ───────────────────────────────────────────

export const APPROVED_SYMMETRIC = {
  encryption: { id: 'aes-256-gcm', name: 'AES-256-GCM', keySize: 256, ivSize: 96, tagSize: 128 },
  kdf:        { id: 'hkdf-sha3-256', name: 'HKDF-SHA3-256', hashLength: 256 },
  hash256:    { id: 'sha3-256', name: 'SHA3-256', outputSize: 256 },
  hash512:    { id: 'sha3-512', name: 'SHA3-512', outputSize: 512 },
} as const;

// ─── Vulnerable Algorithm → PQC Migration Mapping ───────────────────────────

export type MigrationMapping = {
  vulnerable: string;
  vulnerableCategory: 'key-exchange' | 'signature' | 'symmetric' | 'hash' | 'protocol';
  quantumThreat: 'shor' | 'grover' | 'both' | 'classical';
  pqcReplacement: string;
  hybridRecommended: boolean;
  minimumNistLevel: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  notes: string;
};

export const MIGRATION_MAP: MigrationMapping[] = [
  // Key Exchange
  { vulnerable: 'RSA-1024', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'ML-KEM-768', hybridRecommended: false, minimumNistLevel: 3, urgency: 'critical', notes: 'Already classically broken. Immediate replacement required.' },
  { vulnerable: 'RSA-2048', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'ML-KEM-768', hybridRecommended: true, minimumNistLevel: 3, urgency: 'critical', notes: 'Standard web TLS. Target of HNDL campaigns.' },
  { vulnerable: 'RSA-3072', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'ML-KEM-768', hybridRecommended: true, minimumNistLevel: 3, urgency: 'high', notes: 'Higher classical security, still quantum-vulnerable.' },
  { vulnerable: 'RSA-4096', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'ML-KEM-1024', hybridRecommended: true, minimumNistLevel: 5, urgency: 'high', notes: 'Government-grade classical. Quantum-vulnerable via Shor.' },
  { vulnerable: 'DH-1024', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'ML-KEM-768', hybridRecommended: false, minimumNistLevel: 3, urgency: 'critical', notes: 'Classically weak. Immediate deprecation.' },
  { vulnerable: 'DH-2048', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'ML-KEM-768', hybridRecommended: true, minimumNistLevel: 3, urgency: 'critical', notes: 'Standard SSH/VPN key exchange.' },
  { vulnerable: 'ECDH-P256', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'X25519 + ML-KEM-768 Hybrid', hybridRecommended: true, minimumNistLevel: 3, urgency: 'high', notes: 'NIST P-256 curve. Quantum-vulnerable.' },
  { vulnerable: 'ECDH-P384', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'X25519 + ML-KEM-768 Hybrid', hybridRecommended: true, minimumNistLevel: 3, urgency: 'high', notes: 'Stronger curve, still Shor-vulnerable.' },
  { vulnerable: 'X25519', vulnerableCategory: 'key-exchange', quantumThreat: 'shor', pqcReplacement: 'X25519 + ML-KEM-768 Hybrid', hybridRecommended: true, minimumNistLevel: 3, urgency: 'medium', notes: 'Modern curve. Hybrid transition recommended.' },

  // Signatures
  { vulnerable: 'RSA-PKCS1-v1.5', vulnerableCategory: 'signature', quantumThreat: 'shor', pqcReplacement: 'ML-DSA-65', hybridRecommended: true, minimumNistLevel: 3, urgency: 'critical', notes: 'Legacy padding scheme. Double vulnerability.' },
  { vulnerable: 'RSA-PSS', vulnerableCategory: 'signature', quantumThreat: 'shor', pqcReplacement: 'ML-DSA-65', hybridRecommended: true, minimumNistLevel: 3, urgency: 'high', notes: 'Better padding, still RSA-based.' },
  { vulnerable: 'ECDSA-P256', vulnerableCategory: 'signature', quantumThreat: 'shor', pqcReplacement: 'ML-DSA-65', hybridRecommended: true, minimumNistLevel: 3, urgency: 'high', notes: 'Standard TLS/JWT signing.' },
  { vulnerable: 'ECDSA-P384', vulnerableCategory: 'signature', quantumThreat: 'shor', pqcReplacement: 'ML-DSA-87', hybridRecommended: true, minimumNistLevel: 5, urgency: 'high', notes: 'Government-grade signing.' },
  { vulnerable: 'Ed25519', vulnerableCategory: 'signature', quantumThreat: 'shor', pqcReplacement: 'Ed25519 + ML-DSA-65 Hybrid', hybridRecommended: true, minimumNistLevel: 3, urgency: 'medium', notes: 'Modern EdDSA. Hybrid recommended.' },
  { vulnerable: 'DSA', vulnerableCategory: 'signature', quantumThreat: 'shor', pqcReplacement: 'ML-DSA-65', hybridRecommended: false, minimumNistLevel: 3, urgency: 'critical', notes: 'Deprecated even classically. Immediate removal.' },

  // Symmetric
  { vulnerable: 'AES-128', vulnerableCategory: 'symmetric', quantumThreat: 'grover', pqcReplacement: 'AES-256-GCM', hybridRecommended: false, minimumNistLevel: 5, urgency: 'medium', notes: 'Grover halves effective security to 64-bit.' },
  { vulnerable: 'AES-128-CBC', vulnerableCategory: 'symmetric', quantumThreat: 'grover', pqcReplacement: 'AES-256-GCM', hybridRecommended: false, minimumNistLevel: 5, urgency: 'high', notes: 'CBC mode + Grover vulnerability.' },
  { vulnerable: '3DES', vulnerableCategory: 'symmetric', quantumThreat: 'grover', pqcReplacement: 'AES-256-GCM', hybridRecommended: false, minimumNistLevel: 5, urgency: 'critical', notes: 'Classically deprecated. Immediate removal.' },
  { vulnerable: 'RC4', vulnerableCategory: 'symmetric', quantumThreat: 'classical', pqcReplacement: 'AES-256-GCM', hybridRecommended: false, minimumNistLevel: 5, urgency: 'critical', notes: 'Broken stream cipher. Immediate removal.' },
  { vulnerable: 'Blowfish', vulnerableCategory: 'symmetric', quantumThreat: 'grover', pqcReplacement: 'AES-256-GCM', hybridRecommended: false, minimumNistLevel: 5, urgency: 'high', notes: '64-bit block size. Sweet32 attack.' },

  // Hashing
  { vulnerable: 'MD5', vulnerableCategory: 'hash', quantumThreat: 'classical', pqcReplacement: 'SHA3-256', hybridRecommended: false, minimumNistLevel: 0, urgency: 'critical', notes: 'Collision attacks trivial. Never use for security.' },
  { vulnerable: 'SHA-1', vulnerableCategory: 'hash', quantumThreat: 'classical', pqcReplacement: 'SHA3-256', hybridRecommended: false, minimumNistLevel: 0, urgency: 'critical', notes: 'SHAttered attack demonstrated. Immediate removal.' },
  { vulnerable: 'SHA-224', vulnerableCategory: 'hash', quantumThreat: 'grover', pqcReplacement: 'SHA3-256', hybridRecommended: false, minimumNistLevel: 1, urgency: 'medium', notes: 'Truncated SHA-256. Grover reduces to 112-bit.' },

  // Protocols
  { vulnerable: 'TLS 1.0', vulnerableCategory: 'protocol', quantumThreat: 'both', pqcReplacement: 'TLS 1.3 + PQC KEM', hybridRecommended: false, minimumNistLevel: 3, urgency: 'critical', notes: 'BEAST, POODLE attacks. Deprecated by RFC 8996.' },
  { vulnerable: 'TLS 1.1', vulnerableCategory: 'protocol', quantumThreat: 'both', pqcReplacement: 'TLS 1.3 + PQC KEM', hybridRecommended: false, minimumNistLevel: 3, urgency: 'critical', notes: 'Deprecated by RFC 8996.' },
  { vulnerable: 'SSLv3', vulnerableCategory: 'protocol', quantumThreat: 'both', pqcReplacement: 'TLS 1.3 + PQC KEM', hybridRecommended: false, minimumNistLevel: 3, urgency: 'critical', notes: 'POODLE vulnerability. Must be disabled.' },
  { vulnerable: 'SSH-RSA', vulnerableCategory: 'protocol', quantumThreat: 'shor', pqcReplacement: 'SSH + ML-KEM-768 KEX', hybridRecommended: true, minimumNistLevel: 3, urgency: 'high', notes: 'RSA-based SSH authentication.' },
];

// ─── Validation ──────────────────────────────────────────────────────────────

export function getMigrationTarget(vulnerableAlgo: string): MigrationMapping | undefined {
  return MIGRATION_MAP.find(
    m => m.vulnerable.toLowerCase() === vulnerableAlgo.toLowerCase()
  );
}

export function isApprovedKEM(algoId: string): boolean {
  return APPROVED_KEM.some(k => k.id === algoId);
}

export function isApprovedSignature(algoId: string): boolean {
  return APPROVED_SIGNATURES.some(s => s.id === algoId);
}

export function getNistLevel(algoId: string): number {
  const kem = APPROVED_KEM.find(k => k.id === algoId);
  if (kem) return kem.nistLevel;
  const sig = APPROVED_SIGNATURES.find(s => s.id === algoId);
  if (sig) return sig.nistLevel;
  return 0;
}
