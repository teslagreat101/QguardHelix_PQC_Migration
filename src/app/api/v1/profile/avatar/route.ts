import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = token ? await getServerUser(request) : null
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'No file provided' } },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' } },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'File too large. Maximum size is 2 MB' } },
        { status: 400 }
      )
    }

    const authClient = createAuthClient(token!)
    if (!authClient) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    // Determine file extension from MIME type
    const ext = file.type === 'image/png' ? 'png'
      : file.type === 'image/webp' ? 'webp'
      : file.type === 'image/gif' ? 'gif'
      : 'jpg'

    const storagePath = `${user.id}/avatar.${ext}`

    // Delete any existing avatar files for this user
    const { data: existingFiles } = await authClient.storage
      .from('avatars')
      .list(user.id)

    if (existingFiles?.length) {
      const filesToRemove = existingFiles.map(f => `${user.id}/${f.name}`)
      await authClient.storage.from('avatars').remove(filesToRemove)
    }

    // Upload the new avatar
    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await authClient.storage
      .from('avatars')
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Avatar upload error:', uploadError)
      return NextResponse.json(
        { error: { code: 'UPLOAD_ERROR', message: 'Failed to upload avatar' } },
        { status: 500 }
      )
    }

    // Get the public URL
    const { data: publicUrlData } = authClient.storage
      .from('avatars')
      .getPublicUrl(storagePath)

    const avatarUrl = publicUrlData?.publicUrl || null

    // Update the profile with the avatar URL
    const { error: updateError } = await authClient
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateError) {
      console.error('Profile avatar update error:', updateError)
      return NextResponse.json(
        { error: { code: 'UPDATE_ERROR', message: 'Avatar uploaded but failed to update profile' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: { avatarUrl },
    })
  } catch (err) {
    console.error('Avatar upload error:', err)
    return NextResponse.json(
      { error: { code: 'UPLOAD_ERROR', message: 'Failed to upload avatar' } },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = token ? await getServerUser(request) : null
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const authClient = createAuthClient(token!)
    if (!authClient) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    // Delete all avatar files for this user
    const { data: existingFiles } = await authClient.storage
      .from('avatars')
      .list(user.id)

    if (existingFiles?.length) {
      const filesToRemove = existingFiles.map(f => `${user.id}/${f.name}`)
      await authClient.storage.from('avatars').remove(filesToRemove)
    }

    // Clear avatar URL from profile
    await authClient
      .from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ data: { message: 'Avatar removed' } })
  } catch (err) {
    console.error('Avatar delete error:', err)
    return NextResponse.json(
      { error: { code: 'DELETE_ERROR', message: 'Failed to remove avatar' } },
      { status: 500 }
    )
  }
}
