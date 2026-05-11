import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { PAYPAL_CONFIGURED, createSubscription } from '@/lib/paypal/paypal'

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

    const body = await request.json().catch(() => ({}))
    const returnUrl =
      typeof body.returnUrl === 'string' && body.returnUrl.length > 0
        ? body.returnUrl
        : (process.env.NEXT_PUBLIC_APP_URL || '') + '/dashboard'

    // Strict plan/interval validation — no injection surface.
    const plan = body.plan
    const interval = body.interval
    if (plan !== 'pro' && plan !== 'elite') {
      return NextResponse.json(
        { error: { code: 'INVALID_PLAN', message: 'Plan must be "pro" or "elite"' } },
        { status: 400 }
      )
    }
    if (interval !== 'monthly' && interval !== 'annual') {
      return NextResponse.json(
        { error: { code: 'INVALID_INTERVAL', message: 'Interval must be "monthly" or "annual"' } },
        { status: 400 }
      )
    }

    const result = await createSubscription({
      userId: user.id,
      userEmail: user.email || '',
      returnUrl,
      plan,
      interval,
    })

    if (!result) {
      return NextResponse.json(
        {
          error: {
            code: 'PAYPAL_ERROR',
            message:
              'PayPal plan not configured. Set PAYPAL_*_PLAN_ID environment variables.',
          },
        },
        { status: 500 }
      )
    }

    // Record the pending subscription ID so the webhook can reconcile even if
    // the user never returns to the app (defense against relying on redirect).
    await client
      .from('profiles')
      .update({ paypal_subscription_id: result.id })
      .eq('id', user.id)

    return NextResponse.json({ data: { url: result.approveUrl, subscriptionId: result.id } })
  } catch (err) {
    console.error('PayPal checkout error:', err)
    return NextResponse.json(
      { error: { code: 'CHECKOUT_ERROR', message: 'Failed to create checkout session' } },
      { status: 500 }
    )
  }
}
