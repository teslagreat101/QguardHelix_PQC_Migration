/**
 * QGuard Fingerprint Matcher
 * Enriches scan findings by matching them against the 70 cryptographic
 * fingerprints database, adding fingerprint IDs and detection context.
 */

import type { ScanFinding } from '@/types/scanner.types'
import { CRYPTO_FINGERPRINTS, type CryptoFingerprint } from '../fingerprints'

/**
 * Algorithm-to-fingerprint mapping for efficient lookup.
 * Maps ClassicalAlgorithm values to matching fingerprint IDs.
 */
const ALGORITHM_FINGERPRINT_MAP: Record<string, number[]> = buildAlgorithmMap()

function buildAlgorithmMap(): Record<string, number[]> {
  const map: Record<string, number[]> = {}

  for (const fp of CRYPTO_FINGERPRINTS) {
    const algo = fp.algorithm
    if (!map[algo]) {
      map[algo] = []
    }
    map[algo].push(fp.id)
  }

  return map
}

/**
 * Maps ClassicalAlgorithm names to fingerprint algorithm field values.
 */
const CLASSICAL_TO_FP_ALGORITHM: Record<string, string[]> = {
  'RSA-1024': ['RSA'],
  'RSA-2048': ['RSA'],
  'RSA-4096': ['RSA'],
  'ECC-P256': ['ECDSA', 'ECC', 'Elliptic Curve'],
  'ECC-P384': ['ECDSA', 'ECC', 'Elliptic Curve'],
  'ECC-secp256k1': ['ECDSA', 'ECC', 'secp256k1'],
  'SHA-1': ['SHA-1', 'SHA1'],
  'SHA-256': ['SHA-256', 'SHA256'],
  'MD5': ['MD5'],
  'TLS-1.0': ['TLS 1.0'],
  'TLS-1.1': ['TLS 1.1'],
  'TLS-1.2': ['RSA', 'ECDHE', 'DHE'],
  'TLS-1.3': ['ECDHE'],
  'AES-128': ['AES-128', 'AES'],
  'AES-256': ['AES-256', 'AES'],
  '3DES': ['3DES', 'DES'],
  'DH-2048': ['Diffie-Hellman', 'DH', 'DHE'],
  'DH-1024': ['Diffie-Hellman', 'DH', 'DHE'],
  'ECDSA-P256': ['ECDSA'],
  'ECDSA-P384': ['ECDSA'],
  'DSA-1024': ['DSA'],
  'DSA-2048': ['DSA'],
  'PGP-RSA': ['RSA', 'PGP'],
  'PGP-ECC': ['ECC', 'PGP', 'Elliptic Curve'],
  'S/MIME-RSA': ['RSA', 'S/MIME'],
  'Ed25519': ['Ed25519', 'EdDSA'],
  'X25519': ['X25519', 'Curve25519'],
}

/**
 * Match a finding against the fingerprint database.
 * Returns the best-matching fingerprint or null.
 */
function findBestFingerprint(finding: ScanFinding): CryptoFingerprint | null {
  const algoNames = CLASSICAL_TO_FP_ALGORITHM[finding.detectedAlgorithm] || []

  // Find fingerprints that match any of the algorithm names
  const candidates: CryptoFingerprint[] = []

  for (const fp of CRYPTO_FINGERPRINTS) {
    // Check algorithm name match
    const algoMatch = algoNames.some(
      (name) =>
        fp.algorithm.includes(name) ||
        fp.identifier.includes(name) ||
        fp.description.toLowerCase().includes(name.toLowerCase())
    )

    if (algoMatch) {
      candidates.push(fp)
    }
  }

  if (candidates.length === 0) return null

  // Prefer fingerprints that match the quantum threat type
  const threatMatched = candidates.filter((c) => c.quantumThreat === finding.quantumThreat)
  if (threatMatched.length > 0) {
    // Return the one with the closest risk score
    return threatMatched.reduce((best, fp) =>
      Math.abs(fp.riskScore - finding.riskScore) < Math.abs(best.riskScore - finding.riskScore)
        ? fp
        : best
    )
  }

  // Fallback: return highest risk match
  return candidates.reduce((best, fp) => (fp.riskScore > best.riskScore ? fp : best))
}

/**
 * Enrich scan findings with fingerprint data.
 * Adds fingerprintId and enhances detectionContext.
 */
export function matchFingerprints(findings: ScanFinding[]): ScanFinding[] {
  return findings.map((finding) => {
    const fp = findBestFingerprint(finding)

    if (!fp) return finding

    return {
      ...finding,
      fingerprintId: fp.id,
      detectionContext: finding.detectionContext
        ? `${finding.detectionContext} | Fingerprint: ${fp.identifier}`
        : `Fingerprint: ${fp.identifier} (${fp.description})`,
    }
  })
}

/**
 * Get all fingerprints matching a specific algorithm.
 */
export function getFingerprintsForAlgorithm(algorithm: string): CryptoFingerprint[] {
  const algoNames = CLASSICAL_TO_FP_ALGORITHM[algorithm] || [algorithm]

  return CRYPTO_FINGERPRINTS.filter((fp) =>
    algoNames.some(
      (name) =>
        fp.algorithm.includes(name) ||
        fp.identifier.includes(name)
    )
  )
}

/**
 * Get fingerprint by ID.
 */
export function getFingerprintById(id: number): CryptoFingerprint | undefined {
  return CRYPTO_FINGERPRINTS.find((fp) => fp.id === id)
}

/**
 * Get fingerprint statistics for reporting.
 */
export function getFingerprintStats() {
  const byCategory: Record<string, number> = {}
  const byThreat: Record<string, number> = {}
  let vulnerableCount = 0

  for (const fp of CRYPTO_FINGERPRINTS) {
    byCategory[fp.category] = (byCategory[fp.category] || 0) + 1
    byThreat[fp.quantumThreat] = (byThreat[fp.quantumThreat] || 0) + 1
    if (fp.isQuantumVulnerable) vulnerableCount++
  }

  return {
    total: CRYPTO_FINGERPRINTS.length,
    vulnerableCount,
    byCategory,
    byThreat,
  }
}
