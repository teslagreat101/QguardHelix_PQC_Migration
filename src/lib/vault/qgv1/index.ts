import { ed25519, x25519 } from '@noble/curves/ed25519.js'
import { gcm } from '@noble/ciphers/aes.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { sha3_256, sha3_512 } from '@noble/hashes/sha3.js'
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js'
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js'

/**
 * QGV1 Container Implementation.
 *
 * A QGV1 file is a JSON container with binary fields base64url-encoded:
 * - hybrid key establishment: X25519 + ML-KEM-768
 * - payload encryption: AES-256-GCM
 * - signatures: Ed25519 + ML-DSA-65
 * - hashes: SHA3-256/SHA3-512
 */

export interface QGV1Options {
  filename: string
  fileData: Uint8Array
  mimeType?: string
  recipientX25519Public: Uint8Array
  recipientMlkemPublic: Uint8Array
  signerEd25519Secret: Uint8Array
  signerMldsaSecret: Uint8Array
  encryptionKeyId: string
  signingKeyId: string
  label?: string
}

export interface QGV1DecryptOptions {
  container: Uint8Array | string
  recipientX25519Secret: Uint8Array
  recipientMlkemSecret: Uint8Array
  signerEd25519Public?: Uint8Array
  signerMldsaPublic?: Uint8Array
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length))
}

function canonicalJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value))
}

export function encryptToQGV1(options: QGV1Options): Uint8Array {
  const payloadKey = randomBytes(32)
  const payloadNonce = randomBytes(12)
  const kdfSalt = randomBytes(32)
  const xSecret = x25519.utils.randomPrivateKey()
  const xPublic = x25519.getPublicKey(xSecret)
  const xShared = x25519.getSharedSecret(xSecret, options.recipientX25519Public)
  const { sharedSecret: kemShared, cipherText: kemCiphertext } = ml_kem768.encapsulate(options.recipientMlkemPublic)

  const context = {
    header: 'QGV1',
    version: 1,
    name: options.filename,
    type: options.mimeType || 'application/octet-stream',
    encryptionKeyId: options.encryptionKeyId,
    signingKeyId: options.signingKeyId,
    label: options.label,
  }
  const aad = canonicalJson(context)
  const aadHash = sha3_256(aad)

  const wrapKeyInput = new Uint8Array(kemShared.length + xShared.length)
  wrapKeyInput.set(kemShared, 0)
  wrapKeyInput.set(xShared, kemShared.length)
  const wrapKey = hkdf(
    sha3_256,
    wrapKeyInput,
    kdfSalt,
    new TextEncoder().encode(`qgv1-wrap:${toHex(aadHash)}`),
    32,
  )

  const wrapNonce = randomBytes(12)
  const encryptedPayload = gcm(payloadKey, payloadNonce).encrypt(options.fileData)
  const wrappedPayloadKey = gcm(wrapKey, wrapNonce).encrypt(payloadKey)

  const manifest = {
    ...context,
    createdAt: new Date().toISOString(),
    algorithms: {
      kex: 'X25519+ML-KEM-768',
      symmetric: 'AES-256-GCM',
      kdf: 'HKDF-SHA3-256',
      signatures: 'Ed25519+ML-DSA-65',
      hash: 'SHA3-256/SHA3-512',
    },
    hashes: {
      plaintextSha3_256: toHex(sha3_256(options.fileData)),
      ciphertextSha3_512: toHex(sha3_512(encryptedPayload)),
      aadSha3_256: toHex(aadHash),
    },
    envelope: {
      x25519EphemeralPublic: toBase64Url(xPublic),
      mlkemCiphertext: toBase64Url(kemCiphertext),
      kdfSalt: toBase64Url(kdfSalt),
      wrappedPayloadKey: toBase64Url(wrappedPayloadKey),
      wrapNonce: toBase64Url(wrapNonce),
      payloadNonce: toBase64Url(payloadNonce),
    },
    payload: toBase64Url(encryptedPayload),
  }

  const manifestBytes = canonicalJson(manifest)
  const signatures = {
    ed25519: toBase64Url(ed25519.sign(manifestBytes, options.signerEd25519Secret)),
    mldsa65: toBase64Url(ml_dsa65.sign(manifestBytes, options.signerMldsaSecret)),
  }

  payloadKey.fill(0)
  xSecret.fill(0)
  xShared.fill(0)
  kemShared.fill(0)
  wrapKey.fill(0)
  wrapKeyInput.fill(0)

  return canonicalJson({
    ...manifest,
    signatures,
  })
}

export function decryptFromQGV1(options: QGV1DecryptOptions) {
  const containerText = typeof options.container === 'string'
    ? options.container
    : new TextDecoder().decode(options.container)
  const parsed = JSON.parse(containerText)
  const { signatures, ...manifest } = parsed
  const manifestBytes = canonicalJson(manifest)

  const encryptedPayload = fromBase64Url(manifest.payload)
  const ciphertextHash = toHex(sha3_512(encryptedPayload))
  if (manifest.hashes?.ciphertextSha3_512 && ciphertextHash !== manifest.hashes.ciphertextSha3_512) {
    throw new Error('QGV1_CIPHERTEXT_INTEGRITY_FAILED')
  }

  const signatureValid = {
    ed25519: options.signerEd25519Public && signatures?.ed25519
      ? ed25519.verify(fromBase64Url(signatures.ed25519), manifestBytes, options.signerEd25519Public)
      : null,
    mldsa65: options.signerMldsaPublic && signatures?.mldsa65
      ? ml_dsa65.verify(fromBase64Url(signatures.mldsa65), manifestBytes, options.signerMldsaPublic)
      : null,
  }

  if (signatureValid.ed25519 === false || signatureValid.mldsa65 === false) {
    throw new Error('QGV1_SIGNATURE_VERIFICATION_FAILED')
  }

  const envelope = manifest.envelope
  const kemShared = ml_kem768.decapsulate(
    fromBase64Url(envelope.mlkemCiphertext),
    options.recipientMlkemSecret,
  )
  const xShared = x25519.getSharedSecret(
    options.recipientX25519Secret,
    fromBase64Url(envelope.x25519EphemeralPublic),
  )

  const aad = canonicalJson({
    header: manifest.header,
    version: manifest.version,
    name: manifest.name,
    type: manifest.type,
    encryptionKeyId: manifest.encryptionKeyId,
    signingKeyId: manifest.signingKeyId,
    label: manifest.label,
  })
  const aadHash = sha3_256(aad)

  const wrapKeyInput = new Uint8Array(kemShared.length + xShared.length)
  wrapKeyInput.set(kemShared, 0)
  wrapKeyInput.set(xShared, kemShared.length)
  const wrapKey = hkdf(
    sha3_256,
    wrapKeyInput,
    fromBase64Url(envelope.kdfSalt),
    new TextEncoder().encode(`qgv1-wrap:${toHex(aadHash)}`),
    32,
  )

  const payloadKey = gcm(wrapKey, fromBase64Url(envelope.wrapNonce)).decrypt(
    fromBase64Url(envelope.wrappedPayloadKey),
  )
  const plaintext = gcm(payloadKey, fromBase64Url(envelope.payloadNonce)).decrypt(encryptedPayload)

  if (manifest.hashes?.plaintextSha3_256 && toHex(sha3_256(plaintext)) !== manifest.hashes.plaintextSha3_256) {
    throw new Error('QGV1_PLAINTEXT_INTEGRITY_FAILED')
  }

  kemShared.fill(0)
  xShared.fill(0)
  wrapKey.fill(0)
  wrapKeyInput.fill(0)
  payloadKey.fill(0)

  return {
    plaintext,
    manifest,
    signatureValid,
  }
}
