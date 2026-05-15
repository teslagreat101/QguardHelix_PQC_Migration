'use client'

import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Atom,
  Box,
  CheckCircle2,
  Fingerprint,
  LockKeyhole,
  Orbit,
  ShieldCheck,
  XCircle,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import VaultDoor, { VaultState } from './VaultDoor'
import VaultPassphrase from './VaultPassphrase'
import VaultUploadPanel from './VaultUploadPanel'
import type { ZKMasterKeys } from '@/lib/vault/client-crypto'
import { ensureVaultProfile, fetchUserKeys } from '@/lib/vault/vault-service-enhanced'

export type VaultCardTelemetry = 'connected' | 'standby' | 'offline' | 'updating' | 'error'

export interface VaultStatusCardState {
  healthy: boolean
  headline?: string
  state: string
  description: string
  lastVerifiedAt: string | null
  telemetry: VaultCardTelemetry
}

export interface VaultHeroMetrics {
  fileCount: number
  encryptedFileCount: number
  activeKeyCount: number
  activeShareCount: number
  storageLabel: string
  storagePercent: number
  integrityScore: number
  quantumResistance: number
  zeroKnowledgeScore: number
  systemHealth: 'optimal' | 'degraded' | 'offline'
  telemetryConnected: boolean
  recentActivity: string[]
  statusCards: {
    vault: VaultStatusCardState
    encryption: VaultStatusCardState
    integrity: VaultStatusCardState
    architecture: VaultStatusCardState
  }
}

interface QuantumVaultProps {
  sessionToken: string | undefined
  metrics: VaultHeroMetrics
  onFileUploaded: () => void
  onKeysUnlocked?: (keys: ZKMasterKeys) => void
}

const gold = '#d4af37'
const brightGold = '#fff3c1'

function metricTone(value: number): string {
  if (value >= 95) return brightGold
  if (value >= 75) return '#f5c451'
  return '#f59e0b'
}

function SparkLine({ active = true }: { active?: boolean }) {
  return (
    <svg width="88" height="24" viewBox="0 0 112 30" aria-hidden="true" style={{ overflow: 'visible', flex: '0 0 auto' }}>
      <polyline
        points="0,22 12,16 23,21 35,10 47,24 59,9 72,18 84,12 97,17 112,6"
        fill="none"
        stroke={active ? gold : 'rgba(255,255,255,0.2)'}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: active ? 'drop-shadow(0 0 6px rgba(212,175,55,0.65))' : 'none' }}
      />
    </svg>
  )
}

function formatStatusTimestamp(value: string | null): string {
  if (!value) return 'Not yet verified'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not yet verified'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function telemetryLabel(telemetry: VaultCardTelemetry): string {
  switch (telemetry) {
    case 'connected': return 'Realtime connected'
    case 'updating': return 'Updating now'
    case 'error': return 'Telemetry error'
    case 'offline': return 'Telemetry offline'
    default: return 'Realtime standby'
  }
}

function CyberCard({
  icon: Icon,
  label,
  status,
}: {
  icon: LucideIcon
  label: string
  status: VaultStatusCardState
}) {
  const StatusIcon = status.healthy ? CheckCircle2 : XCircle
  const statusColor = status.healthy ? '#33f39b' : '#ff5470'
  const statusShadow = status.healthy ? 'rgba(51,243,155,0.42)' : 'rgba(255,84,112,0.38)'
  const headline = status.headline || status.state

  return (
    <motion.div
      className="qv-glass-card"
      whileHover={{
        y: -5,
        scale: 1.012,
        boxShadow: `0 18px 46px rgba(0,0,0,0.5), 0 0 34px rgba(212,175,55,0.22), inset 0 0 28px rgba(255,214,104,0.1), 0 0 22px ${statusShadow}`,
      }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      style={{
        minHeight: 118,
        padding: '13px 16px 12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 13,
        position: 'relative',
        overflow: 'hidden',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: status.healthy ? 'rgba(212,175,55,0.56)' : 'rgba(255,84,112,0.42)',
        borderTopColor: 'rgba(255,231,151,0.72)',
        background:
          'linear-gradient(135deg, rgba(255,214,104,0.13), rgba(17,14,6,0.56) 38%, rgba(0,0,0,0.64)), rgba(8,7,2,0.38)',
        clipPath: 'polygon(4% 0, 96% 0, 100% 16%, 100% 84%, 96% 100%, 4% 100%, 0 84%, 0 16%)',
        backdropFilter: 'blur(18px) saturate(145%)',
        WebkitBackdropFilter: 'blur(18px) saturate(145%)',
        boxShadow: '0 14px 38px rgba(0,0,0,0.42), inset 0 0 28px rgba(255,214,104,0.08), inset 0 1px 0 rgba(255,243,193,0.08), 0 0 18px rgba(212,175,55,0.1)',
      }}
    >
      <span className="qv-card-orb" style={{ background: statusColor, boxShadow: `0 0 22px ${statusShadow}` }} />
      <div
        style={{
          width: 40,
          height: 40,
          display: 'grid',
          placeItems: 'center',
          color: gold,
          filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.65))',
          flex: '0 0 auto',
          marginTop: 3,
        }}
      >
        <Icon size={28} strokeWidth={1.55} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginBottom: 5 }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: 'rgba(255,214,104,0.8)', textTransform: 'uppercase' }}>
            {label}
          </div>
          <div
            className="qv-status-badge"
            style={{
              color: statusColor,
              borderColor: status.healthy ? 'rgba(51,243,155,0.28)' : 'rgba(255,84,112,0.32)',
              background: status.healthy ? 'rgba(51,243,155,0.08)' : 'rgba(255,84,112,0.09)',
            }}
            aria-label={status.healthy ? `${label} active` : `${label} requires attention`}
          >
            <StatusIcon size={13} strokeWidth={2.2} />
          </div>
        </div>
        <div style={{ fontSize: 17, lineHeight: 1.08, color: '#fff7c9', fontWeight: 800, letterSpacing: '0.02em', textShadow: '0 0 18px rgba(212,175,55,0.5)' }}>
          {headline}
        </div>
        {headline !== status.state && (
          <div className="qv-card-state" style={{ color: statusColor }}>
            {status.state}
          </div>
        )}
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.56)', marginTop: 5, lineHeight: 1.35 }}>
          {status.description}
        </div>
        <div className="qv-card-meta">
          <span>Last verified: {formatStatusTimestamp(status.lastVerifiedAt)}</span>
          <span>{telemetryLabel(status.telemetry)}</span>
        </div>
      </div>
    </motion.div>
  )
}

function OverviewPanel({ metrics, unlocked }: { metrics: VaultHeroMetrics; unlocked: boolean }) {
  const encryptionStatus = metrics.statusCards.encryption
  const architectureStatus = metrics.statusCards.architecture
  const integrityStatus = metrics.statusCards.integrity
  const vaultStatus = metrics.statusCards.vault
  const overview = [
    {
      icon: ShieldCheck,
      status: encryptionStatus,
      title: 'ML-KEM-768 Shield',
      copy: metrics.fileCount === 0
        ? `${encryptionStatus.state} - no files sealed yet`
        : `${encryptionStatus.state} - ${metrics.encryptedFileCount}/${metrics.fileCount} files sealed with per-file keys`,
    },
    {
      icon: LockKeyhole,
      status: architectureStatus,
      title: 'ZERO-KNOWLEDGE Protocol',
      copy: unlocked
        ? `${architectureStatus.state} - local keys unlocked in this tab only`
        : architectureStatus.description,
    },
    {
      icon: Orbit,
      status: integrityStatus,
      title: 'ML-DSA-65 Integrity',
      copy: `${integrityStatus.state} - ${integrityStatus.description}`,
    },
    {
      icon: Box,
      status: vaultStatus,
      title: 'Future Proof Security',
      copy: `${vaultStatus.state} - ${metrics.recentActivity[0] || vaultStatus.description}`,
    },
  ]

  return (
    <div className="qv-side-panel">
      <div className="qv-panel-title">Vault Overview</div>
      {overview.map(({ icon: Icon, status, title, copy }) => {
        const StatusIcon = status.healthy ? CheckCircle2 : XCircle
        return (
          <div key={title} className="qv-overview-row">
            <Icon size={26} strokeWidth={1.45} />
            <div>
              <div className="qv-row-title">{title}</div>
              <div className="qv-row-copy">{copy}</div>
              <div className="qv-row-telemetry">Last verified: {formatStatusTimestamp(status.lastVerifiedAt)} / {telemetryLabel(status.telemetry)}</div>
            </div>
            <span className="qv-row-status" style={{ color: status.healthy ? '#33f39b' : '#ff5470' }}>
              <StatusIcon size={15} strokeWidth={2.2} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SecurityMetricsPanel({ metrics }: { metrics: VaultHeroMetrics }) {
  const vaultNumeric = metrics.statusCards.vault.healthy ? 100 : metrics.telemetryConnected ? 70 : 0
  const systemNumeric = Math.round((vaultNumeric + metrics.quantumResistance + metrics.integrityScore + metrics.zeroKnowledgeScore) / 4)
  const rows = [
    {
      icon: ShieldCheck,
      status: metrics.statusCards.integrity,
      label: 'Vault Integrity',
      value: `${metrics.integrityScore}%`,
      numeric: metrics.integrityScore,
      copy: metrics.statusCards.integrity.state,
    },
    {
      icon: LockKeyhole,
      status: metrics.statusCards.encryption,
      label: 'Encryption Strength',
      value: metrics.statusCards.encryption.healthy ? '768-bit' : `${metrics.quantumResistance}%`,
      numeric: metrics.quantumResistance,
      copy: metrics.statusCards.encryption.headline || 'ML-KEM-768',
    },
    {
      icon: Atom,
      status: metrics.statusCards.encryption,
      label: 'Quantum Resistance',
      value: `${metrics.quantumResistance}%`,
      numeric: metrics.quantumResistance,
      copy: metrics.statusCards.encryption.state,
    },
    {
      icon: Fingerprint,
      status: metrics.statusCards.architecture,
      label: 'Zero Knowledge Score',
      value: `${metrics.zeroKnowledgeScore}%`,
      numeric: metrics.zeroKnowledgeScore,
      copy: metrics.statusCards.architecture.headline || 'ZERO-KNOWLEDGE',
    },
    {
      icon: Box,
      status: metrics.statusCards.vault,
      label: 'System Health',
      value: metrics.systemHealth.toUpperCase(),
      numeric: systemNumeric,
      copy: metrics.statusCards.vault.state,
    },
  ]

  return (
    <div className="qv-side-panel">
      <div className="qv-panel-title">Security Metrics</div>
      {rows.map(({ icon: Icon, status, label, value, numeric, copy }) => {
        const StatusIcon = status.healthy ? CheckCircle2 : XCircle
        return (
          <div key={label} className="qv-metric-row">
            <Icon size={24} strokeWidth={1.45} />
            <div style={{ flex: 1 }}>
              <div className="qv-row-title">{label}</div>
              <div className="qv-metric-value" style={{ color: metricTone(numeric) }}>{value}</div>
              <div className="qv-metric-caption">{copy}</div>
            </div>
            <SparkLine active={status.healthy && numeric >= 75} />
            <span className="qv-row-status" style={{ color: status.healthy ? '#33f39b' : '#ff5470' }}>
              <StatusIcon size={15} strokeWidth={2.2} />
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function QuantumVault({ sessionToken, metrics, onFileUploaded, onKeysUnlocked }: QuantumVaultProps) {
  const [vaultState, setVaultState] = useState<VaultState>('idle')
  const [zkKeys, setZkKeys] = useState<ZKMasterKeys | null>(null)
  const [hasServerKeys, setHasServerKeys] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  const handleOpenVault = async () => {
    if (vaultState !== 'idle') return
    setVaultState('opening')
    setAuthError(null)

    if (hasServerKeys === null) {
      try {
        await ensureVaultProfile()
        const keys = await fetchUserKeys()
        setHasServerKeys(!!keys)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Vault service error'
        if (msg.toLowerCase().includes('auth') || msg.toLowerCase().includes('not authenticated')) {
          setVaultState('idle')
          setAuthError('Session error. Please sign out and back in, then try again.')
          return
        }
        setHasServerKeys(false)
      }
    }
  }

  const handleOpenComplete = useCallback(() => {
    setVaultState('opened')
  }, [])

  const handleCloseVault = () => {
    setVaultState('idle')
  }

  const handleKeysReady = (keys: ZKMasterKeys) => {
    setZkKeys(keys)
    setHasServerKeys(true)
    onKeysUnlocked?.(keys)
  }

  const isOpen = vaultState === 'opened' || vaultState === 'uploading' || vaultState === 'encrypting' || vaultState === 'complete'
  const needsPassphrase = isOpen && !zkKeys

  return (
    <section className="qv-hero">
      <style>{`
        .qv-hero {
          position: relative;
          overflow: hidden;
          width: 100%;
          padding: clamp(14px, 2.1vh, 20px) clamp(20px, 3vw, 42px) 24px;
          margin-bottom: 22px;
          color: #fff7c9;
          background:
            radial-gradient(circle at 50% 74%, rgba(212,175,55,0.22), transparent 24%),
            radial-gradient(circle at 50% 42%, rgba(212,175,55,0.12), transparent 34%),
            linear-gradient(180deg, rgba(0,0,0,0.98), rgba(8,6,0,0.96) 52%, rgba(0,0,0,0.98));
          border-bottom: 1px solid rgba(212,175,55,0.25);
          isolation: isolate;
        }
        .qv-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(212,175,55,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(212,175,55,0.06) 1px, transparent 1px);
          background-size: 18px 18px;
          opacity: 0.26;
          mask-image: radial-gradient(circle at 50% 44%, #000 0, transparent 78%);
        }
        .qv-title {
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 1100px;
          margin: 0 auto;
          font-family: Orbitron, var(--font-mono), monospace;
          font-size: clamp(1.95rem, 4vw, 3.35rem);
          font-weight: 800;
          line-height: 0.98;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #ffd76a;
          text-shadow:
            0 0 4px rgba(255,247,201,0.8),
            0 0 18px rgba(212,175,55,0.72),
            0 0 38px rgba(212,175,55,0.28);
        }
        .qv-subtitle {
          position: relative;
          z-index: 1;
          max-width: 860px;
          margin: 10px auto 18px;
          text-align: center;
          font-family: var(--font-mono);
          color: rgba(255,214,104,0.88);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-size: clamp(0.64rem, 1vw, 0.82rem);
        }
        .qv-card-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: clamp(10px, 1.7vw, 18px);
          max-width: 1220px;
          margin: 0 auto 14px;
        }
        .qv-glass-card::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(110deg, transparent 0%, rgba(255,231,151,0.02) 30%, rgba(255,231,151,0.18) 48%, rgba(255,231,151,0.02) 64%, transparent 100%),
            radial-gradient(circle at 12% 0%, rgba(255,243,193,0.16), transparent 32%);
          transform: translateX(-122%);
          transition: transform 0.72s ease, opacity 0.72s ease;
          opacity: 0.42;
        }
        .qv-glass-card::after {
          content: "";
          position: absolute;
          inset: 1px;
          pointer-events: none;
          border: 1px solid rgba(255,243,193,0.07);
          clip-path: inherit;
        }
        .qv-glass-card:hover::before {
          transform: translateX(122%);
          opacity: 0.82;
        }
        .qv-card-orb {
          position: absolute;
          right: 12px;
          bottom: 11px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          opacity: 0.9;
          animation: qv-pulse 1.8s ease-in-out infinite;
        }
        .qv-status-badge {
          min-width: 25px;
          height: 25px;
          display: inline-grid;
          place-items: center;
          border: 1px solid;
          border-radius: 8px;
          box-shadow: inset 0 0 12px rgba(255,255,255,0.04);
          flex: 0 0 auto;
        }
        .qv-card-meta {
          display: grid;
          gap: 2px;
          margin-top: 9px;
          font-family: var(--font-mono);
          color: rgba(255,243,193,0.5);
          font-size: 8.8px;
          line-height: 1.34;
          letter-spacing: 0;
        }
        .qv-card-state {
          margin-top: 5px;
          font-family: var(--font-mono);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-shadow: 0 0 10px currentColor;
        }
        .qv-stage {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(220px, 280px) minmax(300px, 430px) minmax(220px, 280px);
          gap: clamp(12px, 2vw, 24px);
          align-items: center;
          justify-content: center;
          max-width: 1220px;
          margin: 0 auto;
        }
        .qv-core {
          position: relative;
          min-height: clamp(350px, 45vh, 430px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .qv-core::before,
        .qv-core::after {
          content: "";
          position: absolute;
          border: 1px solid rgba(212,175,55,0.18);
          border-radius: 50%;
          inset: 5%;
          animation: qv-orbit 22s linear infinite;
          box-shadow: 0 0 28px rgba(212,175,55,0.08);
        }
        .qv-core::after {
          inset: 14%;
          animation-duration: 16s;
          animation-direction: reverse;
        }
        .qv-floor {
          position: absolute;
          left: 50%;
          bottom: 0;
          width: min(560px, 76vw);
          height: 96px;
          transform: translateX(-50%);
          background:
            radial-gradient(ellipse at 50% 50%, rgba(255,214,104,0.22), transparent 48%),
            repeating-linear-gradient(90deg, rgba(212,175,55,0.24) 0 1px, transparent 1px 42px),
            repeating-linear-gradient(0deg, rgba(212,175,55,0.16) 0 1px, transparent 1px 22px);
          clip-path: ellipse(50% 45% at 50% 60%);
          opacity: 0.68;
          filter: blur(0.2px);
        }
        .qv-side-panel {
          border: 1px solid rgba(212,175,55,0.46);
          background:
            linear-gradient(140deg, rgba(255,214,104,0.1), rgba(12,10,2,0.56) 34%, rgba(0,0,0,0.68)),
            rgba(8,7,2,0.42);
          clip-path: polygon(5% 0, 95% 0, 100% 5%, 100% 95%, 95% 100%, 5% 100%, 0 95%, 0 5%);
          backdrop-filter: blur(18px) saturate(145%);
          -webkit-backdrop-filter: blur(18px) saturate(145%);
          padding: 16px 18px 14px;
          box-shadow: 0 16px 42px rgba(0,0,0,0.44), inset 0 0 28px rgba(212,175,55,0.08), inset 0 1px 0 rgba(255,243,193,0.08), 0 0 28px rgba(212,175,55,0.08);
          transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
        }
        .qv-side-panel:hover {
          transform: translateY(-2px);
          border-color: rgba(255,214,104,0.62);
          box-shadow: 0 20px 52px rgba(0,0,0,0.5), inset 0 0 32px rgba(212,175,55,0.1), 0 0 38px rgba(212,175,55,0.12);
        }
        .qv-panel-title {
          margin-bottom: 11px;
          padding-bottom: 9px;
          border-bottom: 1px dotted rgba(212,175,55,0.32);
          color: #ffc83d;
          font-family: var(--font-mono);
          font-weight: 800;
          letter-spacing: 0.09em;
          font-size: 13px;
          text-transform: uppercase;
        }
        .qv-overview-row, .qv-metric-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 63px;
          color: ${gold};
          border-bottom: 1px dotted rgba(212,175,55,0.16);
          position: relative;
        }
        .qv-overview-row:last-child, .qv-metric-row:last-child { border-bottom: 0; }
        .qv-overview-row > div, .qv-metric-row > div { min-width: 0; }
        .qv-row-title {
          color: #ffc83d;
          font-weight: 800;
          font-size: 11.5px;
          line-height: 1.25;
        }
        .qv-row-copy {
          margin-top: 3px;
          color: rgba(255,255,255,0.62);
          font-size: 10.5px;
          line-height: 1.35;
        }
        .qv-row-telemetry,
        .qv-metric-caption {
          margin-top: 3px;
          color: rgba(255,243,193,0.42);
          font-family: var(--font-mono);
          font-size: 8.6px;
          line-height: 1.3;
          letter-spacing: 0;
        }
        .qv-row-status {
          width: 21px;
          height: 21px;
          display: inline-grid;
          place-items: center;
          border: 1px solid currentColor;
          border-radius: 8px;
          background: rgba(0,0,0,0.3);
          box-shadow: inset 0 0 12px rgba(255,255,255,0.04), 0 0 13px currentColor;
          opacity: 0.88;
          flex: 0 0 auto;
        }
        .qv-metric-value {
          margin-top: 2px;
          font-family: var(--font-mono);
          font-weight: 900;
          font-size: 16.5px;
          text-shadow: 0 0 12px rgba(212,175,55,0.4);
        }
        .qv-open-button {
          position: relative;
          z-index: 2;
          margin: -6px auto 0;
          width: min(420px, calc(100% - 28px));
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          border: 1px solid rgba(255,214,104,0.78);
          color: #fff3c1;
          background:
            linear-gradient(135deg, rgba(255,214,104,0.14), rgba(0,0,0,0.9) 32%, rgba(212,175,55,0.15)),
            linear-gradient(90deg, transparent, rgba(255,214,104,0.12), transparent);
          clip-path: polygon(5% 0, 95% 0, 100% 24%, 100% 76%, 95% 100%, 5% 100%, 0 76%, 0 24%);
          font-family: Orbitron, var(--font-mono), monospace;
          font-size: clamp(0.84rem, 1.45vw, 1.06rem);
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 0 42px rgba(212,175,55,0.22), inset 0 0 26px rgba(212,175,55,0.1);
          transition: transform 0.24s ease, filter 0.24s ease, box-shadow 0.24s ease;
        }
        .qv-open-button:hover {
          transform: translateY(-2px) scale(1.01);
          filter: brightness(1.12);
          box-shadow: 0 0 58px rgba(212,175,55,0.32), inset 0 0 34px rgba(212,175,55,0.14);
        }
        .qv-open-button:disabled {
          cursor: wait;
          opacity: 0.82;
        }
        .qv-auth-error {
          max-width: 620px;
          margin: 0 auto 16px;
          padding: 11px 16px;
          border: 1px solid rgba(239,68,68,0.38);
          background: rgba(239,68,68,0.1);
          border-radius: 8px;
          color: #ff9a9a;
          font-size: 12px;
          font-family: var(--font-mono);
        }
        .qv-live {
          position: absolute;
          right: clamp(16px, 2.2vw, 30px);
          bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: rgba(255,243,193,0.72);
          font-size: 10px;
          font-family: var(--font-mono);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .qv-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: ${gold};
          box-shadow: 0 0 12px rgba(212,175,55,0.85);
          animation: qv-pulse 1.5s ease-in-out infinite;
        }
        @keyframes qv-orbit { to { transform: rotate(360deg); } }
        @keyframes qv-pulse { 0%,100% { opacity: .45; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }
        @media (max-width: 1040px) {
          .qv-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .qv-stage { grid-template-columns: 1fr; }
          .qv-core { min-height: 410px; order: -1; }
          .qv-side-panel { max-width: 620px; width: 100%; margin: 0 auto; }
        }
        @media (max-width: 680px) {
          .qv-hero { padding-inline: 14px; }
          .qv-card-grid { grid-template-columns: 1fr; }
          .qv-title { letter-spacing: 0.08em; }
          .qv-subtitle { letter-spacing: 0.08em; }
          .qv-core { min-height: 340px; }
          .qv-open-button { min-height: 54px; }
        }
      `}</style>

      <h1 className="qv-title">Quantum Secure Vault</h1>
      <div className="qv-subtitle">FIPS 203 Compliant / Zero Knowledge / Quantum Ready</div>

      <div className="qv-card-grid">
        <CyberCard
          icon={ShieldCheck}
          label="Vault Status"
          status={metrics.statusCards.vault}
        />
        <CyberCard
          icon={LockKeyhole}
          label="Encryption"
          status={metrics.statusCards.encryption}
        />
        <CyberCard
          icon={Fingerprint}
          label="Integrity"
          status={metrics.statusCards.integrity}
        />
        <CyberCard
          icon={Atom}
          label="Architecture"
          status={metrics.statusCards.architecture}
        />
      </div>

      {authError && <div className="qv-auth-error">{authError}</div>}

      <div className="qv-stage">
        <OverviewPanel metrics={metrics} unlocked={!!zkKeys} />
        <div className="qv-core">
          <div className="qv-floor" />
          <motion.div
            animate={vaultState === 'opening' ? { x: [0, -2, 2, -1, 1, 0] } : { x: 0 }}
            transition={vaultState === 'opening' ? { duration: 0.34, repeat: 4 } : undefined}
            style={{ position: 'relative', zIndex: 1, width: 'min(430px, 100%)', margin: '0 auto' }}
          >
            <VaultDoor vaultState={vaultState} onOpenComplete={handleOpenComplete} />
          </motion.div>
        </div>
        <SecurityMetricsPanel metrics={metrics} />
      </div>

      {!isOpen && (
        <button
          type="button"
          className="qv-open-button"
          onClick={handleOpenVault}
          disabled={vaultState !== 'idle'}
          aria-label="Open Quantum Vault"
        >
          <LockKeyhole size={20} />
          {vaultState === 'opening' ? 'Opening Quantum Vault' : 'Open Quantum Vault'}
          <Zap size={20} />
        </button>
      )}

      {vaultState === 'opening' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            marginTop: 18,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: gold,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          Initializing key unwrap sequence...
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {needsPassphrase && (
          <motion.div
            key="vault-passphrase"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', maxWidth: 500, padding: '18px 16px 0', margin: '0 auto' }}
          >
            <VaultPassphrase
              mode={hasServerKeys ? 'unlock' : 'create'}
              sessionToken={sessionToken}
              onKeysReady={handleKeysReady}
              onCancel={handleCloseVault}
            />
          </motion.div>
        )}

        {isOpen && zkKeys && (
          <motion.div
            key="vault-panel"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', maxWidth: 620, padding: '18px 16px 0', margin: '0 auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 15px',
                background: 'rgba(212,175,55,0.08)',
                border: '1px solid rgba(212,175,55,0.28)',
                borderRadius: 40,
                color: brightGold,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}>
                <CheckCircle2 size={14} />
                Vault Open / Zero-Knowledge Encryption Active
              </div>
            </div>

            <VaultUploadPanel
              sessionToken={sessionToken}
              encPublicKey={zkKeys.encPublicKey}
              x25519Public={zkKeys.x25519Public}
              sigSecretKey={zkKeys.signSecretKey}
              ed25519SecretKey={zkKeys.ed25519Secret}
              onFileUploaded={onFileUploaded}
              onClose={handleCloseVault}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="qv-live">
        <span className="qv-live-dot" />
        <Activity size={13} />
        {metrics.telemetryConnected ? 'Live Vault Telemetry' : 'Telemetry Standby'}
      </div>
    </section>
  )
}
