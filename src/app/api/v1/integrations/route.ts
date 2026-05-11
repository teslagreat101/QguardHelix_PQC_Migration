/**
 * QGuard Integrations API
 *
 * GET  /api/v1/integrations — List all integrations and their connection status
 * POST /api/v1/integrations — Connect, disconnect, or refresh a provider
 *
 * Connect flow:
 *   1. POST { action: 'connect', providerId } → returns { authorizationUrl } for OAuth redirect
 *   2. User completes OAuth consent at provider
 *   3. Provider redirects to /api/v1/integrations/callback with code + state
 *   4. Callback exchanges code for tokens, stores encrypted, redirects to scanner
 *
 * Security:
 *   - All connections use read-only OAuth scopes
 *   - CSRF protection via cryptographic state tokens
 *   - Tokens stored encrypted (AES-256-GCM)
 *   - Audit logging for all auth events
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  connectProvider,
  disconnectProvider,
  refreshTokenIfExpired,
  listConnections,
  isOAuthConfigured,
  getOAuthConfig,
} from '@/lib/integrations'
import { INTEGRATION_PROVIDERS } from '@/lib/scanner/connection-manager'
import { getServerUser } from '@/lib/server-auth'

/**
 * Resolve the current user ID from JWT auth or fallback.
 */
async function resolveUserId(request: NextRequest): Promise<string> {
  const user = await getServerUser(request)
  return user?.id ?? 'default-user'
}

/**
 * GET /api/v1/integrations
 * Returns current connection status for all providers.
 * Merges stored connections with the full provider list.
 */
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request)
  const storedConnections = await listConnections(userId)

  // Build a map of stored connection states
  const connectionMap = new Map(storedConnections.map((c) => [c.providerId, c]))

  // Merge with full provider list
  const result = INTEGRATION_PROVIDERS.map((provider) => {
    const stored = connectionMap.get(provider.id)
    return {
      providerId: provider.id,
      name: provider.name,
      category: provider.category,
      status: stored?.status || 'disconnected',
      connectedAt: stored?.connectedAt || null,
      expiresAt: stored?.expiresAt || null,
      accountLabel: stored?.accountLabel || null,
      oauthConfigured: isOAuthConfigured(provider.id),
    }
  })

  const connected = result.filter((c) => c.status === 'connected').length
  const expired = result.filter((c) => c.status === 'expired').length

  return NextResponse.json({
    success: true,
    data: {
      connections: result,
      stats: {
        connected,
        total: result.length,
        expired,
        oauthConfiguredCount: result.filter((c) => c.oauthConfigured).length,
      },
    },
  })
}

/**
 * POST /api/v1/integrations
 *
 * Actions:
 *   - connect:    Returns OAuth authorization URL to redirect user to
 *   - disconnect: Removes stored tokens and marks as disconnected
 *   - refresh:    Refreshes expired access tokens using stored refresh token
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action, providerId } = body

  if (!action || !providerId) {
    return NextResponse.json(
      { success: false, error: 'Missing action or providerId' },
      { status: 400 },
    )
  }

  if (!['connect', 'disconnect', 'refresh'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'Invalid action. Must be connect, disconnect, or refresh' },
      { status: 400 },
    )
  }

  const userId = await resolveUserId(request)
  const origin = request.nextUrl.origin

  switch (action) {
    case 'connect': {
      // Check if OAuth is configured for this provider
      if (!isOAuthConfigured(providerId)) {
        return NextResponse.json({
          success: false,
          error: 'oauth_not_configured',
          message: `OAuth credentials not configured for ${providerId}. Set the required environment variables.`,
          requiredEnvVars: getRequiredEnvVars(providerId),
        }, { status: 422 })
      }

      // Generate authorization URL with CSRF state token
      const result = connectProvider(providerId, userId, origin)
      if (!result) {
        return NextResponse.json(
          { success: false, error: 'Failed to generate authorization URL' },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        data: {
          authorizationUrl: result.authorizationUrl,
          stateToken: result.stateToken,
          providerId,
        },
        message: 'Redirect user to authorizationUrl to complete OAuth flow',
      })
    }

    case 'disconnect': {
      await disconnectProvider(userId, providerId)

      return NextResponse.json({
        success: true,
        data: { providerId, status: 'disconnected' },
        message: `Disconnected from ${providerId}`,
      })
    }

    case 'refresh': {
      const refreshed = await refreshTokenIfExpired(userId, providerId)
      if (!refreshed) {
        return NextResponse.json(
          { success: false, error: 'Failed to refresh token — provider not connected or token expired' },
          { status: 404 },
        )
      }

      return NextResponse.json({
        success: true,
        data: refreshed,
        message: `Token refreshed for ${providerId}`,
      })
    }
  }
}

function getRequiredEnvVars(providerId: string): string[] {
  const config = getOAuthConfig(providerId)
  if (!config) return []
  return [config.clientIdEnvKey, config.clientSecretEnvKey]
}
