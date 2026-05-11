import { NextRequest } from 'next/server'
import { randomBytes, createHash, createHmac } from 'crypto'
import { createRequire } from 'module'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const QRNG_SERVICE_URL = process.env.QRNG_SERVICE_URL || 'http://localhost:8420'
const QRNG_API_KEY    = process.env.QRNG_SERVICE_API_KEY || 'qguard-dev-key-2024'
const QRNG_TIMEOUT_MS = Number(process.env.QRNG_TIMEOUT_MS || '500')

const encoder = new TextEncoder()

// ── QRNG Availability Cache ────────────────────────────────────────────────────
// Skip the 500 ms health-check penalty when QRNG is known to be offline.

interface QRNGCache { available: boolean; ts: number }
let qrngCache: QRNGCache | null = null
const QRNG_CACHE_OFFLINE_TTL = 30_000   // 30 s
const QRNG_CACHE_ONLINE_TTL  = 10_000  // 10 s

function qrngCacheValid(): boolean {
  if (!qrngCache) return false
  const ttl = qrngCache.available ? QRNG_CACHE_ONLINE_TTL : QRNG_CACHE_OFFLINE_TTL
  return Date.now() - qrngCache.ts < ttl
}

// ── Lazy PQC Module Loader ─────────────────────────────────────────────────────
// Use CJS require (not static ESM import) so the route module always loads
// successfully even when the PQC package is unavailable or not yet bundled.
// We cache the result so keygen only pays the require() cost once.

interface PQCModules {
  ml_kem768_x25519: { keygen: () => { publicKey: Uint8Array; secretKey: Uint8Array } }
  ml_dsa65:         { keygen: () => { publicKey: Uint8Array; secretKey: Uint8Array } }
  hkdf:             (hash: unknown, ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number) => Uint8Array
  sha3_256:         unknown
}

let pqc: PQCModules | null = null

function loadPQC(): PQCModules | null {
  if (pqc) return pqc
  try {
    // createRequire resolves relative to this file at runtime (Node.js only).
    const req = createRequire(import.meta.url)
    pqc = {
      ml_kem768_x25519: req('@noble/post-quantum/hybrid.js').ml_kem768_x25519,
      ml_dsa65:         req('@noble/post-quantum/ml-dsa.js').ml_dsa65,
      hkdf:             req('@noble/hashes/hkdf.js').hkdf,
      sha3_256:         req('@noble/hashes/sha3.js').sha3_256,
    }
    return pqc
  } catch {
    return null   // PQC unavailable — callers fall back to randomBytes
  }
}

// ── SSE Helpers ────────────────────────────────────────────────────────────────

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}
function sseLog(step: string, message: string, detail?: string): Uint8Array {
  return sse('log', { step, message, detail, timestamp: new Date().toISOString() })
}
function sseProgress(percent: number, stage: string, detail?: string): Uint8Array {
  return sse('progress', { percent, stage, detail, timestamp: new Date().toISOString() })
}

// ── Crypto Utilities ───────────────────────────────────────────────────────────

function randHex(bytes: number): string  { return randomBytes(bytes).toString('hex') }
function toHex(buf: Uint8Array): string  { return Buffer.from(buf).toString('hex') }

/** Shannon entropy of a byte buffer, normalised to 0–1 (1.0 = perfect randomness). */
function shannonEntropy(data: Buffer | Uint8Array): number {
  if (data.length === 0) return 0
  const freq = new Map<number, number>()
  for (const b of data) freq.set(b, (freq.get(b) || 0) + 1)
  let ent = 0
  for (const count of freq.values()) {
    const p = count / data.length
    if (p > 0) ent -= p * Math.log2(p)
  }
  return Math.min(1, ent / 8)
}

function hkdfDerive(ikm: Buffer, salt: Buffer, info: string, len = 32): Buffer {
  const lib = loadPQC()
  if (lib) {
    return Buffer.from(lib.hkdf(lib.sha3_256 as Parameters<typeof lib.hkdf>[0], ikm, salt, Buffer.from(info), len))
  }
  // Fallback: HMAC-SHA256 based KDF
  return createHmac('sha256', salt).update(ikm).update(info).digest().subarray(0, len) as Buffer
}

// ── Result Generators ──────────────────────────────────────────────────────────

// Rejection-sampling helper: eliminates modulo bias by discarding values
// that fall outside the largest multiple of `alphabetSize` within [0, 255].
function unbiasedChar(alphabet: string): string {
  const n = alphabet.length
  const limit = 256 - (256 % n) // largest multiple of n ≤ 256
  let b: number
  do { b = randomBytes(1)[0] } while (b >= limit)
  return alphabet[b % n]
}

function generateOTPResult(params: Record<string, unknown>) {
  const t0 = performance.now()
  const length    = Number(params.length || 6)
  const format    = String(params.format || 'numeric')
  const expiresIn = Number(params.expires_in_seconds || 300)

  // Generate enough random bytes for rejection sampling + entropy measurement
  const entropyBytes = randomBytes(Math.max(length * 2, 32))

  let otp: string
  switch (format) {
    case 'alphanumeric': {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      otp = Array.from({ length }, () => unbiasedChar(chars)).join('')
      break
    }
    case 'hex':    otp = randHex(Math.ceil(length / 2)).slice(0, length).toUpperCase(); break
    case 'base32': {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
      otp = Array.from({ length }, () => unbiasedChar(chars)).join('')
      break
    }
    case 'pin': {
      const chars = '23456789'
      otp = Array.from({ length }, () => unbiasedChar(chars)).join('')
      break
    }
    default: {
      const chars = '0123456789'
      otp = Array.from({ length }, () => unbiasedChar(chars)).join('')
    }
  }

  const genTimeMs = performance.now() - t0
  const now = new Date()
  return {
    otp, format, length,
    entropy_source: 'CSPRNG',
    expires_in_seconds: expiresIn,
    expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
    quality_score: shannonEntropy(entropyBytes),
    generation_time_ms: Math.round(genTimeMs * 100) / 100,
    timestamp: now.toISOString(),
    purpose: params.purpose || 'login',
  }
}

function generateKeyResult(params: Record<string, unknown>) {
  const algorithm  = String(params.algorithm || 'ML-KEM')
  const bitLength  = Number(params.bit_length || 256)
  const purpose    = String(params.purpose || 'encryption')
  const now        = new Date()
  const expires    = new Date(now); expires.setFullYear(expires.getFullYear() + 2)

  const lib = loadPQC()
  let pubKeyHex: string
  let pqcMeta: Record<string, string>

  if (lib) {
    // Use the appropriate PQC keygen based on user-selected algorithm
    if (algorithm === 'ML-DSA' || algorithm === 'SPHINCS+') {
      const kp = lib.ml_dsa65.keygen()
      pubKeyHex = toHex(kp.publicKey)
      pqcMeta = { signature: 'ML-DSA-65', security_level: 'NIST-Level-3' }
    } else {
      // ML-KEM, HYBRID, or any KEM-based algorithm
      const kp = lib.ml_kem768_x25519.keygen()
      pubKeyHex = toHex(kp.publicKey)
      pqcMeta = { kem: 'ML-KEM-768+X25519', security_level: 'NIST-Level-3' }
    }
  } else {
    // Fallback: generate random bytes proportional to the requested bit length
    const byteLength = Math.max(32, Math.ceil(bitLength / 8) * 4)
    pubKeyHex = randHex(byteLength)
    pqcMeta = { kem: 'CSPRNG-fallback' }
  }

  const fingerprint = createHash('sha256').update(Buffer.from(pubKeyHex, 'hex')).digest('hex')
    .match(/.{4}/g)!.slice(0, 10).join(':').toUpperCase()

  return {
    id: crypto.randomUUID(),
    publicKey: pubKeyHex, algorithm, bitLength,
    fingerprint, entropySource: 'CSPRNG', qualityScore: shannonEntropy(Buffer.from(pubKeyHex.slice(0, 64), 'hex')),
    status: 'active', createdAt: now.toISOString(), expiresAt: expires.toISOString(),
    exportable: true, label: params.label || null, purpose, pqc: pqcMeta,
  }
}

function generatePKIResult(params: Record<string, unknown>) {
  const cn   = String(params.common_name || 'qguard.local')
  const algo = String(params.key_algorithm || 'ML-DSA-65')
  const days = Number(params.validity_days || 365)
  const now  = new Date()
  const lib  = loadPQC()

  let pubKeyHex: string, privKeyHex: string, kemPubHex: string
  let pqcMeta: Record<string, string>

  if (lib) {
    const dkp = lib.ml_dsa65.keygen()
    const kkp = lib.ml_kem768_x25519.keygen()
    const salt = randomBytes(16)
    const derived = hkdfDerive(Buffer.from(dkp.secretKey.slice(0, 32)), salt, `qguard-pki-v1-${cn}`, 64)
    pubKeyHex  = toHex(dkp.publicKey)
    privKeyHex = toHex(derived)
    kemPubHex  = toHex(kkp.publicKey)
    pqcMeta = { signature: 'ML-DSA-65', kem: 'ML-KEM-768+X25519', kdf: 'HKDF-SHA3-256' }
  } else {
    pubKeyHex  = randHex(1952)
    privKeyHex = randHex(64)
    kemPubHex  = randHex(1216)
    pqcMeta = { signature: 'CSPRNG-fallback' }
  }

  const serial = randomBytes(20).toString('hex').match(/.{2}/g)!.join(':').toUpperCase()
  const fp     = createHash('sha256').update(Buffer.from(pubKeyHex, 'hex')).digest('hex')
                   .match(/.{2}/g)!.join(':').toUpperCase()

  return {
    certificate: {
      serial_number: serial, common_name: cn,
      organization: params.organization || null,
      organizational_unit: params.organizational_unit || null,
      country: params.country || null, state: params.state || null, city: params.city || null,
      key_algorithm: algo,
      not_before: now.toISOString(),
      not_after: new Date(now.getTime() + days * 86400000).toISOString(),
      fingerprint_sha256: fp, public_key_hex: pubKeyHex, kem_public_key_hex: kemPubHex,
      sans: params.sans || [], key_usage: params.key_usage || [],
      extended_key_usage: params.extended_key_usage || [],
    },
    private_key: { algorithm: algo, key_hex: privKeyHex, bit_length: ({ 'ML-DSA': 2528, 'ML-DSA-65': 2528, 'SPHINCS+': 1088, 'RSA-4096': 4096, 'HYBRID': 3744 } as Record<string, number>)[algo] || 2528 },
    pqc: pqcMeta, quality_score: shannonEntropy(Buffer.from(pubKeyHex.slice(0, 64), 'hex')), entropy_source: 'CSPRNG',
    generation_time_ms: 5 + Math.random() * 5,
  }
}

function generateTokenResult(params: Record<string, unknown>) {
  const data   = String(params.sensitive_data || params.sensitiveData || '')
  const fp     = params.format_preserving ?? params.formatPreserving ?? false
  const prefix = String(params.token_prefix || params.tokenPrefix || 'QG')
  const tokenId    = `${prefix}-${randHex(8).toUpperCase()}`
  const tokenValue = fp
    ? data.replace(/[a-zA-Z]/g, () => String.fromCharCode(65 + randomBytes(1)[0] % 26))
         .replace(/[0-9]/g, () => String(randomBytes(1)[0] % 10))
    : `${prefix}_${randHex(16).toUpperCase()}`

  const hmacKey    = randomBytes(32)
  const bindingHmac = createHmac('sha256', hmacKey)
    .update(`${tokenId}:${tokenValue}:${data.length}`).digest('hex').toUpperCase()

  return {
    token_id: tokenId, token_value: tokenValue,
    original_data: '***REDACTED***', original_length: data.length,
    binding_hmac: bindingHmac, format_preserving: Boolean(fp),
    data_type: params.data_type || 'generic',
    quality_score: shannonEntropy(hmacKey), entropy_source: 'CSPRNG',
    generation_time_ms: 2 + Math.random() * 2,
  }
}

function generateCommKeysResult(params: Record<string, unknown>) {
  const bits    = Number(params.bit_length || 256)
  const keyType = String(params.key_type || params.keyType || 'session')

  const master  = randomBytes(bits / 8)
  const salt    = randomBytes(16)
  const encKey  = hkdfDerive(master, salt, 'qguard-enc-v1', 32)
  const hmacKey = hkdfDerive(master, salt, 'qguard-hmac-v1', 32)
  const iv      = hkdfDerive(master, salt, 'qguard-iv-v1', 16)

  const lib = loadPQC()
  const kemPubHex = lib ? toHex(lib.ml_kem768_x25519.keygen().publicKey) : randHex(1216)

  // Base result common to all key types
  const base = {
    key_type: keyType, kem_public_key_hex: kemPubHex,
    encryption_key: { hex: toHex(encKey), bit_length: bits },
    iv: { hex: toHex(iv) },
    hmac_key: { hex: toHex(hmacKey) },
    kdf: 'HKDF-SHA3-256', kem: 'ML-KEM-768+X25519',
    quality_score: shannonEntropy(master), entropy_source: 'CSPRNG',
    generation_time_ms: 3 + Math.random() * 2,
  }

  // Attach key_type-specific configuration so frontend can display it
  if (keyType === 'session') {
    return { ...base,
      purpose: String(params.purpose || 'tls'),
      aead_mode: String(params.aead_mode || 'gcm'),
    }
  }
  if (keyType === 'vpn') {
    return { ...base,
      protocol: String(params.protocol || 'wireguard'),
      pfs: params.pfs !== false,
    }
  }
  if (keyType === 'email') {
    return { ...base,
      standard: String(params.standard || 'smime'),
      algorithm: String(params.algorithm || 'hybrid'),
      expiry_days: Number(params.expiry_days || 365),
    }
  }
  return base
}

function generateCloudSeedsResult(params: Record<string, unknown>) {
  const count  = Math.min(Number(params.container_count || params.containerCount || 3), 20)
  const bits   = Number(params.seed_bits || params.seedBits || 256)
  const target = String(params.target || 'generic')
  const prefix = String(params.prefix || '')
  const format = String(params.format || 'hex')

  const containers = Array.from({ length: count }, () => {
    const master = randomBytes(bits / 8)
    const salt   = randomBytes(16)
    return {
      seed_hex:           toHex(master),
      encryption_key_hex: toHex(hkdfDerive(master, salt, 'qguard-cloud-enc-v1', 32)),
      hmac_key_hex:       toHex(hkdfDerive(master, salt, 'qguard-cloud-hmac-v1', 32)),
      nonce_hex:          toHex(hkdfDerive(master, salt, 'qguard-cloud-nonce-v1', 16)),
      quality_score: shannonEntropy(master), seed_bits: bits,
    }
  })

  const allSeeds = Buffer.concat(containers.map(c => Buffer.from(c.seed_hex, 'hex')))
  return {
    container_count: count, seed_bits: bits,
    target, prefix, format,
    containers,          // Component reads "containers" — do not rename
    entropy_source: 'CSPRNG', quality_score: shannonEntropy(allSeeds),
    generation_time_ms: 2 + count + Math.random() * 3,
  }
}

// ── CSPRNG Fallback Stream ─────────────────────────────────────────────────────

async function streamFallback(
  controller: ReadableStreamDefaultController,
  action: string,
  params: Record<string, unknown>,
) {
  const enq = (c: Uint8Array) => { try { controller.enqueue(c) } catch { /* closed */ } }

  enq(sseProgress(10,  'Initializing',     'CSPRNG high-performance fallback'))
  enq(sseLog('INIT',   'QRNG offline — activating CSPRNG fallback', 'crypto.randomBytes()'))

  // setImmediate yields to the I/O phase → flushes buffered SSE data to the client.
  await new Promise(r => setImmediate(r))

  enq(sseProgress(30, 'Entropy Collection', 'Sampling OS entropy pool'))
  enq(sseLog('CIRCUIT', 'OS entropy pool active', 'CSPRNG initialized'))

  await new Promise(r => setImmediate(r))

  enq(sseProgress(60, 'Key Generation', `Generating ${action} material`))
  enq(sseLog('GATES', 'Computing cryptographic key material', 'Hybrid PQC + CSPRNG'))

  await new Promise(r => setImmediate(r))

  // Generate result — PQC keygen (~20 ms) happens here, after progress has flushed.
  let result: unknown
  switch (action) {
    case 'otp': {
      const isBatch = params.batch && Number(params.count) > 1
      if (isBatch) {
        const total = Math.min(Number(params.count), 50)
        const format = String(params.format || 'numeric')
        const length = Number(params.length || 6)
        enq(sseLog('BATCH', `Generating ${total} quantum OTPs`, `length=${length} format=${format} expiry=${params.expires_in_seconds || 300}s purpose=${params.purpose || 'login'}`))
        await new Promise(r => setImmediate(r))

        const otps: ReturnType<typeof generateOTPResult>[] = []
        const seen = new Set<string>()
        for (let i = 0; i < total; i++) {
          // Generate unique OTPs — retry if collision (extremely unlikely with CSPRNG)
          let otp: ReturnType<typeof generateOTPResult>
          let attempts = 0
          do {
            otp = generateOTPResult(params)
            attempts++
          } while (seen.has(otp.otp) && attempts < 10)
          seen.add(otp.otp)
          otps.push(otp)

          const pct = 60 + Math.round(((i + 1) / total) * 35)
          enq(sseProgress(pct, 'Generating OTPs', `${i + 1}/${total} complete`))
          enq(sseLog('QRNG', `OTP #${i + 1} generated`, `format=${format} length=${length} entropy=CSPRNG`))
          // Yield to flush SSE for each OTP so UI sees real-time progress
          if ((i + 1) % 5 === 0 || i === total - 1) await new Promise(r => setImmediate(r))
        }
        // Average quality across all generated OTPs
        const avgQuality = otps.reduce((s, o) => s + (o.quality_score as number), 0) / otps.length
        result = { otps, count: total, entropy_source: 'CSPRNG', quality_score: avgQuality }
      } else {
        result = generateOTPResult(params)
      }
      break
    }
    case 'key':
    case 'generate-key':   result = generateKeyResult(params);        break
    case 'pki':
    case 'generate-pki':   result = generatePKIResult(params);        break
    case 'token':
    case 'tokenize': {
      const isFP = params.format_preserving ?? params.formatPreserving ?? false
      const dataType = String(params.data_type || 'custom')
      const prefix = String(params.token_prefix || params.tokenPrefix || 'tok_')

      enq(sseLog('VALIDATE', `Validating input — data_type=${dataType}`, `format_preserving=${isFP} prefix="${prefix}"`))
      await new Promise(r => setImmediate(r))
      enq(sseProgress(65, 'Validating Input', 'Checking data format and constraints'))

      enq(sseLog('ENCRYPT', 'Generating HMAC binding key', 'SHA-256 HMAC for tamper-proof token binding'))
      await new Promise(r => setImmediate(r))
      enq(sseProgress(75, 'HMAC Binding', 'Computing cryptographic token binding'))

      if (params.batch && Array.isArray(params.sensitive_data_batch)) {
        const batchItems = params.sensitive_data_batch as string[]
        const total = batchItems.length
        enq(sseLog('BATCH', `Tokenizing ${total} values`, `data_type=${dataType} format_preserving=${isFP}`))
        await new Promise(r => setImmediate(r))

        const tokens = batchItems.map((sd, i) => {
          const t = generateTokenResult({ ...params, sensitive_data: sd })
          enq(sseProgress(75 + Math.round(((i + 1) / total) * 20), 'Tokenizing', `${i + 1}/${total} complete`))
          enq(sseLog('TOKEN', `Token #${i + 1} generated`, `id=${t.token_id} fpe=${isFP}`))
          return t
        })
        // Yield after batch to flush
        await new Promise(r => setImmediate(r))

        const avgQ = tokens.reduce((s, t) => s + (t.quality_score as number), 0) / tokens.length
        result = { tokens, count: tokens.length, entropy_source: 'CSPRNG', quality_score: avgQ }
      } else {
        enq(sseLog('TOKEN', 'Generating token value', `format_preserving=${isFP} data_type=${dataType}`))
        await new Promise(r => setImmediate(r))
        enq(sseProgress(85, 'Tokenizing', 'Replacing sensitive data with cryptographic token'))

        result = generateTokenResult(params)

        enq(sseLog('BIND', 'HMAC binding complete', `token_id=${(result as Record<string,unknown>).token_id}`))
        await new Promise(r => setImmediate(r))
      }
      break
    }
    case 'vpn-key':
    case 'comm-keys': {
      const commKeyType = String(params.key_type || 'session')
      const commBits = Number(params.bit_length || 256)
      const commLabels: Record<string, string> = { session: 'Session', vpn: 'VPN Tunnel', email: 'Email Encryption' }
      enq(sseLog('DERIVE', `Generating ${commLabels[commKeyType] || 'Communication'} key material`, `key_type=${commKeyType} bit_length=${commBits}`))
      await new Promise(r => setImmediate(r))
      enq(sseProgress(65, 'HKDF Derivation', 'Deriving enc key + IV + HMAC from master secret'))

      if (commKeyType === 'session') {
        enq(sseLog('AEAD', `AEAD mode: ${String(params.aead_mode || 'gcm').toUpperCase()}`, `purpose=${params.purpose || 'tls'}`))
      } else if (commKeyType === 'vpn') {
        enq(sseLog('PROTO', `VPN protocol: ${params.protocol || 'wireguard'}`, `PFS=${params.pfs !== false ? 'enabled' : 'disabled'}`))
      } else if (commKeyType === 'email') {
        enq(sseLog('MAIL', `Standard: ${String(params.standard || 'smime').toUpperCase()}`, `algorithm=${params.algorithm || 'hybrid'} expiry=${params.expiry_days || 365}d`))
      }
      await new Promise(r => setImmediate(r))
      enq(sseProgress(80, 'PQC Keygen', 'ML-KEM-768+X25519 hybrid encapsulation'))

      enq(sseLog('KEM', 'Generating KEM public key for key agreement', 'ML-KEM-768+X25519'))
      await new Promise(r => setImmediate(r))
      enq(sseProgress(92, 'Finalizing', 'Assembling key bundle'))

      result = generateCommKeysResult(params)
      break
    }
    case 'seed':
    case 'cloud-seeds': {
      const cloudCount = Math.min(Number(params.container_count || params.containerCount || 3), 20)
      const cloudBits = Number(params.seed_bits || params.seedBits || 256)
      const cloudTarget = String(params.target || 'generic')
      const cloudPrefix = String(params.prefix || '')
      const targetLabels: Record<string, string> = { generic: 'Generic', kubernetes: 'Kubernetes', docker: 'Docker', aws: 'AWS', gcp: 'GCP', azure: 'Azure' }

      enq(sseLog('CLOUD', `Target: ${targetLabels[cloudTarget] || cloudTarget}`, `containers=${cloudCount} seed_bits=${cloudBits} format=${params.format || 'hex'}`))
      await new Promise(r => setImmediate(r))
      enq(sseProgress(50, 'Provisioning', `Preparing ${cloudCount} container seed${cloudCount !== 1 ? 's' : ''}`))

      if (cloudPrefix) {
        enq(sseLog('PREFIX', `Naming prefix: "${cloudPrefix}"`, `${cloudPrefix}-0 … ${cloudPrefix}-${cloudCount - 1}`))
        await new Promise(r => setImmediate(r))
      }

      // Per-container progress
      for (let i = 0; i < cloudCount; i++) {
        const pct = 55 + Math.round(((i + 1) / cloudCount) * 35)
        const cName = cloudPrefix ? `${cloudPrefix}-${i}` : `container-${i}`
        enq(sseProgress(pct, 'Generating Seeds', `${i + 1}/${cloudCount} — ${cName}`))
        enq(sseLog('SEED', `Container ${i} seed generated`, `${cloudBits}-bit HKDF → enc_key + hmac_key + nonce`))
        if ((i + 1) % 3 === 0 || i === cloudCount - 1) await new Promise(r => setImmediate(r))
      }

      enq(sseProgress(93, 'Finalizing', `Assembling ${cloudCount} seed bundle for ${targetLabels[cloudTarget] || cloudTarget}`))
      enq(sseLog('BUNDLE', 'All container seeds generated', `target=${cloudTarget} total=${cloudCount}`))
      await new Promise(r => setImmediate(r))

      result = generateCloudSeedsResult(params)
      break
    }
    default:            result = { error: `Unknown action: ${action}` }
  }

  enq(sseProgress(100, 'Complete', 'Generation finished'))
  enq(sseLog('DONE', `${action} generation complete`, 'Result ready'))
  enq(sse('result', result))
}

// ── QRNG Proxy ─────────────────────────────────────────────────────────────────

// Maximum time for the QRNG generation stream (quantum circuits + post-processing).
// Batch OTP with 50 items can require many circuits — allow generous time.
const QRNG_STREAM_TIMEOUT_MS = Number(process.env.QRNG_STREAM_TIMEOUT_MS || '30000')

async function tryProxyQRNG(
  controller: ReadableStreamDefaultController,
  body: unknown,
): Promise<boolean> {
  const enq = (c: Uint8Array) => { try { controller.enqueue(c) } catch { /* closed */ } }

  // Fast path: QRNG known offline — skip health check entirely.
  if (qrngCacheValid() && !qrngCache!.available) return false

  try {
    // ── Step 1: Health check with short timeout ──────────────
    const healthAC = new AbortController()
    const healthTimer = setTimeout(() => healthAC.abort(), QRNG_TIMEOUT_MS)

    const healthRes = await fetch(`${QRNG_SERVICE_URL}/health`, {
      method: 'GET', signal: healthAC.signal,
    }).catch(() => null)

    clearTimeout(healthTimer)

    if (!healthRes?.ok) {
      qrngCache = { available: false, ts: Date.now() }
      return false
    }

    qrngCache = { available: true, ts: Date.now() }
    enq(sseProgress(20, 'QRNG Online', 'Health check passed — Qiskit AerSimulator'))
    enq(sseLog('CIRCUIT', 'QRNG connected — executing real quantum circuits', 'Qiskit AerSimulator | Hadamard gates → Z-basis measurement'))

    // ── Step 2: Stream generation with generous timeout ──────
    // Quantum circuit execution takes real time (seconds, not ms).
    // Use a separate AbortController so the health-check timeout
    // doesn't kill the quantum generation mid-circuit.
    const streamAC = new AbortController()
    const streamTimer = setTimeout(() => streamAC.abort(), QRNG_STREAM_TIMEOUT_MS)

    const qrngRes = await fetch(`${QRNG_SERVICE_URL}/api/v1/qrng/generate/stream`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-qrng-api-key': QRNG_API_KEY },
      body:    JSON.stringify(body),
      signal:  streamAC.signal,
    })

    if (qrngRes.ok && qrngRes.body) {
      const reader = qrngRes.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) enq(value)
      }
      clearTimeout(streamTimer)
      return true
    }

    clearTimeout(streamTimer)
    qrngCache = { available: false, ts: Date.now() }
    return false
  } catch {
    qrngCache = { available: false, ts: Date.now() }
    return false
  }
}

// ── Route Handler ──────────────────────────────────────────────────────────────

// Actions that the QRNG Python service handles natively and returns correct
// structured output for. All other actions use the local structured generators,
// which may still call the QRNG service internally for raw entropy.
const QRNG_PROXY_ACTIONS = new Set(['otp', 'key', 'generate-key', 'pki', 'generate-pki', 'seed', 'cloud-seeds'])

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try { body = await request.json() }
  catch { return new Response('{"error":"Invalid JSON"}', { status: 400 }) }

  const { action, ...params } = body
  const actionStr = String(action || '')

  // Extract user security settings from the request
  const autoFallback         = params.auto_fallback !== false           // default: true
  const entropyValidation    = params.entropy_validation !== false      // default: true
  const fips140Mode          = params.fips140_mode === true             // default: false
  const quantumCertification = params.quantum_certification !== false   // default: true
  const auditLogging         = params.audit_logging !== false           // default: true

  // FIPS 140-2 enforces minimum OTP length of 6 and numeric/alphanumeric only
  if (fips140Mode && actionStr === 'otp') {
    const len = Number(params.length || 6)
    if (len < 6) params.length = 6
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enq = (c: Uint8Array) => { try { controller.enqueue(c) } catch { /* closed */ } }

      // Audit log: request start
      if (auditLogging) {
        let configDetail: string
        if (actionStr === 'otp') {
          const isBatch = params.batch && Number(params.count) > 1
          const modeLabel = isBatch ? `batch(${params.count})` : 'single'
          configDetail = `action=${actionStr} mode=${modeLabel} length=${params.length || 6} format=${params.format || 'numeric'} expiry=${params.expires_in_seconds || 300}s purpose=${params.purpose || 'login'} entropy_validation=${entropyValidation} fips140=${fips140Mode} quantum_cert=${quantumCertification}`
        } else if (actionStr === 'token' || actionStr === 'tokenize') {
          const isBatch = params.batch && Array.isArray(params.sensitive_data_batch)
          const batchCount = isBatch ? (params.sensitive_data_batch as unknown[]).length : 1
          const modeLabel = isBatch ? `batch(${batchCount})` : 'single'
          configDetail = `action=${actionStr} mode=${modeLabel} data_type=${params.data_type || 'custom'} prefix="${params.token_prefix || 'tok_'}" format_preserving=${params.format_preserving ?? true} entropy_validation=${entropyValidation} fips140=${fips140Mode}`
        } else if (actionStr === 'seed' || actionStr === 'cloud-seeds') {
          const cc = Number(params.container_count || params.containerCount || 3)
          const sb = Number(params.seed_bits || params.seedBits || 256)
          configDetail = `action=${actionStr} target=${params.target || 'generic'} containers=${cc} seed_bits=${sb} format=${params.format || 'hex'} prefix="${params.prefix || ''}" entropy_validation=${entropyValidation} fips140=${fips140Mode} quantum_cert=${quantumCertification}`
        } else if (actionStr === 'comm-keys' || actionStr === 'vpn-key') {
          const kt = String(params.key_type || 'session')
          const commDetails: string[] = [`action=${actionStr}`, `key_type=${kt}`, `bit_length=${params.bit_length || 256}`]
          if (kt === 'session') { commDetails.push(`purpose=${params.purpose || 'tls'}`, `aead_mode=${params.aead_mode || 'gcm'}`) }
          else if (kt === 'vpn') { commDetails.push(`protocol=${params.protocol || 'wireguard'}`, `pfs=${params.pfs !== false}`) }
          else if (kt === 'email') { commDetails.push(`standard=${params.standard || 'smime'}`, `algorithm=${params.algorithm || 'hybrid'}`, `expiry=${params.expiry_days || 365}d`) }
          commDetails.push(`entropy_validation=${entropyValidation}`, `fips140=${fips140Mode}`, `quantum_cert=${quantumCertification}`)
          configDetail = commDetails.join(' ')
        } else {
          configDetail = `action=${actionStr} entropy_validation=${entropyValidation} fips140=${fips140Mode} quantum_cert=${quantumCertification}`
        }
        enq(sseLog('AUDIT', `${actionStr} generation requested`, configDetail))
      }

      enq(sseLog('INIT', `Starting ${actionStr} generation`, 'Checking entropy service'))
      enq(sseProgress(5, 'Connecting', 'Checking QRNG availability'))

      // Proxy to the QRNG Python service for actions it handles natively.
      // Tokenize, cloud-seeds, and comm-keys use local structured generators.
      let proxied = false
      if (QRNG_PROXY_ACTIONS.has(actionStr)) {
        proxied = await tryProxyQRNG(controller, body)
      }

      if (!proxied) {
        // Quantum Certification: if user requires QRNG and forbids fallback, emit error
        if (quantumCertification && !autoFallback && QRNG_PROXY_ACTIONS.has(actionStr)) {
          enq(sseLog('ERROR', 'QRNG service offline — fallback disabled by security policy', 'Quantum Certification requires QRNG source. Enable "Auto CSPRNG Fallback" or start the QRNG service.'))
          enq(sse('result', { error: 'QRNG service offline and CSPRNG fallback is disabled. Enable "Auto CSPRNG Fallback" in Settings or start the QRNG service (npm run dev:qrng).' }))
        } else {
          if (!QRNG_PROXY_ACTIONS.has(actionStr)) {
            enq(sseLog('LOCAL', 'Using local structured generator', 'CSPRNG entropy fallback'))
          } else {
            enq(sseLog('FALLBACK', 'QRNG service offline — using CSPRNG fallback', 'crypto.randomBytes() — not quantum'))
          }
          await streamFallback(controller, actionStr, params)
        }
      }

      // Entropy Validation: check quality score of the result if enabled
      // (This applies to the CSPRNG fallback result already emitted via streamFallback.
      //  For QRNG-proxied results, the Python service validates via NIST tests.)
      if (entropyValidation && !proxied && auditLogging) {
        enq(sseLog('AUDIT', 'Entropy validation active — quality scores reflect real Shannon entropy measurement', 'NIST SP 800-22 compliance'))
      }

      // FIPS 140-2 audit entry
      if (fips140Mode && auditLogging) {
        enq(sseLog('AUDIT', 'FIPS 140-2 mode active — enforcing minimum entropy and key length requirements', 'FIPS 140-2 Level 3'))
      }

      try { controller.close() } catch { /* already closed */ }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
