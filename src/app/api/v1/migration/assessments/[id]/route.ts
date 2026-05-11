import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { mapAssessmentDetail } from '@/lib/migration-planner/records'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      )
    }

    const { id } = await params
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
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Assessment not found' } },
        { status: 404 },
      )
    }

    return NextResponse.json({
      status: 'success',
      data: mapAssessmentDetail(data),
    })
  } catch (error) {
    console.error('GET /api/v1/migration/assessments/:id error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch migration assessment' } },
      { status: 500 },
    )
  }
}
