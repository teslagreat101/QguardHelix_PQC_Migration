/**
 * QGuard Integration Engine — Connector Detail API
 *
 * GET /api/v1/integrations/engine/[connectorId] — Detailed status, logs, events
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { getConnectorDetail, getIntegrationLogs } from '@/lib/integrations/integration-engine'
import type { SubscriptionTier } from '@/types/api.types'

async function resolveAuth(request: NextRequest) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) return { userId: null, authClient: null }
  const authClient = createAuthClient(token)
  if (!authClient) return { userId: null, authClient: null }
  return { userId: user.id, authClient }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ connectorId: string }> }
) {
  try {
    const { userId, authClient } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { connectorId } = await params

    const detail = await getConnectorDetail(userId, connectorId, authClient)
    if (!detail) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Connector not found: ${connectorId}` } },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: detail })
  } catch (err) {
    console.error('Connector detail error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch connector detail' } },
      { status: 500 }
    )
  }
}
