import { CodeBlock } from '@/components/docs/CodeBlock'
import { SchemaTable, type SchemaField } from '@/components/docs/SchemaTable'

// ─── Styles ───────────────────────────────────────────────────────────────────

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--qg-text-primary)',
  marginBottom: 12,
  paddingTop: 24,
  borderTop: '1px solid var(--qg-border)',
}

const subHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--qg-text-primary)',
  marginBottom: 10,
  marginTop: 20,
}

const bodyText: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.8,
  color: 'var(--qg-text-secondary)',
}

const monoSmall: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--qg-cyan)',
}

// ─── SSE Endpoints table data ─────────────────────────────────────────────────

const sseEndpointFields: SchemaField[] = [
  {
    field: '/api/v1/qrng/generate/stream',
    type: 'POST · SSE',
    required: false,
    description: 'Quantum generation stream — used by OTP, Keys, PKI, Tokenize, Comm, and Cloud actions. Pass action field in the request body to select the service.',
    example: 'action: "otp" | "key" | "pki" | "tokenize" | "comm" | "cloud"',
  },
  {
    field: '/api/v1/otp/stream',
    type: 'GET · SSE',
    required: false,
    description: 'Real-time OTP event stream. Emits an initial snapshot of active tokens, then pushes new_otps events as new records are persisted.',
    example: '?token=JWT',
  },
  {
    field: '/api/v1/vault/stream',
    type: 'GET · SSE',
    required: false,
    description: 'Quantum Vault live stream. Delivers a snapshot of vault items on connect, then pushes item_added and progress events as entries change.',
    example: '?token=JWT',
  },
  {
    field: '/api/v1/vault/share/events',
    type: 'GET · SSE',
    required: false,
    description: 'Vault sharing event stream. Notifies connected clients when a shared vault item is accepted, revoked, or updated.',
    example: '?token=JWT',
  },
  {
    field: '/api/v1/scan/stream',
    type: 'POST · SSE',
    required: false,
    description: 'Security scanner stream. Streams progress and result events as the scanner analyses the submitted payload.',
    example: 'Authorization: Bearer JWT',
  },
  {
    field: '/api/v1/admin/stream',
    type: 'GET · SSE',
    required: false,
    description: 'Admin dashboard stream. Delivers live platform metrics, user activity, and system health events. Requires admin role.',
    example: '?token=JWT',
  },
  {
    field: '/api/v1/keys/stream',
    type: 'GET · SSE',
    required: false,
    description: 'Cryptographic keys event stream. Pushes progress and result events during key generation jobs.',
    example: '?token=JWT',
  },
]

// ─── Event types table data ───────────────────────────────────────────────────

const eventTypeFields: SchemaField[] = [
  {
    field: 'progress',
    type: 'string (event name)',
    required: false,
    description: 'Sent periodically during long-running operations to indicate work is ongoing. The data payload contains a percentage or status message.',
    example: '{"percent":42,"message":"Generating entropy..."}',
  },
  {
    field: 'result',
    type: 'string (event name)',
    required: false,
    description: 'The primary output event. Carries the final computed artifact (key, OTP, scan report, etc.) as a JSON payload.',
    example: '{"key":"...","algorithm":"AES-256"}',
  },
  {
    field: 'snapshot',
    type: 'string (event name)',
    required: false,
    description: 'Emitted immediately on connection to deliver the current state of the resource, so clients do not miss events that occurred before they connected.',
    example: '[{"id":"...","status":"active"}]',
  },
  {
    field: 'new_otps',
    type: 'string (event name)',
    required: false,
    description: 'OTP stream only. Pushed whenever new OTP records are persisted for the authenticated user.',
    example: '[{"id":"...","otp":"482931","status":"active"}]',
  },
  {
    field: 'item_added',
    type: 'string (event name)',
    required: false,
    description: 'Vault stream only. Pushed when a new vault item is created or a shared item is accepted.',
    example: '{"id":"...","label":"My Key","type":"aes"}',
  },
  {
    field: 'complete',
    type: 'string (event name)',
    required: false,
    description: 'Signals that the server has finished processing and will close the stream. No further events will be emitted after this.',
    example: '{"duration_ms":312}',
  },
  {
    field: 'error',
    type: 'string (event name)',
    required: false,
    description: 'Emitted when the server encounters an unrecoverable error. The stream is closed after this event. Always handle this event.',
    example: '{"code":"ENTROPY_FAILURE","message":"QRNG source unavailable"}',
  },
]

// ─── Code examples ────────────────────────────────────────────────────────────

const browserEventSourceCode = `// Browser — native EventSource API
// For GET SSE endpoints: pass JWT as a query parameter
const token = await getJwt() // retrieve from your auth provider

const source = new EventSource(
  \`https://api.qguard.io/api/v1/otp/stream?token=\${token}\`
)

// Handle named events
source.addEventListener('snapshot', (e) => {
  const otps = JSON.parse(e.data)
  console.log('Initial OTPs:', otps)
})

source.addEventListener('new_otps', (e) => {
  const newOtps = JSON.parse(e.data)
  console.log('New OTPs arrived:', newOtps)
})

source.addEventListener('error', (e) => {
  console.error('SSE error — closing connection', e)
  source.close()
})

// Close when the component unmounts or work is done
// source.close()`

const nodeFetchSseCode = `// Node.js — fetch + ReadableStream (TypeScript)
// Suitable for POST SSE endpoints that require an Authorization header

async function streamQrng(jwt: string): Promise<void> {
  const controller = new AbortController()
  const { signal } = controller

  // Abort after 60 s to avoid hung connections
  const timeout = setTimeout(() => controller.abort(), 60_000)

  try {
    const response = await fetch(
      'https://api.qguard.io/api/v1/qrng/generate/stream',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${jwt}\`,
        },
        body: JSON.stringify({ action: 'key', algorithm: 'AES-256', purpose: 'storage' }),
        signal,
      }
    )

    if (!response.ok || !response.body) {
      throw new Error(\`Unexpected status \${response.status}\`)
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader()

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += value

      // SSE messages are separated by double newlines
      const messages = buffer.split(/\\n\\n/)
      buffer = messages.pop() ?? ''

      for (const message of messages) {
        const lines = message.split(/\\n/)
        let eventName = 'message'
        let data = ''

        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim()
          if (line.startsWith('data:'))  data      = line.slice(5).trim()
        }

        if (eventName === 'result') {
          console.log('Key generated:', JSON.parse(data))
        } else if (eventName === 'error') {
          console.error('Stream error:', JSON.parse(data))
          controller.abort()
        }
      }
    }
  } finally {
    clearTimeout(timeout)
  }
}

streamQrng(process.env.QGUARD_JWT!)`

const pythonSseCode = `# Python — requests with streaming
# pip install requests

import json
import requests

def stream_vault(jwt: str) -> None:
    url = f"https://api.qguard.io/api/v1/vault/stream"
    params = {"token": jwt}

    # stream=True keeps the connection open and yields chunks
    with requests.get(url, params=params, stream=True, timeout=60) as resp:
        resp.raise_for_status()

        buffer = ""

        for chunk in resp.iter_content(chunk_size=None, decode_unicode=True):
            buffer += chunk

            # SSE messages are separated by double newlines
            while "\\n\\n" in buffer:
                message, buffer = buffer.split("\\n\\n", 1)
                event_name = "message"
                data = ""

                for line in message.splitlines():
                    if line.startswith("event:"):
                        event_name = line[6:].strip()
                    elif line.startswith("data:"):
                        data = line[5:].strip()

                if event_name == "snapshot":
                    items = json.loads(data)
                    print("Vault snapshot:", items)
                elif event_name == "item_added":
                    item = json.loads(data)
                    print("New vault item:", item)
                elif event_name == "complete":
                    print("Stream complete.")
                    return
                elif event_name == "error":
                    error = json.loads(data)
                    raise RuntimeError(f"Server error: {error['message']}")

import os
stream_vault(os.environ["QGUARD_JWT"])`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
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
          Guides
        </span>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 800,
          marginTop: 8,
          letterSpacing: '-0.02em',
          color: 'var(--qg-text-primary)',
        }}>
          Webhooks &amp; Server-Sent Events
        </h1>
        <p style={{ ...bodyText, marginTop: 12 }}>
          QGuard delivers real-time updates via <strong style={{ color: 'var(--qg-text-primary)' }}>Server-Sent Events (SSE)</strong> rather
          than traditional webhooks. All streaming endpoints follow the same SSE pattern — a persistent HTTP
          connection over which the server pushes typed JSON events until the operation completes or the client
          disconnects. This approach requires no public callback URL on your end and works natively in browsers
          via the <code style={monoSmall}>EventSource</code> API.
        </p>
      </div>

      {/* SSE Endpoints */}
      <section>
        <h2 style={sectionHeadingStyle}>SSE Endpoints</h2>
        <p style={{ ...bodyText, marginBottom: 16 }}>
          The following endpoints return <code style={monoSmall}>Content-Type: text/event-stream</code> and keep
          the connection open until the operation finishes or the client closes it.
        </p>
        <SchemaTable
          title="Streaming Endpoints"
          fields={sseEndpointFields}
        />
      </section>

      {/* Event Types */}
      <section>
        <h2 style={sectionHeadingStyle}>Event Types</h2>
        <p style={{ ...bodyText, marginBottom: 16 }}>
          Every SSE message includes an <code style={monoSmall}>event:</code> line that names the event type and a
          <code style={monoSmall}> data:</code> line containing a JSON payload. The table below lists the common
          event types emitted across all QGuard streaming endpoints.
        </p>
        <SchemaTable
          title="Common Event Types"
          fields={eventTypeFields}
        />
      </section>

      {/* Connection Pattern */}
      <section>
        <h2 style={sectionHeadingStyle}>Connection Pattern</h2>
        <p style={{ ...bodyText, marginBottom: 20 }}>
          Choose the client that matches your runtime environment. All three examples demonstrate correct
          event parsing, error handling, and connection teardown.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={subHeadingStyle}>Browser — EventSource (JavaScript)</div>
            <p style={{ ...bodyText, marginBottom: 12 }}>
              The native <code style={monoSmall}>EventSource</code> API is the simplest way to consume SSE in a browser.
              It automatically reconnects on network interruptions and dispatches named events you can listen for
              with <code style={monoSmall}>addEventListener</code>. Use it for GET SSE endpoints.
            </p>
            <CodeBlock
              language="javascript"
              title="browser-sse.js"
              code={browserEventSourceCode}
            />
          </div>

          <div>
            <div style={subHeadingStyle}>Node.js — fetch + ReadableStream (TypeScript)</div>
            <p style={{ ...bodyText, marginBottom: 12 }}>
              For POST SSE endpoints (such as <code style={monoSmall}>/api/v1/qrng/generate/stream</code>), use the
              Fetch API with a <code style={monoSmall}>ReadableStream</code> pipeline. This lets you send a request
              body and set an <code style={monoSmall}>Authorization</code> header — neither of which is possible with
              <code style={monoSmall}> EventSource</code>. Use an <code style={monoSmall}>AbortController</code> to
              enforce timeouts.
            </p>
            <CodeBlock
              language="typescript"
              title="node-sse.ts"
              code={nodeFetchSseCode}
            />
          </div>

          <div>
            <div style={subHeadingStyle}>Python — requests (streaming)</div>
            <p style={{ ...bodyText, marginBottom: 12 }}>
              In Python, pass <code style={monoSmall}>stream=True</code> to <code style={monoSmall}>requests.get</code> and
              iterate over <code style={monoSmall}>iter_content</code> with <code style={monoSmall}>decode_unicode=True</code>.
              Accumulate chunks in a buffer and split on double newlines to reconstruct complete SSE messages.
            </p>
            <CodeBlock
              language="python"
              title="sse_client.py"
              code={pythonSseCode}
            />
          </div>
        </div>
      </section>

      {/* Connection Management */}
      <section>
        <h2 style={sectionHeadingStyle}>Connection Management</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Heartbeat */}
          <div style={{
            borderRadius: 10,
            border: '1px solid var(--qg-border)',
            padding: '16px 20px',
            background: 'rgba(0,212,255,0.02)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--qg-cyan)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Heartbeat
            </div>
            <p style={bodyText}>
              The server emits a <code style={monoSmall}>:keepalive</code> SSE comment every <strong style={{ color: 'var(--qg-text-primary)' }}>30 seconds</strong> on
              idle connections. This prevents load balancers and proxies with short idle-connection timeouts from
              prematurely closing the stream. Comment lines (prefixed with <code style={monoSmall}>:</code>) are
              ignored by the SSE spec and do not trigger event handlers.
            </p>
          </div>

          {/* Reconnection */}
          <div style={{
            borderRadius: 10,
            border: '1px solid var(--qg-border)',
            padding: '16px 20px',
            background: 'rgba(0,212,255,0.02)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--qg-cyan)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Reconnection
            </div>
            <p style={bodyText}>
              <strong style={{ color: 'var(--qg-text-primary)' }}>EventSource</strong> reconnects automatically using
              the browser&apos;s built-in retry logic (default 3 s, server-configurable via the <code style={monoSmall}>retry:</code> field).
              For <strong style={{ color: 'var(--qg-text-primary)' }}>fetch-based</strong> clients, implement manual
              reconnection with <strong style={{ color: 'var(--qg-text-primary)' }}>exponential backoff</strong> — start
              at 1 s and double on each failure up to a cap of 30 s. Reset the counter on a successful connection
              that remains open for more than 60 s.
            </p>
          </div>

          {/* Auth */}
          <div style={{
            borderRadius: 10,
            border: '1px solid var(--qg-border)',
            padding: '16px 20px',
            background: 'rgba(0,212,255,0.02)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--qg-cyan)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Authentication
            </div>
            <p style={bodyText}>
              Two patterns are used depending on the HTTP method:
            </p>
            <ul style={{ paddingLeft: 20, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li style={bodyText}>
                <strong style={{ color: 'var(--qg-text-primary)' }}>GET SSE endpoints</strong> — pass your JWT as the
                <code style={monoSmall}> ?token=JWT</code> query parameter. The <code style={monoSmall}>EventSource</code> API
                cannot set custom headers, so this is the only viable option for browser clients.
              </li>
              <li style={bodyText}>
                <strong style={{ color: 'var(--qg-text-primary)' }}>POST SSE endpoints</strong> — send your JWT in the
                <code style={monoSmall}> Authorization: Bearer &lt;JWT&gt;</code> header. Never expose JWTs in URLs for
                POST endpoints — they will appear in server logs and browser history.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section>
        <h2 style={sectionHeadingStyle}>Best Practices</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              title: 'Always handle error events',
              detail: 'Every SSE client must attach an error event listener. Unhandled errors leave connections in an undefined state and can cause memory leaks. Log the error payload and close the connection explicitly.',
            },
            {
              title: 'Implement exponential backoff on reconnection',
              detail: 'For fetch-based clients, do not reconnect immediately on failure. Start with a 1 s delay, double on each failure (1 s → 2 s → 4 s … up to 30 s), and add random jitter to prevent thundering herd when many clients reconnect simultaneously.',
            },
            {
              title: 'Close connections when no longer needed',
              detail: 'SSE connections hold server resources. Call source.close() (EventSource) or controller.abort() (fetch) as soon as the client no longer needs the stream — for example, when a React component unmounts or a background job finishes.',
            },
            {
              title: 'Use AbortController for fetch-based SSE',
              detail: 'Always create an AbortController and pass its signal to fetch. This lets you cancel the stream programmatically and enforces a hard timeout. Without it, a stalled connection can block Node.js event-loop teardown.',
            },
          ].map(({ title, detail }) => (
            <div
              key={title}
              style={{
                borderRadius: 10,
                border: '1px solid var(--qg-border)',
                padding: '14px 18px',
                background: 'rgba(0,212,255,0.02)',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--qg-green)',
                marginTop: 2,
                flexShrink: 0,
              }}>
                ✓
              </span>
              <div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--qg-text-primary)',
                  marginBottom: 4,
                }}>
                  {title}
                </div>
                <p style={bodyText}>{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}
