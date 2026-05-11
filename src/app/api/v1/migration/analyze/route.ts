import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient } from '@/lib/supabase'
import { getServerUser, getToken } from '@/lib/server-auth'
import { encryptAssessmentPayload } from '@/lib/migration-planner/crypto'
import { mapAssessmentSummary } from '@/lib/migration-planner/records'
import { migrationAssessmentInputSchema } from '@/lib/migration-planner/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request)
    const user = await getServerUser(request)
    if (!user || !token) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      )
    }

    const client = createAuthClient(token)
    if (!client) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Service not configured' } },
        { status: 500 },
      )
    }

    const body = await request.json()
    const parsed = migrationAssessmentInputSchema.safeParse(body)

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: issue?.message || 'Invalid migration assessment input' } },
        { status: 400 },
      )
    }

    const input = parsed.data
    const encrypted = encryptAssessmentPayload({ input, result: null })

    const { data, error } = await client
      .from('migration_assessments')
      .insert({
        user_id: user.id,
        organization_name: input.organization.organizationName,
        business_unit: input.organization.businessUnit || null,
        industry: input.organization.industry,
        region: input.organization.region || null,
        urgency_level: input.organization.migrationUrgency,
        security_maturity: input.organization.securityMaturity,
        total_assets: input.assets.length,
        encrypted_payload: encrypted.ciphertext,
        encryption_iv: encrypted.iv,
        encryption_version: encrypted.version,
        progress_stage: 'Queued for assessment',
        summary_json: {
          organizationName: input.organization.organizationName,
          complianceRequirements: input.organization.complianceRequirements,
          assetTypes: Array.from(new Set(input.assets.map((asset) => asset.assetType))),
          encryptionStrategy: input.encryptionStrategy,
          selectedCryptoStrategy: input.selectedCryptoStrategy,
          createdFrom: 'dashboard-migrate',
        },
      })
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: { code: 'INSERT_ERROR', message: error?.message || 'Failed to create assessment' } },
        { status: 500 },
      )
    }

    return NextResponse.json({
      status: 'success',
      data: mapAssessmentSummary(data),
    }, { status: 201 })
  } catch (error) {
    console.error('POST /api/v1/migration/analyze error:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create migration assessment' } },
      { status: 500 },
    )
  }
}
