import { NextRequest, NextResponse } from 'next/server'
import { executeScan } from '@/lib/scanner/engine'
import { resolveTargets } from '@/lib/scanner/engine/target-map'
import { getMigrationRecommendation } from '@/lib/scanner/pqc-migration-engine'

/**
 * GET /api/v1/migrate/findings
 *
 * Runs a quick scan to detect vulnerable cryptographic algorithms,
 * then maps each finding to a realistic protection or migration recommendation.
 * Returns a list of assets that need direct QGuard protection, provider-supported
 * configuration, or advisory/overlay controls.
 *
 * Query params:
 *   targets - comma-separated target keys (default: local-files,ssh-keys,device-certificates)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const targetsParam = searchParams.get('targets') || 'local-files,ssh-keys,device-certificates'
    const targetKeys = targetsParam.split(',').map((t) => t.trim()).filter(Boolean)

    const scanTargets = resolveTargets(targetKeys)

    // Run a quick scan
    const job = executeScan(scanTargets, {
      runDetectionRules: true,
      matchFingerprints: true,
      emitTelemetry: false,
    })

    // Build migration file list from findings
    // Group by target + algorithm to avoid duplicates
    const seen = new Set<string>()
    const migrationFiles = []

    for (const finding of job.findings) {
      const key = `${finding.target.name}:${finding.detectedAlgorithm}`
      if (seen.has(key)) continue
      seen.add(key)

      // Skip quantum-safe algorithms (AES-256, TLS-1.3, SHA-256)
      if (finding.threatLevel === 'safe' || finding.threatLevel === 'low') continue

      const recommendation = getMigrationRecommendation(finding.detectedAlgorithm)
      if (!recommendation) continue

      // Generate a realistic filename based on algorithm and target
      const fileName = generateFileName(finding.detectedAlgorithm, finding.target.name, finding.target.type)
      const canDirectlyMigrate = finding.remediation.canDirectlyMigrate
      const afterScore = canDirectlyMigrate
        ? (recommendation.migrationComplexity === 'LOW' ? 2 : 5)
        : Math.max(20, Math.round(finding.riskScore / 10) - 15)

      migrationFiles.push({
        id: finding.id,
        name: fileName,
        currentAlgo: finding.detectedAlgorithm,
        targetAlgo: canDirectlyMigrate ? recommendation.recommendedPQC : finding.remediation.label,
        status: 'pending' as const,
        beforeScore: Math.round(finding.riskScore / 10), // 0-100 scale
        afterScore,
        migrationComplexity: recommendation.migrationComplexity,
        nistStandard: recommendation.nistStandard,
        migrationSteps: canDirectlyMigrate ? recommendation.migrationSteps : [
          'Classify remediation authority',
          'Protect endpoint, browser session, credentials, or data before provider upload',
          'Create provider/vendor readiness ticket',
          'Enable residual-risk monitoring and audit evidence',
        ],
        estimatedEffort: recommendation.estimatedEffort,
        quantumThreat: finding.quantumThreat,
        targetName: finding.target.name,
        targetType: finding.target.type,
        evidence: finding.evidence,
        remediation: finding.remediation,
        remediationAuthority: finding.remediation.authority,
        protectionOutcome: finding.remediation.protectionOutcome,
        canDirectlyMigrate,
        canProtectWithOverlay: finding.remediation.canProtectWithOverlay,
        residualRisk: finding.remediation.residualRisk,
        migrationLabel: canDirectlyMigrate ? 'Direct local protection' : 'Protect / plan only',
        badgeEarned: getBadgeForMigration(finding.detectedAlgorithm, finding.target.type),
      })
    }

    // Sort by risk score descending (most urgent first)
    migrationFiles.sort((a, b) => b.beforeScore - a.beforeScore)

    return NextResponse.json({
      data: {
        files: migrationFiles,
        totalVulnerable: migrationFiles.length,
        scanId: job.id,
        riskScore: job.riskScore ? {
          overall: job.riskScore.overall,
          level: job.riskScore.level,
        } : null,
      },
    })
  } catch (err) {
    console.error('Migration findings error:', err)
    return NextResponse.json(
      { error: { code: 'SCAN_ERROR', message: 'Failed to detect migration targets' } },
      { status: 500 }
    )
  }
}

function generateFileName(algorithm: string, targetName: string, targetType: string): string {
  const baseNames: Record<string, string[]> = {
    'RSA-1024': ['legacy-cert.pem', 'old-signing-key.pem', 'tls-cert-legacy.pem'],
    'RSA-2048': ['server-cert.pem', 'tls-certificate.pem', 'api-key.pem'],
    'RSA-4096': ['root-ca.pem', 'enterprise-cert.pem'],
    'ECC-P256': ['ec-signing-key.pem', 'tls-ec-key.pem'],
    'ECC-P384': ['high-assurance-cert.pem', 'gov-signing-key.pem'],
    'ECC-secp256k1': ['wallet-signing.key', 'blockchain-key.json'],
    'ECDSA-P256': ['code-signing.pem', 'ca-intermediate.pem'],
    'ECDSA-P384': ['ca-root-cert.pem', 'enterprise-signer.pem'],
    'DH-1024': ['legacy-vpn.conf', 'dh-params-old.pem'],
    'DH-2048': ['vpn-tunnel.conf', 'ipsec-dh-params.pem'],
    'DSA-1024': ['legacy-ssh-key.pub', 'dsa-signer.pem'],
    'DSA-2048': ['signing-key-dsa.pem'],
    'Ed25519': ['ssh-id_ed25519', 'git-signing-key'],
    'X25519': ['wireguard-key.conf', 'tls-kex-key.pem'],
    'PGP-RSA': ['email-pgp-key.asc', 'archive-key.gpg'],
    'PGP-ECC': ['pgp-ecc-key.asc'],
    'S/MIME-RSA': ['smime-cert.p12', 'email-cert.pfx'],
    'SHA-1': ['password-store.kdbx', 'legacy-hash-config.conf'],
    'MD5': ['checksum-config.md5', 'legacy-auth.conf'],
    '3DES': ['payment-archive.dat', 'legacy-encrypted.des'],
    'TLS-1.0': ['tls-config-legacy.conf', 'server-deprecated.conf'],
    'TLS-1.1': ['tls-compat-config.conf'],
    'AES-128': ['encrypted-data.aes', 'vault-backup.enc'],
  }

  const names = baseNames[algorithm] || [`${algorithm.toLowerCase().replace(/[^a-z0-9]/g, '-')}.key`]
  // Use target name hash to consistently pick a filename
  const hash = targetName.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const baseName = names[hash % names.length]

  // Prefix with target context
  if (targetType === 'cloud-infrastructure') return `infra-${baseName}`
  if (targetType === 'developer-platform') return `dev-${baseName}`
  if (targetType === 'email') return `email-${baseName}`
  if (targetType === 'crypto-wallet') return `wallet-${baseName}`
  return baseName
}

function getBadgeForMigration(algorithm: string, targetType: string): string | undefined {
  if (algorithm === 'ECC-secp256k1' || targetType === 'crypto-wallet') return 'Wallet Guardian'
  if (algorithm.startsWith('RSA-1024') || algorithm.startsWith('DH-1024')) return 'Critical Responder'
  if (targetType === 'cloud-infrastructure') return 'Infrastructure Shield'
  if (algorithm.startsWith('PGP') || algorithm.startsWith('S/MIME')) return 'Email Protector'
  if (algorithm === 'Ed25519' || targetType === 'ssh-directory') return 'SSH Guardian'
  return undefined
}
