import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    // Aggregate activity from multiple sources for a holistic view
    const [alertsResult, scansResult, webScansResult, keysResult, vaultResult] = await Promise.all([
      // Recent monitoring alerts
      client
        .from('monitoring_alerts')
        .select('id, type, title, message, severity, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      // Recent quantum scan sessions
      client
        .from('scan_sessions')
        .select('id, status, targets_scanned, total_findings, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      // Recent web scanner sessions
      client
        .from('web_scan_sessions')
        .select('id, target, target_type, total_findings, critical_count, high_count, overall_risk_score, is_quantum_safe, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      // Recent key generations
      client
        .from('generated_keys')
        .select('id, algorithm, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      // Recent vault operations
      client
        .from('vault_files')
        .select('id, name, encryption_algorithm, uploaded_at')
        .eq('user_id', user.id)
        .order('uploaded_at', { ascending: false })
        .limit(10),
    ])

    // Merge and normalize into a unified activity feed
    const activities: Array<{
      id: string
      eventType: string
      description: string
      ipAddress: string | null
      userAgent: string | null
      timestamp: string
      severity: 'info' | 'warning' | 'critical'
    }> = []

    // Map alerts
    for (const alert of alertsResult.data || []) {
      activities.push({
        id: `alert-${alert.id}`,
        eventType: `alert.${alert.type}`,
        description: alert.title,
        ipAddress: null,
        userAgent: null,
        timestamp: alert.created_at,
        severity: alert.severity === 'critical' ? 'critical' : alert.severity === 'warning' ? 'warning' : 'info',
      })
    }

    // Map scans
    for (const scan of scansResult.data || []) {
      activities.push({
        id: `scan-${scan.id}`,
        eventType: 'scan.completed',
        description: `Quantum scan completed — ${scan.total_findings || 0} findings across ${scan.targets_scanned || 0} targets`,
        ipAddress: null,
        userAgent: null,
        timestamp: scan.created_at,
        severity: (scan.total_findings || 0) > 5 ? 'warning' : 'info',
      })
    }

    // Map web scans
    for (const ws of webScansResult.data || []) {
      const criticalCount = ws.critical_count || 0
      const highCount = ws.high_count || 0
      const riskScore = ws.overall_risk_score || 0
      const severity = criticalCount > 0 ? 'critical' as const : highCount > 0 || riskScore >= 60 ? 'warning' as const : 'info' as const
      activities.push({
        id: `webscan-${ws.id}`,
        eventType: 'webscan.completed',
        description: `Web scan on ${ws.target_type} "${ws.target}" — ${ws.total_findings || 0} findings (risk: ${riskScore}/100)${ws.is_quantum_safe ? ' ✓ quantum safe' : ' ⚠ quantum vulnerable'}`,
        ipAddress: null,
        userAgent: null,
        timestamp: ws.created_at,
        severity,
      })
    }

    // Map key generations
    for (const key of keysResult.data || []) {
      activities.push({
        id: `key-${key.id}`,
        eventType: 'key.generated',
        description: `Generated ${key.algorithm} key`,
        ipAddress: null,
        userAgent: null,
        timestamp: key.created_at,
        severity: 'info',
      })
    }

    // Map vault uploads
    for (const file of vaultResult.data || []) {
      activities.push({
        id: `vault-${file.id}`,
        eventType: 'vault.upload',
        description: `Encrypted and stored "${file.name}" with ${file.encryption_algorithm}`,
        ipAddress: null,
        userAgent: null,
        timestamp: file.uploaded_at,
        severity: 'info',
      })
    }

    // Sort by timestamp descending and take top 30
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      data: activities.slice(0, 30),
    })
  } catch (err) {
    console.error('Activity error:', err)
    return NextResponse.json(
      { error: { code: 'ACTIVITY_ERROR', message: 'Failed to fetch account activity' } },
      { status: 500 }
    )
  }
}
