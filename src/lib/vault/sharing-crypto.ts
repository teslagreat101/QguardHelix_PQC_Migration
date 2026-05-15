import { gcm } from '@noble/ciphers/aes.js'
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha3_256 } from '@noble/hashes/sha3.js'

/**
 * Sharing Cryptography for the Quantum Vault.
 * Uses AES-256-GCM for file encryption.
 * For password-protected shares, derives the AES key using PBKDF2-SHA3-256.
 */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g)
  if (!matches) return new Uint8Array(0)
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)))
}

function fromPayload(value: string): Uint8Array {
  const normalized = value.trim().replace(/\s+/g, '')
  if (normalized.startsWith('\\x')) return fromHex(normalized.slice(2))
  if (/^[0-9a-f]+$/i.test(normalized) && normalized.length % 2 === 0) return fromHex(normalized)

  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const x of bytes) s += String.fromCharCode(x)
  return btoa(s)
}

async function deriveShareKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return pbkdf2Async(sha3_256, password, salt, {
    c: 310000,
    dkLen: 32
  })
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return pbkdf2Async(sha3_256, password, salt, {
    c: 100000,
    dkLen: 32
  })
}

function verifyIntegrity(data: Uint8Array, expectedHash?: string) {
  if (!expectedHash) return
  const actualHash = toHex(sha3_256(data))
  if (actualHash !== expectedHash) {
    throw new Error('INTEGRITY_CHECK_FAILED')
  }
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
    integrityHash: toHex(sha3_256(fileData)),
    shareKey: toHex(shareKey)
  }
}

/**
 * Encrypts data for a password-protected share link.
 * Derives the key from the password using PBKDF2.
 */
export async function encryptForSharingWithPassword(fileData: Uint8Array, password: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  
  const shareKey = await deriveShareKey(password, salt)
  
  // Also create a password hash for the server to verify before serving the blob
  const passwordHashBytes = await derivePasswordHash(password, salt)
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const aes = gcm(shareKey, iv)
  const encrypted = aes.encrypt(fileData)
  const passwordHash = toHex(passwordHashBytes)

  shareKey.fill(0)
  passwordHashBytes.fill(0)
  
  return {
    encryptedPayload: toBase64(encrypted),
    iv: toHex(iv),
    integrityHash: toHex(sha3_256(fileData)),
    passwordSalt: toHex(salt),
    passwordHash
  }
}

export async function hashPassword(password: string, passwordSalt: string): Promise<string> {
  const salt = fromHex(passwordSalt)
  return toHex(await derivePasswordHash(password, salt))
}

export async function decryptSharedFile(
  encryptedPayload: string,
  iv: string,
  shareKey: string,
  integrityHash?: string,
): Promise<Uint8Array> {
  const key = fromHex(shareKey)
  try {
    const decrypted = gcm(key, fromHex(iv)).decrypt(fromPayload(encryptedPayload))
    verifyIntegrity(decrypted, integrityHash)
    return decrypted
  } finally {
    key.fill(0)
  }
}

export async function decryptSharedFileWithPassword(
  encryptedPayload: string,
  iv: string,
  shareKey: string | null | undefined,
  password: string,
  passwordSalt: string,
  integrityHash?: string,
): Promise<Uint8Array> {
  const localKey = await deriveShareKey(password, fromHex(passwordSalt))
  const fragmentKey = shareKey ? fromHex(shareKey) : null

  try {
    if (fragmentKey?.length && toHex(fragmentKey) !== toHex(localKey)) {
      throw new Error('SHARE_KEY_PASSWORD_MISMATCH')
    }

    const decrypted = gcm(localKey, fromHex(iv)).decrypt(fromPayload(encryptedPayload))
    verifyIntegrity(decrypted, integrityHash)
    return decrypted
  } finally {
    fragmentKey?.fill(0)
    localKey.fill(0)
  }
}
