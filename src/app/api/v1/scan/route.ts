import { NextRequest, NextResponse } from 'next/server'
import { executeScan, getScanSummary, getScanCapabilities } from '@/lib/scanner/engine'
import { resolveTargets, TARGET_MAP } from '@/lib/scanner/engine/target-map'
import { buildQuantumRiskAssessment } from '@/lib/scanner/correlation-engine'
import { analyzeHNDLRisks } from '@/lib/scanner/hndl-analyzer'
import { convertLegacyQScore } from '@/lib/scanner/engine/risk-scoring'
import { createAuthClient } from '@/lib/supabase'
import { getServerUserFromToken, getTokenFromHeaderOrQuery } from '@/lib/server-auth'
import { authorizeScanTargets } from '@/lib/scanner/target-authorization'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { targets = ['local-files'], modules: requestedModules } = body
    const targetKeys = Array.isArray(targets) ? targets : [String(targets)]

    const token = getTokenFromHeaderOrQuery(request)
    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const user = await getServerUserFromToken(token)
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 }
      )
    }

    const userId = user.id
    const authorization = await authorizeScanTargets(userId, token, targetKeys)
    if (!authorization.ok) {
      return NextResponse.json(
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

    // Resolve target keys to ScanTarget objects
    const scanTargets = resolveTargets(targetKeys)

    // Execute full scan through the orchestrator engine
    const job = executeScan(scanTargets, {
      modules: requestedModules,
      runDetectionRules: true,
      matchFingerprints: true,
      emitTelemetry: true,
    })

    // Build additional analysis layers
    const legacyResults = job.findings.map((f) => ({
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
      riskScore: Math.round(f.riskScore / 10), // Convert 0-1000 to 0-100 for legacy compat
      evidence: f.evidence,
      remediation: f.remediation,
    }))

    const riskAssessment = buildQuantumRiskAssessment(legacyResults)
    const hndlRisks = analyzeHNDLRisks(legacyResults)

    // Get the orchestrator summary
    const summary = getScanSummary(job)
    const riskScore = job.riskScore!

    // Persist to database if user is authenticated
    const client = createAuthClient(token)
    if (client) {
      const { data: session } = await client
        .from('scan_sessions')
        .insert({
          user_id: userId,
          status: 'completed',
          started_at: job.startedAt,
          completed_at: job.completedAt,
          progress: 100,
          targets_scanned: targetKeys.length,
          total_targets: targetKeys.length,
          q_score_overall: Math.round(riskScore.overall / 10), // Store as 0-100 in DB for compat
          total_findings: job.findings.length,
          critical_count: riskScore.criticalCount,
          high_count: riskScore.highCount,
          medium_count: riskScore.moderateCount,
          low_count: riskScore.lowCount,
        })
        .select()
        .single()

      if (session) {
        const dbResults = job.findings.map((f) => ({
          scan_id: session.id,
          user_id: userId,
          target_name: f.target.name,
          target_type: f.target.type,
          detected_algorithm: f.detectedAlgorithm,
          threat_level: f.threatLevel,
          is_hndl_risk: f.isHNDLRisk,
          risk_score: Math.round(f.riskScore / 10),
          description: f.description,
          recommendation: f.recommendation,
          quantum_break_time: f.quantumBreakTime,
          classical_break_time: f.classicalBreakTime,
        }))

        await client.from('scan_results').insert(dbResults)

        // Update user's Q-Score in profile
        await client
          .from('profiles')
          .update({ q_score: Math.round(riskScore.overall / 10) })
          .eq('id', userId)
      }
    }

    return NextResponse.json({
      data: {
        scanId: job.id,
        status: job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,

        // Quantum Risk Score (0-1000 scale)
        quantumRiskScore: riskScore.overall,
        riskLevel: riskScore.level,
        riskBreakdown: riskScore.breakdown,

        // Legacy Q-Score (0-100 scale) for backward compatibility
        qScore: Math.round(riskScore.overall / 10),
        qScoreLevel: riskScore.level,
        breakdown: {
          encryption: Math.round(riskScore.breakdown.devices / 10),
          certificates: Math.round(riskScore.breakdown.networks / 10),
          passwords: Math.round(riskScore.breakdown.applications / 10),
          cloudStorage: Math.round(riskScore.breakdown.cloud / 10),
          communications: Math.round(riskScore.breakdown.telecom / 10),
        },

        // Scanning engine metrics
        modulesUsed: job.modules.length,
        rulesTriggered: job.ruleResults.length,
        totalFindings: job.findings.length,
        critical: riskScore.criticalCount,
        high: riskScore.highCount,
        moderate: riskScore.moderateCount,
        low: riskScore.lowCount,
        hndlRisks: riskScore.hndlRiskCount,

        // Detailed results
        results: summary.findings,
        ruleResults: summary.ruleResults,
        riskAssessment,
        hndlAnalysis: hndlRisks,

        // Telemetry summary
        telemetryEvents: job.telemetry.length,
      },
    })
  } catch (err) {
    console.error('Scan error:', err)
    return NextResponse.json(
      { error: { code: 'SCAN_ERROR', message: 'Failed to process scan request' } },
      { status: 400 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    data: {
      message: 'Use POST to initiate a quantum vulnerability scan',
      supportedTargets: Object.keys(TARGET_MAP),
      engine: {
        version: '2.0.0',
        modules: 25,
        detectionRules: 40,
        cryptoFingerprints: 70,
        riskScoreRange: '0-1000',
        riskLevels: {
          '900-1000': 'Quantum Safe',
          '700-899': 'Moderate Risk',
          '400-699': 'Vulnerable',
          '0-399': 'Critical Risk',
        },
      },
    },
  })
}
