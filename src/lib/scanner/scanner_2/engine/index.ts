/**
 * QGuard Scanner Engine
 * Unified export for the quantum vulnerability scanning engine.
 */

export { executeScan, getScanSummary, getScanCapabilities } from './scan-orchestrator'
export type { OrchestratorConfig } from './scan-orchestrator'
export { telemetry } from './telemetry'
export { calculateQuantumRiskScore, scoreToRiskLevel, getRiskColor, getRiskLabel, convertLegacyQScore } from './risk-scoring'
export { matchFingerprints, getFingerprintsForAlgorithm, getFingerprintById, getFingerprintStats } from './fingerprint-matcher'
export { TARGET_MAP, resolveTargets } from './target-map'
