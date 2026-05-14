/**
 * QGuard Web Scanner — Cipher Suite Analyzer
 * Evaluates TLS cipher suites for quantum vulnerability
 * Detects 30 cipher suite fingerprints across 5 categories
 */

import type { CipherSuiteDetail, CipherSuiteCategory, ThreatLevel } from './types'

// ─── Cipher Suite Fingerprint Database ──────────────────────────────────────

interface CipherSuiteFingerprint {
  name: string
  category: CipherSuiteCategory
  keyExchange: string
  authentication: string
  encryption: string
  mac: string
  quantumVulnerable: boolean
  riskLevel: ThreatLevel
  description: string
}

const CIPHER_SUITE_DB: CipherSuiteFingerprint[] = [
  // ── Category 1: RSA Key Exchange (Critical Quantum Risk) ──────────────────
  {
    name: 'TLS_RSA_WITH_AES_128_GCM_SHA256',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'AES-128-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA key exchange — no forward secrecy + quantum-vulnerable via Shor\'s algorithm',
  },
  {
    name: 'TLS_RSA_WITH_AES_256_GCM_SHA384',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'AES-256-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA key exchange — no forward secrecy + quantum-vulnerable',
  },
  {
    name: 'TLS_RSA_WITH_AES_128_CBC_SHA',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA key exchange with CBC mode and SHA-1 MAC — multiple vulnerabilities',
  },
  {
    name: 'TLS_RSA_WITH_AES_256_CBC_SHA',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA key exchange with CBC mode — quantum-vulnerable + legacy MAC',
  },
  {
    name: 'TLS_RSA_WITH_3DES_EDE_CBC_SHA',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: '3DES-EDE-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA key exchange with 3DES — classically deprecated + quantum-vulnerable',
  },

  // ── Category 2: ECDHE + RSA (High Quantum Risk) ──────────────────────────
  {
    name: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256',
    category: 'ecdhe-rsa',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'AES-128-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE key exchange + RSA auth — both components quantum-vulnerable',
  },
  {
    name: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384',
    category: 'ecdhe-rsa',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'AES-256-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE key exchange + RSA auth — quantum-vulnerable key exchange and certificate',
  },
  {
    name: 'TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256',
    category: 'ecdhe-rsa',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'CHACHA20-POLY1305',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-RSA with ChaCha20 — strong symmetric encryption but quantum-vulnerable key exchange',
  },
  {
    name: 'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA',
    category: 'ecdhe-rsa',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-RSA with CBC mode — quantum-vulnerable + legacy construction',
  },
  {
    name: 'TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA',
    category: 'ecdhe-rsa',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-RSA with AES-256-CBC — quantum-vulnerable key exchange',
  },

  // ── Category 3: ECDHE + ECDSA (High Quantum Risk) ────────────────────────
  {
    name: 'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256',
    category: 'ecdhe-ecdsa',
    keyExchange: 'ECDHE',
    authentication: 'ECDSA',
    encryption: 'AES-128-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE + ECDSA — both ECC-based, fully breakable by Shor\'s algorithm',
  },
  {
    name: 'TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384',
    category: 'ecdhe-ecdsa',
    keyExchange: 'ECDHE',
    authentication: 'ECDSA',
    encryption: 'AES-256-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE + ECDSA with AES-256-GCM — quantum-vulnerable ECC components',
  },
  {
    name: 'TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256',
    category: 'ecdhe-ecdsa',
    keyExchange: 'ECDHE',
    authentication: 'ECDSA',
    encryption: 'CHACHA20-POLY1305',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-ECDSA with ChaCha20 — quantum-vulnerable ECC key exchange and auth',
  },
  {
    name: 'TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA',
    category: 'ecdhe-ecdsa',
    keyExchange: 'ECDHE',
    authentication: 'ECDSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-ECDSA with CBC + SHA-1 — quantum-vulnerable + legacy construction',
  },
  {
    name: 'TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA',
    category: 'ecdhe-ecdsa',
    keyExchange: 'ECDHE',
    authentication: 'ECDSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-ECDSA with AES-256-CBC — quantum-vulnerable ECC components',
  },

  // ── Category 4: DHE + RSA (High Quantum Risk) ────────────────────────────
  {
    name: 'TLS_DHE_RSA_WITH_AES_128_GCM_SHA256',
    category: 'dhe-rsa',
    keyExchange: 'DHE',
    authentication: 'RSA',
    encryption: 'AES-128-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'DHE-RSA with AES-128-GCM — DH key exchange quantum-vulnerable via Shor\'s',
  },
  {
    name: 'TLS_DHE_RSA_WITH_AES_256_GCM_SHA384',
    category: 'dhe-rsa',
    keyExchange: 'DHE',
    authentication: 'RSA',
    encryption: 'AES-256-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'DHE-RSA with AES-256-GCM — DH and RSA both quantum-vulnerable',
  },
  {
    name: 'TLS_DHE_RSA_WITH_AES_128_CBC_SHA',
    category: 'dhe-rsa',
    keyExchange: 'DHE',
    authentication: 'RSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'DHE-RSA with CBC + SHA-1 — quantum-vulnerable + legacy MAC',
  },
  {
    name: 'TLS_DHE_RSA_WITH_AES_256_CBC_SHA',
    category: 'dhe-rsa',
    keyExchange: 'DHE',
    authentication: 'RSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'DHE-RSA with AES-256-CBC — quantum-vulnerable DH + RSA',
  },

  // ── Category 5: DHE + DSS (Critical — deprecated + quantum) ──────────────
  {
    name: 'TLS_DHE_DSS_WITH_AES_128_CBC_SHA',
    category: 'dhe-dss',
    keyExchange: 'DHE',
    authentication: 'DSS',
    encryption: 'AES-128-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'DHE-DSS — deprecated DSA + quantum-vulnerable DH key exchange',
  },

  // ── TLS 1.3 Cipher Suites ────────────────────────────────────────────────
  {
    name: 'TLS_AES_128_GCM_SHA256',
    category: 'tls13',
    keyExchange: 'ECDHE/DHE (negotiated)',
    authentication: 'Certificate',
    encryption: 'AES-128-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'MEDIUM',
    description: 'TLS 1.3 — symmetric cipher is adequate but key exchange is quantum-vulnerable',
  },
  {
    name: 'TLS_AES_256_GCM_SHA384',
    category: 'tls13',
    keyExchange: 'ECDHE/DHE (negotiated)',
    authentication: 'Certificate',
    encryption: 'AES-256-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'MEDIUM',
    description: 'TLS 1.3 with AES-256 — strong symmetric but key exchange needs PQC upgrade',
  },
  {
    name: 'TLS_CHACHA20_POLY1305_SHA256',
    category: 'tls13',
    keyExchange: 'ECDHE/DHE (negotiated)',
    authentication: 'Certificate',
    encryption: 'CHACHA20-POLY1305',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'MEDIUM',
    description: 'TLS 1.3 with ChaCha20 — quantum-safe symmetric but key exchange needs upgrade',
  },

  // ── Additional RSA Key Exchange Suites (Critical) ───────────────────────
  {
    name: 'TLS_RSA_WITH_AES_128_CBC_SHA256',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA-256',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA key exchange with AES-128-CBC — no forward secrecy + quantum-vulnerable',
  },
  {
    name: 'TLS_RSA_WITH_AES_256_CBC_SHA256',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA-256',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA key exchange with AES-256-CBC — no forward secrecy + quantum-vulnerable',
  },
  {
    name: 'TLS_RSA_WITH_RC4_128_SHA',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'RC4-128',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA + RC4 — classically broken cipher + no forward secrecy + quantum-vulnerable',
  },
  {
    name: 'TLS_RSA_WITH_NULL_SHA',
    category: 'rsa-kex',
    keyExchange: 'RSA',
    authentication: 'RSA',
    encryption: 'NULL',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'RSA with NULL encryption — no encryption, no forward secrecy, quantum-vulnerable auth',
  },

  // ── Additional ECDHE + RSA/ECDSA Suites ─────────────────────────────────
  {
    name: 'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256',
    category: 'ecdhe-rsa',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA-256',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-RSA with AES-128-CBC — quantum-vulnerable key exchange + CBC mode',
  },
  {
    name: 'TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384',
    category: 'ecdhe-rsa',
    keyExchange: 'ECDHE',
    authentication: 'RSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA-384',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-RSA with AES-256-CBC — quantum-vulnerable ECC key exchange',
  },
  {
    name: 'TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256',
    category: 'ecdhe-ecdsa',
    keyExchange: 'ECDHE',
    authentication: 'ECDSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA-256',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-ECDSA with CBC — quantum-vulnerable ECC components',
  },
  {
    name: 'TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA384',
    category: 'ecdhe-ecdsa',
    keyExchange: 'ECDHE',
    authentication: 'ECDSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA-384',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'ECDHE-ECDSA with AES-256-CBC — fully quantum-vulnerable ECC',
  },

  // ── Additional DHE Suites ───────────────────────────────────────────────
  {
    name: 'TLS_DHE_RSA_WITH_AES_128_CBC_SHA256',
    category: 'dhe-rsa',
    keyExchange: 'DHE',
    authentication: 'RSA',
    encryption: 'AES-128-CBC',
    mac: 'SHA-256',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'DHE-RSA with AES-128-CBC — quantum-vulnerable DH + RSA',
  },
  {
    name: 'TLS_DHE_RSA_WITH_AES_256_CBC_SHA256',
    category: 'dhe-rsa',
    keyExchange: 'DHE',
    authentication: 'RSA',
    encryption: 'AES-256-CBC',
    mac: 'SHA-256',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'DHE-RSA with AES-256-CBC — quantum-vulnerable DH + RSA',
  },
  {
    name: 'TLS_DHE_RSA_WITH_CHACHA20_POLY1305_SHA256',
    category: 'dhe-rsa',
    keyExchange: 'DHE',
    authentication: 'RSA',
    encryption: 'CHACHA20-POLY1305',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'DHE-RSA with ChaCha20 — quantum-safe symmetric but DH/RSA are quantum-vulnerable',
  },
  {
    name: 'TLS_DHE_DSS_WITH_AES_256_CBC_SHA',
    category: 'dhe-dss',
    keyExchange: 'DHE',
    authentication: 'DSS',
    encryption: 'AES-256-CBC',
    mac: 'SHA-1',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'DHE-DSS with AES-256-CBC — deprecated DSA + quantum-vulnerable DH',
  },
  {
    name: 'TLS_DHE_DSS_WITH_AES_128_GCM_SHA256',
    category: 'dhe-dss',
    keyExchange: 'DHE',
    authentication: 'DSS',
    encryption: 'AES-128-GCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'CRITICAL',
    description: 'DHE-DSS with AES-128-GCM — deprecated DSA + quantum-vulnerable DH',
  },

  // ── TLS 1.3 AES-128-CCM (less common but valid) ────────────────────────
  {
    name: 'TLS_AES_128_CCM_SHA256',
    category: 'tls13',
    keyExchange: 'ECDHE/DHE (negotiated)',
    authentication: 'Certificate',
    encryption: 'AES-128-CCM',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'MEDIUM',
    description: 'TLS 1.3 with AES-128-CCM — IoT-oriented, key exchange needs PQC upgrade',
  },
  {
    name: 'TLS_AES_128_CCM_8_SHA256',
    category: 'tls13',
    keyExchange: 'ECDHE/DHE (negotiated)',
    authentication: 'Certificate',
    encryption: 'AES-128-CCM-8',
    mac: 'AEAD',
    quantumVulnerable: true,
    riskLevel: 'HIGH',
    description: 'TLS 1.3 with truncated AES-128-CCM-8 — short tag, reduced security margin',
  },
]

/**
 * Classify a cipher suite by its standard name
 */
export function classifyCipherSuite(
  standardName: string,
  protocol: string = ''
): CipherSuiteDetail | null {
  // Direct lookup
  const exact = CIPHER_SUITE_DB.find(cs => cs.name === standardName)
  if (exact) {
    return {
      ...exact,
      standardName: exact.name,
    }
  }

  // Fuzzy match — try to classify from the name pattern
  return classifyFromPattern(standardName, protocol)
}

/**
 * Classify a cipher suite from its name pattern when not in the database
 */
function classifyFromPattern(name: string, protocol: string): CipherSuiteDetail | null {
  if (!name || name === 'unknown') return null

  let category: CipherSuiteCategory = 'other'
  let keyExchange = 'unknown'
  let authentication = 'unknown'
  let encryption = 'unknown'
  let mac = 'unknown'
  let quantumVulnerable = true
  let riskLevel: ThreatLevel = 'HIGH'
  let description = 'Cipher suite detected'

  // Determine key exchange
  if (name.includes('TLS_RSA_WITH') || name.startsWith('RSA')) {
    category = 'rsa-kex'
    keyExchange = 'RSA'
    authentication = 'RSA'
    riskLevel = 'CRITICAL'
    description = 'RSA key exchange — no forward secrecy + quantum-vulnerable'
  } else if (name.includes('ECDHE_RSA') || name.includes('ECDHE-RSA')) {
    category = 'ecdhe-rsa'
    keyExchange = 'ECDHE'
    authentication = 'RSA'
    description = 'ECDHE + RSA — both quantum-vulnerable'
  } else if (name.includes('ECDHE_ECDSA') || name.includes('ECDHE-ECDSA')) {
    category = 'ecdhe-ecdsa'
    keyExchange = 'ECDHE'
    authentication = 'ECDSA'
    description = 'ECDHE + ECDSA — ECC-based, quantum-vulnerable via Shor\'s'
  } else if (name.includes('DHE_RSA') || name.includes('DHE-RSA')) {
    category = 'dhe-rsa'
    keyExchange = 'DHE'
    authentication = 'RSA'
    description = 'DHE + RSA — both quantum-vulnerable'
  } else if (name.includes('DHE_DSS') || name.includes('DHE-DSS')) {
    category = 'dhe-dss'
    keyExchange = 'DHE'
    authentication = 'DSS'
    riskLevel = 'CRITICAL'
    description = 'DHE + DSS — deprecated + quantum-vulnerable'
  } else if (protocol === 'TLSv1.3' || name.startsWith('TLS_AES') || name.startsWith('TLS_CHACHA')) {
    category = 'tls13'
    keyExchange = 'ECDHE/DHE (negotiated)'
    authentication = 'Certificate'
    riskLevel = 'MEDIUM'
    description = 'TLS 1.3 cipher — key exchange needs PQC upgrade'
  }

  // Determine encryption
  if (name.includes('AES_128_GCM') || name.includes('AES-128-GCM')) {
    encryption = 'AES-128-GCM'
    mac = 'AEAD'
  } else if (name.includes('AES_256_GCM') || name.includes('AES-256-GCM')) {
    encryption = 'AES-256-GCM'
    mac = 'AEAD'
  } else if (name.includes('AES_128_CBC') || name.includes('AES-128-CBC')) {
    encryption = 'AES-128-CBC'
  } else if (name.includes('AES_256_CBC') || name.includes('AES-256-CBC')) {
    encryption = 'AES-256-CBC'
  } else if (name.includes('CHACHA20') || name.includes('ChaCha20')) {
    encryption = 'CHACHA20-POLY1305'
    mac = 'AEAD'
  } else if (name.includes('3DES') || name.includes('DES-CBC3')) {
    encryption = '3DES-EDE-CBC'
    riskLevel = 'CRITICAL'
  } else if (name.includes('RC4')) {
    encryption = 'RC4'
    riskLevel = 'CRITICAL'
    description = 'RC4 stream cipher — classically broken + quantum-vulnerable key exchange'
  } else if (name.includes('NULL')) {
    encryption = 'NULL'
    riskLevel = 'CRITICAL'
    description = 'NULL encryption — no data confidentiality'
  } else if (name.includes('CCM_8')) {
    encryption = 'AES-128-CCM-8'
    mac = 'AEAD'
    riskLevel = 'HIGH'
  } else if (name.includes('CCM')) {
    encryption = 'AES-128-CCM'
    mac = 'AEAD'
  }

  // Determine MAC if not AEAD
  if (mac === 'unknown') {
    if (name.includes('SHA384')) mac = 'SHA-384'
    else if (name.includes('SHA256')) mac = 'SHA-256'
    else if (name.includes('SHA')) mac = 'SHA-1'
  }

  return {
    name,
    standardName: name,
    category,
    keyExchange,
    authentication,
    encryption,
    mac,
    quantumVulnerable,
    riskLevel,
    description,
  }
}

/**
 * Analyze multiple cipher suites and return classified details
 */
export function analyzeCipherSuites(
  negotiatedCipher: string | string[],
  protocol: string
): CipherSuiteDetail[] {
  const results: CipherSuiteDetail[] = []
  const seen = new Set<string>()

  const ciphers = Array.isArray(negotiatedCipher) ? negotiatedCipher : [negotiatedCipher]
  for (const cipher of ciphers) {
    const detail = classifyCipherSuite(cipher, protocol)
    if (detail && !seen.has(detail.standardName)) {
      seen.add(detail.standardName)
      results.push(detail)
    }
  }

  return results
}

export function getKnownCipherSuiteCount(): number {
  return CIPHER_SUITE_DB.length
}

/**
 * Get quantum risk summary for a set of cipher suites
 */
export function getCipherSuiteRiskSummary(suites: CipherSuiteDetail[]): {
  totalSuites: number
  criticalCount: number
  highCount: number
  mediumCount: number
  safeCount: number
  worstRisk: ThreatLevel
} {
  const criticalCount = suites.filter(s => s.riskLevel === 'CRITICAL').length
  const highCount = suites.filter(s => s.riskLevel === 'HIGH').length
  const mediumCount = suites.filter(s => s.riskLevel === 'MEDIUM').length
  const safeCount = suites.filter(s => s.riskLevel === 'SAFE').length

  let worstRisk: ThreatLevel = 'SAFE'
  if (criticalCount > 0) worstRisk = 'CRITICAL'
  else if (highCount > 0) worstRisk = 'HIGH'
  else if (mediumCount > 0) worstRisk = 'MEDIUM'

  return {
    totalSuites: suites.length,
    criticalCount,
    highCount,
    mediumCount,
    safeCount,
    worstRisk,
  }
}
