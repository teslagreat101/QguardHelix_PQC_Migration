import { gcm } from '@noble/ciphers/aes.js'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha3_256 } from '@noble/hashes/sha3.js'

/**
 * Types and helper functions for Quantum Guard Hybrid Keys.
 */

export interface HybridKeyMaterial {
  // Encryption
  x25519Public: Uint8Array
  x25519Secret: Uint8Array
  mlkemPublic: Uint8Array
  mlkemSecret: Uint8Array
  
  // Signing
  ed25519Public: Uint8Array
  ed25519Secret: Uint8Array
  mldsaPublic: Uint8Array
  mldsaSecret: Uint8Array
}

export function exportBundle({ material, passphrase, label }: { material: HybridKeyMaterial, passphrase?: string, label?: string }): string {
  if (!passphrase) {
    throw new Error('A passphrase is required to export private hybrid key material.')
  }

  const salt = randomBytes(32)
  const nonce = randomBytes(12)
  const wrappingKey = deriveWrappingKey(passphrase, salt)
  const secretPayload = JSON.stringify({
    x25519: toBase64(material.x25519Secret),
    mlkem: toBase64(material.mlkemSecret),
    ed25519: toBase64(material.ed25519Secret),
    mldsa: toBase64(material.mldsaSecret),
  })
  const encryptedSecrets = gcm(wrappingKey, nonce).encrypt(new TextEncoder().encode(secretPayload))
  wrappingKey.fill(0)
  
  const bundle = {
    label: label || 'qguard-identity',
    version: '1.1',
    publics: {
      x25519: toBase64(material.x25519Public),
      mlkem: toBase64(material.mlkemPublic),
      ed25519: toBase64(material.ed25519Public),
      mldsa: toBase64(material.mldsaPublic),
    },
    secrets: {
      encrypted: true,
      kdf: 'PBKDF2-SHA3-256',
      iterations: 310000,
      salt: toBase64(salt),
      nonce: toBase64(nonce),
      data: toBase64(encryptedSecrets),
    }
  }
  
  return JSON.stringify(bundle, null, 2)
}

export function importBundle(json: string, passphrase?: string): HybridKeyMaterial {
  const bundle = JSON.parse(json)
  let secrets = bundle.secrets

  if (bundle.secrets?.encrypted) {
    if (!passphrase) throw new Error('Passphrase required to unlock encrypted key bundle.')
    const salt = fromBase64(bundle.secrets.salt)
    const nonce = fromBase64(bundle.secrets.nonce)
    const wrappingKey = deriveWrappingKey(passphrase, salt)
    const decrypted = gcm(wrappingKey, nonce).decrypt(fromBase64(bundle.secrets.data))
    wrappingKey.fill(0)
    secrets = JSON.parse(new TextDecoder().decode(decrypted))
    decrypted.fill(0)
  }
  
  return {
    x25519Public: fromBase64(bundle.publics.x25519),
    x25519Secret: fromBase64(secrets.x25519),
    mlkemPublic: fromBase64(bundle.publics.mlkem),
    mlkemSecret: fromBase64(secrets.mlkem),
    ed25519Public: fromBase64(bundle.publics.ed25519),
    ed25519Secret: fromBase64(secrets.ed25519),
    mldsaPublic: fromBase64(bundle.publics.mldsa),
    mldsaSecret: fromBase64(secrets.mldsa),
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)))
}

function randomBytes(length: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(length))
}

function deriveWrappingKey(passphrase: string, salt: Uint8Array): Uint8Array {
  return pbkdf2(
    sha3_256,
    new TextEncoder().encode(passphrase),
    salt,
    { c: 310000, dkLen: 32 },
  )
}
