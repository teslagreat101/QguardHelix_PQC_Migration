import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { appendMigrationPlanAuditEvents } from '@/lib/migration-planner/audit'
import { validateMigrationReadiness } from '@/lib/migration-planner/execution'
import {
  loadAssessmentForUser,
  MigrationWorkflowError,
} from '@/lib/migration-planner/server-workflows'
import type { MigrationMode } from '@/lib/migration-planner/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 },
      )
    }

    const { id } = await params
    const body = await request.json().catch(() => ({})) as {
      action?: string
      mode?: MigrationMode
      strategyReviewed?: boolean
      fullMigrationRiskAccepted?: boolean
    }
    const mode: MigrationMode = body.mode === 'full' ? 'full' : 'phased'
    const action = body.action === 'migrate-now' ? 'Migrate Now' : 'Ready to Migrate'
    const { detail } = await loadAssessmentForUser(client, user.id, id)

    if (detail.summary.status !== 'completed' || !detail.result) {
      return NextResponse.json(
        { error: { code: 'ASSESSMENT_NOT_READY', message: 'Generate and complete the migration plan before opening the Migration Wizard.' } },
        { status: 409 },
      )
    }

    if (!body.strategyReviewed) {
      return NextResponse.json(
        { error: { code: 'STRATEGY_NOT_REVIEWED', message: 'Review and confirm the recommended strategy before continuing to the Migration Wizard.' } },
        { status: 400 },
      )
    }

    if (mode === 'full' && !body.fullMigrationRiskAccepted) {
      return NextResponse.json(
        { error: { code: 'FULL_MIGRATION_CONFIRMATION_REQUIRED', message: 'Full migration requires explicit rollback and risk acknowledgement.' } },
        { status: 400 },
      )
    }

    const validation = validateMigrationReadiness(detail, mode)
    if (!validation.canStart) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_FAILED', message: 'Migration readiness validation failed.', details: validation } },
        { status: 422 },
      )
    }

    const priorityById = new Map(detail.result.assetPriorityTable.map((asset) => [asset.assetId, asset]))
    const affectedAssets = detail.input.assets.map((asset) => {
      const priority = priorityById.get(asset.id)
      return {
        assetId: asset.id,
        assetName: asset.assetName,
        assetType: asset.assetType,
        riskLevel: priority?.priorityLabel,
        businessCriticality: asset.businessCriticality,
        dataSensitivity: asset.dataSensitivity,
      }
    })
    const selectedPqcStrategy = detail.result.selectedEncryptionStrategy.label
    const auditTrail = await appendMigrationPlanAuditEvents(client, user.id, id, [
      {
        eventType: 'migration-readiness-validation-completed',
        actionPerformed: 'Migration readiness validation completed',
        status: 'completed',
        affectedAssets,
        selectedPqcStrategy,
        migrationMode: mode,
        metadata: {
          assessmentId: id,
          blockers: validation.blockers.length,
          warnings: validation.warnings.length,
          passed: validation.passed.length,
          rollbackAvailable: validation.rollbackAvailable,
        },
      },
      {
        eventType: body.action === 'migrate-now' ? 'migrate-now-selected' : 'ready-to-migrate-selected',
        actionPerformed: `${action} selected in PQC Migration Planner`,
        status: 'completed',
        affectedAssets,
        selectedPqcStrategy,
        migrationMode: mode,
        metadata: {
          assessmentId: id,
          sourceRoute: '/dashboard/migrate/pqc-planner',
          destinationRoute: '/dashboard/migrate/wizard',
        },
      },
      {
        eventType: 'migration-plan-transferred-to-wizard',
        actionPerformed: 'Migration plan transferred to Migration Wizard',
        status: 'completed',
        affectedAssets,
        selectedPqcStrategy,
        migrationMode: mode,
        metadata: {
          assessmentId: id,
          migrationPlanId: id,
          assetCount: affectedAssets.length,
          selectedCryptoStack: detail.result.selectedCryptoStrategy.keyExchange.join(' + '),
        },
      },
    ])

    return NextResponse.json({
      status: 'success',
      data: {
        migrationPlanId: id,
        assessmentId: id,
        auditTrail,
      },
    })
  } catch (error) {
    if (error instanceof MigrationWorkflowError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status },
      )
    }
    console.error('POST /api/v1/migration/assessments/:id/handoff error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to transfer migration plan to wizard' } },
      { status: 500 },
    )
  }
}
