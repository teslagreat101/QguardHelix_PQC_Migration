import { NextRequest } from 'next/server'
import {
  formatDiscoveryFinding,
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function discoveryWorkflowProgress(phaseProgress: number) {
  return Math.min(25, Math.max(5, Math.round(phaseProgress * 0.25)))
}

export async function POST(request: NextRequest) {
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

  updateWizardSession(session.sessionId, {
    selectedTargets: targetKeys,
    assetInput,
    activePhase: 'discover',
    runState: 'discovering',
    phaseStatus: { discover: 'running', assess: 'idle', migrate: 'idle', verify: 'idle' },
    progress: 5,
    migrationProgress: 0,
    files: [],
    assessment: null,
    verification: null,
    error: null,
  })
  recordWizardEvent(session.sessionId, 'discover', `Discovery stream opened for ${targetKeys.length} target selector(s).`, 'info', 5)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false

      request.signal.addEventListener('abort', () => {
        closed = true
        updateWizardSession(session.sessionId, {
          runState: 'idle',
          phaseStatus: { discover: 'idle' },
          error: null,
        })
        recordWizardEvent(session.sessionId, 'discover', 'Discovery stream paused by client.', 'warning', 5)
      })

      function send(data: Record<string, unknown>, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
        if (closed) return
        const timestamp = new Date().toISOString()
        const phaseProgress = typeof data.progress === 'number' ? data.progress : 0
        const workflowProgress = typeof data.workflowProgress === 'number'
          ? data.workflowProgress
          : discoveryWorkflowProgress(phaseProgress)
        const payload: Record<string, unknown> = {
          timestamp,
          sessionId: session.sessionId,
          ...data,
          workflowProgress,
        }

        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          if (typeof data.message === 'string') {
            recordWizardEvent(session.sessionId, 'discover', data.message, level, Number(workflowProgress))
          }
        } catch {
          closed = true
        }
      }

      try {
        send({
          type: 'discover-start',
          progress: 5,
          workflowProgress: 5,
          message: 'Discovery started: normalizing submitted assets and initializing scanner modules.',
        })

        await delay(160)
        const result = runWizardDiscovery(targetKeys, assetInput)
        const targets = result.targets
        const totalTargets = Math.max(targets.length, 1)

        for (let index = 0; index < targets.length; index += 1) {
          if (closed) break
          const target = targets[index]
          const progress = Math.min(65, 10 + Math.round(((index + 1) / totalTargets) * 55))

          updateWizardSession(session.sessionId, {
            progress: discoveryWorkflowProgress(progress),
          })
          send({
            type: 'scan-target',
            targetId: target.id,
            targetName: target.name,
            targetType: target.type,
            progress,
            message: `Scanner processed ${target.name} (${target.type}).`,
          })
          await delay(110)
        }

        const totalFiles = Math.max(result.files.length, 1)
        for (let index = 0; index < result.files.length; index += 1) {
          if (closed) break
          const file = result.files[index]
          const progress = Math.min(95, 66 + Math.round(((index + 1) / totalFiles) * 29))

          updateWizardSession(session.sessionId, (current) => ({
            files: result.files.slice(0, index + 1),
            progress: discoveryWorkflowProgress(progress),
            phaseStatus: current.phaseStatus,
          }))
          send({
            type: 'scan-finding',
            file,
            progress,
            message: `Finding classified: ${formatDiscoveryFinding(file)}.`,
          }, file.beforeScore >= 75 ? 'warning' : 'info')
          await delay(120)
        }

        if (closed) return

        const progress = result.files.length ? 25 : 15
        const finalSession = updateWizardSession(session.sessionId, {
          selectedTargets: targetKeys,
          assetInput,
          activePhase: 'assess',
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

        send({
          type: 'discover-complete',
          progress: 100,
          workflowProgress: progress,
          files: result.files,
          scan: result.scan,
          targets,
          session: finalSession,
          message: `Discovery complete: ${result.scan.totalFindings} finding(s), ${result.files.length} migration candidate(s).`,
        }, 'success')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Discovery stream failed'
        updateWizardSession(session.sessionId, {
          activePhase: 'discover',
          runState: 'failed',
          phaseStatus: { discover: 'error' },
          error: message,
        })
        send({
          type: 'error',
          progress: 100,
          workflowProgress: 0,
          message,
        }, 'error')
      } finally {
        if (!closed) controller.close()
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
