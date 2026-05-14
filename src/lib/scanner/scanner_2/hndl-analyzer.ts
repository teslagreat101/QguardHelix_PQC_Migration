/**
 * QGuard HNDL Analyzer
 * Flags data at risk of "Harvest Now, Decrypt Later" attacks
 */

import type { ScanResult } from '@/types/scanner.types'
import type { ClassicalAlgorithm } from '@/types/quantum.types'
import { uuidv4 } from './uuid'

export interface HNDLRiskAssessment {
  id: string
  targetName: string
  algorithm: ClassicalAlgorithm
  dataType: string
  exposurePeriod: string
  riskExplanation: string
  mitigationAction: string
  urgencyLevel: 'immediate' | 'soon' | 'planned'
  estimatedQDayImpact: string
}

/**
 * Algorithms vulnerable to HNDL attacks
 * (public-key algorithms broken by Shor's algorithm)
 */
const HNDL_VULNERABLE_ALGORITHMS: ClassicalAlgorithm[] = [
  'RSA-1024', 'RSA-2048', 'RSA-4096',
  'ECC-P256', 'ECC-P384',
  'TLS-1.0', 'TLS-1.1',
  '3DES',
]

const DATA_TYPE_MAP: Record<string, string> = {
  'local-file': 'Personal files & documents',
  'cloud-drive': 'Cloud-stored data',
  'email': 'Email communications',
  'password-vault': 'Password vault entries',
  'app': 'Application data',
  'certificate': 'Digital certificates',
  'endpoint-security': 'Endpoint telemetry and agent data',
  'messaging': 'Message history and channel metadata',
  'social-media': 'Organization and identity data',
  'cloud-infrastructure': 'Infrastructure traffic and keys',
}

/**
 * Analyze scan results for HNDL risk
 */
export function analyzeHNDLRisks(results: ScanResult[]): HNDLRiskAssessment[] {
  return results
    .filter((r) => HNDL_VULNERABLE_ALGORITHMS.includes(r.detectedAlgorithm))
    .map((r) => ({
      id: uuidv4(),
      targetName: r.target.name,
      algorithm: r.detectedAlgorithm,
      dataType: DATA_TYPE_MAP[r.target.type] || 'Unknown data',
      exposurePeriod: estimateExposurePeriod(r.detectedAlgorithm),
      riskExplanation: buildHNDLExplanation(r),
      mitigationAction: r.recommendation,
      urgencyLevel: mapUrgency(r.threatLevel),
      estimatedQDayImpact: estimateQDayImpact(r.detectedAlgorithm),
    }))
}

function estimateExposurePeriod(algorithm: ClassicalAlgorithm): string {
  const periods: Partial<Record<ClassicalAlgorithm, string>> = {
    'RSA-1024': 'Immediate risk — data may already be harvested',
    'RSA-2048': '5–15 years until quantum decryption is feasible',
    'RSA-4096': '10–20 years until quantum decryption is feasible',
    'ECC-P256': '5–15 years until quantum decryption is feasible',
    'ECC-P384': '10–20 years until quantum decryption is feasible',
    'TLS-1.0': 'Already at risk — both classical and quantum threats',
    'TLS-1.1': 'Already at risk — deprecated protocol',
    '3DES': '3–10 years until quantum attacks are practical',
  }
  return periods[algorithm] || 'Risk period unknown'
}

function buildHNDLExplanation(result: ScanResult): string {
  return `Adversaries can intercept and store data encrypted with ${result.detectedAlgorithm} today. ` +
    `When sufficiently powerful quantum computers become available (estimated 2030–2040), ` +
    `they can use Shor's algorithm to break the encryption and access your ${DATA_TYPE_MAP[result.target.type] || 'data'}. ` +
    `This is known as a "Harvest Now, Decrypt Later" (HNDL) attack.`
}

function mapUrgency(threatLevel: string): 'immediate' | 'soon' | 'planned' {
  if (threatLevel === 'critical') return 'immediate'
  if (threatLevel === 'high') return 'soon'
  return 'planned'
}

function estimateQDayImpact(algorithm: ClassicalAlgorithm): string {
  const impacts: Partial<Record<ClassicalAlgorithm, string>> = {
    'RSA-1024': 'Complete key recovery in minutes — all encrypted data exposed',
    'RSA-2048': 'Complete key recovery in hours — all encrypted data exposed',
    'RSA-4096': 'Key recovery in days — all encrypted data eventually exposed',
    'ECC-P256': 'Complete key recovery in hours — all ECDSA signatures forgeable',
    'ECC-P384': 'Key recovery in days — all ECDSA signatures forgeable',
    'TLS-1.0': 'All recorded TLS sessions decryptable',
    'TLS-1.1': 'All recorded TLS sessions decryptable',
    '3DES': 'Data decryptable with reduced quantum effort',
  }
  return impacts[algorithm] || 'Impact assessment pending'
}
