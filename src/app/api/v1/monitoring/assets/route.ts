import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getToken } from '@/lib/server-auth'
import { createAuthClient } from '@/lib/supabase'

// ── Validation helpers ───────────────────────────────────────────────────────

const DOMAIN_RE = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/
const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
const IPV6_RE = /^([\da-fA-F]{1,4}:){7}[\da-fA-F]{1,4}$|^::$|^([\da-fA-F]{1,4}:){1,7}:$|^:((:[\da-fA-F]{1,4}){1,7}|:)$|^[\da-fA-F]{1,4}:((:[\da-fA-F]{1,4}){0,5}:[\da-fA-F]{1,4}|(:[\da-fA-F]{1,4}){1,6})$/

const ASSET_TYPES = ['domain', 'ip', 'endpoint', 'service'] as const

function validateTarget(assetType: string, target: string): string | null {
  const t = target.trim()
  if (!t) return 'Target is required'
  if (t.length > 2048) return 'Target exceeds maximum length (2048 characters)'

  switch (assetType) {
    case 'domain':
      if (!DOMAIN_RE.test(t)) return 'Invalid domain format (e.g. example.com)'
      return null
    case 'ip':
      if (!IPV4_RE.test(t) && !IPV6_RE.test(t)) return 'Invalid IP address (IPv4 or IPv6)'
      return null
    case 'endpoint': {
      try {
        const url = new URL(t)
        if (!['http:', 'https:'].includes(url.protocol)) return 'Endpoint must use http or https'
      } catch {
        return 'Invalid endpoint URL (e.g. https://api.example.com/health)'
      }
      return null
    }
    case 'service':
      // service: host:port or just a name
      if (t.length < 1) return 'Service identifier is required'
      return null
    default:
      return `Invalid asset type. Must be one of: ${ASSET_TYPES.join(', ')}`
  }
}

const MAX_ASSETS_PER_USER: Record<string, number> = {
  free: 5,
  pro: 25,
  elite: 100,
}

// ── GET /api/v1/monitoring/assets ────────────────────────────────────────────

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

    const { data, error } = await client
      .from('monitored_assets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: { code: 'FETCH_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: 'success', data })
  } catch (err) {
    console.error('GET /monitoring/assets error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assets' } },
      { status: 500 }
    )
  }
}

// ── POST /api/v1/monitoring/assets ───────────────────────────────────────────

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { label, assetType, target, checkIntervalS } = body as {
      label?: string
      assetType?: string
      target?: string
      checkIntervalS?: number
    }

    // Validate required fields
    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Label is required' } },
        { status: 400 }
      )
    }
    if (label.trim().length > 128) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Label exceeds 128 characters' } },
        { status: 400 }
      )
    }
    if (!assetType || !ASSET_TYPES.includes(assetType as typeof ASSET_TYPES[number])) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: `Asset type must be one of: ${ASSET_TYPES.join(', ')}` } },
        { status: 400 }
      )
    }
    if (!target || typeof target !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Target is required' } },
        { status: 400 }
      )
    }

    const targetError = validateTarget(assetType, target)
    if (targetError) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: targetError } },
        { status: 400 }
      )
    }

    // Check tier limit
    const { data: profile } = await client
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()

    const tier = profile?.tier || 'free'
    const maxAssets = MAX_ASSETS_PER_USER[tier] || 5

    const { count: existingCount } = await client
      .from('monitored_assets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((existingCount || 0) >= maxAssets) {
      return NextResponse.json(
        { error: { code: 'LIMIT_REACHED', message: `Asset limit reached (${maxAssets} for ${tier} tier). Upgrade to add more.` } },
        { status: 403 }
      )
    }

    // Validate check interval
    const interval = checkIntervalS && checkIntervalS >= 300 ? Math.min(checkIntervalS, 86400) : 3600

    // Insert
    const { data, error } = await client
      .from('monitored_assets')
      .insert({
        user_id: user.id,
        label: label.trim(),
        asset_type: assetType,
        target: target.trim(),
        status: 'pending',
        check_interval_s: interval,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: { code: 'DUPLICATE_ASSET', message: 'This target is already being monitored' } },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: { code: 'INSERT_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: 'success', data }, { status: 201 })
  } catch (err) {
    console.error('POST /monitoring/assets error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create asset' } },
      { status: 500 }
    )
  }
}
