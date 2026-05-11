import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
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

    let { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Auto-create profile if it doesn't exist (PGRST116 = no rows)
    if (!profile && profileError?.code === 'PGRST116') {
      const { data: created, error: createError } = await client
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          tier: 'free',
          q_score: 0,
          badges: [],
          keys_generated_today: 0,
          max_keys_per_day: 10,
          vault_storage_used: 0,
          max_vault_storage: 104857600,
        })
        .select('*')
        .single()

      if (createError || !created) {
        console.error('Profile auto-create error:', createError)
        return NextResponse.json(
          { error: { code: 'CREATE_ERROR', message: 'Failed to create profile' } },
          { status: 500 }
        )
      }
      profile = created
      profileError = null
    } else if (profileError) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json(
        { error: { code: 'DB_ERROR', message: 'Failed to fetch profile' } },
        { status: 500 }
      )
    }

    // Check if 2FA is enabled via Supabase Auth MFA factors
    let twoFactorEnabled = false
    try {
      const { data: factors } = await client.auth.mfa.listFactors()
      twoFactorEnabled = factors?.totp?.some(f => f.status === 'verified') || false
    } catch {
      // MFA API may not be available — default to false
    }

    return NextResponse.json({
      data: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatar_url || null,
        tier: profile.tier,
        qScore: profile.q_score,
        badges: profile.badges,
        keysGeneratedToday: profile.keys_generated_today,
        maxKeysPerDay: profile.max_keys_per_day,
        vaultStorageUsed: profile.vault_storage_used,
        maxVaultStorage: profile.max_vault_storage,
        paypalPayerId: profile.paypal_payer_id || null,
        twoFactorEnabled,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
    })
  } catch (err) {
    console.error('Profile error:', err)
    return NextResponse.json(
      { error: { code: 'PROFILE_ERROR', message: 'Failed to fetch profile' } },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    const allowedFields: Record<string, string> = { name: 'name' }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const [key, col] of Object.entries(allowedFields)) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'string' || body[key].length > 200) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: `Invalid value for ${key}` } },
            { status: 400 }
          )
        }
        updates[col] = body[key].trim()
      }
    }

    const { data: profile, error } = await client
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('*')
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: 'Failed to update profile' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        tier: profile.tier,
        updatedAt: profile.updated_at,
      },
    })
  } catch (err) {
    console.error('Profile update error:', err)
    return NextResponse.json(
      { error: { code: 'UPDATE_ERROR', message: 'Failed to update profile' } },
      { status: 500 }
    )
  }
}
