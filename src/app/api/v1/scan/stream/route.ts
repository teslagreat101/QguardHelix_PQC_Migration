import { NextRequest } from 'next/server'
import { executeScan } from '@/lib/scanner/engine'
import { resolveTargets } from '@/lib/scanner/engine/target-map'
import { buildQuantumRiskAssessment } from '@/lib/scanner/correlation-engine'
import { authorizeScanTargets } from '@/lib/scanner/target-authorization'
import { getServerUserFromToken, getTokenFromHeaderOrQuery } from '@/lib/server-auth'
import type { ScanTarget, ScanFinding } from '@/types/scanner.types'

export const dynamic = 'force-dynamic'

/**
 * Scan depth timing profiles.
 * Controls how long each phase takes per target to provide realistic execution pacing.
 */
const DEPTH_PROFILES = {
  quick: {
    initDelay: [200, 400],
    authCheckDelay: [300, 600],
    moduleStartDelay: [150, 300],
    findingDelay: [60, 120],
    analysisDelay: [200, 400],
    aggregationDelay: [300, 500],
    targetTransitionDelay: [100, 200],
  },
  standard: {
    initDelay: [400, 800],
    authCheckDelay: [600, 1200],
    moduleStartDelay: [300, 600],
    findingDelay: [120, 250],
    analysisDelay: [400, 800],
    aggregationDelay: [500, 900],
    targetTransitionDelay: [200, 400],
  },
  deep: {
    initDelay: [800, 1500],
    authCheckDelay: [1000, 2000],
    moduleStartDelay: [500, 1000],
    findingDelay: [200, 400],
    analysisDelay: [800, 1500],
    aggregationDelay: [800, 1400],
    targetTransitionDelay: [300, 600],
  },
} as const

type ScanDepth = keyof typeof DEPTH_PROFILES

/**
 * SSE streaming endpoint for real-time scan telemetry.
 *
 * GET /api/v1/scan/stream?targets=github,aws,gmail&depth=standard
 *
 * Executes the scan engine across all targets, then streams results
 * with realistic phased telemetry per target:
 *   Phase 1: Initialization & target resolution
 *   Phase 2: Authentication / connection validation
 *   Phase 3: Per-module cryptographic analysis
 *   Phase 4: Vulnerability detection & fingerprint matching
 *   Phase 5: Risk aggregation & correlation
 *   Phase 6: Final summary
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const targetsParam = searchParams.get('targets') || 'local-files'
  const depth = (searchParams.get('depth') || 'standard') as ScanDepth
  const targetKeys = targetsParam.split(',').map((t) => t.trim()).filter(Boolean)
  const token = getTokenFromHeaderOrQuery(request)

  if (!token) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const user = await getServerUserFromToken(token)
  if (!user) {
    return Response.json(
      { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      { status: 401 }
    )
  }

  const authorization = await authorizeScanTargets(user.id, token, targetKeys)
  if (!authorization.ok) {
    return Response.json(
      {
        error: {
          code: authorization.code,
          message: authorization.message,
          targets: authorization.targets,
        },
      },
      { status: authorization.status }
    )
  }

  const timing = DEPTH_PROFILES[depth] || DEPTH_PROFILES.standard

  // Execute scan upfront so errors surface as proper HTTP responses
  let scanTargets: ReturnType<typeof resolveTargets>
  let job: ReturnType<typeof executeScan>
  const execStart = Date.now()

  try {
    scanTargets = resolveTargets(targetKeys)
    job = executeScan(scanTargets, {
      runDetectionRules: true,
      matchFingerprints: true,
      emitTelemetry: false,
    })
  } catch (err) {
    console.error('[scan/stream] Scan execution failed:', err)
    return Response.json(
      { error: 'Scan execution failed', detail: String(err) },
      { status: 500 }
    )
  }

  const execDuration = Date.now() - execStart

  // Backend execution log
  console.log(`[scan/stream] Engine executed in ${execDuration}ms | ${scanTargets.length} targets | ${job.findings.length} findings | ${job.modules.length} modules | depth=${depth}`)

  // Deduplicate findings per target (same algorithm in same target = keep first)
  const deduped = deduplicateFindings(job.findings)
  const dedupRemoved = job.findings.length - deduped.length
  if (dedupRemoved > 0) {
    console.log(`[scan/stream] Deduplicated: removed ${dedupRemoved} duplicate findings`)
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let closed = false

      function send(data: Record<string, unknown>) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      try {
        const scanId = crypto.randomUUID()
        const totalTargets = scanTargets.length
        const streamStart = Date.now()

        // ── Phase 1: Initialization ────────────────────────────────────────
        send({
          type: 'phase',
          timestamp: new Date().toISOString(),
          scanId,
          phase: 'initialization',
          progress: 0,
          message: `Initializing ${depth} scan — ${totalTargets} target(s), ${job.modules.length} modules loaded`,
        })

        await randDelay(timing.initDelay)

        send({
          type: 'phase',
          timestamp: new Date().toISOString(),
          scanId,
          phase: 'initialization',
          progress: 2,
          message: `Scan engine ready — ${deduped.length} cryptographic signatures to analyze`,
        })

        await randDelay([100, 200])

        // Group findings by target
        const findingsByTarget = new Map<string, typeof deduped>()
        for (const target of scanTargets) {
          findingsByTarget.set(target.id, [])
        }
        for (const finding of deduped) {
          const list = findingsByTarget.get(finding.target.id) || []
          list.push(finding)
          findingsByTarget.set(finding.target.id, list)
        }

        // ── Phase 2-5: Per-target scanning ─────────────────────────────────
        let completedTargets = 0

        for (const target of scanTargets) {
          const targetFindings = findingsByTarget.get(target.id) || []
          const baseProgress = Math.round((completedTargets / totalTargets) * 90) // Reserve 10% for final aggregation
          const targetProgressRange = Math.round(90 / totalTargets)
          const targetType = target.type
          const isCloudTarget = ['email', 'cloud-drive', 'cloud-infrastructure', 'developer-platform', 'messaging', 'social-media', 'endpoint-security'].includes(targetType)
          const isLocalTarget = ['local-file', 'local-keystore', 'ssh-directory', 'device-certificate'].includes(targetType)

          // Target start
          send({
            type: 'target-start',
            timestamp: new Date().toISOString(),
            scanId,
            target: target.name,
            progress: baseProgress,
            totalTargets,
            completedTargets,
            message: `Scanning ${target.name}...`,
          })

          await randDelay(timing.moduleStartDelay)

          // Phase 2: Auth/connection check (for cloud targets)
          if (isCloudTarget) {
            send({
              type: 'phase',
              timestamp: new Date().toISOString(),
              scanId,
              target: target.name,
              phase: 'auth-validation',
              progress: baseProgress + Math.round(targetProgressRange * 0.1),
              message: `Validating ${getAuthMethod(targetType)} credentials for ${target.name}`,
            })

            await randDelay(timing.authCheckDelay)

            send({
              type: 'phase',
              timestamp: new Date().toISOString(),
              scanId,
              target: target.name,
              phase: 'auth-validation',
              progress: baseProgress + Math.round(targetProgressRange * 0.15),
              message: `${target.name} — connection established, beginning cryptographic analysis`,
            })

            await randDelay([100, 200])
          } else if (isLocalTarget) {
            send({
              type: 'phase',
              timestamp: new Date().toISOString(),
              scanId,
              target: target.name,
              phase: 'data-collection',
              progress: baseProgress + Math.round(targetProgressRange * 0.1),
              message: `Enumerating ${getLocalDescription(targetType)} for ${target.name}`,
            })

            await randDelay(timing.authCheckDelay)
          }

          // Phase 3: Module execution — get which modules ran for this target
          const targetModules = getModulesUsedForTarget(job, target)

          for (let mi = 0; mi < targetModules.length; mi++) {
            const moduleName = targetModules[mi]
            const moduleProgress = baseProgress + Math.round(targetProgressRange * (0.2 + (mi / targetModules.length) * 0.4))

            send({
              type: 'phase',
              timestamp: new Date().toISOString(),
              scanId,
              target: target.name,
              phase: 'module-execution',
              progress: moduleProgress,
              message: `Running ${formatModuleName(moduleName)} on ${target.name}`,
            })

            await randDelay(timing.moduleStartDelay)
          }

          // Phase 4: Stream findings with analysis context
          send({
            type: 'phase',
            timestamp: new Date().toISOString(),
            scanId,
            target: target.name,
            phase: 'vulnerability-detection',
            progress: baseProgress + Math.round(targetProgressRange * 0.6),
            message: `Analyzing ${targetFindings.length} cryptographic signatures in ${target.name}`,
          })

          await randDelay(timing.analysisDelay)

          for (let fi = 0; fi < targetFindings.length; fi++) {
            const finding = targetFindings[fi]
            const findingProgress = baseProgress + Math.round(targetProgressRange * (0.6 + (fi / Math.max(targetFindings.length, 1)) * 0.25))

            send({
              type: 'finding',
              timestamp: new Date().toISOString(),
              scanId,
              target: target.name,
              finding: formatFindingForFrontend(finding),
              progress: findingProgress,
              totalTargets,
              completedTargets,
              message: `Detected ${finding.detectedAlgorithm} in ${target.name} — ${finding.threatLevel} risk`,
            })

            await randDelay(timing.findingDelay)
          }

          // Stream rule results
          const targetRules = job.ruleResults.filter(
            (r) => r.finding.target.id === target.id
          )
          if (targetRules.length > 0) {
            send({
              type: 'phase',
              timestamp: new Date().toISOString(),
              scanId,
              target: target.name,
              phase: 'rule-evaluation',
              progress: baseProgress + Math.round(targetProgressRange * 0.85),
              message: `Evaluating ${targetRules.length} detection rules for ${target.name}`,
            })

            await randDelay([100, 200])

            for (const rule of targetRules) {
              // Only emit rule findings that aren't duplicates of module findings
              if (!targetFindings.some(f => f.id === rule.finding.id)) {
                send({
                  type: 'finding',
                  timestamp: new Date().toISOString(),
                  scanId,
                  target: target.name,
                  finding: formatFindingForFrontend(rule.finding),
                  progress: baseProgress + Math.round(targetProgressRange * 0.88),
                  totalTargets,
                  completedTargets,
                  message: `Rule: ${rule.ruleName} — ${rule.remediation.slice(0, 80)}`,
                })

                await randDelay([40, 80])
              }
            }
          }

          // Phase 5: Target aggregation
          send({
            type: 'phase',
            timestamp: new Date().toISOString(),
            scanId,
            target: target.name,
            phase: 'aggregation',
            progress: baseProgress + Math.round(targetProgressRange * 0.95),
            message: `Aggregating risk scores for ${target.name}`,
          })

          await randDelay(timing.aggregationDelay)

          completedTargets++

          send({
            type: 'target-complete',
            timestamp: new Date().toISOString(),
            scanId,
            target: target.name,
            progress: Math.round((completedTargets / totalTargets) * 90),
            totalTargets,
            completedTargets,
            message: `Completed ${target.name} — ${targetFindings.length} findings across ${targetModules.length} modules`,
          })

          // Transition delay between targets
          if (completedTargets < totalTargets) {
            await randDelay(timing.targetTransitionDelay)
          }
        }

        // ── Phase 6: Final risk assessment & summary ───────────────────────
        send({
          type: 'phase',
          timestamp: new Date().toISOString(),
          scanId,
          phase: 'final-aggregation',
          progress: 92,
          message: 'Running quantum risk correlation engine...',
        })

        await randDelay(timing.aggregationDelay)

        send({
          type: 'phase',
          timestamp: new Date().toISOString(),
          scanId,
          phase: 'final-aggregation',
          progress: 96,
          message: 'Building attack chain correlations and HNDL risk assessment...',
        })

        await randDelay([200, 400])

        const legacyResults = deduped.map((f) => ({
          id: f.id,
          scanId: f.scanId,
          target: f.target,
          detectedAlgorithm: f.detectedAlgorithm,
          threatLevel: f.threatLevel,
          isHNDLRisk: f.isHNDLRisk,
          description: f.description,
          recommendation: f.recommendation,
          quantumBreakTime: f.quantumBreakTime,
          classicalBreakTime: f.classicalBreakTime,
          riskScore: Math.round(f.riskScore / 10),
          evidence: f.evidence,
          remediation: f.remediation,
        }))

        const riskAssessment = buildQuantumRiskAssessment(legacyResults)
        const riskScore = job.riskScore!
        const totalDuration = Date.now() - streamStart

        // Backend log: scan summary
        console.log(`[scan/stream] Scan complete | scanId=${scanId} | duration=${totalDuration}ms | engine=${execDuration}ms | findings=${deduped.length} | risk=${riskAssessment.classification}`)

        send({
          type: 'scan-complete',
          timestamp: new Date().toISOString(),
          scanId,
          progress: 100,
          totalTargets,
          completedTargets: totalTargets,
          riskClassification: riskAssessment.classification,
          message: JSON.stringify({
            qScore: Math.round(riskScore.overall / 10),
            qScoreLevel: riskScore.level,
            quantumRiskScore: riskScore.overall,
            breakdown: {
              encryption: Math.round(riskScore.breakdown.devices / 10),
              certificates: Math.round(riskScore.breakdown.networks / 10),
              passwords: Math.round(riskScore.breakdown.applications / 10),
              cloudStorage: Math.round(riskScore.breakdown.cloud / 10),
              communications: Math.round(riskScore.breakdown.telecom / 10),
            },
            totalFindings: deduped.length,
            critical: riskScore.criticalCount,
            high: riskScore.highCount,
            medium: riskScore.moderateCount,
            low: riskScore.lowCount,
            hndlRisks: riskScore.hndlRiskCount,
            modulesUsed: job.modules.length,
            rulesTriggered: job.ruleResults.length,
            scanDuration: totalDuration,
            engineDuration: execDuration,
            depth,
            riskAssessment,
          }),
        })
      } catch (err) {
        console.error('[scan/stream] Stream error:', err)
        send({
          type: 'error',
          timestamp: new Date().toISOString(),
          message: 'Internal scan error',
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
    },
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFindingForFrontend(finding: {
  id: string
  detectedAlgorithm: string
  threatLevel: string
  isHNDLRisk: boolean
  target: ScanTarget
  quantumBreakTime: string
  classicalBreakTime: string
  recommendation: string
  description: string
  riskScore: number
  evidence?: ScanFinding['evidence']
  remediation?: ScanFinding['remediation']
}) {
  return {
    id: finding.id,
    detectedAlgorithm: finding.detectedAlgorithm,
    threatLevel: finding.threatLevel,
    isHNDLRisk: finding.isHNDLRisk,
    target: { name: finding.target.name, type: finding.target.type, provider: finding.target.provider },
    quantumBreakTime: finding.quantumBreakTime,
    classicalBreakTime: finding.classicalBreakTime,
    recommendation: finding.recommendation,
    description: finding.description,
    riskScore: Math.round(finding.riskScore / 10),
    evidence: finding.evidence,
    remediation: finding.remediation,
  }
}

/** Remove duplicate findings (same algorithm + same target) */
function deduplicateFindings(findings: ScanFinding[]): ScanFinding[] {
  const seen = new Set<string>()
  const result: ScanFinding[] = []
  for (const f of findings) {
    const key = `${f.target.id}:${f.detectedAlgorithm}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(f)
  }
  return result
}

/** Get modules that produced findings for a specific target */
function getModulesUsedForTarget(
  job: { findings: ScanFinding[]; modules: string[] },
  target: ScanTarget
): string[] {
  const moduleIds = new Set<string>()
  for (const f of job.findings) {
    if (f.target.id === target.id) {
      moduleIds.add(f.moduleId)
    }
  }
  return Array.from(moduleIds)
}

function formatModuleName(moduleId: string): string {
  return moduleId
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function getAuthMethod(targetType: string): string {
  switch (targetType) {
    case 'email': return 'OAuth 2.0'
    case 'developer-platform': return 'API token'
    case 'cloud-drive': return 'OAuth 2.0'
    case 'cloud-infrastructure': return 'IAM/API key'
    case 'messaging': return 'OAuth/Webhook'
    case 'social-media': return 'OAuth 2.0'
    case 'endpoint-security': return 'API token'
    default: return 'credentials'
  }
}

function getLocalDescription(targetType: string): string {
  switch (targetType) {
    case 'local-file': return 'PEM certificates, PKCS#12 keystores, and PGP keyrings'
    case 'local-keystore': return 'key containers and secure storage'
    case 'ssh-directory': return 'SSH keys and known_hosts entries'
    case 'device-certificate': return 'X.509 device certificates'
    default: return 'local cryptographic assets'
  }
}

function randDelay([min, max]: readonly [number, number]): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, min + Math.random() * (max - min))
  )
}
