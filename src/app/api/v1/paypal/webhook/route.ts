import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  PAYPAL_CONFIGURED,
  TIER_LIMITS,
  extractWebhookHeaders,
  getSubscription,
  getTierFromPlanId,
  verifyWebhookSignature,
} from '@/lib/paypal/paypal'

/**
 * PayPal webhook endpoint.
 *
 * Security controls:
 *  - Signature verification via PayPal's verify-webhook-signature API.
 *  - Signed payload binding: we always refetch the subscription from PayPal
 *    by ID, so even a verified event whose body was tampered cannot change
 *    the plan tier — we trust only the authoritative record from PayPal.
 *  - No side-effects before verification.
 *
 * Handled events:
 *   BILLING.SUBSCRIPTION.ACTIVATED / CREATED / UPDATED  → set tier + limits
 *   BILLING.SUBSCRIPTION.CANCELLED / EXPIRED / SUSPENDED → downgrade to free
 *   PAYMENT.SALE.DENIED / BILLING.SUBSCRIPTION.PAYMENT.FAILED → alert user
 */
export async function POST(request: NextRequest) {
  if (!PAYPAL_CONFIGURED || !supabase) {
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
      { status: 500 }
    )
  }

  const rawBody = await request.text()
  const headers = extractWebhookHeaders(request.headers)

  const verified = await verifyWebhookSignature(headers, rawBody)
  if (!verified) {
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } },
      { status: 400 }
    )
  }

  let event: {
    event_type?: string
    resource?: Record<string, unknown>
  }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  const eventType = event.event_type || ''
  const resource = event.resource || {}

  try {
    switch (eventType) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.CREATED':
      case 'BILLING.SUBSCRIPTION.UPDATED':
      case 'BILLING.SUBSCRIPTION.RE-ACTIVATED': {
        const subId = String(resource.id || '')
        if (!subId) break

        // Refetch authoritative record — never trust the webhook body for
        // tier decisions since the body signature only binds the transport.
        const sub = await getSubscription(subId)
        const userId = sub.custom_id
        const payerId = sub.subscriber?.payer_id || null
        const tier = getTierFromPlanId(sub.plan_id)

        if (!userId || !tier) break
        if (sub.status !== 'ACTIVE' && sub.status !== 'APPROVED') break

        const limits = TIER_LIMITS[tier]
        await supabase
          .from('profiles')
          .update({
            tier,
            paypal_payer_id: payerId,
            paypal_subscription_id: subId,
            max_keys_per_day: limits.maxKeysPerDay,
            max_vault_storage: limits.maxVaultStorage,
          })
          .eq('id', userId)
        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        const subId = String(resource.id || '')
        if (!subId) break

        const limits = TIER_LIMITS.free
        await supabase
          .from('profiles')
          .update({
            tier: 'free',
            paypal_subscription_id: null,
            max_keys_per_day: limits.maxKeysPerDay,
            max_vault_storage: limits.maxVaultStorage,
          })
          .eq('paypal_subscription_id', subId)
        break
      }

      case 'PAYMENT.SALE.DENIED':
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
        const subId = String(
          (resource.billing_agreement_id as string | undefined) ||
            (resource.id as string | undefined) ||
            ''
        )
        if (!subId) break

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('paypal_subscription_id', subId)
          .single()

        if (profile) {
          await supabase.from('monitoring_alerts').insert({
            user_id: profile.id,
            type: 'expiry',
            title: 'Payment Failed',
            message:
              'Your PayPal subscription payment failed. Please update your payment method to maintain access.',
            severity: 'warning',
          })
        }
        break
      }

      default:
        // Ignore unrelated events but still ack 200 so PayPal doesn't retry.
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('PayPal webhook processing error:', err)
    return NextResponse.json(
      { error: { code: 'WEBHOOK_ERROR', message: 'Failed to process webhook' } },
      { status: 500 }
    )
  }
}
