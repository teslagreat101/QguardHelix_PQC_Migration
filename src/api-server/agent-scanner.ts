import { Router, Request, Response, NextFunction } from 'express'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createAuthClient, getServerUser, getServiceClient, getToken } from '@/lib/supabase-server'
import { scanEvidenceWithModules } from '@/lib/scanner/scanner_2/modules'
import { matchFingerprints } from '@/lib/scanner/scanner_2/engine/fingerprint-matcher'
import { evaluateFindings } from '@/lib/scanner/scanner_2/rules/detection-rules'
import { calculateQuantumRiskScore } from '@/lib/scanner/scanner_2/engine/risk-scoring'
import { analyzeHNDLRisks } from '@/lib/scanner/scanner_2/hndl-analyzer'
import { buildQuantumRiskAssessment } from '@/lib/scanner/scanner_2/correlation-engine'
import { calculateQuantumReadiness, getMigrationRecommendation } from '@/lib/scanner/scanner_2/pqc-migration-engine'
import type { ScannerEvidenceRecord, ScanFinding, FindingSeverity } from '@/types/scanner.types'

const router = Router()

type AuthedRequest = Request & {
  user?: User
  token?: string
  client?: SupabaseClient | null
}

type AgentRequest = Request & {
  agent?: any
  client?: SupabaseClient | null
}

const memoryStore = (() => {
  const g = globalThis as typeof globalThis & {
    __qguard_agent_scanner_store__?: {
      agents: any[]
      policies: any[]
      heartbeats: any[]
      connectors: any[]
      evidence: any[]
      alerts: any[]
    }
  }
  if (!g.__qguard_agent_scanner_store__) {
    g.__qguard_agent_scanner_store__ = {
      agents: [],
      policies: [],
      heartbeats: [],
      connectors: [],
      evidence: [],
      alerts: [],
    }
  }
  return g.__qguard_agent_scanner_store__
})()

function randomId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function safeCompareHash(candidate: string, expected: string) {
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function generateAgentToken() {
  return `qga_${randomBytes(32).toString('base64url')}`
}

function cleanString(value: unknown, max = 255): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function severityRank(severity: string) {
  switch (severity) {
    case 'critical': return 5
    case 'high': return 4
    case 'moderate':
    case 'medium': return 3
    case 'low': return 2
    case 'safe': return 1
    default: return 0
  }
}

function jsonError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } })
}

async function requireUserAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getToken(req)
  if (!token) {
    jsonError(res, 401, 'UNAUTHORIZED', 'Authentication required')
    return
  }

  const user = await getServerUser(token)
  if (!user) {
    jsonError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token')
    return
  }

  req.user = user
  req.token = token
  req.client = createAuthClient(token) || getServiceClient()
  next()
}

function getAgentToken(req: Request) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const agentToken = req.headers['x-qguard-agent-token']
  return typeof agentToken === 'string' ? agentToken : null
}

async function requireAgentAuth(req: AgentRequest, res: Response, next: NextFunction) {
  const agentId = typeof req.headers['x-qguard-agent-id'] === 'string' ? req.headers['x-qguard-agent-id'] : null
  const token = getAgentToken(req)
  if (!agentId || !token) {
    jsonError(res, 401, 'AGENT_UNAUTHORIZED', 'Agent id and token are required')
    return
  }

  const tokenHash = hashToken(token)
  const client = getServiceClient()
  let agent: any = null

  if (client) {
    const { data } = await client.from('scanner_agents').select('*').eq('id', agentId).limit(1).maybeSingle()
    agent = data
  } else {
    agent = memoryStore.agents.find((item) => item.id === agentId)
  }

  if (!agent || agent.status === 'revoked' || agent.revoked_at) {
    jsonError(res, 401, 'AGENT_REVOKED', 'Agent is not active')
    return
  }
  if (!safeCompareHash(tokenHash, agent.token_hash)) {
    jsonError(res, 401, 'AGENT_UNAUTHORIZED', 'Invalid agent token')
    return
  }

  req.agent = agent
  req.client = client
  next()
}

function normalizePolicy(raw: any) {
  return {
    enabled: raw?.enabled !== false,
    intervalSeconds: Math.max(60, Math.min(86400, Number(raw?.intervalSeconds || raw?.interval_seconds || 300))),
    allowedTargets: Array.isArray(raw?.allowedTargets) ? raw.allowedTargets : Array.isArray(raw?.allowed_targets) ? raw.allowed_targets : [],
    allowedPaths: Array.isArray(raw?.allowedPaths) ? raw.allowedPaths : Array.isArray(raw?.allowed_paths) ? raw.allowed_paths : [],
    scanTypes: Array.isArray(raw?.scanTypes) ? raw.scanTypes : Array.isArray(raw?.scan_types) ? raw.scan_types : ['tls', 'ssh', 'packages', 'configs'],
    alertThreshold: cleanString(raw?.alertThreshold || raw?.alert_threshold, 20) || 'moderate',
  }
}

function normalizeEvidence(raw: any, sourceType: ScannerEvidenceRecord['sourceType'], agent?: any, connector?: any): ScannerEvidenceRecord | null {
  const evidenceType = cleanString(raw?.evidenceType || raw?.evidence_type, 100) as ScannerEvidenceRecord['evidenceType'] | null
  const assetName = cleanString(raw?.assetName || raw?.asset_name || raw?.host || raw?.target || raw?.filePath || raw?.packageName)
  if (!evidenceType || !assetName) return null

  return {
    id: cleanString(raw?.id, 120) || undefined,
    userId: agent?.user_id || connector?.user_id || cleanString(raw?.userId || raw?.user_id, 80) || undefined,
    agentId: agent?.id || raw?.agentId || raw?.agent_id || null,
    connectorAccountId: connector?.id || raw?.connectorAccountId || raw?.connector_account_id || null,
    sourceType,
    evidenceType,
    assetName,
    assetType: cleanString(raw?.assetType || raw?.asset_type, 100),
    target: cleanString(raw?.target, 500),
    host: cleanString(raw?.host, 255),
    port: raw?.port === undefined || raw?.port === null ? null : Number(raw.port),
    protocol: cleanString(raw?.protocol, 50),
    observedAlgorithm: cleanString(raw?.observedAlgorithm || raw?.observed_algorithm, 100),
    keySize: raw?.keySize || raw?.key_size ? Number(raw?.keySize || raw?.key_size) : null,
    certificateFingerprint: cleanString(raw?.certificateFingerprint || raw?.certificate_fingerprint, 255),
    filePath: cleanString(raw?.filePath || raw?.file_path, 1000),
    packageName: cleanString(raw?.packageName || raw?.package_name, 255),
    packageVersion: cleanString(raw?.packageVersion || raw?.package_version, 100),
    confidence: raw?.confidence === 'low' || raw?.confidence === 'medium' || raw?.confidence === 'high' ? raw.confidence : 'high',
    rawEvidence: typeof raw?.rawEvidence === 'object' && raw.rawEvidence ? raw.rawEvidence : typeof raw?.raw_evidence === 'object' && raw.raw_evidence ? raw.raw_evidence : {},
    observedAt: cleanString(raw?.observedAt || raw?.observed_at, 80) || new Date().toISOString(),
  }
}

function normalizePathLike(value: string) {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function parsePolicyTarget(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = trimmed.includes('://') ? new URL(trimmed) : new URL(`tls://${trimmed}`)
    return {
      host: url.hostname.toLowerCase(),
      port: url.port ? Number(url.port) : url.protocol === 'ssh:' ? 22 : 443,
      raw: trimmed.toLowerCase(),
    }
  } catch {
    const [host, port] = trimmed.split(':')
    return host ? { host: host.toLowerCase(), port: port ? Number(port) : null, raw: trimmed.toLowerCase() } : null
  }
}

function evidenceAllowedByPolicy(evidence: ScannerEvidenceRecord, policy: ReturnType<typeof normalizePolicy>, allowEmptyPolicy = false) {
  const allowedTargets = policy.allowedTargets.map(String).filter(Boolean)
  const allowedPaths = policy.allowedPaths.map(String).filter(Boolean)
  if (allowedTargets.length === 0 && allowedPaths.length === 0) return allowEmptyPolicy

  if (evidence.filePath && allowedPaths.length > 0) {
    const evidencePath = normalizePathLike(evidence.filePath)
    if (allowedPaths.some((allowedPath) => evidencePath.startsWith(normalizePathLike(allowedPath)))) return true
  }

  const evidenceHost = evidence.host?.toLowerCase()
  const evidenceTarget = evidence.target?.toLowerCase()
  if (evidenceHost || evidenceTarget) {
    for (const allowedTarget of allowedTargets) {
      const parsed = parsePolicyTarget(allowedTarget)
      if (!parsed) continue
      if (evidenceHost && parsed.host === evidenceHost && (!evidence.port || !parsed.port || parsed.port === evidence.port)) return true
      if (evidenceTarget && (evidenceTarget === parsed.raw || evidenceTarget.includes(parsed.host))) return true
    }
  }

  return false
}

function dbEvidenceRow(evidence: ScannerEvidenceRecord, userId: string) {
  return {
    user_id: userId,
    agent_id: evidence.agentId || null,
    connector_account_id: evidence.connectorAccountId || null,
    source_type: evidence.sourceType,
    evidence_type: evidence.evidenceType,
    asset_name: evidence.assetName,
    asset_type: evidence.assetType || null,
    target: evidence.target || null,
    host: evidence.host || null,
    port: evidence.port || null,
    protocol: evidence.protocol || null,
    observed_algorithm: evidence.observedAlgorithm || null,
    key_size: evidence.keySize || null,
    certificate_fingerprint: evidence.certificateFingerprint || null,
    file_path: evidence.filePath || null,
    package_name: evidence.packageName || null,
    package_version: evidence.packageVersion || null,
    confidence: evidence.confidence || 'high',
    raw_evidence: evidence.rawEvidence || {},
    observed_at: evidence.observedAt || new Date().toISOString(),
  }
}

function itemTypeForFinding(finding: ScanFinding) {
  if (finding.algorithmCategory === 'protocol') return 'protocol'
  if (finding.algorithmCategory === 'hash') return 'hash'
  if (finding.algorithmCategory === 'signature') return 'signature'
  if (finding.moduleId.includes('certificate')) return 'certificate'
  if (finding.moduleId.includes('ssh')) return 'key_exchange'
  if (finding.moduleId.includes('library')) return 'library'
  return 'algorithm'
}

function isPqcReadyEvidence(evidence: ScannerEvidenceRecord) {
  const value = `${evidence.observedAlgorithm || ''} ${JSON.stringify(evidence.rawEvidence || {})}`.toLowerCase()
  return (
    value.includes('ml-kem') ||
    value.includes('ml-dsa') ||
    value.includes('kyber') ||
    value.includes('dilithium') ||
    value.includes('sphincs') ||
    value.includes('sntrup') ||
    value.includes('post-quantum') ||
    value.includes('pqc') ||
    value.includes('hybrid')
  )
}

async function persistEvidenceFindings(
  client: SupabaseClient | null,
  userId: string,
  evidence: ScannerEvidenceRecord[],
  findings: ScanFinding[],
  sourceLabel: string,
  options: { alertThreshold?: string } = {}
) {
  const now = new Date().toISOString()
  const linkedAssetIds: string[] = []
  const linkedCbomIds: string[] = []
  const linkedExposureIds: string[] = []
  const linkedAlertIds: string[] = []
  const pqcReadyEvidence = evidence.filter(isPqcReadyEvidence)

  const sessionSummary = {
    totalFindings: findings.length,
    critical: findings.filter((item) => item.severity === 'critical').length,
    high: findings.filter((item) => item.severity === 'high').length,
    medium: findings.filter((item) => item.severity === 'moderate' || item.severity === 'medium').length,
    low: findings.filter((item) => item.severity === 'low').length,
    safe: findings.filter((item) => item.severity === 'safe').length + pqcReadyEvidence.length,
    pqcReadyEvidence: pqcReadyEvidence.length,
  }

  let scanSessionId: string | null = null
  if (client) {
    const { data } = await client.from('pqc_scan_sessions').insert({
      user_id: userId,
      status: 'completed',
      target_scope: `${sourceLabel} evidence batch`,
      progress: 100,
      total_assets: new Set(evidence.map((item) => item.assetName)).size,
      scanned_assets: new Set(evidence.map((item) => item.assetName)).size,
      findings_count: findings.length,
      metadata: {
        scannerMode: 'continuous-agent-evidence',
        sourceLabel,
        summary: sessionSummary,
      },
      started_at: now,
      completed_at: now,
    }).select('id').single()
    scanSessionId = data?.id || null
  }

  for (const finding of findings) {
    let assetId: string | null = null
    const evidenceMatch = evidence.find((item) =>
      item.assetName === finding.target.name ||
      item.host === finding.target.metadata?.host ||
      item.filePath === finding.target.metadata?.filePath
    )
    const assetName = finding.target.name
    const riskScore = Math.max(0, Math.min(100, Math.round(finding.riskScore / 10)))
    const assetMetadata = {
      source: sourceLabel,
      evidenceType: evidenceMatch?.evidenceType,
      target: evidenceMatch?.target,
      host: evidenceMatch?.host,
      port: evidenceMatch?.port,
      last_scanned_at: now,
      riskScore,
      qScore: Math.max(0, 100 - riskScore),
      scannerEvidence: true,
    }

    if (client) {
      const { data: existingAsset } = await client.from('assets').select('*').eq('user_id', userId).eq('name', assetName).limit(1).maybeSingle()
      if (existingAsset?.id) {
        const { data } = await client.from('assets').update({
          type: finding.target.type,
          ip_address: evidenceMatch?.host || null,
          criticality: riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
          status: 'active',
          metadata: { ...(existingAsset.metadata || {}), ...assetMetadata },
          updated_at: now,
        }).eq('id', existingAsset.id).eq('user_id', userId).select('id').single()
        assetId = data?.id || existingAsset.id
      } else {
        const { data } = await client.from('assets').insert({
          user_id: userId,
          name: assetName,
          type: finding.target.type,
          ip_address: evidenceMatch?.host || null,
          criticality: riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
          status: 'active',
          metadata: assetMetadata,
        }).select('id').single()
        assetId = data?.id || null
      }
    } else {
      assetId = randomId('asset')
    }

    if (!assetId) continue
    linkedAssetIds.push(assetId)

    const commonMetadata = {
      source: sourceLabel,
      scanSessionId,
      evidence: finding.evidence,
      remediation: finding.remediation,
      recommendation: finding.recommendation,
      pqcReplacement: finding.pqcReplacement,
      fingerprintId: finding.fingerprintId,
      ruleId: finding.ruleId,
      evidenceRecord: evidenceMatch || null,
    }

    if (client) {
      const { data: cbom } = await client.from('crypto_inventory').insert({
        user_id: userId,
        asset_id: assetId,
        item_type: itemTypeForFinding(finding),
        name: `${finding.moduleId}: ${finding.detectedAlgorithm}`,
        algorithm: finding.detectedAlgorithm,
        key_size: evidenceMatch?.keySize || null,
        protocol: evidenceMatch?.protocol || null,
        exposure_level: finding.severity,
        is_vulnerable: finding.threatLevel !== 'safe',
        is_quantum_safe: finding.threatLevel === 'safe',
        metadata: commonMetadata,
        discovered_at: now,
      }).select('id').single()
      if (cbom?.id) linkedCbomIds.push(cbom.id)

      await client.from('pqc_scan_results').insert({
        user_id: userId,
        scan_session_id: scanSessionId,
        asset_id: assetId,
        finding_type: finding.moduleId,
        algorithm: finding.detectedAlgorithm,
        threat_level: finding.severity,
        description: finding.description,
        remediation: finding.recommendation,
        metadata: commonMetadata,
      })

      if (finding.threatLevel !== 'safe') {
        const { data: exposure } = await client.from('crypto_exposures').insert({
          user_id: userId,
          asset_id: assetId,
          exposure_type: finding.quantumThreat,
          severity: finding.severity === 'medium' ? 'moderate' : finding.severity,
          description: finding.description,
          detected_value: finding.detectedAlgorithm,
          metadata: commonMetadata,
        }).select('id').single()
        if (exposure?.id) linkedExposureIds.push(exposure.id)

        if (severityRank(finding.severity) >= severityRank(options.alertThreshold || 'moderate')) {
          const { data: alert } = await client.from('scanner_alerts').insert({
            user_id: userId,
            agent_id: evidenceMatch?.agentId || null,
            connector_account_id: evidenceMatch?.connectorAccountId || null,
            evidence_id: evidenceMatch?.id || null,
            severity: finding.severity,
            category: finding.moduleId,
            title: `${finding.detectedAlgorithm} detected on ${assetName}`,
            message: finding.description,
            recommendation: finding.recommendation,
            status: 'open',
            metadata: commonMetadata,
          }).select('id').single()
          if (alert?.id) linkedAlertIds.push(alert.id)
        }
      }
    }
  }

  for (const record of pqcReadyEvidence) {
    if (!client) continue
    const assetName = record.assetName || record.host || record.target || 'PQC-ready asset'
    const assetMetadata = {
      source: sourceLabel,
      evidenceType: record.evidenceType,
      target: record.target,
      host: record.host,
      port: record.port,
      last_scanned_at: now,
      riskScore: 0,
      qScore: 100,
      scannerEvidence: true,
      pqcReady: true,
    }

    const { data: existingAsset } = await client.from('assets').select('*').eq('user_id', userId).eq('name', assetName).limit(1).maybeSingle()
    let assetId = existingAsset?.id as string | null
    if (assetId) {
      await client.from('assets').update({
        type: record.assetType || 'endpoint',
        ip_address: record.host || null,
        criticality: existingAsset.criticality || 'low',
        status: 'active',
        metadata: { ...(existingAsset.metadata || {}), ...assetMetadata },
        updated_at: now,
      }).eq('id', assetId).eq('user_id', userId)
    } else {
      const { data: insertedAsset } = await client.from('assets').insert({
        user_id: userId,
        name: assetName,
        type: record.assetType || 'endpoint',
        ip_address: record.host || null,
        criticality: 'low',
        status: 'active',
        metadata: assetMetadata,
      }).select('id').single()
      assetId = insertedAsset?.id || null
    }
    if (!assetId) continue
    linkedAssetIds.push(assetId)

    const metadata = {
      source: sourceLabel,
      scanSessionId,
      evidenceRecord: record,
      recommendation: 'Maintain PQC/hybrid configuration and monitor vendor implementation maturity.',
      pqcReady: true,
    }
    const { data: cbom } = await client.from('crypto_inventory').insert({
      user_id: userId,
      asset_id: assetId,
      item_type: record.evidenceType.includes('tls') || record.evidenceType.includes('ssh') ? 'protocol' : 'algorithm',
      name: `PQC-ready: ${record.observedAlgorithm || record.evidenceType}`,
      algorithm: record.observedAlgorithm || 'PQC-ready',
      key_size: record.keySize || null,
      protocol: record.protocol || null,
      exposure_level: 'safe',
      is_vulnerable: false,
      is_quantum_safe: true,
      metadata,
      discovered_at: now,
    }).select('id').single()
    if (cbom?.id) linkedCbomIds.push(cbom.id)

    await client.from('pqc_scan_results').insert({
      user_id: userId,
      scan_session_id: scanSessionId,
      asset_id: assetId,
      finding_type: 'pqc-ready-evidence',
      algorithm: record.observedAlgorithm || 'PQC-ready',
      threat_level: 'safe',
      description: `PQC-ready or hybrid cryptographic evidence observed from ${record.evidenceType}.`,
      remediation: 'No immediate migration required; keep continuous monitoring enabled.',
      metadata,
    })
  }

  if (client) {
    await client.from('security_events').insert({
      user_id: userId,
      event_type: 'continuous_scanner_evidence_processed',
      severity: sessionSummary.critical || sessionSummary.high ? 'warning' : 'success',
      message: `${sourceLabel} evidence processed: ${findings.length} finding(s)`,
      resource_name: sourceLabel,
      resource_type: 'scanner_agent',
      metadata: { scanSessionId, sessionSummary, linkedAssetIds, linkedCbomIds, linkedExposureIds, linkedAlertIds },
    })
    await client.from('audit_logs').insert({
      user_id: userId,
      action: 'continuous_scanner_evidence_processed',
      entity_type: 'scanner_evidence',
      entity_id: scanSessionId,
      details: { sourceLabel, evidenceCount: evidence.length, findingCount: findings.length, linkedAssetIds, linkedCbomIds, linkedExposureIds, linkedAlertIds },
    })
  }

  return { scanSessionId, linkedAssetIds, linkedCbomIds, linkedExposureIds, linkedAlertIds }
}

async function processEvidenceBatch(
  client: SupabaseClient | null,
  userId: string,
  evidence: ScannerEvidenceRecord[],
  sourceLabel: string,
  options: { alertThreshold?: string } = {}
) {
  const rows = evidence.map((item) => dbEvidenceRow(item, userId))
  let insertedEvidence: ScannerEvidenceRecord[] = evidence

  if (client && rows.length > 0) {
    const { data } = await client.from('scanner_evidence').insert(rows).select('*')
    insertedEvidence = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      agentId: row.agent_id,
      connectorAccountId: row.connector_account_id,
      sourceType: row.source_type,
      evidenceType: row.evidence_type,
      assetName: row.asset_name,
      assetType: row.asset_type,
      target: row.target,
      host: row.host,
      port: row.port,
      protocol: row.protocol,
      observedAlgorithm: row.observed_algorithm,
      keySize: row.key_size,
      certificateFingerprint: row.certificate_fingerprint,
      filePath: row.file_path,
      packageName: row.package_name,
      packageVersion: row.package_version,
      confidence: row.confidence,
      rawEvidence: row.raw_evidence,
      observedAt: row.observed_at,
    }))
  } else {
    for (const item of insertedEvidence) {
      const row = { id: randomId('evidence'), ...dbEvidenceRow(item, userId), created_at: new Date().toISOString() }
      memoryStore.evidence.unshift(row)
      item.id = row.id
    }
  }

  const scanId = randomId('evidence-scan')
  const observedFindings = scanEvidenceWithModules(insertedEvidence, scanId)
  const enrichedFindings = matchFingerprints(observedFindings)
  const ruleResults = evaluateFindings(enrichedFindings)

  for (const ruleResult of ruleResults) {
    const finding = enrichedFindings.find((item) => item.id === ruleResult.finding.id)
    if (finding && ruleResult.adjustedRiskScore > finding.riskScore) {
      finding.riskScore = ruleResult.adjustedRiskScore
      finding.severity = ruleResult.severity
      finding.ruleId = ruleResult.ruleId
    }
  }

  const scanner2 = {
    observedFindings,
    enrichedFindings,
    ruleResults,
    hndlRisks: analyzeHNDLRisks(enrichedFindings),
    attackAssessment: buildQuantumRiskAssessment(enrichedFindings),
    quantumRiskScore: calculateQuantumRiskScore(enrichedFindings),
    quantumReadiness: calculateQuantumReadiness(enrichedFindings),
    migrationRecommendations: Array.from(new Map(
      enrichedFindings
        .map((finding) => getMigrationRecommendation(finding.detectedAlgorithm))
        .filter(Boolean)
        .map((recommendation) => [recommendation!.classicalAlgorithm, recommendation])
    ).values()),
  }

  const links = await persistEvidenceFindings(client, userId, insertedEvidence, enrichedFindings, sourceLabel, options)

  return {
    evidenceCount: insertedEvidence.length,
    findingCount: enrichedFindings.length,
    scanner2,
    links,
  }
}

router.post('/agents/enroll', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  const now = new Date().toISOString()
  const token = generateAgentToken()
  const tokenHash = hashToken(token)
  const policy = normalizePolicy(req.body?.policy || {})
  const agentBase = {
    user_id: user.id,
    name: cleanString(req.body?.name, 255) || 'QGuard Local Agent',
    token_hash: tokenHash,
    status: 'active',
    hostname: cleanString(req.body?.hostname, 255),
    platform: cleanString(req.body?.platform, 100),
    version: cleanString(req.body?.version, 100) || '0.1.0',
    capabilities: typeof req.body?.capabilities === 'object' && req.body.capabilities ? req.body.capabilities : {},
    policy,
    metadata: {
      ...(typeof req.body?.metadata === 'object' && req.body.metadata ? req.body.metadata : {}),
      environment: cleanString(req.body?.environment, 80) || cleanString(req.body?.metadata?.environment, 80) || 'production',
      enrolledBy: user.id,
    },
    created_at: now,
    updated_at: now,
  }

  let agent: any
  if (client) {
    const { data, error } = await client.from('scanner_agents').insert(agentBase).select('*').single()
    if (error || !data) {
      jsonError(res, 500, 'AGENT_ENROLL_FAILED', error?.message || 'Agent enrollment failed')
      return
    }
    agent = data
    await client.from('scanner_agent_policies').insert({
      user_id: user.id,
      agent_id: agent.id,
      name: 'Default scanner policy',
      enabled: policy.enabled,
      interval_seconds: policy.intervalSeconds,
      allowed_targets: policy.allowedTargets,
      allowed_paths: policy.allowedPaths,
      scan_types: policy.scanTypes,
      alert_threshold: policy.alertThreshold,
    })
  } else {
    agent = { id: randomId('agent'), ...agentBase }
    memoryStore.agents.unshift(agent)
    memoryStore.policies.unshift({ id: randomId('policy'), user_id: user.id, agent_id: agent.id, ...policy })
  }

  res.json({
    data: {
      agent: { ...agent, token_hash: undefined },
      enrollment: {
        agentId: agent.id,
        agentToken: token,
        tokenWarning: 'Store this token now. It is shown once and cannot be recovered.',
      },
    },
  })
})

router.get('/agents', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  if (client) {
    const { data, error } = await client.from('scanner_agents').select('id, user_id, name, status, hostname, platform, version, capabilities, policy, last_seen_at, revoked_at, metadata, created_at, updated_at').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) {
      jsonError(res, 500, 'AGENTS_LOAD_FAILED', error.message)
      return
    }
    res.json({ data: { agents: data || [] } })
    return
  }
  res.json({ data: { agents: memoryStore.agents.filter((item) => item.user_id === user.id).map(({ token_hash, ...agent }) => agent) } })
})

router.post('/agents/:id/revoke', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  const now = new Date().toISOString()
  if (client) {
    await client.from('scanner_agents').update({ status: 'revoked', revoked_at: now, updated_at: now }).eq('id', req.params.id).eq('user_id', user.id)
  } else {
    const agent = memoryStore.agents.find((item) => item.id === req.params.id && item.user_id === user.id)
    if (agent) Object.assign(agent, { status: 'revoked', revoked_at: now, updated_at: now })
  }
  res.json({ data: { agentId: req.params.id, status: 'revoked' } })
})

router.post('/agents/:id/token/rotate', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  const now = new Date().toISOString()
  const token = generateAgentToken()
  const tokenHash = hashToken(token)

  if (client) {
    const { data: agent, error: lookupError } = await client
      .from('scanner_agents')
      .select('id, user_id, name, status')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (lookupError || !agent) {
      jsonError(res, 404, 'AGENT_NOT_FOUND', lookupError?.message || 'Agent not found')
      return
    }

    const { error } = await client
      .from('scanner_agents')
      .update({
        token_hash: tokenHash,
        status: agent.status === 'revoked' ? 'active' : agent.status,
        revoked_at: null,
        updated_at: now,
        metadata: { rotatedAt: now, rotatedBy: user.id },
      })
      .eq('id', req.params.id)
      .eq('user_id', user.id)
    if (error) {
      jsonError(res, 500, 'TOKEN_ROTATE_FAILED', error.message)
      return
    }

    await client.from('audit_logs').insert({
      user_id: user.id,
      action: 'scanner_agent_token_rotated',
      entity_type: 'scanner_agent',
      entity_id: req.params.id,
      details: { rotatedAt: now },
    })
  } else {
    const agent = memoryStore.agents.find((item) => item.id === req.params.id && item.user_id === user.id)
    if (!agent) {
      jsonError(res, 404, 'AGENT_NOT_FOUND', 'Agent not found')
      return
    }
    Object.assign(agent, { token_hash: tokenHash, revoked_at: null, updated_at: now, metadata: { ...(agent.metadata || {}), rotatedAt: now } })
  }

  res.json({
    data: {
      agentId: req.params.id,
      agentToken: token,
      tokenWarning: 'Store this token now. It is shown once and cannot be recovered.',
      rotatedAt: now,
    },
  })
})

router.delete('/agents/:id', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!

  if (client) {
    const { error } = await client
      .from('scanner_agents')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', user.id)
    if (error) {
      jsonError(res, 500, 'AGENT_DELETE_FAILED', error.message)
      return
    }
    await client.from('audit_logs').insert({
      user_id: user.id,
      action: 'scanner_agent_deleted',
      entity_type: 'scanner_agent',
      entity_id: req.params.id,
      details: { deletedAt: new Date().toISOString() },
    })
  } else {
    memoryStore.agents = memoryStore.agents.filter((item) => !(item.id === req.params.id && item.user_id === user.id))
    memoryStore.policies = memoryStore.policies.filter((item) => !(item.agent_id === req.params.id && item.user_id === user.id))
  }

  res.json({ data: { agentId: req.params.id, deleted: true } })
})

router.get('/agents/:id/policy', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  if (client) {
    const { data } = await client.from('scanner_agent_policies').select('*').eq('agent_id', req.params.id).eq('user_id', user.id).limit(1).maybeSingle()
    res.json({ data: { policy: data ? normalizePolicy(data) : normalizePolicy({}) } })
    return
  }
  const policy = memoryStore.policies.find((item) => item.agent_id === req.params.id && item.user_id === user.id)
  res.json({ data: { policy: normalizePolicy(policy || {}) } })
})

router.get('/agents/:id/heartbeats', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  if (client) {
    const { data, error } = await client
      .from('agent_heartbeats')
      .select('*')
      .eq('agent_id', req.params.id)
      .eq('user_id', user.id)
      .order('observed_at', { ascending: false })
      .limit(200)
    if (error) {
      jsonError(res, 500, 'HEARTBEATS_LOAD_FAILED', error.message)
      return
    }
    res.json({ data: { heartbeats: data || [] } })
    return
  }
  res.json({ data: { heartbeats: memoryStore.heartbeats.filter((item) => item.agent_id === req.params.id && item.user_id === user.id) } })
})

router.put('/agents/:id/policy', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  const policy = normalizePolicy(req.body || {})
  if (client) {
    const { data: existing } = await client.from('scanner_agent_policies').select('id').eq('agent_id', req.params.id).eq('user_id', user.id).limit(1).maybeSingle()
    if (existing?.id) {
      await client.from('scanner_agent_policies').update({
        enabled: policy.enabled,
        interval_seconds: policy.intervalSeconds,
        allowed_targets: policy.allowedTargets,
        allowed_paths: policy.allowedPaths,
        scan_types: policy.scanTypes,
        alert_threshold: policy.alertThreshold,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id).eq('user_id', user.id)
    } else {
      await client.from('scanner_agent_policies').insert({
        user_id: user.id,
        agent_id: req.params.id,
        enabled: policy.enabled,
        interval_seconds: policy.intervalSeconds,
        allowed_targets: policy.allowedTargets,
        allowed_paths: policy.allowedPaths,
        scan_types: policy.scanTypes,
        alert_threshold: policy.alertThreshold,
      })
    }
    await client.from('scanner_agents').update({ policy, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', user.id)
  }
  res.json({ data: { policy } })
})

router.get('/alerts', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  if (client) {
    const { data } = await client.from('scanner_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200)
    res.json({ data: { alerts: data || [] } })
    return
  }
  res.json({ data: { alerts: memoryStore.alerts.filter((item) => item.user_id === user.id) } })
})

router.get('/evidence', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  if (client) {
    const { data } = await client.from('scanner_evidence').select('*').eq('user_id', user.id).order('observed_at', { ascending: false }).limit(500)
    res.json({ data: { evidence: data || [] } })
    return
  }
  res.json({ data: { evidence: memoryStore.evidence.filter((item) => item.user_id === user.id) } })
})

router.get('/connectors', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  if (client) {
    const { data, error } = await client
      .from('connector_accounts')
      .select('id, user_id, provider, provider_account_id, display_name, status, scopes, capabilities, policy, last_sync_at, metadata, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      jsonError(res, 500, 'CONNECTORS_LOAD_FAILED', error.message)
      return
    }
    res.json({ data: { connectors: data || [] } })
    return
  }
  res.json({ data: { connectors: memoryStore.connectors.filter((item) => item.user_id === user.id).map(({ token_ref, ...connector }) => connector) } })
})

router.post('/connectors', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  const row = {
    user_id: user.id,
    provider: cleanString(req.body?.provider, 100) || 'custom',
    provider_account_id: cleanString(req.body?.providerAccountId || req.body?.provider_account_id, 255),
    display_name: cleanString(req.body?.displayName || req.body?.display_name, 255),
    status: 'connected',
    scopes: Array.isArray(req.body?.scopes) ? req.body.scopes.slice(0, 50).map(String) : [],
    capabilities: typeof req.body?.capabilities === 'object' && req.body.capabilities ? req.body.capabilities : {},
    policy: normalizePolicy(req.body?.policy || {}),
    metadata: typeof req.body?.metadata === 'object' && req.body.metadata ? req.body.metadata : {},
  }
  if (client) {
    const { data, error } = await client.from('connector_accounts').insert(row).select('*').single()
    if (error) {
      jsonError(res, 500, 'CONNECTOR_CREATE_FAILED', error.message)
      return
    }
    res.json({ data: { connector: data } })
    return
  }
  const connector = { id: randomId('connector'), ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  memoryStore.connectors.unshift(connector)
  res.json({ data: { connector } })
})

router.post('/connectors/:id/evidence', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  let connector: any = null
  if (client) {
    const { data } = await client.from('connector_accounts').select('*').eq('id', req.params.id).eq('user_id', user.id).limit(1).maybeSingle()
    connector = data
  } else {
    connector = memoryStore.connectors.find((item) => item.id === req.params.id && item.user_id === user.id)
  }
  if (!connector) {
    jsonError(res, 404, 'CONNECTOR_NOT_FOUND', 'Connector account not found')
    return
  }
  const payload = Array.isArray(req.body?.evidence) ? req.body.evidence : []
  const policy = normalizePolicy(connector.policy || {})
  const normalizedEvidence = payload.slice(0, 500).map((item: any) => normalizeEvidence(item, 'connector', null, connector)).filter(Boolean) as ScannerEvidenceRecord[]
  const evidence = normalizedEvidence.filter((item) => evidenceAllowedByPolicy(item, policy, true))
  const rejectedEvidenceCount = normalizedEvidence.length - evidence.length
  if (evidence.length === 0 && normalizedEvidence.length > 0) {
    jsonError(res, 403, 'EVIDENCE_OUT_OF_POLICY', 'Uploaded connector evidence does not match this connector policy')
    return
  }
  const result = await processEvidenceBatch(client, user.id, evidence, `connector:${connector.provider}`, {
    alertThreshold: policy.alertThreshold,
  })
  res.json({ data: { ...result, rejectedEvidenceCount } })
})

router.post('/alerts/:id/acknowledge', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  const now = new Date().toISOString()
  if (client) {
    const { error } = await client.from('scanner_alerts').update({
      status: 'acknowledged',
      acknowledged_at: now,
      updated_at: now,
    }).eq('id', req.params.id).eq('user_id', user.id)
    if (error) {
      jsonError(res, 500, 'ALERT_ACK_FAILED', error.message)
      return
    }
  } else {
    const alert = memoryStore.alerts.find((item) => item.id === req.params.id && item.user_id === user.id)
    if (alert) Object.assign(alert, { status: 'acknowledged', acknowledged_at: now, updated_at: now })
  }
  res.json({ data: { alertId: req.params.id, status: 'acknowledged' } })
})

router.post('/alerts/:id/resolve', requireUserAuth, async (req: AuthedRequest, res) => {
  const client = req.client || null
  const user = req.user!
  const now = new Date().toISOString()
  if (client) {
    const { error } = await client.from('scanner_alerts').update({
      status: 'resolved',
      resolved_at: now,
      updated_at: now,
    }).eq('id', req.params.id).eq('user_id', user.id)
    if (error) {
      jsonError(res, 500, 'ALERT_RESOLVE_FAILED', error.message)
      return
    }
  } else {
    const alert = memoryStore.alerts.find((item) => item.id === req.params.id && item.user_id === user.id)
    if (alert) Object.assign(alert, { status: 'resolved', resolved_at: now, updated_at: now })
  }
  res.json({ data: { alertId: req.params.id, status: 'resolved' } })
})

router.post('/agent/heartbeat', requireAgentAuth, async (req: AgentRequest, res) => {
  const client = req.client || null
  const agent = req.agent!
  const now = new Date().toISOString()
  const telemetry = typeof req.body?.telemetry === 'object' && req.body.telemetry ? req.body.telemetry : {}

  if (client) {
    await client.from('agent_heartbeats').insert({
      user_id: agent.user_id,
      agent_id: agent.id,
      status: cleanString(req.body?.status, 50) || 'online',
      telemetry,
      ip_address: req.ip?.replace('::ffff:', '') || null,
      user_agent: String(req.headers['user-agent'] || 'qguard-agent').slice(0, 500),
      observed_at: now,
    })
    await client.from('scanner_agents').update({
      status: cleanString(req.body?.status, 50) || 'active',
      hostname: cleanString(req.body?.hostname, 255) || agent.hostname,
      platform: cleanString(req.body?.platform, 100) || agent.platform,
      version: cleanString(req.body?.version, 100) || agent.version,
      last_seen_at: now,
      updated_at: now,
      metadata: {
        ...(agent.metadata || {}),
        lastIpAddress: req.ip?.replace('::ffff:', '') || null,
        lastUserAgent: String(req.headers['user-agent'] || 'qguard-agent').slice(0, 500),
        lastTelemetry: telemetry,
      },
    }).eq('id', agent.id).eq('user_id', agent.user_id)
  } else {
    memoryStore.heartbeats.unshift({ id: randomId('heartbeat'), user_id: agent.user_id, agent_id: agent.id, status: req.body?.status || 'online', telemetry, observed_at: now })
    Object.assign(agent, { status: req.body?.status || 'active', last_seen_at: now, updated_at: now })
  }

  res.json({ data: { status: 'accepted', observedAt: now } })
})

router.get('/agent/policy', requireAgentAuth, async (req: AgentRequest, res) => {
  const client = req.client || null
  const agent = req.agent!
  if (client) {
    const { data } = await client.from('scanner_agent_policies').select('*').eq('agent_id', agent.id).eq('user_id', agent.user_id).eq('enabled', true).limit(1).maybeSingle()
    res.json({ data: { policy: data ? normalizePolicy(data) : normalizePolicy(agent.policy || {}) } })
    return
  }
  const policy = memoryStore.policies.find((item) => item.agent_id === agent.id && item.user_id === agent.user_id)
  res.json({ data: { policy: normalizePolicy(policy || agent.policy || {}) } })
})

router.post('/agent/telemetry', requireAgentAuth, async (req: AgentRequest, res) => {
  const client = req.client || null
  const agent = req.agent!
  const telemetry = typeof req.body === 'object' && req.body ? req.body : {}
  if (client) {
    await client.from('agent_heartbeats').insert({
      user_id: agent.user_id,
      agent_id: agent.id,
      status: 'telemetry',
      telemetry,
      observed_at: new Date().toISOString(),
    })
  }
  res.json({ data: { status: 'accepted' } })
})

router.post('/agent/evidence', requireAgentAuth, async (req: AgentRequest, res) => {
  const client = req.client || null
  const agent = req.agent!
  const payload = Array.isArray(req.body?.evidence) ? req.body.evidence : []
  if (payload.length === 0) {
    jsonError(res, 400, 'NO_EVIDENCE', 'Evidence array is required')
    return
  }
  const policy = normalizePolicy(agent.policy || {})
  const normalizedEvidence = payload.slice(0, 1000).map((item: any) => normalizeEvidence(item, 'local-agent', agent)).filter(Boolean) as ScannerEvidenceRecord[]
  const evidence = normalizedEvidence.filter((item) => evidenceAllowedByPolicy(item, policy))
  const rejectedEvidenceCount = normalizedEvidence.length - evidence.length
  if (evidence.length === 0) {
    jsonError(res, 403, 'EVIDENCE_OUT_OF_POLICY', 'Uploaded evidence does not match this agent policy')
    return
  }
  if (client && rejectedEvidenceCount > 0) {
    await client.from('agent_heartbeats').insert({
      user_id: agent.user_id,
      agent_id: agent.id,
      status: 'policy_rejected_evidence',
      telemetry: { rejectedEvidenceCount },
      observed_at: new Date().toISOString(),
    })
  }
  const result = await processEvidenceBatch(client, agent.user_id, evidence, `agent:${agent.name || agent.id}`, {
    alertThreshold: policy.alertThreshold,
  })
  res.json({ data: { ...result, rejectedEvidenceCount } })
})

let schedulerStarted = false
export function startAgentScannerScheduler() {
  if (schedulerStarted) return
  schedulerStarted = true
  setInterval(async () => {
    const client = getServiceClient()
    if (!client) return
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { data: agents } = await client.from('scanner_agents').select('*').eq('status', 'active').lt('last_seen_at', cutoff)
    for (const agent of agents || []) {
      await client.from('scanner_agents').update({ status: 'offline', updated_at: new Date().toISOString() }).eq('id', agent.id).eq('user_id', agent.user_id)
      await client.from('scanner_alerts').insert({
        user_id: agent.user_id,
        agent_id: agent.id,
        severity: 'moderate',
        category: 'agent-heartbeat',
        title: `Scanner agent offline: ${agent.name}`,
        message: `Agent has not sent a heartbeat since ${agent.last_seen_at || 'initial enrollment'}.`,
        recommendation: 'Verify the local scanner service is running and has outbound HTTPS access to QGuard.',
        status: 'open',
        metadata: { lastSeenAt: agent.last_seen_at },
      })
    }

    const staleConnectorCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: connectors } = await client
      .from('connector_accounts')
      .select('*')
      .eq('status', 'connected')
      .or(`last_sync_at.is.null,last_sync_at.lt.${staleConnectorCutoff}`)

    for (const connector of connectors || []) {
      const { data: existingAlert } = await client
        .from('scanner_alerts')
        .select('id')
        .eq('user_id', connector.user_id)
        .eq('connector_account_id', connector.id)
        .eq('category', 'connector-sync')
        .eq('status', 'open')
        .limit(1)
        .maybeSingle()
      if (existingAlert?.id) continue

      await client.from('scanner_alerts').insert({
        user_id: connector.user_id,
        connector_account_id: connector.id,
        severity: 'low',
        category: 'connector-sync',
        title: `Connector needs fresh evidence: ${connector.display_name || connector.provider}`,
        message: `Connector has not synchronized cryptographic evidence in the last 24 hours.`,
        recommendation: 'Run the connector sync or verify connector authorization and network access.',
        status: 'open',
        metadata: { lastSyncAt: connector.last_sync_at, provider: connector.provider },
      })
    }
  }, 60_000).unref?.()
}

export default router
