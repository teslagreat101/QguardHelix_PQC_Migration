import { sha256 } from '@noble/hashes/sha2.js'
import { gcm } from '@noble/ciphers/aes.js'
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'

/**
 * Sharing Cryptography for the Quantum Vault.
 * Uses AES-256-GCM for file encryption.
 * For password-protected shares, derives the AES key using PBKDF2.
 */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g)
  if (!matches) return new Uint8Array(0)
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const x of bytes) s += String.fromCharCode(x)
  return btoa(s)
}

/**
 * Encrypts data for a standard share link.
 * Generates a random 256-bit key.
 */
export async function encryptForSharing(fileData: Uint8Array) {
  const shareKey = window.crypto.getRandomValues(new Uint8Array(32))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  
  const aes = gcm(shareKey, iv)
  const encrypted = aes.encrypt(fileData)
  
  return {
    encryptedPayload: toBase64(encrypted),
    iv: toHex(iv),
    integrityHash: toHex(sha256(fileData)),
    shareKey: toHex(shareKey)
  }
}

/**
 * Encrypts data for a password-protected share link.
 * Derives the key from the password using PBKDF2.
 */
export async function encryptForSharingWithPassword(fileData: Uint8Array, password: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  
  // Derive the actual encryption key from the password
  const shareKey = await pbkdf2Async(sha256, password, salt, { 
    iterations: 100000, 
    dkLen: 32 
  })
  
  // Also create a password hash for the server to verify before serving the blob
  const passwordHashBytes = await pbkdf2Async(sha256, password, salt, { 
    iterations: 1000, 
    dkLen: 32 
  })
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const aes = gcm(shareKey, iv)
  const encrypted = aes.encrypt(fileData)
  
  return {
    encryptedPayload: toBase64(encrypted),
    iv: toHex(iv),
    integrityHash: toHex(sha256(fileData)),
    shareKey: toHex(shareKey),
    passwordSalt: toHex(salt),
    passwordHash: toHex(passwordHashBytes)
  }
}
