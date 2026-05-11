import { CodeBlock } from '@/components/docs/CodeBlock'
import { SchemaTable, type SchemaField } from '@/components/docs/SchemaTable'

// ─── Error Response Schema ────────────────────────────────────────────────────

const ERROR_SCHEMA_FIELDS: SchemaField[] = [
  {
    field: 'error',
    type: 'string',
    required: true,
    description: 'Short machine-readable error identifier matching the HTTP status reason phrase.',
    example: 'Bad Request',
  },
  {
    field: 'message',
    type: 'string',
    required: true,
    description: 'Human-readable description of the error. Safe to display in client UIs.',
    example: 'The field "algorithm" is required.',
  },
  {
    field: 'statusCode',
    type: 'number',
    required: true,
    description: 'HTTP status code echoed in the response body for convenience.',
    example: '400',
  },
  {
    field: 'details',
    type: 'object',
    required: false,
    description: 'Optional structured context. Present on validation errors — contains field-level messages.',
    example: '{ "algorithm": "Invalid value" }',
  },
]

// ─── HTTP Status Codes ────────────────────────────────────────────────────────

const HTTP_STATUS_FIELDS: SchemaField[] = [
  {
    field: '400',
    type: 'Bad Request',
    required: false,
    description: 'Invalid request body or parameters. Check the details object for field-level validation errors.',
  },
  {
    field: '401',
    type: 'Unauthorized',
    required: false,
    description: 'Missing or invalid authentication. Ensure your Bearer JWT or x-qrng-api-key header is present and unexpired.',
  },
  {
    field: '403',
    type: 'Forbidden',
    required: false,
    description: 'Insufficient permissions. Your account or plan does not have access to this resource or operation.',
  },
  {
    field: '404',
    type: 'Not Found',
    required: false,
    description: 'Resource does not exist. Verify the ID or path is correct and belongs to your account.',
  },
  {
    field: '409',
    type: 'Conflict',
    required: false,
    description: 'Resource state conflict — e.g., attempting to revoke a key that is already revoked.',
  },
  {
    field: '422',
    type: 'Unprocessable Entity',
    required: false,
    description: 'Valid JSON but semantic errors — e.g., an algorithm incompatible with the requested purpose.',
  },
  {
    field: '429',
    type: 'Too Many Requests',
    required: false,
    description: 'Rate limit exceeded. Respect the Retry-After header before retrying.',
  },
  {
    field: '500',
    type: 'Internal Server Error',
    required: false,
    description: 'Unexpected server error. The request was valid but processing failed. Retry with exponential backoff.',
  },
  {
    field: '503',
    type: 'Service Unavailable',
    required: false,
    description: 'QRNG service offline. Entropy collection is temporarily unavailable. Monitor /api/v1/qrng/status for recovery.',
  },
]

// ─── Rate Limit Headers ───────────────────────────────────────────────────────

const RATE_LIMIT_FIELDS: SchemaField[] = [
  {
    field: 'X-RateLimit-Limit',
    type: 'number',
    required: true,
    description: 'Maximum number of requests allowed in the current window for your plan and endpoint.',
    example: '60',
  },
  {
    field: 'X-RateLimit-Remaining',
    type: 'number',
    required: true,
    description: 'Number of requests remaining in the current window. Drops to 0 when the limit is reached.',
    example: '42',
  },
  {
    field: 'X-RateLimit-Reset',
    type: 'number (Unix timestamp)',
    required: true,
    description: 'UTC Unix timestamp indicating when the rate limit window resets and the counter is cleared.',
    example: '1744027200',
  },
  {
    field: 'Retry-After',
    type: 'number (seconds)',
    required: false,
    description: 'Present only on 429 responses. Number of seconds to wait before retrying the request.',
    example: '15',
  },
]

// ─── Code Examples ────────────────────────────────────────────────────────────

const EXAMPLE_400 = `{
  "error": "Bad Request",
  "message": "Validation failed for request body.",
  "statusCode": 400,
  "details": {
    "algorithm": "Must be one of: ML-KEM, ML-DSA, SPHINCS+, HYBRID",
    "purpose": "Field is required"
  }
}`

const EXAMPLE_401 = `{
  "error": "Unauthorized",
  "message": "Missing or invalid authentication token.",
  "statusCode": 401
}`

const EXAMPLE_429 = `{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Retry after 15 seconds.",
  "statusCode": 429
}

// Response headers:
// X-RateLimit-Limit: 60
// X-RateLimit-Remaining: 0
// X-RateLimit-Reset: 1744027200
// Retry-After: 15`

const EXAMPLE_500 = `{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred. Please try again.",
  "statusCode": 500
}`

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

const RETRY_EXAMPLE = `async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<T> {
  const { maxAttempts = 4, baseDelayMs = 500 } = options

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode

      // Do not retry client errors (except 429)
      const isRetryable = status === 429 || status === 500 || status === 503
      if (!isRetryable || attempt === maxAttempts) throw err

      // Respect Retry-After header if present (429), else exponential backoff
      const retryAfterMs =
        status === 429
          ? ((err as { retryAfter?: number }).retryAfter ?? 0) * 1000
          : 0
      const backoffMs = retryAfterMs || baseDelayMs * 2 ** (attempt - 1)

      // Add jitter to avoid thundering herd
      const jitter = Math.random() * 200
      await new Promise(resolve => setTimeout(resolve, backoffMs + jitter))
    }
  }

  // Unreachable — satisfies TypeScript
  throw new Error('Retry limit exceeded')
}

// Usage
const result = await withRetry(() =>
  fetch('/api/v1/keys', {
    method: 'POST',
    headers: {
      Authorization: \`Bearer \${token}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ algorithm: 'ML-KEM', bitLength: 768, purpose: 'encryption' }),
  }).then(async res => {
    if (!res.ok) {
      const body = await res.json()
      throw Object.assign(new Error(body.message), {
        statusCode: res.status,
        retryAfter: Number(res.headers.get('Retry-After') ?? 0),
      })
    }
    return res.json()
  })
)`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ErrorsPage() {
  return (
    <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* Header */}
      <div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--qg-cyan)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}>
          Reference
        </span>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 800,
          marginTop: 8,
          letterSpacing: '-0.02em',
          color: 'var(--qg-text-primary)',
        }}>
          Error Code Reference
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginTop: 12 }}>
          All QGuard API errors follow a consistent JSON envelope. Every non-2xx response
          includes an <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-cyan)' }}>error</code>,{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-cyan)' }}>message</code>, and{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-cyan)' }}>statusCode</code> field.
          Validation failures additionally include a{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-cyan)' }}>details</code> object
          with field-level error messages.
        </p>
      </div>

      {/* Error Response Schema */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 8,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Error Response Schema
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
          Every error response from the QGuard API conforms to the following shape regardless of
          which endpoint triggered it.
        </p>
        <SchemaTable title="Error Object" fields={ERROR_SCHEMA_FIELDS} />
      </section>

      {/* HTTP Status Codes */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 8,
          borderTop: '1px solid var(--qg-border)',
        }}>
          HTTP Status Codes
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
          QGuard uses standard HTTP status codes. The table below covers every code the API may
          return and the recommended client-side action for each.
        </p>
        <SchemaTable title="Status Codes" fields={HTTP_STATUS_FIELDS} />
      </section>

      {/* Rate Limit Headers */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 8,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Rate Limit Headers
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
          Every API response includes rate limit headers so clients can proactively throttle
          before hitting a 429. Parse these headers to implement smooth backpressure.
        </p>
        <SchemaTable title="Response Headers" fields={RATE_LIMIT_FIELDS} />
      </section>

      {/* Example Responses */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 8,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Example Error Responses
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CodeBlock language="json" title="400 Bad Request — validation failure" code={EXAMPLE_400} />
          <CodeBlock language="json" title="401 Unauthorized — missing token" code={EXAMPLE_401} />
          <CodeBlock language="json" title="429 Too Many Requests — with headers" code={EXAMPLE_429} />
          <CodeBlock language="json" title="500 Internal Server Error" code={EXAMPLE_500} />
        </div>
      </section>

      {/* Best Practices */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 8,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Best Practices
        </h2>

        {/* Retry Strategy Overview */}
        <div style={{
          borderRadius: 10,
          border: '1px solid rgba(0,212,255,0.2)',
          background: 'rgba(0,212,255,0.04)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--qg-cyan)',
          }}>
            Retry Strategy
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Retry only on 429, 500, and 503 responses — never retry 4xx client errors.',
              'On 429, wait the exact number of seconds specified in the Retry-After header.',
              'On 500 / 503, use exponential backoff with jitter to avoid thundering-herd amplification.',
              'Cap retry attempts (recommended: 4) and surface a permanent failure to the user after exhaustion.',
              'Monitor X-RateLimit-Remaining proactively and slow down before reaching 0.',
            ].map((tip, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <CodeBlock
          language="typescript"
          title="Retry with exponential backoff"
          code={RETRY_EXAMPLE}
        />
      </section>

    </div>
  )
}
