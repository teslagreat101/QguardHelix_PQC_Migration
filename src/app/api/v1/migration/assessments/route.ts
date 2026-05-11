import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { mapAssessmentSummary } from '@/lib/migration-planner/records'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      )
    }

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 },
      )
    }

    const { data, error } = await client
      .from('migration_assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json(
        { error: { code: 'FETCH_ERROR', message: error.message } },
        { status: 500 },
      )
    }

    return NextResponse.json({
      status: 'success',
      data: (data || []).map(mapAssessmentSummary),
    })
  } catch (error) {
    console.error('GET /api/v1/migration/assessments error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch migration assessments' } },
      { status: 500 },
    )
  }
}
