import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { TIER_LIMITS } from '@/lib/paypal/paypal'
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

    let { data: profile } = await client
      .from('profiles')
      .select('tier, paypal_payer_id, paypal_subscription_id, keys_generated_today, max_keys_per_day, vault_storage_used, max_vault_storage')
      .eq('id', user.id)
      .single()

    // Auto-create profile if missing
    if (!profile) {
      const { data: created } = await client
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          tier: 'free',
          q_score: 0,
          badges: [],
          keys_generated_today: 0,
          max_keys_per_day: 10,
          vault_storage_used: 0,
          max_vault_storage: 104857600,
        })
        .select('tier, paypal_payer_id, paypal_subscription_id, keys_generated_today, max_keys_per_day, vault_storage_used, max_vault_storage')
        .single()

      profile = created
    }

    if (!profile) {
      return NextResponse.json(
        { error: { code: 'PROFILE_ERROR', message: 'Could not load or create profile' } },
        { status: 500 }
      )
    }

    // Count scans from the last 24 hours (both quantum scanner and web scanner)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ count: quantumScansUsed }, { count: webScansUsed }] = await Promise.all([
      client
        .from('scan_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo),
      client
        .from('web_scan_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneDayAgo),
    ])
    const scansUsed = (quantumScansUsed || 0) + (webScansUsed || 0)

    const tier = (profile.tier || 'free') as keyof typeof TIER_LIMITS
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free

    return NextResponse.json({
      data: {
        tier,
        status: profile.paypal_subscription_id ? 'active' : 'none',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        usage: {
          keysGenerated: profile.keys_generated_today || 0,
          keysLimit: profile.max_keys_per_day || limits.maxKeysPerDay,
          vaultStorageUsed: profile.vault_storage_used || 0,
          vaultStorageLimit: profile.max_vault_storage || limits.maxVaultStorage,
          scansUsed: scansUsed || 0,
          scansLimit: limits.maxScansPerDay,
        },
      },
    })
  } catch (err) {
    console.error('Billing error:', err)
    return NextResponse.json(
      { error: { code: 'BILLING_ERROR', message: 'Failed to fetch billing information' } },
      { status: 500 }
    )
  }
}
