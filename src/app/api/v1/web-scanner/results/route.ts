import { NextRequest, NextResponse } from 'next/server'
import { getToken, getServerUser } from '@/lib/server-auth'
import { createAuthClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/v1/web-scanner/results
 * Persists a web scanner scan result to the database.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { status: 'error', message: 'Authentication required', persisted: false },
        { status: 401 }
      )
    }
    const userId = user.id

    const body = await request.json()

    const {
      target,
      targetType,
      scanDuration,
      overallRiskScore,
      totalFindings,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      safeCount,
      tlsVersion,
      certificateAlgorithm,
      isQuantumSafe,
      findings,
      // Enhanced fields from quantum scanner engine
      tlsAnalysis,
      cipherSuiteBreakdown,
      riskBreakdown,
    } = body

    // Input validation
    if (!target || !targetType) {
      return NextResponse.json(
        { status: 'error', message: 'target and targetType are required' },
        { status: 400 }
      )
    }

    const supabase = createAuthClient(token)

    if (!supabase) {
      return NextResponse.json(
        { status: 'error', message: 'Database unavailable', persisted: false },
        { status: 503 }
      )
    }

    // Insert the scan session
    const { data: session, error: sessionError } = await supabase
      .from('web_scan_sessions')
      .insert({
        user_id: userId,
        target,
        target_type: targetType,
        scan_duration: scanDuration || 0,
        overall_risk_score: overallRiskScore || 0,
        total_findings: totalFindings || 0,
        critical_count: criticalCount || 0,
        high_count: highCount || 0,
        medium_count: mediumCount || 0,
        low_count: lowCount || 0,
        safe_count: safeCount || 0,
        tls_version: tlsVersion || null,
        certificate_algorithm: certificateAlgorithm || null,
        is_quantum_safe: isQuantumSafe || false,
        status: 'completed',
        tls_analysis: tlsAnalysis || null,
        cipher_suite_breakdown: cipherSuiteBreakdown || null,
        risk_breakdown: riskBreakdown || null,
      })
      .select('id, created_at')
      .single()

    if (sessionError) {
      console.error('[web-scanner/results] Session insert error:', sessionError)
      return NextResponse.json(
        { status: 'error', message: `Failed to save scan session: ${sessionError.message}`, persisted: false },
        { status: 500 }
      )
    }

    // Insert individual findings
    let findingsPersisted = 0
    if (findings && Array.isArray(findings) && session?.id) {
      const findingRows = findings.map((f: Record<string, unknown>) => ({
        session_id: session.id,
        user_id: userId,
        algorithm: f.algorithm || 'Unknown',
        location: f.location,
        threat_level: (f.threatLevel as string || 'medium').toLowerCase(),
        category: f.category,
        description: f.description,
        recommendation: f.recommendation,
        quantum_break_time: f.quantumBreakTime,
        classical_break_time: f.classicalBreakTime,
        // Enhanced fields
        oid: f.oid || null,
        cipher_suite_detail: f.cipherSuiteDetail || null,
        repo_file_path: f.repoFilePath || null,
        line_number: f.lineNumber || null,
        pqc_recommendation: f.pqcRecommendation || null,
      }))

      const { error: findingsError, data: insertedFindings } = await supabase
        .from('web_scan_findings')
        .insert(findingRows)
        .select('id')

      if (findingsError) {
        console.error('[web-scanner/results] Findings insert error:', findingsError)
      }
      findingsPersisted = insertedFindings?.length || 0
    }

    return NextResponse.json({
      status: 'success',
      data: {
        id: session?.id,
        persisted: true,
        findingsPersisted,
        createdAt: session?.created_at,
      },
    })
  } catch (error) {
    console.error('[web-scanner/results] Error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to persist scan results', persisted: false },
      { status: 500 }
    )
  }
}

/**
 * GET /api/v1/web-scanner/results
 * Fetches web scanner scan history for the authenticated user.
 * Optional query param: ?sessionId=<uuid> to fetch findings for a specific session
 */
export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { status: 'error', message: 'Authentication required' },
        { status: 401 }
      )
    }
    const userId = user.id

    const sessionId = request.nextUrl.searchParams.get('sessionId')

    const supabase = createAuthClient(token)

    if (!supabase) {
      return NextResponse.json(
        { status: 'error', message: 'Database unavailable' },
        { status: 503 }
      )
    }

    // If sessionId is provided, fetch that specific session and its findings
    if (sessionId) {
      const [sessionResult, findingsResult] = await Promise.all([
        supabase
          .from('web_scan_sessions')
          .select('*')
          .eq('id', sessionId)
          .eq('user_id', userId)
          .single(),
        supabase
          .from('web_scan_findings')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
      ])

      if (sessionResult.error || !sessionResult.data) {
        return NextResponse.json(
          { status: 'error', message: 'Scan session not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        status: 'success',
        data: {
          session: sessionResult.data,
          findings: findingsResult.data || [],
        },
      })
    }

    // Otherwise, fetch all sessions for the user
    const { data: sessions, error: sessionsError } = await supabase
      .from('web_scan_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (sessionsError) {
      console.error('[web-scanner/results] GET sessions error:', sessionsError)
      return NextResponse.json(
        { status: 'error', message: `Failed to fetch history: ${sessionsError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'success',
      data: {
        sessions: sessions || [],
      },
    })
  } catch (error) {
    console.error('[web-scanner/results] GET Error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch web scanner results' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/v1/web-scanner/results
 * Deletes one or more scan sessions (and cascading findings) for the authenticated user.
 * Body: { sessionIds: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { status: 'error', message: 'Authentication required' },
        { status: 401 }
      )
    }
    const userId = user.id

    const body = await request.json()
    const { sessionIds } = body as { sessionIds?: string[] }

    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'sessionIds array is required' },
        { status: 400 }
      )
    }

    // Limit batch size to prevent abuse
    if (sessionIds.length > 50) {
      return NextResponse.json(
        { status: 'error', message: 'Maximum 50 sessions can be deleted at once' },
        { status: 400 }
      )
    }

    const supabase = createAuthClient(token)

    if (!supabase) {
      return NextResponse.json(
        { status: 'error', message: 'Database unavailable' },
        { status: 503 }
      )
    }

    // Delete sessions (findings cascade via ON DELETE CASCADE)
    const { error, count } = await supabase
      .from('web_scan_sessions')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .in('id', sessionIds)

    if (error) {
      console.error('[web-scanner/results] DELETE error:', error)
      return NextResponse.json(
        { status: 'error', message: `Failed to delete sessions: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'success',
      data: { deleted: count || 0 },
    })
  } catch (error) {
    console.error('[web-scanner/results] DELETE Error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to delete scan sessions' },
      { status: 500 }
    )
  }
}
