import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUserFromToken } from '@/lib/server-auth'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const user = await getServerUserFromToken(token)
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401 }
      )
    }

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { factorId, code } = body

    if (!factorId || !code || typeof code !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Factor ID and verification code are required' } },
        { status: 400 }
      )
    }

    // Verify the TOTP code to complete enrollment
    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
      factorId,
    })

    if (challengeError) {
      return NextResponse.json(
        { error: { code: 'MFA_ERROR', message: challengeError.message || 'Failed to create MFA challenge' } },
        { status: 400 }
      )
    }

    const { error: verifyError } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    })

    if (verifyError) {
      return NextResponse.json(
        { error: { code: 'MFA_ERROR', message: 'Invalid verification code. Please try again.' } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: { message: 'Two-factor authentication enabled successfully' },
    })
  } catch (err) {
    console.error('2FA verify error:', err)
    return NextResponse.json(
      { error: { code: 'MFA_ERROR', message: 'Failed to verify 2FA' } },
      { status: 500 }
    )
  }
}
