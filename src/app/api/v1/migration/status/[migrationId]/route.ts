import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import {
  enforceMigrationRateLimit,
  loadExecutionBundle,
  MigrationWorkflowError,
} from '@/lib/migration-planner/server-workflows'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ migrationId: string }> },
) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      )
    }

    enforceMigrationRateLimit(user.id, 'status')

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 },
      )
    }

    const { migrationId } = await params
    const bundle = await loadExecutionBundle(client, user.id, migrationId)

    return NextResponse.json({
      status: 'success',
      data: bundle.detail,
    })
  } catch (error) {
    if (error instanceof MigrationWorkflowError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status },
      )
    }
    console.error('GET /api/v1/migration/status/:migrationId error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch migration status' } },
      { status: 500 },
    )
  }
}
