import { NextRequest, NextResponse } from 'next/server'
import {
  runWizardDiscovery,
  sanitizeDiscoveryInput,
} from '@/lib/migration-wizard/discovery'
import { getServerUser } from '@/lib/server-auth'
import {
  getOrCreateWizardSession,
  recordWizardEvent,
  sanitizeTargets,
  updateWizardSession,
} from '@/lib/migration-wizard/session-store'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let sessionIdForError: string | null = null

  try {
    const body = await request.json().catch(() => ({}))
    const user = await getServerUser(request)
    const targetKeys = sanitizeTargets(body.targets)
    const assetInput = sanitizeDiscoveryInput(body.assetInput)
    const session = getOrCreateWizardSession({
      sessionId: body.sessionId,
      userId: user?.id,
      selectedTargets: targetKeys,
      assetInput,
    })
    sessionIdForError = session.sessionId

    updateWizardSession(session.sessionId, {
      selectedTargets: targetKeys,
      assetInput,
      activePhase: 'discover',
      runState: 'discovering',
      phaseStatus: { discover: 'running' },
      progress: 5,
      error: null,
    })
    recordWizardEvent(session.sessionId, 'discover', `Discovery started across ${targetKeys.length} target selector(s).`, 'info', 5)

    const result = runWizardDiscovery(targetKeys, assetInput)
    const progress = result.files.length ? 25 : 15
    const updatedSession = updateWizardSession(session.sessionId, {
      selectedTargets: targetKeys,
      assetInput,
      activePhase: 'discover',
      runState: 'idle',
      phaseStatus: {
        discover: 'success',
        assess: 'idle',
        migrate: 'idle',
        verify: 'idle',
      },
      progress,
      migrationProgress: 0,
      files: result.files,
      assessment: null,
      verification: null,
      error: null,
    })
    recordWizardEvent(
      session.sessionId,
      'discover',
      `Discovery completed: ${result.scan.totalFindings} finding(s), ${result.files.length} migration candidate(s).`,
      'success',
      progress,
    )

    return NextResponse.json({
      status: 'success',
      data: {
        phase: 'discover',
        sessionId: updatedSession.sessionId,
        files: result.files,
        scan: result.scan,
        targets: result.targets,
        session: updatedSession,
      },
    })
  } catch (error) {
    console.error('Wizard discovery error:', error)
    if (sessionIdForError) {
      updateWizardSession(sessionIdForError, {
        runState: 'failed',
        phaseStatus: { discover: 'error' },
        error: 'Failed to discover migration assets',
      })
      recordWizardEvent(sessionIdForError, 'discover', 'Failed to discover migration assets', 'error', 0)
    }
    return NextResponse.json(
      { error: { code: 'DISCOVERY_ERROR', message: 'Failed to discover migration assets' } },
      { status: 500 },
    )
  }
}
