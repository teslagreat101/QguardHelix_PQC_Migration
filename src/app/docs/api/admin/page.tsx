'use client'

import { EndpointCard, type EndpointDoc } from '@/components/docs/EndpointCard'
import { DeepDive } from '@/components/docs/DeepDive'

// ─── Endpoint definitions ────────────────────────────────────────────────────

const ENDPOINTS: EndpointDoc[] = [
  // 1. Platform Statistics
  {
    method: 'GET',
    path: '/api/v1/admin/stats',
    title: 'Platform Statistics',
    description: 'Retrieve aggregated platform-wide statistics. Returns real-time counters for users, scans, key generation activity, OTP usage, storage consumption, and average quantum security scores.',
    auth: 'jwt',
    rateLimit: '100 req/min',
    responseFields: [
      { field: 'total_users', type: 'number', required: true, description: 'Total number of registered user accounts on the platform' },
      { field: 'active_users', type: 'number', required: true, description: 'Users with at least one session in the last 30 days' },
      { field: 'total_scans', type: 'number', required: true, description: 'Cumulative number of security scans performed across all users' },
      { field: 'total_keys_generated', type: 'number', required: true, description: 'Total ML-KEM key pairs generated since platform launch' },
      { field: 'total_otps', type: 'number', required: true, description: 'Total OTP tokens generated across all users and all time' },
      { field: 'storage_used_gb', type: 'number', required: true, description: 'Total encrypted vault storage consumed across all accounts in gigabytes', example: '42.7' },
      { field: 'avg_q_score', type: 'number', required: true, description: 'Platform-wide average quantum security score (0–100)', example: '87.3' },
    ],
    responseExample: '{"total_users":12540,"active_users":3820,"total_scans":98234,"total_keys_generated":24011,"total_otps":310500,"storage_used_gb":42.7,"avg_q_score":87.3}',
  },

  // 2. List Users
  {
    method: 'GET',
    path: '/api/v1/admin/users',
    title: 'List Users',
    description: 'Retrieve a paginated, filterable list of all registered users. Supports full-text search by email, filtering by subscription plan, and filtering by account status.',
    auth: 'jwt',
    rateLimit: '50 req/min',
    requestFields: [
      { field: 'limit', type: 'number', required: false, description: 'Maximum number of users to return (1–100, default 20)', example: '20' },
      { field: 'offset', type: 'number', required: false, description: 'Pagination offset for cursor-based retrieval', example: '0' },
      { field: 'search', type: 'string', required: false, description: 'Full-text search filter against user email addresses', example: 'alice@example.com' },
      { field: 'plan', type: 'free | pro | elite', required: false, description: 'Filter results to users on a specific subscription plan', example: 'pro' },
      { field: 'status', type: 'active | suspended', required: false, description: 'Filter results by account status', example: 'active' },
    ],
    responseFields: [
      { field: 'users', type: 'User[]', required: true, description: 'Array of user summary objects matching the query filters' },
      { field: 'users[].id', type: 'string (UUID)', required: true, description: 'Unique user identifier' },
      { field: 'users[].email', type: 'string', required: true, description: 'User email address' },
      { field: 'users[].plan', type: 'free | pro | elite', required: true, description: 'Current subscription plan', example: 'pro' },
      { field: 'users[].created_at', type: 'string (ISO 8601)', required: true, description: 'Account creation timestamp' },
      { field: 'users[].last_login', type: 'string (ISO 8601)', required: true, description: 'Timestamp of the most recent authenticated session' },
      { field: 'users[].q_score', type: 'number', required: true, description: 'User quantum security score (0–100)', example: '91.2' },
      { field: 'total', type: 'number', required: true, description: 'Total count of users matching the applied filters (for pagination)' },
    ],
    responseExample: '{"users":[{"id":"usr_abc123","email":"alice@example.com","plan":"pro","created_at":"2026-01-15T08:00:00Z","last_login":"2026-04-06T14:22:00Z","q_score":91.2}],"total":3820}',
  },

  // 3. Get User Details
  {
    method: 'GET',
    path: '/api/v1/admin/users/[id]',
    title: 'Get User Details',
    description: 'Retrieve a comprehensive profile for a specific user by UUID, including full account metadata, usage statistics, current subscription state, and a summarised scan history.',
    auth: 'jwt',
    rateLimit: '100 req/min',
    requestFields: [
      { field: 'id', type: 'string (UUID)', required: true, description: 'User UUID — provided as a path parameter in the URL', example: 'usr_abc123' },
    ],
    responseFields: [
      { field: 'profile', type: 'object', required: true, description: 'Full user profile including id, email, display_name, avatar_url, created_at, and last_login' },
      { field: 'usage_stats', type: 'object', required: true, description: 'Aggregated usage counters: scans_this_month, keys_generated, otps_generated, vault_items, storage_used_gb' },
      { field: 'subscription', type: 'object', required: true, description: 'Current subscription details: plan, status, billing_cycle, next_renewal_at, payment_method_last4' },
      { field: 'scan_history_summary', type: 'object', required: true, description: 'Summarised scan activity: total_scans, last_scan_at, critical_findings, avg_q_score' },
    ],
    responseExample: '{"profile":{"id":"usr_abc123","email":"alice@example.com","display_name":"Alice","created_at":"2026-01-15T08:00:00Z","last_login":"2026-04-06T14:22:00Z"},"usage_stats":{"scans_this_month":14,"keys_generated":3,"otps_generated":210,"vault_items":27,"storage_used_gb":1.4},"subscription":{"plan":"pro","status":"active","next_renewal_at":"2026-05-15T00:00:00Z"},"scan_history_summary":{"total_scans":98,"last_scan_at":"2026-04-06T12:00:00Z","critical_findings":2,"avg_q_score":91.2}}',
  },

  // 4. Manage Subscription
  {
    method: 'PATCH',
    path: '/api/v1/admin/users/[id]/subscription',
    title: 'Manage Subscription',
    description: 'Override the subscription plan for a specific user. Accepts a target plan and a mandatory reason string for audit trail compliance. Changes take effect immediately and are logged against the acting admin.',
    auth: 'jwt',
    rateLimit: '20 req/min',
    requestFields: [
      { field: 'plan', type: 'free | pro | elite', required: true, description: 'Target subscription plan to assign to the user', example: 'pro' },
      { field: 'reason', type: 'string', required: true, description: 'Human-readable reason for the change — recorded in the audit log', example: 'Upgrade request approved by support ticket #4821' },
    ],
    requestBody: { plan: 'pro', reason: 'Upgrade request' },
    responseFields: [
      { field: 'success', type: 'boolean', required: true, description: 'Indicates whether the subscription change was applied successfully' },
      { field: 'previous_plan', type: 'free | pro | elite', required: true, description: 'The plan held by the user before this change', example: 'free' },
      { field: 'new_plan', type: 'free | pro | elite', required: true, description: 'The plan now assigned to the user', example: 'pro' },
      { field: 'effective_date', type: 'string (ISO 8601)', required: true, description: 'Timestamp at which the new plan became active' },
    ],
    responseExample: '{"success":true,"previous_plan":"free","new_plan":"pro","effective_date":"2026-04-07T10:00:00Z"}',
  },

  // 5. Admin Events Stream
  {
    method: 'GET',
    path: '/api/v1/admin/stream',
    title: 'Admin Events Stream',
    description: 'Subscribe to a real-time Server-Sent Events stream of platform-wide administrative events. Each admin session may hold up to 5 concurrent SSE connections. Events are emitted for all significant platform activity.',
    auth: 'jwt',
    rateLimit: '5 concurrent',
    isSSE: true,
    responseFields: [
      { field: 'user_registered', type: 'event', required: false, description: 'Emitted when a new user account is created — includes id, email, and plan' },
      { field: 'scan_completed', type: 'event', required: false, description: 'Emitted when any user completes a security scan — includes user_id, scan_id, and q_score' },
      { field: 'subscription_changed', type: 'event', required: false, description: 'Emitted when any subscription plan changes — includes user_id, previous_plan, new_plan, and changed_by' },
      { field: 'alert_triggered', type: 'event', required: false, description: 'Emitted when a security alert threshold is breached — includes alert_type, severity, and affected_user_id' },
    ],
    responseExample: 'event: user_registered\ndata: {"id":"usr_xyz","email":"bob@example.com","plan":"free","registered_at":"2026-04-07T10:05:00Z"}\n\nevent: scan_completed\ndata: {"user_id":"usr_abc123","scan_id":"scan_789","q_score":88.1,"completed_at":"2026-04-07T10:06:00Z"}\n\nevent: subscription_changed\ndata: {"user_id":"usr_abc123","previous_plan":"free","new_plan":"pro","changed_by":"admin_001"}\n\nevent: alert_triggered\ndata: {"alert_type":"brute_force_detected","severity":"critical","affected_user_id":"usr_def456"}',
  },
]

// ─── DeepDive content ─────────────────────────────────────────────────────────

const deepDiveSummary = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      fontWeight: 700,
      color: 'var(--qg-text-primary)',
    }}>
      Admin Authorization Model
    </div>
    <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
      All admin endpoints are protected by a Role-Based Access Control (RBAC) layer enforced at the
      JWT verification stage. Only tokens whose claims include the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>role: admin</code> assertion
      are admitted. Every admin action is synchronously written to a tamper-evident audit log before
      the response is returned, ensuring full accountability.
    </p>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[
        { label: 'Access Model', value: 'RBAC' },
        { label: 'Token Claim', value: 'role: admin' },
        { label: 'Audit Log', value: 'Append-Only' },
        { label: 'Scope', value: 'Platform-Wide' },
      ].map(({ label, value }) => (
        <div key={label} style={{
          padding: '8px 14px',
          borderRadius: 8,
          border: '1px solid var(--qg-border)',
          background: 'rgba(0,212,255,0.04)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--qg-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)', fontWeight: 600 }}>
            {value}
          </div>
        </div>
      ))}
    </div>
  </div>
)

const deepDiveDetail = (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

    {/* RBAC enforcement */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        1. RBAC Enforcement Pipeline
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        Each request to an admin route passes through three sequential verification gates before any
        business logic executes:
      </p>
      <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          'JWT signature verification — the token is verified against the Supabase RS256 public key. Expired or tampered tokens are rejected with a 401 before reaching gate 2.',
          'Role claim assertion — the decoded payload must contain role: "admin". Tokens with any other role or no role claim are rejected with 403 Forbidden.',
          'Session binding check — the token\'s sub (user ID) is cross-referenced with the admin_users table to confirm the account has not been demoted or suspended since the token was issued.',
          'If all three gates pass, the request is admitted and the acting admin\'s ID is injected into the request context for audit logging.',
        ].map((step, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            {step}
          </li>
        ))}
      </ol>
    </section>

    {/* Admin role assignment */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        2. Admin Role Assignment and Least Privilege
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        Admin roles are assigned exclusively via a server-side database operation — they cannot be
        self-claimed or granted through the public API. The principle of least privilege is applied
        at the sub-role level:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { term: 'super_admin', def: 'Full platform access including infrastructure configuration, audit log export, and admin role management. Restricted to internal engineering accounts.' },
          { term: 'admin', def: 'Full access to the Admin API endpoints documented here — user management, stats, subscriptions, and event streams. Cannot modify other admin accounts.' },
          { term: 'support', def: 'Read-only access to user details and subscription state. Cannot perform write operations or access the events stream.' },
        ].map(({ term, def }) => (
          <div key={term} style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid var(--qg-border)',
            background: 'rgba(255,255,255,0.015)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--qg-amber)', marginBottom: 4 }}>
              {term}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--qg-text-secondary)' }}>
              {def}
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Audit logging */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        3. Audit Logging for Admin Actions
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        Every mutating admin action (PATCH, POST, DELETE) generates an immutable audit record
        written synchronously within the same database transaction as the change itself. If the
        audit write fails, the entire operation is rolled back — ensuring there is never a mutation
        without a corresponding log entry.
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: '0 0 12px' }}>
        Each audit record contains:
      </p>
      <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          'admin_id — UUID of the authenticated admin who performed the action.',
          'action — Enumerated action type (e.g., subscription_override, user_suspended).',
          'target_user_id — UUID of the affected user account.',
          'payload_snapshot — JSON snapshot of the request body at the time of the action (sensitive fields redacted).',
          'ip_address — Origin IP of the admin request.',
          'timestamp — ISO 8601 UTC timestamp recorded at the database level, not the application layer.',
          'reason — Free-text justification field, mandatory for all subscription overrides.',
        ].map((item, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--qg-text-secondary)' }}>
            {item}
          </li>
        ))}
      </ol>
    </section>

    {/* Audit log integrity */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        4. Audit Log Integrity and Retention
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { term: 'Append-Only Table', def: 'The audit log table has no UPDATE or DELETE grants at the database user level. Records can only be inserted — existing entries are immutable.' },
          { term: 'Hash Chaining', def: 'Each audit row includes a sha3_256 hash of the previous row\'s content, forming a tamper-evident chain. Any retrospective modification breaks the chain and is detectable on next verification.' },
          { term: 'Retention Policy', def: 'Audit records are retained for a minimum of 2 years. Deletion requires a super_admin action with regulatory justification and generates its own audit entry.' },
          { term: 'Export', def: 'Audit logs can be exported as signed NDJSON via a super_admin-only endpoint. Each export event is itself logged. Exports are signed with the platform\'s Ed25519 private key for external verification.' },
        ].map(({ term, def }) => (
          <div key={term} style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid var(--qg-border)',
            background: 'rgba(255,255,255,0.015)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--qg-violet)', marginBottom: 4 }}>
              {term}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--qg-text-secondary)' }}>
              {def}
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Rate limiting for admin routes */}
    <section>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--qg-text-primary)', marginBottom: 10 }}>
        5. Rate Limiting Strategy for Admin Routes
      </h3>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--qg-text-secondary)', margin: 0 }}>
        Admin endpoints use a dedicated rate-limit pool separate from the standard user tier.
        Limits are enforced per <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>admin_id</code> (not per IP), preventing
        shared-infrastructure starvation between concurrent admin sessions. Mutating endpoints
        (PATCH) carry significantly tighter limits than read endpoints to reduce the blast radius
        of a compromised admin token. The SSE stream enforces a hard cap of 5 concurrent connections
        per admin account — new connections beyond this limit receive 429 with a{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--qg-cyan)' }}>Retry-After</code> header.
      </p>
    </section>

  </div>
)

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminApiPage() {
  return (
    <div style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 40 }}>

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
          Admin API
        </h1>
        <p style={{
          fontSize: 15,
          lineHeight: 1.8,
          color: 'var(--qg-text-secondary)',
          marginTop: 12,
          maxWidth: 640,
        }}>
          Platform administration endpoints for user management, subscription control, and
          real-time event monitoring. Access is restricted to authenticated accounts holding
          the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--qg-cyan)' }}>admin</code> role.
        </p>
      </div>

      {/* Warning callout */}
      <div style={{
        borderRadius: 10,
        border: '1px solid rgba(245,158,11,0.4)',
        background: 'rgba(245,158,11,0.06)',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(245,158,11,0.9)',
        }}>
          Admin Access Required
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(245,158,11,0.75)', margin: 0 }}>
          All endpoints on this page require a valid Supabase JWT containing{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(245,158,11,0.9)' }}>role: &quot;admin&quot;</code>{' '}
          in its claims. Requests authenticated with standard user tokens will receive a{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(245,158,11,0.9)' }}>403 Forbidden</code>{' '}
          response. Admin role assignment is managed exclusively through the internal platform
          console and cannot be self-granted.
        </p>
      </div>

      {/* Endpoint cards */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          paddingTop: 24,
          borderTop: '1px solid var(--qg-border)',
        }}>
          Endpoints
        </h2>
        {ENDPOINTS.map((ep) => (
          <EndpointCard key={`${ep.method}:${ep.path}`} endpoint={ep} />
        ))}
      </section>

      {/* DeepDive */}
      <section style={{ paddingTop: 24, borderTop: '1px solid var(--qg-border)' }}>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--qg-text-primary)',
          marginBottom: 16,
        }}>
          Architecture Deep Dive
        </h2>
        <DeepDive
          summary={deepDiveSummary}
          detail={deepDiveDetail}
          label="Show Authorization and Audit Architecture"
        />
      </section>

    </div>
  )
}
