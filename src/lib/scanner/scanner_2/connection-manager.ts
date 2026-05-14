/**
 * QGuard Connection Manager
 * Manages OAuth integration state for external platform connections.
 * All connections use read-only OAuth scopes — no passwords are ever requested.
 *
 * NOTE: Full integration management lives in /dashboard/integrations (UIE).
 * This module provides the scanner-specific view of connected platforms.
 */

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'expired'

export interface IntegrationProvider {
  id: string
  name: string
  icon: string
  category: IntegrationCategory
  oauthProvider: string
  scopes: string[]
  permissionDescription: string
  status: ConnectionStatus
  connectedAt?: string
  expiresAt?: string
  accountLabel?: string
}

export type IntegrationCategory =
  | 'email'
  | 'developer'
  | 'cloud-storage'
  | 'cloud-infrastructure'
  | 'collaboration'
  | 'security-ops'

export interface IntegrationCategoryGroup {
  name: string
  icon: string
  category: IntegrationCategory
  providers: IntegrationProvider[]
}

/**
 * Integration providers that support quantum vulnerability scanning.
 * All providers listed here are shown in the scanner connected-assets view.
 * All scopes are read-only by design.
 */
export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  // Email Platforms — scan for S/MIME, PGP, TLS
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '✉️',
    category: 'email',
    oauthProvider: 'google',
    scopes: ['gmail.readonly', 'gmail.metadata'],
    permissionDescription: 'Read email metadata and attachment metadata',
    status: 'disconnected',
  },
  {
    id: 'outlook',
    name: 'Outlook',
    icon: '📨',
    category: 'email',
    oauthProvider: 'microsoft',
    scopes: ['Mail.Read', 'Mail.ReadBasic'],
    permissionDescription: 'Read email metadata and headers',
    status: 'disconnected',
  },

  // Developer Platforms — scan repos for vulnerable crypto
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    category: 'developer',
    oauthProvider: 'github',
    scopes: ['repo:read', 'read:org'],
    permissionDescription: 'Read repositories and commit history',
    status: 'disconnected',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    icon: '🦊',
    category: 'developer',
    oauthProvider: 'gitlab',
    scopes: ['read_repository', 'read_api'],
    permissionDescription: 'Read repositories and CI/CD metadata',
    status: 'disconnected',
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    icon: '🪣',
    category: 'developer',
    oauthProvider: 'bitbucket',
    scopes: ['repository:read'],
    permissionDescription: 'Read repositories and commit history',
    status: 'disconnected',
  },
  {
    id: 'docker-hub',
    name: 'Docker Hub',
    icon: '🐳',
    category: 'developer',
    oauthProvider: 'docker',
    scopes: ['repo:read'],
    permissionDescription: 'Read container image metadata',
    status: 'disconnected',
  },

  // Cloud Storage — scan stored certs/keys
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '🟢',
    category: 'cloud-storage',
    oauthProvider: 'google',
    scopes: ['drive.metadata.readonly'],
    permissionDescription: 'Read file metadata and list directories',
    status: 'disconnected',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '📦',
    category: 'cloud-storage',
    oauthProvider: 'dropbox',
    scopes: ['files.metadata.read'],
    permissionDescription: 'Read file metadata',
    status: 'disconnected',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: '🔵',
    category: 'cloud-storage',
    oauthProvider: 'microsoft',
    scopes: ['Files.Read'],
    permissionDescription: 'Read file metadata and directory listing',
    status: 'disconnected',
  },

  // Cloud Infrastructure — audit TLS/KMS/certificates
  {
    id: 'aws',
    name: 'AWS',
    icon: '🟠',
    category: 'cloud-infrastructure',
    oauthProvider: 'aws',
    scopes: ['acm:ListCertificates', 'kms:ListKeys', 'iam:ListServerCertificates'],
    permissionDescription: 'Read certificate metadata and encryption configuration',
    status: 'disconnected',
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    icon: '🔷',
    category: 'cloud-infrastructure',
    oauthProvider: 'microsoft',
    scopes: ['KeyVault.Read', 'Certificate.Read'],
    permissionDescription: 'Read certificate and key vault metadata',
    status: 'disconnected',
  },
  {
    id: 'google-cloud',
    name: 'Google Cloud',
    icon: '🌐',
    category: 'cloud-infrastructure',
    oauthProvider: 'google',
    scopes: ['cloudkms.cryptoKeys.list', 'compute.sslCertificates.list'],
    permissionDescription: 'Read KMS and certificate metadata',
    status: 'disconnected',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    icon: '🟡',
    category: 'cloud-infrastructure',
    oauthProvider: 'cloudflare',
    scopes: ['zone.ssl:read'],
    permissionDescription: 'Read SSL/TLS certificate configuration',
    status: 'disconnected',
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: '🍎',
    category: 'cloud-infrastructure',
    oauthProvider: 'apple',
    scopes: ['mdm.read'],
    permissionDescription: 'Read MDM certificates and device encryption metadata',
    status: 'disconnected',
  },

  // Collaboration — alerting and notifications
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    category: 'collaboration',
    oauthProvider: 'discord',
    scopes: ['identify', 'email', 'guilds'],
    permissionDescription: 'Read server list and send webhook notifications',
    status: 'disconnected',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    category: 'collaboration',
    oauthProvider: 'linkedin',
    scopes: ['openid', 'profile', 'email'],
    permissionDescription: 'Read organization security posture data',
    status: 'disconnected',
  },

  // Security Operations — endpoint, network, SIEM
  {
    id: 'fortinet',
    name: 'Fortinet',
    icon: '🏰',
    category: 'security-ops',
    oauthProvider: 'fortinet',
    scopes: ['firewall.read', 'vpn.read'],
    permissionDescription: 'Read firewall policies, VPN tunnels, and TLS certificates',
    status: 'disconnected',
  },
  {
    id: 'sentinelone',
    name: 'SentinelOne',
    icon: '🛡️',
    category: 'security-ops',
    oauthProvider: 'sentinelone',
    scopes: ['agents.read', 'threats.read'],
    permissionDescription: 'Read endpoint agents, threats, and certificate data',
    status: 'disconnected',
  },
  {
    id: 'trendmicro',
    name: 'Trend Micro',
    icon: '🔴',
    category: 'security-ops',
    oauthProvider: 'trendmicro',
    scopes: ['endpoints.read', 'detections.read'],
    permissionDescription: 'Read endpoints, detections, and TLS configurations',
    status: 'disconnected',
  },
  {
    id: 'paloalto',
    name: 'Palo Alto Networks',
    icon: '🔥',
    category: 'security-ops',
    oauthProvider: 'paloalto',
    scopes: ['firewall.read', 'vpn.read'],
    permissionDescription: 'Read firewall policies, VPN tunnels, and IPsec configurations',
    status: 'disconnected',
  },
  {
    id: 'microsoft-365',
    name: 'Microsoft 365 Security',
    icon: '🟦',
    category: 'security-ops',
    oauthProvider: 'microsoft',
    scopes: ['SecurityEvents.Read.All', 'SecurityAlert.Read.All'],
    permissionDescription: 'Read security events, alerts, and compliance data',
    status: 'disconnected',
  },
]

/**
 * Provider IDs that can be used as external scan targets.
 * Keep this list derived from INTEGRATION_PROVIDERS so the integrations page,
 * scanner UI, and scan authorization checks agree on the same assets.
 */
export const SCANNABLE_CONNECTOR_IDS = new Set(INTEGRATION_PROVIDERS.map((provider) => provider.id))

export function isScannableConnector(connectorId: string): boolean {
  return SCANNABLE_CONNECTOR_IDS.has(connectorId)
}

/**
 * Group providers by category
 */
export function getIntegrationCategories(providers: IntegrationProvider[]): IntegrationCategoryGroup[] {
  const categoryMeta: Record<IntegrationCategory, { name: string; icon: string }> = {
    'email': { name: 'Email Platforms', icon: '📧' },
    'developer': { name: 'Developer Platforms', icon: '🛠️' },
    'cloud-storage': { name: 'Cloud Storage', icon: '☁️' },
    'cloud-infrastructure': { name: 'Cloud Infrastructure', icon: '🏗️' },
    'collaboration': { name: 'Collaboration', icon: '💬' },
    'security-ops': { name: 'Security Operations', icon: '🛡️' },
  }

  const categoryOrder: IntegrationCategory[] = [
    'email', 'developer', 'cloud-storage', 'cloud-infrastructure', 'collaboration', 'security-ops',
  ]

  const groups: IntegrationCategoryGroup[] = []

  for (const cat of categoryOrder) {
    const meta = categoryMeta[cat]
    const categoryProviders = providers.filter((p) => p.category === cat)
    if (categoryProviders.length > 0) {
      groups.push({
        name: meta.name,
        icon: meta.icon,
        category: cat,
        providers: categoryProviders,
      })
    }
  }

  return groups
}

/**
 * Generate OAuth authorization URL for a provider.
 */
export function getOAuthUrl(provider: IntegrationProvider): string {
  const baseUrls: Record<string, string> = {
    google: 'https://accounts.google.com/o/oauth2/v2/auth',
    microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    github: 'https://github.com/login/oauth/authorize',
    gitlab: 'https://gitlab.com/oauth/authorize',
    bitbucket: 'https://bitbucket.org/site/oauth2/authorize',
    dropbox: 'https://www.dropbox.com/oauth2/authorize',
    aws: 'https://signin.aws.amazon.com/oauth',
    cloudflare: 'https://dash.cloudflare.com/oauth2/authorize',
  }

  const baseUrl = baseUrls[provider.oauthProvider] || `https://auth.${provider.oauthProvider}.com/oauth2/authorize`
  const scopes = encodeURIComponent(provider.scopes.join(' '))
  const redirectUri = encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/integrations/callback`)
  const state = encodeURIComponent(JSON.stringify({ providerId: provider.id }))

  return `${baseUrl}?client_id=QGUARD_APP&scope=${scopes}&redirect_uri=${redirectUri}&response_type=code&state=${state}&access_type=offline&prompt=consent`
}

/**
 * Get count of connected providers
 */
export function getConnectionStats(providers: IntegrationProvider[]) {
  const connected = providers.filter((p) => p.status === 'connected').length
  const total = providers.length
  const expired = providers.filter((p) => p.status === 'expired').length
  return { connected, total, expired, disconnected: total - connected - expired }
}
