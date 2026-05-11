import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Server-side helper to get the current user from a Supabase auth token.
 * Used in Next.js API routes (src/app/api/v1).
 */
export async function getServerUser(request: NextRequest) {
  const token = getToken(request)
  if (!token) return null

  // In a standard Next.js / Supabase setup, we use the service role key 
  // on the server to bypass RLS for auth checks, or the anon key if we 
  // want to respect RLS. Given the vault's design, we use the service key 
  // to fetch the user object securely.
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
export function getToken(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}
