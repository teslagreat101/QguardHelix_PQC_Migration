/**
 * QGuard Scan Orchestrator
 * Central engine that coordinates scanning modules, detection rules,
 * fingerprint matching, risk scoring, and telemetry emission.
 *
 * This is the unified entry point for all quantum vulnerability scanning.
 */

import type {
  ScanTarget,
  ScanTargetType,
  ScanFinding,
  ScanJob,
  ScanTelemetry,
  DetectionRuleResult,
  QuantumRiskScore,
  ScanModule,
  ScannerEvidenceRecord,
} from '@/types/scanner.types'
import { SCAN_MODULES, getModulesForTarget, scanEvidenceWithModules } from '../modules'
import { DETECTION_RULES, evaluateFindings } from '../rules/detection-rules'
import { calculateQuantumRiskScore } from './risk-scoring'
import { telemetry } from './telemetry'
import { matchFingerprints } from './fingerprint-matcher'
import { uuidv4 } from '../uuid'

export interface OrchestratorConfig {
  /** Specific module IDs to run (default: all applicable) */
  modules?: string[]
  /** Whether to run detection rules after scanning (default: true) */
  runDetectionRules?: boolean
  /** Whether to match fingerprints (default: true) */
  matchFingerprints?: boolean
  /** Whether to emit telemetry (default: true) */
  emitTelemetry?: boolean
  /** Observed evidence from the scanner agent, connector, or scanner API */
  evidenceRecords?: ScannerEvidenceRecord[]
  /** Legacy compatibility only. Production scans should use evidenceRecords. */
  allowSyntheticModuleFindings?: boolean
}

const DEFAULT_CONFIG: Required<OrchestratorConfig> = {
  modules: [],
  runDetectionRules: true,
  matchFingerprints: true,
  emitTelemetry: true,
  evidenceRecords: [],
  allowSyntheticModuleFindings: false,
}

/**
 * Execute a full quantum vulnerability scan across all targets.
 * Dispatches to applicable modules, runs detection rules, matches
 * fingerprints, and calculates the quantum risk score.
 */
export function executeScan(
  targets: ScanTarget[],
  config: OrchestratorConfig = {}
): ScanJob {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const scanId = uuidv4()
  const startedAt = new Date().toISOString()

  const job: ScanJob = {
    id: scanId,
    status: 'running',
    targets,
    modules: [],
    startedAt,
    progress: 0,
    findings: [],
    ruleResults: [],
    telemetry: [],
  }

  if (cfg.emitTelemetry) {
    telemetry.emitProgress(scanId, 0, `Scan initiated with ${targets.length} target(s)`)
  }

  // Phase 1: Module Scanning
  const allFindings: ScanFinding[] = []
  const totalSteps = Math.max(targets.length, 1)
  let completedSteps = 0

  for (const target of targets) {
    // Get modules applicable to this target
    let applicableModules: ScanModule[]
    if (cfg.modules.length > 0) {
      applicableModules = SCAN_MODULES.filter(
        (m) => cfg.modules.includes(m.id) && m.supportedTargets.includes(target.type)
      )
    } else {
      applicableModules = getModulesForTarget(target.type)
    }

    // If no specialized modules match, use a default selection
    if (applicableModules.length === 0) {
      applicableModules = SCAN_MODULES.filter(
        (m) => m.supportedTargets.includes(target.type)
      ).slice(0, 3)
    }

    for (const mod of applicableModules) {
      if (!job.modules.includes(mod.id)) {
        job.modules.push(mod.id)
      }

      if (cfg.emitTelemetry) {
        telemetry.emitModuleStart(scanId, mod.id, mod.name, target.name)
      }

      // Production scans only create findings from observed evidence. The
      // old module affinity scanners remain available behind an explicit flag
      // for legacy/local demos, but are not used as proof of vulnerability.
      const findings = cfg.allowSyntheticModuleFindings ? mod.scan(target, scanId) : []
      allFindings.push(...findings)

      if (cfg.emitTelemetry) {
        for (const finding of findings) {
          telemetry.emitFindingDetected(scanId, mod.id, finding)
        }
        telemetry.emitModuleComplete(scanId, mod.id, mod.name, target.name, findings.length)
      }
    }

    completedSteps++
    const progress = Math.round((completedSteps / totalSteps) * 60) // Modules = 60% of scan
    job.progress = progress

    if (cfg.emitTelemetry) {
      telemetry.emitProgress(scanId, progress, `Scanned target: ${target.name}`)
    }
  }

  if (cfg.evidenceRecords.length > 0) {
    const evidenceFindings = scanEvidenceWithModules(cfg.evidenceRecords, scanId)
    allFindings.push(...evidenceFindings)
    for (const finding of evidenceFindings) {
      if (!job.modules.includes(finding.moduleId)) {
        job.modules.push(finding.moduleId)
      }
      if (cfg.emitTelemetry) {
        telemetry.emitFindingDetected(scanId, finding.moduleId, finding)
      }
    }
  } else if (!cfg.allowSyntheticModuleFindings && cfg.emitTelemetry) {
    telemetry.emitProgress(scanId, 60, 'No observed scanner evidence was attached; no inferred findings were created')
  }

  job.findings = allFindings

  // Phase 2: Fingerprint Matching
  if (cfg.matchFingerprints) {
    const enrichedFindings = matchFingerprints(allFindings)
    job.findings = enrichedFindings

    if (cfg.emitTelemetry) {
      telemetry.emitProgress(scanId, 70, 'Fingerprint matching complete')
    }
  }

  // Phase 3: Detection Rules
  if (cfg.runDetectionRules) {
    const ruleResults = evaluateFindings(job.findings)
    job.ruleResults = ruleResults

    if (cfg.emitTelemetry) {
      for (const result of ruleResults) {
        telemetry.emitRuleTriggered(scanId, result)
      }
      telemetry.emitProgress(scanId, 85, `${ruleResults.length} detection rules triggered`)
    }

    // Enhance findings with rule-adjusted risk scores
    for (const ruleResult of ruleResults) {
      const finding = job.findings.find((f) => f.id === ruleResult.finding.id)
      if (finding && ruleResult.adjustedRiskScore > finding.riskScore) {
        finding.riskScore = ruleResult.adjustedRiskScore
        finding.ruleId = ruleResult.ruleId
      }
    }
  }

  // Phase 4: Risk Scoring
  const riskScore = calculateQuantumRiskScore(job.findings)
  job.riskScore = riskScore
  job.progress = 100
  job.status = 'completed'
  job.completedAt = new Date().toISOString()

  if (cfg.emitTelemetry) {
    telemetry.emitScanComplete(scanId, job.findings.length, riskScore.overall)
    job.telemetry = telemetry.getEventsByScan(scanId)
  }

  return job
}

/**
 * Get a summary of the scan job suitable for API responses.
 */
export function getScanSummary(job: ScanJob) {
  const riskScore = job.riskScore

  return {
    scanId: job.id,
    status: job.status,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    targetsScanned: job.targets.length,
    modulesUsed: job.modules.length,
    totalFindings: job.findings.length,
    rulesTriggered: job.ruleResults.length,
    riskScore: riskScore ? {
      overall: riskScore.overall,
      level: riskScore.level,
      breakdown: riskScore.breakdown,
      criticalCount: riskScore.criticalCount,
      highCount: riskScore.highCount,
      moderateCount: riskScore.moderateCount,
      lowCount: riskScore.lowCount,
      hndlRiskCount: riskScore.hndlRiskCount,
    } : null,
    findings: job.findings.map((f) => ({
      id: f.id,
      moduleId: f.moduleId,
      ruleId: f.ruleId,
      targetName: f.target.name,
      targetType: f.target.type,
      detectedAlgorithm: f.detectedAlgorithm,
      algorithmCategory: f.algorithmCategory,
      threatLevel: f.threatLevel,
      quantumThreat: f.quantumThreat,
      isHNDLRisk: f.isHNDLRisk,
      riskScore: f.riskScore,
      severity: f.severity,
      description: f.description,
      recommendation: f.recommendation,
      pqcReplacement: f.pqcReplacement,
      quantumBreakTime: f.quantumBreakTime,
      classicalBreakTime: f.classicalBreakTime,
      evidence: f.evidence,
      remediation: f.remediation,
      timestamp: f.timestamp,
    })),
    ruleResults: job.ruleResults.map((r) => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      severity: r.severity,
      adjustedRiskScore: r.adjustedRiskScore,
      remediation: r.remediation,
      targetName: r.finding.target.name,
      detectedAlgorithm: r.finding.detectedAlgorithm,
    })),
  }
}

/**
 * Get available scanning capabilities for a target type.
 */
export function getScanCapabilities(targetType: ScanTargetType) {
  const modules = getModulesForTarget(targetType)
  return {
    targetType,
    availableModules: modules.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      description: m.description,
    })),
    totalRules: DETECTION_RULES.length,
    totalFingerprints: 70,
  }
}
