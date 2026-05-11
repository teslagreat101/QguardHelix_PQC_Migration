/**
 * @license SPDX-License-Identifier: Apache-2.0
 * 
 * CRYPTO DETECTION RULES
 * Deep fingerprinting signatures for vulnerable cryptographic implementations.
 */

export type ScanTargetType =
  | 'tls-ssl' | 'ssh' | 'vpn' | 'api' | 'certificate' | 'jwt'
  | 'database' | 'cloud-service' | 'kubernetes' | 'container'
  | 'cicd-pipeline' | 'source-code' | 'git-repo' | 'openssl-config'
  | 'load-balancer' | 'reverse-proxy' | 'service-mesh' | 'email'
  | 'smime' | 'code-signing' | 'mobile-app' | 'desktop-app'
  | 'hsm-kms' | 'vault' | 'iot' | 'blockchain-wallet' | 'messaging';

export type DetectionSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type QuantumThreatType = 'shor' | 'grover' | 'both' | 'classical';

export type DetectionRule = {
  id: string;
  name: string;
  category: 'key-exchange' | 'signature' | 'symmetric' | 'hash' | 'protocol' | 'config' | 'entropy';
  pattern: string;           // regex or identifier pattern
  filePatterns: string[];    // file glob patterns to scan
  severity: DetectionSeverity;
  quantumThreat: QuantumThreatType;
  cweId: string | null;
  description: string;
  pqcReplacement: string;
  scanTargets: ScanTargetType[];
};

export const DETECTION_RULES: DetectionRule[] = [
  // ── RSA ──
  { id: 'RSA-1024', name: 'RSA-1024 Key', category: 'key-exchange', pattern: 'RSA.*1024|rsa_keygen_bits:1024', filePatterns: ['*.pem', '*.key', '*.conf', '*.cfg', '*.yml', '*.yaml', '*.json', '*.ts', '*.js', '*.py', '*.go', '*.java'], severity: 'critical', quantumThreat: 'shor', cweId: 'CWE-326', description: 'RSA-1024 is classically weak and quantum-vulnerable via Shor algorithm.', pqcReplacement: 'ML-KEM-768', scanTargets: ['tls-ssl', 'certificate', 'ssh', 'vpn', 'api', 'source-code'] },
  { id: 'RSA-2048', name: 'RSA-2048 Key', category: 'key-exchange', pattern: 'RSA.*2048|rsa_keygen_bits:2048|RS256|RS384', filePatterns: ['*.pem', '*.key', '*.conf', '*.ts', '*.js', '*.py', '*.go', '*.java', '*.yml'], severity: 'critical', quantumThreat: 'shor', cweId: 'CWE-327', description: 'RSA-2048 is quantum-vulnerable. Primary HNDL target.', pqcReplacement: 'ML-KEM-768', scanTargets: ['tls-ssl', 'certificate', 'jwt', 'api', 'ssh', 'email', 'code-signing', 'source-code'] },
  { id: 'RSA-4096', name: 'RSA-4096 Key', category: 'key-exchange', pattern: 'RSA.*4096|rsa_keygen_bits:4096|RS512', filePatterns: ['*.pem', '*.key', '*.conf', '*.ts', '*.js', '*.py'], severity: 'high', quantumThreat: 'shor', cweId: 'CWE-327', description: 'RSA-4096 has strong classical security but remains quantum-vulnerable.', pqcReplacement: 'ML-KEM-1024', scanTargets: ['tls-ssl', 'certificate', 'vpn', 'hsm-kms', 'code-signing'] },
  
  // ── ECDSA / ECDH ──
  { id: 'ECDSA-P256', name: 'ECDSA P-256', category: 'signature', pattern: 'ECDSA.*P-?256|prime256v1|secp256r1|ES256', filePatterns: ['*.pem', '*.key', '*.conf', '*.ts', '*.js', '*.py', '*.go'], severity: 'high', quantumThreat: 'shor', cweId: 'CWE-327', description: 'ECDSA P-256 broken by quantum Shor algorithm.', pqcReplacement: 'ML-DSA-65', scanTargets: ['tls-ssl', 'certificate', 'jwt', 'blockchain-wallet', 'code-signing', 'mobile-app'] },
  { id: 'ECDSA-P384', name: 'ECDSA P-384', category: 'signature', pattern: 'ECDSA.*P-?384|secp384r1|ES384', filePatterns: ['*.pem', '*.key', '*.conf', '*.ts', '*.js'], severity: 'high', quantumThreat: 'shor', cweId: 'CWE-327', description: 'ECDSA P-384 quantum-vulnerable.', pqcReplacement: 'ML-DSA-87', scanTargets: ['tls-ssl', 'certificate', 'jwt', 'code-signing'] },
  { id: 'ECDH-P256', name: 'ECDH P-256 Key Exchange', category: 'key-exchange', pattern: 'ECDH.*P-?256|prime256v1.*key.?exchange', filePatterns: ['*.conf', '*.cfg', '*.ts', '*.js', '*.go'], severity: 'high', quantumThreat: 'shor', cweId: 'CWE-327', description: 'ECDH P-256 key exchange is quantum-vulnerable.', pqcReplacement: 'X25519 + ML-KEM-768', scanTargets: ['tls-ssl', 'vpn', 'messaging'] },

  // ── Diffie-Hellman ──
  { id: 'DH-1024', name: 'Diffie-Hellman 1024-bit', category: 'key-exchange', pattern: 'dh.*1024|DHE.*1024|diffie.*hellman.*1024', filePatterns: ['*.conf', '*.cfg', '*.ts', '*.js', '*.py'], severity: 'critical', quantumThreat: 'shor', cweId: 'CWE-326', description: 'DH-1024 classically weak + quantum-vulnerable.', pqcReplacement: 'ML-KEM-768', scanTargets: ['tls-ssl', 'ssh', 'vpn', 'load-balancer'] },
  { id: 'DH-2048', name: 'Diffie-Hellman 2048-bit', category: 'key-exchange', pattern: 'dh.*2048|DHE.*2048|diffie.*hellman.*2048', filePatterns: ['*.conf', '*.cfg', '*.ts', '*.js'], severity: 'critical', quantumThreat: 'shor', cweId: 'CWE-327', description: 'DH-2048 quantum-vulnerable via Shor.', pqcReplacement: 'ML-KEM-768', scanTargets: ['ssh', 'vpn', 'tls-ssl'] },

  // ── DSA ──
  { id: 'DSA', name: 'DSA Signature', category: 'signature', pattern: 'DSA|ssh-dss|dsa_sign|DSS', filePatterns: ['*.pem', '*.key', '*.conf', '*.pub'], severity: 'critical', quantumThreat: 'shor', cweId: 'CWE-327', description: 'DSA deprecated classically. Quantum-vulnerable.', pqcReplacement: 'ML-DSA-65', scanTargets: ['ssh', 'certificate', 'code-signing'] },

  // ── Weak AES ──
  { id: 'AES-128', name: 'AES-128 Encryption', category: 'symmetric', pattern: 'AES-?128|aes_128|AES128', filePatterns: ['*.conf', '*.cfg', '*.ts', '*.js', '*.py', '*.go', '*.java', '*.yml'], severity: 'medium', quantumThreat: 'grover', cweId: 'CWE-326', description: 'AES-128 reduced to 64-bit security by Grover.', pqcReplacement: 'AES-256-GCM', scanTargets: ['database', 'vault', 'cloud-service', 'container', 'source-code'] },
  { id: '3DES', name: 'Triple DES', category: 'symmetric', pattern: '3DES|DES-?EDE3|des3|triple.?des|TDEA', filePatterns: ['*.conf', '*.cfg', '*.ts', '*.js', '*.py'], severity: 'critical', quantumThreat: 'grover', cweId: 'CWE-327', description: '3DES deprecated. 64-bit block size + Grover.', pqcReplacement: 'AES-256-GCM', scanTargets: ['database', 'tls-ssl', 'email', 'desktop-app'] },
  { id: 'RC4', name: 'RC4 Stream Cipher', category: 'symmetric', pattern: 'RC4|ARCFOUR|rc4_encrypt', filePatterns: ['*.conf', '*.cfg', '*.ts', '*.js', '*.py'], severity: 'critical', quantumThreat: 'classical', cweId: 'CWE-327', description: 'RC4 is cryptographically broken.', pqcReplacement: 'AES-256-GCM', scanTargets: ['tls-ssl', 'database', 'desktop-app'] },
  { id: 'Blowfish', name: 'Blowfish Cipher', category: 'symmetric', pattern: 'Blowfish|BF-CBC|bf_encrypt', filePatterns: ['*.conf', '*.cfg', '*.ts', '*.js', '*.py'], severity: 'high', quantumThreat: 'grover', cweId: 'CWE-327', description: 'Blowfish has 64-bit block size. Sweet32 vulnerable.', pqcReplacement: 'AES-256-GCM', scanTargets: ['vpn', 'database', 'desktop-app'] },

  // ── Weak Hashing ──
  { id: 'MD5', name: 'MD5 Hash', category: 'hash', pattern: 'MD5|md5|createHash\\([\'"]md5|hashlib\\.md5', filePatterns: ['*.ts', '*.js', '*.py', '*.go', '*.java', '*.php', '*.rb', '*.conf'], severity: 'critical', quantumThreat: 'classical', cweId: 'CWE-328', description: 'MD5 collision attacks trivial. Never use for security.', pqcReplacement: 'SHA3-256', scanTargets: ['source-code', 'certificate', 'email', 'database', 'cicd-pipeline'] },
  { id: 'SHA-1', name: 'SHA-1 Hash', category: 'hash', pattern: 'SHA-?1|sha1|createHash\\([\'"]sha1|hashlib\\.sha1', filePatterns: ['*.ts', '*.js', '*.py', '*.go', '*.java', '*.php', '*.conf', '*.xml'], severity: 'critical', quantumThreat: 'classical', cweId: 'CWE-328', description: 'SHA-1 broken (SHAttered). Immediate removal.', pqcReplacement: 'SHA3-256', scanTargets: ['source-code', 'certificate', 'git-repo', 'code-signing', 'cicd-pipeline'] },

  // ── Weak Protocols ──
  { id: 'TLS-1.0', name: 'TLS 1.0 Protocol', category: 'protocol', pattern: 'TLSv1[^.]|TLS_1_0|ssl_protocols.*TLSv1[^.]|MinProtocol.*TLSv1[^.]', filePatterns: ['*.conf', '*.cfg', '*.yml', '*.yaml', '*.xml', '*.ini'], severity: 'critical', quantumThreat: 'both', cweId: 'CWE-326', description: 'TLS 1.0 deprecated by RFC 8996.', pqcReplacement: 'TLS 1.3 + PQC KEM', scanTargets: ['tls-ssl', 'load-balancer', 'reverse-proxy', 'api'] },
  { id: 'TLS-1.1', name: 'TLS 1.1 Protocol', category: 'protocol', pattern: 'TLSv1\\.1|TLS_1_1|MinProtocol.*TLSv1\\.1', filePatterns: ['*.conf', '*.cfg', '*.yml', '*.yaml'], severity: 'critical', quantumThreat: 'both', cweId: 'CWE-326', description: 'TLS 1.1 deprecated by RFC 8996.', pqcReplacement: 'TLS 1.3 + PQC KEM', scanTargets: ['tls-ssl', 'load-balancer', 'reverse-proxy'] },
  { id: 'SSLv3', name: 'SSL v3 Protocol', category: 'protocol', pattern: 'SSLv3|SSL_3_0|ssl_protocols.*SSLv3', filePatterns: ['*.conf', '*.cfg'], severity: 'critical', quantumThreat: 'both', cweId: 'CWE-326', description: 'SSLv3 POODLE vulnerability.', pqcReplacement: 'TLS 1.3 + PQC KEM', scanTargets: ['tls-ssl', 'load-balancer'] },

  // ── Configuration Issues ──
  { id: 'SELF-SIGNED', name: 'Self-Signed Certificate', category: 'config', pattern: 'self.?signed|issuer.*=.*subject|CA:FALSE.*self', filePatterns: ['*.pem', '*.crt', '*.conf'], severity: 'medium', quantumThreat: 'classical', cweId: 'CWE-295', description: 'Self-signed certificates bypass PKI trust chain.', pqcReplacement: 'PQC CA-signed certificate', scanTargets: ['certificate', 'tls-ssl', 'kubernetes', 'container'] },
  { id: 'HARDCODED-SECRET', name: 'Hardcoded Secret/Key', category: 'config', pattern: 'private_key.*=.*["\'][A-Za-z0-9+/=]{20,}|password.*=.*["\'][^"\']{8,}|api_key.*=.*["\'][^"\']{16,}|SECRET_KEY.*=', filePatterns: ['*.ts', '*.js', '*.py', '*.go', '*.java', '*.env', '*.yml', '*.yaml', '*.json'], severity: 'critical', quantumThreat: 'classical', cweId: 'CWE-798', description: 'Hardcoded secrets in source code.', pqcReplacement: 'HSM/KMS key management', scanTargets: ['source-code', 'git-repo', 'container', 'cicd-pipeline', 'kubernetes'] },
  { id: 'WEAK-ENTROPY', name: 'Weak Entropy Source', category: 'entropy', pattern: 'Math\\.random|random\\.random|rand\\(\\)|srand|mt_rand|pseudo.?random', filePatterns: ['*.ts', '*.js', '*.py', '*.go', '*.java', '*.php'], severity: 'high', quantumThreat: 'classical', cweId: 'CWE-330', description: 'Pseudo-random number generator used for cryptographic operations.', pqcReplacement: 'QRNG / crypto.getRandomValues', scanTargets: ['source-code', 'mobile-app', 'desktop-app'] },
  { id: 'INSECURE-RNG', name: 'Insecure RNG for Crypto', category: 'entropy', pattern: 'random\\.randint.*key|Math\\.random.*secret|rand\\(\\).*encrypt', filePatterns: ['*.ts', '*.js', '*.py', '*.go', '*.java'], severity: 'critical', quantumThreat: 'classical', cweId: 'CWE-338', description: 'Non-cryptographic RNG used in security context.', pqcReplacement: 'QRNG entropy source', scanTargets: ['source-code', 'mobile-app'] },
  { id: 'DEPRECATED-LIB', name: 'Deprecated Crypto Library', category: 'config', pattern: 'crypto-js.*3\\.|pycrypto|mcrypt|openssl.*1\\.0|node-forge.*0\\.[0-9]', filePatterns: ['package.json', 'requirements.txt', 'go.mod', 'Gemfile', 'pom.xml', '*.csproj'], severity: 'high', quantumThreat: 'classical', cweId: 'CWE-327', description: 'Deprecated cryptographic library with known vulnerabilities.', pqcReplacement: 'liboqs / OQS-OpenSSL 3.x', scanTargets: ['source-code', 'container', 'cicd-pipeline'] },

  // ── Weak Cipher Suites ──
  { id: 'WEAK-CIPHER', name: 'Weak TLS Cipher Suite', category: 'protocol', pattern: 'NULL|EXPORT|DES-CBC3|RC4|anon|MD5.*cipher|CBC.*SHA(?!256|384)', filePatterns: ['*.conf', '*.cfg', '*.yml', '*.yaml'], severity: 'critical', quantumThreat: 'both', cweId: 'CWE-326', description: 'Weak or deprecated TLS cipher suite configured.', pqcReplacement: 'TLS_AES_256_GCM_SHA384', scanTargets: ['tls-ssl', 'load-balancer', 'reverse-proxy', 'service-mesh'] },
];

export function getRulesForTarget(target: ScanTargetType): DetectionRule[] {
  return DETECTION_RULES.filter(r => r.scanTargets.includes(target));
}

export function getRulesBySeverity(severity: DetectionSeverity): DetectionRule[] {
  return DETECTION_RULES.filter(r => r.severity === severity);
}

export function getRuleById(id: string): DetectionRule | undefined {
  return DETECTION_RULES.find(r => r.id === id);
}
