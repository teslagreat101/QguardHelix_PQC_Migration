'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: 40,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{
          fontSize: 18,
          marginBottom: 8,
          color: 'var(--qg-red, #ff2d55)',
          fontFamily: 'var(--font-display, system-ui)',
        }}>
          Something went wrong
        </h2>
        <p style={{
          fontSize: 13,
          color: 'var(--qg-text-muted, #888)',
          marginBottom: 24,
          fontFamily: 'var(--font-mono, monospace)',
        }}>
          {error.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          className="q-btn q-btn-primary"
          style={{ padding: '10px 24px', fontSize: 13 }}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}
