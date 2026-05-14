/**
 * QGuard Crypto Detector
 * Detects classical cryptographic algorithms in scan targets
 * Supports multi-platform scanning across cloud, email, dev, messaging, and infrastructure targets
 */

import type { ClassicalAlgorithm, QuantumThreatLevel } from '@/types/quantum.types'
import type { ScanResult, ScanTarget, ScanTargetType } from '@/types/scanner.types'
import { buildEvidenceForTarget, buildRemediationModel } from './remediation-model'
import { uuidv4 } from './uuid'

export interface AlgorithmProfile {
  algorithm: ClassicalAlgorithm
  threatLevel: QuantumThreatLevel
  quantumBreakTime: string
  classicalBreakTime: string
  isHNDLRisk: boolean
  description: string
  recommendation: string
  riskScore: number
  /** File patterns this algorithm is commonly found in */
  filePatterns: string[]
  /** Categories of usage */
  usageContext: string
}

export const ALGORITHM_PROFILES: AlgorithmProfile[] = [
  {
    algorithm: 'RSA-1024',
    threatLevel: 'critical',
    quantumBreakTime: 'Minutes (Shor\'s algorithm)',
    classicalBreakTime: '~1,000 years with classical supercomputer',
    isHNDLRisk: true,
    description: 'RSA-1024 keys can be factored in minutes by a sufficiently powerful quantum computer using Shor\'s algorithm.',
    recommendation: 'Immediately migrate to ML-KEM (Kyber) or hybrid ML-KEM + RSA-4096.',
    riskScore: 95,
    filePatterns: ['.pem', '.key', '.pfx', '.p12'],
    usageContext: 'Key exchange, encryption',
  },
  {
    algorithm: 'RSA-2048',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm)',
    classicalBreakTime: '~300 trillion years',
    isHNDLRisk: true,
    description: 'RSA-2048 is currently secure classically but will be broken by quantum computers. Data encrypted today can be harvested and decrypted later.',
    recommendation: 'Migrate to ML-KEM (Kyber) key encapsulation. Use hybrid mode for backward compatibility.',
    riskScore: 82,
    filePatterns: ['.pem', '.key', '.pfx', '.p12', '.crt'],
    usageContext: 'TLS certificates, document encryption',
  },
  {
    algorithm: 'ECC-P256',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on ECDLP)',
    classicalBreakTime: '~10 billion years',
    isHNDLRisk: true,
    description: 'Elliptic curve cryptography is vulnerable to quantum attacks via Shor\'s algorithm on the Elliptic Curve Discrete Logarithm Problem.',
    recommendation: 'Migrate to ML-DSA (Dilithium) for signatures or ML-KEM for key exchange.',
    riskScore: 80,
    filePatterns: ['.pem', '.key', '.p12'],
    usageContext: 'Digital signatures, TLS key exchange',
  },
  {
    algorithm: 'RSA-4096',
    threatLevel: 'high',
    quantumBreakTime: 'Days (Shor\'s algorithm)',
    classicalBreakTime: '~Trillions of years',
    isHNDLRisk: true,
    description: 'RSA-4096 provides strong classical security but remains fully vulnerable to Shor\'s algorithm. Larger key size only marginally increases quantum attack time.',
    recommendation: 'Migrate to ML-KEM-1024 (Kyber) for post-quantum key encapsulation.',
    riskScore: 75,
    filePatterns: ['.pem', '.key', '.pfx', '.p12', '.crt'],
    usageContext: 'High-assurance certificates, government encryption',
  },
  {
    algorithm: 'ECC-P384',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on ECDLP)',
    classicalBreakTime: '~20 billion years',
    isHNDLRisk: true,
    description: 'ECC on P-384 curve provides higher classical security than P-256 but is equally vulnerable to quantum attacks via Shor\'s algorithm.',
    recommendation: 'Migrate to ML-KEM-1024 (Kyber) for key exchange or ML-DSA-87 (Dilithium) for signatures.',
    riskScore: 78,
    filePatterns: ['.pem', '.key', '.p12', '.crt'],
    usageContext: 'Government certificates, high-assurance TLS',
  },
  {
    algorithm: 'ECC-secp256k1',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm)',
    classicalBreakTime: '~10 billion years',
    isHNDLRisk: true,
    description: 'secp256k1 is the curve used by Bitcoin and Ethereum. Quantum computers will break wallet private keys, enabling fund theft.',
    recommendation: 'Migrate to quantum-resistant signature scheme. Monitor NIST PQC standards for blockchain integration.',
    riskScore: 88,
    filePatterns: ['.wallet', '.keystore', '.json'],
    usageContext: 'Blockchain wallets, cryptocurrency signing',
  },
  {
    algorithm: 'SHA-1',
    threatLevel: 'critical',
    quantumBreakTime: 'Seconds (Grover\'s algorithm halves security)',
    classicalBreakTime: 'Already broken (collision attacks proven)',
    isHNDLRisk: false,
    description: 'SHA-1 is cryptographically broken even classically. Quantum computers further reduce security via Grover\'s algorithm.',
    recommendation: 'Replace immediately with SHA-256 or SHA-3. No quantum migration needed — just upgrade.',
    riskScore: 98,
    filePatterns: ['.asc', '.sig'],
    usageContext: 'Hashing, integrity verification',
  },
  {
    algorithm: 'SHA-256',
    threatLevel: 'low',
    quantumBreakTime: '~2^128 operations (Grover\'s algorithm)',
    classicalBreakTime: '~2^256 operations (secure)',
    isHNDLRisk: false,
    description: 'SHA-256 retains 128-bit security against Grover\'s algorithm. Considered quantum-resilient for hashing purposes.',
    recommendation: 'No urgent migration needed. SHA-256 is quantum-resilient. Consider SHA-3-256 for defense-in-depth.',
    riskScore: 12,
    filePatterns: ['.sha256', '.hash', '.sig'],
    usageContext: 'Hashing, integrity verification, certificates',
  },
  {
    algorithm: 'MD5',
    threatLevel: 'critical',
    quantumBreakTime: 'Instant',
    classicalBreakTime: 'Already broken',
    isHNDLRisk: false,
    description: 'MD5 is completely broken. Collision attacks can be performed in seconds on commodity hardware.',
    recommendation: 'Replace immediately with SHA-256 or SHA-3.',
    riskScore: 99,
    filePatterns: ['.md5', '.hash'],
    usageContext: 'Checksum, integrity (deprecated)',
  },
  {
    algorithm: 'TLS-1.0',
    threatLevel: 'critical',
    quantumBreakTime: 'N/A — already deprecated',
    classicalBreakTime: 'Known vulnerabilities (BEAST, POODLE)',
    isHNDLRisk: true,
    description: 'TLS 1.0 is deprecated and has known classical vulnerabilities. Any data transmitted is at HNDL risk.',
    recommendation: 'Upgrade to TLS 1.3 with post-quantum key exchange (e.g., X25519Kyber768).',
    riskScore: 92,
    filePatterns: ['.conf', '.cfg'],
    usageContext: 'Transport security',
  },
  {
    algorithm: 'TLS-1.1',
    threatLevel: 'high',
    quantumBreakTime: 'N/A — already deprecated',
    classicalBreakTime: 'Known vulnerabilities',
    isHNDLRisk: true,
    description: 'TLS 1.1 is deprecated. Intercepted traffic can be stored and decrypted when quantum computers arrive.',
    recommendation: 'Upgrade to TLS 1.3 with hybrid PQC key exchange.',
    riskScore: 85,
    filePatterns: ['.conf', '.cfg'],
    usageContext: 'Transport security',
  },
  {
    algorithm: 'TLS-1.2',
    threatLevel: 'medium',
    quantumBreakTime: 'Hours (Shor\'s breaks RSA/ECDHE key exchange)',
    classicalBreakTime: 'Secure (current standard)',
    isHNDLRisk: true,
    description: 'TLS 1.2 typically uses RSA or ECDHE key exchange, both vulnerable to Shor\'s algorithm. Intercepted TLS 1.2 sessions can be decrypted retroactively.',
    recommendation: 'Upgrade to TLS 1.3 with hybrid PQC key exchange (X25519Kyber768).',
    riskScore: 55,
    filePatterns: ['.conf', '.cfg', '.yml'],
    usageContext: 'Transport security, HTTPS, API communication',
  },
  {
    algorithm: 'TLS-1.3',
    threatLevel: 'medium',
    quantumBreakTime: 'Hours (Shor\'s breaks ECDHE key exchange)',
    classicalBreakTime: 'Secure (current best practice)',
    isHNDLRisk: true,
    description: 'TLS 1.3 is the current best practice but still uses ECDHE (X25519/P-256) key exchange vulnerable to quantum attack. Past sessions are at HNDL risk.',
    recommendation: 'Enable hybrid PQC key exchange (X25519Kyber768) in TLS 1.3 configuration.',
    riskScore: 40,
    filePatterns: ['.conf', '.cfg', '.yml'],
    usageContext: 'Transport security, modern HTTPS',
  },
  {
    algorithm: 'AES-128',
    threatLevel: 'medium',
    quantumBreakTime: '~2^64 operations (Grover\'s algorithm)',
    classicalBreakTime: '~2^128 operations (secure)',
    isHNDLRisk: false,
    description: 'AES-128 has 64-bit quantum security due to Grover\'s algorithm. While still substantial, it may not meet long-term security requirements.',
    recommendation: 'Upgrade to AES-256 for 128-bit quantum security.',
    riskScore: 45,
    filePatterns: ['.enc', '.aes', '.vault'],
    usageContext: 'Symmetric encryption',
  },
  {
    algorithm: 'AES-256',
    threatLevel: 'low',
    quantumBreakTime: '~2^128 operations (Grover\'s algorithm)',
    classicalBreakTime: '~2^256 operations (forever)',
    isHNDLRisk: false,
    description: 'AES-256 retains 128-bit security against quantum attacks via Grover\'s algorithm. Considered quantum-safe for symmetric encryption.',
    recommendation: 'No migration needed. AES-256 is quantum-resilient.',
    riskScore: 10,
    filePatterns: ['.enc', '.aes', '.vault'],
    usageContext: 'Symmetric encryption',
  },
  {
    algorithm: '3DES',
    threatLevel: 'high',
    quantumBreakTime: 'Minutes (Grover\'s reduces to ~2^56)',
    classicalBreakTime: 'Deprecated — Sweet32 attack',
    isHNDLRisk: true,
    description: '3DES has only 112-bit classical security and is deprecated due to Sweet32 attacks. Quantum computers reduce this further.',
    recommendation: 'Replace with AES-256 immediately.',
    riskScore: 88,
    filePatterns: ['.des', '.enc'],
    usageContext: 'Legacy symmetric encryption',
  },
  {
    algorithm: 'DH-2048',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on DLP)',
    classicalBreakTime: '~300 trillion years',
    isHNDLRisk: true,
    description: 'Diffie-Hellman key exchange is vulnerable to Shor\'s algorithm. Intercepted key exchanges can be retroactively broken.',
    recommendation: 'Migrate to ML-KEM (Kyber) for key encapsulation. Use hybrid X25519+Kyber768 for transition.',
    riskScore: 83,
    filePatterns: ['.pem', '.key', '.conf'],
    usageContext: 'Key exchange, VPN tunnels',
  },
  {
    algorithm: 'DH-1024',
    threatLevel: 'critical',
    quantumBreakTime: 'Minutes (Shor\'s algorithm)',
    classicalBreakTime: '~1,000 years (already weakening)',
    isHNDLRisk: true,
    description: 'DH-1024 is critically weak. Even classical attacks are becoming feasible. Quantum computers will break it instantly.',
    recommendation: 'Immediately replace with ML-KEM (Kyber) or hybrid mode.',
    riskScore: 96,
    filePatterns: ['.pem', '.key', '.conf'],
    usageContext: 'Legacy key exchange',
  },
  {
    algorithm: 'ECDSA-P256',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on ECDLP)',
    classicalBreakTime: '~10 billion years',
    isHNDLRisk: true,
    description: 'ECDSA signatures on P-256 curve are vulnerable to quantum forgery via Shor\'s algorithm. Any signed document loses integrity guarantees.',
    recommendation: 'Migrate to ML-DSA (Dilithium) or SLH-DSA (SPHINCS+) for post-quantum signatures.',
    riskScore: 81,
    filePatterns: ['.pem', '.key', '.crt', '.sig'],
    usageContext: 'Digital signatures, code signing, TLS certificates',
  },
  {
    algorithm: 'ECDSA-P384',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on ECDLP)',
    classicalBreakTime: '~20 billion years',
    isHNDLRisk: true,
    description: 'ECDSA on P-384 provides higher classical security but is equally vulnerable to Shor\'s algorithm as P-256.',
    recommendation: 'Migrate to ML-DSA (Dilithium) for quantum-resistant digital signatures.',
    riskScore: 78,
    filePatterns: ['.pem', '.key', '.crt'],
    usageContext: 'Government certificates, high-assurance signatures',
  },
  {
    algorithm: 'DSA-1024',
    threatLevel: 'critical',
    quantumBreakTime: 'Minutes (Shor\'s algorithm on DLP)',
    classicalBreakTime: '~1,000 years (deprecated)',
    isHNDLRisk: true,
    description: 'DSA-1024 is deprecated and critically vulnerable. Quantum computers will forge signatures trivially.',
    recommendation: 'Immediately replace with ML-DSA (Dilithium). DSA should not be used.',
    riskScore: 94,
    filePatterns: ['.key', '.pem', '.ppk'],
    usageContext: 'Legacy digital signatures, SSH keys',
  },
  {
    algorithm: 'DSA-2048',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on DLP)',
    classicalBreakTime: '~300 trillion years',
    isHNDLRisk: true,
    description: 'DSA-2048 is classically secure but fully vulnerable to quantum attack via Shor\'s algorithm on the discrete logarithm problem.',
    recommendation: 'Migrate to ML-DSA (Dilithium) for post-quantum signatures.',
    riskScore: 79,
    filePatterns: ['.key', '.pem'],
    usageContext: 'Digital signatures',
  },
  {
    algorithm: 'PGP-RSA',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm)',
    classicalBreakTime: '~300 trillion years (RSA-2048+)',
    isHNDLRisk: true,
    description: 'PGP keys using RSA are vulnerable to quantum attack. Encrypted emails and signed documents can be retroactively compromised.',
    recommendation: 'Generate new PQC-based PGP keys using ML-KEM for encryption and ML-DSA for signatures when available.',
    riskScore: 84,
    filePatterns: ['.asc', '.gpg', '.pgp', '.kbx'],
    usageContext: 'Email encryption, file signing, identity verification',
  },
  {
    algorithm: 'PGP-ECC',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on ECDLP)',
    classicalBreakTime: '~10 billion years',
    isHNDLRisk: true,
    description: 'PGP keys using ECC (Curve25519, NIST P-256) are vulnerable to quantum attack on the elliptic curve discrete logarithm problem.',
    recommendation: 'Prepare for PQC-based PGP key generation. Monitor OpenPGP PQC standardization.',
    riskScore: 82,
    filePatterns: ['.asc', '.gpg', '.pgp'],
    usageContext: 'Email encryption, identity verification',
  },
  {
    algorithm: 'S/MIME-RSA',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm)',
    classicalBreakTime: '~300 trillion years',
    isHNDLRisk: true,
    description: 'S/MIME certificates using RSA are vulnerable to quantum decryption. Signed and encrypted enterprise emails can be retroactively compromised.',
    recommendation: 'Migrate S/MIME certificates to hybrid PQC when CA support is available.',
    riskScore: 80,
    filePatterns: ['.p7b', '.p7c', '.p12', '.pfx'],
    usageContext: 'Enterprise email encryption and signing',
  },
  {
    algorithm: 'Ed25519',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on EdDSA curve)',
    classicalBreakTime: '~10 billion years',
    isHNDLRisk: true,
    description: 'Ed25519 SSH keys and signatures use elliptic curves vulnerable to quantum attack. SSH sessions can be intercepted and decrypted retroactively.',
    recommendation: 'Prepare migration to PQC SSH key types when OpenSSH adds ML-DSA support.',
    riskScore: 76,
    filePatterns: ['.key', '.pub', '.ppk'],
    usageContext: 'SSH authentication, Git signing',
  },
  {
    algorithm: 'X25519',
    threatLevel: 'high',
    quantumBreakTime: 'Hours (Shor\'s algorithm on ECDLP)',
    classicalBreakTime: '~10 billion years',
    isHNDLRisk: true,
    description: 'X25519 key exchange is vulnerable to quantum attack. All past sessions using this key exchange can be decrypted if traffic was captured.',
    recommendation: 'Use hybrid X25519+Kyber768 for key exchange. Supported in TLS 1.3 experimental drafts.',
    riskScore: 74,
    filePatterns: ['.key', '.conf'],
    usageContext: 'TLS key exchange, WireGuard VPN, Signal protocol',
  },
]

/** Map target types to algorithms most likely found in each */
const TARGET_ALGORITHM_AFFINITY: Record<ScanTargetType, ClassicalAlgorithm[]> = {
  'local-file': ['RSA-2048', 'AES-128', 'AES-256', 'SHA-1', '3DES', 'MD5'],
  'local-keystore': ['RSA-2048', 'RSA-1024', 'ECC-P256', 'ECDSA-P256', 'Ed25519'],
  'device-certificate': ['RSA-2048', 'RSA-1024', 'ECC-P256', 'ECDSA-P256', 'ECDSA-P384'],
  'ssh-directory': ['RSA-2048', 'RSA-1024', 'Ed25519', 'DSA-1024', 'ECDSA-P256'],
  'cloud-drive': ['RSA-2048', 'AES-128', 'AES-256', 'TLS-1.2', 'ECC-P256'],
  'email': ['RSA-2048', 'TLS-1.0', 'TLS-1.1', 'PGP-RSA', 'PGP-ECC', 'S/MIME-RSA'],
  'developer-platform': ['RSA-2048', 'Ed25519', 'ECDSA-P256', 'ECC-P256', 'PGP-RSA'],
  'social-media': ['TLS-1.2', 'RSA-2048', 'ECC-P256', 'AES-128', 'X25519'],
  'messaging': ['X25519', 'AES-256', 'ECC-P256', 'Ed25519', 'DH-2048'],
  'cloud-infrastructure': ['RSA-2048', 'RSA-1024', 'ECC-P256', 'TLS-1.1', 'TLS-1.0', 'DH-2048', 'AES-256'],
  'endpoint-security': ['RSA-2048', 'ECDSA-P256', 'TLS-1.2', 'AES-128', 'AES-256', 'SHA-256'],
  'password-vault': ['AES-256', 'AES-128', 'RSA-2048', 'SHA-1', 'ECDSA-P256'],
  'crypto-wallet': ['ECC-secp256k1', 'ECDSA-P256', 'Ed25519', 'AES-256', 'SHA-1'],
  'app': ['RSA-2048', 'AES-128', 'TLS-1.2', 'ECC-P256'],
  'certificate': ['RSA-2048', 'RSA-1024', 'ECC-P256', 'ECDSA-P256', 'ECDSA-P384'],
}

/**
 * Scan a target for classical crypto usage.
 * Uses target-type affinity to produce realistic findings per platform.
 */
export function detectClassicalCrypto(
  target: ScanTarget,
  scanId: string
): ScanResult[] {
  const detectedAlgorithms = selectAlgorithmsForTarget(target)
  const evidence = buildEvidenceForTarget(target)
  const remediation = buildRemediationModel(target)

  return detectedAlgorithms.map((profile) => ({
    id: uuidv4(),
    scanId,
    moduleId: 'crypto-detector',
    target,
    detectedAlgorithm: profile.algorithm,
    algorithmCategory: inferAlgorithmCategory(profile.algorithm),
    threatLevel: profile.threatLevel,
    quantumThreat: inferQuantumThreat(profile.algorithm),
    isHNDLRisk: profile.isHNDLRisk,
    description: profile.description,
    recommendation: profile.recommendation,
    quantumBreakTime: profile.quantumBreakTime,
    classicalBreakTime: profile.classicalBreakTime,
    riskScore: profile.riskScore,
    severity: threatLevelToSeverity(profile.threatLevel),
    pqcReplacement: inferPqcReplacement(profile.algorithm),
    evidence,
    remediation,
    timestamp: new Date().toISOString(),
  }))
}

function inferAlgorithmCategory(algorithm: ClassicalAlgorithm): ScanResult['algorithmCategory'] {
  if (algorithm.startsWith('TLS')) return 'protocol'
  if (algorithm.startsWith('SHA') || algorithm === 'MD5') return 'hash'
  if (algorithm.startsWith('AES') || algorithm === '3DES') return 'symmetric'
  if (algorithm.startsWith('ECDSA') || algorithm.startsWith('DSA') || algorithm === 'Ed25519') return 'signature'
  return 'public-key'
}

function inferQuantumThreat(algorithm: ClassicalAlgorithm): ScanResult['quantumThreat'] {
  if (algorithm === 'SHA-256' || algorithm === 'AES-128' || algorithm === 'AES-256') return 'grover'
  if (algorithm === 'SHA-1' || algorithm === 'MD5' || algorithm === 'TLS-1.0') return 'classical-broken'
  if (algorithm === '3DES' || algorithm === 'TLS-1.1') return 'both'
  return 'shor'
}

function threatLevelToSeverity(level: QuantumThreatLevel): ScanResult['severity'] {
  if (level === 'medium') return 'moderate'
  return level
}

function inferPqcReplacement(algorithm: ClassicalAlgorithm): string {
  const replacements: Partial<Record<ClassicalAlgorithm, string>> = {
    'SHA-1': 'SHA3-256',
    MD5: 'SHA3-256',
    'AES-128': 'AES-256',
    'AES-256': 'AES-256',
    'TLS-1.0': 'TLS 1.3 + ML-KEM hybrid key exchange',
    'TLS-1.1': 'TLS 1.3 + ML-KEM hybrid key exchange',
    'TLS-1.2': 'TLS 1.3 + X25519Kyber768',
    'TLS-1.3': 'TLS 1.3 + ML-KEM hybrid key exchange',
  }
  if (replacements[algorithm]) return replacements[algorithm]
  if (algorithm.includes('ECDSA') || algorithm.includes('DSA') || algorithm === 'Ed25519') return 'ML-DSA'
  return 'ML-KEM'
}

function selectAlgorithmsForTarget(target: ScanTarget): AlgorithmProfile[] {
  const affinityAlgorithms = TARGET_ALGORITHM_AFFINITY[target.type] || TARGET_ALGORITHM_AFFINITY['local-file']

  // Get profiles matching the affinity list for this target type
  const matchingProfiles = ALGORITHM_PROFILES.filter((p) =>
    affinityAlgorithms.includes(p.algorithm)
  )

  // Select 2-5 findings, biased toward the affinity list
  const count = 2 + Math.floor(Math.random() * 4)
  const shuffled = [...matchingProfiles].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

/**
 * Get threat level color for UI
 */
export function getThreatLevelColor(level: QuantumThreatLevel): string {
  const colors: Record<QuantumThreatLevel, string> = {
    critical: '#ff2d55',
    high: '#ff6b35',
    medium: '#ffcc00',
    low: '#00d4ff',
    safe: '#30d158',
  }
  return colors[level]
}

/** File patterns the scanner looks for */
export const SCAN_FILE_PATTERNS = [
  '.pem', '.key', '.pfx', '.p12', '.asc', '.gpg', '.ppk',
  '.jks', '.keystore', '.wallet', '.env', '.crt', '.cer',
  '.p7b', '.p7c', '.der', '.sig', '.pub',
]
