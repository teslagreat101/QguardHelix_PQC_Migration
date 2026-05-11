/**
 * QGuard OAuth Callback Handler
 *
 * GET /api/v1/integrations/callback
 *
 * Handles the OAuth redirect from external providers after user authorization.
 *
 * Flow:
 *   1. Provider redirects here with ?code=...&state=...
 *   2. Validates the CSRF state token (from engine's in-memory store)
 *   3. Exchanges the authorization code for access + refresh tokens
 *   4. Fetches user info (email/username) for the account label
 *   5. Stores the connection in tenant_connectors (UIE) + encrypts tokens
 *   6. Redirects to /dashboard/integrations?connected={connectorId}
 *
 * Security:
 *   - Validates state parameter to prevent CSRF attacks
 *   - State tokens are one-time use
 *   - Never logs or exposes access tokens
 *   - All tokens encrypted with AES-256-GCM before storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { oauthStateTokens } from '../engine/route'
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  getCallbackUrl,
} from '@/lib/integrations/oauth-config'
import { encryptToken } from '@/lib/integrations/token-encryption'
import { storeMemoryConnection } from '@/lib/integrations/integration-engine'
import { getServiceClient } from '@/lib/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const origin = request.nextUrl.origin

  const redirectBase = '/dashboard/integrations'

  // Handle OAuth errors from the provider
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Authorization was denied by the provider'
    console.error(`OAuth error: ${error} — ${errorDescription}`)
    return NextResponse.redirect(
      new URL(`${redirectBase}?auth_error=${encodeURIComponent(errorDescription)}`, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`${redirectBase}?auth_error=Missing%20authorization%20code`, request.url)
    )
  }

  if (!state) {
    return NextResponse.redirect(
      new URL(`${redirectBase}?auth_error=Missing%20state%20parameter%20(possible%20CSRF)`, request.url)
    )
  }

  // ── Validate state token ──────────────────────────────────────────────────

  const stateData = oauthStateTokens.get(state)
  if (!stateData) {
    return NextResponse.redirect(
      new URL(`${redirectBase}?auth_error=Invalid%20or%20expired%20state%20token`, request.url)
    )
  }

  // One-time use: delete immediately
  oauthStateTokens.delete(state)

  // Check expiry (15 min)
  if (Date.now() - stateData.createdAt > 15 * 60 * 1000) {
    return NextResponse.redirect(
      new URL(`${redirectBase}?auth_error=State%20token%20expired`, request.url)
    )
  }

  const { userId, connectorId } = stateData

  // ── Exchange code for tokens ──────────────────────────────────────────────

  const callbackUrl = getCallbackUrl(origin)

  try {
    const tokens = await exchangeCodeForTokens(connectorId, code, callbackUrl)
    if (!tokens) {
      return NextResponse.redirect(
        new URL(`${redirectBase}?auth_error=Token%20exchange%20failed%20for%20${encodeURIComponent(connectorId)}`, request.url)
      )
    }

    // Fetch account label (email, username, etc.)
    const accountLabel = await fetchUserInfo(connectorId, tokens.accessToken) || connectorId

    // ── Store connection in tenant_connectors (UIE) ─────────────────────────

    const now = new Date().toISOString()
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null

    // Encrypt the tokens for storage
    const tokenPayload = JSON.stringify({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_type: tokens.tokenType,
      expires_at: expiresAt,
    })
    const encryptedValue = await encryptToken(tokenPayload)

    // Use service role client to bypass RLS (no user JWT in OAuth callback)
    const serviceClient = getServiceClient()
    let supabaseStored = false

    if (serviceClient) {
      try {
        // Upsert tenant_connectors
        const { data: connection, error: connError } = await serviceClient
          .from('tenant_connectors')
          .upsert(
            {
              user_id: userId,
              connector_id: connectorId,
              status: 'active',
              config: { auth_type: 'oauth' },
              account_label: accountLabel,
              connected_at: now,
              last_heartbeat_at: now,
              error_message: null,
              updated_at: now,
            },
            { onConflict: 'user_id,connector_id' }
          )
          .select()
          .single()

        if (connError) {
          console.error('Supabase tenant_connectors upsert failed:', connError)
        } else if (connection) {
          supabaseStored = true

          // Upsert integration_credentials
          await serviceClient
            .from('integration_credentials')
            .upsert(
              {
                tenant_connector_id: connection.id,
                user_id: userId,
                credential_type: 'oauth_tokens',
                encrypted_value: encryptedValue,
                expires_at: expiresAt,
                updated_at: now,
              },
              { onConflict: 'tenant_connector_id' }
            )

          // Audit log
          await serviceClient.from('integration_logs').insert({
            user_id: userId,
            tenant_connector_id: connection.id,
            connector_id: connectorId,
            action: 'oauth_connect',
            status: 'success',
            details: { account_label: accountLabel, has_refresh_token: !!tokens.refreshToken },
          })
        }
      } catch (dbErr) {
        console.error('Supabase storage error (falling back to legacy):', dbErr)
      }
    }

    // Always store in engine's in-memory map (ensures UI reflects connection immediately)
    storeMemoryConnection(userId, connectorId, {
      id: crypto.randomUUID(),
      user_id: userId,
      connector_id: connectorId,
      status: 'active',
      config: { auth_type: 'oauth' },
      account_label: accountLabel,
      connected_at: now,
      last_heartbeat_at: now,
      error_message: null,
      created_at: now,
      updated_at: now,
    })

    // Also store in the legacy integration service for backward compatibility
    try {
      const { storeConnection } = await import('@/lib/integrations/integration-service')
      await storeConnection(userId, {
        providerId: connectorId,
        status: 'connected',
        connectedAt: now,
        expiresAt: expiresAt || '',
        accountLabel,
        encryptedTokens: encryptedValue,
      })
    } catch {
      // Non-critical — UIE storage is the primary
    }

    // ── Redirect to integrations page with success ──────────────────────────

    const successUrl = new URL(redirectBase, request.url)
    successUrl.searchParams.set('connected', connectorId)
    successUrl.searchParams.set('account', accountLabel)

    return NextResponse.redirect(successUrl)
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(
      new URL(`${redirectBase}?auth_error=Internal%20server%20error`, request.url)
    )
  }
}
