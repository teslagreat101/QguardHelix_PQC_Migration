import { ml_kem768 } from '@noble/post-quantum/ml-kem.js'
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa.js'
import { x25519 } from '@noble/curves/ed25519.js'
import { ed25519 } from '@noble/curves/ed25519.js'

/**
 * Hybrid Key Generation for QGV1 (Post-Quantum + Classical).
 */

export function generateHybridEncryptionKeys() {
  const xSecret = x25519.utils.randomPrivateKey()
  const xPublic = x25519.getPublicKey(xSecret)
  const mlKeys = ml_kem768.generateKeyPair()
  
  return {
    x25519: { secretKey: xSecret, publicKey: xPublic },
    mlkem: { secretKey: mlKeys.secretKey, publicKey: mlKeys.publicKey }
  }
}

export function generateHybridSigningKeys() {
  const edSecret = ed25519.utils.randomPrivateKey()
  const edPublic = ed25519.getPublicKey(edSecret)
  const mlKeys = ml_dsa65.generateKeyPair()
  
  return {
    ed25519: { secretKey: edSecret, publicKey: edPublic },
    mldsa: { secretKey: mlKeys.secretKey, publicKey: mlKeys.publicKey }
  }
}
