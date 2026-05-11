import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import {
  assessWizardAssets,
  mergeAssetsWithLogs,
  type WizardAsset,
  type WizardMigrationLog,
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
      activePhase: 'assess',
      runState: 'assessing',
      phaseStatus: { assess: 'running' },
      progress: 30,
      error: null,
    })
    recordWizardEvent(session.sessionId, 'assess', 'Compatibility and quantum risk assessment started.', 'info', 30)

    const assets = Array.isArray(body.assets) && body.assets.length
      ? body.assets as WizardAsset[]
      : session.files
    if (assets.length === 0) {
      updateWizardSession(session.sessionId, {
        runState: 'failed',
        phaseStatus: { assess: 'error' },
        error: 'At least one discovered asset is required for assessment',
      })
      recordWizardEvent(session.sessionId, 'assess', 'Assessment blocked: no discovered assets are available.', 'error', 30)
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'At least one discovered asset is required for assessment' } },
        { status: 400 },
      )
    }

    const submittedLogs = Array.isArray(body.logs) ? body.logs as WizardMigrationLog[] : []
    const storedLogs = await loadMigrationLogs(request)
    const logs = storedLogs.length ? storedLogs : submittedLogs
    const assessment = assessWizardAssets(assets, logs)
    const merged = mergeAssetsWithLogs(assets, logs)
    const updatedSession = updateWizardSession(session.sessionId, {
      activePhase: 'assess',
      runState: 'idle',
      phaseStatus: { discover: 'success', assess: 'success' },
      progress: 45,
      files: merged,
      history: logs,
      assessment,
      error: null,
    })
    recordWizardEvent(
      session.sessionId,
      'assess',
      `Assessment complete: readiness ${assessment.readinessScore}%, ${assessment.needMigration} asset(s) need migration.`,
      'success',
      45,
    )

    return NextResponse.json({
      status: 'success',
      data: {
        phase: 'assess',
        sessionId: updatedSession.sessionId,
        assessment,
        logs: logs.slice(0, 20),
        files: merged,
        session: updatedSession,
      },
    })
  } catch (error) {
    console.error('Wizard assessment error:', error)
    if (sessionIdForError) {
      updateWizardSession(sessionIdForError, {
        activePhase: 'assess',
        runState: 'failed',
        phaseStatus: { assess: 'error' },
        error: 'Failed to assess migration readiness',
      })
      recordWizardEvent(sessionIdForError, 'assess', 'Failed to assess migration readiness', 'error', 30)
    }
    return NextResponse.json(
      { error: { code: 'ASSESSMENT_ERROR', message: 'Failed to assess migration readiness' } },
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
