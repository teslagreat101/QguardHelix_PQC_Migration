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
    const { newEmail, password } = body

    if (!newEmail || typeof newEmail !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Valid email address required' } },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Current password required for verification' } },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid email format' } },
        { status: 400 }
      )
    }

    // Verify current password by attempting sign-in
    const { error: signInError } = await client.auth.signInWithPassword({
      email: user.email!,
      password,
    })

    if (signInError) {
      return NextResponse.json(
        { error: { code: 'AUTH_ERROR', message: 'Current password is incorrect' } },
        { status: 403 }
      )
    }

    // Update email via Supabase Auth (sends confirmation email)
    const { error: updateError } = await client.auth.updateUser({
      email: newEmail,
    })

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'EMAIL_ERROR', message: updateError.message || 'Failed to update email' } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: {
        message: 'Confirmation email sent to your new address. Please verify to complete the change.',
        newEmail,
      },
    })
  } catch (err) {
    console.error('Change email error:', err)
    return NextResponse.json(
      { error: { code: 'EMAIL_ERROR', message: 'Failed to change email' } },
      { status: 500 }
    )
  }
}
