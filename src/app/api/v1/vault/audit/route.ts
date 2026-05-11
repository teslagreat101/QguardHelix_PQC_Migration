import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { getAuditEvents, getAccessLogs, verifyAuditChain } from '@/lib/vault/audit-service'

/**
 * GET /api/v1/vault/audit
 *
 * Get vault audit events and access logs.
 *
 * Query params:
 * - type: 'events' | 'access' | 'verify-chain' (default: 'events')
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 * - eventType: filter by specific event type
 * - severity: filter by severity (critical, warning, info)
 * - fileId: filter access logs by file
 */
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
        { error: { code: 'CONFIG_ERROR', message: 'Database not configured' } },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'events'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    switch (type) {
      case 'events': {
        const eventType = searchParams.get('eventType') || undefined
        const severity = searchParams.get('severity') || undefined

        const events = await getAuditEvents(user.id, {
          limit,
          offset,
          eventType: eventType as Parameters<typeof getAuditEvents>[1] extends { eventType?: infer T } ? T : never,
          severity: severity as 'critical' | 'warning' | 'info' | undefined,
          client,
        })

        return NextResponse.json({
          data: {
            events,
            count: events.length,
            offset,
            limit,
          },
        })
      }

      case 'access': {
        const fileId = searchParams.get('fileId') || undefined
        const operation = searchParams.get('operation') || undefined

        const logs = await getAccessLogs(user.id, {
          limit,
          fileId,
          operation: operation as Parameters<typeof getAccessLogs>[1] extends { operation?: infer T } ? T : never,
          client,
        })

        return NextResponse.json({
          data: {
            logs,
            count: logs.length,
          },
        })
      }

      case 'verify-chain': {
        const result = await verifyAuditChain(user.id, client)
        return NextResponse.json({ data: result })
      }

      default:
        return NextResponse.json(
          { error: { code: 'INVALID_TYPE', message: 'Valid types: events, access, verify-chain' } },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error('Vault audit error:', err)
    return NextResponse.json(
      { error: { code: 'AUDIT_ERROR', message: 'Failed to fetch audit data' } },
      { status: 500 }
    )
  }
}
