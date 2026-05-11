import { NextRequest } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { analyzeMigrationAssessment } from '@/lib/migration-planner/analysis'
import { appendEventsToSummary } from '@/lib/migration-planner/audit'
import { encryptAssessmentPayload } from '@/lib/migration-planner/crypto'
import { mapAssessmentDetail, mapAssessmentSummary } from '@/lib/migration-planner/records'
import { getServerUserFromToken, getTokenFromHeaderOrQuery } from '@/lib/server-auth'
import type { MigrationExecutionRow } from '@/types/database.types'
import {
  appendMigrationEvent,
  loadExecutionBundle,
} from '@/lib/migration-planner/server-workflows'
import {
  buildExecutionTasks,
  isTerminalMigrationStatus,
  mapExecutionSummary,
} from '@/lib/migration-planner/execution'
import { buildSelectedEncryptionStrategy } from '@/lib/migration-planner/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function eventSeverity(eventType: string, status: string, metadata?: Record<string, unknown>): 'info' | 'success' | 'warning' | 'error' | 'debug' {
  const severity = metadata?.severity
  if (severity === 'info' || severity === 'success' || severity === 'warning' || severity === 'error' || severity === 'debug') {
    return severity
  }
  if (status === 'failed' || eventType === 'error') return 'error'
  if (eventType === 'risk-event') return 'warning'
  if (status === 'completed' || eventType.includes('completed') || eventType.includes('validated') || eventType.includes('created') || eventType.includes('confirmed')) {
    return 'success'
  }
  return 'info'
}

function eventDelay(eventType: string): number {
  if (eventType === 'risk-event') return 900
  if (eventType === 'migration-task') return 1450
  if (eventType.includes('validation') || eventType.includes('validated')) return 1200
  if (eventType.includes('checkpoint')) return 1300
  if (eventType.includes('simulation')) return 1500
  if (eventType === 'complete') return 600
  return 950
}

async function streamMigrationExecution(
  client: NonNullable<ReturnType<typeof createAuthClient>>,
  userId: string,
  migrationId: string,
): Promise<Response> {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let clientDisconnected = false

      const send = (payload: Record<string, unknown>) => {
        if (clientDisconnected) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {
          clientDisconnected = true
        }
      }

      try {
        let bundle = await loadExecutionBundle(client, userId, migrationId)
        const tasks = buildExecutionTasks(bundle.detail.plan)
        const totalSteps = Math.max(tasks.length, 1)

        send({
          type: 'migration-status',
          migrationId,
          timestamp: new Date().toISOString(),
          phase: bundle.execution.current_phase || 'Migration session',
          status: bundle.execution.status,
          severity: 'info',
          asset: bundle.execution.current_asset_name,
          message: `Loaded migration ${migrationId.slice(0, 8)} at ${bundle.execution.status} status.`,
          execution: bundle.detail,
          progress: bundle.execution.progress,
        })

        if (bundle.execution.total_steps !== totalSteps) {
          await client
            .from('migration_executions')
            .update({
              total_steps: totalSteps,
              estimated_remaining_steps: Math.max(totalSteps - bundle.execution.completed_steps, 0),
              updated_at: new Date().toISOString(),
            })
            .eq('id', migrationId)
            .eq('user_id', userId)
        }

        if (isTerminalMigrationStatus(bundle.execution.status)) {
          send({
            type: 'migration-complete',
            migrationId,
            timestamp: new Date().toISOString(),
            phase: bundle.execution.current_phase || 'Final migration summary',
            status: bundle.execution.status,
            severity: bundle.execution.status === 'failed' ? 'error' : 'success',
            asset: bundle.execution.current_asset_name,
            message: `Migration is already ${bundle.execution.status}.`,
            execution: bundle.detail,
            progress: bundle.execution.progress,
          })
          controller.close()
          return
        }

        const startIndex = Math.min(bundle.execution.completed_steps, totalSteps)

        for (let index = startIndex; index < tasks.length; index += 1) {
          bundle = await loadExecutionBundle(client, userId, migrationId)

          if (bundle.execution.status === 'cancelled' || bundle.execution.status === 'rolled_back') {
            send({
              type: 'migration-stopped',
              migrationId,
              timestamp: new Date().toISOString(),
              phase: bundle.execution.current_phase || 'Migration session',
              status: bundle.execution.status,
              severity: 'warning',
              asset: bundle.execution.current_asset_name,
              message: `Migration stopped with ${bundle.execution.status} status.`,
              execution: bundle.detail,
              progress: bundle.execution.progress,
            })
            controller.close()
            return
          }

          const task = tasks[index]
          const completedSteps = index + 1
          const progress = Math.min(100, Math.round((completedSteps / totalSteps) * 100))
          const completedAt = completedSteps >= totalSteps ? new Date().toISOString() : null
          const riskEvents = tasks.slice(0, completedSteps).filter((item) => item.eventType === 'risk-event').length
          const warnings = (bundle.detail.validation.warnings?.length || 0) +
            tasks.slice(0, completedSteps).filter((item) => item.eventType === 'warning').length

          const { data: updated, error: updateError } = await client
            .from('migration_executions')
            .update({
              status: task.status === 'completed' ? 'completed' : task.status,
              current_phase: task.phase,
              current_asset_id: task.assetId,
              current_asset_name: task.assetName,
              progress,
              completed_steps: completedSteps,
              failed_steps: 0,
              warnings_count: warnings,
              risk_events_count: riskEvents,
              estimated_remaining_steps: Math.max(totalSteps - completedSteps, 0),
              completed_at: completedAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', migrationId)
            .eq('user_id', userId)
            .select('*')
            .single()

          if (updateError || !updated) {
            throw new Error(updateError?.message || 'Failed to update migration execution state')
          }

          const severity = eventSeverity(task.eventType, task.status, task.metadata)
          const eventMetadata = {
            ...task.metadata,
            severity,
            progress,
            migrationId,
            estimatedRemainingSteps: Math.max(totalSteps - completedSteps, 0),
          }

          await appendMigrationEvent(client, {
            migrationId,
            userId,
            eventType: task.eventType,
            status: task.status,
            phase: task.phase,
            assetId: task.assetId,
            assetName: task.assetName,
            message: task.message,
            metadata: eventMetadata,
          })

          bundle = await loadExecutionBundle(client, userId, migrationId)

          send({
            type: task.eventType,
            migrationId,
            timestamp: new Date().toISOString(),
            progress,
            status: task.status,
            phase: task.phase,
            severity,
            asset: task.assetName,
            assetId: task.assetId,
            assetName: task.assetName,
            message: task.message,
            metadata: eventMetadata,
            execution: {
              ...bundle.detail,
              summary: mapExecutionSummary(updated as MigrationExecutionRow),
            },
          })

          await delay(eventDelay(task.eventType))
        }

        const completedBundle = await loadExecutionBundle(client, userId, migrationId)
        send({
          type: 'migration-complete',
          migrationId,
          timestamp: new Date().toISOString(),
          phase: 'Final migration summary',
          status: completedBundle.detail.summary.status,
          severity: 'success',
          asset: completedBundle.detail.summary.currentAssetName,
          progress: 100,
          message: 'Migration execution complete.',
          execution: completedBundle.detail,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Migration execution stream failed'
        await client
          .from('migration_executions')
          .update({
            status: 'failed',
            last_error: message,
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', migrationId)
          .eq('user_id', userId)

        await appendMigrationEvent(client, {
          migrationId,
          userId,
          eventType: 'error',
          status: 'failed',
          message,
          metadata: { severity: 'error', migrationId },
        }).catch(() => undefined)

        send({
          type: 'error',
          migrationId,
          progress: 100,
          status: 'failed',
          phase: 'Migration execution',
          severity: 'error',
          timestamp: new Date().toISOString(),
          message,
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const token = getTokenFromHeaderOrQuery(request)
  const user = token ? await getServerUserFromToken(token) : null

  if (!token || !user) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Authentication required' })}\n\n`,
      { status: 401, headers: { 'Content-Type': 'text/event-stream' } },
    )
  }

  const client = createAuthClient(token)
  if (!client) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Service not configured' })}\n\n`,
      { status: 500, headers: { 'Content-Type': 'text/event-stream' } },
    )
  }

  const { assessmentId } = await params
  const { data: executionCandidate } = await client
    .from('migration_executions')
    .select('*')
    .eq('id', assessmentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (executionCandidate) {
    return streamMigrationExecution(client, user.id, assessmentId)
  }

  const { data: assessment, error } = await client
    .from('migration_assessments')
    .select('*')
    .eq('id', assessmentId)
    .eq('user_id', user.id)
    .single()

  if (error || !assessment) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Assessment not found' })}\n\n`,
      { status: 404, headers: { 'Content-Type': 'text/event-stream' } },
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let clientDisconnected = false

      const send = (payload: Record<string, unknown>) => {
        if (clientDisconnected) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {
          clientDisconnected = true
        }
      }

      try {
        const detail = mapAssessmentDetail(assessment)

        if (detail.result && assessment.status === 'completed') {
          send({
            type: 'analysis-complete',
            progress: 100,
            assessment: detail.summary,
            result: detail.result,
            timestamp: new Date().toISOString(),
            message: 'Assessment already completed. Loaded latest result.',
          })
          controller.close()
          return
        }

        const selectedCryptoStrategy = detail.input.selectedCryptoStrategy
        const selectedLabel = detail.result?.selectedEncryptionStrategy.label || buildSelectedEncryptionStrategy(detail.input.encryptionStrategy).label
        const stages = [
          { key: 'validating', progress: 10, message: `Validating selected PQC encryption strategy: ${selectedLabel}...` },
          { key: 'inventory', progress: 22, message: 'Normalizing cryptographic inventory and identifying quantum-vulnerable dependencies...' },
          { key: 'ml-kem', progress: 34, message: `Checking ML-KEM migration compatibility for ${selectedCryptoStrategy.keyExchange.join(' + ')}...` },
          { key: 'ml-dsa', progress: 46, message: `Evaluating ML-DSA certificate/signature readiness with ${selectedCryptoStrategy.signature.join(' + ')}...` },
          { key: 'hybrid', progress: 58, message: `Assessing hybrid ${selectedCryptoStrategy.keyExchange.join(' + ')} deployment model and backward compatibility...` },
          { key: 'encryption', progress: 68, message: `Generating ${selectedCryptoStrategy.encryption} data protection recommendations with unique nonce/key requirements...` },
          { key: 'scoring', progress: 78, message: 'Calculating weighted risk, criticality, selected-algorithm fit, and migration priority scores...' },
          { key: 'roadmap', progress: 88, message: 'Building algorithm-specific migration roadmap, compatibility warnings, rollback notes, and implementation guidance...' },
          { key: 'history', progress: 94, message: 'Saving cryptographic strategy to migration history and encrypted assessment records...' },
        ]

        await client
          .from('migration_assessments')
          .update({
            status: 'analyzing',
            progress_stage: 'Assessment started',
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assessmentId)
          .eq('user_id', user.id)

        for (const stage of stages) {
          await client
            .from('migration_assessments')
            .update({
              status: 'analyzing',
              progress_stage: stage.message,
              updated_at: new Date().toISOString(),
            })
            .eq('id', assessmentId)
            .eq('user_id', user.id)

          send({
            type: 'analysis-progress',
            stage: stage.key,
            progress: stage.progress,
            timestamp: new Date().toISOString(),
            message: stage.message,
            selectedCryptoStrategy,
          })
          await delay(240)
        }

        const result = analyzeMigrationAssessment(detail.input)
        const encrypted = encryptAssessmentPayload({ input: detail.input, result })
        const summary = result.migrationSummary
        const auditSummary = appendEventsToSummary(assessment.summary_json || {}, user.id, assessmentId, [{
          eventType: 'migration-plan-generated',
          actionPerformed: 'Migration plan generated',
          status: 'completed',
          affectedAssets: result.assetPriorityTable.map((asset) => ({
            assetId: asset.assetId,
            assetName: asset.assetName,
            assetType: asset.assetType,
            riskLevel: asset.priorityLabel,
            businessCriticality: asset.criticality,
          })),
          selectedPqcStrategy: result.selectedEncryptionStrategy.label,
          metadata: {
            assessmentId,
            totalAssets: summary.totalAssetsAnalyzed,
            criticalAssets: summary.criticalAssetsIdentified,
            quantumReadinessScore: summary.overallQuantumReadinessScore,
            estimatedMigrationComplexity: summary.estimatedMigrationComplexity,
            generatedAt: result.generatedAt,
          },
        }])

        const { data: updatedAssessment, error: updateError } = await client
          .from('migration_assessments')
          .update({
            status: 'completed',
            total_assets: summary.totalAssetsAnalyzed,
            critical_assets: summary.criticalAssetsIdentified,
            high_risk_dependencies: summary.highRiskCryptographicDependencies,
            overall_readiness_score: summary.overallQuantumReadinessScore,
            estimated_migration_complexity: summary.estimatedMigrationComplexity,
            recommended_first_target: summary.recommendedFirstMigrationTarget,
            summary_json: {
              ...auditSummary.summaryJson,
              migrationSummary: result.migrationSummary,
              selectedEncryptionStrategy: result.selectedEncryptionStrategy,
              selectedCryptoStrategy: result.selectedCryptoStrategy,
              topRecommendations: result.recommendations.slice(0, 4),
              roadmapPhases: result.roadmapPhases,
            },
            encrypted_payload: encrypted.ciphertext,
            encryption_iv: encrypted.iv,
            encryption_version: encrypted.version,
            progress_stage: 'Assessment completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', assessmentId)
          .eq('user_id', user.id)
          .select('*')
          .single()

        if (updateError || !updatedAssessment) {
          throw new Error(updateError?.message || 'Failed to persist completed assessment')
        }

        send({
          type: 'analysis-complete',
          progress: 100,
          timestamp: new Date().toISOString(),
          message: 'PQC migration assessment complete.',
          assessment: mapAssessmentSummary(updatedAssessment),
          result,
        })
      } catch (error) {
        await client
          .from('migration_assessments')
          .update({
            status: 'failed',
            progress_stage: 'Assessment failed',
            last_error: error instanceof Error ? error.message : 'Unknown assessment failure',
            updated_at: new Date().toISOString(),
          })
          .eq('id', assessmentId)
          .eq('user_id', user.id)

        send({
          type: 'error',
          progress: 100,
          timestamp: new Date().toISOString(),
          message: error instanceof Error ? error.message : 'Migration assessment failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
