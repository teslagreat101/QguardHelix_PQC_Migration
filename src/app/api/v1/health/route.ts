import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        scanner: 'operational',
        pqcEngine: 'operational',
        qrng: 'operational',
        vault: 'operational',
        monitoring: 'operational',
      },
      pqcAlgorithms: ['ML-KEM (Kyber)', 'ML-DSA (Dilithium)', 'SPHINCS+', 'HYBRID'],
    },
  })
}
