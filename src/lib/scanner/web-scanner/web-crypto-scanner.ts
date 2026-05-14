/**
 * QGuard Web Scanner — Web Cryptography Scanner
 * Analyzes website HTML/JavaScript for cryptographic implementations
 */

import type { WebCryptoScanResult, WebCryptoMatch, ThreatLevel } from './types'

const FETCH_TIMEOUT = 5_000 // 5 seconds per request
const MAX_SCRIPTS = 10
const MAX_CONTENT_SIZE = 1_000_000 // 1MB max per resource

// Web-specific crypto patterns (broader than repo patterns)
const WEB_CRYPTO_PATTERNS = [
  {
    regex: /crypto\.subtle\.generateKey/g,
    label: 'WebCrypto Key Generation',
    category: 'WebCrypto',
    algorithm: 'WebCrypto API',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'Browser WebCrypto key generation — inspect for algorithm type',
  },
  {
    regex: /crypto\.subtle\.importKey/g,
    label: 'WebCrypto Key Import',
    category: 'WebCrypto',
    algorithm: 'WebCrypto API',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'Browser WebCrypto key import — review imported key algorithm',
  },
  {
    regex: /crypto\.subtle\.sign/g,
    label: 'WebCrypto Signing',
    category: 'WebCrypto',
    algorithm: 'WebCrypto Signing',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'Browser WebCrypto signing operation — may use RSA/ECDSA',
  },
  {
    regex: /crypto\.subtle\.encrypt/g,
    label: 'WebCrypto Encryption',
    category: 'WebCrypto',
    algorithm: 'WebCrypto Encryption',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'Browser WebCrypto encryption — inspect for algorithm type',
  },
  {
    regex: /["']RSA-PSS["']/g,
    label: 'RSA-PSS Algorithm Reference',
    category: 'RSA',
    algorithm: 'RSA-PSS',
    threatLevel: 'CRITICAL' as ThreatLevel,
    description: 'RSA-PSS signature algorithm in browser code — quantum-vulnerable',
  },
  {
    regex: /["']RSA-OAEP["']/g,
    label: 'RSA-OAEP Algorithm Reference',
    category: 'RSA',
    algorithm: 'RSA-OAEP',
    threatLevel: 'CRITICAL' as ThreatLevel,
    description: 'RSA-OAEP encryption in browser code — quantum-vulnerable',
  },
  {
    regex: /["']RSASSA-PKCS1-v1_5["']/g,
    label: 'RSASSA-PKCS1 Algorithm',
    category: 'RSA',
    algorithm: 'RSASSA-PKCS1-v1_5',
    threatLevel: 'CRITICAL' as ThreatLevel,
    description: 'RSA PKCS#1 v1.5 signatures in browser — quantum-vulnerable',
  },
  {
    regex: /["']ECDSA["']/g,
    label: 'ECDSA Algorithm Reference',
    category: 'ECC',
    algorithm: 'ECDSA',
    threatLevel: 'HIGH' as ThreatLevel,
    description: 'ECDSA signature algorithm in browser code — quantum-vulnerable via Shor\'s',
  },
  {
    regex: /["']ECDH["']/g,
    label: 'ECDH Key Exchange Reference',
    category: 'ECC',
    algorithm: 'ECDH',
    threatLevel: 'HIGH' as ThreatLevel,
    description: 'ECDH key exchange in browser code — quantum-vulnerable',
  },
  {
    regex: /modulusLength\s*:\s*(\d+)/g,
    label: 'RSA Modulus Length',
    category: 'RSA',
    algorithm: 'RSA Key Size',
    threatLevel: 'HIGH' as ThreatLevel,
    description: 'RSA key size specification in browser crypto — quantum-vulnerable regardless of size',
  },
  {
    regex: /["']P-256["']|["']P-384["']|["']P-521["']/g,
    label: 'NIST Curve Reference',
    category: 'ECC',
    algorithm: 'NIST EC Curve',
    threatLevel: 'HIGH' as ThreatLevel,
    description: 'NIST elliptic curve in browser code — quantum-vulnerable via ECDLP',
  },
  {
    regex: /jsonwebtoken|jose|jwt-decode|jwt\.sign|jwt\.verify/g,
    label: 'JWT Library Usage',
    category: 'JWT',
    algorithm: 'JWT',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'JWT library detected — inspect for quantum-vulnerable signing algorithms (RS256, ES256)',
  },
  {
    regex: /CryptoJS|sjcl|forge\.pki|openpgp/g,
    label: 'Third-Party Crypto Library',
    category: 'Library',
    algorithm: 'Client-Side Crypto Library',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'Client-side crypto library — may contain quantum-vulnerable algorithms',
  },
  {
    regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
    label: 'Embedded Private Key',
    category: 'Key Management',
    algorithm: 'Private Key',
    threatLevel: 'CRITICAL' as ThreatLevel,
    description: 'Private key embedded in client-side code — critical security exposure',
  },
  {
    regex: /["']AES-CBC["']/g,
    label: 'AES-CBC Mode',
    category: 'Symmetric',
    algorithm: 'AES-CBC',
    threatLevel: 'LOW' as ThreatLevel,
    description: 'AES-CBC mode in browser — prefer AES-GCM for authenticated encryption',
  },

  // ── Additional WebCrypto patterns ─────────────────────────────────────────

  {
    regex: /crypto\.subtle\.deriveBits|crypto\.subtle\.deriveKey/g,
    label: 'WebCrypto Key Derivation',
    category: 'WebCrypto',
    algorithm: 'WebCrypto Key Derivation',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'Browser key derivation — inspect for ECDH-based derivation (quantum-vulnerable)',
  },
  {
    regex: /crypto\.subtle\.wrapKey|crypto\.subtle\.unwrapKey/g,
    label: 'WebCrypto Key Wrapping',
    category: 'WebCrypto',
    algorithm: 'WebCrypto Key Wrap',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'Browser key wrapping — inspect wrapping algorithm for quantum vulnerability',
  },
  {
    regex: /crypto\.subtle\.verify/g,
    label: 'WebCrypto Verify',
    category: 'WebCrypto',
    algorithm: 'WebCrypto Verification',
    threatLevel: 'MEDIUM' as ThreatLevel,
    description: 'Browser signature verification — may verify RSA/ECDSA signatures',
  },
  {
    regex: /window\.crypto\.getRandomValues/g,
    label: 'WebCrypto Random Values',
    category: 'WebCrypto',
    algorithm: 'CSPRNG',
    threatLevel: 'SAFE' as ThreatLevel,
    description: 'Cryptographically secure random number generation — quantum-safe operation',
  },
  {
    regex: /["']AES-KW["']/g,
    label: 'AES Key Wrap Algorithm',
    category: 'Symmetric',
    algorithm: 'AES-KW',
    threatLevel: 'LOW' as ThreatLevel,
    description: 'AES Key Wrap — symmetric, quantum impact limited to Grover\'s (halved security)',
  },
  {
    regex: /["']HKDF["']|["']PBKDF2["']/g,
    label: 'Key Derivation Function',
    category: 'KDF',
    algorithm: 'HKDF/PBKDF2',
    threatLevel: 'LOW' as ThreatLevel,
    description: 'Key derivation function — symmetric, minimal quantum impact',
  },
  {
    regex: /["']Ed25519["']/g,
    label: 'Ed25519 Algorithm Reference',
    category: 'ECC',
    algorithm: 'Ed25519',
    threatLevel: 'HIGH' as ThreatLevel,
    description: 'Ed25519 digital signature scheme — quantum-vulnerable via ECDLP on Curve25519',
  },
  {
    regex: /["']X25519["']/g,
    label: 'X25519 Key Exchange Reference',
    category: 'ECC',
    algorithm: 'X25519',
    threatLevel: 'HIGH' as ThreatLevel,
    description: 'X25519 Diffie-Hellman key exchange — quantum-vulnerable via ECDLP',
  },
  {
    regex: /ethereum|web3\.eth|ethers\.js|@ethersproject/g,
    label: 'Ethereum/Web3 Library',
    category: 'Blockchain',
    algorithm: 'Ethereum (secp256k1)',
    threatLevel: 'CRITICAL' as ThreatLevel,
    description: 'Ethereum/Web3 library — relies on secp256k1 ECDSA, quantum-vulnerable wallet signing',
  },
  {
    regex: /bitcoin|@bitcoinjs|bitcore/g,
    label: 'Bitcoin Library',
    category: 'Blockchain',
    algorithm: 'Bitcoin (secp256k1)',
    threatLevel: 'CRITICAL' as ThreatLevel,
    description: 'Bitcoin library — relies on secp256k1 ECDSA, quantum-vulnerable transaction signing',
  },
  {
    regex: /sodium\.crypto_sign|sodium\.crypto_box|sodium\.crypto_secretbox/g,
    label: 'Libsodium Browser API',
    category: 'Library',
    algorithm: 'Libsodium',
    threatLevel: 'HIGH' as ThreatLevel,
    description: 'Libsodium in browser — uses Curve25519/Ed25519, quantum-vulnerable for asymmetric ops',
  },
  {
    regex: /tweetnacl|nacl\.box|nacl\.sign/g,
    label: 'TweetNaCl Usage',
    category: 'Library',
    algorithm: 'TweetNaCl',
    threatLevel: 'HIGH' as ThreatLevel,
    description: 'TweetNaCl library — Curve25519 key exchange + Ed25519 signatures, quantum-vulnerable',
  },
]

/**
 * Fetch a URL with timeout and size limit
 */
async function safeFetch(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'QGuard-Scanner/2.4',
        'Accept': 'text/html,application/javascript,text/javascript',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!response.ok) return null

    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_CONTENT_SIZE) return null

    const text = await response.text()
    return text.length > MAX_CONTENT_SIZE ? text.substring(0, MAX_CONTENT_SIZE) : text
  } catch {
    return null
  }
}

/**
 * Extract script sources and inline scripts from HTML
 */
function extractScripts(html: string, baseUrl: string): { inline: string[]; external: string[] } {
  const inline: string[] = []
  const external: string[] = []

  // Extract external script URLs
  const srcPattern = /<script[^>]+src=["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = srcPattern.exec(html)) !== null) {
    let src = match[1]
    // Resolve relative URLs
    if (src.startsWith('//')) {
      src = 'https:' + src
    } else if (src.startsWith('/')) {
      try {
        const url = new URL(baseUrl)
        src = `${url.protocol}//${url.host}${src}`
      } catch {
        continue
      }
    } else if (!src.startsWith('http')) {
      try {
        src = new URL(src, baseUrl).href
      } catch {
        continue
      }
    }
    external.push(src)
  }

  // Extract inline scripts
  const inlinePattern = /<script(?:\s[^>]*)?>([^]*?)<\/script>/gi
  while ((match = inlinePattern.exec(html)) !== null) {
    const content = match[1].trim()
    if (content && !match[0].includes('src=')) {
      inline.push(content)
    }
  }

  return { inline, external: external.slice(0, MAX_SCRIPTS) }
}

/**
 * Scan content for web crypto patterns
 */
function scanContent(
  content: string,
  source: string
): WebCryptoMatch[] {
  const matches: WebCryptoMatch[] = []
  const lines = content.split('\n')

  for (const pattern of WEB_CRYPTO_PATTERNS) {
    // Reset regex lastIndex for global patterns
    pattern.regex.lastIndex = 0

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum]
      pattern.regex.lastIndex = 0
      const regexMatch = pattern.regex.exec(line)

      if (regexMatch) {
        // Avoid duplicates
        const isDupe = matches.some(
          m => m.source === source && m.pattern === pattern.label && Math.abs(m.line - (lineNum + 1)) < 3
        )
        if (isDupe) continue

        const snippetStart = Math.max(0, lineNum - 1)
        const snippetEnd = Math.min(lines.length, lineNum + 2)
        const snippet = lines.slice(snippetStart, snippetEnd).join('\n').substring(0, 200)

        matches.push({
          source,
          line: lineNum + 1,
          pattern: pattern.label,
          category: pattern.category,
          algorithm: pattern.algorithm,
          snippet,
          threatLevel: pattern.threatLevel,
          description: pattern.description,
        })
      }
    }
  }

  return matches
}

/**
 * Scan a website for client-side cryptographic implementations
 */
export async function scanWebCrypto(url: string): Promise<WebCryptoScanResult> {
  const allPatterns: WebCryptoMatch[] = []
  let scriptsAnalyzed = 0

  // Step 1: Fetch the main page HTML
  const html = await safeFetch(url)
  if (!html) {
    return {
      url,
      pagesScanned: 0,
      scriptsAnalyzed: 0,
      patterns: [],
    }
  }

  // Step 2: Scan the HTML itself for inline crypto
  const htmlMatches = scanContent(html, `${url} (inline)`)
  allPatterns.push(...htmlMatches)

  // Step 3: Extract and scan scripts
  const { inline, external } = extractScripts(html, url)

  // Scan inline scripts
  for (let i = 0; i < inline.length; i++) {
    const matches = scanContent(inline[i], `${url} (inline script #${i + 1})`)
    allPatterns.push(...matches)
    scriptsAnalyzed++
  }

  // Scan external scripts
  for (const scriptUrl of external) {
    const scriptContent = await safeFetch(scriptUrl)
    if (scriptContent) {
      const matches = scanContent(scriptContent, scriptUrl)
      allPatterns.push(...matches)
      scriptsAnalyzed++
    }
  }

  return {
    url,
    pagesScanned: 1,
    scriptsAnalyzed,
    patterns: allPatterns,
  }
}
