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
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Verification code required to disable 2FA' } },
        { status: 400 }
      )
    }

    // List factors to find the TOTP factor
    const { data: factors, error: listError } = await client.auth.mfa.listFactors()

    if (listError) {
      return NextResponse.json(
        { error: { code: 'MFA_ERROR', message: 'Failed to list MFA factors' } },
        { status: 500 }
      )
    }

    const totpFactor = factors?.totp?.find(f => f.status === 'verified')
    if (!totpFactor) {
      return NextResponse.json(
        { error: { code: 'MFA_ERROR', message: '2FA is not currently enabled' } },
        { status: 400 }
      )
    }

    // Verify the code before unenrolling
    const { data: challenge, error: challengeError } = await client.auth.mfa.challenge({
      factorId: totpFactor.id,
    })

    if (challengeError) {
      return NextResponse.json(
        { error: { code: 'MFA_ERROR', message: 'Failed to create verification challenge' } },
        { status: 400 }
      )
    }

    const { error: verifyError } = await client.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code,
    })

    if (verifyError) {
      return NextResponse.json(
        { error: { code: 'MFA_ERROR', message: 'Invalid verification code' } },
        { status: 400 }
      )
    }

    // Unenroll the factor
    const { error: unenrollError } = await client.auth.mfa.unenroll({
      factorId: totpFactor.id,
    })

    if (unenrollError) {
      return NextResponse.json(
        { error: { code: 'MFA_ERROR', message: 'Failed to disable 2FA' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: { message: 'Two-factor authentication disabled successfully' },
    })
  } catch (err) {
    console.error('2FA disable error:', err)
    return NextResponse.json(
      { error: { code: 'MFA_ERROR', message: 'Failed to disable 2FA' } },
      { status: 500 }
    )
  }
}
