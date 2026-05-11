import { NextRequest, NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/admin'
import { getServerUser } from '@/lib/server-auth'
import type { RemediationModel, ScanEvidence } from '@/types/scanner.types'

/**
 * Scan results store — latest scan findings per user.
 * Used by the migration page to read EXACTLY what the scanner found.
 *
 * POST /api/v1/scan/results — Save scan results after a scan completes
 * GET  /api/v1/scan/results — Retrieve the latest scan results
 *
 * Storage: in-memory (globalThis) + Supabase scan_history fallback for persistence.
 */

interface StoredScanResults {
  findings: StoredFinding[]
  targets: string[]
  qScore: number | null
  timestamp: string
}

interface StoredFinding {
  id: string
  detectedAlgorithm: string
  threatLevel: string
  isHNDLRisk: boolean
  target: { name: string; type: string; provider?: string }
  quantumBreakTime: string
  classicalBreakTime: string
  recommendation: string
  description: string
  riskScore: number
  evidence?: ScanEvidence
  remediation?: RemediationModel
}

// Use globalThis to survive Next.js dev hot reloads
const gKey = '__qguard_scan_results__' as const
function getScanResultsStore(): Map<string, StoredScanResults> {
  const g = globalThis as Record<string, unknown>
  if (!g[gKey]) g[gKey] = new Map<string, StoredScanResults>()
  return g[gKey] as Map<string, StoredScanResults>
}
const scanResultsStore = getScanResultsStore()

async function resolveUserId(request: NextRequest): Promise<string | null> {
  const user = await getServerUser(request)
  return user?.id ?? null
}

/**
 * POST /api/v1/scan/results
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { findings, targets, qScore } = body

    if (!Array.isArray(findings)) {
      return NextResponse.json(
        { error: 'findings must be an array' },
        { status: 400 }
      )
    }

    const userId = await resolveUserId(request)
    if (!userId) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    scanResultsStore.set(userId, {
      findings,
      targets: Array.isArray(targets) ? targets : [],
      qScore: typeof qScore === 'number' ? qScore : null,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      stored: findings.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Scan results POST error:', err)
    return NextResponse.json(
      { error: 'Failed to store scan results' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/scan/results
 * Returns latest scan results. Checks in-memory first, then falls back
 * to the most recent completed scan from scan_history in Supabase.
 */
export async function GET(request: NextRequest) {
  // 1. Check in-memory store
  const userId = await resolveUserId(request)
  if (!userId) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    )
  }

  const stored = scanResultsStore.get(userId)

  if (stored && stored.findings.length > 0) {
    return NextResponse.json({ data: stored })
  }

  // 2. Fallback: check scan_history in Supabase for most recent completed scan
  try {
    const serviceClient = getServiceClient()
    if (serviceClient) {
      const { data } = await serviceClient
        .from('scan_history')
        .select('findings, targets, q_score, completed_at')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data?.findings && Array.isArray(data.findings) && data.findings.length > 0) {
        const result: StoredScanResults = {
          findings: data.findings as StoredFinding[],
          targets: data.targets || [],
          qScore: data.q_score,
          timestamp: data.completed_at || new Date().toISOString(),
        }
        // Cache it in memory for subsequent requests
        scanResultsStore.set(userId, result)
        return NextResponse.json({ data: result })
      }
    }
  } catch {
    // Non-critical — return empty
  }

  return NextResponse.json({
    data: null,
    message: 'No scan results found. Run a scan first.',
  })
}
