import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/admin'
import { createAuthClient } from '@/lib/supabase'
import { getServerUserFromToken } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

// In-memory fallback for scan history (survives hot reloads via globalThis)
interface ScanHistoryEntry {
  id: string
  user_id: string
  scan_id: string
  targets: string[]
  scan_type: string
  status: string
  total_findings: number
  critical_count: number
  high_count: number
  medium_count: number
  low_count: number
  q_score: number | null
  risk_level: string | null
  findings: unknown[]
  summary: Record<string, unknown>
  started_at: string
  completed_at: string | null
  created_at: string
}

const gKey = '__qguard_scan_history__' as const
function getMemoryStore(): ScanHistoryEntry[] {
  const g = globalThis as Record<string, unknown>
  if (!g[gKey]) g[gKey] = [] as ScanHistoryEntry[]
  return g[gKey] as ScanHistoryEntry[]
}

function resolveUser(request: NextRequest): { userId: string | null; token: string | null } {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return { userId: null, token: null }
  return { userId: null, token: authHeader.slice(7) }
}

async function getUserId(token: string): Promise<string | null> {
  const user = await getServerUserFromToken(token)
  return user?.id ?? null
}

/**
 * GET /api/v1/scan/history — List scan history for current user
 */
export async function GET(request: NextRequest) {
  try {
    const { token } = resolveUser(request)
    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const userId = await getUserId(token)
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401 }
      )
    }

    // Try Supabase first
    const serviceClient = getServiceClient()
    if (serviceClient) {
      const { data, error } = await serviceClient
        .from('scan_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data && data.length > 0) {
        return NextResponse.json({ data: { scans: data } })
      }
    }

    // Fallback to in-memory
    const memory = getMemoryStore()
    const userScans = memory
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 50)

    return NextResponse.json({ data: { scans: userScans } })
  } catch (err) {
    console.error('Scan history GET error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load scan history' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/v1/scan/history — Save a scan to history
 */
export async function POST(request: NextRequest) {
  try {
    const { token } = resolveUser(request)
    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const userId = await getUserId(token)
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      scanId,
      targets,
      scanType = 'standard',
      status = 'completed',
      findings = [],
      qScore = null,
      riskLevel = null,
      summary = {},
    } = body

    const now = new Date().toISOString()
    const entry: ScanHistoryEntry = {
      id: crypto.randomUUID(),
      user_id: userId,
      scan_id: scanId || crypto.randomUUID(),
      targets: Array.isArray(targets) ? targets : [],
      scan_type: scanType,
      status,
      total_findings: Array.isArray(findings) ? findings.length : 0,
      critical_count: findings.filter?.((f: { threatLevel?: string }) => f.threatLevel === 'critical')?.length ?? 0,
      high_count: findings.filter?.((f: { threatLevel?: string }) => f.threatLevel === 'high')?.length ?? 0,
      medium_count: findings.filter?.((f: { threatLevel?: string }) => f.threatLevel === 'medium')?.length ?? 0,
      low_count: findings.filter?.((f: { threatLevel?: string }) => f.threatLevel === 'low')?.length ?? 0,
      q_score: qScore,
      risk_level: riskLevel,
      findings,
      summary,
      started_at: now,
      completed_at: status === 'completed' ? now : null,
      created_at: now,
    }

    // Try Supabase
    const serviceClient = getServiceClient()
    if (serviceClient) {
      const { error } = await serviceClient
        .from('scan_history')
        .insert({
          user_id: entry.user_id,
          scan_id: entry.scan_id,
          targets: entry.targets,
          scan_type: entry.scan_type,
          status: entry.status,
          total_findings: entry.total_findings,
          critical_count: entry.critical_count,
          high_count: entry.high_count,
          medium_count: entry.medium_count,
          low_count: entry.low_count,
          q_score: entry.q_score,
          risk_level: entry.risk_level,
          findings: entry.findings,
          summary: entry.summary,
          started_at: entry.started_at,
          completed_at: entry.completed_at,
        })

      if (error) {
        console.error('Scan history Supabase insert error:', error)
      }
    }

    // Always store in memory as fallback
    const memory = getMemoryStore()
    memory.push(entry)

    return NextResponse.json({ data: { id: entry.id, stored: true } })
  } catch (err) {
    console.error('Scan history POST error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to save scan history' } },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/scan/history — Delete a scan from history
 * Query: ?id=<scan-history-id>
 */
export async function DELETE(request: NextRequest) {
  try {
    const { token } = resolveUser(request)
    if (!token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const userId = await getUserId(token)
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const historyId = searchParams.get('id')
    if (!historyId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'id query parameter required' } },
        { status: 400 }
      )
    }

    // Try Supabase
    const serviceClient = getServiceClient()
    if (serviceClient) {
      await serviceClient
        .from('scan_history')
        .delete()
        .eq('id', historyId)
        .eq('user_id', userId)
    }

    // Remove from memory
    const memory = getMemoryStore()
    const idx = memory.findIndex((s) => s.id === historyId && s.user_id === userId)
    if (idx !== -1) memory.splice(idx, 1)

    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    console.error('Scan history DELETE error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete scan' } },
      { status: 500 }
    )
  }
}
