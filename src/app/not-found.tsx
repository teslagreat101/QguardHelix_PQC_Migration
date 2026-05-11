import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0f',
      color: '#e0e0e0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ textAlign: 'center', padding: 40, maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 20, marginBottom: 8, color: '#00d4ff' }}>
          404 — Page Not Found
        </h2>
        <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            fontSize: 13,
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            borderRadius: 8,
            color: '#00d4ff',
            textDecoration: 'none',
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
