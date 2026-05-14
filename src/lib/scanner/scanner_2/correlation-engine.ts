/**
 * QGuard AI Correlation Engine
 * Analyzes scan findings to identify attack chains where quantum-vulnerable
 * cryptography could be exploited across connected platforms.
 */

import type { ScanResult } from '@/types/scanner.types'
import type { AttackCorrelation, QuantumRiskClassification, QuantumRiskAssessment } from '@/types/scanner.types'
import { uuidv4 } from './uuid'

/** Attack chain templates that map source types to exploitation scenarios */
const ATTACK_CHAIN_TEMPLATES: {
  sourceTypes: string[]
  algorithms: string[]
  chain: string
}[] = [
  {
    sourceTypes: ['email'],
    algorithms: ['RSA-2048', 'RSA-1024', 'PGP-RSA', 'PGP-ECC', 'S/MIME-RSA'],
    chain: 'Encrypted email attachment → Harvest encrypted traffic → Quantum decryption → Plaintext exposure',
  },
  {
    sourceTypes: ['developer-platform'],
    algorithms: ['RSA-2048', 'RSA-1024', 'Ed25519', 'ECDSA-P256', 'DSA-1024'],
    chain: 'Repository SSH key → Quantum key recovery → Unauthorized code access → Supply chain compromise',
  },
  {
    sourceTypes: ['cloud-drive'],
    algorithms: ['RSA-2048', 'AES-128', 'TLS-1.2', 'ECC-P256'],
    chain: 'Cloud storage TLS intercept → Harvest encrypted files → Quantum decryption → Data exfiltration',
  },
  {
    sourceTypes: ['password-vault'],
    algorithms: ['AES-128', 'RSA-2048', 'SHA-1'],
    chain: 'Vault encryption weak params → Quantum brute force → Master password bypass → Credential dump',
  },
  {
    sourceTypes: ['crypto-wallet'],
    algorithms: ['ECC-secp256k1', 'ECDSA-P256', 'Ed25519'],
    chain: 'Wallet private key (ECDSA) → Quantum ECDLP solver → Key recovery → Fund theft',
  },
  {
    sourceTypes: ['cloud-infrastructure'],
    algorithms: ['RSA-2048', 'RSA-1024', 'DH-2048', 'DH-1024', 'TLS-1.0', 'TLS-1.1'],
    chain: 'Infrastructure TLS certificate → Quantum factoring → Man-in-the-middle → Full infrastructure compromise',
  },
  {
    sourceTypes: ['messaging'],
    algorithms: ['X25519', 'ECC-P256', 'DH-2048', 'Ed25519'],
    chain: 'Message key exchange intercept → Harvest ciphertext → Quantum ECDLP → Message history decryption',
  },
  {
    sourceTypes: ['social-media'],
    algorithms: ['TLS-1.2', 'RSA-2048', 'ECC-P256', 'X25519'],
    chain: 'API token TLS intercept → Quantum decryption → Account takeover → Identity impersonation',
  },
  {
    sourceTypes: ['endpoint-security'],
    algorithms: ['RSA-2048', 'ECDSA-P256', 'TLS-1.2', 'AES-128'],
    chain: 'Endpoint telemetry channel -> quantum-vulnerable TLS or key recovery -> sensor data exposure -> detection blind spots',
  },
  {
    sourceTypes: ['local-keystore', 'ssh-directory'],
    algorithms: ['RSA-1024', 'RSA-2048', 'Ed25519', 'DSA-1024', 'ECDSA-P256'],
    chain: 'Local SSH/signing key → Quantum key recovery → Server access → Lateral movement',
  },
  {
    sourceTypes: ['device-certificate'],
    algorithms: ['RSA-2048', 'RSA-1024', 'ECDSA-P256', 'ECDSA-P384'],
    chain: 'Device certificate → Quantum signature forgery → Device impersonation → Trust chain compromise',
  },
]

/**
 * Generate attack correlations from scan results
 */
export function generateAttackCorrelations(results: ScanResult[]): AttackCorrelation[] {
  const correlations: AttackCorrelation[] = []

  for (const result of results) {
    const matchingTemplates = ATTACK_CHAIN_TEMPLATES.filter(
      (t) =>
        t.sourceTypes.includes(result.target.type) &&
        t.algorithms.includes(result.detectedAlgorithm)
    )

    for (const template of matchingTemplates) {
      // Avoid duplicate correlations for the same chain + target
      const exists = correlations.some(
        (c) => c.chain === template.chain && c.source === result.target.name
      )
      if (exists) continue

      correlations.push({
        id: uuidv4(),
        source: result.target.name,
        sourceType: result.target.type,
        finding: `${result.detectedAlgorithm} detected`,
        chain: template.chain,
        riskLevel: threatToRiskClassification(result.threatLevel),
      })
    }
  }

  return correlations
}

/**
 * Build a full Quantum Risk Assessment from scan results
 */
export function buildQuantumRiskAssessment(results: ScanResult[]): QuantumRiskAssessment {
  const assets = {
    rsaKeys: 0,
    eccKeys: 0,
    dhKeys: 0,
    ecdsaSignatures: 0,
    dsaKeys: 0,
    pgpKeys: 0,
    tlsCertificates: 0,
    smimeCertificates: 0,
    sshKeys: 0,
    walletKeys: 0,
    vaultParams: 0,
  }

  for (const r of results) {
    const algo = r.detectedAlgorithm
    if (algo.startsWith('RSA')) assets.rsaKeys++
    else if (algo.startsWith('ECC') || algo === 'X25519') assets.eccKeys++
    else if (algo.startsWith('DH')) assets.dhKeys++
    else if (algo.startsWith('ECDSA')) assets.ecdsaSignatures++
    else if (algo.startsWith('DSA')) assets.dsaKeys++
    else if (algo.startsWith('PGP')) assets.pgpKeys++
    else if (algo.startsWith('TLS')) assets.tlsCertificates++
    else if (algo.startsWith('S/MIME')) assets.smimeCertificates++
    else if (algo === 'Ed25519') assets.sshKeys++

    if (r.target.type === 'crypto-wallet') assets.walletKeys++
    if (r.target.type === 'password-vault') assets.vaultParams++
  }

  // Calculate overall risk
  const avgRisk = results.length > 0
    ? results.reduce((sum, r) => sum + r.riskScore, 0) / results.length
    : 0

  const classification = riskScoreToClassification(avgRisk)

  // Estimate quantum breakability window based on findings
  const hasCritical = results.some((r) => r.threatLevel === 'critical')
  const hasHigh = results.some((r) => r.threatLevel === 'high')
  const earliest = hasCritical ? 2028 : hasHigh ? 2030 : 2033
  const latest = hasCritical ? 2032 : hasHigh ? 2035 : 2040

  const attackCorrelations = generateAttackCorrelations(results)

  return {
    riskScore: Math.round(avgRisk),
    classification,
    detectedAssets: assets,
    estimatedBreakWindow: { earliest, latest },
    attackCorrelations,
  }
}

function riskScoreToClassification(score: number): QuantumRiskClassification {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

function threatToRiskClassification(level: string): QuantumRiskClassification {
  switch (level) {
    case 'critical': return 'CRITICAL'
    case 'high': return 'HIGH'
    case 'medium': return 'MEDIUM'
    default: return 'LOW'
  }
}
