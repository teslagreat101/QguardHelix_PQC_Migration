import { createClient } from '@supabase/supabase-js'

type HeaderLikeRequest = {
  headers: {
    get(name: string): string | null
  }
  nextUrl?: {
    searchParams: URLSearchParams
  }
  url?: string
}

/**
 * Server-side helper to get the current user from a Supabase auth token.
 * Kept framework-agnostic so legacy route files do not force a Next.js dependency.
 */
export async function getServerUser(request: HeaderLikeRequest) {
  const token = getToken(request)
  return getServerUserFromToken(token)
}

export async function getServerUserFromToken(token: string | null) {
  if (!token) return null

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  const client = createClient(supabaseUrl, supabaseServiceKey)
  const { data: { user }, error } = await client.auth.getUser(token)
  
  if (error || !user) {
    return null
  }
  
  return user
}

/**
 * Extracts the Bearer token from the Authorization header.
 */
export function getToken(request: HeaderLikeRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

export function getTokenFromHeaderOrQuery(request: HeaderLikeRequest) {
  const headerToken = getToken(request)
  if (headerToken) return headerToken
  const queryToken = request.nextUrl?.searchParams.get('token')
  if (queryToken) return queryToken
  if (request.url) {
    try {
      return new URL(request.url).searchParams.get('token')
    } catch {
      return null
    }
  }
  return null
}
