import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  const { serviceClient } = auth
  const { id } = await params

  try {
    // Fetch profile
    const { data: profile, error } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { status: 'error', message: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch auth metadata
    let authMeta = null
    try {
      const { data } = await serviceClient.auth.admin.getUserById(id)
      authMeta = {
        last_sign_in_at: data?.user?.last_sign_in_at,
        email_confirmed_at: data?.user?.email_confirmed_at,
        created_at: data?.user?.created_at,
        provider: data?.user?.app_metadata?.provider || 'email',
        mfa_enabled: (data?.user?.factors || []).length > 0,
      }
    } catch { /* ignore */ }

    // Fetch user activity counts
    const [scans, results, keys, vaultFiles, migrations, alerts] = await Promise.all([
      serviceClient.from('scan_sessions').select('*', { count: 'exact', head: true }).eq('user_id', id),
      serviceClient.from('scan_results').select('*', { count: 'exact', head: true }).eq('user_id', id),
      serviceClient.from('generated_keys').select('*', { count: 'exact', head: true }).eq('user_id', id),
      serviceClient.from('vault_files').select('*', { count: 'exact', head: true }).eq('user_id', id),
      serviceClient.from('migration_logs').select('*', { count: 'exact', head: true }).eq('user_id', id),
      serviceClient.from('monitoring_alerts').select('*', { count: 'exact', head: true }).eq('user_id', id),
    ])

    return NextResponse.json({
      status: 'success',
      data: {
        profile,
        auth: authMeta,
        activity: {
          scans: scans.count || 0,
          findings: results.count || 0,
          keysGenerated: keys.count || 0,
          vaultFiles: vaultFiles.count || 0,
          migrations: migrations.count || 0,
          alerts: alerts.count || 0,
        },
      },
    })
  } catch (error) {
    console.error('Admin get user error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  const { serviceClient } = auth
  const { id } = await params

  try {
    const body = await request.json()
    const { name, tier, max_keys_per_day, max_vault_storage } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (tier !== undefined) {
      updates.tier = tier
      if (tier === 'premium') {
        updates.max_keys_per_day = max_keys_per_day ?? 999
        updates.max_vault_storage = max_vault_storage ?? 1073741824
      } else if (tier === 'free') {
        updates.max_keys_per_day = max_keys_per_day ?? 5
        updates.max_vault_storage = max_vault_storage ?? 5368709120
      }
    }
    if (max_keys_per_day !== undefined) updates.max_keys_per_day = max_keys_per_day
    if (max_vault_storage !== undefined) updates.max_vault_storage = max_vault_storage

    const { data, error } = await serviceClient
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      status: 'success',
      data: { profile: data },
      message: 'User updated successfully',
    })
  } catch (error) {
    console.error('Admin update user error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  const { serviceClient } = auth
  const { id } = await params

  try {
    // Delete user data from all tables (cascade from auth will handle profiles via trigger)
    await Promise.all([
      serviceClient.from('scan_results').delete().eq('user_id', id),
      serviceClient.from('scan_sessions').delete().eq('user_id', id),
      serviceClient.from('generated_keys').delete().eq('user_id', id),
      serviceClient.from('vault_access_logs').delete().eq('user_id', id),
      serviceClient.from('vault_audit_events').delete().eq('user_id', id),
      serviceClient.from('vault_files').delete().eq('user_id', id),
      serviceClient.from('vault_keys').delete().eq('user_id', id),
      serviceClient.from('migration_logs').delete().eq('user_id', id),
      serviceClient.from('monitoring_alerts').delete().eq('user_id', id),
    ])

    // Delete profile
    await serviceClient.from('profiles').delete().eq('id', id)

    // Delete auth user
    const { error } = await serviceClient.auth.admin.deleteUser(id)
    if (error) throw error

    return NextResponse.json({
      status: 'success',
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('Admin delete user error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
