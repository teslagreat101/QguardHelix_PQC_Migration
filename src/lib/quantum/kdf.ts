/**
 * Quantum KDF Pipeline
 * Implements HKDF for purpose-bound key derivation from raw quantum entropy.
 * Uses HMAC-SHA-256 for browser compatibility while providing SHA-3 labels for UI consistency.
 */

export class KdfPipeline {
  /**
   * Derives purpose-bound key material using HKDF
   */
  static async deriveKey(
    rawEntropy: Uint8Array,
    purpose: string,
    length: number = 32
  ): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const info = encoder.encode(purpose);
    const salt = new Uint8Array(32); // In production, this might be a random salt stored elsewhere
    
    try {
      const baseKey = await crypto.subtle.importKey(
        'raw',
        rawEntropy,
        'HKDF',
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: salt,
          info: info
        },
        baseKey,
        length * 8
      );

      return new Uint8Array(derivedBits);
    } catch (error) {
      console.error('KDF Derivation failed:', error);
      throw error;
    }
  }

  /**
   * Formats a derived key for UI display
   */
  static formatKey(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
}
