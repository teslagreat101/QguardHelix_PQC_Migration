import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Merkle Tree Implementation for Vault File Integrity.
 */

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Builds a simple Merkle Tree from file data.
 * For large files, we chunk the data and hash the chunks.
 */
export function buildMerkleTreeFromData(data: Uint8Array) {
  const CHUNK_SIZE = 1024 * 64 // 64KB chunks
  const chunks: Uint8Array[] = []
  
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE))
  }
  
  if (chunks.length === 0 && data.length === 0) {
    chunks.push(new Uint8Array(0))
  }
  
  let layer = chunks.map(c => sha256(c))
  const tree = [layer.map(h => toHex(h))]
  
  while (layer.length > 1) {
    const nextLayer: Uint8Array[] = []
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 < layer.length) {
        const combined = new Uint8Array(layer[i].length + layer[i+1].length)
        combined.set(layer[i])
        combined.set(layer[i+1], layer[i].length)
        nextLayer.push(sha256(combined))
      } else {
        nextLayer.push(layer[i]) // Odd leaf
      }
    }
    layer = nextLayer
    tree.push(layer.map(h => toHex(h)))
  }
  
  return {
    root: tree[tree.length - 1][0],
    layers: tree,
    leafCount: chunks.length
  }
}
