'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
        color: '#e0e0e0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ textAlign: 'center', padding: 40, maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, marginBottom: 8, color: '#ff2d55' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '10px 24px',
              fontSize: 13,
              background: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              borderRadius: 8,
              color: '#00d4ff',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
