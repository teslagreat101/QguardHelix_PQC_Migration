'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'
import { CodeBlock } from '@/components/docs/CodeBlock'
import type { SchemaField } from '@/components/docs/SchemaTable'

// ── Shared request fields for seed generation endpoints ──────────────────────

const SEED_REQUEST_FIELDS: SchemaField[] = [
  {
    field: 'action',
    type: 'string',
    required: true,
    description: 'Must be "cloud-seeds" to invoke cloud seeding mode',
    example: 'cloud-seeds',
  },
  {
    field: 'container_count',
    type: 'integer',
    required: true,
    description: 'Number of containers to generate seeds for (1–20)',
    example: '4',
  },
  {
    field: 'seed_bits',
    type: '128 | 256 | 512',
    required: true,
    description: 'Entropy size in bits per seed',
    example: '256',
  },
  {
    field: 'target',
    type: 'string',
    required: true,
    description: 'Deployment target: kubernetes, docker, aws, gcp, azure, or generic',
    example: 'kubernetes',
  },
  {
    field: 'prefix',
    type: 'string',
    required: false,
    description: 'Optional label prefix applied to each seed identifier',
    example: 'prod-svc',
  },
  {
    field: 'format',
    type: 'hex | base64 | base32 | env',
    required: false,
    description: 'Output encoding for seed material. Defaults to hex',
    example: 'base64',
  },
]

// ── Shared response fields ────────────────────────────────────────────────────

const SEED_RESPONSE_FIELDS: SchemaField[] = [
  {
    field: 'seeds',
    type: 'array',
    required: true,
    description: 'Array of per-container crypto material objects',
  },
  {
    field: 'seeds[].seed',
    type: 'string',
    required: true,
    description: 'Primary quantum-random seed in the requested format',
    example: 'a3f8...c291',
  },
  {
    field: 'seeds[].encryption_key',
    type: 'string',
    required: true,
    description: 'Derived AES-256 encryption key (encoded)',
  },
  {
    field: 'seeds[].hmac_key',
    type: 'string',
    required: true,
    description: 'Derived HMAC-SHA-256 signing key (encoded)',
  },
  {
    field: 'seeds[].nonce',
    type: 'string',
    required: true,
    description: 'Per-container 96-bit nonce for AEAD ciphers',
  },
  {
    field: 'quality_score',
    type: 'number',
    required: true,
    description: 'NIST SP 800-90B entropy quality score (0.0–1.0)',
    example: '0.998',
  },
  {
    field: 'entropy_source',
    type: 'string',
    required: true,
    description: 'Identifies the QRNG hardware source used',
    example: 'idq-quantis-pcie-240m',
  },
]

// ── Status endpoint response fields ──────────────────────────────────────────

const STATUS_RESPONSE_FIELDS: SchemaField[] = [
  {
    field: 'status',
    type: 'string',
    required: true,
    description: '"ok" when the QRNG service is fully operational',
    example: 'ok',
  },
  {
    field: 'entropy_pool_available',
    type: 'boolean',
    required: true,
    description: 'True when sufficient entropy is buffered for generation',
  },
  {
    field: 'bits_per_second',
    type: 'number',
    required: true,
    description: 'Current QRNG throughput in bits per second',
    example: '240000000',
  },
  {
    field: 'hardware_online',
    type: 'boolean',
    required: true,
    description: 'True when QRNG hardware is detected and responding',
  },
  {
    field: 'latency_ms',
    type: 'number',
    required: true,
    description: 'Round-trip latency to QRNG hardware in milliseconds',
    example: '1.4',
  },
]

// ── Endpoint definitions ──────────────────────────────────────────────────────

const STREAM_ENDPOINT: EndpointDoc = {
  method: 'POST',
  path: '/api/v1/qrng/generate/stream',
  title: 'Generate Container Seeds',
  description:
    'Streams quantum-random seed material for a batch of containers over Server-Sent Events. ' +
    'Progress events are emitted as each seed is produced, making this ideal for large container ' +
    'counts or latency-sensitive orchestration pipelines that must start consuming keys immediately.',
  auth: 'jwt',
  rateLimit: '30 req/min Standard · 300 req/min Enterprise',
  isSSE: true,
  requestFields: SEED_REQUEST_FIELDS,
  responseFields: SEED_RESPONSE_FIELDS,
  requestBody: {
    action: 'cloud-seeds',
    container_count: 4,
    seed_bits: 256,
    target: 'kubernetes',
    prefix: 'prod-svc',
    format: 'base64',
  },
  responseExample: JSON.stringify(
    {
      seeds: [
        {
          seed: 'a3f8b1c29d0e4f5a6b7c8d9e0f1a2b3c',
          encryption_key: 'AAEC...',
          hmac_key: 'ZGVm...',
          nonce: 'c29kZXI=',
        },
      ],
      quality_score: 0.998,
      entropy_source: 'idq-quantis-pcie-240m',
    },
    null,
    2,
  ),
}

const DIRECT_ENDPOINT: EndpointDoc = {
  method: 'POST',
  path: '/api/v1/qrng/cloud/seeds',
  title: 'Direct Seed Generation',
  description:
    'Synchronous (non-streaming) variant that returns the complete seed batch in a single JSON ' +
    'response body. Use this when your client cannot consume SSE or when you need atomic delivery ' +
    'of all seeds before proceeding. Carries a lower rate limit than the streaming endpoint.',
  auth: 'jwt',
  rateLimit: '20 req/min',
  isSSE: false,
  requestFields: SEED_REQUEST_FIELDS,
  responseFields: SEED_RESPONSE_FIELDS,
  requestBody: {
    action: 'cloud-seeds',
    container_count: 2,
    seed_bits: 512,
    target: 'aws',
    format: 'hex',
  },
  responseExample: JSON.stringify(
    {
      seeds: [
        {
          seed: '7f3a9c...',
          encryption_key: 'e3b0c4...',
          hmac_key: '9f86d0...',
          nonce: '1a2b3c...',
        },
      ],
      quality_score: 0.999,
      entropy_source: 'idq-quantis-pcie-240m',
    },
    null,
    2,
  ),
}

const STATUS_ENDPOINT: EndpointDoc = {
  method: 'GET',
  path: '/api/v1/qrng/status',
  title: 'QRNG Health Check',
  description:
    'Returns the live operational status of the QRNG hardware and entropy pool. No authentication ' +
    'required — safe to poll from load balancers, readiness probes, and public dashboards. ' +
    'Use this endpoint to gate cloud-seeding calls on hardware availability.',
  auth: 'none',
  rateLimit: '300 req/min',
  responseFields: STATUS_RESPONSE_FIELDS,
}

// ── Deep Dive content ─────────────────────────────────────────────────────────

const DEEP_DIVE_SUMMARY = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--qg-text-primary)',
    }}>
      Cloud Seeding Architecture
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      The cloud seeding pipeline routes raw QRNG photon counts through a NIST SP 800-90B-certified
      health-check layer, then uses HKDF-SHA-256 to derive per-container cryptographic material
      from a single high-entropy master seed. Each container receives a unique seed, encryption key,
      HMAC key, and nonce — eliminating shared-secret risk across your fleet.
    </p>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      color: 'var(--qg-cyan)',
    }}>
      QRNG Hardware
      <span style={{ color: 'var(--qg-text-muted)' }}>&#8594;</span>
      Entropy Pool
      <span style={{ color: 'var(--qg-text-muted)' }}>&#8594;</span>
      HKDF Derivation
      <span style={{ color: 'var(--qg-text-muted)' }}>&#8594;</span>
      Per-Container Seeds
      <span style={{ color: 'var(--qg-text-muted)' }}>&#8594;</span>
      Crypto Material
    </div>
  </div>
)

const DEEP_DIVE_DETAIL = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

    {/* Container entropy bootstrapping */}
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
        margin: 0,
      }}>
        Container Entropy Bootstrapping
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        Containers that start before the kernel entropy pool is seeded (common in cloud VM cold
        starts) are vulnerable to weak-key generation. QGuard seeds each container&apos;s
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)', margin: '0 4px' }}>
          /dev/urandom
        </code>
        via an init container or a DaemonSet that writes QRNG material at pod creation time,
        guaranteeing cryptographically strong entropy from the first byte.
      </p>
    </section>

    {/* Kubernetes Secret integration */}
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
        margin: 0,
      }}>
        Kubernetes Secret Integration
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        The example below shows how to fetch a seed batch and store the material as opaque
        Kubernetes Secrets, which pods then consume via environment variable projection.
      </p>
      <CodeBlock
        language="bash"
        title="Seed a namespace with QRNG material"
        code={`# 1. Fetch seeds for 4 containers
RESPONSE=$(curl -s -X POST "http://localhost:4000/api/v1/qrng/cloud/seeds" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "cloud-seeds",
    "container_count": 4,
    "seed_bits": 256,
    "target": "kubernetes",
    "prefix": "prod-api",
    "format": "base64"
  }')

# 2. Extract individual seeds with jq and create K8s Secrets
for i in 0 1 2 3; do
  SEED=$(echo "$RESPONSE" | jq -r ".seeds[$i].seed")
  ENC_KEY=$(echo "$RESPONSE" | jq -r ".seeds[$i].encryption_key")
  kubectl create secret generic "prod-api-seed-$i" \\
    --from-literal=SEED="$SEED" \\
    --from-literal=ENCRYPTION_KEY="$ENC_KEY" \\
    --namespace=production
done`}
      />
    </section>

    {/* Cloud provider KMS integration */}
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
        margin: 0,
      }}>
        Cloud Provider KMS Integration
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        For AWS, GCP, and Azure deployments, QRNG seeds can be imported into the respective KMS as
        custom key material, replacing the provider-generated random with certified quantum entropy.
        This satisfies compliance requirements (FIPS 140-3, BSI TR-02102) that mandate hardware
        random sources.
      </p>
      <CodeBlock
        language="bash"
        title="Import QRNG seed into AWS KMS as custom key material"
        code={`# 1. Create a KMS key with EXTERNAL origin
KEY_ID=$(aws kms create-key \\
  --origin EXTERNAL \\
  --description "QRNG-seeded key" \\
  --query "KeyMetadata.KeyId" --output text)

# 2. Get the import parameters (wrapping key + import token)
aws kms get-parameters-for-import \\
  --key-id "$KEY_ID" \\
  --wrapping-algorithm RSAES_OAEP_SHA_256 \\
  --wrapping-key-spec RSA_4096 \\
  --output json > import_params.json

# 3. Wrap the QRNG seed with the public wrapping key
#    (seed retrieved from /api/v1/qrng/cloud/seeds with format=hex)
openssl rsautl -encrypt -oaep \\
  -inkey wrapping_key.pem -pubin \\
  -in qrng_seed.bin -out wrapped_seed.bin

# 4. Import the wrapped material
aws kms import-key-material \\
  --key-id "$KEY_ID" \\
  --encrypted-key-material fileb://wrapped_seed.bin \\
  --import-token fileb://import_token.bin \\
  --expiration-model KEY_MATERIAL_DOES_NOT_EXPIRE`}
      />
    </section>

    {/* Seed rotation strategies */}
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
        margin: 0,
      }}>
        Seed Rotation Strategies
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        Rotate seeds on a schedule aligned with your threat model. Recommended cadences:
      </p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
      }}>
        {[
          { tier: 'High Security', cadence: 'Every 1 hour', note: 'Ephemeral workloads, financial services' },
          { tier: 'Standard', cadence: 'Every 24 hours', note: 'General production services' },
          { tier: 'Low Churn', cadence: 'Every 7 days', note: 'Stable long-running services' },
        ].map(({ tier, cadence, note }) => (
          <div key={tier} style={{
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid var(--qg-border)',
            background: 'rgba(0,212,255,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--qg-cyan)' }}>{tier}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-text-primary)' }}>{cadence}</span>
            <span style={{ fontSize: 11, color: 'var(--qg-text-muted)' }}>{note}</span>
          </div>
        ))}
      </div>
    </section>

    {/* Multi-cloud deployment patterns */}
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--qg-text-primary)',
        margin: 0,
      }}>
        Multi-Cloud Deployment Patterns
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        In multi-cloud architectures a single QGuard QRNG gateway (deployed on-prem or in a
        trusted VPC) acts as the sole entropy authority. Each cloud region fetches seeds via
        mutual-TLS, ensuring that no cloud provider&apos;s HSM random is used for cross-cloud
        session keys. The
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)', margin: '0 4px' }}>
          target
        </code>
        field signals the gateway to format seed material in the provider-native encoding
        (aws → hex, gcp → base64, azure → base64), reducing integration friction.
      </p>
      <CodeBlock
        language="typescript"
        title="Multi-cloud seed distribution (Node.js)"
        code={`import { QGuardClient } from '@qguard/sdk'

const client = new QGuardClient({ token: process.env.QGUARD_JWT })

const CLOUDS = ['aws', 'gcp', 'azure'] as const

async function distributeSeeds(containerCount: number) {
  // Fetch seed batches for all clouds in parallel
  const batches = await Promise.all(
    CLOUDS.map(target =>
      client.cloud.generateSeeds({
        action: 'cloud-seeds',
        container_count: containerCount,
        seed_bits: 256,
        target,
        format: target === 'aws' ? 'hex' : 'base64',
      })
    )
  )

  // Each batch can now be pushed to the respective cloud KMS
  CLOUDS.forEach((cloud, i) => {
    console.log(\`[\${cloud}] quality_score=\${batches[i].quality_score}\`)
  })
}

distributeSeeds(4).catch(console.error)`}
      />
    </section>

  </div>
)

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CloudSeedingPage() {
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
          API Reference
        </span>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 3vw, 32px)',
          fontWeight: 800,
          marginTop: 8,
          letterSpacing: '-0.02em',
          color: 'var(--qg-text-primary)',
        }}>
          Cloud Infrastructure Seeding
        </h1>
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--qg-text-secondary)',
          marginTop: 12,
          maxWidth: 640,
        }}>
          Provision quantum-random cryptographic seeds for containers, Kubernetes pods, and
          cloud-provider KMS instances. Each seed batch is derived from certified QRNG hardware
          and scoped to a single container to eliminate cross-container key reuse.
        </p>
      </div>

      {/* Quick start */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          margin: 0,
          paddingBottom: 12,
          borderBottom: '1px solid var(--qg-border)',
        }}>
          Quick Start
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
          Check QRNG hardware availability, then request a seed batch for your container fleet.
          No configuration beyond a valid JWT is required.
        </p>
        <CodeBlock
          language="bash"
          title="1. Verify QRNG is online (no auth required)"
          code={`curl http://localhost:4000/api/v1/qrng/status`}
        />
        <CodeBlock
          language="bash"
          title="2. Generate seeds for 4 Kubernetes containers"
          code={`curl -X POST "http://localhost:4000/api/v1/qrng/generate/stream" \\
  -H "Authorization: Bearer $JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{
    "action": "cloud-seeds",
    "container_count": 4,
    "seed_bits": 256,
    "target": "kubernetes",
    "prefix": "prod-api",
    "format": "base64"
  }'`}
        />
      </section>

      {/* Endpoint cards */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          margin: 0,
          paddingBottom: 12,
          borderBottom: '1px solid var(--qg-border)',
        }}>
          Endpoints
        </h2>

        <EndpointCard endpoint={STREAM_ENDPOINT} />
        <EndpointCard endpoint={DIRECT_ENDPOINT} />
        <EndpointCard endpoint={STATUS_ENDPOINT} />
      </section>

      {/* Deep Dive */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          margin: 0,
          paddingBottom: 12,
          borderBottom: '1px solid var(--qg-border)',
        }}>
          Architecture
        </h2>
        <DeepDive
          summary={DEEP_DIVE_SUMMARY}
          detail={DEEP_DIVE_DETAIL}
          label="Show Technical Architecture Detail"
        />
      </section>

    </div>
  )
}
