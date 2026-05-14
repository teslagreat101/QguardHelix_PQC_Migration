/**
 * QGuard Target Map
 * Shared target key → ScanTarget mapping used by API routes.
 */

import type { ScanTargetType, ScanTargetProvider } from '@/types/scanner.types'

interface TargetInfo {
  name: string
  type: ScanTargetType
  provider?: ScanTargetProvider
}

export const LOCAL_SCAN_TARGET_IDS = new Set([
  'local-files',
  'local-keystores',
  'device-certificates',
  'ssh-keys',
  'local',
])

export const TARGET_MAP: Record<string, TargetInfo> = {
  // Local Assets
  'local-files': { name: 'Local Files', type: 'local-file' },
  'local-keystores': { name: 'Local Key Stores', type: 'local-keystore' },
  'device-certificates': { name: 'Device Certificates', type: 'device-certificate' },
  'ssh-keys': { name: 'SSH Key Directories', type: 'ssh-directory' },

  // Cloud Storage
  'google-drive': { name: 'Google Drive', type: 'cloud-drive', provider: 'google-drive' },
  'dropbox': { name: 'Dropbox', type: 'cloud-drive', provider: 'dropbox' },
  'icloud': { name: 'iCloud', type: 'cloud-drive', provider: 'icloud' },
  'onedrive': { name: 'OneDrive', type: 'cloud-drive', provider: 'onedrive' },
  'box': { name: 'Box', type: 'cloud-drive', provider: 'box' },
  'mega': { name: 'Mega', type: 'cloud-drive', provider: 'mega' },

  // Email
  'gmail': { name: 'Gmail', type: 'email', provider: 'gmail' },
  'outlook': { name: 'Outlook', type: 'email', provider: 'outlook' },
  'yahoo-mail': { name: 'Yahoo Mail', type: 'email', provider: 'yahoo-mail' },
  'proton-mail': { name: 'Proton Mail', type: 'email', provider: 'proton-mail' },
  'zoho-mail': { name: 'Zoho Mail', type: 'email', provider: 'zoho-mail' },

  // Developer Platforms
  'github': { name: 'GitHub', type: 'developer-platform', provider: 'github' },
  'gitlab': { name: 'GitLab', type: 'developer-platform', provider: 'gitlab' },
  'bitbucket': { name: 'Bitbucket', type: 'developer-platform', provider: 'bitbucket' },
  'docker-hub': { name: 'Docker Hub', type: 'developer-platform', provider: 'docker-hub' },

  // Social Media
  'facebook': { name: 'Facebook', type: 'social-media', provider: 'facebook' },
  'instagram': { name: 'Instagram', type: 'social-media', provider: 'instagram' },
  'x-twitter': { name: 'X (Twitter)', type: 'social-media', provider: 'x-twitter' },
  'linkedin': { name: 'LinkedIn', type: 'social-media', provider: 'linkedin' },

  // Messaging
  'whatsapp': { name: 'WhatsApp', type: 'messaging', provider: 'whatsapp' },
  'telegram': { name: 'Telegram', type: 'messaging', provider: 'telegram' },
  'signal': { name: 'Signal', type: 'messaging', provider: 'signal' },
  'discord': { name: 'Discord', type: 'messaging', provider: 'discord' },
  'slack': { name: 'Slack', type: 'messaging', provider: 'slack' },

  // Cloud Infrastructure
  'aws': { name: 'AWS', type: 'cloud-infrastructure', provider: 'aws' },
  'azure': { name: 'Microsoft Azure', type: 'cloud-infrastructure', provider: 'azure' },
  'google-cloud': { name: 'Google Cloud', type: 'cloud-infrastructure', provider: 'google-cloud' },
  'cloudflare': { name: 'Cloudflare', type: 'cloud-infrastructure', provider: 'cloudflare' },
  'apple': { name: 'Apple', type: 'cloud-infrastructure', provider: 'apple' },
  'microsoft-365': { name: 'Microsoft 365 Security', type: 'cloud-infrastructure', provider: 'microsoft-365' },

  // Security Operations
  'fortinet': { name: 'Fortinet', type: 'cloud-infrastructure', provider: 'fortinet' },
  'paloalto': { name: 'Palo Alto Networks', type: 'cloud-infrastructure', provider: 'paloalto' },
  'sentinelone': { name: 'SentinelOne', type: 'endpoint-security', provider: 'sentinelone' },
  'trendmicro': { name: 'Trend Micro', type: 'endpoint-security', provider: 'trendmicro' },

  // Password Managers
  'lastpass': { name: 'LastPass', type: 'password-vault', provider: 'lastpass' },
  '1password': { name: '1Password', type: 'password-vault', provider: '1password' },
  'bitwarden': { name: 'Bitwarden', type: 'password-vault', provider: 'bitwarden' },
  'keepass': { name: 'KeePass', type: 'password-vault', provider: 'keepass' },

  // Crypto Wallets
  'metamask': { name: 'MetaMask', type: 'crypto-wallet', provider: 'metamask' },
  'trust-wallet': { name: 'Trust Wallet', type: 'crypto-wallet', provider: 'trust-wallet' },
  'ledger-live': { name: 'Ledger Live', type: 'crypto-wallet', provider: 'ledger-live' },

  // Legacy keys
  'local': { name: 'Local Files', type: 'local-file' },
  'email': { name: 'Email', type: 'email' },
}

export function resolveTargets(targetKeys: string[]) {
  return targetKeys.map((key) => {
    const info = TARGET_MAP[key] || { name: key, type: 'local-file' as const }
    return {
      id: crypto.randomUUID(),
      ...info,
    }
  })
}

export function isLocalScanTargetKey(targetKey: string): boolean {
  return LOCAL_SCAN_TARGET_IDS.has(targetKey)
}

export function isKnownScanTargetKey(targetKey: string): boolean {
  return Object.hasOwn(TARGET_MAP, targetKey)
}
