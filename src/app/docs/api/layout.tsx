import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { DocsApiSidebar } from '@/components/docs/DocsApiSidebar'

export default function DocsApiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--qg-black)', minHeight: '100vh', color: 'var(--qg-text-primary)' }}>
      {/* Top bar */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(3,3,8,0.92)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--qg-border)',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/docs/api" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <BookOpen size={18} style={{ color: 'var(--qg-cyan)' }} />
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 800,
              background: 'linear-gradient(135deg, var(--qg-cyan), var(--qg-violet))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              QGuard API Docs
            </span>
          </Link>
          <span style={{ width: 1, height: 16, background: 'var(--qg-border)' }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--qg-text-muted)',
            letterSpacing: '0.08em',
          }}>
            v1.0 · REST + SSE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link
            href="/docs"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--qg-text-secondary)',
              textDecoration: 'none',
            }}
          >
            User Docs
          </Link>
          <Link href="/login" style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            fontWeight: 700,
            padding: '6px 16px',
            borderRadius: 8,
            textDecoration: 'none',
            background: 'linear-gradient(135deg, var(--qg-cyan), var(--qg-violet))',
            color: 'var(--qg-black)',
            letterSpacing: '0.06em',
          }}>
            Get Started Free
          </Link>
        </div>
      </header>

      <div style={{ display: 'flex', paddingTop: 60, minHeight: '100vh' }}>
        <DocsApiSidebar />
        <main style={{
          flex: 1,
          marginLeft: 260,
          padding: '48px 48px',
          maxWidth: 'calc(100% - 260px)',
          minWidth: 0,
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
