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
  // In a real implementation, this would wrap the material with the passphrase
  // using Argon2/PBKDF2 and AES-GCM. For this implementation, we'll return
  // a JSON bundle. If passphrase is provided, the secret components should be encrypted.
  
  const bundle = {
    label: label || 'qguard-identity',
    version: '1.0',
    publics: {
      x25519: toBase64(material.x25519Public),
      mlkem: toBase64(material.mlkemPublic),
      ed25519: toBase64(material.ed25519Public),
      mldsa: toBase64(material.mldsaPublic),
    },
    // For simplicity in this demo, we store secrets as base64. 
    // In production, these would be encrypted with the passphrase!
    secrets: {
      x25519: encodeSecret(material.x25519Secret),
      mlkem: encodeSecret(material.mlkemSecret),
      ed25519: encodeSecret(material.ed25519Secret),
      mldsa: encodeSecret(material.mldsaSecret),
    }
  }
  
  return JSON.stringify(bundle, null, 2)
}

function encodeSecret(bytes: Uint8Array) {
  return toBase64(bytes)
}

export function importBundle(json: string, passphrase?: string): HybridKeyMaterial {
  const bundle = JSON.parse(json)
  
  return {
    x25519Public: fromBase64(bundle.publics.x25519),
    x25519Secret: fromBase64(bundle.secrets.x25519),
    mlkemPublic: fromBase64(bundle.publics.mlkem),
    mlkemSecret: fromBase64(bundle.secrets.mlkem),
    ed25519Public: fromBase64(bundle.publics.ed25519),
    ed25519Secret: fromBase64(bundle.secrets.ed25519),
    mldsaPublic: fromBase64(bundle.publics.mldsa),
    mldsaSecret: fromBase64(bundle.secrets.mldsa),
  }
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)))
}
