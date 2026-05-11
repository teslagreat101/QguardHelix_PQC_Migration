import { NextRequest, NextResponse } from 'next/server'
import { sanitizeDiscoveryInput } from '@/lib/migration-wizard/discovery'
import { getServerUser } from '@/lib/server-auth'
import {
  createWizardSession,
  getOrCreateWizardSession,
  getWizardSession,
  sanitizeTargets,
  updateWizardSession,
} from '@/lib/migration-wizard/session-store'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const requestedSessionId = searchParams.get('sessionId')
  const user = await getServerUser(request)
  const session = requestedSessionId
    ? getWizardSession(requestedSessionId)
    : createWizardSession({ userId: user?.id })

  if (!session) {
    return NextResponse.json(
      { error: { code: 'SESSION_NOT_FOUND', message: 'Migration wizard session was not found' } },
      { status: 404 },
    )
  }

  return NextResponse.json({ status: 'success', data: { session } })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const user = await getServerUser(request)
  const session = getOrCreateWizardSession({
    sessionId: body.sessionId,
    userId: user?.id,
  })
  const selectedTargets = body.selectedTargets === undefined
    ? session.selectedTargets
    : sanitizeTargets(body.selectedTargets)
  const assetInput = body.assetInput === undefined
    ? session.assetInput
    : sanitizeDiscoveryInput(body.assetInput)

  const updatedSession = updateWizardSession(session.sessionId, {
    selectedTargets,
    assetInput,
    activePhase: body.activePhase || session.activePhase,
  })

  return NextResponse.json({ status: 'success', data: { session: updatedSession } })
}
