import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { PAYPAL_CONFIGURED, cancelSubscription } from '@/lib/paypal/paypal'

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

    if (!PAYPAL_CONFIGURED) {
      return NextResponse.json(
        { error: { code: 'PAYPAL_NOT_CONFIGURED', message: 'PayPal is not configured' } },
        { status: 500 }
      )
    }

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    const { data: profile } = await client
      .from('profiles')
      .select('paypal_subscription_id')
      .eq('id', user.id)
      .single()

    const subId = profile?.paypal_subscription_id
    if (!subId) {
      return NextResponse.json(
        { error: { code: 'NO_SUBSCRIPTION', message: 'No active subscription found' } },
        { status: 400 }
      )
    }

    try {
      await cancelSubscription(subId)
    } catch (err) {
      console.warn('PayPal cancel failed (may already be cancelled):', err)
    }

    // Webhook will also process BILLING.SUBSCRIPTION.CANCELLED, but we update
    // optimistically so the UI reflects the change immediately.
    await client
      .from('profiles')
      .update({
        tier: 'free',
        paypal_subscription_id: null,
        max_keys_per_day: 5,
        max_vault_storage: 5368709120,
      })
      .eq('id', user.id)

    return NextResponse.json({ data: { cancelled: true } })
  } catch (err) {
    console.error('PayPal cancel error:', err)
    return NextResponse.json(
      { error: { code: 'CANCEL_ERROR', message: 'Failed to cancel subscription' } },
      { status: 500 }
    )
  }
}
