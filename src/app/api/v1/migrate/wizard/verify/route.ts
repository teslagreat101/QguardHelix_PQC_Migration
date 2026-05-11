import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import {
  mergeAssetsWithLogs,
  type WizardAsset,
  type WizardMigrationLog,
  verifyWizardAssets,
} from '@/lib/migration-wizard/workflow'
import {
  getOrCreateWizardSession,
  recordWizardEvent,
  updateWizardSession,
} from '@/lib/migration-wizard/session-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let sessionIdForError: string | null = null

  try {
    const body = await request.json()
    const user = await getServerUser(request)
    const session = getOrCreateWizardSession({ sessionId: body.sessionId, userId: user?.id })
    sessionIdForError = session.sessionId

    updateWizardSession(session.sessionId, {
      activePhase: 'verify',
      runState: 'verifying',
      phaseStatus: { verify: 'running' },
      progress: 88,
      error: null,
    })
    recordWizardEvent(session.sessionId, 'verify', 'Verification started: checking migration state, integrity, and compliance evidence.', 'info', 88)

    const assets = Array.isArray(body.assets) && body.assets.length
      ? body.assets as WizardAsset[]
      : session.files
    if (assets.length === 0) {
      updateWizardSession(session.sessionId, {
        runState: 'failed',
        phaseStatus: { verify: 'error' },
        error: 'At least one asset is required for verification',
      })
      recordWizardEvent(session.sessionId, 'verify', 'Verification blocked: no assets are available.', 'error', 88)
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'At least one asset is required for verification' } },
        { status: 400 },
      )
    }

    const submittedLogs = Array.isArray(body.logs) ? body.logs as WizardMigrationLog[] : []
    const storedLogs = await loadMigrationLogs(request)
    const logs = storedLogs.length ? storedLogs : submittedLogs
    const verification = verifyWizardAssets(assets, logs)
    const merged = mergeAssetsWithLogs(assets, logs)
    const updatedSession = updateWizardSession(session.sessionId, {
      activePhase: 'verify',
      runState: verification.verified ? 'completed' : 'failed',
      phaseStatus: {
        verify: verification.verified ? 'success' : 'error',
      },
      progress: verification.verified ? 100 : Math.max(88, verification.complianceScore),
      files: merged,
      history: logs,
      verification,
      error: verification.verified ? null : 'Verification found blocked checks',
    })
    recordWizardEvent(
      session.sessionId,
      'verify',
      verification.verified
        ? `Verification passed: compliance ${verification.complianceScore}%, integrity ${verification.integrityScore}%.`
        : `Verification found blocked checks: ${verification.failedAssets} failed, ${verification.pendingAssets} pending.`,
      verification.verified ? 'success' : 'warning',
      updatedSession.progress,
    )

    return NextResponse.json({
      status: 'success',
      data: {
        phase: 'verify',
        sessionId: updatedSession.sessionId,
        verification,
        logs: logs.slice(0, 20),
        files: merged,
        session: updatedSession,
      },
    })
  } catch (error) {
    console.error('Wizard verification error:', error)
    if (sessionIdForError) {
      updateWizardSession(sessionIdForError, {
        activePhase: 'verify',
        runState: 'failed',
        phaseStatus: { verify: 'error' },
        error: 'Failed to verify migration results',
      })
      recordWizardEvent(sessionIdForError, 'verify', 'Failed to verify migration results', 'error', 88)
    }
    return NextResponse.json(
      { error: { code: 'VERIFICATION_ERROR', message: 'Failed to verify migration results' } },
      { status: 500 },
    )
  }
}

async function loadMigrationLogs(request: NextRequest): Promise<WizardMigrationLog[]> {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!token || !user) return []

  const client = createAuthClient(token)
  if (!client) return []

  const { data } = await client
    .from('migration_logs')
    .select('id, file_name, original_algorithm, new_algorithm, hybrid_mode, status, before_score, after_score, migrated_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (data || []) as WizardMigrationLog[]
}
