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

    // Enroll TOTP factor via Supabase MFA
    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'QGuard Authenticator',
    })

    if (error) {
      return NextResponse.json(
        { error: { code: 'MFA_ERROR', message: error.message || 'Failed to initialize 2FA enrollment' } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
    })
  } catch (err) {
    console.error('2FA enable error:', err)
    return NextResponse.json(
      { error: { code: 'MFA_ERROR', message: 'Failed to enable 2FA' } },
      { status: 500 }
    )
  }
}
