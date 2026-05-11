import { CodeBlock } from '@/components/docs/CodeBlock'
import { SchemaTable, type SchemaField } from '@/components/docs/SchemaTable'

const AUTH_HEADER_FIELDS: SchemaField[] = [
  { field: 'Authorization', type: 'string', required: true, description: 'Bearer token from Supabase auth', example: 'Bearer eyJhbGci...' },
  { field: 'Content-Type', type: 'string', required: true, description: 'Must be application/json', example: 'application/json' },
]

const API_KEY_FIELDS: SchemaField[] = [
  { field: 'x-qrng-api-key', type: 'string', required: true, description: 'API key for QRNG service (port 8420)', example: 'qrng_live_abc123' },
  { field: 'Content-Type', type: 'string', required: true, description: 'Must be application/json', example: 'application/json' },
]

const ERROR_FIELDS: SchemaField[] = [
  { field: '401', type: 'Unauthorized', required: false, description: 'Missing or invalid token / API key' },
  { field: '403', type: 'Forbidden', required: false, description: 'Token valid but insufficient permissions' },
  { field: '429', type: 'Too Many Requests', required: false, description: 'Rate limit exceeded \u2014 check Retry-After header' },
]

export default function AuthPage() {
  return (
    <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--qg-cyan)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Getting Started</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, marginTop: 8, letterSpacing: '-0.02em', color: 'var(--qg-text-primary)' }}>
          Authentication
        </h1>
        <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginTop: 12 }}>
          QGuard uses two authentication methods depending on which service you are accessing. The primary Next.js API (port 4000) uses Supabase JWT tokens. The QRNG microservice (port 8420) uses API key authentication.
        </p>
      </div>

      {/* Method 1: JWT */}
      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 12, paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
          Method 1: Bearer JWT Token (Primary API)
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginBottom: 16 }}>
          All endpoints on port 4000 under <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>/api/v1/*</code> require a Supabase JWT token. Obtain one by logging in via the Supabase Auth API.
        </p>
        <SchemaTable title="Required Headers" fields={AUTH_HEADER_FIELDS} />
        <div style={{ marginTop: 16 }}>
          <CodeBlock language="bash" title="Obtain a JWT token" code={`# Login to get your JWT token
curl -X POST "https://YOUR_SUPABASE_URL/auth/v1/token?grant_type=password" \\
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# Response includes access_token \u2014 use it as Bearer token
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIs...",
#   "token_type": "bearer",
#   "expires_in": 3600
# }`} />
        </div>
        <div style={{ marginTop: 12 }}>
          <CodeBlock language="bash" title="Using the JWT token" code={`# Use the token in subsequent requests
curl -X GET "http://localhost:4000/api/v1/keys?limit=10" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \\
  -H "Content-Type: application/json"`} />
        </div>
      </section>

      {/* Method 2: API Key */}
      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 12, paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
          Method 2: API Key (QRNG Microservice)
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', marginBottom: 16 }}>
          The QRNG FastAPI service on port 8420 uses API key authentication via the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>x-qrng-api-key</code> header. Obtain your API key from Dashboard &rarr; Settings &rarr; API Keys.
        </p>
        <SchemaTable title="Required Headers" fields={API_KEY_FIELDS} />
        <div style={{ marginTop: 16 }}>
          <CodeBlock language="bash" title="Direct QRNG service call" code={`curl -X POST "http://localhost:8420/api/v1/qrng/generate/stream" \\
  -H "x-qrng-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "otp",
    "length": 6,
    "format": "numeric"
  }'`} />
        </div>
      </section>

      {/* Error responses */}
      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 12, paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
          Authentication Errors
        </h2>
        <SchemaTable title="Error Responses" fields={ERROR_FIELDS} />
        <div style={{ marginTop: 16 }}>
          <CodeBlock language="json" title="Example 401 response" code={`{
  "error": "Unauthorized",
  "message": "Invalid or expired token",
  "statusCode": 401
}`} />
        </div>
      </section>
    </div>
  )
}
