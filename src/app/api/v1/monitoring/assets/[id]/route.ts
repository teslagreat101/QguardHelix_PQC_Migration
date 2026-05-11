import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getToken } from '@/lib/server-auth'
import { createAuthClient } from '@/lib/supabase'

/**
 * DELETE /api/v1/monitoring/assets/:id
 * Removes a monitored asset for the authenticated user.
 */
export async function DELETE(
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

    const { id: assetId } = await params

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    const { error } = await client
      .from('monitored_assets')
      .delete()
      .eq('id', assetId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json(
        { error: { code: 'DELETE_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: 'success' })
  } catch (err) {
    console.error('DELETE /monitoring/assets/:id error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete asset' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/v1/monitoring/assets/:id
 * Updates a monitored asset (label, check interval, or pauses/resumes).
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

    const { id: assetId } = await params
    const body = await request.json()

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    // Only allow safe fields to be updated
    const updates: Record<string, unknown> = {}
    if (body.label && typeof body.label === 'string') {
      updates.label = body.label.trim().slice(0, 128)
    }
    if (body.checkIntervalS && typeof body.checkIntervalS === 'number') {
      updates.check_interval_s = Math.max(300, Math.min(body.checkIntervalS, 86400))
    }
    if (body.status && ['active', 'offline'].includes(body.status)) {
      updates.status = body.status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No valid fields to update' } },
        { status: 400 }
      )
    }

    const { data, error } = await client
      .from('monitored_assets')
      .update(updates)
      .eq('id', assetId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: 'success', data })
  } catch (err) {
    console.error('PATCH /monitoring/assets/:id error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update asset' } },
      { status: 500 }
    )
  }
}
