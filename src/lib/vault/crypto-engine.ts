import { ml_kem768 } from '@noble/post-quantum/ml-kem.js'
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import crypto from 'node:crypto'

/**
 * Server-side Crypto Engine for the Quantum Vault.
 * Uses ML-KEM-768 for key encapsulation and AES-256-GCM for data encryption.
 * Uses ML-DSA-65 for metadata signing.
 */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g)
  if (!matches) return new Uint8Array(0)
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
}

/**
 * Encrypts file data using envelope encryption.
 * Returns the encrypted data, the encapsulated key, and the nonce.
 */
export function encryptFile(data: Uint8Array, recipientPublicKey: Uint8Array) {
  // 1. Encapsulate a shared secret using ML-KEM-768
  const { sharedSecret, cipherText } = ml_kem768.encapsulate(recipientPublicKey)
  
  // 2. Use the shared secret to derive a 256-bit AES key
  // We use the shared secret directly as it's already high entropy from ML-KEM
  const aesKey = sharedSecret.slice(0, 32)
  
  // 3. Encrypt the data with AES-256-GCM
  const nonce = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce)
  const encryptedBody = Buffer.concat([cipher.update(data), cipher.final()])
  const tag = cipher.getAuthTag()
  
  // 4. Calculate integrity hash of the ORIGINAL data
  const integrityHash = toHex(sha256(data))
  
  // Concatenate encrypted body and auth tag
  const encryptedData = Buffer.concat([encryptedBody, tag])

  return {
    encryptedData: new Uint8Array(encryptedData),
    encryptedDataKey: toHex(cipherText),
    aesNonce: toHex(nonce),
    integrityHash,
    algorithm: 'ML-KEM-768+AES-256-GCM'
  }
}

/**
 * Decrypts file data using envelope encryption.
 */
export function decryptFile(
  encryptedDataWithTag: Uint8Array,
  kemCiphertextHex: string,
  aesNonceHex: string,
  secretKey: Uint8Array,
  expectedIntegrityHash?: string
) {
  // 1. Decapsulate the shared secret
  const kemCiphertext = fromHex(kemCiphertextHex)
  const sharedSecret = ml_kem768.decapsulate(kemCiphertext, secretKey)
  const aesKey = sharedSecret.slice(0, 32)
  
  // 2. Extract encrypted body and tag
  const nonce = fromHex(aesNonceHex)
  const tagLength = 16
  const encryptedBody = encryptedDataWithTag.slice(0, -tagLength)
  const tag = encryptedDataWithTag.slice(-tagLength)
  
  // 3. Decrypt with AES-256-GCM
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, nonce)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encryptedBody), decipher.final()])
  
  const decryptedData = new Uint8Array(decrypted)
  
  // 4. Verify integrity if hash provided
  if (expectedIntegrityHash) {
    const actualHash = toHex(sha256(decryptedData))
    if (actualHash !== expectedIntegrityHash) {
      throw new Error('INTEGRITY_CHECK_FAILED')
    }
  }

  return decryptedData
}

/**
 * Signs file metadata using ML-DSA-65.
 */
export function signFileMetadata(metadata: any, signingSecretKey: Uint8Array) {
  const message = JSON.stringify(metadata)
  const messageBytes = new TextEncoder().encode(message)
  const signature = ml_dsa65.sign(signingSecretKey, messageBytes)
  
  return {
    signature: toHex(signature),
    signedMetadata: message
  }
}

/**
 * Wraps a secret key for storage at rest.
 * Uses AES-256-GCM with a key derived from the master key + user salt.
 */
export function encryptSecretKey(secretKey: Uint8Array, masterKey: string, userId: string) {
  const salt = fromHex(toHex(sha256(new TextEncoder().encode(userId))))
  const key = hkdf(sha256, new TextEncoder().encode(masterKey), salt, new TextEncoder().encode('vault-wrapping-key'), 32)
  
  const nonce = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce)
  const encryptedKey = Buffer.concat([cipher.update(secretKey), cipher.final()])
  const tag = cipher.getAuthTag()
  
  return {
    encryptedKey: new Uint8Array(Buffer.concat([encryptedKey, tag])),
    nonce
  }
}

/**
 * Unwraps a stored secret key.
 */
export function decryptSecretKey(encryptedKeyWithTag: Uint8Array, nonce: Uint8Array, masterKey: string, userId?: string) {
  const salt = userId 
    ? fromHex(toHex(sha256(new TextEncoder().encode(userId))))
    : new Uint8Array(32).fill(0) // Fallback for global keys
    
  const key = hkdf(sha256, new TextEncoder().encode(masterKey), salt, new TextEncoder().encode('vault-wrapping-key'), 32)
  
  const tagLength = 16
  const encryptedKey = encryptedKeyWithTag.slice(0, -tagLength)
  const tag = encryptedKeyWithTag.slice(-tagLength)
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encryptedKey), decipher.final()])
  
  return new Uint8Array(decrypted)
}
