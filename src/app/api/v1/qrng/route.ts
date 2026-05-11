import { NextRequest, NextResponse } from 'next/server'
import {
  fetchQRNGEntropy,
  generateQRNGKey,
  generateQRNGOtp,
  generateQRNGPKICert,
  tokenizeData,
  generateCommKeys,
  generateCloudSeeds,
  fetchQRNGStats,
  isQRNGServiceHealthy,
} from '@/lib/quantum/qrng-client'

// ─── POST /api/v1/qrng — Unified QRNG service endpoint ────
// Auth is handled by the Python QRNG backend via x-qrng-api-key header.
// Supabase auth is NOT required here — this is a proxy to the QRNG service.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...params } = body

    if (!action) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'action field required' } },
        { status: 400 }
      )
    }

    let data: unknown

    switch (action) {
      case 'entropy':
        data = await fetchQRNGEntropy(params.numBits || 256)
        break

      case 'generate-key':
        data = await generateQRNGKey({
          algorithm: params.algorithm,
          bitLength: params.bitLength,
          label: params.label,
          purpose: params.purpose,
        })
        break

      case 'generate-otp':
        data = await generateQRNGOtp({
          length: params.length,
          format: params.format,
        })
        break

      case 'generate-pki':
        data = await generateQRNGPKICert({
          commonName: params.commonName,
          organization: params.organization,
          validityDays: params.validityDays,
          keyAlgorithm: params.keyAlgorithm,
        })
        break

      case 'tokenize':
        data = await tokenizeData({
          sensitiveData: params.sensitiveData,
          formatPreserving: params.formatPreserving,
          tokenPrefix: params.tokenPrefix,
        })
        break

      case 'comm-keys':
        data = await generateCommKeys({
          keyType: params.keyType,
          bitLength: params.bitLength,
        })
        break

      case 'cloud-seeds':
        data = await generateCloudSeeds({
          containerCount: params.containerCount,
          seedBits: params.seedBits,
        })
        break

      default:
        return NextResponse.json(
          { error: { code: 'UNKNOWN_ACTION', message: `Unknown action: ${action}` } },
          { status: 400 }
        )
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('QRNG service error:', err)
    return NextResponse.json(
      { error: { code: 'QRNG_ERROR', message: err instanceof Error ? err.message : 'QRNG service unavailable' } },
      { status: 502 }
    )
  }
}

// ─── GET /api/v1/qrng — Health & stats ─────────────────────
export async function GET() {
  try {
    const healthy = await isQRNGServiceHealthy()
    if (!healthy) {
      return NextResponse.json({
        data: { status: 'offline', backend: 'qiskit-aer', message: 'QRNG service is not running. Start with: python qrng-service/main.py' },
      })
    }

    const stats = await fetchQRNGStats()
    // IMPORTANT: spread stats first, then override status to 'online'
    // (stats.status is 'operational' which would overwrite 'online' if spread after)
    return NextResponse.json({ data: { ...stats, status: 'online' } })
  } catch {
    return NextResponse.json({
      data: { status: 'offline', backend: 'qiskit-aer', message: 'QRNG service unreachable' },
    })
  }
}
