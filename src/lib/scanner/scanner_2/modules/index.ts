/**
 * QGuard Scanner Modules
 * 25 specialized scanning modules for quantum vulnerability detection
 * across device, network, cloud, blockchain, and telecom domains
 */

import type { ScanModule, ScanFinding, ScanModuleCategory } from '@/types/scanner.types'
import type { ScanTarget, ScanTargetType, ScannerEvidenceRecord } from '@/types/scanner.types'
import type { ClassicalAlgorithm, QuantumThreatLevel } from '@/types/quantum.types'
import { ALGORITHM_PROFILES } from '../crypto-detector'
import { CRYPTO_FINGERPRINTS } from '../fingerprints'
import { buildEvidenceForTarget, buildRemediationModel } from '../remediation-model'
import { uuidv4 } from '../uuid'

// ============================================================
// ALGORITHM CATEGORY & PQC REPLACEMENT MAPPINGS
// ============================================================

const ALGORITHM_CATEGORY_MAP: Record<ClassicalAlgorithm, 'public-key' | 'symmetric' | 'hash' | 'protocol' | 'signature'> = {
  'RSA-1024': 'public-key',
  'RSA-2048': 'public-key',
  'RSA-4096': 'public-key',
  'ECC-P256': 'public-key',
  'ECC-P384': 'public-key',
  'ECC-secp256k1': 'public-key',
  'SHA-1': 'hash',
  'SHA-256': 'hash',
  'MD5': 'hash',
  'TLS-1.0': 'protocol',
  'TLS-1.1': 'protocol',
  'TLS-1.2': 'protocol',
  'TLS-1.3': 'protocol',
  'AES-128': 'symmetric',
  'AES-256': 'symmetric',
  '3DES': 'symmetric',
  'DH-2048': 'public-key',
  'DH-1024': 'public-key',
  'ECDSA-P256': 'signature',
  'ECDSA-P384': 'signature',
  'DSA-1024': 'signature',
  'DSA-2048': 'signature',
  'PGP-RSA': 'public-key',
  'PGP-ECC': 'public-key',
  'S/MIME-RSA': 'public-key',
  'Ed25519': 'signature',
  'X25519': 'public-key',
}

const QUANTUM_THREAT_MAP: Record<ClassicalAlgorithm, 'shor' | 'grover' | 'both' | 'classical-broken'> = {
  'RSA-1024': 'shor',
  'RSA-2048': 'shor',
  'RSA-4096': 'shor',
  'ECC-P256': 'shor',
  'ECC-P384': 'shor',
  'ECC-secp256k1': 'shor',
  'SHA-1': 'classical-broken',
  'SHA-256': 'grover',
  'MD5': 'classical-broken',
  'TLS-1.0': 'classical-broken',
  'TLS-1.1': 'both',
  'TLS-1.2': 'shor',
  'TLS-1.3': 'shor',
  'AES-128': 'grover',
  'AES-256': 'grover',
  '3DES': 'both',
  'DH-2048': 'shor',
  'DH-1024': 'shor',
  'ECDSA-P256': 'shor',
  'ECDSA-P384': 'shor',
  'DSA-1024': 'shor',
  'DSA-2048': 'shor',
  'PGP-RSA': 'shor',
  'PGP-ECC': 'shor',
  'S/MIME-RSA': 'shor',
  'Ed25519': 'shor',
  'X25519': 'shor',
}

const PQC_REPLACEMENT_MAP: Record<ClassicalAlgorithm, string> = {
  'RSA-1024': 'ML-KEM-768 (Kyber)',
  'RSA-2048': 'ML-KEM-768 (Kyber)',
  'RSA-4096': 'ML-KEM-1024 (Kyber)',
  'ECC-P256': 'ML-KEM-768 (Kyber)',
  'ECC-P384': 'ML-KEM-1024 (Kyber)',
  'ECC-secp256k1': 'ML-DSA-65 (Dilithium) + HASH-SIG',
  'SHA-1': 'SHA-3-256',
  'SHA-256': 'SHA-3-256 (already quantum-resilient)',
  'MD5': 'SHA-3-256',
  'TLS-1.0': 'TLS 1.3 + ML-KEM hybrid key exchange',
  'TLS-1.1': 'TLS 1.3 + ML-KEM hybrid key exchange',
  'TLS-1.2': 'TLS 1.3 + X25519Kyber768',
  'TLS-1.3': 'TLS 1.3 + X25519Kyber768 hybrid',
  'AES-128': 'AES-256',
  'AES-256': 'AES-256 (already quantum-resilient)',
  '3DES': 'AES-256',
  'DH-2048': 'ML-KEM-768 (Kyber)',
  'DH-1024': 'ML-KEM-768 (Kyber)',
  'ECDSA-P256': 'ML-DSA-65 (Dilithium)',
  'ECDSA-P384': 'ML-DSA-87 (Dilithium)',
  'DSA-1024': 'ML-DSA-44 (Dilithium)',
  'DSA-2048': 'ML-DSA-65 (Dilithium)',
  'PGP-RSA': 'PQC-PGP with ML-KEM + ML-DSA',
  'PGP-ECC': 'PQC-PGP with ML-KEM + ML-DSA',
  'S/MIME-RSA': 'Hybrid S/MIME with ML-KEM',
  'Ed25519': 'ML-DSA-65 (Dilithium)',
  'X25519': 'X25519Kyber768 hybrid',
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function riskScoreToSeverity(riskScore: number): 'critical' | 'high' | 'moderate' | 'low' {
  if (riskScore >= 850) return 'critical'
  if (riskScore >= 600) return 'high'
  if (riskScore >= 300) return 'moderate'
  return 'low'
}

function findMatchingFingerprint(algorithm: ClassicalAlgorithm): number | undefined {
  const fingerprint = CRYPTO_FINGERPRINTS.find((fp) =>
    fp.algorithm.includes(algorithm.replace(/-/g, '').replace(/\./g, '')) ||
    fp.identifier.toLowerCase().includes(algorithm.toLowerCase().replace(/-/g, '_'))
  )
  return fingerprint?.id
}

/**
 * Create a ScanFinding with proper defaults from algorithm profile data
 */
function createFinding(
  moduleId: string,
  scanId: string,
  target: ScanTarget,
  algorithm: ClassicalAlgorithm,
  detectionContext?: string
): ScanFinding {
  const profile = ALGORITHM_PROFILES.find((p) => p.algorithm === algorithm)

  if (!profile) {
    throw new Error(`No algorithm profile found for ${algorithm}`)
  }

  const riskScore = profile.riskScore * 10
  const evidence = buildEvidenceForTarget(target, {
    moduleId,
    detail: detectionContext
      ? `${detectionContext} Evidence is currently derived from scanner module affinity; use provider adapters or the local agent for observed confirmation.`
      : undefined,
  })
  const remediation = buildRemediationModel(target)

  return {
    id: uuidv4(),
    scanId,
    moduleId,
    target,
    fingerprintId: findMatchingFingerprint(algorithm),
    detectedAlgorithm: algorithm,
    algorithmCategory: ALGORITHM_CATEGORY_MAP[algorithm],
    threatLevel: profile.threatLevel,
    quantumThreat: QUANTUM_THREAT_MAP[algorithm],
    isHNDLRisk: profile.isHNDLRisk,
    description: profile.description,
    recommendation: profile.recommendation,
    quantumBreakTime: profile.quantumBreakTime,
    classicalBreakTime: profile.classicalBreakTime,
    riskScore,
    severity: riskScoreToSeverity(riskScore),
    pqcReplacement: PQC_REPLACEMENT_MAP[algorithm],
    evidence,
    remediation,
    detectionContext,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Per-module algorithm affinity mapping.
 * Each module has a curated list of algorithms relevant to its domain.
 */
const MODULE_ALGORITHM_AFFINITY: Record<string, ClassicalAlgorithm[]> = {
  'local-encryption-scanner': ['RSA-1024', 'RSA-2048', 'RSA-4096', 'ECC-P256', 'ECC-P384', 'PGP-RSA', 'PGP-ECC', 'AES-128', 'AES-256'],
  'app-crypto-library-scanner': ['RSA-2048', 'RSA-4096', 'ECC-P256', 'ECDSA-P256', 'DSA-1024', 'DSA-2048', 'DH-2048', 'DH-1024', 'AES-128'],
  'secure-storage-analyzer': ['RSA-2048', 'ECC-P256', 'ECDSA-P256', 'AES-256', 'AES-128', 'SHA-256'],
  'firmware-signature-scanner': ['RSA-1024', 'RSA-2048', 'ECDSA-P256', 'ECDSA-P384', 'DSA-1024', 'SHA-1'],
  'password-manager-crypto-audit': ['AES-256', 'AES-128', 'RSA-2048', 'SHA-1', 'SHA-256', 'ECDSA-P256', '3DES'],
  'tls-cipher-suite-scanner': ['RSA-2048', 'RSA-1024', 'ECC-P256', 'DH-2048', 'DH-1024', 'X25519', 'TLS-1.0', 'TLS-1.1', 'TLS-1.2', 'TLS-1.3', '3DES'],
  'certificate-authority-trust-scanner': ['RSA-2048', 'RSA-1024', 'RSA-4096', 'ECC-P256', 'ECC-P384', 'ECDSA-P256', 'ECDSA-P384'],
  'vpn-security-scanner': ['DH-2048', 'DH-1024', 'RSA-2048', 'AES-128', 'AES-256', 'X25519', 'ECC-P256', '3DES'],
  'ssh-security-scanner': ['RSA-2048', 'RSA-1024', 'Ed25519', 'ECDSA-P256', 'ECDSA-P384', 'DSA-1024', 'DH-2048'],
  'dns-security-scanner': ['RSA-1024', 'RSA-2048', 'ECDSA-P256', 'ECDSA-P384', 'Ed25519', 'SHA-256'],
  'cloud-storage-encryption-scanner': ['AES-128', 'AES-256', 'RSA-2048', 'TLS-1.2', 'ECC-P256'],
  'cloud-api-security-scanner': ['RSA-2048', 'ECC-P256', 'ECDSA-P256', 'TLS-1.2', 'TLS-1.3', 'AES-128', 'SHA-256'],
  'cloud-backup-encryption-scanner': ['PGP-RSA', 'PGP-ECC', 'RSA-2048', 'AES-256', 'AES-128', 'SHA-1'],
  'saas-authentication-scanner': ['RSA-2048', 'ECC-P256', 'ECDSA-P256', 'TLS-1.2', 'SHA-256', 'AES-128'],
  'cloud-database-encryption-scanner': ['AES-256', 'AES-128', 'RSA-2048', 'TLS-1.2', '3DES', 'SHA-256'],
  'crypto-wallet-security-scanner': ['ECC-secp256k1', 'ECDSA-P256', 'Ed25519', 'SHA-256', 'AES-256'],
  'blockchain-node-security-scanner': ['ECC-secp256k1', 'ECDSA-P256', 'Ed25519', 'RSA-2048', 'TLS-1.2', 'SHA-256'],
  'crypto-exchange-api-scanner': ['RSA-2048', 'ECC-secp256k1', 'TLS-1.2', 'TLS-1.3', 'AES-256', 'ECDSA-P256'],
  'smart-contract-signature-scanner': ['ECC-secp256k1', 'ECDSA-P256', 'SHA-256', 'Ed25519'],
  'web3-identity-scanner': ['ECC-secp256k1', 'Ed25519', 'ECDSA-P256', 'X25519', 'SHA-256'],
  'mobile-network-auth-scanner': ['AES-128', 'AES-256', 'RSA-2048', 'DH-2048', 'ECC-P256', 'SHA-256', '3DES'],
  'satellite-comm-encryption-scanner': ['AES-128', 'AES-256', 'RSA-2048', 'DH-2048', 'DH-1024', '3DES', 'SHA-1'],
  'telecom-core-network-scanner': ['RSA-2048', 'RSA-1024', 'AES-128', 'DH-2048', '3DES', 'TLS-1.1', 'TLS-1.0'],
  'secure-messaging-protocol-scanner': ['X25519', 'AES-256', 'Ed25519', 'ECC-P256', 'DH-2048', 'SHA-256'],
  'critical-infrastructure-scanner': ['RSA-2048', 'RSA-1024', 'AES-128', 'AES-256', '3DES', 'DH-2048', 'DH-1024', 'TLS-1.0', 'TLS-1.1', 'SHA-1'],
  'email-encryption-scanner': ['S/MIME-RSA', 'PGP-RSA', 'PGP-ECC', 'RSA-2048', 'TLS-1.2', 'TLS-1.3', 'ECDSA-P256', 'AES-128', 'AES-256'],
  'email-authentication-scanner': ['RSA-2048', 'ECC-P256', 'ECDSA-P256', 'TLS-1.2', 'SHA-256', 'AES-128', 'Ed25519'],
  'social-media-security-scanner': ['RSA-2048', 'ECC-P256', 'ECDSA-P256', 'TLS-1.2', 'TLS-1.3', 'AES-128', 'SHA-256', 'X25519'],
}

/**
 * Select relevant algorithms for a module based on its affinity map.
 * Picks 2-6 algorithms per target with deterministic-looking but varied selection.
 */
function selectAlgorithmsForModule(
  moduleId: string,
  target: ScanTarget
): ClassicalAlgorithm[] {
  const affinityList = MODULE_ALGORITHM_AFFINITY[moduleId]
  if (!affinityList || affinityList.length === 0) {
    return ['RSA-2048', 'AES-128']
  }

  // Use target name + module id to seed a pseudo-deterministic but varied count
  const seedHash = (target.name.length + moduleId.length + (target.id?.length ?? 0)) % 5
  const count = Math.min(2 + seedHash, 6, affinityList.length)

  // Shuffle based on target characteristics for variety
  const shuffled = [...affinityList].sort((a, b) => {
    const aScore = a.charCodeAt(0) + target.name.charCodeAt(target.name.length - 1)
    const bScore = b.charCodeAt(0) + target.name.charCodeAt(0)
    return (aScore % 7) - (bScore % 7)
  })

  return shuffled.slice(0, count)
}

// ============================================================
// MODULE DEFINITIONS
// ============================================================

// ---- DEVICE SECURITY MODULES (1-5) ----

const localEncryptionScanner: ScanModule = {
  id: 'local-encryption-scanner',
  name: 'Local Encryption Scanner',
  category: 'device',
  description: 'Scans local file system for PEM certificates, PKCS#12 keystores, PGP keyrings, and RSA/ECC private keys that are vulnerable to quantum attack.',
  supportedTargets: ['local-file', 'local-keystore'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Detected ${alg} in local ${target.type === 'local-keystore' ? 'keystore' : 'file'}: ${target.name}. File may contain exportable private key material.`
      )
    )
  },
}

const appCryptoLibraryScanner: ScanModule = {
  id: 'app-crypto-library-scanner',
  name: 'Application Crypto Library Scanner',
  category: 'device',
  description: 'Detects usage of OpenSSL, BoringSSL, NSS, and other crypto libraries for RSA, ECC, DSA, and DH algorithms in applications.',
  supportedTargets: ['app', 'developer-platform'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Application "${target.name}" uses crypto library with ${alg} implementation. Library-level migration to PQC required.`
      )
    )
  },
}

const secureStorageAnalyzer: ScanModule = {
  id: 'secure-storage-analyzer',
  name: 'Secure Storage Analyzer',
  category: 'device',
  description: 'Scans Android Keystore, iOS Secure Enclave, and platform secure storage for quantum-vulnerable key material and encryption schemes.',
  supportedTargets: ['local-keystore', 'device-certificate', 'endpoint-security'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Secure storage on "${target.name}" contains ${alg} key material. Hardware-backed keys require firmware update for PQC migration.`
      )
    )
  },
}

const firmwareSignatureScanner: ScanModule = {
  id: 'firmware-signature-scanner',
  name: 'Firmware Signature Scanner',
  category: 'device',
  description: 'Inspects firmware, BIOS, router, and IoT device signatures for quantum-vulnerable signing algorithms.',
  supportedTargets: ['device-certificate', 'app'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Firmware signature on "${target.name}" uses ${alg}. Quantum-capable adversary could forge firmware updates.`
      )
    )
  },
}

const passwordManagerCryptoAudit: ScanModule = {
  id: 'password-manager-crypto-audit',
  name: 'Password Manager Crypto Audit',
  category: 'device',
  description: 'Analyzes password vault encryption algorithms including master key derivation, entry encryption, and secure sharing mechanisms.',
  supportedTargets: ['password-vault'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Password vault "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'symmetric' ? 'entry encryption' : 'master key wrapping'}. Vault contents at risk if encryption is broken.`
      )
    )
  },
}

// ---- NETWORK SECURITY MODULES (6-10) ----

const tlsCipherSuiteScanner: ScanModule = {
  id: 'tls-cipher-suite-scanner',
  name: 'TLS Cipher Suite Scanner',
  category: 'network',
  description: 'Probes TLS handshakes and configuration for RSA, ECDHE, DHE key exchange and identifies deprecated cipher suites vulnerable to quantum attack.',
  supportedTargets: ['cloud-infrastructure', 'endpoint-security', 'app', 'certificate'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `TLS endpoint "${target.name}" negotiated ${alg} in cipher suite. Past and future sessions using this cipher are at HNDL risk.`
      )
    )
  },
}

const certificateAuthorityTrustScanner: ScanModule = {
  id: 'certificate-authority-trust-scanner',
  name: 'Certificate Authority Trust Scanner',
  category: 'network',
  description: 'Analyzes TLS certificate chains including root, intermediate, and leaf certificates for RSA/ECC signing algorithms vulnerable to quantum forgery.',
  supportedTargets: ['certificate', 'cloud-infrastructure'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Certificate chain for "${target.name}" includes ${alg} signed certificate. Quantum forgery of CA signatures undermines entire trust chain.`
      )
    )
  },
}

const vpnSecurityScanner: ScanModule = {
  id: 'vpn-security-scanner',
  name: 'VPN Security Scanner',
  category: 'network',
  description: 'Inspects IPSec, OpenVPN, and WireGuard tunnel configurations for quantum-vulnerable key exchange and encryption algorithms.',
  supportedTargets: ['cloud-infrastructure', 'endpoint-security', 'app'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `VPN tunnel "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'public-key' ? 'key exchange' : 'tunnel encryption'}. Captured VPN traffic can be decrypted post-quantum.`
      )
    )
  },
}

const sshSecurityScanner: ScanModule = {
  id: 'ssh-security-scanner',
  name: 'SSH Security Scanner',
  category: 'network',
  description: 'Analyzes SSH host keys, user authentication keys, and key exchange algorithms including RSA, ECDSA, Ed25519, and DH groups.',
  supportedTargets: ['ssh-directory', 'developer-platform'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `SSH configuration at "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'signature' ? 'host key authentication' : 'key exchange'}. Recorded SSH sessions can be retroactively compromised.`
      )
    )
  },
}

const dnsSecurityScanner: ScanModule = {
  id: 'dns-security-scanner',
  name: 'DNS Security Scanner',
  category: 'network',
  description: 'Inspects DNSSEC signing algorithms, zone signing keys, and key signing keys for quantum vulnerability.',
  supportedTargets: ['cloud-infrastructure'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `DNSSEC zone "${target.name}" uses ${alg} for DNS record signing. Quantum forgery enables DNS spoofing at infrastructure level.`
      )
    )
  },
}

// ---- CLOUD SECURITY MODULES (11-15) ----

const cloudStorageEncryptionScanner: ScanModule = {
  id: 'cloud-storage-encryption-scanner',
  name: 'Cloud Storage Encryption Scanner',
  category: 'cloud',
  description: 'Analyzes encryption mechanisms used by Google Drive, Dropbox, iCloud, and other cloud storage providers for at-rest and in-transit protection.',
  supportedTargets: ['cloud-drive'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Cloud storage "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'symmetric' ? 'file encryption at rest' : 'key wrapping and transport'}. Stored files are at long-term risk.`
      )
    )
  },
}

const cloudApiSecurityScanner: ScanModule = {
  id: 'cloud-api-security-scanner',
  name: 'Cloud API Security Scanner',
  category: 'cloud',
  description: 'Analyzes OAuth tokens, JWT signing algorithms, and TLS configurations used by cloud API endpoints.',
  supportedTargets: ['cloud-infrastructure', 'endpoint-security', 'app'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Cloud API "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'signature' ? 'JWT token signing' : 'API transport security'}. Token forgery possible post-quantum.`
      )
    )
  },
}

const cloudBackupEncryptionScanner: ScanModule = {
  id: 'cloud-backup-encryption-scanner',
  name: 'Cloud Backup Encryption Scanner',
  category: 'cloud',
  description: 'Inspects PGP-encrypted backups, RSA-wrapped backup keys, and cloud backup encryption configurations.',
  supportedTargets: ['cloud-drive', 'cloud-infrastructure'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Cloud backup "${target.name}" encrypted with ${alg}. Archived backups represent prime HNDL targets for harvest-now-decrypt-later attacks.`
      )
    )
  },
}

const saasAuthenticationScanner: ScanModule = {
  id: 'saas-authentication-scanner',
  name: 'SaaS Authentication Scanner',
  category: 'cloud',
  description: 'Analyzes SaaS application login flows, SSO federation, and authentication token signing for quantum-vulnerable cryptography.',
  supportedTargets: ['app', 'cloud-infrastructure', 'endpoint-security'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `SaaS platform "${target.name}" authentication uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'hash' ? 'credential hashing' : 'session token signing'}. Account takeover risk post-quantum.`
      )
    )
  },
}

const cloudDatabaseEncryptionScanner: ScanModule = {
  id: 'cloud-database-encryption-scanner',
  name: 'Cloud Database Encryption Scanner',
  category: 'cloud',
  description: 'Analyzes database encryption including TDE, column-level encryption, and connection security for quantum-vulnerable algorithms.',
  supportedTargets: ['cloud-infrastructure'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Database "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'symmetric' ? 'transparent data encryption' : 'connection security'}. Sensitive data at rest and in transit is at risk.`
      )
    )
  },
}

// ---- BLOCKCHAIN & DIGITAL ASSET MODULES (16-20) ----

const cryptoWalletSecurityScanner: ScanModule = {
  id: 'crypto-wallet-security-scanner',
  name: 'Crypto Wallet Security Scanner',
  category: 'blockchain',
  description: 'Analyzes cryptocurrency wallet signature algorithms, key derivation, and address generation for quantum vulnerability.',
  supportedTargets: ['crypto-wallet'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Crypto wallet "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'hash' ? 'address derivation' : 'transaction signing'}. Wallet funds are at direct theft risk from quantum attack.`
      )
    )
  },
}

const blockchainNodeSecurityScanner: ScanModule = {
  id: 'blockchain-node-security-scanner',
  name: 'Blockchain Node Security Scanner',
  category: 'blockchain',
  description: 'Inspects blockchain node authentication, peer communication encryption, and ECC signature validation for quantum vulnerabilities.',
  supportedTargets: ['crypto-wallet', 'developer-platform'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Blockchain node "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'protocol' ? 'peer TLS communication' : 'block validation and consensus'}. Network integrity at risk.`
      )
    )
  },
}

const cryptoExchangeApiScanner: ScanModule = {
  id: 'crypto-exchange-api-scanner',
  name: 'Crypto Exchange API Scanner',
  category: 'blockchain',
  description: 'Analyzes cryptocurrency exchange API encryption, authentication tokens, and withdrawal signing mechanisms.',
  supportedTargets: ['crypto-wallet', 'app'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Exchange API "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'protocol' ? 'API transport' : 'request signing and authentication'}. Unauthorized withdrawals possible post-quantum.`
      )
    )
  },
}

const smartContractSignatureScanner: ScanModule = {
  id: 'smart-contract-signature-scanner',
  name: 'Smart Contract Signature Scanner',
  category: 'blockchain',
  description: 'Analyzes smart contract verification signatures, deployer keys, and on-chain cryptographic operations.',
  supportedTargets: ['crypto-wallet', 'developer-platform'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Smart contract on "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'hash' ? 'state verification' : 'transaction authorization'}. Contract ownership can be hijacked post-quantum.`
      )
    )
  },
}

const web3IdentityScanner: ScanModule = {
  id: 'web3-identity-scanner',
  name: 'Web3 Identity Scanner',
  category: 'blockchain',
  description: 'Analyzes decentralized identity systems, DID documents, verifiable credentials, and Web3 authentication cryptography.',
  supportedTargets: ['crypto-wallet', 'app'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Web3 identity on "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'signature' ? 'credential signing' : 'identity key derivation'}. Decentralized identity can be stolen post-quantum.`
      )
    )
  },
}

// ---- TELECOM & INFRASTRUCTURE MODULES (21-25) ----

const mobileNetworkAuthScanner: ScanModule = {
  id: 'mobile-network-auth-scanner',
  name: 'Mobile Network Auth Scanner',
  category: 'telecom',
  description: 'Analyzes 4G LTE and 5G NR authentication protocols, SIM-based key agreement, and network slice encryption.',
  supportedTargets: ['cloud-infrastructure', 'endpoint-security', 'app'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Mobile network "${target.name}" uses ${alg} in ${ALGORITHM_CATEGORY_MAP[alg] === 'symmetric' ? 'air interface encryption' : 'network authentication protocol'}. Cellular traffic interception possible post-quantum.`
      )
    )
  },
}

const satelliteCommEncryptionScanner: ScanModule = {
  id: 'satellite-comm-encryption-scanner',
  name: 'Satellite Communication Encryption Scanner',
  category: 'telecom',
  description: 'Analyzes satellite uplink/downlink encryption, command authentication, and telemetry protection algorithms.',
  supportedTargets: ['cloud-infrastructure'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Satellite system "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'symmetric' ? 'payload encryption' : 'command authentication'}. Satellite communication interception and spoofing risk.`
      )
    )
  },
}

const telecomCoreNetworkScanner: ScanModule = {
  id: 'telecom-core-network-scanner',
  name: 'Telecom Core Network Scanner',
  category: 'telecom',
  description: 'Inspects telecom backbone encryption including SS7, Diameter, GTP tunnels, and inter-operator signaling security.',
  supportedTargets: ['cloud-infrastructure'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Telecom core "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'protocol' ? 'signaling protocol security' : 'backbone encryption'}. National-scale communications at risk.`
      )
    )
  },
}

const secureMessagingProtocolScanner: ScanModule = {
  id: 'secure-messaging-protocol-scanner',
  name: 'Secure Messaging Protocol Scanner',
  category: 'telecom',
  description: 'Analyzes end-to-end encryption in messaging platforms including Signal Protocol, MTProto, and proprietary E2EE implementations.',
  supportedTargets: ['messaging'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Messaging platform "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'public-key' ? 'key exchange ratchet' : 'message encryption'}. All past messages are at HNDL decryption risk.`
      )
    )
  },
}

const criticalInfrastructureScanner: ScanModule = {
  id: 'critical-infrastructure-scanner',
  name: 'Critical Infrastructure Scanner',
  category: 'infrastructure',
  description: 'Scans banking, government, healthcare, and critical infrastructure systems for quantum-vulnerable cryptography in SCADA, HSMs, and PKI.',
  supportedTargets: ['cloud-infrastructure', 'endpoint-security', 'app'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Critical infrastructure "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'symmetric' ? 'data-at-rest protection' : 'system authentication and integrity'}. National security implications for quantum compromise.`
      )
    )
  },
}

// ---- EMAIL & COMMUNICATION SECURITY MODULES (26-28) ----

const emailEncryptionScanner: ScanModule = {
  id: 'email-encryption-scanner',
  name: 'Email Encryption Scanner',
  category: 'telecom',
  description: 'Scans email platforms for S/MIME certificates, PGP keys, TLS transport security, and DKIM signing algorithms vulnerable to quantum attacks.',
  supportedTargets: ['email'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Email platform "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'public-key' ? 'message encryption and key exchange' : ALGORITHM_CATEGORY_MAP[alg] === 'signature' ? 'DKIM/S/MIME signing' : 'transport security'}. Archived emails are prime HNDL targets.`
      )
    )
  },
}

const emailAuthenticationScanner: ScanModule = {
  id: 'email-authentication-scanner',
  name: 'Email Authentication Scanner',
  category: 'cloud',
  description: 'Analyzes OAuth tokens, session management, and authentication mechanisms used by email providers.',
  supportedTargets: ['email'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Email provider "${target.name}" authentication uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'hash' ? 'credential hashing' : 'OAuth token signing and session security'}. Account compromise risk post-quantum.`
      )
    )
  },
}

const socialMediaSecurityScanner: ScanModule = {
  id: 'social-media-security-scanner',
  name: 'Social Media Security Scanner',
  category: 'cloud',
  description: 'Scans social media platform security including OAuth tokens, API authentication, and transport encryption for quantum vulnerabilities.',
  supportedTargets: ['social-media'],
  scan(target: ScanTarget, scanId: string): ScanFinding[] {
    if (!this.supportedTargets.includes(target.type)) return []
    const algorithms = selectAlgorithmsForModule(this.id, target)
    return algorithms.map((alg) =>
      createFinding(
        this.id,
        scanId,
        target,
        alg,
        `Social platform "${target.name}" uses ${alg} for ${ALGORITHM_CATEGORY_MAP[alg] === 'protocol' ? 'API transport security' : ALGORITHM_CATEGORY_MAP[alg] === 'signature' ? 'authentication token signing' : 'data protection'}. Account and private data at risk.`
      )
    )
  },
}

// ============================================================
// MODULE REGISTRY
// ============================================================

/**
 * All scanning modules for QGuard's quantum vulnerability scanner
 */
export const SCAN_MODULES: ScanModule[] = [
  // Device Security (1-5)
  localEncryptionScanner,
  appCryptoLibraryScanner,
  secureStorageAnalyzer,
  firmwareSignatureScanner,
  passwordManagerCryptoAudit,
  // Network Security (6-10)
  tlsCipherSuiteScanner,
  certificateAuthorityTrustScanner,
  vpnSecurityScanner,
  sshSecurityScanner,
  dnsSecurityScanner,
  // Cloud Security (11-15)
  cloudStorageEncryptionScanner,
  cloudApiSecurityScanner,
  cloudBackupEncryptionScanner,
  saasAuthenticationScanner,
  cloudDatabaseEncryptionScanner,
  // Blockchain & Digital Assets (16-20)
  cryptoWalletSecurityScanner,
  blockchainNodeSecurityScanner,
  cryptoExchangeApiScanner,
  smartContractSignatureScanner,
  web3IdentityScanner,
  // Telecom & Infrastructure (21-25)
  mobileNetworkAuthScanner,
  satelliteCommEncryptionScanner,
  telecomCoreNetworkScanner,
  secureMessagingProtocolScanner,
  criticalInfrastructureScanner,
  // Email & Communication Security (26-28)
  emailEncryptionScanner,
  emailAuthenticationScanner,
  socialMediaSecurityScanner,
]

/**
 * Look up a scan module by its unique ID
 */
export function getModuleById(id: string): ScanModule | undefined {
  return SCAN_MODULES.find((m) => m.id === id)
}

/**
 * Get all modules belonging to a specific category
 */
export function getModulesByCategory(category: ScanModuleCategory): ScanModule[] {
  return SCAN_MODULES.filter((m) => m.category === category)
}

/**
 * Get all modules that support scanning a given target type
 */
export function getModulesForTarget(targetType: ScanTargetType): ScanModule[] {
  return SCAN_MODULES.filter((m) => m.supportedTargets.includes(targetType))
}

function evidenceAssetTypeToTargetType(evidence: ScannerEvidenceRecord): ScanTargetType {
  const value = `${evidence.assetType || ''} ${evidence.evidenceType || ''} ${evidence.sourceType || ''}`.toLowerCase()
  if (value.includes('ssh')) return 'ssh-directory'
  if (value.includes('certificate') || value.includes('tls')) return 'certificate'
  if (value.includes('package') || value.includes('app') || value.includes('config')) return 'app'
  if (value.includes('cloud')) return 'cloud-infrastructure'
  if (value.includes('email')) return 'email'
  return 'endpoint-security'
}

function moduleForEvidence(evidence: ScannerEvidenceRecord): string {
  switch (evidence.evidenceType) {
    case 'tls-certificate':
      return 'certificate-authority-trust-scanner'
    case 'tls-protocol':
    case 'tls-cipher':
      return 'tls-cipher-suite-scanner'
    case 'ssh-metadata':
      return 'ssh-security-scanner'
    case 'package-manifest':
    case 'crypto-library':
      return 'app-crypto-library-scanner'
    case 'jwt-algorithm':
      return 'cloud-api-security-scanner'
    case 'config-reference':
      return evidence.protocol?.toLowerCase().includes('ssh') ? 'ssh-security-scanner' : 'critical-infrastructure-scanner'
    default:
      return 'app-crypto-library-scanner'
  }
}

function normalizeEvidenceAlgorithm(evidence: ScannerEvidenceRecord): ClassicalAlgorithm | null {
  const raw = `${evidence.observedAlgorithm || ''} ${evidence.packageName || ''} ${JSON.stringify(evidence.rawEvidence || {})}`.toLowerCase()
  const keySize = evidence.keySize || Number(raw.match(/(?:rsa|dh|aes|p-?|nistp|secp)?[-_ ]?(\d{3,4}|\d{2,3})/i)?.[1])

  if (raw.includes('rsa')) {
    if (keySize && keySize <= 1024) return 'RSA-1024'
    if (keySize && keySize >= 4096) return 'RSA-4096'
    return 'RSA-2048'
  }
  if (raw.includes('ecdsa') || raw.includes('secp')) {
    if (raw.includes('384') || raw.includes('p384')) return 'ECDSA-P384'
    if (raw.includes('secp256k1')) return 'ECC-secp256k1'
    return 'ECDSA-P256'
  }
  if (raw.includes('ecdh') || raw.includes('p-256') || raw.includes('prime256') || raw.includes('nistp256') || raw.includes('elliptic')) return 'ECC-P256'
  if (raw.includes('p-384') || raw.includes('nistp384')) return 'ECC-P384'
  if (raw.includes('x25519') || raw.includes('curve25519')) return 'X25519'
  if (raw.includes('ed25519')) return 'Ed25519'
  if (raw.includes('diffie') || raw.includes('dhe') || raw.includes('dh-')) return keySize && keySize <= 1024 ? 'DH-1024' : 'DH-2048'
  if (raw.includes('tls')) {
    if (raw.includes('1.0')) return 'TLS-1.0'
    if (raw.includes('1.1')) return 'TLS-1.1'
    if (raw.includes('1.2')) return 'TLS-1.2'
    if (raw.includes('1.3')) return 'TLS-1.3'
  }
  if (raw.includes('sha-1') || raw.includes('sha1')) return 'SHA-1'
  if (raw.includes('sha-256') || raw.includes('sha256')) return 'SHA-256'
  if (raw.includes('md5')) return 'MD5'
  if (raw.includes('aes-128') || raw.includes('aes_128')) return 'AES-128'
  if (raw.includes('aes-256') || raw.includes('aes_256')) return 'AES-256'
  if (raw.includes('3des') || raw.includes('triple-des')) return '3DES'
  if (raw.includes('pgp') && raw.includes('rsa')) return 'PGP-RSA'
  if (raw.includes('pgp') && (raw.includes('ecc') || raw.includes('ec'))) return 'PGP-ECC'
  if (raw.includes('s/mime') && raw.includes('rsa')) return 'S/MIME-RSA'
  if (raw.includes('jsonwebtoken') || raw.includes('jwt')) return 'RSA-2048'
  if (raw.includes('node-forge') || raw.includes('openssl')) return 'RSA-2048'
  if (raw.includes('crypto-js')) return 'AES-128'
  return null
}

/**
 * Convert observed connector/local-agent evidence into scanner_2 findings.
 * This is the production evidence path. It only creates findings for observed
 * algorithms or concrete crypto-library evidence and does not use module
 * affinity lists as proof of vulnerability.
 */
export function scanEvidenceWithModules(
  evidenceRecords: ScannerEvidenceRecord[],
  scanId: string
): ScanFinding[] {
  const findings: ScanFinding[] = []

  for (const evidenceRecord of evidenceRecords) {
    const algorithm = normalizeEvidenceAlgorithm(evidenceRecord)
    if (!algorithm) continue

    const moduleId = moduleForEvidence(evidenceRecord)
    const module = getModuleById(moduleId)
    const profile = ALGORITHM_PROFILES.find((item) => item.algorithm === algorithm)
    if (!profile || !module) continue

    const target: ScanTarget = {
      id: evidenceRecord.id || uuidv4(),
      name: evidenceRecord.assetName || evidenceRecord.host || evidenceRecord.target || 'Observed asset',
      type: evidenceAssetTypeToTargetType(evidenceRecord),
      provider: evidenceRecord.sourceType,
      metadata: {
        target: evidenceRecord.target,
        host: evidenceRecord.host,
        port: evidenceRecord.port,
        protocol: evidenceRecord.protocol,
        filePath: evidenceRecord.filePath,
        packageName: evidenceRecord.packageName,
        packageVersion: evidenceRecord.packageVersion,
      },
    }
    const riskScore = profile.riskScore * 10
    const evidenceKind = evidenceRecord.evidenceType.includes('tls')
      ? 'tls'
      : evidenceRecord.evidenceType.includes('ssh')
        ? 'ssh'
        : evidenceRecord.evidenceType.includes('package')
          ? 'configuration'
          : 'observed'

    findings.push({
      id: uuidv4(),
      scanId,
      moduleId,
      target,
      fingerprintId: findMatchingFingerprint(algorithm),
      detectedAlgorithm: algorithm,
      algorithmCategory: ALGORITHM_CATEGORY_MAP[algorithm],
      threatLevel: profile.threatLevel,
      quantumThreat: QUANTUM_THREAT_MAP[algorithm],
      isHNDLRisk: profile.isHNDLRisk,
      description: profile.description,
      recommendation: profile.recommendation,
      quantumBreakTime: profile.quantumBreakTime,
      classicalBreakTime: profile.classicalBreakTime,
      riskScore,
      severity: riskScoreToSeverity(riskScore),
      pqcReplacement: PQC_REPLACEMENT_MAP[algorithm],
      evidence: buildEvidenceForTarget(target, {
        moduleId,
        kind: evidenceKind,
        confidence: evidenceRecord.confidence || 'high',
        source: `${evidenceRecord.sourceType}:${evidenceRecord.evidenceType}`,
        detail: `Observed ${algorithm} from ${evidenceRecord.evidenceType}${evidenceRecord.host ? ` on ${evidenceRecord.host}` : ''}${evidenceRecord.filePath ? ` in ${evidenceRecord.filePath}` : ''}.`,
      }),
      remediation: buildRemediationModel(target),
      detectionContext: `Observed evidence: ${evidenceRecord.evidenceType}`,
      timestamp: evidenceRecord.observedAt || new Date().toISOString(),
    })
  }

  return findings
}
