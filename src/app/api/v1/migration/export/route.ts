import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { buildAssessmentPdf } from '@/lib/migration-planner/pdf'
import { mapAssessmentDetail } from '@/lib/migration-planner/records'
import { migrationExportSchema } from '@/lib/migration-planner/validation'
import {
  appendMigrationEvent,
  loadExecutionBundle,
  MigrationWorkflowError,
} from '@/lib/migration-planner/server-workflows'
import type { MigrationAssessmentRecordDetail, MigrationExecutionDetail } from '@/lib/migration-planner/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function assessmentToCsv(detail: MigrationAssessmentRecordDetail): string {
  const rows = [
    ['type', 'name', 'status', 'risk_or_score', 'detail'],
    ['assessment', detail.summary.organizationName, detail.summary.status, detail.summary.overallReadinessScore, detail.summary.recommendedFirstTarget || ''],
    ...(detail.result ? [[
      'selected-pqc-strategy',
      detail.result.selectedEncryptionStrategy.label,
      detail.result.selectedEncryptionStrategy.standard,
      detail.result.selectedEncryptionStrategy.security,
      detail.result.selectedEncryptionStrategy.compatibilityAdvice,
    ], [
      'selected-crypto-stack',
      detail.result.selectedCryptoStrategy.keyExchange.join(' + '),
      detail.result.selectedCryptoStrategy.encryption,
      detail.result.selectedCryptoStrategy.signature.join(' + '),
      detail.result.selectedCryptoStrategy.providerStack.join(' + '),
    ]] : []),
    ...(detail.result?.assetPriorityTable || []).map((asset) => [
      'asset',
      asset.assetName,
      asset.status,
      asset.migrationPriority,
      `${asset.assetType} | ${asset.quantumRiskLevel} | ${asset.recommendedAction}`,
    ]),
    ...(detail.result?.recommendations || []).map((recommendation) => [
      'recommendation',
      recommendation.title,
      recommendation.severity,
      recommendation.type,
      recommendation.detail,
    ]),
  ]
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

function migrationToCsv(detail: MigrationExecutionDetail): string {
  const rows = [
    ['type', 'timestamp', 'status', 'phase', 'asset', 'message'],
    ['execution', detail.summary.createdAt, detail.summary.status, detail.summary.currentPhase || '', detail.summary.currentAssetName || '', `${detail.summary.mode} | ${detail.summary.selectedStrategy}`],
    ['selected-pqc-strategy', detail.summary.createdAt, detail.summary.status, '', '', `${detail.plan.selectedEncryptionStrategy.label} | ${detail.plan.selectedEncryptionStrategy.standard} | ${detail.plan.selectedEncryptionStrategy.security}`],
    ['selected-crypto-stack', detail.summary.createdAt, detail.summary.status, '', '', `${detail.plan.selectedCryptoStrategy.keyExchange.join(' + ')} | ${detail.plan.selectedCryptoStrategy.encryption} | ${detail.plan.selectedCryptoStrategy.signature.join(' + ')}`],
    ...detail.events.map((event) => [
      event.eventType,
      event.createdAt,
      event.status,
      event.phase || '',
      event.assetName || '',
      event.message,
    ]),
    ...detail.rollbacks.map((rollback) => [
      `rollback-${rollback.scope}`,
      rollback.createdAt,
      rollback.status,
      rollback.phase || '',
      rollback.assetName || '',
      rollback.impactSummary || rollback.lastError || '',
    ]),
  ]
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

function buildSimplePdf(lines: string[]): Uint8Array {
  const escapePdfText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const content = ['BT', '/F1 11 Tf', '48 742 Td']
  lines.slice(0, 44).forEach((line, index) => {
    if (index > 0) content.push('0 -15 Td')
    content.push(`(${escapePdfText(line)}) Tj`)
  })
  content.push('ET')
  const stream = content.join('\n')
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${object}\n`
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.forEach((offset) => {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new Uint8Array(Buffer.from(pdf, 'utf8'))
}

function buildMigrationPdf(detail: MigrationExecutionDetail): Uint8Array {
  const lines = [
    'QGuard PQC Migration Execution Report',
    '',
    `Organization: ${detail.summary.organizationName}`,
    `Migration ID: ${detail.summary.id}`,
    `Assessment ID: ${detail.summary.assessmentId}`,
    `Mode: ${detail.summary.mode}`,
    `Selected strategy: ${detail.summary.selectedStrategy}`,
    `PQC encryption: ${detail.plan.selectedEncryptionStrategy.label} (${detail.plan.selectedEncryptionStrategy.standard})`,
    `Key exchange: ${detail.plan.selectedCryptoStrategy.keyExchange.join(' + ')}`,
    `Encryption: ${detail.plan.selectedCryptoStrategy.encryption}`,
    `Signature: ${detail.plan.selectedCryptoStrategy.signature.join(' + ')}`,
    `Hybrid backward compatibility: ${detail.plan.selectedEncryptionStrategy.hybridBackwardCompatibility ? 'Enabled' : 'Disabled'}`,
    `Status: ${detail.summary.status}`,
    `Progress: ${detail.summary.progress}%`,
    `Assets included: ${detail.summary.assetsIncluded}`,
    `Rollback checkpoints: ${detail.summary.rollbackCheckpointsCount}`,
    `Started: ${detail.summary.startedAt || detail.summary.createdAt}`,
    `Completed: ${detail.summary.completedAt || 'Not completed'}`,
    '',
    'Latest Audit Events',
    ...detail.events.slice(-24).map((event) => `${event.createdAt} | ${event.status} | ${event.phase || '-'} | ${event.assetName || '-'} | ${event.message}`),
    '',
    'Final Recommendations',
    ...detail.summary.finalRecommendations.map((item) => `- ${item}`),
  ]
  return buildSimplePdf(lines)
}

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

    const body = await request.json()
    const parsed = migrationExportSchema.safeParse(body)

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: issue?.message || 'Invalid export request' } },
        { status: 400 },
      )
    }

    const { assessmentId, migrationId, format } = parsed.data

    if (!assessmentId && !migrationId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'assessmentId or migrationId is required' } },
        { status: 400 },
      )
    }

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 },
      )
    }

    if (migrationId) {
      const bundle = await loadExecutionBundle(client, user.id, migrationId)
      await appendMigrationEvent(client, {
        migrationId,
        userId: user.id,
        eventType: 'export',
        status: bundle.execution.status,
        message: `Migration report exported as ${format.toUpperCase()}.`,
        metadata: { format },
      })
      const refreshed = await loadExecutionBundle(client, user.id, migrationId)
      const filenameBase = `qguard-pqc-migration-execution-${migrationId.slice(0, 8)}`

      if (format === 'pdf') {
        const pdf = buildMigrationPdf(refreshed.detail)
        return new Response(new Blob([Buffer.from(pdf)], { type: 'application/pdf' }), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
            'Cache-Control': 'no-store',
          },
        })
      }

      if (format === 'csv') {
        return new Response(migrationToCsv(refreshed.detail), {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
            'Cache-Control': 'no-store',
          },
        })
      }

      return new Response(JSON.stringify(refreshed.detail, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filenameBase}.json"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const { data, error } = await client
      .from('migration_assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Assessment not found' } },
        { status: 404 },
      )
    }

    const detail = mapAssessmentDetail(data)
    const filenameBase = `${detail.summary.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${assessmentId.slice(0, 8)}`

    if (format === 'pdf') {
      const pdf = Uint8Array.from(buildAssessmentPdf(detail))
      const body = new Blob([Buffer.from(pdf)], { type: 'application/pdf' })
      return new Response(body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    if (format === 'csv') {
      return new Response(assessmentToCsv(detail), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    return new Response(JSON.stringify(detail, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filenameBase}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof MigrationWorkflowError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: error.status },
      )
    }
    console.error('POST /api/v1/migration/export error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to export migration assessment' } },
      { status: 500 },
    )
  }
}
