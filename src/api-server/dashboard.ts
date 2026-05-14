import { Router, Request, Response } from 'express'
import { getToken, getServerUser, getServiceClient, createAuthClient } from '@/lib/supabase-server'

const router = Router()

/**
 * Middleware: require authentication on all dashboard routes.
 */
async function requireAuth(req: Request, res: Response, next: Function) {
  const token = getToken(req)
  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } })
  }

  const user = await getServerUser(token)
  if (!user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } })
  }

  ;(req as any).user = user
  ;(req as any).token = token
  next()
}

router.use(requireAuth)

function isMissingRpc(error: any) {
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return text.includes('42883') || text.includes('pgrst202') || text.includes('could not find the function') || text.includes('does not exist')
}

async function safeCount(client: any, table: string, userId: string, apply?: (query: any) => any) {
  try {
    let query = client.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if (apply) query = apply(query)
    const { count, error } = await query
    if (error) return 0
    return count || 0
  } catch {
    return 0
  }
}

async function safeLatestScanAt(client: any, userId: string) {
  try {
    const { data, error } = await client
      .from('pqc_scan_sessions')
      .select('completed_at, started_at, created_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
    if (error || !data?.length) return null
    return data[0].completed_at || data[0].started_at || data[0].created_at || null
  } catch {
    return null
  }
}

async function buildDashboardSummaryFallback(client: any, userId: string) {
  const [
    totalAssets,
    vulnerableAssetsCount,
    totalCbomItems,
    criticalExposures,
    highExposures,
    unresolvedVulns,
    expiringCerts,
    activeMigrations,
    failedMigrations,
    lastScanAt,
  ] = await Promise.all([
    safeCount(client, 'assets', userId, (q) => q.eq('status', 'active')),
    safeCount(client, 'crypto_exposures', userId, (q) => q.in('severity', ['critical', 'high'])),
    safeCount(client, 'crypto_inventory', userId),
    safeCount(client, 'crypto_exposures', userId, (q) => q.eq('severity', 'critical')),
    safeCount(client, 'crypto_exposures', userId, (q) => q.eq('severity', 'high')),
    safeCount(client, 'vulnerabilities', userId, (q) => q.in('status', ['open', 'in_progress'])),
    safeCount(client, 'certificates', userId, (q) => q.eq('status', 'active').lt('not_after', new Date(Date.now() + 30 * 86400000).toISOString())),
    safeCount(client, 'migration_jobs', userId, (q) => q.in('status', ['pending', 'running', 'in_progress'])),
    safeCount(client, 'migration_jobs', userId, (q) => q.eq('status', 'failed')),
    safeLatestScanAt(client, userId),
  ])

  const penalty = criticalExposures * 80 + highExposures * 35 + unresolvedVulns * 20 + expiringCerts * 10 + failedMigrations * 25
  const quantumRiskScore = Math.max(0, Math.min(1000, 1000 - penalty))
  const riskBand = quantumRiskScore >= 850
    ? 'Quantum Ready'
    : quantumRiskScore >= 650
      ? 'Moderate'
      : quantumRiskScore >= 400
        ? 'Vulnerable'
        : 'Critical'

  return {
    quantumRiskScore,
    riskBand,
    riskTrend: 0,
    vulnerableAssetsCount,
    newVulnerableAssets: 0,
    totalCbomItems,
    activeMigrations,
    failedMigrations,
    criticalExposures,
    highExposures,
    unresolvedVulns,
    expiringCerts,
    totalAssets,
    lastScanAt,
    monitoringStatus: totalAssets > 0 ? 'active' : 'standby',
  }
}

async function buildEventsFallback(client: any, userId: string, limit: number) {
  try {
    const { data, error } = await client
      .from('security_events')
      .select('id, event_type, severity, message, asset_id, resource_name, resource_type, metadata, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []

    return (data || []).map((ev: any) => ({
      id: ev.id,
      timestamp: ev.created_at,
      severity: ev.severity,
      eventType: ev.event_type,
      message: ev.message,
      assetId: ev.asset_id,
      resourceName: ev.resource_name,
      resourceType: ev.resource_type,
      metadata: ev.metadata,
      isRead: ev.is_read,
    }))
  } catch {
    return []
  }
}

async function buildExposureMapFallback(client: any, userId: string) {
  try {
    const [{ data: assets }, { data: relationships }] = await Promise.all([
      client
        .from('assets')
        .select('id, name, type, environment, criticality, status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100),
      client
        .from('asset_relationships')
        .select('source_asset_id, target_asset_id, relationship_type')
        .eq('user_id', userId)
        .limit(200),
    ])

    const nodes = await Promise.all((assets || []).map(async (asset: any) => {
      const riskScore = await safeCount(client, 'crypto_exposures', userId, (q) => q.eq('asset_id', asset.id).eq('severity', 'critical'))
      return {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        environment: asset.environment || 'unknown',
        criticality: asset.criticality || 'medium',
        status: asset.status || 'active',
        riskScore,
        color: getRiskColor(riskScore, asset.status || 'active'),
      }
    }))

    const edges = (relationships || []).map((edge: any) => ({
      source: edge.source_asset_id,
      target: edge.target_asset_id,
      type: edge.relationship_type,
    }))

    return { nodes, edges }
  } catch {
    return { nodes: [], edges: [] }
  }
}

/**
 * GET /api/v1/dashboard/summary
 * Returns user-specific dashboard summary with risk score, counts, and status.
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const token = (req as any).token
    const client = createAuthClient(token)

    if (!client) {
      return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Database connection failed' } })
    }

    // Use RPC function for atomic summary calculation
    const { data: summaryData, error: rpcError } = await client.rpc('get_dashboard_summary', {
      p_user_id: user.id
    })

    if (rpcError) {
      if (!isMissingRpc(rpcError)) {
        console.warn('Dashboard summary RPC error, using SQL fallback:', rpcError)
      }
      const summary = await buildDashboardSummaryFallback(client, user.id)
      return res.json({ data: summary })
    }

    // Fetch previous scan for trend comparison
    const { data: previousScans } = await client
      .from('pqc_scan_sessions')
      .select('completed_at, findings_count')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(2)

    let riskTrend = 0
    if (previousScans && previousScans.length >= 2) {
      const current = previousScans[0].findings_count || 0
      const previous = previousScans[1].findings_count || 0
      riskTrend = previous - current // positive = fewer findings = improving
    }

    // Count new vulnerable assets since last scan
    let newVulnerableAssets = 0
    if (previousScans && previousScans.length > 0) {
      const lastScanDate = previousScans[0].completed_at
      const { count } = await client
        .from('crypto_exposures')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gt('created_at', lastScanDate)
      newVulnerableAssets = count || 0
    }

    const summary = summaryData || {}

    return res.json({
      data: {
        quantumRiskScore: summary.quantumRiskScore || 1000,
        riskBand: summary.riskBand || 'Quantum Ready',
        riskTrend,
        vulnerableAssetsCount: summary.vulnerableAssetsCount || 0,
        newVulnerableAssets,
        totalCbomItems: summary.totalCbomItems || 0,
        activeMigrations: summary.activeMigrations || 0,
        failedMigrations: summary.failedMigrations || 0,
        criticalExposures: summary.criticalExposures || 0,
        highExposures: summary.highExposures || 0,
        unresolvedVulns: summary.unresolvedVulns || 0,
        expiringCerts: summary.expiringCerts || 0,
        totalAssets: summary.totalAssets || 0,
        lastScanAt: summary.lastScanAt || null,
        monitoringStatus: summary.monitoringStatus || 'active',
      }
    })
  } catch (err) {
    console.error('Dashboard summary error:', err)
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch dashboard summary' } })
  }
})

/**
 * GET /api/v1/dashboard/events
 * Returns recent security events for the authenticated user.
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const token = (req as any).token
    const client = createAuthClient(token)
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)

    if (!client) {
      return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Database connection failed' } })
    }

    const { data: eventsData, error: rpcError } = await client.rpc('get_recent_security_events', {
      p_user_id: user.id,
      p_limit: limit
    })

    if (rpcError) {
      if (!isMissingRpc(rpcError)) {
        console.warn('Security events RPC error, using SQL fallback:', rpcError)
      }
      const events = await buildEventsFallback(client, user.id, limit)
      return res.json({ data: { events } })
    }

    const events = (eventsData || []).map((ev: any) => ({
      id: ev.id,
      timestamp: ev.createdAt,
      severity: ev.severity,
      eventType: ev.eventType,
      message: ev.message,
      assetId: ev.assetId,
      resourceName: ev.resourceName,
      resourceType: ev.resourceType,
      metadata: ev.metadata,
      isRead: ev.isRead,
    }))

    return res.json({ data: { events } })
  } catch (err) {
    console.error('Dashboard events error:', err)
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch security events' } })
  }
})

/**
 * GET /api/v1/dashboard/exposure-map
 * Returns nodes and edges for the Quantum Exposure Map.
 */
router.get('/exposure-map', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const token = (req as any).token
    const client = createAuthClient(token)

    if (!client) {
      return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Database connection failed' } })
    }

    const { data: mapData, error: rpcError } = await client.rpc('get_exposure_map', {
      p_user_id: user.id
    })

    if (rpcError) {
      if (!isMissingRpc(rpcError)) {
        console.warn('Exposure map RPC error, using SQL fallback:', rpcError)
      }
      const mapData = await buildExposureMapFallback(client, user.id)
      return res.json({ data: mapData })
    }

    // Enrich nodes with latest crypto inventory and vulnerabilities
    const nodes = (mapData?.nodes || []).map((node: any) => ({
      ...node,
      color: getRiskColor(node.riskScore, node.status),
    }))

    return res.json({
      data: {
        nodes,
        edges: mapData?.edges || []
      }
    })
  } catch (err) {
    console.error('Exposure map error:', err)
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch exposure map' } })
  }
})

function getRiskColor(riskScore: number, status: string): string {
  if (status === 'migrated' || status === 'protected') return '#10b981' // green
  if (!riskScore || riskScore === 0) return '#3b82f6' // blue
  if (riskScore >= 3) return '#ef4444' // red - critical
  if (riskScore >= 2) return '#f97316' // orange - high
  return '#eab308' // yellow - moderate
}

/**
 * GET /api/v1/dashboard/activity
 * Returns recent user activities across all modules.
 */
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const token = (req as any).token
    const client = createAuthClient(token)
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

    if (!client) {
      return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Database connection failed' } })
    }

    // Parallel fetch of recent activities from multiple tables
    const [
      { data: scans },
      { data: migrations },
      { data: vaultLogs },
      { data: qrngEvents },
      { data: compliance },
      { data: auditLogs }
    ] = await Promise.all([
      client.from('pqc_scan_sessions').select('id, status, progress, started_at, completed_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit),
      client.from('migration_jobs').select('id, name, status, progress, started_at, completed_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit),
      client.from('vault_audit_logs').select('id, event_type, operation, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit),
      client.from('qrng_events').select('id, event_type, algorithm, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit),
      client.from('compliance_evidence').select('id, framework, control_id, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit),
      client.from('audit_logs').select('id, action, entity_type, details, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit),
    ])

    const activities = [
      ...(scans || []).map((s: any) => ({
        id: s.id,
        type: 'scan',
        title: `PQC Scan ${s.status}`,
        description: `Scan ${s.status === 'completed' ? 'completed' : `progress: ${s.progress}%`}`,
        status: s.status,
        timestamp: s.completed_at || s.started_at,
      })),
      ...(migrations || []).map((m: any) => ({
        id: m.id,
        type: 'migration',
        title: m.name,
        description: `Migration ${m.status} — ${m.progress}%`,
        status: m.status,
        timestamp: m.completed_at || m.started_at,
      })),
      ...(vaultLogs || []).map((v: any) => ({
        id: v.id,
        type: 'vault',
        title: `Vault ${v.event_type}`,
        description: `${v.operation || v.event_type} — ${v.status}`,
        status: v.status,
        timestamp: v.created_at,
      })),
      ...(qrngEvents || []).map((q: any) => ({
        id: q.id,
        type: 'qrng',
        title: `QRNG ${q.event_type}`,
        description: q.algorithm ? `Algorithm: ${q.algorithm}` : 'Entropy event',
        status: 'completed',
        timestamp: q.created_at,
      })),
      ...(compliance || []).map((c: any) => ({
        id: c.id,
        type: 'compliance',
        title: `${c.framework} ${c.control_id}`,
        description: `Compliance evidence ${c.status}`,
        status: c.status,
        timestamp: c.created_at,
      })),
      ...(auditLogs || []).map((a: any) => ({
        id: a.id,
        type: 'audit',
        title: a.action,
        description: `${a.entity_type || 'system'} action`,
        status: 'completed',
        timestamp: a.created_at,
      })),
    ]

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return res.json({ data: { activities: activities.slice(0, limit) } })
  } catch (err) {
    console.error('Dashboard activity error:', err)
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch activity' } })
  }
})

/**
 * GET /api/v1/dashboard/health
 * Returns backend, realtime, and worker health status.
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const token = (req as any).token
    const client = createAuthClient(token)
    const serviceClient = getServiceClient()

    let supabaseStatus = 'unknown'
    if (client) {
      const { error } = await client.from('assets').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      supabaseStatus = error ? 'degraded' : 'healthy'
    }

    // Check for active scans and migrations
    let scannerStatus = 'idle'
    let migrationStatus = 'idle'

    if (client) {
      const { count: activeScans } = await client
        .from('pqc_scan_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'running')
      if ((activeScans || 0) > 0) scannerStatus = 'scanning'

      const { count: activeMigrations } = await client
        .from('migration_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'running')
      if ((activeMigrations || 0) > 0) migrationStatus = 'migrating'
    }

    return res.json({
      data: {
        status: supabaseStatus === 'healthy' ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          supabase: supabaseStatus,
          scanner: scannerStatus,
          migration: migrationStatus,
          realtime: supabaseStatus === 'healthy' ? 'connected' : 'disconnected',
        },
        version: '2.0.0'
      }
    })
  } catch (err) {
    console.error('Dashboard health error:', err)
    return res.status(200).json({
      data: {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        services: { supabase: 'unknown', scanner: 'unknown', migration: 'unknown', realtime: 'disconnected' },
        version: '2.0.0'
      }
    })
  }
})

/**
 * GET /api/v1/dashboard/recommendations
 * Returns prioritized remediation actions based on actual findings.
 */
router.get('/recommendations', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const token = (req as any).token
    const client = createAuthClient(token)

    if (!client) {
      return res.status(500).json({ error: { code: 'DB_ERROR', message: 'Database connection failed' } })
    }

    const recommendations: any[] = []

    // Check for RSA/ECC exposures
    const { data: cryptoExposures } = await client
      .from('crypto_exposures')
      .select('id, asset_id, exposure_type, severity, assets(name)')
      .eq('user_id', user.id)
      .in('exposure_type', ['rsa', 'ecc', 'dh'])
      .order('severity', { ascending: false })
      .limit(10)

    for (const exp of (cryptoExposures || [])) {
      const assetName = (exp as any).assets?.name || 'Unknown asset'
      recommendations.push({
        id: `exp-${exp.id}`,
        priority: exp.severity === 'critical' ? 1 : exp.severity === 'high' ? 2 : 3,
        category: 'cryptography',
        title: `Replace ${exp.exposure_type.toUpperCase()} on ${assetName}`,
        description: `Detected quantum-vulnerable ${exp.exposure_type.toUpperCase()} cryptography requiring migration to PQC algorithms (ML-KEM, ML-DSA).`,
        assetId: exp.asset_id,
        action: 'start_migration',
        estimatedEffort: 'medium',
      })
    }

    // Check for weak TLS
    const { data: tlsExposures } = await client
      .from('crypto_exposures')
      .select('id, asset_id, exposure_type, severity, assets(name)')
      .eq('user_id', user.id)
      .eq('exposure_type', 'weak_tls')
      .limit(5)

    for (const exp of (tlsExposures || [])) {
      const assetName = (exp as any).assets?.name || 'Unknown asset'
      recommendations.push({
        id: `tls-${exp.id}`,
        priority: exp.severity === 'critical' ? 1 : 2,
        category: 'protocol',
        title: `Upgrade TLS configuration on ${assetName}`,
        description: 'Weak TLS version or cipher suite detected. Enable TLS 1.3 with hybrid post-quantum key exchange.',
        assetId: exp.asset_id,
        action: 'upgrade_tls',
        estimatedEffort: 'low',
      })
    }

    // Check for expiring certificates
    const { data: expiringCerts } = await client
      .from('certificates')
      .select('id, asset_id, name, not_after, algorithm, assets(name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lt('not_after', new Date(Date.now() + 30 * 86400000).toISOString())
      .order('not_after', { ascending: true })
      .limit(5)

    for (const cert of (expiringCerts || [])) {
      const assetName = (cert as any).assets?.name || 'Unknown asset'
      const daysLeft = Math.ceil((new Date(cert.not_after!).getTime() - Date.now()) / 86400000)
      recommendations.push({
        id: `cert-${cert.id}`,
        priority: daysLeft <= 7 ? 1 : 2,
        category: 'certificate',
        title: `Renew certificate: ${cert.name}`,
        description: `Certificate expires in ${daysLeft} days on ${assetName}. Transition to ML-DSA or hybrid certificate.`,
        assetId: cert.asset_id,
        action: 'renew_certificate',
        estimatedEffort: 'medium',
      })
    }

    // Check for failed migrations
    const { data: failedMigrations } = await client
      .from('migration_jobs')
      .select('id, asset_id, name, job_type')
      .eq('user_id', user.id)
      .eq('status', 'failed')
      .limit(5)

    for (const job of (failedMigrations || [])) {
      recommendations.push({
        id: `migrate-${job.id}`,
        priority: 2,
        category: 'migration',
        title: `Review failed migration: ${job.name}`,
        description: `Migration job failed. Review logs and retry with corrected parameters.`,
        assetId: job.asset_id,
        action: 'review_migration',
        estimatedEffort: 'high',
      })
    }

    // Check for unscanned assets
    const { count: unscannedCount } = await client
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')

    const { count: scannedCount } = await client
      .from('pqc_scan_results')
      .select('asset_id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((unscannedCount || 0) > 0 && (scannedCount || 0) === 0) {
      recommendations.push({
        id: 'scan-assets',
        priority: 1,
        category: 'discovery',
        title: 'Run PQC Discovery Scan',
        description: `${unscannedCount} assets have not been scanned for quantum vulnerabilities. Start a comprehensive scan to build your CBOM.`,
        action: 'start_scan',
        estimatedEffort: 'low',
      })
    }

    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority)

    return res.json({ data: { recommendations: recommendations.slice(0, 20) } })
  } catch (err) {
    console.error('Dashboard recommendations error:', err)
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate recommendations' } })
  }
})

export default router
