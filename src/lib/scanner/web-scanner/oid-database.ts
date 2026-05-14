/**
 * QGuard Web Scanner — X.509 Certificate OID Database
 * 50 OID mappings with quantum vulnerability classifications
 */

import type { OidClassification } from './types'

export const OID_DATABASE: OidClassification[] = [
  // ── Category 1: RSA Algorithms (Quantum-Vulnerable via Shor's Algorithm) ──

  {
    oid: '1.2.840.113549.1.1.1',
    name: 'rsaEncryption',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-KEM-768 (FIPS 203)',
    description: 'RSA public key encryption — fully breakable by Shor\'s algorithm',
  },
  {
    oid: '1.2.840.113549.1.1.2',
    name: 'md2WithRSAEncryption',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'both',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'RSA signature with MD2 hash — classically broken hash + quantum-vulnerable RSA',
  },
  {
    oid: '1.2.840.113549.1.1.3',
    name: 'md4WithRSAEncryption',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'both',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'RSA signature with MD4 hash — classically broken hash + quantum-vulnerable RSA',
  },
  {
    oid: '1.2.840.113549.1.1.4',
    name: 'md5WithRSAEncryption',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'both',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'RSA signature with MD5 hash — classically broken hash + quantum-vulnerable RSA',
  },
  {
    oid: '1.2.840.113549.1.1.5',
    name: 'sha1WithRSAEncryption',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'both',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'RSA signature with SHA-1 hash — deprecated hash + quantum-vulnerable RSA',
  },
  {
    oid: '1.2.840.113549.1.1.11',
    name: 'sha256WithRSAEncryption',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'RSA signature with SHA-256 — quantum-vulnerable RSA component',
  },
  {
    oid: '1.2.840.113549.1.1.12',
    name: 'sha384WithRSAEncryption',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-87 (FIPS 204)',
    description: 'RSA signature with SHA-384 — quantum-vulnerable RSA component',
  },
  {
    oid: '1.2.840.113549.1.1.13',
    name: 'sha512WithRSAEncryption',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-87 (FIPS 204)',
    description: 'RSA signature with SHA-512 — quantum-vulnerable RSA component',
  },
  {
    oid: '1.2.840.113549.1.1.10',
    name: 'RSASSA-PSS',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'RSA-PSS probabilistic signature scheme — quantum-vulnerable',
  },
  {
    oid: '1.2.840.113549.1.1.7',
    name: 'RSAES-OAEP',
    category: 'rsa',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-KEM-768 (FIPS 203)',
    description: 'RSA-OAEP encryption — quantum-vulnerable key encapsulation',
  },

  // ── Category 2: Elliptic Curve Cryptography (Quantum-Vulnerable) ──────────

  {
    oid: '1.2.840.10045.2.1',
    name: 'ecPublicKey',
    category: 'ecc',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-KEM-768 (FIPS 203)',
    description: 'Elliptic curve public key — breakable by Shor\'s algorithm on ECDLP',
  },
  {
    oid: '1.2.840.10045.4.1',
    name: 'ecdsa-with-SHA1',
    category: 'ecc',
    quantumVulnerable: true,
    quantumThreat: 'both',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'ECDSA with SHA-1 — deprecated hash + quantum-vulnerable ECDSA',
  },
  {
    oid: '1.2.840.10045.4.3.2',
    name: 'ecdsa-with-SHA256',
    category: 'ecc',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'ECDSA with SHA-256 — quantum-vulnerable ECDSA signature',
  },
  {
    oid: '1.2.840.10045.4.3.3',
    name: 'ecdsa-with-SHA384',
    category: 'ecc',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-87 (FIPS 204)',
    description: 'ECDSA with SHA-384 — quantum-vulnerable ECDSA signature',
  },
  {
    oid: '1.2.840.10045.4.3.4',
    name: 'ecdsa-with-SHA512',
    category: 'ecc',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-87 (FIPS 204)',
    description: 'ECDSA with SHA-512 — quantum-vulnerable ECDSA signature',
  },
  {
    oid: '1.2.840.10045.3.1.7',
    name: 'secp256r1 (P-256)',
    category: 'ecc',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-KEM-768 (FIPS 203)',
    description: 'NIST P-256 curve — widely used but quantum-vulnerable via ECDLP',
  },
  {
    oid: '1.3.132.0.34',
    name: 'secp384r1 (P-384)',
    category: 'ecc',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-KEM-1024 (FIPS 203)',
    description: 'NIST P-384 curve — quantum-vulnerable via ECDLP',
  },
  {
    oid: '1.3.132.0.35',
    name: 'secp521r1 (P-521)',
    category: 'ecc',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-KEM-1024 (FIPS 203)',
    description: 'NIST P-521 curve — quantum-vulnerable via ECDLP',
  },

  // ── Category 3: Diffie-Hellman (Quantum-Vulnerable) ───────────────────────

  {
    oid: '1.2.840.113549.1.3.1',
    name: 'dhKeyAgreement',
    category: 'dh',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-KEM-768 (FIPS 203)',
    description: 'Diffie-Hellman key agreement — breakable by Shor\'s algorithm',
  },
  {
    oid: '1.2.840.10046.2.1',
    name: 'dhPublicNumber',
    category: 'dh',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-KEM-768 (FIPS 203)',
    description: 'Diffie-Hellman public key — quantum-vulnerable key exchange',
  },

  // ── Category 4: DSA Algorithms (Quantum-Vulnerable) ───────────────────────

  {
    oid: '1.2.840.10040.4.1',
    name: 'DSA',
    category: 'dsa',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'Digital Signature Algorithm — breakable by Shor\'s algorithm',
  },
  {
    oid: '1.2.840.10040.4.3',
    name: 'dsaWithSHA1',
    category: 'dsa',
    quantumVulnerable: true,
    quantumThreat: 'both',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'DSA with SHA-1 — deprecated hash + quantum-vulnerable DSA',
  },
  {
    oid: '2.16.840.1.101.3.4.3.2',
    name: 'dsa-with-sha256',
    category: 'dsa',
    quantumVulnerable: true,
    quantumThreat: 'shor',
    pqcReplacement: 'ML-DSA-65 (FIPS 204)',
    description: 'DSA with SHA-256 — quantum-vulnerable DSA signature',
  },

  // ── Category 5: Hash Algorithms (Quantum-Weakened) ────────────────────────

  {
    oid: '1.3.14.3.2.26',
    name: 'SHA-1',
    category: 'hash',
    quantumVulnerable: false,
    quantumThreat: 'classical-broken',
    pqcReplacement: 'SHA-3-256',
    description: 'SHA-1 hash — classically broken (collision attacks demonstrated)',
  },
  {
    oid: '2.16.840.1.101.3.4.2.1',
    name: 'SHA-256',
    category: 'hash',
    quantumVulnerable: false,
    quantumThreat: 'grover',
    pqcReplacement: null,
    description: 'SHA-256 — quantum-weakened by Grover (128-bit quantum security)',
  },
  {
    oid: '2.16.840.1.101.3.4.2.2',
    name: 'SHA-384',
    category: 'hash',
    quantumVulnerable: false,
    quantumThreat: 'grover',
    pqcReplacement: null,
    description: 'SHA-384 — quantum-weakened by Grover (192-bit quantum security)',
  },
  {
    oid: '2.16.840.1.101.3.4.2.3',
    name: 'SHA-512',
    category: 'hash',
    quantumVulnerable: false,
    quantumThreat: 'grover',
    pqcReplacement: null,
    description: 'SHA-512 — quantum-weakened by Grover (256-bit quantum security)',
  },

  // ── Category 6: X.509 Certificate Extensions ─────────────────────────────

  {
    oid: '2.5.29.15',
    name: 'Key Usage',
    category: 'extension',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Certificate key usage extension — identifies permitted key operations',
  },
  {
    oid: '2.5.29.19',
    name: 'Basic Constraints',
    category: 'extension',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Basic constraints extension — identifies CA certificates',
  },
  {
    oid: '2.5.29.37',
    name: 'Extended Key Usage',
    category: 'extension',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Extended key usage extension — specifies permitted certificate purposes',
  },
  {
    oid: '2.5.29.17',
    name: 'Subject Alternative Name',
    category: 'extension',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'SAN extension — lists additional hostnames/IPs for the certificate',
  },

  // ── Category 7: Post-Quantum Cryptography OIDs ───────────────────────────

  {
    oid: '1.3.6.1.4.1.2.267.7.4.4',
    name: 'ML-DSA (Dilithium)',
    category: 'pqc',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'CRYSTALS-Dilithium lattice-based digital signature — NIST FIPS 204',
  },
  {
    oid: '1.3.9999.3.1',
    name: 'Falcon',
    category: 'pqc',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Falcon lattice-based digital signature — NIST PQC selected algorithm',
  },
  {
    oid: '1.3.9999.6.4.1',
    name: 'SPHINCS+',
    category: 'pqc',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'SPHINCS+ hash-based digital signature — NIST FIPS 205 (SLH-DSA)',
  },
  {
    oid: '1.3.6.1.4.1.2.267.11.4.4',
    name: 'ML-KEM (Kyber)',
    category: 'pqc',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'CRYSTALS-Kyber lattice-based key encapsulation — NIST FIPS 203',
  },
  {
    oid: '1.3.6.1.4.1.22554.5.6.1',
    name: 'Composite Signature',
    category: 'pqc',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Composite hybrid signature (classical + PQC) — transition mechanism',
  },

  // ── Category 8: Symmetric Encryption Identifiers ──────────────────────────

  {
    oid: '2.16.840.1.101.3.4.1.2',
    name: 'AES-128-CBC',
    category: 'symmetric',
    quantumVulnerable: false,
    quantumThreat: 'grover',
    pqcReplacement: 'AES-256-GCM',
    description: 'AES-128 in CBC mode — only 64-bit quantum security (below recommended threshold)',
  },
  {
    oid: '2.16.840.1.101.3.4.1.22',
    name: 'AES-192-CBC',
    category: 'symmetric',
    quantumVulnerable: false,
    quantumThreat: 'grover',
    pqcReplacement: 'AES-256-GCM',
    description: 'AES-192 in CBC mode — 96-bit quantum security',
  },
  {
    oid: '2.16.840.1.101.3.4.1.42',
    name: 'AES-256-CBC',
    category: 'symmetric',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: 'AES-256-GCM',
    description: 'AES-256 in CBC mode — 128-bit quantum security (adequate)',
  },
  {
    oid: '2.16.840.1.101.3.4.1.6',
    name: 'AES-128-GCM',
    category: 'symmetric',
    quantumVulnerable: false,
    quantumThreat: 'grover',
    pqcReplacement: 'AES-256-GCM',
    description: 'AES-128 in GCM mode — only 64-bit quantum security',
  },
  {
    oid: '2.16.840.1.101.3.4.1.46',
    name: 'AES-256-GCM',
    category: 'symmetric',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'AES-256 in GCM mode — 128-bit quantum security (quantum-safe)',
  },

  // ── Category 9: Legacy Encryption ─────────────────────────────────────────

  {
    oid: '1.2.840.113549.3.7',
    name: '3DES (Triple DES)',
    category: 'legacy',
    quantumVulnerable: false,
    quantumThreat: 'classical-broken',
    pqcReplacement: 'AES-256-GCM',
    description: '3DES — classically deprecated due to 64-bit block size (Sweet32 attack)',
  },
  {
    oid: '1.2.840.113549.3.2',
    name: 'RC2',
    category: 'legacy',
    quantumVulnerable: false,
    quantumThreat: 'classical-broken',
    pqcReplacement: 'AES-256-GCM',
    description: 'RC2 cipher — classically broken, must not be used',
  },
  {
    oid: '1.2.840.113549.3.4',
    name: 'RC4',
    category: 'legacy',
    quantumVulnerable: false,
    quantumThreat: 'classical-broken',
    pqcReplacement: 'AES-256-GCM',
    description: 'RC4 stream cipher — classically broken (multiple biases)',
  },

  // ── Category 10: Certificate Authority Identifiers ────────────────────────

  {
    oid: '2.5.29.35',
    name: 'Authority Key Identifier',
    category: 'ca-identifier',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Identifies the CA public key used to sign the certificate',
  },
  {
    oid: '2.5.29.14',
    name: 'Subject Key Identifier',
    category: 'ca-identifier',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Unique identifier for the certificate subject key',
  },
  {
    oid: '1.3.6.1.5.5.7.1.1',
    name: 'Authority Info Access',
    category: 'ca-identifier',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'AIA extension — provides CA issuer and OCSP responder URLs',
  },
  {
    oid: '1.3.6.1.5.5.7.48.1',
    name: 'OCSP',
    category: 'ca-identifier',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Online Certificate Status Protocol — certificate revocation checking',
  },
  {
    oid: '1.3.6.1.5.5.7.48.2',
    name: 'CA Issuers',
    category: 'ca-identifier',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'CA issuer access method — URL to retrieve issuer certificate',
  },
  {
    oid: '1.3.6.1.5.5.7.3.1',
    name: 'TLS Web Server Authentication',
    category: 'ca-identifier',
    quantumVulnerable: false,
    quantumThreat: 'safe',
    pqcReplacement: null,
    description: 'Extended key usage for TLS web server identity verification',
  },
]

/**
 * Look up an OID classification from the database
 */
export function lookupOid(oid: string): OidClassification | null {
  return OID_DATABASE.find(entry => entry.oid === oid) || null
}

/**
 * Classify a signature algorithm name to its OID entry
 */
export function classifySignatureAlgorithm(sigAlg: string): OidClassification | null {
  const normalized = sigAlg.toLowerCase()

  // Map common signature algorithm names to OIDs
  const sigAlgMap: Record<string, string> = {
    'sha256withrsa': '1.2.840.113549.1.1.11',
    'sha256withrsaencryption': '1.2.840.113549.1.1.11',
    'sha384withrsa': '1.2.840.113549.1.1.12',
    'sha384withrsaencryption': '1.2.840.113549.1.1.12',
    'sha512withrsa': '1.2.840.113549.1.1.13',
    'sha512withrsaencryption': '1.2.840.113549.1.1.13',
    'sha1withrsa': '1.2.840.113549.1.1.5',
    'sha1withrsaencryption': '1.2.840.113549.1.1.5',
    'md5withrsa': '1.2.840.113549.1.1.4',
    'md5withrsaencryption': '1.2.840.113549.1.1.4',
    'rsassa-pss': '1.2.840.113549.1.1.10',
    'ecdsa-with-sha256': '1.2.840.10045.4.3.2',
    'ecdsa-with-sha384': '1.2.840.10045.4.3.3',
    'ecdsa-with-sha512': '1.2.840.10045.4.3.4',
    'ecdsa-with-sha1': '1.2.840.10045.4.1',
    'dsa-with-sha256': '2.16.840.1.101.3.4.3.2',
    'dsa-with-sha1': '1.2.840.10040.4.3',
    'rsa-sha256': '1.2.840.113549.1.1.11',
    'rsa-sha384': '1.2.840.113549.1.1.12',
    'rsa-sha512': '1.2.840.113549.1.1.13',
    'rsa-sha1': '1.2.840.113549.1.1.5',
  }

  const oid = sigAlgMap[normalized]
  if (oid) return lookupOid(oid)

  // Fuzzy match
  for (const entry of OID_DATABASE) {
    if (entry.name.toLowerCase() === normalized) return entry
  }

  return null
}

/**
 * Get all quantum-vulnerable OIDs
 */
export function getQuantumVulnerableOids(): OidClassification[] {
  return OID_DATABASE.filter(entry => entry.quantumVulnerable)
}

/**
 * Get all PQC OIDs (quantum-safe algorithms)
 */
export function getPqcOids(): OidClassification[] {
  return OID_DATABASE.filter(entry => entry.category === 'pqc')
}
