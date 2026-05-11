export default function DashboardLoading() {
  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header skeleton */}
      <div style={{ marginBottom: 32 }}>
        <div 
          style={{ 
            height: 32, 
            width: 280, 
            background: 'var(--qg-surface)', 
            borderRadius: 6,
            marginBottom: 12,
            animation: 'pulse 1.5s ease-in-out infinite'
          }} 
        />
        <div 
          style={{ 
            height: 16, 
            width: 520, 
            background: 'var(--qg-surface)', 
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: '0.1s'
          }} 
        />
      </div>

      {/* Status banner skeleton */}
      <div 
        style={{ 
          height: 60, 
          background: 'var(--qg-surface)', 
          borderRadius: 12,
          border: '1px solid var(--qg-border)',
          marginBottom: 24,
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: '0.2s'
        }} 
      />

      {/* Tab nav skeleton */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--qg-border)', paddingBottom: 2 }}>
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i}
            style={{ 
              height: 40, 
              width: 110, 
              background: 'var(--qg-surface)', 
              borderRadius: '6px 6px 0 0',
              animation: 'pulse 1.5s ease-in-out infinite',
              animationDelay: `${0.1 * i}s`
            }} 
          />
        ))}
      </div>

      {/* Content skeleton - comm has 3 sub-tabs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3].map((i) => (
            <div 
              key={i}
              style={{ 
                height: 36, 
                width: 140, 
                background: 'var(--qg-surface)', 
                borderRadius: 6,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: `${0.15 * i}s`
              }} 
            />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24 }}>
        <div 
          style={{ 
            height: 380, 
            background: 'var(--qg-surface)', 
            borderRadius: 12,
            border: '1px solid var(--qg-border)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: '0.3s'
          }} 
        />
        <div 
          style={{ 
            height: 380, 
            background: 'var(--qg-surface)', 
            borderRadius: 12,
            border: '1px solid var(--qg-border)',
            animation: 'pulse 1.5s ease-in-out infinite',
            animationDelay: '0.4s'
          }} 
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
