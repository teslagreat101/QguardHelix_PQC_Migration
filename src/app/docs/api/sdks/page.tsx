import { CodeBlock } from '@/components/docs/CodeBlock'

// ─── Code snippets ────────────────────────────────────────────────────────────

const INSTALL_NODE = `npm install @qguard/sdk`

const INSTALL_PYTHON = `pip install qguard`

const NODE_INIT = `import { QGuardClient } from '@qguard/sdk'

const client = new QGuardClient({
  baseUrl: 'http://localhost:4000',
  apiKey: process.env.QGUARD_API_KEY, // Bearer JWT or x-qrng-api-key
})`

const NODE_GENERATE_OTP = `// Generate a quantum OTP via Server-Sent Events
async function generateOTP(): Promise<string> {
  const response = await fetch('http://localhost:4000/api/v1/qrng/generate/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${process.env.QGUARD_API_KEY}\`,
    },
    body: JSON.stringify({
      action: 'otp',
      length: 6,
      format: 'numeric',
      purpose: 'login',
      expires_in_seconds: 300,
    }),
  })

  // Read the first SSE event from the stream
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    for (const line of chunk.split('\\n')) {
      if (line.startsWith('data:')) {
        const payload = JSON.parse(line.slice(5).trim())
        return payload.otp as string
      }
    }
  }

  throw new Error('No OTP received from stream')
}`

const NODE_GENERATE_KEY = `// Generate a post-quantum key pair
async function generateKeyPair() {
  const response = await fetch('http://localhost:4000/api/v1/keys', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${process.env.QGUARD_API_KEY}\`,
    },
    body: JSON.stringify({
      algorithm: 'ML-KEM',
      bitLength: 768,
      label: 'API Server Key',
      purpose: 'encryption',
    }),
  })

  if (!response.ok) {
    throw new Error(\`Key generation failed: \${response.statusText}\`)
  }

  const { publicKey, fingerprint, algorithm, qualityScore } = await response.json()
  return { publicKey, fingerprint, algorithm, qualityScore }
}`

const NODE_REACT_HOOK = `'use client'

import { useState, useCallback } from 'react'

interface OTPState {
  otp: string | null
  loading: boolean
  error: string | null
}

export function useQGuardOTP() {
  const [state, setState] = useState<OTPState>({
    otp: null,
    loading: false,
    error: null,
  })

  const generate = useCallback(async (purpose = 'login') => {
    setState({ otp: null, loading: true, error: null })

    try {
      const res = await fetch('/api/v1/qrng/generate/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${localStorage.getItem('qguard_token')}\`,
        },
        body: JSON.stringify({ action: 'otp', length: 6, format: 'numeric', purpose }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\\n')) {
          if (line.startsWith('data:')) {
            const { otp } = JSON.parse(line.slice(5).trim())
            setState({ otp, loading: false, error: null })
            return otp
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState({ otp: null, loading: false, error: message })
    }
  }, [])

  return { ...state, generate }
}`

const PYTHON_INIT = `import os
import qguard

client = qguard.Client(
    base_url="http://localhost:4000",
    api_key=os.environ["QGUARD_API_KEY"],  # Bearer JWT or x-qrng-api-key
)`

const PYTHON_GENERATE_OTP = `import os
import requests
import sseclient

def generate_otp(purpose: str = "login", length: int = 6) -> str:
    """Generate a quantum OTP via SSE stream."""
    url = "http://localhost:4000/api/v1/qrng/generate/stream"
    headers = {
        "Authorization": f"Bearer {os.environ['QGUARD_API_KEY']}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    payload = {
        "action": "otp",
        "length": length,
        "format": "numeric",
        "purpose": purpose,
        "expires_in_seconds": 300,
    }

    response = requests.post(url, json=payload, headers=headers, stream=True)
    response.raise_for_status()

    client = sseclient.SSEClient(response)
    for event in client.events():
        data = json.loads(event.data)
        return data["otp"]

    raise RuntimeError("No OTP received from stream")`

const PYTHON_BATCH = `import os
import json
import requests

def batch_generate_otps(count: int = 10, purpose: str = "email-verify") -> list[str]:
    """Generate a batch of quantum OTPs in a single request."""
    url = "http://localhost:4000/api/v1/qrng/generate/stream"
    headers = {
        "Authorization": f"Bearer {os.environ['QGUARD_API_KEY']}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
    }
    payload = {
        "action": "otp",
        "batch": True,
        "count": count,
        "length": 6,
        "format": "numeric",
        "purpose": purpose,
        "expires_in_seconds": 600,
    }

    response = requests.post(url, json=payload, headers=headers, stream=True)
    response.raise_for_status()

    for line in response.iter_lines():
        decoded = line.decode("utf-8")
        if decoded.startswith("data:"):
            data = json.loads(decoded[5:].strip())
            return data["otps"]

    return []`

const PYTHON_FASTAPI = `from fastapi import FastAPI, Depends, HTTPException, Header
from typing import Annotated
import httpx
import os

app = FastAPI()

QGUARD_BASE = "http://localhost:4000/api/v1"

async def get_token(authorization: Annotated[str, Header()]) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    return authorization.split(" ", 1)[1]

@app.post("/auth/otp/generate")
async def generate_otp(token: str = Depends(get_token)):
    """Proxy quantum OTP generation and return the first event."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{QGUARD_BASE}/qrng/generate/stream",
            json={"action": "otp", "length": 6, "format": "numeric", "purpose": "login"},
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()

    # Parse first SSE data line
    for line in response.text.splitlines():
        if line.startswith("data:"):
            return {"otp": __import__("json").loads(line[5:])["otp"]}

    raise HTTPException(status_code=502, detail="No OTP received")`

const GO_POST = `package qguard

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

// post sends an authenticated JSON POST request and returns the response body.
func post(path string, body any) ([]byte, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost,
		"http://localhost:4000"+path, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("QGUARD_API_KEY"))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("server error %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}`

const GO_SSE = `package qguard

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
)

// GenerateOTP reads the first SSE event from the QRNG stream and returns the OTP.
func GenerateOTP(purpose string) (string, error) {
	body := map[string]any{
		"action":             "otp",
		"length":             6,
		"format":             "numeric",
		"purpose":            purpose,
		"expires_in_seconds": 300,
	}

	resp, err := postStream("/api/v1/qrng/generate/stream", body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data:") {
			raw := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
			var event struct {
				OTP string \`json:"otp"\`
			}
			if err := json.Unmarshal([]byte(raw), &event); err != nil {
				return "", fmt.Errorf("decode event: %w", err)
			}
			return event.OTP, nil
		}
	}
	return "", fmt.Errorf("no OTP event in stream")
}

func postStream(path string, body any) (*http.Response, error) {
	payload, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, "http://localhost:4000"+path,
		strings.NewReader(string(payload)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+os.Getenv("QGUARD_API_KEY"))
	return http.DefaultClient.Do(req)
}`

const JAVA_KEY_GEN = `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class QGuardExample {

    private static final String BASE_URL = "http://localhost:4000/api/v1";
    private static final String API_KEY  = System.getenv("QGUARD_API_KEY");

    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();

        String requestBody = """
            {
                "algorithm": "ML-KEM",
                "bitLength": 768,
                "label": "Java Service Key",
                "purpose": "encryption"
            }
            """;

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(BASE_URL + "/keys"))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + API_KEY)
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        HttpResponse<String> response =
            client.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Key generation failed: " + response.statusCode());
        }

        System.out.println("Key pair generated:");
        System.out.println(response.body());
    }
}`

const CURL_GENERATE_OTP = `curl -X POST http://localhost:4000/api/v1/qrng/generate/stream \\
  -H "Authorization: Bearer $QGUARD_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "otp",
    "length": 6,
    "format": "numeric",
    "purpose": "login",
    "expires_in_seconds": 300
  }'`

const CURL_LIST_KEYS = `curl -X GET "http://localhost:4000/api/v1/keys?limit=20&status=active" \\
  -H "Authorization: Bearer $QGUARD_API_KEY"`

const CURL_VALIDATE_OTP = `curl -X POST http://localhost:4000/api/v1/otp/validate \\
  -H "Authorization: Bearer $QGUARD_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "otp_id": "550e8400-e29b-41d4-a716-446655440000",
    "otp_value": "482931"
  }'`

const CURL_HEALTH = `curl http://localhost:4000/api/v1/qrng/status`

// ─── Shared styles ────────────────────────────────────────────────────────────

const sectionHeading: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--qg-text-primary)',
  marginBottom: 6,
  paddingTop: 32,
  borderTop: '1px solid var(--qg-border)',
}

const subHeading: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--qg-text-primary)',
  marginBottom: 10,
  marginTop: 24,
}

const prose: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.8,
  color: 'var(--qg-text-secondary)',
  margin: 0,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SDKsPage() {
  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
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
          fontSize: 'clamp(24px, 3vw, 34px)',
          fontWeight: 800,
          marginTop: 8,
          letterSpacing: '-0.02em',
          color: 'var(--qg-text-primary)',
        }}>
          SDK &amp; Integration Guides
        </h1>
        <p style={{ ...prose, marginTop: 12, maxWidth: 640 }}>
          Integrate QGuard quantum-safe cryptography into your stack using native SDKs or the
          REST API directly. Examples are provided for Node.js, Python, Go, Java, and cURL.
        </p>
      </div>

      {/* Install */}
      <section>
        <h2 style={sectionHeading}>Installation</h2>
        <p style={prose}>Install the official SDK for your language, or call the REST API directly with any HTTP client.</p>

        <div style={{ marginTop: 16 }}>
          <div style={subHeading}>Node.js / TypeScript</div>
          <CodeBlock code={INSTALL_NODE} language="bash" title="npm" />
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={subHeading}>Python</div>
          <CodeBlock code={INSTALL_PYTHON} language="bash" title="pip" />
        </div>
      </section>

      {/* Node.js / TypeScript */}
      <section>
        <h2 style={sectionHeading}>Node.js / TypeScript</h2>

        <div style={subHeading}>Initialize the client</div>
        <CodeBlock code={NODE_INIT} language="typescript" title="client.ts" />

        <div style={subHeading}>Generate an OTP (SSE stream)</div>
        <p style={prose}>
          The <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-cyan)' }}>/api/v1/qrng/generate/stream</span> endpoint
          streams the result as a Server-Sent Event. Read the first <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-cyan)' }}>data:</code> line and parse the JSON payload.
        </p>
        <div style={{ marginTop: 12 }}>
          <CodeBlock code={NODE_GENERATE_OTP} language="typescript" title="generateOTP.ts" />
        </div>

        <div style={subHeading}>Generate a PQC key pair</div>
        <CodeBlock code={NODE_GENERATE_KEY} language="typescript" title="generateKeyPair.ts" />

        <div style={subHeading}>React hook — <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>useQGuardOTP()</span></div>
        <p style={prose}>Drop this hook into any React component to generate and track OTP state.</p>
        <div style={{ marginTop: 12 }}>
          <CodeBlock code={NODE_REACT_HOOK} language="typescript" title="useQGuardOTP.ts" />
        </div>
      </section>

      {/* Python */}
      <section>
        <h2 style={sectionHeading}>Python</h2>

        <div style={subHeading}>Initialize the client</div>
        <CodeBlock code={PYTHON_INIT} language="python" title="client.py" />

        <div style={subHeading}>Generate an OTP with <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>requests</span> + <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>sseclient</span></div>
        <CodeBlock code={PYTHON_GENERATE_OTP} language="python" title="generate_otp.py" />

        <div style={subHeading}>Batch generate OTPs</div>
        <CodeBlock code={PYTHON_BATCH} language="python" title="batch_otp.py" />

        <div style={subHeading}>FastAPI integration</div>
        <p style={prose}>Proxy quantum OTP generation through a FastAPI endpoint with dependency-injected auth.</p>
        <div style={{ marginTop: 12 }}>
          <CodeBlock code={PYTHON_FASTAPI} language="python" title="main.py" />
        </div>
      </section>

      {/* Go */}
      <section>
        <h2 style={sectionHeading}>Go</h2>

        <div style={subHeading}>Authenticated POST helper</div>
        <CodeBlock code={GO_POST} language="go" title="qguard.go" />

        <div style={subHeading}>SSE stream reader — GenerateOTP</div>
        <CodeBlock code={GO_SSE} language="go" title="otp.go" />
      </section>

      {/* Java */}
      <section>
        <h2 style={sectionHeading}>Java</h2>

        <div style={subHeading}>Key generation with <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>java.net.http.HttpClient</span></div>
        <CodeBlock code={JAVA_KEY_GEN} language="java" title="QGuardExample.java" />
      </section>

      {/* cURL */}
      <section>
        <h2 style={sectionHeading}>cURL Quick Reference</h2>

        <div style={subHeading}>Generate OTP</div>
        <CodeBlock code={CURL_GENERATE_OTP} language="bash" title="generate-otp.sh" />

        <div style={subHeading}>List keys</div>
        <CodeBlock code={CURL_LIST_KEYS} language="bash" title="list-keys.sh" />

        <div style={subHeading}>Validate OTP</div>
        <CodeBlock code={CURL_VALIDATE_OTP} language="bash" title="validate-otp.sh" />

        <div style={subHeading}>Health check</div>
        <CodeBlock code={CURL_HEALTH} language="bash" title="health.sh" />
      </section>

    </div>
  )
}
