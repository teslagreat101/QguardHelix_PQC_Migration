import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import type { PQCAlgorithm } from '@/types/quantum.types'

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    const body = await request.json()
    const {
      fileName,
      originalAlgorithm,
      newAlgorithm = 'ML-KEM',
      hybridMode = false,
    } = body

    if (!fileName || !originalAlgorithm) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'fileName and originalAlgorithm are required' } },
        { status: 400 }
      )
    }

    // Calculate risk scores
    const riskScores: Record<string, number> = {
      'RSA-1024': 95, 'RSA-2048': 82, 'RSA-4096': 70,
      'ECC-P256': 80, 'ECC-P384': 75,
      'SHA-1': 98, 'MD5': 99,
      'TLS-1.0': 90, 'TLS-1.1': 85,
      'AES-128': 40, '3DES': 88,
    }
    const pqcScores: Record<string, number> = {
      'ML-KEM': 5, 'ML-DSA': 5, 'SPHINCS+': 5, 'HYBRID': 8,
    }

    const beforeScore = riskScores[originalAlgorithm] ?? 50
    const afterScore = pqcScores[newAlgorithm as PQCAlgorithm] ?? 5

    const migrationResult = {
      fileId: crypto.randomUUID(),
      fileName,
      originalAlgorithm,
      newAlgorithm,
      hybridMode,
      status: 'completed' as const,
      beforeScore,
      afterScore,
      migratedAt: new Date().toISOString(),
    }

    // Persist to database if authenticated
    const client = token ? createAuthClient(token) : null
    if (user && client) {
      await client.from('migration_logs').insert({
        user_id: user.id,
        file_name: fileName,
        original_algorithm: originalAlgorithm,
        new_algorithm: newAlgorithm,
        hybrid_mode: hybridMode,
        status: 'completed',
        before_score: beforeScore,
        after_score: afterScore,
        migrated_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ data: migrationResult })
  } catch (err) {
    console.error('Migration error:', err)
    return NextResponse.json(
      { error: { code: 'MIGRATION_ERROR', message: 'Failed to process migration' } },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const reqToken = getToken(request)
    const user = await getServerUser(request)
    if (!user || !reqToken) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const db = createAuthClient(reqToken)
    if (!db) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 }
      )
    }

    const { data: logs } = await db
      .from('migration_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    return NextResponse.json({ data: logs || [] })
  } catch (err) {
    console.error('Migration logs error:', err)
    return NextResponse.json(
      { error: { code: 'MIGRATION_ERROR', message: 'Failed to fetch migration logs' } },
      { status: 500 }
    )
  }
}
