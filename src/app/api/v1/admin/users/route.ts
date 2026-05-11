import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  const { serviceClient } = auth

  try {
    const url = request.nextUrl
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const search = url.searchParams.get('search') || ''
    const tierFilter = url.searchParams.get('tier') || ''
    const sortBy = url.searchParams.get('sort') || 'created_at'
    const sortOrder = url.searchParams.get('order') === 'asc'

    let query = serviceClient
      .from('profiles')
      .select('*', { count: 'exact' })

    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
    }
    if (tierFilter === 'free' || tierFilter === 'premium') {
      query = query.eq('tier', tierFilter)
    }

    const validSortCols = ['created_at', 'email', 'tier', 'q_score', 'updated_at']
    const sortCol = validSortCols.includes(sortBy) ? sortBy : 'created_at'

    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: users, count, error } = await query
      .order(sortCol, { ascending: sortOrder })
      .range(from, to)

    if (error) throw error

    // Fetch auth metadata for each user (last sign in, etc.)
    const enrichedUsers = await Promise.all(
      (users || []).map(async (profile) => {
        try {
          const { data: authData } = await serviceClient.auth.admin.getUserById(profile.id)
          return {
            ...profile,
            last_sign_in_at: authData?.user?.last_sign_in_at || null,
            email_confirmed_at: authData?.user?.email_confirmed_at || null,
            auth_provider: authData?.user?.app_metadata?.provider || 'email',
          }
        } catch {
          return {
            ...profile,
            last_sign_in_at: null,
            email_confirmed_at: null,
            auth_provider: 'email',
          }
        }
      })
    )

    return NextResponse.json({
      status: 'success',
      data: {
        users: enrichedUsers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      },
    })
  } catch (error) {
    console.error('Admin list users error:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth
  const { serviceClient } = auth

  try {
    const body = await request.json()
    const { email, password, name, tier } = body

    if (!email || !password) {
      return NextResponse.json(
        { status: 'error', message: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) throw authError

    // Update profile with name and tier if provided
    if (authData.user && (name || tier)) {
      await serviceClient
        .from('profiles')
        .update({
          ...(name ? { name } : {}),
          ...(tier ? { tier } : {}),
          ...(tier === 'premium' ? { max_keys_per_day: 999, max_vault_storage: 1073741824 } : {}),
        })
        .eq('id', authData.user.id)
    }

    return NextResponse.json({
      status: 'success',
      data: { user: authData.user },
      message: 'User created successfully',
    })
  } catch (error) {
    console.error('Admin create user error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create user'
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    )
  }
}
