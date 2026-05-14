import type {
  ScanFinding,
  DetectionRule,
  DetectionRuleResult,
  DetectionRuleCategory,
} from '@/types/scanner.types'
import type { ClassicalAlgorithm } from '@/types/quantum.types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildResult(
  rule: DetectionRule,
  finding: ScanFinding,
  remediation: string,
  scoreAdjustment = 0
): DetectionRuleResult {
  const adjustedRiskScore = Math.min(
    1000,
    Math.max(0, rule.riskScore + scoreAdjustment)
  )
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    matched: true,
    finding,
    adjustedRiskScore,
    severity: rule.severity,
    remediation,
  }
}

function algorithmMatches(
  finding: ScanFinding,
  algorithms: ClassicalAlgorithm[]
): boolean {
  return algorithms.includes(finding.detectedAlgorithm)
}

function targetTypeIs(finding: ScanFinding, type: string): boolean {
  return finding.target.type === type
}

function contextContains(finding: ScanFinding, keyword: string): boolean {
  if (!finding.detectionContext) return false
  const ctx =
    typeof finding.detectionContext === 'string'
      ? finding.detectionContext
      : JSON.stringify(finding.detectionContext)
  return ctx.toLowerCase().includes(keyword.toLowerCase())
}

function contextContainsAny(
  finding: ScanFinding,
  keywords: string[]
): boolean {
  return keywords.some((kw) => contextContains(finding, kw))
}

// ---------------------------------------------------------------------------
// TLS & Internet Protocol Rules (1-10)
// ---------------------------------------------------------------------------

const rule01: DetectionRule = {
  id: 'QG-TLS-001',
  name: 'RSA-1024 TLS Certificates',
  category: 'tls-internet',
  description:
    'Detects TLS certificates using RSA-1024 keys, which are already considered breakable by classical computing and trivially breakable by quantum computers.',
  targetAlgorithms: ['RSA-1024'],
  riskScore: 950,
  severity: 'critical',
  quantumThreat: 'shor',
  recommendation:
    'Immediately replace RSA-1024 certificates with RSA-4096 or migrate to a PQC-safe algorithm such as ML-KEM (CRYSTALS-Kyber).',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !targetTypeIs(finding, 'tls') &&
      !targetTypeIs(finding, 'certificate') &&
      !contextContainsAny(finding, ['tls', 'certificate', 'https', 'ssl'])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule02: DetectionRule = {
  id: 'QG-TLS-002',
  name: 'RSA-2048 Certificates on Public Internet',
  category: 'tls-internet',
  description:
    'Detects RSA-2048 certificates exposed on the public internet, which are vulnerable to quantum factorisation via Shor\'s algorithm.',
  targetAlgorithms: ['RSA-2048'],
  riskScore: 720,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Upgrade to RSA-4096 as an interim measure and plan migration to a PQC certificate scheme such as ML-DSA (CRYSTALS-Dilithium).',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !targetTypeIs(finding, 'tls') &&
      !targetTypeIs(finding, 'certificate') &&
      !contextContainsAny(finding, ['tls', 'certificate', 'public', 'internet', 'https'])
    )
      return null
    const isPublic = contextContainsAny(finding, ['public', 'internet', 'external'])
    return buildResult(this, finding, this.recommendation, isPublic ? 30 : 0)
  },
}

const rule03: DetectionRule = {
  id: 'QG-TLS-003',
  name: 'Weak Diffie-Hellman Groups (< 2048 bits)',
  category: 'tls-internet',
  description:
    'Detects use of Diffie-Hellman key exchange with groups smaller than 2048 bits, which are susceptible to both classical and quantum attacks.',
  targetAlgorithms: ['DH-1024'],
  riskScore: 900,
  severity: 'critical',
  quantumThreat: 'both',
  recommendation:
    'Disable DH groups smaller than 2048 bits. Prefer ECDHE with strong curves or migrate to ML-KEM for quantum resistance.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule04: DetectionRule = {
  id: 'QG-TLS-004',
  name: 'TLS Cipher Suites Using RSA Key Exchange',
  category: 'tls-internet',
  description:
    'Detects TLS configurations using RSA key exchange (non-ephemeral), which provides no forward secrecy and enables harvest-now-decrypt-later attacks.',
  targetAlgorithms: ['RSA-1024', 'RSA-2048', 'RSA-4096'],
  riskScore: 780,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Disable static RSA key exchange cipher suites. Use ECDHE or DHE-based suites for forward secrecy, and plan PQC hybrid key exchange migration.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'rsa key exchange',
        'static rsa',
        'tls_rsa_with',
        'key exchange',
        'no forward secrecy',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule05: DetectionRule = {
  id: 'QG-TLS-005',
  name: 'TLS Servers Supporting TLS 1.0/1.1',
  category: 'tls-internet',
  description:
    'Detects servers still supporting TLS 1.0 or 1.1, which rely on deprecated cryptographic primitives and are universally considered insecure.',
  targetAlgorithms: ['TLS-1.0', 'TLS-1.1'],
  riskScore: 850,
  severity: 'critical',
  quantumThreat: 'classical-broken',
  recommendation:
    'Disable TLS 1.0 and 1.1 immediately. Require TLS 1.2 as a minimum and prefer TLS 1.3 with PQC cipher suites where available.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule06: DetectionRule = {
  id: 'QG-TLS-006',
  name: 'SHA-1 Certificate Signatures',
  category: 'tls-internet',
  description:
    'Detects certificates signed with SHA-1, which is vulnerable to practical collision attacks and is deprecated by all major browsers and CAs.',
  targetAlgorithms: ['SHA-1'],
  riskScore: 880,
  severity: 'critical',
  quantumThreat: 'grover',
  recommendation:
    'Reissue certificates with SHA-256 or SHA-384 signatures. SHA-1 collision attacks are practical today and quantum computing further reduces security margins.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !targetTypeIs(finding, 'tls') &&
      !targetTypeIs(finding, 'certificate') &&
      !contextContainsAny(finding, ['certificate', 'signature', 'signed'])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule07: DetectionRule = {
  id: 'QG-TLS-007',
  name: 'Self-Signed TLS Certificates',
  category: 'tls-internet',
  description:
    'Detects self-signed TLS certificates, which enable man-in-the-middle attacks due to the absence of chain-of-trust verification.',
  targetAlgorithms: ['RSA-1024', 'RSA-2048', 'RSA-4096', 'ECC-P256', 'ECC-P384'],
  riskScore: 650,
  severity: 'moderate',
  quantumThreat: 'shor',
  recommendation:
    'Replace self-signed certificates with CA-signed certificates. Use automated issuance via ACME/Let\'s Encrypt and plan for PQC certificate chains.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!contextContainsAny(finding, ['self-signed', 'self signed', 'selfsigned']))
      return null
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule08: DetectionRule = {
  id: 'QG-TLS-008',
  name: 'TLS Without Forward Secrecy',
  category: 'tls-internet',
  description:
    'Detects TLS connections that do not use ephemeral key exchange, making recorded traffic decryptable if the server key is later compromised or quantum-broken.',
  targetAlgorithms: ['RSA-1024', 'RSA-2048', 'RSA-4096', 'DH-1024', 'DH-2048'],
  riskScore: 760,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Enable ephemeral key exchange (ECDHE or DHE) for all cipher suites. Disable static key exchange to protect against harvest-now-decrypt-later attacks.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'no forward secrecy',
        'no pfs',
        'static key',
        'without forward secrecy',
        'no ephemeral',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule09: DetectionRule = {
  id: 'QG-TLS-009',
  name: 'Weak Elliptic Curves',
  category: 'tls-internet',
  description:
    'Detects use of weak elliptic curves (secp192r1, secp224r1 or equivalent small curves) that provide lower security margins, especially against quantum adversaries.',
  targetAlgorithms: ['ECC-P256'],
  riskScore: 820,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Disable weak elliptic curves (< 256-bit). Use ECC-P384 or Ed25519 as an interim, and plan migration to ML-KEM/ML-DSA for quantum resistance.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, [
        'secp192',
        'secp224',
        'p-192',
        'p-224',
        'weak curve',
        'small curve',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule10: DetectionRule = {
  id: 'QG-TLS-010',
  name: 'TLS Using Static Diffie-Hellman',
  category: 'tls-internet',
  description:
    'Detects TLS configurations using static (non-ephemeral) Diffie-Hellman, which breaks forward secrecy and enables harvest-now-decrypt-later attacks.',
  targetAlgorithms: ['DH-1024', 'DH-2048'],
  riskScore: 790,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Replace static DH with ephemeral DH (DHE) or ECDHE cipher suites. Consider hybrid PQC key exchange for long-term confidentiality.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'static dh',
        'static diffie',
        'non-ephemeral',
        'dh_dss',
        'dh_rsa',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

// ---------------------------------------------------------------------------
// Certificate Infrastructure Rules (11-15)
// ---------------------------------------------------------------------------

const rule11: DetectionRule = {
  id: 'QG-CERT-011',
  name: 'Root CA Using RSA-2048',
  category: 'certificate-infrastructure',
  description:
    'Detects root Certificate Authorities using RSA-2048, which have long lifetimes and face significant quantum risk from Shor\'s algorithm.',
  targetAlgorithms: ['RSA-2048'],
  riskScore: 700,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Migrate root CA certificates to RSA-4096 as an interim measure. Begin planning a transition to PQC signature schemes (ML-DSA) for root CAs.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (!contextContainsAny(finding, ['root ca', 'root certificate', 'ca root']))
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule12: DetectionRule = {
  id: 'QG-CERT-012',
  name: 'Intermediate CA Using Weak Signatures',
  category: 'certificate-infrastructure',
  description:
    'Detects intermediate CA certificates using SHA-1 or other outdated signature algorithms, weakening the entire certificate chain.',
  targetAlgorithms: ['SHA-1', 'MD5'],
  riskScore: 840,
  severity: 'critical',
  quantumThreat: 'grover',
  recommendation:
    'Reissue intermediate CA certificates with SHA-256 or SHA-384 signatures. Revoke and replace all SHA-1 or MD5-signed intermediates immediately.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'intermediate ca',
        'intermediate certificate',
        'ca intermediate',
        'certificate chain',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule13: DetectionRule = {
  id: 'QG-CERT-013',
  name: 'Expired Certificates Still Accepted',
  category: 'certificate-infrastructure',
  description:
    'Detects systems accepting expired certificates, which often use outdated cryptographic algorithms and indicate poor certificate lifecycle management.',
  targetAlgorithms: [
    'RSA-1024', 'RSA-2048', 'RSA-4096', 'ECC-P256', 'ECC-P384',
    'SHA-1', 'SHA-256',
  ],
  riskScore: 600,
  severity: 'moderate',
  quantumThreat: 'shor',
  recommendation:
    'Reject expired certificates in all trust stores. Implement automated certificate monitoring and renewal using ACME protocols.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!contextContainsAny(finding, ['expired', 'expiration', 'past validity']))
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule14: DetectionRule = {
  id: 'QG-CERT-014',
  name: 'Short RSA Key Lifetimes / Infrequent Rotation',
  category: 'certificate-infrastructure',
  description:
    'Detects RSA certificates with excessively long validity periods or keys that are not rotated frequently enough, increasing quantum exposure window.',
  targetAlgorithms: ['RSA-2048', 'RSA-4096'],
  riskScore: 680,
  severity: 'moderate',
  quantumThreat: 'shor',
  recommendation:
    'Limit RSA certificate validity to 90 days where possible. Implement automated key rotation and certificate renewal to reduce exposure windows.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'long validity',
        'no rotation',
        'infrequent rotation',
        'key lifetime',
        'not rotated',
        'stale key',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule15: DetectionRule = {
  id: 'QG-CERT-015',
  name: 'Weak Certificate Chain Length',
  category: 'certificate-infrastructure',
  description:
    'Detects certificate chains with insufficient depth or missing intermediate certificates, increasing susceptibility to trust-chain manipulation.',
  targetAlgorithms: [
    'RSA-1024', 'RSA-2048', 'RSA-4096', 'ECC-P256', 'ECC-P384',
  ],
  riskScore: 620,
  severity: 'moderate',
  quantumThreat: 'shor',
  recommendation:
    'Ensure complete certificate chains are served. Validate chain depth and ensure all intermediates use strong signature algorithms (SHA-256+).',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, [
        'short chain',
        'chain length',
        'missing intermediate',
        'incomplete chain',
        'weak chain',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

// ---------------------------------------------------------------------------
// SSH Security Rules (16-20)
// ---------------------------------------------------------------------------

const rule16: DetectionRule = {
  id: 'QG-SSH-016',
  name: 'SSH Servers Using RSA-1024 Host Keys',
  category: 'ssh-security',
  description:
    'Detects SSH servers using RSA-1024 host keys, which are already practically breakable and will be trivially broken by quantum computers.',
  targetAlgorithms: ['RSA-1024'],
  riskScore: 920,
  severity: 'critical',
  quantumThreat: 'shor',
  recommendation:
    'Regenerate SSH host keys with a minimum of RSA-4096, or preferably Ed25519. Plan migration to PQC key exchange when OpenSSH PQC support is available.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !targetTypeIs(finding, 'ssh') &&
      !contextContainsAny(finding, ['ssh', 'host key', 'sshd'])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule17: DetectionRule = {
  id: 'QG-SSH-017',
  name: 'SSH Servers Allowing DH Group1',
  category: 'ssh-security',
  description:
    'Detects SSH servers allowing diffie-hellman-group1-sha1, which uses a 1024-bit DH group and SHA-1, both critically weak.',
  targetAlgorithms: ['DH-1024'],
  riskScore: 890,
  severity: 'critical',
  quantumThreat: 'both',
  recommendation:
    'Disable diffie-hellman-group1-sha1 in sshd_config. Use diffie-hellman-group16-sha512 or curve25519-sha256 as key exchange algorithms.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !targetTypeIs(finding, 'ssh') &&
      !contextContainsAny(finding, ['ssh', 'sshd'])
    )
      return null
    if (
      algorithmMatches(finding, this.targetAlgorithms) ||
      contextContainsAny(finding, ['group1', 'dh-group1', 'diffie-hellman-group1'])
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule18: DetectionRule = {
  id: 'QG-SSH-018',
  name: 'SSH Servers Allowing SHA-1 Signatures',
  category: 'ssh-security',
  description:
    'Detects SSH servers that allow SHA-1-based signatures (ssh-rsa with SHA-1), which are vulnerable to collision attacks.',
  targetAlgorithms: ['SHA-1'],
  riskScore: 830,
  severity: 'high',
  quantumThreat: 'grover',
  recommendation:
    'Disable ssh-rsa signature algorithm. Use rsa-sha2-256 or rsa-sha2-512 for RSA keys, or prefer Ed25519 host keys.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !targetTypeIs(finding, 'ssh') &&
      !contextContainsAny(finding, ['ssh', 'sshd', 'host key'])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule19: DetectionRule = {
  id: 'QG-SSH-019',
  name: 'SSH Using Static Host Keys Without Rotation',
  category: 'ssh-security',
  description:
    'Detects SSH servers using host keys that have not been rotated, increasing long-term quantum exposure.',
  targetAlgorithms: [
    'RSA-2048', 'RSA-4096', 'ECC-P256', 'ECC-P384', 'Ed25519',
  ],
  riskScore: 700,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Implement regular SSH host key rotation. Use automated key management and distribute new host keys via DNS SSHFP records or a trusted channel.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !targetTypeIs(finding, 'ssh') &&
      !contextContainsAny(finding, ['ssh', 'sshd'])
    )
      return null
    if (
      !contextContainsAny(finding, [
        'no rotation',
        'static host key',
        'not rotated',
        'stale key',
        'key age',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule20: DetectionRule = {
  id: 'QG-SSH-020',
  name: 'SSH Allowing Password Auth Only',
  category: 'ssh-security',
  description:
    'Detects SSH servers relying solely on password authentication without public key authentication, increasing brute-force and credential-stuffing risk.',
  targetAlgorithms: ['RSA-1024', 'RSA-2048'],
  riskScore: 650,
  severity: 'moderate',
  quantumThreat: 'grover',
  recommendation:
    'Disable password authentication in sshd_config. Require public key authentication and consider FIDO2/hardware tokens for additional security.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !targetTypeIs(finding, 'ssh') &&
      !contextContainsAny(finding, ['ssh', 'sshd'])
    )
      return null
    if (
      !contextContainsAny(finding, [
        'password auth',
        'password only',
        'no public key',
        'password authentication',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

// ---------------------------------------------------------------------------
// VPN & Network Tunnel Rules (21-25)
// ---------------------------------------------------------------------------

const rule21: DetectionRule = {
  id: 'QG-VPN-021',
  name: 'IPSec Using IKEv1',
  category: 'vpn-network',
  description:
    'Detects IPSec VPN configurations using IKEv1, which has known cryptographic weaknesses and lacks modern security features present in IKEv2.',
  targetAlgorithms: ['DH-1024', 'DH-2048', '3DES'],
  riskScore: 810,
  severity: 'high',
  quantumThreat: 'both',
  recommendation:
    'Migrate from IKEv1 to IKEv2. IKEv2 supports stronger DH groups, EAP authentication, and is better positioned for PQC key exchange integration.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, ['ikev1', 'ike v1', 'ipsec'])
    )
      return null
    if (
      algorithmMatches(finding, this.targetAlgorithms) ||
      contextContains(finding, 'ikev1')
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule22: DetectionRule = {
  id: 'QG-VPN-022',
  name: 'IPSec Using Weak DH Groups',
  category: 'vpn-network',
  description:
    'Detects IPSec/IKE configurations using weak Diffie-Hellman groups (group 1, 2, or 5), which are vulnerable to quantum and classical attacks.',
  targetAlgorithms: ['DH-1024'],
  riskScore: 860,
  severity: 'critical',
  quantumThreat: 'both',
  recommendation:
    'Configure IPSec to use DH group 14 (2048-bit) as a minimum. Prefer group 19/20 (ECC) or plan for PQC key exchange in IKEv2.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, ['ipsec', 'ike', 'vpn'])
    )
      return null
    if (
      algorithmMatches(finding, this.targetAlgorithms) ||
      contextContainsAny(finding, ['group1', 'group2', 'group5', 'weak dh'])
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule23: DetectionRule = {
  id: 'QG-VPN-023',
  name: 'OpenVPN Using Static Pre-Shared Keys',
  category: 'vpn-network',
  description:
    'Detects OpenVPN configurations using static pre-shared keys, which provide no forward secrecy and make all sessions decryptable if the key is compromised.',
  targetAlgorithms: ['AES-128', 'AES-256'],
  riskScore: 750,
  severity: 'high',
  quantumThreat: 'both',
  recommendation:
    'Switch from static key mode to TLS mode in OpenVPN. Use --tls-crypt for additional security and ensure ephemeral key exchange is enabled.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, ['openvpn', 'vpn'])
    )
      return null
    if (
      !contextContainsAny(finding, [
        'static key',
        'pre-shared',
        'preshared',
        'psk',
        'static psk',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule24: DetectionRule = {
  id: 'QG-VPN-024',
  name: 'VPN Without Perfect Forward Secrecy',
  category: 'vpn-network',
  description:
    'Detects VPN configurations that do not use perfect forward secrecy, enabling harvest-now-decrypt-later attacks with quantum computers.',
  targetAlgorithms: ['RSA-2048', 'RSA-4096', 'DH-2048'],
  riskScore: 780,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Enable PFS in all VPN configurations by using ephemeral DH or ECDH key exchange. Rekey sessions frequently to limit exposure.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, ['vpn', 'ipsec', 'openvpn', 'tunnel'])
    )
      return null
    if (
      !contextContainsAny(finding, [
        'no pfs',
        'no forward secrecy',
        'without pfs',
        'without forward secrecy',
        'static key exchange',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule25: DetectionRule = {
  id: 'QG-VPN-025',
  name: 'WireGuard Misconfigured Key Exchange',
  category: 'vpn-network',
  description:
    'Detects WireGuard VPN instances with misconfigured key exchange, such as reused ephemeral keys or stale peer keys, reducing cryptographic guarantees.',
  targetAlgorithms: ['X25519'],
  riskScore: 660,
  severity: 'moderate',
  quantumThreat: 'shor',
  recommendation:
    'Regenerate WireGuard key pairs regularly. Remove stale peer configurations and monitor for key reuse. Evaluate PQC WireGuard forks for quantum resistance.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, ['wireguard', 'wg0', 'wg1'])
    )
      return null
    if (
      algorithmMatches(finding, this.targetAlgorithms) ||
      contextContainsAny(finding, [
        'misconfigured',
        'key reuse',
        'stale peer',
        'stale key',
      ])
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

// ---------------------------------------------------------------------------
// Application Cryptography Rules (26-30)
// ---------------------------------------------------------------------------

const rule26: DetectionRule = {
  id: 'QG-APP-026',
  name: 'Hardcoded RSA Keys in Applications',
  category: 'application-crypto',
  description:
    'Detects RSA private keys hardcoded in application source code or configuration files, which are trivially extractable and quantum-vulnerable.',
  targetAlgorithms: ['RSA-1024', 'RSA-2048', 'RSA-4096'],
  riskScore: 910,
  severity: 'critical',
  quantumThreat: 'shor',
  recommendation:
    'Remove hardcoded RSA keys immediately. Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) and inject keys at runtime via environment variables.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'hardcoded',
        'embedded key',
        'source code',
        'private key in',
        'key literal',
        'static key',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule27: DetectionRule = {
  id: 'QG-APP-027',
  name: 'Hardcoded AES Encryption Keys',
  category: 'application-crypto',
  description:
    'Detects AES encryption keys hardcoded in source code or configuration, making symmetric encryption trivially bypassable if the code is leaked.',
  targetAlgorithms: ['AES-128', 'AES-256'],
  riskScore: 800,
  severity: 'high',
  quantumThreat: 'grover',
  recommendation:
    'Remove hardcoded AES keys. Use a KMS for key management, derive keys using a KDF (HKDF, Argon2), and rotate keys regularly.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'hardcoded',
        'embedded key',
        'source code',
        'key literal',
        'static key',
        'encryption key in',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule28: DetectionRule = {
  id: 'QG-APP-028',
  name: 'Applications Using MD5 for Signatures',
  category: 'application-crypto',
  description:
    'Detects applications using MD5 for digital signatures or integrity checks, which is completely broken for collision resistance.',
  targetAlgorithms: ['MD5'],
  riskScore: 940,
  severity: 'critical',
  quantumThreat: 'classical-broken',
  recommendation:
    'Replace MD5 with SHA-256 or SHA-3 for all signature and integrity verification purposes. MD5 is considered fully broken and must not be used.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      targetTypeIs(finding, 'application') ||
      contextContainsAny(finding, [
        'signature',
        'integrity',
        'verification',
        'signing',
        'digest',
        'hash',
        'application',
      ])
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule29: DetectionRule = {
  id: 'QG-APP-029',
  name: 'JWT Tokens Signed With Weak Algorithms',
  category: 'application-crypto',
  description:
    'Detects JWT tokens signed with weak algorithms such as HS256 with short keys, RS256 with RSA-1024, or the none algorithm.',
  targetAlgorithms: ['RSA-1024', 'RSA-2048', 'SHA-256'],
  riskScore: 770,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Use RS256 with RSA-4096 or ES256 (ECDSA P-256) at minimum for JWT signing. Disable the "none" algorithm and enforce algorithm verification on the server.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, ['jwt', 'json web token', 'bearer token'])
    )
      return null
    if (
      algorithmMatches(finding, this.targetAlgorithms) ||
      contextContainsAny(finding, [
        'weak algorithm',
        'none algorithm',
        'hs256',
        'weak signing',
      ])
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule30: DetectionRule = {
  id: 'QG-APP-030',
  name: 'Weak Random Number Generation',
  category: 'application-crypto',
  description:
    'Detects use of weak or predictable random number generators (Math.random, rand(), srand) for cryptographic purposes such as key generation or nonce creation.',
  targetAlgorithms: ['AES-128', 'AES-256', 'RSA-2048'],
  riskScore: 850,
  severity: 'critical',
  quantumThreat: 'grover',
  recommendation:
    'Use cryptographically secure PRNGs (crypto.getRandomValues, /dev/urandom, SecureRandom). Never use Math.random() or similar for security-sensitive operations.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, [
        'math.random',
        'weak random',
        'predictable random',
        'weak prng',
        'srand',
        'rand()',
        'insecure random',
        'pseudo-random',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

// ---------------------------------------------------------------------------
// Blockchain & Digital Asset Rules (31-35)
// ---------------------------------------------------------------------------

const rule31: DetectionRule = {
  id: 'QG-CHAIN-031',
  name: 'Wallets Using ECDSA secp256k1',
  category: 'blockchain-digital-asset',
  description:
    'Detects cryptocurrency wallets using ECDSA with the secp256k1 curve, which is vulnerable to Shor\'s algorithm on a sufficiently large quantum computer.',
  targetAlgorithms: ['ECC-secp256k1'],
  riskScore: 820,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Monitor PQC developments in blockchain ecosystems. Where possible, use wallets that support hash-based signatures (XMSS/LMS) or PQC-ready schemes.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      targetTypeIs(finding, 'blockchain') ||
      targetTypeIs(finding, 'wallet') ||
      contextContainsAny(finding, [
        'wallet',
        'blockchain',
        'cryptocurrency',
        'bitcoin',
        'ethereum',
        'crypto wallet',
      ])
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule32: DetectionRule = {
  id: 'QG-CHAIN-032',
  name: 'Exposed Public Keys on Blockchain',
  category: 'blockchain-digital-asset',
  description:
    'Detects cryptocurrency addresses with exposed public keys on the blockchain, which can be targeted by quantum attacks once keys are revealed.',
  targetAlgorithms: ['ECC-secp256k1', 'ECDSA-P256'],
  riskScore: 780,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Minimize public key exposure by using each address only once. Move funds to fresh addresses and prefer pay-to-script-hash schemes that delay key revelation.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, [
        'exposed public key',
        'blockchain',
        'on-chain',
        'public key exposed',
        'reused address',
      ])
    )
      return null
    if (algorithmMatches(finding, this.targetAlgorithms))
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule33: DetectionRule = {
  id: 'QG-CHAIN-033',
  name: 'Wallet Backup Files Stored Unencrypted',
  category: 'blockchain-digital-asset',
  description:
    'Detects cryptocurrency wallet backup files stored without encryption, exposing private keys to theft and future quantum decryption.',
  targetAlgorithms: ['ECC-secp256k1', 'ECDSA-P256', 'RSA-2048'],
  riskScore: 870,
  severity: 'critical',
  quantumThreat: 'shor',
  recommendation:
    'Encrypt all wallet backups with AES-256-GCM using a strong passphrase-derived key (Argon2). Store backups in secure, offline locations.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, [
        'wallet backup',
        'unencrypted backup',
        'backup file',
        'wallet file',
        'keystore unencrypted',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule34: DetectionRule = {
  id: 'QG-CHAIN-034',
  name: 'Exchanges Using Weak TLS',
  category: 'blockchain-digital-asset',
  description:
    'Detects cryptocurrency exchanges using weak TLS configurations, exposing trading and wallet operations to interception and quantum harvest attacks.',
  targetAlgorithms: ['TLS-1.0', 'TLS-1.1', 'RSA-1024', 'RSA-2048'],
  riskScore: 740,
  severity: 'high',
  quantumThreat: 'both',
  recommendation:
    'Enforce TLS 1.3 with strong cipher suites on all exchange endpoints. Disable legacy TLS versions and plan for PQC TLS integration.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'exchange',
        'trading',
        'crypto exchange',
        'defi',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule35: DetectionRule = {
  id: 'QG-CHAIN-035',
  name: 'Smart Contracts Using Weak Signature Verification',
  category: 'blockchain-digital-asset',
  description:
    'Detects smart contracts relying on ECDSA signature verification without considering quantum vulnerability of the underlying curve.',
  targetAlgorithms: ['ECC-secp256k1', 'ECDSA-P256'],
  riskScore: 800,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Audit smart contracts for signature verification patterns. Implement upgrade paths for PQC signature schemes and consider time-locked migration mechanisms.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'smart contract',
        'solidity',
        'contract',
        'on-chain verification',
        'ecrecover',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

// ---------------------------------------------------------------------------
// Cloud & API Security Rules (36-40)
// ---------------------------------------------------------------------------

const rule36: DetectionRule = {
  id: 'QG-CLOUD-036',
  name: 'APIs Using RSA Token Signatures',
  category: 'cloud-api-security',
  description:
    'Detects API authentication systems using RSA-based token signatures (RS256), which are vulnerable to quantum factorisation via Shor\'s algorithm.',
  targetAlgorithms: ['RSA-2048', 'RSA-4096'],
  riskScore: 720,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Migrate API token signing from RSA to ECDSA (ES256) as an interim measure. Plan migration to PQC signature algorithms (ML-DSA) for long-term security.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'api',
        'token signature',
        'rs256',
        'api auth',
        'api token',
        'bearer',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule37: DetectionRule = {
  id: 'QG-CLOUD-037',
  name: 'OAuth Tokens Without Signature Validation',
  category: 'cloud-api-security',
  description:
    'Detects OAuth implementations that do not properly validate token signatures, allowing forged tokens and bypassing authentication.',
  targetAlgorithms: ['RSA-2048', 'ECC-P256', 'SHA-256'],
  riskScore: 760,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Enforce strict signature validation for all OAuth tokens. Verify algorithm headers, reject unsigned tokens, and validate against the issuer\'s JWKS endpoint.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, [
        'oauth',
        'openid',
        'oidc',
        'authorization server',
      ])
    )
      return null
    if (
      contextContainsAny(finding, [
        'no validation',
        'missing validation',
        'signature not verified',
        'unsigned token',
        'weak validation',
      ])
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule38: DetectionRule = {
  id: 'QG-CLOUD-038',
  name: 'Cloud Storage Encryption Using Legacy RSA',
  category: 'cloud-api-security',
  description:
    'Detects cloud storage services using legacy RSA encryption for data-at-rest or data-in-transit protection, exposing stored data to future quantum decryption.',
  targetAlgorithms: ['RSA-1024', 'RSA-2048'],
  riskScore: 730,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Migrate cloud storage encryption to AES-256-GCM for data-at-rest. Use hybrid PQC key encapsulation for key wrapping and data-in-transit protection.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (!algorithmMatches(finding, this.targetAlgorithms)) return null
    if (
      !contextContainsAny(finding, [
        'cloud storage',
        's3',
        'azure blob',
        'gcs',
        'cloud encrypt',
        'storage encryption',
        'data at rest',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

const rule39: DetectionRule = {
  id: 'QG-CLOUD-039',
  name: 'JWT Tokens Signed with Weak Curves',
  category: 'cloud-api-security',
  description:
    'Detects JWT tokens signed using ECDSA with weak elliptic curves that provide insufficient security margins against quantum attacks.',
  targetAlgorithms: ['ECC-P256', 'ECDSA-P256'],
  riskScore: 710,
  severity: 'high',
  quantumThreat: 'shor',
  recommendation:
    'Use ECDSA with P-384 or Ed25519 for JWT signing as a minimum. Plan migration to PQC-based token signing when library support is available.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, ['jwt', 'json web token', 'bearer'])
    )
      return null
    if (
      algorithmMatches(finding, this.targetAlgorithms) ||
      contextContainsAny(finding, [
        'weak curve',
        'es256',
        'p-256 jwt',
      ])
    )
      return buildResult(this, finding, this.recommendation)
    return null
  },
}

const rule40: DetectionRule = {
  id: 'QG-CLOUD-040',
  name: 'Cloud Services Without Key Rotation Policies',
  category: 'cloud-api-security',
  description:
    'Detects cloud services and API integrations without automatic key rotation policies, increasing exposure to both classical and quantum attacks over time.',
  targetAlgorithms: [
    'RSA-2048', 'RSA-4096', 'AES-128', 'AES-256', 'ECC-P256', 'ECC-P384',
  ],
  riskScore: 680,
  severity: 'moderate',
  quantumThreat: 'both',
  recommendation:
    'Implement automatic key rotation policies for all cloud services. Use cloud-native KMS with rotation schedules (90 days max) and audit key usage regularly.',
  evaluate(finding: ScanFinding): DetectionRuleResult | null {
    if (
      !contextContainsAny(finding, [
        'cloud',
        'aws',
        'azure',
        'gcp',
        'api key',
        'service account',
      ])
    )
      return null
    if (
      !contextContainsAny(finding, [
        'no rotation',
        'no key rotation',
        'rotation policy',
        'stale key',
        'key age',
        'never rotated',
      ])
    )
      return null
    return buildResult(this, finding, this.recommendation)
  },
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const DETECTION_RULES: DetectionRule[] = [
  rule01,
  rule02,
  rule03,
  rule04,
  rule05,
  rule06,
  rule07,
  rule08,
  rule09,
  rule10,
  rule11,
  rule12,
  rule13,
  rule14,
  rule15,
  rule16,
  rule17,
  rule18,
  rule19,
  rule20,
  rule21,
  rule22,
  rule23,
  rule24,
  rule25,
  rule26,
  rule27,
  rule28,
  rule29,
  rule30,
  rule31,
  rule32,
  rule33,
  rule34,
  rule35,
  rule36,
  rule37,
  rule38,
  rule39,
  rule40,
]

/**
 * Evaluates all detection rules against a list of scan findings.
 * Returns all matched rule results across all findings.
 */
export function evaluateFindings(findings: ScanFinding[]): DetectionRuleResult[] {
  const results: DetectionRuleResult[] = []

  for (const finding of findings) {
    for (const rule of DETECTION_RULES) {
      const result = rule.evaluate(finding)
      if (result !== null) {
        results.push(result)
      }
    }
  }

  return results
}

/**
 * Returns all detection rules belonging to a specific category.
 */
export function getRulesByCategory(
  category: DetectionRuleCategory
): DetectionRule[] {
  return DETECTION_RULES.filter((rule) => rule.category === category)
}

/**
 * Returns a single detection rule by its ID, or undefined if not found.
 */
export function getRuleById(id: string): DetectionRule | undefined {
  return DETECTION_RULES.find((rule) => rule.id === id)
}
