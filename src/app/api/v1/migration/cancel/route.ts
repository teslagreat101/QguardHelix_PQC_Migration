import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import {
  appendMigrationEvent,
  enforceMigrationRateLimit,
  loadExecutionBundle,
  MigrationWorkflowError,
} from '@/lib/migration-planner/server-workflows'
import { isActiveMigrationStatus } from '@/lib/migration-planner/execution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      )
    }

    enforceMigrationRateLimit(user.id, 'cancel')

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 },
      )
    }

    const body = await request.json()
    const migrationId = typeof body.migrationId === 'string' ? body.migrationId : ''
    if (!migrationId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'migrationId is required' } },
        { status: 400 },
      )
    }

    const bundle = await loadExecutionBundle(client, user.id, migrationId)
    if (!isActiveMigrationStatus(bundle.execution.status)) {
      return NextResponse.json(
        { error: { code: 'NOT_ACTIVE', message: `Cannot cancel a ${bundle.execution.status} migration` } },
        { status: 409 },
      )
    }

    await client
      .from('migration_executions')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', migrationId)
      .eq('user_id', user.id)

    await appendMigrationEvent(client, {
      migrationId,
      userId: user.id,
      eventType: 'cancelled',
      status: 'cancelled',
      message: 'Migration cancellation requested by authorized user.',
    })

    return NextResponse.json({
      status: 'success',
      data: (await loadExecutionBundle(client, user.id, migrationId)).detail,
    })
  } catch (error) {
    if (error instanceof MigrationWorkflowError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status },
      )
    }
    console.error('POST /api/v1/migration/cancel error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel migration' } },
      { status: 500 },
    )
  }
}
