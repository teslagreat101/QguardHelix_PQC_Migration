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
    const { currentPassword, newPassword } = body

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Current password is required' } },
        { status: 400 }
      )
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'New password is required' } },
        { status: 400 }
      )
    }

    // Password strength validation
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      )
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Password must contain uppercase, lowercase, and a number' } },
        { status: 400 }
      )
    }

    // Verify current password
    const { error: signInError } = await client.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json(
        { error: { code: 'AUTH_ERROR', message: 'Current password is incorrect' } },
        { status: 403 }
      )
    }

    // Update password
    const { error: updateError } = await client.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json(
        { error: { code: 'PASSWORD_ERROR', message: updateError.message || 'Failed to update password' } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: { message: 'Password updated successfully' },
    })
  } catch (err) {
    console.error('Change password error:', err)
    return NextResponse.json(
      { error: { code: 'PASSWORD_ERROR', message: 'Failed to change password' } },
      { status: 500 }
    )
  }
}
