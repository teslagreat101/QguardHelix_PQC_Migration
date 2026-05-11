import { NextResponse } from 'next/server'
import { getScannerRuntimeHealth } from '@/lib/web-scanner/runtime-health'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const health = getScannerRuntimeHealth()

  return NextResponse.json({
    status: health.status === 'missing' ? 'error' : 'success',
    data: health,
  }, {
    status: health.status === 'missing' ? 503 : 200,
  })
}
