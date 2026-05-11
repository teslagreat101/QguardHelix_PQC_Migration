import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  const { serviceClient } = auth

  try {
    // Fetch all profiles
    const { data: profiles, error: profilesErr } = await serviceClient
      .from('profiles')
      .select('id, email, tier, q_score, created_at, paypal_subscription_id, vault_storage_used, max_vault_storage, keys_generated_today')

    if (profilesErr) throw profilesErr

    const users = profiles || []
    const totalUsers = users.length
    const premiumUsers = users.filter((u) => u.tier === 'premium').length
    const freeUsers = totalUsers - premiumUsers

    // Time-based user stats
    const now = new Date()
    const last24h = new Date(now.getTime() - 86400000).toISOString()
    const last7d = new Date(now.getTime() - 7 * 86400000).toISOString()
    const last30d = new Date(now.getTime() - 30 * 86400000).toISOString()

    const newUsersToday = users.filter((u) => u.created_at > last24h).length
    const newUsersWeek = users.filter((u) => u.created_at > last7d).length
    const newUsersMonth = users.filter((u) => u.created_at > last30d).length

    // Average Q-Score
    const avgQScore = totalUsers > 0
      ? Math.round(users.reduce((sum, u) => sum + (u.q_score || 0), 0) / totalUsers)
      : 0

    // Storage usage
    const totalStorageUsed = users.reduce((sum, u) => sum + (u.vault_storage_used || 0), 0)
    const totalStorageMax = users.reduce((sum, u) => sum + (u.max_vault_storage || 0), 0)

    // Scan stats
    const { count: totalScans } = await serviceClient
      .from('scan_sessions')
      .select('*', { count: 'exact', head: true })

    const { count: completedScans } = await serviceClient
      .from('scan_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    const { count: totalScanResults } = await serviceClient
      .from('scan_results')
      .select('*', { count: 'exact', head: true })

    const { count: criticalFindings } = await serviceClient
      .from('scan_results')
      .select('*', { count: 'exact', head: true })
      .eq('threat_level', 'critical')

    // Vault stats
    const { count: totalVaultFiles } = await serviceClient
      .from('vault_files')
      .select('*', { count: 'exact', head: true })

    const { count: totalVaultKeys } = await serviceClient
      .from('vault_keys')
      .select('*', { count: 'exact', head: true })

    // Key generation stats
    const { count: totalKeysGenerated } = await serviceClient
      .from('generated_keys')
      .select('*', { count: 'exact', head: true })

    // Migration stats
    const { count: totalMigrations } = await serviceClient
      .from('migration_logs')
      .select('*', { count: 'exact', head: true })

    const { count: completedMigrations } = await serviceClient
      .from('migration_logs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')

    // Web scanner stats
    const { count: totalWebScans } = await serviceClient
      .from('web_scan_sessions')
      .select('*', { count: 'exact', head: true })

    // Alerts
    const { count: totalAlerts } = await serviceClient
      .from('monitoring_alerts')
      .select('*', { count: 'exact', head: true })

    const { count: unreadAlerts } = await serviceClient
      .from('monitoring_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)

    // Recent signups (last 10)
    const { data: recentSignups } = await serviceClient
      .from('profiles')
      .select('id, email, tier, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      status: 'success',
      data: {
        users: {
          total: totalUsers,
          premium: premiumUsers,
          free: freeUsers,
          newToday: newUsersToday,
          newThisWeek: newUsersWeek,
          newThisMonth: newUsersMonth,
          avgQScore,
          recentSignups: recentSignups || [],
        },
        platform: {
          totalScans: totalScans || 0,
          completedScans: completedScans || 0,
          totalFindings: totalScanResults || 0,
          criticalFindings: criticalFindings || 0,
          totalVaultFiles: totalVaultFiles || 0,
          totalVaultKeys: totalVaultKeys || 0,
          totalKeysGenerated: totalKeysGenerated || 0,
          totalMigrations: totalMigrations || 0,
          completedMigrations: completedMigrations || 0,
          totalWebScans: totalWebScans || 0,
          totalAlerts: totalAlerts || 0,
          unreadAlerts: unreadAlerts || 0,
        },
        storage: {
          totalUsed: totalStorageUsed,
          totalCapacity: totalStorageMax,
          utilizationPercent: totalStorageMax > 0
            ? Math.round((totalStorageUsed / totalStorageMax) * 100)
            : 0,
        },
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch admin stats' },
      { status: 500 }
    )
  }
}
