import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { migrationRollbackSchema } from '@/lib/migration-planner/validation'
import {
  enforceMigrationRateLimit,
  executeRollbackWorkflow,
  MigrationWorkflowError,
} from '@/lib/migration-planner/server-workflows'

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

    enforceMigrationRateLimit(user.id, 'rollback-asset')

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 },
      )
    }

    const body = await request.json()
    const parsed = migrationRollbackSchema.safeParse({ ...body, scope: 'asset' })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: issue?.message || 'Invalid asset rollback request' } },
        { status: 400 },
      )
    }

    if (!parsed.data.assetId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'assetId is required for asset rollback' } },
        { status: 400 },
      )
    }

    const data = await executeRollbackWorkflow(client, user.id, parsed.data)
    return NextResponse.json({ status: 'success', data })
  } catch (error) {
    if (error instanceof MigrationWorkflowError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status },
      )
    }
    console.error('POST /api/v1/migration/rollback-asset error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to rollback migration asset' } },
      { status: 500 },
    )
  }
}
