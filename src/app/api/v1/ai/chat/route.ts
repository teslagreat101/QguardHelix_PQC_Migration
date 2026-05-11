import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYSTEM_PROMPT = `You are QGuard AI Security Co-Pilot — an expert post-quantum cryptography (PQC) security analyst embedded in the QGuard platform.

Your role:
- Analyze quantum vulnerability scan findings and provide actionable security guidance
- Explain cryptographic risks in clear, professional language
- Recommend NIST-standardized post-quantum migration paths (FIPS 203 ML-KEM, FIPS 204 ML-DSA, FIPS 205 SLH-DSA, FIPS 206 Falcon)
- Prioritize findings by risk severity and business impact
- Generate executive summaries, remediation plans, and compliance guidance
- Explain Harvest Now Decrypt Later (HNDL) threats and quantum break timelines
- Reference Shor's algorithm (breaks RSA/ECC/DH) and Grover's algorithm (weakens AES/SHA)

Guidelines:
- Be concise but thorough. Use bullet points and structured formatting.
- When referencing algorithms, include NIST FIPS standard numbers.
- Prioritize critical and high-severity findings first.
- For migration recommendations, include estimated effort and complexity.
- When asked about specific algorithms, explain both the quantum threat AND the migration path.
- Never recommend deprecated or insecure algorithms.
- Format responses with markdown for readability.`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages: ChatMessage[]
  scanContext?: {
    findings: {
      detectedAlgorithm: string
      threatLevel: string
      isHNDLRisk: boolean
      target: { name: string; type: string }
      quantumBreakTime: string
      riskScore: number
      description: string
      recommendation: string
    }[]
    qScore: number | null
    targets: string[]
  }
}

interface ProviderResult {
  message: string
  provider: string
  usage?: { inputTokens?: number; outputTokens?: number }
}

// ─── Provider Implementations ─────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<ProviderResult> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('')

  return {
    message: text,
    provider: 'anthropic',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  }
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<ProviderResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`OpenAI API ${res.status}: ${errBody}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]

  return {
    message: choice?.message?.content || '',
    provider: 'openai',
    usage: {
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
    },
  }
}

async function callGemini(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<ProviderResult> {
  const geminiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    }
  )

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Gemini API ${res.status}: ${errBody}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return {
    message: text,
    provider: 'gemini',
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    },
  }
}

// ─── Provider Priority & Fallback ─────────────────────────────────────────────

interface ProviderConfig {
  name: string
  key: string | undefined
  call: (key: string, system: string, msgs: ChatMessage[]) => Promise<ProviderResult>
}

function getProviders(): ProviderConfig[] {
  return [
    { name: 'Anthropic', key: process.env.ANTHROPIC_API_KEY, call: callAnthropic },
    { name: 'OpenAI', key: process.env.OPENAI_API_KEY, call: callOpenAI },
    { name: 'Gemini', key: process.env.GEMINI_API_KEY, call: callGemini },
  ].filter((p) => !!p.key)
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const providers = getProviders()
    if (providers.length === 0) {
      return NextResponse.json(
        { error: 'No AI provider configured. Add ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY to .env.local' },
        { status: 503 }
      )
    }

    const body: ChatRequestBody = await request.json()
    const { messages, scanContext } = body

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required' },
        { status: 400 }
      )
    }

    // Build context-enriched system prompt
    let systemPrompt = SYSTEM_PROMPT
    if (scanContext?.findings && scanContext.findings.length > 0) {
      const findingSummary = scanContext.findings.map((f) =>
        `- ${f.detectedAlgorithm} (${f.threatLevel}, risk: ${f.riskScore}/100) on ${f.target.name} [${f.target.type}] — HNDL: ${f.isHNDLRisk ? 'YES' : 'NO'}, quantum break: ${f.quantumBreakTime}`
      ).join('\n')

      const threatCounts = {
        critical: scanContext.findings.filter(f => f.threatLevel === 'critical').length,
        high: scanContext.findings.filter(f => f.threatLevel === 'high').length,
        medium: scanContext.findings.filter(f => f.threatLevel === 'medium').length,
        low: scanContext.findings.filter(f => f.threatLevel === 'low').length,
      }

      systemPrompt += `\n\n--- CURRENT SCAN CONTEXT ---
Q-Score: ${scanContext.qScore ?? 'N/A'}/100
Targets scanned: ${scanContext.targets.join(', ')}
Total findings: ${scanContext.findings.length}
Threat breakdown: ${threatCounts.critical} critical, ${threatCounts.high} high, ${threatCounts.medium} medium, ${threatCounts.low} low
HNDL risks: ${scanContext.findings.filter(f => f.isHNDLRisk).length}

Detailed findings:
${findingSummary}
--- END SCAN CONTEXT ---

Use this scan data to provide specific, contextual analysis. Reference exact algorithms, targets, and risk scores in your responses.`
    }

    // Try each provider in order, fallback on failure
    const errors: string[] = []

    for (const provider of providers) {
      try {
        const result = await provider.call(provider.key!, systemPrompt, messages)
        return NextResponse.json({
          message: result.message,
          provider: result.provider,
          usage: result.usage,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[AI Chat] ${provider.name} failed: ${msg}`)
        errors.push(`${provider.name}: ${msg}`)
      }
    }

    // All providers failed
    return NextResponse.json(
      { error: `All AI providers failed.\n${errors.join('\n')}` },
      { status: 502 }
    )
  } catch (err) {
    console.error('AI chat error:', err)
    const message = err instanceof Error ? err.message : 'AI service error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
