import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Request } from 'express'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Create a Supabase client with service role key for server-side operations.
 * Bypasses RLS. Use only for authenticated user data when combined with explicit user_id filters.
 */
export function getServiceClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('Supabase service client: missing URL or service key')
    return null
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/**
 * Create a Supabase client authenticated with the user's JWT token.
 * Respects RLS policies.
 */
export function createAuthClient(token: string): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase auth client: missing URL or anon key')
    return null
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  })
}

/**
 * Extract Bearer token from Express request headers.
 */
export function getToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  return null
}

/**
 * Validate a Supabase JWT token and return the user.
 */
export async function getServerUser(token: string) {
  const client = createAuthClient(token)
  if (!client) return null

  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) {
    return null
  }
  return user
}
