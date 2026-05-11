import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import {
  appendMigrationPlanAuditEvents,
  getMigrationPlanAuditTrail,
} from '@/lib/migration-planner/audit'
import type { RiskLevel } from '@/lib/migration-planner/types'
import type { MigrationAssessmentRow } from '@/types/database.types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_EVENT_TYPES = new Set([
  'assets-loaded-into-wizard',
  'simulation-initialized-from-plan',
  'migration-details-reviewed',
  'migration-details-edited',
])
const RISK_LEVELS = new Set<RiskLevel>(['Critical', 'High', 'Medium', 'Low'])

async function getContext(
  request: NextRequest,
  assessmentId: string,
) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) {
    return { error: NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, { status: 401 }) }
  }

  const client = createAuthClient(token)
  if (!client) {
    return { error: NextResponse.json({ error: { code: 'CONFIG_ERROR', message: 'Service not configured' } }, { status: 500 }) }
  }

  const { data, error } = await client
    .from('migration_assessments')
    .select('id,user_id,summary_json')
    .eq('id', assessmentId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) {
    return { error: NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Assessment not found' } }, { status: 404 }) }
  }

  return { client, user, row: data as Pick<MigrationAssessmentRow, 'id' | 'user_id' | 'summary_json'> }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const context = await getContext(request, id)
    if (context.error) return context.error

    return NextResponse.json({
      status: 'success',
      data: getMigrationPlanAuditTrail(context.row.summary_json),
    })
  } catch (error) {
    console.error('GET /api/v1/migration/assessments/:id/audit error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load migration plan audit trail' } },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const context = await getContext(request, id)
    if (context.error) return context.error

    const body = await request.json().catch(() => ({})) as {
      eventType?: string
      actionPerformed?: string
      status?: string
      selectedPqcStrategy?: string
      migrationMode?: 'phased' | 'full'
      affectedAssets?: unknown[]
      metadata?: Record<string, unknown>
    }

    if (!body.eventType || !ALLOWED_EVENT_TYPES.has(body.eventType)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Unsupported audit event type' } },
        { status: 400 },
      )
    }

    const affectedAssets = Array.isArray(body.affectedAssets)
      ? body.affectedAssets
        .map((item) => item && typeof item === 'object' ? item as Record<string, unknown> : null)
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          assetId: typeof item.assetId === 'string' ? item.assetId : '',
          assetName: typeof item.assetName === 'string' ? item.assetName : 'Unknown asset',
          assetType: typeof item.assetType === 'string' ? item.assetType : undefined,
          riskLevel: typeof item.riskLevel === 'string' && RISK_LEVELS.has(item.riskLevel as RiskLevel)
            ? item.riskLevel as RiskLevel
            : undefined,
        }))
      : []

    const auditTrail = await appendMigrationPlanAuditEvents(context.client, context.user.id, id, [{
      eventType: body.eventType,
      actionPerformed: body.actionPerformed || body.eventType,
      status: body.status || 'completed',
      selectedPqcStrategy: body.selectedPqcStrategy || 'Not selected',
      migrationMode: body.migrationMode,
      affectedAssets,
      metadata: body.metadata || {},
    }])

    return NextResponse.json({
      status: 'success',
      data: auditTrail,
    })
  } catch (error) {
    console.error('POST /api/v1/migration/assessments/:id/audit error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to record migration plan audit event' } },
      { status: 500 },
    )
  }
}
