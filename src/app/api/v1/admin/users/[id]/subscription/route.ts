import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { PAYPAL_CONFIGURED, cancelSubscription } from '@/lib/paypal/paypal'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  const { serviceClient } = auth
  const { id } = await params

  try {
    const body = await request.json()
    const { action } = body // 'upgrade' | 'downgrade' | 'cancel'

    // Fetch current profile
    const { data: profile, error: profileErr } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json(
        { status: 'error', message: 'User not found' },
        { status: 404 }
      )
    }

    switch (action) {
      case 'upgrade': {
        const { error } = await serviceClient
          .from('profiles')
          .update({
            tier: 'premium',
            max_keys_per_day: 999,
            max_vault_storage: 1073741824,
          })
          .eq('id', id)

        if (error) throw error

        // Create monitoring alert for the user
        await serviceClient.from('monitoring_alerts').insert({
          user_id: id,
          type: 'migration',
          title: 'Account Upgraded',
          message: 'Your account has been upgraded to Premium by an administrator.',
          severity: 'info',
        })

        return NextResponse.json({
          status: 'success',
          message: 'User upgraded to premium',
        })
      }

      case 'downgrade': {
        const { error } = await serviceClient
          .from('profiles')
          .update({
            tier: 'free',
            max_keys_per_day: 5,
            max_vault_storage: 5368709120,
          })
          .eq('id', id)

        if (error) throw error

        await serviceClient.from('monitoring_alerts').insert({
          user_id: id,
          type: 'migration',
          title: 'Account Downgraded',
          message: 'Your account has been changed to the Free tier by an administrator.',
          severity: 'warning',
        })

        return NextResponse.json({
          status: 'success',
          message: 'User downgraded to free',
        })
      }

      case 'cancel': {
        // Cancel PayPal subscription if exists
        if (PAYPAL_CONFIGURED && profile.paypal_subscription_id) {
          try {
            await cancelSubscription(profile.paypal_subscription_id, 'Admin-initiated cancellation')
          } catch (paypalErr) {
            console.warn('PayPal cancellation failed (may already be cancelled):', paypalErr)
          }
        }

        const { error } = await serviceClient
          .from('profiles')
          .update({
            tier: 'free',
            max_keys_per_day: 5,
            max_vault_storage: 5368709120,
            paypal_subscription_id: null,
          })
          .eq('id', id)

        if (error) throw error

        await serviceClient.from('monitoring_alerts').insert({
          user_id: id,
          type: 'migration',
          title: 'Subscription Canceled',
          message: 'Your subscription has been canceled by an administrator.',
          severity: 'warning',
        })

        return NextResponse.json({
          status: 'success',
          message: 'Subscription canceled',
        })
      }

      default:
        return NextResponse.json(
          { status: 'error', message: 'Invalid action. Use: upgrade, downgrade, cancel' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Admin subscription error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to manage subscription' },
      { status: 500 }
    )
  }
}
