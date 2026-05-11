import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getToken } from '@/lib/server-auth'
import { createAuthClient } from '@/lib/supabase'

/**
 * PATCH /api/v1/monitoring/alerts/:id/read
 * Marks a monitoring alert as read for the authenticated user.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { id: alertId } = await params

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    const { error } = await client
      .from('monitoring_alerts')
      .update({ is_read: true })
      .eq('id', alertId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: 'success' })
  } catch (err) {
    console.error('Mark alert read error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to mark alert as read' } },
      { status: 500 }
    )
  }
}
