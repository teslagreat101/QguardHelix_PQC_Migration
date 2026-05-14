/**
 * QGuard Web Scanner — Cryptographic Pattern Detection
 * 35 regex patterns for detecting quantum-vulnerable cryptography in source code
 */

import type { CryptoPattern } from './types'

export const CRYPTO_PATTERNS: CryptoPattern[] = [
  // ── RSA Detection (Patterns 1-10) ─────────────────────────────────────────

  {
    id: 1,
    regex: /\bRSA\b/,
    label: 'RSA Key Generation',
    category: 'RSA',
    algorithm: 'RSA',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'RSA algorithm reference detected — vulnerable to Shor\'s algorithm',
  },
  {
    id: 2,
    regex: /from\s+Crypto\.PublicKey\s+import\s+RSA/,
    label: 'Python RSA Library (PyCryptodome)',
    category: 'RSA',
    algorithm: 'RSA',
    threatLevel: 'CRITICAL',
    languages: ['python'],
    description: 'Python PyCryptodome RSA import — quantum-vulnerable key generation',
  },
  {
    id: 3,
    regex: /cryptography\.hazmat\.primitives\.asymmetric\.rsa/,
    label: 'Python Cryptography RSA',
    category: 'RSA',
    algorithm: 'RSA',
    threatLevel: 'CRITICAL',
    languages: ['python'],
    description: 'Python cryptography library RSA module — quantum-vulnerable',
  },
  {
    id: 4,
    regex: /createSign\(['"]RSA/,
    label: 'Node.js RSA Signatures',
    category: 'RSA',
    algorithm: 'RSA',
    threatLevel: 'CRITICAL',
    languages: ['javascript', 'typescript'],
    description: 'Node.js RSA signature creation — quantum-vulnerable signing',
  },
  {
    id: 5,
    regex: /RSA_generate_key/,
    label: 'OpenSSL RSA Key Generation',
    category: 'RSA',
    algorithm: 'RSA',
    threatLevel: 'CRITICAL',
    languages: ['c', 'cpp'],
    description: 'OpenSSL RSA key generation function — quantum-vulnerable',
  },
  {
    id: 6,
    regex: /KeyPairGenerator\.getInstance\(["']RSA["']\)/,
    label: 'Java RSA KeyPairGenerator',
    category: 'RSA',
    algorithm: 'RSA',
    threatLevel: 'CRITICAL',
    languages: ['java'],
    description: 'Java RSA key pair generation — quantum-vulnerable',
  },
  {
    id: 7,
    regex: /-----BEGIN RSA PRIVATE KEY-----/,
    label: 'RSA Private Key Block',
    category: 'RSA',
    algorithm: 'RSA Private Key',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'RSA private key in PEM format detected — exposed key + quantum-vulnerable algorithm',
  },
  {
    id: 8,
    regex: /-----BEGIN PUBLIC KEY-----/,
    label: 'Public Key Block',
    category: 'RSA',
    algorithm: 'Public Key (likely RSA)',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'Public key in PEM format — may be RSA/ECC, requires inspection',
  },
  {
    id: 9,
    regex: /PKCS1/,
    label: 'PKCS#1 RSA Standard',
    category: 'RSA',
    algorithm: 'RSA (PKCS#1)',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'PKCS#1 RSA padding scheme — quantum-vulnerable algorithm',
  },
  {
    id: 10,
    regex: /RSA-OAEP/,
    label: 'RSA-OAEP Encryption',
    category: 'RSA',
    algorithm: 'RSA-OAEP',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'RSA-OAEP encryption — quantum-vulnerable key encapsulation',
  },

  // ── Diffie-Hellman Detection (Patterns 11-13) ─────────────────────────────

  {
    id: 11,
    regex: /DiffieHellman/i,
    label: 'Diffie-Hellman Key Exchange',
    category: 'Key Exchange',
    algorithm: 'Diffie-Hellman',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'Diffie-Hellman key exchange — breakable by Shor\'s algorithm',
  },
  {
    id: 12,
    regex: /DHE_RSA/,
    label: 'DHE-RSA Cipher Usage',
    category: 'Key Exchange',
    algorithm: 'DHE-RSA',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'DHE-RSA cipher configuration — both DH and RSA are quantum-vulnerable',
  },
  {
    id: 13,
    regex: /DH_generate_parameters/,
    label: 'OpenSSL DH Parameter Generation',
    category: 'Key Exchange',
    algorithm: 'Diffie-Hellman',
    threatLevel: 'HIGH',
    languages: ['c', 'cpp'],
    description: 'OpenSSL Diffie-Hellman parameter generation — quantum-vulnerable',
  },

  // ── Elliptic Curve Detection (Patterns 14-20) ─────────────────────────────

  {
    id: 14,
    regex: /ECDSA/,
    label: 'ECDSA Signature Algorithm',
    category: 'ECC',
    algorithm: 'ECDSA',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'ECDSA signature algorithm — breakable by Shor\'s algorithm on ECDLP',
  },
  {
    id: 15,
    regex: /EC_KEY_new/,
    label: 'OpenSSL EC Key Generation',
    category: 'ECC',
    algorithm: 'EC Key',
    threatLevel: 'HIGH',
    languages: ['c', 'cpp'],
    description: 'OpenSSL elliptic curve key creation — quantum-vulnerable',
  },
  {
    id: 16,
    regex: /KeyPairGenerator\.getInstance\(["']EC["']\)/,
    label: 'Java EC KeyPairGenerator',
    category: 'ECC',
    algorithm: 'EC Key',
    threatLevel: 'HIGH',
    languages: ['java'],
    description: 'Java elliptic curve key pair generation — quantum-vulnerable',
  },
  {
    id: 17,
    regex: /\becdsa\b/i,
    label: 'ECDSA Reference',
    category: 'ECC',
    algorithm: 'ECDSA',
    threatLevel: 'HIGH',
    languages: ['javascript', 'typescript', 'python'],
    description: 'ECDSA algorithm reference — quantum-vulnerable signatures',
  },
  {
    id: 18,
    regex: /secp256k1/,
    label: 'secp256k1 Curve (Blockchain)',
    category: 'ECC',
    algorithm: 'secp256k1',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'secp256k1 curve (Bitcoin/Ethereum) — quantum-vulnerable wallet cryptography',
  },
  {
    id: 19,
    regex: /secp256r1/,
    label: 'secp256r1 / P-256 Curve',
    category: 'ECC',
    algorithm: 'secp256r1 (P-256)',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'NIST P-256 curve — widely used but quantum-vulnerable via ECDLP',
  },
  {
    id: 20,
    regex: /secp384r1/,
    label: 'secp384r1 / P-384 Curve',
    category: 'ECC',
    algorithm: 'secp384r1 (P-384)',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'NIST P-384 curve — quantum-vulnerable via ECDLP',
  },

  // ── Weak Hash Detection (Patterns 21-23) ──────────────────────────────────

  {
    id: 21,
    regex: /\bSHA1\b|sha-?1\b/i,
    label: 'SHA-1 Hash Usage',
    category: 'Hash',
    algorithm: 'SHA-1',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'SHA-1 hash — classically broken (collision attacks demonstrated)',
  },
  {
    id: 22,
    regex: /\bMD5\b/,
    label: 'MD5 Hash Usage',
    category: 'Hash',
    algorithm: 'MD5',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'MD5 hash — classically broken, trivial collisions possible',
  },
  {
    id: 23,
    regex: /SHA1withRSA/,
    label: 'SHA-1 with RSA Signature',
    category: 'Hash',
    algorithm: 'SHA1withRSA',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'SHA-1 + RSA signature — broken hash with quantum-vulnerable signing',
  },

  // ── JWT Detection (Patterns 24-25) ────────────────────────────────────────

  {
    id: 24,
    regex: /RS256/,
    label: 'JWT RSA-SHA256 Signing',
    category: 'JWT',
    algorithm: 'RS256 (RSA-SHA256)',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'JWT RS256 signing algorithm — RSA-based, quantum-vulnerable',
  },
  {
    id: 25,
    regex: /ES256/,
    label: 'JWT ECDSA-SHA256 Signing',
    category: 'JWT',
    algorithm: 'ES256 (ECDSA-P256)',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'JWT ES256 signing algorithm — ECDSA-based, quantum-vulnerable',
  },

  // ── Key Management (Patterns 26-27) ───────────────────────────────────────

  {
    id: 26,
    regex: /-----BEGIN PRIVATE KEY-----/,
    label: 'Generic Private Key Block',
    category: 'Key Management',
    algorithm: 'Private Key (PKCS#8)',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'Private key in PEM format — exposed key material in source code',
  },
  {
    id: 27,
    regex: /-----BEGIN CERTIFICATE-----/,
    label: 'PEM Certificate',
    category: 'Certificate',
    algorithm: 'X.509 Certificate',
    threatLevel: 'MEDIUM',
    languages: ['all'],
    description: 'X.509 certificate in PEM format — inspect for algorithm type',
  },

  // ── OpenSSL & CLI (Pattern 28) ────────────────────────────────────────────

  {
    id: 28,
    regex: /openssl\s+genrsa/,
    label: 'OpenSSL RSA Key Generation (CLI)',
    category: 'RSA',
    algorithm: 'RSA (via OpenSSL)',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'OpenSSL genrsa command — generating quantum-vulnerable RSA keys',
  },

  // ── TLS Cipher Configuration (Patterns 29-30) ────────────────────────────

  {
    id: 29,
    regex: /TLS_ECDHE_RSA/,
    label: 'TLS ECDHE-RSA Cipher Suite',
    category: 'TLS',
    algorithm: 'ECDHE-RSA',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'TLS cipher suite with ECDHE-RSA — both key exchange and cert are quantum-vulnerable',
  },
  {
    id: 30,
    regex: /TLS_RSA_WITH/,
    label: 'TLS RSA Key Exchange Cipher',
    category: 'TLS',
    algorithm: 'RSA Key Exchange',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'TLS cipher with RSA key exchange — no forward secrecy + quantum-vulnerable',
  },

  // ── Crypto Library Imports (Patterns 31-34) ───────────────────────────────

  {
    id: 31,
    regex: /javax\.crypto/,
    label: 'Java Crypto Library',
    category: 'Library',
    algorithm: 'Java Crypto API',
    threatLevel: 'MEDIUM',
    languages: ['java'],
    description: 'Java cryptography API usage — inspect for quantum-vulnerable algorithms',
  },
  {
    id: 32,
    regex: /import\s+Crypto/,
    label: 'Python PyCrypto Import',
    category: 'Library',
    algorithm: 'PyCrypto/PyCryptodome',
    threatLevel: 'MEDIUM',
    languages: ['python'],
    description: 'Python crypto library import — inspect for quantum-vulnerable algorithm usage',
  },
  {
    id: 33,
    regex: /crypto\/rsa/,
    label: 'Go crypto/rsa Package',
    category: 'RSA',
    algorithm: 'RSA (Go)',
    threatLevel: 'CRITICAL',
    languages: ['go'],
    description: 'Go crypto/rsa package — quantum-vulnerable RSA implementation',
  },
  {
    id: 34,
    regex: /crypto\/elliptic/,
    label: 'Go crypto/elliptic Package',
    category: 'ECC',
    algorithm: 'ECC (Go)',
    threatLevel: 'HIGH',
    languages: ['go'],
    description: 'Go crypto/elliptic package — quantum-vulnerable ECC implementation',
  },

  // ── Blockchain / Wallet Keys (Pattern 35) ─────────────────────────────────

  {
    id: 35,
    regex: /0x[a-fA-F0-9]{64}/,
    label: 'Potential Wallet Private Key',
    category: 'Blockchain',
    algorithm: 'Hex Private Key (256-bit)',
    threatLevel: 'CRITICAL',
    languages: ['all'],
    description: 'Potential 256-bit private key (blockchain wallet) — exposed key material',
  },

  // ── Rust Crypto Detection (Patterns 36-38) ────────────────────────────────

  {
    id: 36,
    regex: /use\s+rsa::|RsaPrivateKey::new|RsaPublicKey/,
    label: 'Rust RSA Crate Usage',
    category: 'RSA',
    algorithm: 'RSA (Rust)',
    threatLevel: 'CRITICAL',
    languages: ['rust'],
    description: 'Rust rsa crate usage — quantum-vulnerable RSA implementation',
  },
  {
    id: 37,
    regex: /use\s+p256::|use\s+p384::|use\s+k256::/,
    label: 'Rust ECC Crate Usage',
    category: 'ECC',
    algorithm: 'ECC (Rust)',
    threatLevel: 'HIGH',
    languages: ['rust'],
    description: 'Rust elliptic curve crate — quantum-vulnerable via ECDLP',
  },
  {
    id: 38,
    regex: /use\s+ed25519_dalek::|Ed25519/,
    label: 'Rust Ed25519 Usage',
    category: 'ECC',
    algorithm: 'Ed25519 (Rust)',
    threatLevel: 'HIGH',
    languages: ['rust'],
    description: 'Ed25519 signature scheme — quantum-vulnerable EdDSA on Curve25519',
  },

  // ── C# / .NET Crypto Detection (Patterns 39-42) ──────────────────────────

  {
    id: 39,
    regex: /RSACryptoServiceProvider|RSA\.Create/,
    label: '.NET RSA Provider',
    category: 'RSA',
    algorithm: 'RSA (.NET)',
    threatLevel: 'CRITICAL',
    languages: ['csharp'],
    description: '.NET RSA cryptographic provider — quantum-vulnerable',
  },
  {
    id: 40,
    regex: /ECDsa\.Create|ECDiffieHellman\.Create/,
    label: '.NET ECC Provider',
    category: 'ECC',
    algorithm: 'ECDSA/ECDH (.NET)',
    threatLevel: 'HIGH',
    languages: ['csharp'],
    description: '.NET elliptic curve provider — quantum-vulnerable via Shor\'s',
  },
  {
    id: 41,
    regex: /DSACryptoServiceProvider|DSA\.Create/,
    label: '.NET DSA Provider',
    category: 'DSA',
    algorithm: 'DSA (.NET)',
    threatLevel: 'HIGH',
    languages: ['csharp'],
    description: '.NET DSA cryptographic provider — quantum-vulnerable',
  },
  {
    id: 42,
    regex: /System\.Security\.Cryptography/,
    label: '.NET Crypto Namespace',
    category: 'Library',
    algorithm: '.NET Crypto API',
    threatLevel: 'MEDIUM',
    languages: ['csharp'],
    description: '.NET System.Security.Cryptography usage — inspect for quantum-vulnerable algorithms',
  },

  // ── Swift / iOS Crypto Detection (Patterns 43-45) ─────────────────────────

  {
    id: 43,
    regex: /SecKeyCreateRandomKey|kSecAttrKeyTypeRSA/,
    label: 'iOS/macOS RSA Key Generation',
    category: 'RSA',
    algorithm: 'RSA (Apple Security)',
    threatLevel: 'CRITICAL',
    languages: ['swift'],
    description: 'Apple Security framework RSA key generation — quantum-vulnerable',
  },
  {
    id: 44,
    regex: /kSecAttrKeyTypeECSECPrimeRandom|SecKeyCreateSignature/,
    label: 'iOS/macOS ECC Operations',
    category: 'ECC',
    algorithm: 'ECDSA (Apple Security)',
    threatLevel: 'HIGH',
    languages: ['swift'],
    description: 'Apple Security framework ECC operations — quantum-vulnerable',
  },
  {
    id: 45,
    regex: /CryptoKit\.P256|CryptoKit\.P384|CryptoKit\.P521|Curve25519/,
    label: 'Swift CryptoKit ECC',
    category: 'ECC',
    algorithm: 'CryptoKit ECC',
    threatLevel: 'HIGH',
    languages: ['swift'],
    description: 'Swift CryptoKit elliptic curve usage — quantum-vulnerable',
  },

  // ── Config File Detection (Patterns 46-50) ────────────────────────────────

  {
    id: 46,
    regex: /ssl_ciphers|ssl_protocols|SSLCipherSuite|SSLProtocol/,
    label: 'TLS Configuration Directive',
    category: 'TLS',
    algorithm: 'TLS Config',
    threatLevel: 'MEDIUM',
    languages: ['all'],
    description: 'Server TLS configuration — inspect for quantum-vulnerable cipher suites',
  },
  {
    id: 47,
    regex: /KexAlgorithms|Ciphers|MACs.*hmac/,
    label: 'SSH Crypto Configuration',
    category: 'SSH',
    algorithm: 'SSH Crypto Config',
    threatLevel: 'MEDIUM',
    languages: ['all'],
    description: 'SSH cryptographic configuration — inspect for quantum-vulnerable algorithms',
  },
  {
    id: 48,
    regex: /tls_ecdhe_rsa|tls_rsa_with|ssl_prefer_server_ciphers/i,
    label: 'Cipher Suite Configuration',
    category: 'TLS',
    algorithm: 'TLS Cipher Config',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'TLS cipher suite configuration — may include quantum-vulnerable suites',
  },
  {
    id: 49,
    regex: /gpg_key|pgp_|openpgp/i,
    label: 'PGP/GPG Key Reference',
    category: 'Key Management',
    algorithm: 'PGP/GPG',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'PGP/GPG key reference — typically uses quantum-vulnerable RSA or ECC',
  },
  {
    id: 50,
    regex: /bcrypt|scrypt|argon2|pbkdf2/i,
    label: 'Password Hashing Function',
    category: 'Hash',
    algorithm: 'Password Hash',
    threatLevel: 'LOW',
    languages: ['all'],
    description: 'Password hashing function — symmetric, quantum impact limited to Grover\'s (128-bit security)',
  },

  // ── Modern Go / Kotlin Detection (Patterns 51-54) ─────────────────────────

  {
    id: 51,
    regex: /crypto\/ed25519|crypto\/x509/,
    label: 'Go Crypto Package',
    category: 'ECC',
    algorithm: 'Ed25519/X509 (Go)',
    threatLevel: 'HIGH',
    languages: ['go'],
    description: 'Go crypto package with quantum-vulnerable signatures',
  },
  {
    id: 52,
    regex: /java\.security\.KeyPairGenerator|java\.security\.Signature/,
    label: 'Java Security API',
    category: 'Library',
    algorithm: 'Java Security API',
    threatLevel: 'MEDIUM',
    languages: ['java', 'kotlin'],
    description: 'Java Security API — inspect for quantum-vulnerable algorithm selection',
  },
  {
    id: 53,
    regex: /BouncyCastle|org\.bouncycastle/,
    label: 'BouncyCastle Crypto Library',
    category: 'Library',
    algorithm: 'BouncyCastle',
    threatLevel: 'MEDIUM',
    languages: ['java', 'kotlin', 'csharp'],
    description: 'BouncyCastle crypto library — may contain PQC or legacy algorithms',
  },
  {
    id: 54,
    regex: /nacl\.box|nacl\.sign|tweetnacl|libsodium|sodium/i,
    label: 'NaCl/Libsodium Usage',
    category: 'Library',
    algorithm: 'NaCl/Libsodium',
    threatLevel: 'HIGH',
    languages: ['all'],
    description: 'NaCl/Libsodium library — uses Curve25519/Ed25519, quantum-vulnerable',
  },
]

/**
 * Scannable file extensions for repository analysis
 */
export const SCANNABLE_EXTENSIONS = new Set([
  '.py', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.java', '.go', '.rs', '.c', '.cpp', '.h', '.hpp', '.cc',
  '.rb', '.php', '.cs', '.swift', '.kt', '.kts', '.scala',
  '.yaml', '.yml', '.json', '.toml', '.xml', '.properties',
  '.env', '.cfg', '.conf', '.ini', '.config',
  '.sh', '.bash', '.zsh', '.ps1',
  '.pem', '.key', '.crt', '.cer', '.p12', '.pfx',
  '.dockerfile', '.tf', '.hcl', '.bicep',
  '.gradle', '.sbt', '.cmake', '.makefile',
  '.nginx', '.apache', '.htaccess',
])

/**
 * File extensions to prioritize in scanning (most likely to contain crypto code)
 */
export const PRIORITY_EXTENSIONS = new Set([
  '.py', '.js', '.ts', '.java', '.go', '.rs', '.c', '.cpp', '.cs', '.swift', '.kt',
  '.pem', '.key', '.env', '.yaml', '.yml', '.conf', '.cfg',
])

/**
 * Apply all crypto patterns against a line of source code
 */
export function matchCryptoPatterns(
  line: string,
  filename: string
): { pattern: CryptoPattern; match: RegExpMatchArray }[] {
  const results: { pattern: CryptoPattern; match: RegExpMatchArray }[] = []

  for (const pattern of CRYPTO_PATTERNS) {
    const match = line.match(pattern.regex)
    if (match) {
      results.push({ pattern, match })
    }
  }

  return results
}
