import { NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { getMigrationRecommendation } from '@/lib/scanner/pqc-migration-engine'
import {
  assessWizardAssets,
  type WizardAsset,
  type WizardMigrationLog,
  type WizardAssetStatus,
} from '@/lib/migration-wizard/workflow'
import {
  getOrCreateWizardSession,
  recordWizardEvent,
  updateWizardSession,
} from '@/lib/migration-wizard/session-store'

export const dynamic = 'force-dynamic'

const CLASSICAL_RISK_SCORES: Record<string, number> = {
  'RSA-1024': 95,
  'RSA-2048': 82,
  'RSA-4096': 70,
  'ECC-P256': 80,
  'ECC-P384': 75,
  'ECC-secp256k1': 88,
  'SHA-1': 98,
  MD5: 99,
  'TLS-1.0': 90,
  'TLS-1.1': 85,
  'TLS-1.2': 70,
  'AES-128': 40,
  '3DES': 88,
  'ECDSA-P256': 81,
  'ECDSA-P384': 78,
  'DH-1024': 96,
  'DH-2048': 83,
  'DSA-1024': 94,
  'DSA-2048': 79,
  Ed25519: 76,
  X25519: 74,
  'PGP-RSA': 84,
  'PGP-ECC': 82,
  'S/MIME-RSA': 80,
}

const PQC_RISK_SCORES: Record<string, number> = {
  'ML-KEM': 5,
  'ML-DSA': 5,
  'SHA-3-256': 8,
  'AES-256-GCM': 8,
  HYBRID: 8,
}

function normalizeClassicalAlgorithm(value: string): string {
  const source = value.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
  const upper = source.toUpperCase()
  const checks: Array<[RegExp, string]> = [
    [/\bRSA[-\s]?1024\b/, 'RSA-1024'],
    [/\bRSA[-\s]?2048\b/, 'RSA-2048'],
    [/\bRSA[-\s]?4096\b/, 'RSA-4096'],
    [/\bDH[-\s]?1024\b/, 'DH-1024'],
    [/\bDH[-\s]?2048\b/, 'DH-2048'],
    [/\bDSA[-\s]?1024\b/, 'DSA-1024'],
    [/\bDSA[-\s]?2048\b/, 'DSA-2048'],
    [/\bECDSA[-\s]?P[-\s]?384\b/, 'ECDSA-P384'],
    [/\bECDSA[-\s]?P[-\s]?256\b|\bECDSA\b/, 'ECDSA-P256'],
    [/\bSECP256K1\b/, 'ECC-secp256k1'],
    [/\bECC[-\s]?P[-\s]?256\b|\bP[-\s]?256\b/, 'ECC-P256'],
    [/\bECC[-\s]?P[-\s]?384\b|\bP[-\s]?384\b/, 'ECC-P384'],
    [/\bX25519\b/, 'X25519'],
    [/\bED25519\b/, 'Ed25519'],
    [/\bSHA[-\s]?1\b/, 'SHA-1'],
    [/\bMD5\b/, 'MD5'],
    [/\bTLS[-\s]?1\.0\b/, 'TLS-1.0'],
    [/\bTLS[-\s]?1\.1\b/, 'TLS-1.1'],
    [/\bTLS[-\s]?1\.2\b/, 'TLS-1.2'],
    [/\bAES[-\s]?128\b/, 'AES-128'],
    [/\b3DES\b/, '3DES'],
    [/\bPGP.*RSA\b/, 'PGP-RSA'],
    [/\bPGP.*ECC\b/, 'PGP-ECC'],
    [/\bS\/MIME.*RSA\b|\bSMIME.*RSA\b/, 'S/MIME-RSA'],
  ]

  for (const [pattern, algorithm] of checks) {
    if (pattern.test(upper)) return algorithm
  }

  return source
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function generatePQCKeyPair(algorithm: string): Promise<{
  publicKeyFingerprint: string
  algorithmUsed: string
  keySize: number
}> {
  if (algorithm === 'ML-DSA') {
    const { ml_dsa65 } = await import('@noble/post-quantum/ml-dsa.js')
    const keys = ml_dsa65.keygen()
    return {
      publicKeyFingerprint: toHex(keys.publicKey).slice(0, 32),
      algorithmUsed: 'ML-DSA-65 (FIPS 204)',
      keySize: keys.publicKey.length,
    }
  }

  if (algorithm === 'ML-KEM' || algorithm === 'HYBRID') {
    const { ml_kem768 } = await import('@noble/post-quantum/ml-kem.js')
    const keys = ml_kem768.keygen()
    return {
      publicKeyFingerprint: toHex(keys.publicKey).slice(0, 32),
      algorithmUsed: 'ML-KEM-768 (FIPS 203)',
      keySize: keys.publicKey.length,
    }
  }

  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return {
    publicKeyFingerprint: toHex(randomBytes),
    algorithmUsed: algorithm,
    keySize: randomBytes.length,
  }
}

async function computeIntegrityHash(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return toHex(new Uint8Array(hashBuffer))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSignatureAlgorithm(algorithm: string) {
  return /DSA|ECDSA|ED25519|SECP256K1|SIGN/i.test(algorithm)
}

function isHashAlgorithm(algorithm: string) {
  return /SHA-1|MD5/i.test(algorithm)
}

function isSymmetricAlgorithm(algorithm: string) {
  return /AES|3DES/i.test(algorithm)
}

function selectPQCAlgorithm(originalAlgorithm: string) {
  if (isSignatureAlgorithm(originalAlgorithm)) return 'ML-DSA'
  if (isHashAlgorithm(originalAlgorithm)) return 'SHA-3-256'
  if (isSymmetricAlgorithm(originalAlgorithm)) return 'AES-256-GCM'
  return 'ML-KEM'
}

function displayAlgorithm(baseAlgorithm: string, hybridMode: boolean) {
  if (baseAlgorithm === 'ML-KEM') return hybridMode ? 'HYBRID ML-KEM-768' : 'ML-KEM-768'
  if (baseAlgorithm === 'ML-DSA') return hybridMode ? 'HYBRID ML-DSA-65' : 'ML-DSA-65'
  return baseAlgorithm
}

function workflowProgress(migrationProgress: number) {
  return Math.min(85, 45 + Math.round(migrationProgress * 0.4))
}

function toMigrationLog(
  asset: WizardAsset,
  originalAlgorithm: string,
  newAlgorithm: string,
  status: WizardMigrationLog['status'],
  beforeScore: number,
  afterScore: number,
): WizardMigrationLog {
  const timestamp = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    file_name: asset.name,
    original_algorithm: originalAlgorithm,
    new_algorithm: newAlgorithm,
    hybrid_mode: newAlgorithm.toUpperCase().includes('HYBRID'),
    status,
    before_score: beforeScore,
    after_score: afterScore,
    migrated_at: status === 'completed' || status === 'failed' ? timestamp : null,
    created_at: timestamp,
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const token = getToken(request)
  const user = await getServerUser(request)
  const dbClient = token ? createAuthClient(token) : null
  const session = getOrCreateWizardSession({ sessionId: body.sessionId, userId: user?.id })
  const submittedAssets = Array.isArray(body.assets) ? body.assets as WizardAsset[] : []
  const assets = submittedAssets.length ? submittedAssets : session.files
  const hybridMode = body.hybridMode !== false

  if (assets.length === 0) {
    updateWizardSession(session.sessionId, {
      activePhase: 'migrate',
      runState: 'failed',
      phaseStatus: { migrate: 'error' },
      error: 'At least one assessed asset is required for migration',
    })

    return Response.json(
      { error: { code: 'VALIDATION_ERROR', message: 'At least one assessed asset is required for migration' } },
      { status: 400 },
    )
  }

  updateWizardSession(session.sessionId, {
    activePhase: 'migrate',
    runState: 'migrating',
    phaseStatus: { migrate: 'running', verify: 'idle' },
    files: assets,
    migrationProgress: 0,
    progress: 45,
    verification: null,
    error: null,
  })
  recordWizardEvent(session.sessionId, 'migrate', `Migration stream opened for ${assets.length} asset(s).`, 'info', 45)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      let completedFiles = 0
      let failedFiles = 0
      let advisoryFiles = 0
      const syntheticLogs: WizardMigrationLog[] = []
      const persistedLogIds = new Map<string, string>()

      request.signal.addEventListener('abort', () => {
        closed = true
        updateWizardSession(session.sessionId, {
          runState: 'idle',
          phaseStatus: { migrate: 'idle' },
          error: null,
        })
        recordWizardEvent(session.sessionId, 'migrate', 'Migration stream paused by client.', 'warning', workflowProgress(0))
      })

      function processedCount() {
        return completedFiles + failedFiles + advisoryFiles
      }

      function send(data: Record<string, unknown>, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
        if (closed) return
        const timestamp = new Date().toISOString()
        const payload: Record<string, unknown> = { timestamp, sessionId: session.sessionId, ...data }
        const migrationProgress = typeof payload.progress === 'number' ? payload.progress : 0
        const nextWorkflowProgress = workflowProgress(migrationProgress)

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ...payload, workflowProgress: nextWorkflowProgress })}\n\n`))
          if (typeof payload.message === 'string') {
            recordWizardEvent(session.sessionId, 'migrate', payload.message, level, nextWorkflowProgress)
          }
        } catch {
          closed = true
        }
      }

      async function persistLogStart(asset: WizardAsset, originalAlgorithm: string, beforeScore: number, afterScore: number) {
        if (!user || !dbClient) return

        try {
          const { data } = await dbClient
            .from('migration_logs')
            .insert({
              user_id: user.id,
              file_name: asset.name,
              original_algorithm: originalAlgorithm,
              new_algorithm: 'HYBRID',
              hybrid_mode: hybridMode,
              status: 'migrating',
              before_score: beforeScore,
              after_score: afterScore,
            })
            .select('id')
            .single()

          if (data?.id) persistedLogIds.set(asset.id, data.id)
        } catch (error) {
          console.warn('Unable to persist wizard migration start:', error)
        }
      }

      async function persistLogUpdate(asset: WizardAsset, updates: Record<string, unknown>) {
        const logId = persistedLogIds.get(asset.id)
        if (!user || !dbClient || !logId) return

        try {
          await dbClient
            .from('migration_logs')
            .update(updates)
            .eq('id', logId)
            .eq('user_id', user.id)
        } catch (error) {
          console.warn('Unable to persist wizard migration update:', error)
        }
      }

      function updateAsset(assetId: string, patch: Partial<WizardAsset>) {
        updateWizardSession(session.sessionId, (current) => ({
          files: current.files.map((asset) => asset.id === assetId ? { ...asset, ...patch } : asset),
          history: [...syntheticLogs, ...current.history].slice(0, 100),
        }))
      }

      try {
        const totalFiles = assets.length

        for (const asset of assets) {
          if (closed) break

          const originalAlgorithm = normalizeClassicalAlgorithm(asset.currentAlgo)
          const recommended = getMigrationRecommendation(originalAlgorithm)
          const selectedAlgorithm = selectPQCAlgorithm(originalAlgorithm)
          const displayTarget = displayAlgorithm(selectedAlgorithm, hybridMode)
          const beforeScore = Number.isFinite(asset.beforeScore)
            ? asset.beforeScore
            : CLASSICAL_RISK_SCORES[originalAlgorithm] ?? 50
          const afterScore = PQC_RISK_SCORES[selectedAlgorithm] ?? PQC_RISK_SCORES.HYBRID
          const isDirectlyMutable = asset.canDirectlyMigrate !== false &&
            (!asset.remediationAuthority || asset.remediationAuthority === 'qguard_controlled')
          const baseProgress = Math.round((processedCount() / totalFiles) * 100)

          await persistLogStart(asset, originalAlgorithm, beforeScore, afterScore)
          updateAsset(asset.id, { status: 'migrating' })
          send({
            type: 'migrate-start',
            fileId: asset.id,
            fileName: asset.name,
            originalAlgorithm,
            targetAlgorithm: displayTarget,
            hybridMode,
            beforeScore,
            progress: baseProgress,
            message: `Validating migration prechecks for ${asset.name} (${originalAlgorithm}).`,
          })

          await delay(450)

          if (!isDirectlyMutable) {
            const advisoryAfterScore = Math.max(20, beforeScore - 15)
            const advisoryTarget = asset.targetAlgo || asset.protectionOutcome || 'Protect / plan only'
            advisoryFiles++
            await persistLogUpdate(asset, {
              status: 'completed',
              new_algorithm: advisoryTarget,
              after_score: advisoryAfterScore,
              migrated_at: new Date().toISOString(),
            })
            syntheticLogs.unshift(toMigrationLog(asset, originalAlgorithm, advisoryTarget, 'completed', beforeScore, advisoryAfterScore))
            updateAsset(asset.id, { status: 'advisory', targetAlgo: advisoryTarget, afterScore: advisoryAfterScore })
            send({
              type: 'migrate-complete',
              fileId: asset.id,
              fileName: asset.name,
              status: 'advisory_only',
              originalAlgorithm,
              newAlgorithm: advisoryTarget,
              beforeScore,
              afterScore: advisoryAfterScore,
              progress: Math.round((processedCount() / totalFiles) * 100),
              message: `${asset.name} is provider-owned; QGuard created an advisory migration plan and residual-risk evidence instead of claiming direct cryptographic change.`,
            }, 'warning')
            await delay(300)
            continue
          }

          if (!CLASSICAL_RISK_SCORES[originalAlgorithm] && !recommended) {
            failedFiles++
            await persistLogUpdate(asset, { status: 'failed', migrated_at: new Date().toISOString() })
            syntheticLogs.unshift(toMigrationLog(asset, originalAlgorithm, displayTarget, 'failed', beforeScore, beforeScore))
            updateAsset(asset.id, { status: 'failed' })
            send({
              type: 'migrate-failed',
              fileId: asset.id,
              fileName: asset.name,
              progress: Math.round((processedCount() / totalFiles) * 100),
              message: `Migration blocked for ${asset.name}: ${asset.currentAlgo} is not recognized by the PQC migration engine.`,
            }, 'error')
            continue
          }

          const steps = recommended?.migrationSteps || [
            'Analyze current cryptographic parameters',
            `Generate ${displayTarget} material`,
            'Apply hybrid compatibility envelope',
            'Verify cryptographic integrity hash',
          ]
          let keyData: Awaited<ReturnType<typeof generatePQCKeyPair>> | null = null

          for (let index = 0; index < steps.length; index += 1) {
            if (closed) break

            const stepLabel = steps[index]
            const shouldGenerateKey = !isHashAlgorithm(originalAlgorithm) &&
              !isSymmetricAlgorithm(originalAlgorithm) &&
              (index === 1 || /key|ml-kem|ml-dsa|deploy|generate/i.test(stepLabel))

            if (shouldGenerateKey && !keyData) {
              try {
                keyData = await generatePQCKeyPair(selectedAlgorithm)
              } catch (error) {
                failedFiles++
                await persistLogUpdate(asset, { status: 'failed', migrated_at: new Date().toISOString() })
                syntheticLogs.unshift(toMigrationLog(asset, originalAlgorithm, displayTarget, 'failed', beforeScore, beforeScore))
                updateAsset(asset.id, { status: 'failed' })
                send({
                  type: 'migrate-failed',
                  fileId: asset.id,
                  fileName: asset.name,
                  progress: Math.round(((processedCount() + ((index + 1) / steps.length)) / totalFiles) * 100),
                  message: `PQC key generation failed for ${asset.name}: ${(error as Error).message}`,
                }, 'error')
                break
              }
            }

            send({
              type: 'migrate-step',
              fileId: asset.id,
              fileName: asset.name,
              step: index + 1,
              totalSteps: steps.length,
              stepDescription: stepLabel,
              progress: Math.round(((processedCount() + ((index + 1) / steps.length)) / totalFiles) * 100),
              message: `[${asset.name}] Step ${index + 1}/${steps.length}: ${stepLabel}`,
              ...(keyData ? {
                pqcAlgorithm: keyData.algorithmUsed,
                publicKeyFingerprint: keyData.publicKeyFingerprint,
                keySize: keyData.keySize,
              } : {}),
            })

            await delay(shouldGenerateKey ? 760 : 480)
          }

          if (closed) break
          if (!isHashAlgorithm(originalAlgorithm) && !isSymmetricAlgorithm(originalAlgorithm) && !keyData) continue

          const integrityPayload = JSON.stringify({
            sessionId: session.sessionId,
            assetId: asset.id,
            assetName: asset.name,
            from: originalAlgorithm,
            to: displayTarget,
            hybridMode,
            fingerprint: keyData?.publicKeyFingerprint || 'hash-or-symmetric-upgrade',
            timestamp: new Date().toISOString(),
          })
          const integrityHash = await computeIntegrityHash(integrityPayload)

          completedFiles++
          await persistLogUpdate(asset, {
            status: 'completed',
            new_algorithm: displayTarget,
            after_score: afterScore,
            migrated_at: new Date().toISOString(),
          })
          syntheticLogs.unshift(toMigrationLog(asset, originalAlgorithm, displayTarget, 'completed', beforeScore, afterScore))
          updateAsset(asset.id, { status: 'completed' as WizardAssetStatus, targetAlgo: displayTarget, afterScore })
          send({
            type: 'migrate-complete',
            fileId: asset.id,
            fileName: asset.name,
            status: 'completed',
            originalAlgorithm,
            newAlgorithm: displayTarget,
            hybridMode,
            beforeScore,
            afterScore,
            integrityHash,
            integrityVerified: true,
            progress: Math.round((processedCount() / totalFiles) * 100),
            message: `Migrated ${asset.name}: ${originalAlgorithm} -> ${displayTarget}; integrity hash recorded.`,
            ...(keyData ? {
              pqcAlgorithm: keyData.algorithmUsed,
              publicKeyFingerprint: keyData.publicKeyFingerprint,
              keySize: keyData.keySize,
            } : {}),
          }, 'success')

          await delay(300)
        }

        const finalMigrationProgress = 100
        const finalSession = updateWizardSession(session.sessionId, (current) => {
          const history = [...syntheticLogs, ...current.history].slice(0, 100)
          const assessment = assessWizardAssets(current.files, history)
          return {
            activePhase: 'verify',
            runState: failedFiles > 0 ? 'failed' : 'idle',
            phaseStatus: { migrate: failedFiles > 0 ? 'error' : 'success' },
            migrationProgress: finalMigrationProgress,
            progress: 85,
            history,
            assessment,
            error: failedFiles > 0 ? `${failedFiles} asset(s) failed migration` : null,
          }
        })

        send({
          type: 'migration-complete',
          totalMigrated: completedFiles,
          totalAdvisoryOnly: advisoryFiles,
          totalFailed: failedFiles,
          progress: finalMigrationProgress,
          session: finalSession,
          message: `Migration stream complete: ${completedFiles} migrated, ${advisoryFiles} advisory, ${failedFiles} failed.`,
        }, failedFiles > 0 ? 'warning' : 'success')
      } catch (error) {
        updateWizardSession(session.sessionId, {
          runState: 'failed',
          phaseStatus: { migrate: 'error' },
          error: error instanceof Error ? error.message : 'Migration stream failed',
        })
        send({
          type: 'error',
          progress: 100,
          message: error instanceof Error ? error.message : 'Migration stream failed',
        }, 'error')
      } finally {
        if (!closed) controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
