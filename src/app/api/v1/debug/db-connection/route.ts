import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { isSupabaseConfigured } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      VAULT_MASTER_KEY: !!process.env.VAULT_MASTER_KEY,
      NODE_ENV: process.env.NODE_ENV,
    }

    // Check if Supabase is configured
    const isConfigured = isSupabaseConfigured()

    // Test basic connection without auth
    let connectionTest = null
    if (isConfigured) {
      try {
        const client = createAuthClient('test-token')
        const result = client ? await client.from('profiles').select('id').limit(1) : undefined
        const { data, error } = result ?? { data: null, error: { message: 'Supabase not configured' } }
        
        connectionTest = {
          success: !error,
          error: error?.message,
          data: data ? 'connection_successful' : null
        }
      } catch (err) {
        connectionTest = {
          success: false,
          error: err instanceof Error ? err.message : 'unknown_error',
          data: null
        }
      }
    }

    return NextResponse.json({
      data: {
        environment: envCheck,
        isConfigured,
        connectionTest,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
      }
    })
  } catch (err) {
    return NextResponse.json({
      error: {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
      }
    }, { status: 500 })
  }
}
