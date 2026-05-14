import type {
  EvidenceConfidence,
  EvidenceSourceKind,
  ProtectionOutcome,
  RemediationAuthority,
  RemediationModel,
  ScanEvidence,
  ScanTarget,
  ScanTargetType,
} from '@/types/scanner.types'

const QGUARD_CONTROLLED_TARGETS = new Set<ScanTargetType>([
  'local-file',
  'local-keystore',
  'device-certificate',
  'ssh-directory',
])

const CUSTOMER_ADMIN_CONFIGURABLE_TARGETS = new Set<ScanTargetType>([
  'cloud-infrastructure',
  'endpoint-security',
  'certificate',
  'app',
  'developer-platform',
])

const PROVIDER_OWNED_TARGETS = new Set<ScanTargetType>([
  'cloud-drive',
  'email',
  'social-media',
  'messaging',
  'crypto-wallet',
])

const LOCAL_PASSWORD_VAULT_PROVIDERS = new Set(['keepass'])

interface EvidenceOptions {
  moduleId?: string
  source?: string
  detail?: string
  kind?: EvidenceSourceKind
  confidence?: EvidenceConfidence
}

export function buildEvidenceForTarget(target: ScanTarget, options: EvidenceOptions = {}): ScanEvidence {
  const source = options.source ?? (options.moduleId ? `QGuard scanner module: ${options.moduleId}` : 'QGuard heuristic scanner')
  const targetLabel = target.provider ? `${target.provider}/${target.type}` : target.type

  return {
    kind: options.kind ?? 'heuristic',
    confidence: options.confidence ?? 'low',
    source,
    detail: options.detail ?? `Derived from target profile and scanner module affinity for ${targetLabel}. Connect a provider adapter or local agent for observed API/file evidence.`,
  }
}

export function buildRemediationModel(target: ScanTarget): RemediationModel {
  const authority = classifyRemediationAuthority(target)
  const outcome = defaultProtectionOutcome(target, authority)

  switch (authority) {
    case 'qguard_controlled':
      return {
        authority,
        protectionOutcome: outcome,
        canDirectlyMigrate: true,
        canProtectWithOverlay: true,
        userActionRequired: true,
        label: outcome === 'encrypted_locally' ? 'QGuard-controlled local encryption' : 'QGuard-controlled endpoint hardening',
        summary: 'QGuard can protect this asset because the cryptographic material is local or customer-controlled.',
        nextStep: outcome === 'encrypted_locally'
          ? 'Encrypt the asset with QGuard Vault/QGV1 or a local agent before it is uploaded or reused.'
          : 'Rotate or harden the local key, certificate, SSH, or endpoint configuration with a QGuard-controlled workflow.',
        residualRisk: 'Residual risk remains if the same secret is still reused in a third-party backend or legacy endpoint outside QGuard control.',
        allowedActions: ['encrypt_locally', 'rotate_local_key', 'enable_monitoring', 'create_audit_evidence'],
      }

    case 'customer_admin_configurable':
      return {
        authority,
        protectionOutcome: outcome,
        canDirectlyMigrate: false,
        canProtectWithOverlay: true,
        userActionRequired: true,
        label: 'Customer-admin configurable',
        summary: 'QGuard can guide and verify supported customer/admin settings, but should not claim backend cryptography changed unless a provider API confirms it.',
        nextStep: 'Open the provider-specific hardening plan, apply supported admin controls, or create a migration ticket for the owning team.',
        residualRisk: 'Provider-managed cryptography remains dependent on the provider roadmap and exposed configuration surface.',
        allowedActions: ['create_ticket', 'generate_provider_guide', 'enable_overlay_protection', 'enable_monitoring'],
      }

    case 'provider_owned':
      return {
        authority,
        protectionOutcome: outcome,
        canDirectlyMigrate: false,
        canProtectWithOverlay: true,
        userActionRequired: true,
        label: 'Provider-owned cryptography',
        summary: 'QGuard cannot directly replace the internal encryption stack of this provider from your account.',
        nextStep: 'Protect data before it reaches the provider, harden the endpoint/session, monitor exposure, and track vendor PQC readiness.',
        residualRisk: 'Backend encryption remains vendor-dependent until the provider exposes or completes a supported post-quantum migration path.',
        allowedActions: ['shadow_encrypt_sensitive_data', 'harden_session', 'protect_credentials', 'track_vendor_readiness', 'create_vendor_ticket'],
      }

    default:
      return {
        authority: 'advisory_only',
        protectionOutcome: 'advisory_only',
        canDirectlyMigrate: false,
        canProtectWithOverlay: false,
        userActionRequired: true,
        label: 'Advisory only',
        summary: 'QGuard can report risk and recommended compensating controls, but has no safe mutation path for this asset.',
        nextStep: 'Document residual risk, assign an owner, and monitor provider or standards readiness.',
        residualRisk: 'No direct remediation path is available from QGuard for this finding.',
        allowedActions: ['generate_report', 'enable_monitoring', 'assign_owner'],
      }
  }
}

export function classifyRemediationAuthority(target: ScanTarget): RemediationAuthority {
  if (QGUARD_CONTROLLED_TARGETS.has(target.type)) return 'qguard_controlled'

  if (target.type === 'password-vault') {
    return !target.provider || LOCAL_PASSWORD_VAULT_PROVIDERS.has(target.provider)
      ? 'qguard_controlled'
      : 'provider_owned'
  }

  if (CUSTOMER_ADMIN_CONFIGURABLE_TARGETS.has(target.type)) return 'customer_admin_configurable'
  if (PROVIDER_OWNED_TARGETS.has(target.type)) return 'provider_owned'

  return 'advisory_only'
}

function defaultProtectionOutcome(target: ScanTarget, authority: RemediationAuthority): ProtectionOutcome {
  if (authority === 'qguard_controlled') {
    if (target.type === 'local-file' || target.type === 'local-keystore' || target.type === 'password-vault') {
      return 'encrypted_locally'
    }
    return 'endpoint_hardened'
  }

  if (authority === 'customer_admin_configurable') {
    if (target.type === 'cloud-infrastructure' || target.type === 'certificate' || target.type === 'endpoint-security') {
      return 'ticket_created'
    }
    return 'monitoring_enabled'
  }

  if (authority === 'provider_owned') return 'vendor_blocked'

  return 'advisory_only'
}

export function remediationAuthorityLabel(authority?: RemediationAuthority): string {
  switch (authority) {
    case 'qguard_controlled': return 'QGuard controlled'
    case 'customer_admin_configurable': return 'Admin configurable'
    case 'provider_owned': return 'Provider owned'
    case 'advisory_only': return 'Advisory only'
    default: return 'Unknown control'
  }
}

export function protectionOutcomeLabel(outcome?: ProtectionOutcome): string {
  switch (outcome) {
    case 'encrypted_locally': return 'Encrypt locally'
    case 'endpoint_hardened': return 'Harden endpoint'
    case 'provider_setting_changed': return 'Provider setting changed'
    case 'ticket_created': return 'Create ticket'
    case 'vendor_blocked': return 'Vendor blocked'
    case 'monitoring_enabled': return 'Enable monitoring'
    case 'advisory_only': return 'Advisory only'
    default: return 'Plan protection'
  }
}
