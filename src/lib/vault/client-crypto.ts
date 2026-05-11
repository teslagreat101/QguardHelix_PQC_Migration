import { ml_kem768 } from '@noble/post-quantum/ml-kem.js'
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { gcm } from '@noble/ciphers/aes.js'

/**
 * Zero-Knowledge Client Cryptography for the Quantum Vault.
 */

export interface ZKMasterKeys {
  encPublicKey: Uint8Array
  encSecretKey: Uint8Array
  signPublicKey: Uint8Array
  signSecretKey: Uint8Array
}

export interface WrappedMasterKeys {
  wrapped_bundle: string
  enc_public_key: string
  sign_public_key: string
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g)
  if (!matches) return new Uint8Array(0)
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
}

/**
 * Generates a new set of master keys for zero-knowledge vault access.
 */
export async function generateMasterKeys(): Promise<ZKMasterKeys> {
  const encKeys = ml_kem768.keygen()
  const signKeys = ml_dsa65.keygen()

  return {
    encPublicKey: encKeys.publicKey,
    encSecretKey: encKeys.secretKey,
    signPublicKey: signKeys.publicKey,
    signSecretKey: signKeys.secretKey,
  }
}

/**
 * Wraps master keys with a passphrase for secure storage.
 */
export async function wrapMasterKeys(keys: ZKMasterKeys, passphrase: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  const wrappingKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  
  const payload = JSON.stringify({
    encSecretKey: toHex(keys.encSecretKey),
    signSecretKey: toHex(keys.signSecretKey),
    encPublicKey: toHex(keys.encPublicKey),
    signPublicKey: toHex(keys.signPublicKey)
  })
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    new TextEncoder().encode(payload)
  )
  
  const bundle = {
    v: 1,
    salt: toHex(salt),
    iv: toHex(iv),
    data: toHex(new Uint8Array(encrypted))
  }
  
  return btoa(JSON.stringify(bundle))
}

/**
 * Unwraps master keys using a passphrase.
 */
export async function unwrapMasterKeys(wrappedBundleB64: string, passphrase: string): Promise<ZKMasterKeys> {
  const bundle = JSON.parse(atob(wrappedBundleB64))
  const salt = fromHex(bundle.salt)
  const iv = fromHex(bundle.iv)
  const data = fromHex(bundle.data)
  
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  
  const wrappingKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 600000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    data
  )
  
  const payload = JSON.parse(new TextDecoder().decode(decrypted))
  
  return {
    encSecretKey: fromHex(payload.encSecretKey),
    signSecretKey: fromHex(payload.signSecretKey),
    encPublicKey: fromHex(payload.encPublicKey),
    signPublicKey: fromHex(payload.signPublicKey)
  }
}

/**
 * Local decryption for zero-knowledge files.
 */
export function decryptFileLocal(
  encryptedData: Uint8Array,
  kemCiphertextHex: string,
  aesNonceHex: string,
  secretKey: Uint8Array,
  expectedIntegrityHash?: string
): Uint8Array {
  const kemCiphertext = fromHex(kemCiphertextHex)
  const sharedSecret = ml_kem768.decapsulate(kemCiphertext, secretKey)
  const aesKey = sharedSecret.slice(0, 32)
  const nonce = fromHex(aesNonceHex)
  
  const aes = gcm(aesKey, nonce)
  const decrypted = aes.decrypt(encryptedData)
  
  if (expectedIntegrityHash) {
    const actualHash = toHex(sha256(decrypted))
    if (actualHash !== expectedIntegrityHash) {
      throw new Error('INTEGRITY_CHECK_FAILED')
    }
  }
  
  return decrypted
}

/**
 * Local encryption for zero-knowledge files.
 */
export function encryptFileLocal(data: Uint8Array, recipientPublicKey: Uint8Array) {
  const { sharedSecret, ciphertext } = ml_kem768.encapsulate(recipientPublicKey)
  const aesKey = sharedSecret.slice(0, 32)
  const nonce = window.crypto.getRandomValues(new Uint8Array(12))
  
  const aes = gcm(aesKey, nonce)
  const encrypted = aes.encrypt(data)
  
  return {
    encryptedData: encrypted,
    kemCiphertext: toHex(ciphertext),
    aesNonce: toHex(nonce),
    integrityHash: toHex(sha256(data)),
    originalSize: data.length
  }
}

/**
 * Computes SHA-256 hash in hex format.
 */
export function computeHash(data: Uint8Array): string {
  return toHex(sha256(data))
}

/**
 * Signs data with ML-DSA-65 secret key.
 */
export function signData(data: Uint8Array, secretKey: Uint8Array): string {
  const sig = ml_dsa65.sign(secretKey, data)
  return toHex(sig)
}
