/**
 * QGuard Web Scanner — TLS Handshake Analyzer
 * Performs real TLS connections and extracts cryptographic metadata
 */

import * as tls from 'node:tls'
import * as net from 'node:net'
import * as dns from 'node:dns'
import { promisify } from 'node:util'
import type { TlsAnalysisResult, CipherSuiteDetail, TlsProtocolProbe } from './types'
import { parseCertificateFromPeer } from './certificate-parser'
import { classifyCipherSuite } from './cipher-suite-analyzer'

const dnsResolve4 = promisify(dns.resolve4)

const CONNECTION_TIMEOUT = 10_000 // 10 seconds
const PROBE_TIMEOUT = 3_500
const TLS_PROTOCOLS: tls.SecureVersion[] = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3']
const TLS12_CIPHER_PROBES: { standardName: string; opensslName: string }[] = [
  { standardName: 'TLS_RSA_WITH_AES_128_GCM_SHA256', opensslName: 'AES128-GCM-SHA256' },
  { standardName: 'TLS_RSA_WITH_AES_256_GCM_SHA384', opensslName: 'AES256-GCM-SHA384' },
  { standardName: 'TLS_RSA_WITH_AES_128_CBC_SHA', opensslName: 'AES128-SHA' },
  { standardName: 'TLS_RSA_WITH_AES_256_CBC_SHA', opensslName: 'AES256-SHA' },
  { standardName: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256', opensslName: 'ECDHE-RSA-AES128-GCM-SHA256' },
  { standardName: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384', opensslName: 'ECDHE-RSA-AES256-GCM-SHA384' },
  { standardName: 'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256', opensslName: 'ECDHE-ECDSA-AES128-GCM-SHA256' },
  { standardName: 'TLS_DHE_RSA_WITH_AES_128_GCM_SHA256', opensslName: 'DHE-RSA-AES128-GCM-SHA256' },
]
const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fd00:/i,
  /^fe80:/i,
  /^localhost$/i,
]

/**
 * Validate that a target is not a private/internal IP address (SSRF protection)
 */
function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(pattern => pattern.test(ip))
}

function lookupAll(hostname: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true, verbatim: false }, (err, addresses) => {
      if (err) {
        reject(err)
        return
      }
      resolve(addresses.map((address) => address.address))
    })
  })
}

/**
 * Extract hostname and port from various target formats
 */
export function parseTarget(target: string, targetType: string): { hostname: string; port: number } {
  let hostname = target
  let port = 443

  if (targetType === 'url') {
    try {
      const url = new URL(target)
      hostname = url.hostname
      port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80)
    } catch {
      hostname = target
    }
  } else if (targetType === 'domain') {
    // Remove any protocol prefix
    hostname = target.replace(/^https?:\/\//, '').split('/')[0]
    // Check for port
    const parts = hostname.split(':')
    if (parts.length === 2) {
      hostname = parts[0]
      port = parseInt(parts[1], 10)
    }
  } else if (targetType === 'ip') {
    const parts = target.split(':')
    if (parts.length === 2) {
      hostname = parts[0]
      port = parseInt(parts[1], 10)
    }
  }

  return { hostname, port }
}

/**
 * Resolve hostname to IP and validate it's not private
 */
async function resolveAndValidate(hostname: string): Promise<string> {
  // If it's already an IP, validate directly
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error(`SSRF protection: scanning private IP addresses is not allowed`)
    }
    return hostname
  }

  // Resolve hostname. Prefer authoritative A records, but fall back to OS
  // lookup because some local Windows DNS/proxy setups reject queryA while
  // normal socket connections can still resolve the host.
  const resolutionErrors: string[] = []
  let addresses: string[] = []

  try {
    addresses = await dnsResolve4(hostname)
  } catch (err) {
    if ((err as Error).message?.includes('SSRF')) throw err
    resolutionErrors.push((err as Error).message)
  }

  if (!addresses.length) {
    try {
      addresses = await lookupAll(hostname)
    } catch (err) {
      resolutionErrors.push((err as Error).message)
    }
  }

  if (!addresses.length) {
    const detail = resolutionErrors.filter(Boolean).join('; ') || 'no DNS records returned'
    throw new Error(`DNS resolution failed for ${hostname}: ${detail}`)
  }

  // Validate resolved IPs
  for (const ip of addresses) {
    if (isPrivateIp(ip)) {
      throw new Error(`SSRF protection: ${hostname} resolves to private IP`)
    }
  }

  return addresses[0]
}

function normalizeCipherName(cipher: tls.CipherNameAndProtocol | null): string {
  return cipher?.standardName || cipher?.name || 'unknown'
}

function extractKeyExchange(
  cipherName: string,
  ephemeralKey: ReturnType<tls.TLSSocket['getEphemeralKeyInfo']>
): { keyExchange: string; ephemeralKeyType: string | null; ephemeralKeySize: number | null; negotiatedCurve: string | null } {
  let keyExchange = 'unknown'
  let ephemeralKeyType: string | null = null
  let ephemeralKeySize: number | null = null
  let negotiatedCurve: string | null = null

  if (ephemeralKey) {
    const ek = ephemeralKey as { type?: string; size?: number; name?: string }
    ephemeralKeyType = ek.type || null
    ephemeralKeySize = ek.size || null

    if (ek.type === 'ECDH') {
      negotiatedCurve = ek.name || null
      keyExchange = `ECDHE ${ek.name || ''} (${ek.size}-bit)`.trim()
    } else if (ek.type === 'DH') {
      keyExchange = `DHE (${ek.size}-bit)`
    } else if (ek.type) {
      keyExchange = `${ek.type} (${ek.size}-bit)`
    }
  }

  if (keyExchange === 'unknown') {
    if (cipherName.includes('TLS_RSA_WITH') || cipherName.startsWith('RSA-')) {
      keyExchange = 'RSA'
    } else if (cipherName.includes('ECDHE')) {
      keyExchange = 'ECDHE'
    } else if (cipherName.includes('DHE')) {
      keyExchange = 'DHE'
    }
  }

  return { keyExchange, ephemeralKeyType, ephemeralKeySize, negotiatedCurve }
}

function connectTls(
  hostname: string,
  port: number,
  options: Partial<tls.ConnectionOptions> = {},
  timeoutMs = CONNECTION_TIMEOUT
): Promise<TlsAnalysisResult> {
  return new Promise((resolve, reject) => {
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | undefined
    const socket = tls.connect(
      {
        host: hostname,
        port,
        servername: hostname,
        rejectUnauthorized: false,
        timeout: timeoutMs,
        ...options,
      },
      () => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)

        try {
          const protocol = socket.getProtocol() || 'unknown'
          const cipher = socket.getCipher()
          const cipherName = normalizeCipherName(cipher)
          const ephemeralKey = socket.getEphemeralKeyInfo()
          const keyInfo = extractKeyExchange(cipherName, ephemeralKey)
          const peerCert = socket.getPeerCertificate(true)

          let certInfo = null
          if (peerCert && Object.keys(peerCert).length > 0) {
            try {
              certInfo = parseCertificateFromPeer(peerCert)
            } catch {
              // Certificate parsing failed; retain the handshake metadata.
            }
          }

          const cipherSuites: CipherSuiteDetail[] = []
          const detail = classifyCipherSuite(cipherName, protocol)
          if (detail) {
            cipherSuites.push(detail)
          }

          const result: TlsAnalysisResult = {
            tlsVersion: protocol,
            cipherSuite: cipherName,
            keyExchange: keyInfo.keyExchange,
            signatureAlgorithm: extractSignatureAlgorithm(cipher?.name || '', certInfo?.signatureAlgorithm || ''),
            supportedProtocols: [protocol],
            protocolSupport: [],
            negotiatedCurve: keyInfo.negotiatedCurve,
            serverName: hostname,
            peerCertificate: certInfo,
            cipherSuites,
            ephemeralKeyType: keyInfo.ephemeralKeyType,
            ephemeralKeySize: keyInfo.ephemeralKeySize,
          }

          socket.destroy()
          resolve(result)
        } catch (err) {
          socket.destroy()
          reject(new Error(`TLS analysis failed: ${(err as Error).message}`))
        }
      }
    )

    timeout = setTimeout(() => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(new Error(`TLS connection timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    socket.on('error', (err) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      reject(new Error(`TLS connection failed to ${hostname}:${port}: ${err.message}`))
    })

    socket.on('timeout', () => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      socket.destroy()
      reject(new Error(`TLS connection timeout to ${hostname}:${port}`))
    })
  })
}

async function probeProtocol(hostname: string, port: number, protocol: tls.SecureVersion): Promise<TlsProtocolProbe> {
  try {
    const result = await connectTls(
      hostname,
      port,
      {
        minVersion: protocol,
        maxVersion: protocol,
        ciphers: protocol === 'TLSv1.3' ? undefined : 'DEFAULT:@SECLEVEL=0',
      },
      PROBE_TIMEOUT
    )

    return {
      protocol,
      supported: true,
      cipherSuite: result.cipherSuite,
      keyExchange: result.keyExchange,
    }
  } catch (err) {
    return {
      protocol,
      supported: false,
      cipherSuite: null,
      keyExchange: null,
      error: (err as Error).message,
    }
  }
}

async function enumerateTls12CipherSuites(hostname: string, port: number): Promise<CipherSuiteDetail[]> {
  const probes = await Promise.all(
    TLS12_CIPHER_PROBES.map(async (probe) => {
      try {
        const result = await connectTls(
          hostname,
          port,
          {
            minVersion: 'TLSv1.2',
            maxVersion: 'TLSv1.2',
            ciphers: `${probe.opensslName}:@SECLEVEL=0`,
          },
          PROBE_TIMEOUT
        )
        return classifyCipherSuite(probe.standardName || result.cipherSuite, result.tlsVersion)
      } catch {
        return null
      }
    })
  )

  const seen = new Set<string>()
  return probes.filter((suite): suite is CipherSuiteDetail => {
    if (!suite || seen.has(suite.standardName)) return false
    seen.add(suite.standardName)
    return true
  })
}

/**
 * Perform a TLS handshake and extract cryptographic metadata
 */
export async function analyzeTls(
  hostname: string,
  port: number = 443
): Promise<TlsAnalysisResult> {
  // Resolve and validate target
  await resolveAndValidate(hostname)

  const primary = await connectTls(
    hostname,
    port,
    {
      minVersion: 'TLSv1' as tls.SecureVersion,
      ciphers: 'DEFAULT:@SECLEVEL=0',
    },
    CONNECTION_TIMEOUT
  )

  const [protocolSupport, enumeratedTls12Suites] = await Promise.all([
    Promise.all(TLS_PROTOCOLS.map((protocol) => probeProtocol(hostname, port, protocol))),
    enumerateTls12CipherSuites(hostname, port),
  ])

  const supportedProtocols = protocolSupport
    .filter((probe) => probe.supported)
    .map((probe) => probe.protocol)

  const cipherSuites = [...primary.cipherSuites]
  const seen = new Set(cipherSuites.map((suite) => suite.standardName))
  for (const suite of enumeratedTls12Suites) {
    if (!seen.has(suite.standardName)) {
      seen.add(suite.standardName)
      cipherSuites.push(suite)
    }
  }

  return {
    ...primary,
    supportedProtocols,
    protocolSupport,
    cipherSuites,
  }
}

/**
 * Extract signature algorithm from cipher and certificate info
 */
function extractSignatureAlgorithm(cipherName: string, certSigAlg: string): string {
  if (certSigAlg) return certSigAlg

  // Infer from cipher suite name
  if (cipherName.includes('ECDSA')) return 'ECDSA'
  if (cipherName.includes('RSA')) return 'RSA'
  if (cipherName.includes('DSS')) return 'DSS'

  return 'unknown'
}

/**
 * Attempt TLS analysis with fallback ports
 */
export async function analyzeTlsWithFallback(
  hostname: string,
  preferredPort: number = 443
): Promise<TlsAnalysisResult> {
  const portsToTry = [preferredPort]
  if (preferredPort !== 443) portsToTry.push(443)
  if (preferredPort !== 8443) portsToTry.push(8443)

  let lastError: Error | null = null

  for (const port of portsToTry) {
    try {
      return await analyzeTls(hostname, port)
    } catch (err) {
      lastError = err as Error
    }
  }

  throw lastError || new Error(`TLS analysis failed for ${hostname}`)
}
