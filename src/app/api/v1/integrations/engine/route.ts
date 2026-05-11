/**
 * QGuard Integration Engine API
 *
 * GET  /api/v1/integrations/engine — List all connectors with user's connection status
 * POST /api/v1/integrations/engine — Connect, disconnect, or test an integration
 *
 * Security:
 *   - JWT authentication via Bearer token
 *   - Credentials encrypted with AES-256-GCM before storage
 *   - Tier-based rate limiting on connections
 *   - Audit logging for all operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import {
  listUserIntegrations,
  connectIntegration,
  disconnectIntegration,
  checkTierLimit,
} from '@/lib/integrations/integration-engine'
import { getConnector } from '@/lib/integrations/connector-registry'
import {
  buildAuthorizationUrl,
  getCallbackUrl,
  isOAuthConfigured,
  getOAuthConfig,
} from '@/lib/integrations/oauth-config'
import type { SubscriptionTier } from '@/types/api.types'

// In-memory CSRF state tokens for OAuth flow (maps stateToken → { userId, connectorId, createdAt })
// Use globalThis to survive Next.js dev server hot reloads
type OAuthStateData = { userId: string; connectorId: string; createdAt: number }
const globalKey = '__qguard_oauth_state_tokens__' as const

function getOAuthStateTokens(): Map<string, OAuthStateData> {
  const g = globalThis as Record<string, unknown>
  if (!g[globalKey]) {
    g[globalKey] = new Map<string, OAuthStateData>()
  }
  return g[globalKey] as Map<string, OAuthStateData>
}

const oauthStateTokens = getOAuthStateTokens()

// Clean up expired tokens (older than 15 min)
function cleanExpiredTokens() {
  const now = Date.now()
  for (const [key, val] of oauthStateTokens) {
    if (now - val.createdAt > 15 * 60 * 1000) {
      oauthStateTokens.delete(key)
    }
  }
}

/** Exported so the callback route can validate state tokens */
export { oauthStateTokens }

async function resolveAuth(request: NextRequest) {
  const token = getToken(request)
  const user = await getServerUser(request)
  if (!user || !token) return { userId: null, authClient: null, tier: 'free' as SubscriptionTier }

  const authClient = createAuthClient(token)
  if (!authClient) return { userId: null, authClient: null, tier: 'free' as SubscriptionTier }

  // Get tier from profile — network call, fall back to 'free' on any error
  let tier: SubscriptionTier = 'free'
  try {
    const { data: profile } = await authClient
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single()
    tier = (profile?.tier as SubscriptionTier) || 'free'
  } catch {
    // Network error or paused Supabase project — default to free tier
  }

  return { userId: user.id, authClient, tier }
}

// ─── GET: List all connectors + user status ──────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { userId, authClient, tier } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const result = await listUserIntegrations(userId, tier, authClient)

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('Integration engine GET error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list integrations' } },
      { status: 500 }
    )
  }
}

// ─── POST: Connect / Disconnect / Test ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { userId, authClient, tier } = await resolveAuth(request)
    if (!userId || !authClient) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, connectorId, config, credentialValue } = body

    if (!action || !connectorId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'action and connectorId are required' } },
        { status: 400 }
      )
    }

    // Validate connector exists
    const connector = getConnector(connectorId)
    if (!connector) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: `Unknown connector: ${connectorId}` } },
        { status: 404 }
      )
    }

    switch (action) {
      case 'connect': {
        // ── OAuth Connectors: redirect to provider consent screen ──
        if (connector.authType === 'oauth') {
          cleanExpiredTokens()

          // Check if OAuth credentials are configured in env
          const oauthConfig = getOAuthConfig(connectorId)
          if (!oauthConfig || !isOAuthConfigured(connectorId)) {
            return NextResponse.json({
              error: {
                code: 'OAUTH_NOT_CONFIGURED',
                message: `OAuth not configured for ${connector.name}. Required env vars: ${oauthConfig?.clientIdEnvKey || 'unknown'}, ${oauthConfig?.clientSecretEnvKey || 'unknown'}`,
              },
            }, { status: 422 })
          }

          // Check tier limits before starting OAuth flow
          const tierInfo = await checkTierLimit(userId, tier, authClient)
          if (!tierInfo.allowed) {
            return NextResponse.json({
              error: {
                code: 'TIER_LIMIT',
                message: `Integration limit reached (${tierInfo.current}/${tierInfo.max}). Upgrade your plan.`,
              },
            }, { status: 422 })
          }

          // Generate CSRF state token
          const stateToken = crypto.randomUUID()
          oauthStateTokens.set(stateToken, { userId, connectorId, createdAt: Date.now() })

          const origin = request.nextUrl.origin
          const callbackUrl = getCallbackUrl(origin)
          const authorizationUrl = buildAuthorizationUrl(connectorId, callbackUrl, stateToken)

          if (!authorizationUrl) {
            return NextResponse.json({
              error: { code: 'OAUTH_ERROR', message: 'Failed to build authorization URL' },
            }, { status: 500 })
          }

          return NextResponse.json({
            data: {
              oauthRedirect: true,
              authorizationUrl,
              connectorId,
            },
          })
        }

        // ── API Key / Webhook Connectors: store credentials directly ──
        if (!config || !credentialValue) {
          return NextResponse.json(
            { error: { code: 'BAD_REQUEST', message: 'config and credentialValue are required for connect' } },
            { status: 400 }
          )
        }

        const result = await connectIntegration(
          userId,
          connectorId,
          config,
          credentialValue,
          tier,
          authClient
        )

        if (!result.success) {
          return NextResponse.json(
            { error: { code: 'CONNECT_FAILED', message: result.error } },
            { status: 422 }
          )
        }

        return NextResponse.json({ data: { connection: result.connection } })
      }

      case 'disconnect': {
        const result = await disconnectIntegration(userId, connectorId, authClient)

        if (!result.success) {
          return NextResponse.json(
            { error: { code: 'DISCONNECT_FAILED', message: result.error } },
            { status: 422 }
          )
        }

        return NextResponse.json({ data: { disconnected: true } })
      }

      case 'test': {
        // Placeholder: validate credentials can be used
        // In production, each connector would have a test function
        const tierInfo = await checkTierLimit(userId, tier, authClient)
        return NextResponse.json({
          data: {
            connector: connector.name,
            testResult: 'ok',
            message: `${connector.name} connector is available`,
            tierInfo,
          },
        })
      }

      default:
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: `Unknown action: ${action}` } },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error('Integration engine POST error:', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Integration operation failed' } },
      { status: 500 }
    )
  }
}
