/**
 * QGuard Q-Score Engine
 * Calculates Quantum Risk Score (0–100) based on detected vulnerabilities
 */

import type { ScanResult, QScore, QScoreTrend } from '@/types/scanner.types'
import type { QuantumThreatLevel } from '@/types/quantum.types'

const CATEGORY_WEIGHTS = {
  encryption: 0.30,
  certificates: 0.25,
  passwords: 0.20,
  cloudStorage: 0.15,
  communications: 0.10,
}

/**
 * Calculate overall Q-Score from scan results
 * Score of 100 = fully quantum-safe, 0 = critically vulnerable
 */
export function calculateQScore(results: ScanResult[]): QScore {
  if (results.length === 0) {
    return createDefaultQScore()
  }

  // Calculate category scores (100 - average risk per category)
  const categoryResults = categorizeResults(results)

  const encryption = 100 - averageRisk(categoryResults.encryption)
  const certificates = 100 - averageRisk(categoryResults.certificates)
  const passwords = 100 - averageRisk(categoryResults.passwords)
  const cloudStorage = 100 - averageRisk(categoryResults.cloudStorage)
  const communications = 100 - averageRisk(categoryResults.communications)

  const breakdown = { encryption, certificates, passwords, cloudStorage, communications }

  // Weighted overall score
  const overall = Math.round(
    encryption * CATEGORY_WEIGHTS.encryption +
    certificates * CATEGORY_WEIGHTS.certificates +
    passwords * CATEGORY_WEIGHTS.passwords +
    cloudStorage * CATEGORY_WEIGHTS.cloudStorage +
    communications * CATEGORY_WEIGHTS.communications
  )

  const { criticalCount, highCount, mediumCount, lowCount } = countBySeverity(results)

  return {
    overall: Math.max(0, Math.min(100, overall)),
    breakdown,
    level: scoreToThreatLevel(overall),
    trend: generateTrendData(overall),
    lastScanAt: new Date().toISOString(),
    totalVulnerabilities: results.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
  }
}

function categorizeResults(results: ScanResult[]) {
  const categories = {
    encryption: [] as ScanResult[],
    certificates: [] as ScanResult[],
    passwords: [] as ScanResult[],
    cloudStorage: [] as ScanResult[],
    communications: [] as ScanResult[],
  }

  for (const result of results) {
    const algo = result.detectedAlgorithm
    const targetType = result.target.type

    if (algo.startsWith('RSA') || algo.startsWith('ECC') || algo.startsWith('AES') || algo === '3DES'
      || algo.startsWith('DH') || algo.startsWith('DSA') || algo.startsWith('PGP')) {
      categories.encryption.push(result)
    } else if (algo.startsWith('TLS') || algo.startsWith('ECDSA') || algo.startsWith('S/MIME')
      || algo === 'Ed25519' || algo === 'X25519') {
      categories.certificates.push(result)
    } else if (algo === 'SHA-1' || algo === 'MD5' || targetType === 'password-vault') {
      categories.passwords.push(result)
    } else if (targetType === 'cloud-drive' || targetType === 'cloud-infrastructure' || targetType === 'endpoint-security') {
      categories.cloudStorage.push(result)
    } else {
      categories.communications.push(result)
    }
  }

  return categories
}

function averageRisk(results: ScanResult[]): number {
  if (results.length === 0) return 15 // baseline low risk
  const totalRisk = results.reduce((sum, r) => sum + r.riskScore, 0)
  return totalRisk / results.length
}

function scoreToThreatLevel(score: number): QuantumThreatLevel {
  if (score >= 80) return 'safe'
  if (score >= 60) return 'low'
  if (score >= 40) return 'medium'
  if (score >= 20) return 'high'
  return 'critical'
}

function countBySeverity(results: ScanResult[]) {
  let criticalCount = 0
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0

  for (const r of results) {
    switch (r.threatLevel) {
      case 'critical': criticalCount++; break
      case 'high': highCount++; break
      case 'medium': mediumCount++; break
      case 'low': lowCount++; break
    }
  }

  return { criticalCount, highCount, mediumCount, lowCount }
}

function generateTrendData(currentScore: number): QScoreTrend[] {
  const trend: QScoreTrend[] = []
  const now = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const variance = Math.floor(Math.random() * 20) - 10
    const score = Math.max(0, Math.min(100, currentScore + variance - (i * 0.3)))
    trend.push({
      date: date.toISOString().split('T')[0],
      score: Math.round(score),
    })
  }

  // Last entry is current score
  trend[trend.length - 1].score = currentScore

  return trend
}

function createDefaultQScore(): QScore {
  return {
    overall: 72,
    breakdown: {
      encryption: 65,
      certificates: 78,
      passwords: 70,
      cloudStorage: 80,
      communications: 75,
    },
    level: 'low',
    trend: generateTrendData(72),
    lastScanAt: new Date().toISOString(),
    totalVulnerabilities: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
  }
}

/**
 * Get color for Q-Score display
 */
export function getQScoreColor(score: number): string {
  if (score >= 80) return '#30d158'
  if (score >= 60) return '#00d4ff'
  if (score >= 40) return '#ffcc00'
  if (score >= 20) return '#ff6b35'
  return '#ff2d55'
}

/**
 * Get Q-Score label
 */
export function getQScoreLabel(score: number): string {
  if (score >= 80) return 'Quantum Safe'
  if (score >= 60) return 'Mostly Protected'
  if (score >= 40) return 'At Risk'
  if (score >= 20) return 'High Risk'
  return 'Critical Risk'
}
