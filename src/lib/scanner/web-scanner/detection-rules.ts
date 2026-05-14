/**
 * QGuard Web Scanner — Quantum Vulnerability Detection Rules Engine
 * 40+ rules for detecting quantum-vulnerable configurations
 */

import type {
  DetectionRule,
  DetectionContext,
  DetectionRuleResult,
  DetectionRuleCategory,
  ThreatLevel,
} from './types'

// ─── Detection Rules Database ───────────────────────────────────────────────

export const DETECTION_RULES: DetectionRule[] = [
  // ── Certificate Risks (8 rules) ───────────────────────────────────────────

  {
    id: 'CERT-001',
    name: 'RSA-1024 Certificate Detected',
    category: 'certificate-risk',
    severity: 'CRITICAL',
    description: 'RSA-1024 certificate key — breakable in minutes by quantum computer',
    remediation: 'Immediately replace with ML-KEM-768 hybrid certificate or minimum RSA-4096',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      if (cert.publicKeyAlgorithm.includes('RSA') && cert.publicKeySize <= 1024) {
        return makeResult('CERT-001', 'RSA-1024 Certificate Detected', 'certificate-risk', 'CRITICAL',
          `Certificate uses RSA-${cert.publicKeySize} — breakable in minutes by CRQC`,
          'Immediately replace with ML-KEM-768 hybrid certificate')
      }
      return null
    },
  },
  {
    id: 'CERT-002',
    name: 'RSA-2048 Certificate Detected',
    category: 'certificate-risk',
    severity: 'HIGH',
    description: 'RSA-2048 certificate — vulnerable to Shor\'s algorithm',
    remediation: 'Migrate to ML-KEM-768 hybrid TLS or post-quantum certificate',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      if (cert.publicKeyAlgorithm.includes('RSA') && cert.publicKeySize === 2048) {
        return makeResult('CERT-002', 'RSA-2048 Certificate Detected', 'certificate-risk', 'HIGH',
          'Certificate uses RSA-2048 — will be broken by quantum computers (hours on CRQC)',
          'Deploy hybrid ML-KEM-768 + RSA certificate for post-quantum transition')
      }
      return null
    },
  },
  {
    id: 'CERT-003',
    name: 'ECDSA Certificate Detected',
    category: 'certificate-risk',
    severity: 'HIGH',
    description: 'ECDSA certificate — ECC is vulnerable to Shor\'s algorithm',
    remediation: 'Migrate to ML-DSA (Dilithium) certificate signatures',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      if (cert.publicKeyAlgorithm.includes('EC') || cert.publicKeyAlgorithm.includes('ECDSA')) {
        return makeResult('CERT-003', 'ECDSA Certificate Detected', 'certificate-risk', 'HIGH',
          `Certificate uses ${cert.publicKeyAlgorithm} — breakable by Shor\'s algorithm on ECDLP`,
          'Migrate to ML-DSA-65 (Dilithium) certificate signatures')
      }
      return null
    },
  },
  {
    id: 'CERT-004',
    name: 'SHA-1 Certificate Signature',
    category: 'certificate-risk',
    severity: 'CRITICAL',
    description: 'SHA-1 certificate signature — classically broken hash algorithm',
    remediation: 'Replace certificate with SHA-256 or SHA-384 signed certificate immediately',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      if (cert.signatureAlgorithm.toLowerCase().includes('sha1') || cert.signatureAlgorithm.toLowerCase().includes('sha-1')) {
        return makeResult('CERT-004', 'SHA-1 Certificate Signature', 'certificate-risk', 'CRITICAL',
          'Certificate signed with SHA-1 — collision attacks are practical',
          'Replace certificate with SHA-256 or SHA-384 signed certificate immediately')
      }
      return null
    },
  },
  {
    id: 'CERT-005',
    name: 'Expired Certificate',
    category: 'certificate-risk',
    severity: 'CRITICAL',
    description: 'Certificate has expired',
    remediation: 'Renew certificate immediately with PQC-ready CA',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      if (cert.isExpired) {
        return makeResult('CERT-005', 'Expired Certificate', 'certificate-risk', 'CRITICAL',
          `Certificate expired on ${cert.validTo}`,
          'Renew certificate immediately — consider PQC-ready certificate authority')
      }
      return null
    },
  },
  {
    id: 'CERT-006',
    name: 'Self-Signed Certificate',
    category: 'certificate-risk',
    severity: 'MEDIUM',
    description: 'Self-signed certificate — no trusted CA chain',
    remediation: 'Use a certificate from a trusted CA with PQC readiness',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      if (cert.isSelfSigned) {
        return makeResult('CERT-006', 'Self-Signed Certificate', 'certificate-risk', 'MEDIUM',
          'Certificate is self-signed — no trusted certificate authority chain',
          'Obtain certificate from a trusted CA with PQC migration roadmap')
      }
      return null
    },
  },
  {
    id: 'CERT-007',
    name: 'Weak Certificate Key Size',
    category: 'certificate-risk',
    severity: 'HIGH',
    description: 'Certificate key size below recommended minimum',
    remediation: 'Use minimum RSA-4096 or migrate to PQC algorithms',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      if (cert.publicKeyAlgorithm.includes('RSA') && cert.publicKeySize > 1024 && cert.publicKeySize < 4096) {
        return makeResult('CERT-007', 'Weak RSA Key Size', 'certificate-risk', 'HIGH',
          `RSA-${cert.publicKeySize} provides inadequate quantum security margin`,
          'Minimum RSA-4096 for classical security, or migrate to ML-KEM for quantum safety')
      }
      return null
    },
  },
  {
    id: 'CERT-008',
    name: 'Quantum-Vulnerable OIDs Detected',
    category: 'certificate-risk',
    severity: 'HIGH',
    description: 'Certificate contains OIDs for quantum-vulnerable algorithms',
    remediation: 'Replace certificate with PQC algorithm certificates',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      const vulnOids = cert.detectedOids.filter(o => o.quantumVulnerable)
      if (vulnOids.length > 0) {
        const oidNames = vulnOids.map(o => o.name).join(', ')
        return makeResult('CERT-008', 'Quantum-Vulnerable OIDs', 'certificate-risk', 'HIGH',
          `Certificate contains quantum-vulnerable OIDs: ${oidNames}`,
          'Transition to certificates using PQC algorithms (ML-DSA, ML-KEM)')
      }
      return null
    },
  },

  // ── TLS Configuration Rules (8 rules) ─────────────────────────────────────

  {
    id: 'TLS-001',
    name: 'TLS Version Below 1.3',
    category: 'tls-config',
    severity: 'MEDIUM',
    description: 'TLS version below 1.3 does not support PQC cipher suites',
    remediation: 'Upgrade to TLS 1.3 and enable PQC hybrid key exchange',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      const version = tls.tlsVersion
      if (version && !version.includes('1.3')) {
        return makeResult('TLS-001', 'TLS Version Below 1.3', 'tls-config', 'MEDIUM',
          `Server negotiated ${version} — lacks post-quantum cipher suite support`,
          'Enforce TLS 1.3 minimum and enable PQC hybrid key exchange suites')
      }
      return null
    },
  },
  {
    id: 'TLS-002',
    name: 'RSA Key Exchange Detected',
    category: 'tls-config',
    severity: 'CRITICAL',
    description: 'RSA key exchange provides no forward secrecy and is quantum-vulnerable',
    remediation: 'Disable RSA key exchange — use ECDHE or ML-KEM hybrid',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      if (tls.cipherSuite.includes('TLS_RSA_WITH') || (tls.keyExchange === 'RSA' && !tls.keyExchange.includes('ECDHE'))) {
        return makeResult('TLS-002', 'RSA Key Exchange', 'tls-config', 'CRITICAL',
          'RSA key exchange detected — no forward secrecy + quantum-vulnerable',
          'Disable RSA key exchange, enable ECDHE or ML-KEM hybrid key exchange')
      }
      return null
    },
  },
  {
    id: 'TLS-003',
    name: 'ECDHE Key Exchange Detected',
    category: 'tls-config',
    severity: 'HIGH',
    description: 'ECDHE key exchange is quantum-vulnerable via Shor\'s algorithm',
    remediation: 'Enable X25519Kyber768 hybrid key exchange',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      if (tls.keyExchange.includes('ECDHE') || tls.keyExchange.includes('ECDH')) {
        return makeResult('TLS-003', 'ECDHE Key Exchange', 'tls-config', 'HIGH',
          `ECDHE key exchange detected (${tls.keyExchange}) — quantum-vulnerable via Shor\'s`,
          'Enable X25519Kyber768 hybrid key exchange for quantum resistance')
      }
      return null
    },
  },
  {
    id: 'TLS-004',
    name: 'Weak Diffie-Hellman Parameters',
    category: 'tls-config',
    severity: 'HIGH',
    description: 'DHE key exchange with small parameters is quantum-vulnerable',
    remediation: 'Use minimum 4096-bit DH groups or migrate to ML-KEM',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      if (tls.keyExchange.includes('DHE') && tls.ephemeralKeySize && tls.ephemeralKeySize < 4096) {
        return makeResult('TLS-004', 'Weak DH Parameters', 'tls-config', 'HIGH',
          `DHE key exchange with ${tls.ephemeralKeySize}-bit parameters — quantum-vulnerable`,
          'Use minimum 4096-bit DH groups or migrate to ML-KEM key exchange')
      }
      return null
    },
  },
  {
    id: 'TLS-005',
    name: 'Legacy Cipher Suite Detected',
    category: 'tls-config',
    severity: 'HIGH',
    description: 'Legacy cipher suite with CBC mode or SHA-1 MAC',
    remediation: 'Disable legacy cipher suites — use only AEAD cipher suites',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      if (tls.cipherSuite.includes('CBC') || (tls.cipherSuite.includes('SHA') && !tls.cipherSuite.includes('SHA256') && !tls.cipherSuite.includes('SHA384'))) {
        return makeResult('TLS-005', 'Legacy Cipher Suite', 'tls-config', 'HIGH',
          `Legacy cipher suite detected: ${tls.cipherSuite}`,
          'Disable CBC and SHA-1 cipher suites — use only AEAD (GCM/ChaCha20) suites')
      }
      return null
    },
  },
  {
    id: 'TLS-006',
    name: 'Missing Forward Secrecy',
    category: 'tls-config',
    severity: 'CRITICAL',
    description: 'Cipher suite does not provide forward secrecy',
    remediation: 'Enable ephemeral key exchange (ECDHE/DHE/ML-KEM)',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      if (!tls.keyExchange.includes('ECDHE') && !tls.keyExchange.includes('DHE') && !tls.keyExchange.includes('negotiated')) {
        return makeResult('TLS-006', 'No Forward Secrecy', 'tls-config', 'CRITICAL',
          'No ephemeral key exchange — past traffic can be decrypted if private key is compromised',
          'Enable ECDHE or DHE key exchange, then migrate to ML-KEM hybrid')
      }
      return null
    },
  },
  {
    id: 'TLS-007',
    name: 'Missing HSTS Header',
    category: 'tls-config',
    severity: 'MEDIUM',
    description: 'Strict-Transport-Security header not detected',
    remediation: 'Enable HSTS with includeSubDomains and preload directives',
    evaluate: (ctx) => {
      const api = ctx.apiResult
      if (!api) return null
      const hsts = api.securityHeaders.find(h => h.name === 'strict-transport-security')
      if (hsts && !hsts.present) {
        return makeResult('TLS-007', 'Missing HSTS', 'tls-config', 'MEDIUM',
          'Strict-Transport-Security header missing — increases downgrade attack surface',
          'Enable HSTS with includeSubDomains, preload, and min 1-year max-age')
      }
      return null
    },
  },
  {
    id: 'TLS-008',
    name: 'TLS 1.0/1.1 Detected',
    category: 'tls-config',
    severity: 'CRITICAL',
    description: 'TLS 1.0 or 1.1 is deprecated and insecure',
    remediation: 'Disable TLS 1.0/1.1 immediately — enforce TLS 1.2+ minimum',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      if (tls.tlsVersion === 'TLSv1' || tls.tlsVersion === 'TLSv1.1') {
        return makeResult('TLS-008', 'Deprecated TLS Version', 'tls-config', 'CRITICAL',
          `${tls.tlsVersion} detected — deprecated, classically insecure`,
          'Disable TLS 1.0/1.1 immediately and enforce TLS 1.3')
      }
      return null
    },
  },

  // ── Hashing Risks (4 rules) ───────────────────────────────────────────────

  {
    id: 'HASH-001',
    name: 'MD5 Usage Detected',
    category: 'hashing',
    severity: 'HIGH',
    description: 'MD5 hash is classically broken',
    remediation: 'Replace MD5 with SHA-256 or SHA-3',
    evaluate: (ctx) => {
      const hasMd5 = ctx.findings.some(f => f.algorithm.includes('MD5'))
        || ctx.repoResult?.patterns.some(p => p.algorithm.includes('MD5'))
      if (hasMd5) {
        return makeResult('HASH-001', 'MD5 Usage', 'hashing', 'HIGH',
          'MD5 hash algorithm detected — trivial collision attacks possible',
          'Replace all MD5 usage with SHA-256 or SHA-3-256')
      }
      return null
    },
  },
  {
    id: 'HASH-002',
    name: 'SHA-1 Usage Detected',
    category: 'hashing',
    severity: 'HIGH',
    description: 'SHA-1 hash is classically broken',
    remediation: 'Replace SHA-1 with SHA-256 or SHA-3',
    evaluate: (ctx) => {
      const hasSha1 = ctx.findings.some(f => f.algorithm.includes('SHA-1') || f.algorithm.includes('SHA1'))
        || ctx.repoResult?.patterns.some(p => p.algorithm.includes('SHA-1') || p.algorithm.includes('SHA1'))
        || ctx.certInfo?.signatureAlgorithm.toLowerCase().includes('sha1')
      if (hasSha1) {
        return makeResult('HASH-002', 'SHA-1 Usage', 'hashing', 'HIGH',
          'SHA-1 hash algorithm detected — collision attacks demonstrated in practice',
          'Replace all SHA-1 usage with SHA-256 or SHA-3-256')
      }
      return null
    },
  },
  {
    id: 'HASH-003',
    name: 'Deprecated Hash in Certificate',
    category: 'hashing',
    severity: 'CRITICAL',
    description: 'Certificate uses deprecated hash algorithm',
    remediation: 'Reissue certificate with SHA-256 or stronger',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      const sig = cert.signatureAlgorithm.toLowerCase()
      if (sig.includes('md5') || sig.includes('md2') || sig.includes('md4')) {
        return makeResult('HASH-003', 'Deprecated Hash in Certificate', 'hashing', 'CRITICAL',
          `Certificate signed with deprecated hash: ${cert.signatureAlgorithm}`,
          'Reissue certificate with SHA-256 or SHA-384 signature')
      }
      return null
    },
  },
  {
    id: 'HASH-004',
    name: 'Weak Hash in Source Code',
    category: 'hashing',
    severity: 'MEDIUM',
    description: 'Weak hash algorithm found in source code',
    remediation: 'Replace with SHA-256 or SHA-3',
    evaluate: (ctx) => {
      const weakHashPatterns = ctx.repoResult?.patterns.filter(p => p.category === 'Hash') || []
      if (weakHashPatterns.length > 0) {
        return makeResult('HASH-004', 'Weak Hash in Code', 'hashing', 'MEDIUM',
          `${weakHashPatterns.length} weak hash pattern(s) detected in source code`,
          'Audit and replace weak hash algorithms with SHA-256 or SHA-3')
      }
      return null
    },
  },

  // ── Application Crypto Risks (8 rules) ────────────────────────────────────

  {
    id: 'APP-001',
    name: 'RSA in Client-Side Code',
    category: 'app-crypto',
    severity: 'CRITICAL',
    description: 'RSA cryptography detected in browser/client JavaScript',
    remediation: 'Migrate client-side crypto to PQC algorithms or server-side operations',
    evaluate: (ctx) => {
      const webRsa = ctx.webCryptoResult?.patterns.filter(p => p.category === 'RSA') || []
      if (webRsa.length > 0) {
        return makeResult('APP-001', 'RSA in Client Code', 'app-crypto', 'CRITICAL',
          `${webRsa.length} RSA usage(s) detected in client-side JavaScript`,
          'Move cryptographic operations server-side or migrate to PQC algorithms')
      }
      return null
    },
  },
  {
    id: 'APP-002',
    name: 'Weak JWT Signing Algorithm',
    category: 'app-crypto',
    severity: 'HIGH',
    description: 'JWT signed with quantum-vulnerable algorithm (RS256, ES256)',
    remediation: 'Migrate JWT signing to ML-DSA or hybrid algorithm',
    evaluate: (ctx) => {
      const jwtFindings = [
        ...(ctx.repoResult?.patterns.filter(p => p.category === 'JWT') || []),
        ...(ctx.webCryptoResult?.patterns.filter(p => p.category === 'JWT') || []),
        ...(ctx.apiResult?.apiFindings.filter(f => f.findingType.includes('JWT')) || []),
      ]
      if (jwtFindings.length > 0) {
        return makeResult('APP-002', 'Weak JWT Algorithm', 'app-crypto', 'HIGH',
          `JWT with quantum-vulnerable signing detected (${jwtFindings.length} instance(s))`,
          'Migrate JWT signing to ML-DSA (Dilithium) or hybrid ML-DSA + ECDSA')
      }
      return null
    },
  },
  {
    id: 'APP-003',
    name: 'Hardcoded Private Key',
    category: 'app-crypto',
    severity: 'CRITICAL',
    description: 'Private key material found in source code',
    remediation: 'Remove all private keys from source code — use secrets manager',
    evaluate: (ctx) => {
      const keyFindings = ctx.repoResult?.patterns.filter(p =>
        p.category === 'Key Management' || p.algorithm.includes('Private Key')
      ) || []
      if (keyFindings.length > 0) {
        return makeResult('APP-003', 'Hardcoded Private Key', 'app-crypto', 'CRITICAL',
          `${keyFindings.length} private key(s) detected in source code`,
          'Immediately rotate and remove all private keys from source — use a PQC-encrypted secrets manager')
      }
      return null
    },
  },
  {
    id: 'APP-004',
    name: 'RSA in Source Code',
    category: 'app-crypto',
    severity: 'HIGH',
    description: 'RSA implementations detected in repository code',
    remediation: 'Migrate RSA usage to ML-KEM for encryption, ML-DSA for signatures',
    evaluate: (ctx) => {
      const rsaFindings = ctx.repoResult?.patterns.filter(p => p.category === 'RSA') || []
      if (rsaFindings.length > 0) {
        return makeResult('APP-004', 'RSA in Source Code', 'app-crypto', 'HIGH',
          `${rsaFindings.length} RSA implementation(s) detected in source code`,
          'Migrate RSA to ML-KEM (key exchange) or ML-DSA (signatures)')
      }
      return null
    },
  },
  {
    id: 'APP-005',
    name: 'ECDSA/ECC in Source Code',
    category: 'app-crypto',
    severity: 'HIGH',
    description: 'ECC-based cryptography detected in source code',
    remediation: 'Migrate ECC usage to ML-DSA or ML-KEM',
    evaluate: (ctx) => {
      const eccFindings = ctx.repoResult?.patterns.filter(p => p.category === 'ECC') || []
      if (eccFindings.length > 0) {
        return makeResult('APP-005', 'ECC in Source Code', 'app-crypto', 'HIGH',
          `${eccFindings.length} ECC/ECDSA implementation(s) detected in source code`,
          'Migrate ECDSA to ML-DSA (Dilithium) for digital signatures')
      }
      return null
    },
  },
  {
    id: 'APP-006',
    name: 'Blockchain Wallet Key Pattern',
    category: 'app-crypto',
    severity: 'CRITICAL',
    description: 'Potential blockchain wallet private key detected',
    remediation: 'Rotate wallet keys immediately — use hardware wallet with PQC support',
    evaluate: (ctx) => {
      const walletFindings = ctx.repoResult?.patterns.filter(p =>
        p.category === 'Blockchain' || p.algorithm.includes('secp256k1')
      ) || []
      if (walletFindings.length > 0) {
        return makeResult('APP-006', 'Blockchain Key Exposure', 'app-crypto', 'CRITICAL',
          `${walletFindings.length} potential blockchain wallet key(s) detected`,
          'Rotate all wallet keys — migrate to quantum-resistant signature scheme')
      }
      return null
    },
  },
  {
    id: 'APP-007',
    name: 'Diffie-Hellman in Source Code',
    category: 'app-crypto',
    severity: 'HIGH',
    description: 'Diffie-Hellman key exchange detected in source code',
    remediation: 'Migrate to ML-KEM key encapsulation',
    evaluate: (ctx) => {
      const dhFindings = ctx.repoResult?.patterns.filter(p => p.category === 'Key Exchange') || []
      if (dhFindings.length > 0) {
        return makeResult('APP-007', 'DH in Source Code', 'app-crypto', 'HIGH',
          `${dhFindings.length} Diffie-Hellman implementation(s) detected`,
          'Migrate from DH key exchange to ML-KEM-768 key encapsulation')
      }
      return null
    },
  },
  {
    id: 'APP-008',
    name: 'Client-Side Crypto Library',
    category: 'app-crypto',
    severity: 'MEDIUM',
    description: 'Third-party crypto library detected in client code',
    remediation: 'Audit library for quantum-vulnerable algorithm usage',
    evaluate: (ctx) => {
      const libFindings = ctx.webCryptoResult?.patterns.filter(p => p.category === 'Library') || []
      if (libFindings.length > 0) {
        return makeResult('APP-008', 'Client Crypto Library', 'app-crypto', 'MEDIUM',
          `${libFindings.length} crypto library usage(s) detected in client-side code`,
          'Audit libraries for quantum-vulnerable algorithms and plan migration')
      }
      return null
    },
  },

  // ── PQC Readiness Rules (6 rules) ─────────────────────────────────────────

  {
    id: 'PQC-001',
    name: 'No PQC Cipher Suites',
    category: 'pqc-readiness',
    severity: 'HIGH',
    description: 'No post-quantum cipher suites detected',
    remediation: 'Enable PQC hybrid cipher suites (X25519Kyber768)',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      const hasPqc = tls.cipherSuite.includes('Kyber') || tls.cipherSuite.includes('ML-KEM')
      if (!hasPqc) {
        return makeResult('PQC-001', 'No PQC Cipher Suites', 'pqc-readiness', 'HIGH',
          'No post-quantum cipher suites detected in TLS configuration',
          'Enable hybrid PQC cipher suites: X25519Kyber768 + TLS 1.3')
      }
      return null
    },
  },
  {
    id: 'PQC-002',
    name: 'No Hybrid TLS Support',
    category: 'pqc-readiness',
    severity: 'HIGH',
    description: 'Server does not support hybrid classical + PQC key exchange',
    remediation: 'Deploy hybrid TLS configuration with ML-KEM + X25519',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      const hasHybrid = tls.keyExchange.includes('Kyber') || tls.keyExchange.includes('ML-KEM')
      if (!hasHybrid) {
        return makeResult('PQC-002', 'No Hybrid TLS', 'pqc-readiness', 'HIGH',
          'No hybrid (classical + PQC) key exchange support detected',
          'Deploy hybrid TLS: ML-KEM-768 + X25519 for backward-compatible quantum safety')
      }
      return null
    },
  },
  {
    id: 'PQC-003',
    name: 'No ML-KEM Support',
    category: 'pqc-readiness',
    severity: 'MEDIUM',
    description: 'ML-KEM (Kyber) key encapsulation not supported',
    remediation: 'Enable ML-KEM-768 in TLS configuration',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      return makeResult('PQC-003', 'No ML-KEM Support', 'pqc-readiness', 'MEDIUM',
        'ML-KEM (Kyber) key encapsulation not detected — server is not PQC-ready',
        'Enable ML-KEM-768 (FIPS 203) in server TLS configuration')
    },
  },
  {
    id: 'PQC-004',
    name: 'No PQC Certificate',
    category: 'pqc-readiness',
    severity: 'MEDIUM',
    description: 'Certificate does not use post-quantum algorithms',
    remediation: 'Obtain certificate with ML-DSA signatures when CA support is available',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      const hasPqcOid = cert.detectedOids.some(o => o.category === 'pqc')
      if (!hasPqcOid) {
        return makeResult('PQC-004', 'No PQC Certificate', 'pqc-readiness', 'MEDIUM',
          'Certificate does not use PQC algorithms — uses classical cryptography only',
          'Prepare for PQC certificate transition — monitor CA PQC readiness')
      }
      return null
    },
  },
  {
    id: 'PQC-005',
    name: 'No PQC Library in Code',
    category: 'pqc-readiness',
    severity: 'LOW',
    description: 'No post-quantum crypto library detected in source code',
    remediation: 'Evaluate PQC libraries (liboqs, @noble/post-quantum) for integration',
    evaluate: (ctx) => {
      if (!ctx.repoResult) return null
      const pqcPatterns = ['ML-KEM', 'ML-DSA', 'Kyber', 'Dilithium', 'SPHINCS', 'liboqs', 'post-quantum']
      const hasPqcLib = ctx.repoResult.patterns.some(p =>
        pqcPatterns.some(pqc => p.algorithm.includes(pqc) || p.snippet.includes(pqc))
      )
      if (!hasPqcLib) {
        return makeResult('PQC-005', 'No PQC Library', 'pqc-readiness', 'LOW',
          'No post-quantum cryptography library detected in repository',
          'Evaluate @noble/post-quantum or liboqs for PQC integration')
      }
      return null
    },
  },
  {
    id: 'PQC-006',
    name: 'Missing PQC Migration Strategy',
    category: 'pqc-readiness',
    severity: 'MEDIUM',
    description: 'No evidence of PQC migration planning',
    remediation: 'Develop a PQC migration roadmap aligned with NIST standards',
    evaluate: (ctx) => {
      // This rule triggers when quantum-vulnerable algorithms are found but no PQC indicators exist
      const hasVulnAlgs = ctx.findings.some(f => f.threatLevel === 'CRITICAL' || f.threatLevel === 'HIGH')
      const hasPqcIndicators = ctx.findings.some(f =>
        f.algorithm.includes('ML-KEM') || f.algorithm.includes('ML-DSA') || f.algorithm.includes('Kyber')
      )
      if (hasVulnAlgs && !hasPqcIndicators) {
        return makeResult('PQC-006', 'No PQC Migration Strategy', 'pqc-readiness', 'MEDIUM',
          'Quantum-vulnerable algorithms detected with no PQC migration indicators',
          'Develop a PQC migration roadmap: inventory crypto → prioritize → test PQC → deploy hybrid')
      }
      return null
    },
  },

  // ── Long-Term Quantum Risk (6 rules) ──────────────────────────────────────

  {
    id: 'HNDL-001',
    name: 'Harvest-Now-Decrypt-Later Exposure',
    category: 'long-term-quantum-risk',
    severity: 'HIGH',
    description: 'Encrypted traffic can be recorded now and decrypted by future quantum computers',
    remediation: 'Enable hybrid PQC encryption for all sensitive data in transit',
    evaluate: (ctx) => {
      const tls = ctx.tlsResult
      if (!tls) return null
      // HNDL applies when key exchange is quantum-vulnerable
      if (tls.keyExchange.includes('ECDHE') || tls.keyExchange.includes('DHE') || tls.keyExchange.includes('RSA')) {
        const hasHybrid = tls.keyExchange.includes('Kyber') || tls.keyExchange.includes('ML-KEM')
        if (!hasHybrid) {
          return makeResult('HNDL-001', 'HNDL Exposure', 'long-term-quantum-risk', 'HIGH',
            'Traffic encrypted with quantum-vulnerable key exchange — harvest-now-decrypt-later risk',
            'Deploy hybrid PQC key exchange immediately for data with long-term confidentiality needs')
        }
      }
      return null
    },
  },
  {
    id: 'HNDL-002',
    name: 'Long-Term Data at Risk',
    category: 'long-term-quantum-risk',
    severity: 'HIGH',
    description: 'Data with long-term confidentiality needs protected by quantum-vulnerable crypto',
    remediation: 'Implement hybrid encryption for long-term data protection',
    evaluate: (ctx) => {
      const critFindings = ctx.findings.filter(f => f.threatLevel === 'CRITICAL')
      if (critFindings.length >= 2) {
        return makeResult('HNDL-002', 'Long-Term Data Risk', 'long-term-quantum-risk', 'HIGH',
          `${critFindings.length} critical quantum vulnerabilities — high HNDL risk for sensitive data`,
          'Prioritize hybrid PQC deployment for systems handling sensitive or regulated data')
      }
      return null
    },
  },
  {
    id: 'HNDL-003',
    name: 'No Hybrid Cryptography',
    category: 'long-term-quantum-risk',
    severity: 'MEDIUM',
    description: 'System uses only classical cryptography with no hybrid PQC protection',
    remediation: 'Implement hybrid classical + PQC cryptography',
    evaluate: (ctx) => {
      const allClassical = ctx.findings.every(f =>
        !f.algorithm.includes('ML-KEM') && !f.algorithm.includes('Kyber') && !f.algorithm.includes('ML-DSA')
      )
      if (allClassical && ctx.findings.length > 0) {
        return makeResult('HNDL-003', 'No Hybrid Crypto', 'long-term-quantum-risk', 'MEDIUM',
          'System relies exclusively on classical cryptography — no quantum protection layer',
          'Implement hybrid crypto: ML-KEM + X25519 for key exchange, ML-DSA + ECDSA for signatures')
      }
      return null
    },
  },
  {
    id: 'HNDL-004',
    name: 'Certificate Long Validity Period',
    category: 'long-term-quantum-risk',
    severity: 'MEDIUM',
    description: 'Certificate with long validity increases quantum risk window',
    remediation: 'Reduce certificate validity and implement automated rotation',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert || !cert.validFrom || !cert.validTo) return null
      const from = new Date(cert.validFrom)
      const to = new Date(cert.validTo)
      const daysValid = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)
      if (daysValid > 398) { // > 13 months
        return makeResult('HNDL-004', 'Long Certificate Validity', 'long-term-quantum-risk', 'MEDIUM',
          `Certificate valid for ${Math.round(daysValid)} days — extended quantum risk window`,
          'Reduce certificate validity to 90 days with automated renewal')
      }
      return null
    },
  },
  {
    id: 'HNDL-005',
    name: 'Quantum Risk Regulatory Gap',
    category: 'long-term-quantum-risk',
    severity: 'LOW',
    description: 'System may not meet emerging quantum readiness regulations',
    remediation: 'Assess compliance with NIST PQC migration guidance and industry regulations',
    evaluate: (ctx) => {
      const hasHighRisk = ctx.findings.some(f => f.threatLevel === 'CRITICAL' || f.threatLevel === 'HIGH')
      if (hasHighRisk) {
        return makeResult('HNDL-005', 'Regulatory Compliance Gap', 'long-term-quantum-risk', 'LOW',
          'Quantum-vulnerable cryptography may conflict with emerging PQC compliance requirements',
          'Review NIST SP 800-208 and industry-specific quantum readiness regulations')
      }
      return null
    },
  },
  {
    id: 'HNDL-006',
    name: 'Missing Crypto Agility',
    category: 'long-term-quantum-risk',
    severity: 'MEDIUM',
    description: 'System does not demonstrate cryptographic agility for algorithm migration',
    remediation: 'Implement crypto-agile architecture for seamless algorithm transitions',
    evaluate: (ctx) => {
      // Check if the system has diverse algorithm usage suggesting non-agile architecture
      const algTypes = new Set(ctx.findings.map(f => f.category))
      if (algTypes.size > 3 && !ctx.findings.some(f => f.threatLevel === 'SAFE')) {
        return makeResult('HNDL-006', 'Missing Crypto Agility', 'long-term-quantum-risk', 'MEDIUM',
          `Multiple cryptographic dependencies (${algTypes.size} categories) without PQC readiness`,
          'Implement crypto-agile architecture: abstract algorithm choices behind configuration')
      }
      return null
    },
  },

  // ── Certificate Pinning & Transparency (2 rules) ────────────────────────

  {
    id: 'CERT-009',
    name: 'Missing Certificate Pinning',
    category: 'certificate-risk',
    severity: 'MEDIUM',
    description: 'No certificate pinning detected — increases risk of MitM with rogue certificates',
    remediation: 'Implement certificate pinning via public-key-pins or expect-ct headers',
    evaluate: (ctx) => {
      const api = ctx.apiResult
      if (!api) return null
      const hasHpkp = api.securityHeaders.some(h => h.name === 'public-key-pins' && h.present)
      const hasExpectCt = api.securityHeaders.some(h => h.name === 'expect-ct' && h.present)
      if (!hasHpkp && !hasExpectCt) {
        return makeResult('CERT-009', 'No Certificate Pinning', 'certificate-risk', 'MEDIUM',
          'No certificate pinning mechanism detected — increases HNDL attack surface via rogue certs',
          'Consider certificate transparency monitoring and key pinning strategies')
      }
      return null
    },
  },
  {
    id: 'CERT-010',
    name: 'RSA-4096 Certificate Detected',
    category: 'certificate-risk',
    severity: 'HIGH',
    description: 'RSA-4096 provides marginal quantum resistance improvement over RSA-2048',
    remediation: 'RSA-4096 is still quantum-vulnerable — migrate to ML-KEM/ML-DSA',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      if (cert.publicKeyAlgorithm.includes('RSA') && cert.publicKeySize >= 4096) {
        return makeResult('CERT-010', 'RSA-4096 Certificate', 'certificate-risk', 'HIGH',
          `RSA-${cert.publicKeySize} — larger key size does NOT protect against quantum computers`,
          'Migrate to ML-KEM-768 (FIPS 203) or ML-DSA-65 (FIPS 204) hybrid certificates')
      }
      return null
    },
  },

  // ── Security Header Advanced Rules (3 rules) ────────────────────────────

  {
    id: 'TLS-009',
    name: 'Missing Content Security Policy',
    category: 'tls-config',
    severity: 'MEDIUM',
    description: 'Content-Security-Policy header not detected',
    remediation: 'Implement CSP to prevent XSS and code injection attacks',
    evaluate: (ctx) => {
      const api = ctx.apiResult
      if (!api) return null
      const csp = api.securityHeaders.find(h => h.name === 'content-security-policy')
      if (csp && !csp.present) {
        return makeResult('TLS-009', 'Missing CSP', 'tls-config', 'MEDIUM',
          'Content-Security-Policy header missing — increases XSS and injection attack surface',
          'Deploy CSP with script-src, connect-src, and upgrade-insecure-requests directives')
      }
      return null
    },
  },
  {
    id: 'TLS-010',
    name: 'Missing X-Frame-Options',
    category: 'tls-config',
    severity: 'MEDIUM',
    description: 'X-Frame-Options header not detected — clickjacking risk',
    remediation: 'Set X-Frame-Options to DENY or SAMEORIGIN',
    evaluate: (ctx) => {
      const api = ctx.apiResult
      if (!api) return null
      const xfo = api.securityHeaders.find(h => h.name === 'x-frame-options')
      if (xfo && !xfo.present) {
        return makeResult('TLS-010', 'Missing X-Frame-Options', 'tls-config', 'MEDIUM',
          'X-Frame-Options header missing — vulnerable to clickjacking attacks',
          'Set X-Frame-Options to DENY or SAMEORIGIN')
      }
      return null
    },
  },
  {
    id: 'TLS-011',
    name: 'Weak HSTS Configuration',
    category: 'tls-config',
    severity: 'MEDIUM',
    description: 'HSTS max-age is below recommended minimum of 1 year',
    remediation: 'Set HSTS max-age to at least 31536000 (1 year) with includeSubDomains',
    evaluate: (ctx) => {
      const api = ctx.apiResult
      if (!api) return null
      const hsts = api.securityHeaders.find(h => h.name === 'strict-transport-security')
      if (hsts?.present && !hsts.secure) {
        return makeResult('TLS-011', 'Weak HSTS Config', 'tls-config', 'MEDIUM',
          'HSTS header present but max-age is below 1 year minimum — weak TLS enforcement',
          'Set max-age=31536000 with includeSubDomains and preload directives')
      }
      return null
    },
  },

  // ── Application Crypto Advanced Rules (4 rules) ─────────────────────────

  {
    id: 'APP-009',
    name: 'ECDH Key Exchange in Browser',
    category: 'app-crypto',
    severity: 'HIGH',
    description: 'ECDH key exchange detected in client-side code',
    remediation: 'Migrate browser key exchange to server-side PQC implementation',
    evaluate: (ctx) => {
      const eccWeb = ctx.webCryptoResult?.patterns.filter(p => p.category === 'ECC' && p.algorithm.includes('ECDH')) || []
      if (eccWeb.length > 0) {
        return makeResult('APP-009', 'ECDH in Browser', 'app-crypto', 'HIGH',
          `${eccWeb.length} ECDH key exchange(s) detected in client-side JavaScript`,
          'Move key exchange server-side and use ML-KEM for post-quantum key encapsulation')
      }
      return null
    },
  },
  {
    id: 'APP-010',
    name: 'Multiple Quantum-Vulnerable Algorithms',
    category: 'app-crypto',
    severity: 'HIGH',
    description: 'Multiple distinct quantum-vulnerable algorithm families detected',
    remediation: 'Develop comprehensive PQC migration plan covering all algorithm families',
    evaluate: (ctx) => {
      const vulnCategories = new Set<string>()
      for (const f of ctx.findings) {
        if (f.threatLevel === 'CRITICAL' || f.threatLevel === 'HIGH') {
          vulnCategories.add(f.category)
        }
      }
      if (vulnCategories.size >= 4) {
        return makeResult('APP-010', 'Wide Crypto Attack Surface', 'app-crypto', 'HIGH',
          `${vulnCategories.size} distinct quantum-vulnerable algorithm categories detected across the system`,
          'Develop a phased PQC migration plan addressing each algorithm family systematically')
      }
      return null
    },
  },
  {
    id: 'APP-011',
    name: 'Private Key in Client Code',
    category: 'app-crypto',
    severity: 'CRITICAL',
    description: 'Private key material found in client-facing code',
    remediation: 'Remove all private keys from client code immediately',
    evaluate: (ctx) => {
      const webKeys = ctx.webCryptoResult?.patterns.filter(p => p.category === 'Key Management') || []
      if (webKeys.length > 0) {
        return makeResult('APP-011', 'Client-Side Private Key', 'app-crypto', 'CRITICAL',
          `${webKeys.length} private key exposure(s) detected in client-side code — critical security risk`,
          'Remove all private keys from client code — use server-side key operations with PQC algorithms')
      }
      return null
    },
  },
  {
    id: 'APP-012',
    name: 'GraphQL Introspection Enabled',
    category: 'app-crypto',
    severity: 'MEDIUM',
    description: 'GraphQL introspection exposes the full API schema',
    remediation: 'Disable GraphQL introspection in production environments',
    evaluate: (ctx) => {
      const gqlFindings = ctx.apiResult?.apiFindings.filter(f => f.findingType.includes('GraphQL')) || []
      if (gqlFindings.length > 0) {
        return makeResult('APP-012', 'GraphQL Introspection', 'app-crypto', 'MEDIUM',
          'GraphQL introspection is enabled — full API schema exposed to attackers',
          'Disable GraphQL introspection in production to reduce reconnaissance surface')
      }
      return null
    },
  },

  // ── NIST Compliance Rules (2 rules) ──────────────────────────────────────

  {
    id: 'NIST-001',
    name: 'Non-Compliant Key Size',
    category: 'pqc-readiness',
    severity: 'HIGH',
    description: 'Key size does not meet NIST SP 800-57 minimum recommendations',
    remediation: 'Upgrade to NIST-compliant key sizes or migrate to PQC',
    evaluate: (ctx) => {
      const cert = ctx.certInfo
      if (!cert) return null
      const alg = cert.publicKeyAlgorithm.toLowerCase()
      if (alg.includes('rsa') && cert.publicKeySize < 2048) {
        return makeResult('NIST-001', 'Non-Compliant Key Size', 'pqc-readiness', 'HIGH',
          `RSA-${cert.publicKeySize} does not meet NIST SP 800-57 minimum (2048-bit) — non-compliant`,
          'Immediately upgrade to RSA-2048+ or migrate to ML-KEM-768 (FIPS 203)')
      }
      if (alg.includes('ec') && cert.publicKeySize < 256) {
        return makeResult('NIST-001', 'Non-Compliant Key Size', 'pqc-readiness', 'HIGH',
          `ECC with ${cert.publicKeySize}-bit key does not meet NIST minimum (P-256) — non-compliant`,
          'Upgrade to P-256+ or migrate to ML-DSA-65 (FIPS 204)')
      }
      return null
    },
  },
  {
    id: 'NIST-002',
    name: 'NIST PQC Migration Deadline Approaching',
    category: 'pqc-readiness',
    severity: 'MEDIUM',
    description: 'NIST recommends PQC migration by 2035 — plan needed',
    remediation: 'Develop and begin executing PQC migration roadmap',
    evaluate: (ctx) => {
      const hasAnyVuln = ctx.findings.some(f => f.threatLevel === 'CRITICAL' || f.threatLevel === 'HIGH')
      const hasPqc = ctx.findings.some(f =>
        f.algorithm.includes('ML-KEM') || f.algorithm.includes('Kyber') || f.algorithm.includes('ML-DSA')
      )
      if (hasAnyVuln && !hasPqc) {
        return makeResult('NIST-002', 'NIST PQC Deadline', 'pqc-readiness', 'MEDIUM',
          'NIST recommends complete PQC migration by 2035 — quantum-vulnerable algorithms detected with no PQC adoption',
          'Begin PQC migration: deploy hybrid TLS (X25519+ML-KEM-768), test PQC certificates, update JWT signing')
      }
      return null
    },
  },
]

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeResult(
  ruleId: string,
  ruleName: string,
  category: DetectionRuleCategory,
  severity: ThreatLevel,
  details: string,
  remediation: string
): DetectionRuleResult {
  return {
    ruleId,
    ruleName,
    category,
    severity,
    triggered: true,
    details,
    remediation,
  }
}

/**
 * Run all detection rules against a scan context
 */
export function evaluateDetectionRules(context: DetectionContext): DetectionRuleResult[] {
  const results: DetectionRuleResult[] = []

  for (const rule of DETECTION_RULES) {
    try {
      const result = rule.evaluate(context)
      if (result && result.triggered) {
        results.push(result)
      }
    } catch {
      // Skip rules that fail — don't break the scan
    }
  }

  return results
}
