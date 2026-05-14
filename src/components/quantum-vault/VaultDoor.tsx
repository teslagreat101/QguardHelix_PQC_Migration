'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'

export type VaultState = 'idle' | 'opening' | 'opened' | 'uploading' | 'encrypting' | 'complete'

interface VaultDoorProps {
  vaultState: VaultState
  onOpenComplete: () => void
}

const CX = 300
const CY = 300

// ── Generate circuit PCB traces ───────────────────────────────────────────────
const circuits = (() => {
  const paths: { d: string; delay: number; duration: number }[] = []
  const nodes: { x: number; y: number; r: number; delay: number }[] = []

  const N = 20
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const perp = a + Math.PI / 2
    const sign = i % 2 === 0 ? 1 : -1
    const jog = 10 + (i % 5) * 5

    const f = (n: number) => n.toFixed(2)
    const P = (r: number, ang = a): [number, number] => [CX + r * Math.cos(ang), CY + r * Math.sin(ang)]

    const [x0, y0] = P(90)
    const delay = (i / N) * 1.5
    const duration = 3 + (i % 4) * 0.6

    if (i % 5 === 0) {
      // Triple-segment trace
      const [x1, y1] = P(118)
      const [xj1, yj1] = [x1 + sign * jog * Math.cos(perp), y1 + sign * jog * Math.sin(perp)]
      const [x2, y2] = P(155)
      const [xj2, yj2] = [x2 - sign * (jog * 0.7) * Math.cos(perp), y2 - sign * (jog * 0.7) * Math.sin(perp)]
      const [x3, y3] = P(195)
      paths.push({ d: `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)} L${f(xj1)} ${f(yj1)} L${f(x2)} ${f(y2)} L${f(xj2)} ${f(yj2)} L${f(x3)} ${f(y3)}`, delay, duration })
      nodes.push({ x: xj1, y: yj1, r: 3, delay })
      nodes.push({ x: xj2, y: yj2, r: 2.5, delay: delay + 0.2 })
      nodes.push({ x: x3, y: y3, r: 3.5, delay: delay + 0.4 })
    } else if (i % 3 === 0) {
      // Double-segment trace
      const [x1, y1] = P(130)
      const [xj1, yj1] = [x1 + sign * (jog * 1.2) * Math.cos(perp), y1 + sign * (jog * 1.2) * Math.sin(perp)]
      const [x2, y2] = P(195)
      paths.push({ d: `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)} L${f(xj1)} ${f(yj1)} L${f(x2)} ${f(y2)}`, delay, duration })
      nodes.push({ x: xj1, y: yj1, r: 3, delay })
      nodes.push({ x: x2, y: y2, r: 3, delay: delay + 0.3 })
    } else {
      // Single-jog trace
      const midR = 140
      const [xm, ym] = P(midR)
      const [xmj, ymj] = [xm + sign * jog * Math.cos(perp), ym + sign * jog * Math.sin(perp)]
      const [xe, ye] = P(195)
      paths.push({ d: `M${f(x0)} ${f(y0)} L${f(xm)} ${f(ym)} L${f(xmj)} ${f(ymj)} L${f(xe)} ${f(ye)}`, delay, duration })
      nodes.push({ x: xmj, y: ymj, r: 2.5 + (i % 3) * 0.5, delay })
      nodes.push({ x: xe, y: ye, r: 3, delay: delay + 0.2 })
    }
  }

  // Secondary tangential traces connecting nearby radials
  for (let i = 0; i < 10; i++) {
    const a1 = (i / N) * Math.PI * 2
    const a2 = ((i + 2) / N) * Math.PI * 2
    const r = 155 + (i % 3) * 18
    const f = (n: number) => n.toFixed(2)
    const [x1, y1] = [CX + r * Math.cos(a1), CY + r * Math.sin(a1)]
    const [x2, y2] = [CX + r * Math.cos(a2), CY + r * Math.sin(a2)]
    // Tangential connector (two right-angle bends)
    const midA = (a1 + a2) / 2
    const [xm, ym] = [CX + (r + 8) * Math.cos(midA), CY + (r + 8) * Math.sin(midA)]
    paths.push({ d: `M${f(x1)} ${f(y1)} L${f(xm)} ${f(ym)} L${f(x2)} ${f(y2)}`, delay: i * 0.2, duration: 2.5 })
    nodes.push({ x: xm, y: ym, r: 2, delay: i * 0.2 })
  }

  // Inner ring short traces
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const perp = a + Math.PI / 2
    const sign = i % 2 === 0 ? 1 : -1
    const f = (n: number) => n.toFixed(2)
    const [x0, y0] = [CX + 90 * Math.cos(a), CY + 90 * Math.sin(a)]
    const [x1, y1] = [CX + 108 * Math.cos(a), CY + 108 * Math.sin(a)]
    const [xj, yj] = [x1 + sign * 9 * Math.cos(perp), y1 + sign * 9 * Math.sin(perp)]
    paths.push({ d: `M${f(x0)} ${f(y0)} L${f(x1)} ${f(y1)} L${f(xj)} ${f(yj)}`, delay: i * 0.1 + 0.5, duration: 2 })
    nodes.push({ x: xj, y: yj, r: 2, delay: i * 0.1 })
  }

  // Marker dots on inner ring border
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    nodes.push({ x: CX + 90 * Math.cos(a), y: CY + 90 * Math.sin(a), r: 1.8, delay: i * 0.06 })
  }

  return { paths, nodes }
})()

// Bolts around outer ring
const BOLTS = Array.from({ length: 20 }, (_, i) => {
  const a = (i / 20) * Math.PI * 2 - Math.PI / 2
  return { x: CX + 254 * Math.cos(a), y: CY + 254 * Math.sin(a) }
})

// Lock pins around inner ring
const LOCK_PINS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 - Math.PI / 2
  return { x: CX + 97 * Math.cos(a), y: CY + 97 * Math.sin(a) }
})

export default function VaultDoor({ vaultState, onOpenComplete }: VaultDoorProps) {
  const isOpening = vaultState === 'opening'

  useEffect(() => {
    if (!isOpening) return
    const t = setTimeout(onOpenComplete, 3200)
    return () => clearTimeout(t)
  }, [isOpening, onOpenComplete])

  const fastMode = isOpening

  return (
    <>
      <style>{`
        @keyframes qv-cw    { to { transform: rotate(360deg);  } }
        @keyframes qv-ccw   { to { transform: rotate(-360deg); } }
        @keyframes qv-node  { 0%,100%{opacity:.35;} 50%{opacity:1;} }
        @keyframes qv-flow  { 0%{stroke-dashoffset:320;} 100%{stroke-dashoffset:-320;} }
        @keyframes qv-core  { 0%,100%{opacity:.65;} 50%{opacity:1;} }
        @keyframes qv-scan  {
          0%   { transform: translateY(-260px); opacity: 0; }
          10%  { opacity: 0.07; }
          90%  { opacity: 0.07; }
          100% { transform: translateY(260px);  opacity: 0; }
        }
        @keyframes qv-shake {
          0%,100%{ transform: translate(0,0); }
          20%{ transform: translate(-2px,1px); }
          40%{ transform: translate(2px,-1px); }
          60%{ transform: translate(-1px,2px); }
          80%{ transform: translate(1px,-2px); }
        }
        @keyframes qv-flash {
          0%,100%{ opacity:0; }
          50%{ opacity:0.06; }
        }
      `}</style>

      <motion.div
        style={{ position: 'relative', transformOrigin: 'center center' }}
        animate={isOpening
          ? { scale: [1, 1.015, 1, 1.015, 1, 1.02, 6], opacity: [1, 1, 1, 1, 1, 1, 0] }
          : { scale: 1, opacity: 1 }
        }
        transition={isOpening
          ? { duration: 3.2, times: [0, 0.2, 0.4, 0.55, 0.7, 0.8, 1], ease: 'easeIn' }
          : {}
        }
      >
        {/* Shake wrapper during opening */}
        <div style={isOpening ? { animation: 'qv-shake 0.15s linear infinite' } : {}}>

          <svg
            width="100%"
            height="100%"
            viewBox="0 0 600 600"
            style={{ maxWidth: 430, display: 'block', margin: '0 auto' }}
          >
            <defs>
              {/* Glow filters */}
              <filter id="qvg-strong" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b2" />
                <feMerge><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="qvg-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="qvg-core" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2" />
                <feMerge><feMergeNode in="b1" /><feMergeNode in="b1" /><feMergeNode in="b2" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="qvg-text">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>

              {/* Gradients */}
              <radialGradient id="qvg-ring" cx="50%" cy="35%" r="65%">
                <stop offset="0%"   stopColor="#1a2b3d" />
                <stop offset="50%"  stopColor="#0c1822" />
                <stop offset="100%" stopColor="#060c14" />
              </radialGradient>
              <radialGradient id="qvg-face" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#0c1425" />
                <stop offset="100%" stopColor="#030810" />
              </radialGradient>
              <radialGradient id="qvg-core" cx="50%" cy="40%" r="60%">
                <stop offset="0%"   stopColor="#fff7c9" stopOpacity="1" />
                <stop offset="25%"  stopColor="#ffd76a" stopOpacity="0.96" />
                <stop offset="55%"  stopColor="#d4af37" stopOpacity="0.74" />
                <stop offset="100%" stopColor="#3a2500" stopOpacity="0.1" />
              </radialGradient>
              <radialGradient id="qvg-coreglow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#d4af37" stopOpacity={isOpening ? '0.5' : '0.2'} />
                <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="qvg-bolt" cx="30%" cy="28%" r="70%">
                <stop offset="0%"   stopColor="#3a4f65" />
                <stop offset="60%"  stopColor="#182535" />
                <stop offset="100%" stopColor="#0c1820" />
              </radialGradient>

              <clipPath id="qvc-face">
                <circle cx={CX} cy={CY} r="243" />
              </clipPath>
              <clipPath id="qvc-circuit">
                {/* Donut clip: outer r=208, inner r=90 */}
                <path d={`M${CX-208},${CY} a208,208 0 1,0 416,0 a208,208 0 1,0-416,0 M${CX-90},${CY} a90,90 0 1,1 180,0 a90,90 0 1,1-180,0`} fillRule="evenodd" />
              </clipPath>
            </defs>

            {/* ── 1. Outer metallic ring ─────────────────────────── */}
            <circle cx={CX} cy={CY} r="270" fill="url(#qvg-ring)" />
            <circle cx={CX} cy={CY} r="268" fill="none" stroke="#253850" strokeWidth="1.5" />
            <circle cx={CX} cy={CY} r="264" fill="none" stroke="#0d1c2a" strokeWidth="1" />
            {/* radial grooves */}
            {Array.from({ length: 40 }, (_, i) => {
              const a = (i / 40) * Math.PI * 2
              return (
                <line key={i}
                  x1={CX + 246 * Math.cos(a)} y1={CY + 246 * Math.sin(a)}
                  x2={CX + 268 * Math.cos(a)} y2={CY + 268 * Math.sin(a)}
                  stroke="#0a1520" strokeWidth="1.2" opacity="0.7"
                />
              )
            })}

            {/* ── 2. Bolts ──────────────────────────────────────── */}
            {BOLTS.map((b, i) => (
              <g key={i}>
                <circle cx={b.x} cy={b.y} r="7.5" fill="url(#qvg-bolt)" stroke="#0a1820" strokeWidth="1" />
                <circle cx={b.x} cy={b.y} r="4"   fill="none" stroke="#2a4055" strokeWidth="0.8" />
                <circle cx={b.x - 1.5} cy={b.y - 1.5} r="1.5" fill="#3a5570" opacity="0.5" />
              </g>
            ))}

            {/* ── 3. Vault face ─────────────────────────────────── */}
            <circle cx={CX} cy={CY} r="243" fill="url(#qvg-face)" />
            <circle cx={CX} cy={CY} r="243" fill="none" stroke="#0f1e35" strokeWidth="2" />

            {/* ── 4. Outer rotating mechanical ring ─────────────── */}
            <g style={{
              transformOrigin: `${CX}px ${CY}px`,
              animation: `qv-cw ${fastMode ? '2s' : '28s'} linear infinite`,
            }}>
              <circle cx={CX} cy={CY} r="229" fill="none" stroke="#101e30" strokeWidth="22" />
              <circle cx={CX} cy={CY} r="229" fill="none" stroke="#18293e" strokeWidth="18" />
              {/* Tick marks */}
              {Array.from({ length: 80 }, (_, i) => {
                const a = (i / 80) * Math.PI * 2
                const major = i % 10 === 0
                const inner = major ? 218 : 222
                return (
                  <line key={i}
                    x1={CX + inner * Math.cos(a)} y1={CY + inner * Math.sin(a)}
                    x2={CX + 229 * Math.cos(a)}   y2={CY + 229 * Math.sin(a)}
                    stroke={major ? '#2d4a60' : '#1a2e40'}
                    strokeWidth={major ? 1.5 : 0.7}
                  />
                )
              })}
              {/* Outer ring accent border */}
              <circle cx={CX} cy={CY} r="240" fill="none" stroke="#1a3048" strokeWidth="1" />
              <circle cx={CX} cy={CY} r="208" fill="none" stroke="#1a3048" strokeWidth="1" />
            </g>

            {/* Outer ring glow border */}
            <circle cx={CX} cy={CY} r="208" fill="none" stroke="#d4af37" strokeWidth="0.6"
              opacity={isOpening ? '0.5' : '0.15'} filter="url(#qvg-soft)"
              style={{ transition: 'opacity 0.6s' }}
            />

            {/* ── 5. Circuit traces ──────────────────────────────── */}
            <g clipPath="url(#qvc-circuit)">
              {/* Base dim layer */}
              {circuits.paths.map((p, i) => (
                <path key={`b${i}`} d={p.d} fill="none" stroke="#241600" strokeWidth="1.4" />
              ))}
              {/* Glowing trace layer */}
              {circuits.paths.map((p, i) => (
                <path key={`g${i}`} d={p.d} fill="none" stroke="#d4af37"
                  strokeWidth="1"
                  opacity={isOpening ? '0.9' : '0.5'}
                  filter="url(#qvg-soft)"
                  style={{ transition: 'opacity 0.5s' }}
                />
              ))}
              {/* Animated light-flow */}
              {circuits.paths.map((p, i) => (
                <path key={`f${i}`} d={p.d} fill="none" stroke="#fff3c1"
                  strokeWidth="1.8" strokeDasharray="18 320"
                  filter="url(#qvg-strong)"
                  style={{
                    animation: `qv-flow ${p.duration}s linear infinite`,
                    animationDelay: `${p.delay}s`,
                  }}
                />
              ))}
            </g>

            {/* ── 6. Glowing nodes ──────────────────────────────── */}
            <g opacity={isOpening ? '1' : '0.7'} style={{ transition: 'opacity 0.5s' }}>
              {circuits.nodes.map((n, i) => (
                <g key={i}>
                  <circle cx={n.x} cy={n.y} r={n.r * 3.5} fill="#d4af37" opacity="0.05" />
                  <circle cx={n.x} cy={n.y} r={n.r}
                    fill="#d4af37" filter="url(#qvg-soft)"
                    style={{
                      animation: `qv-node ${1.8 + (i % 4) * 0.4}s ease-in-out infinite`,
                      animationDelay: `${n.delay}s`,
                    }}
                  />
                </g>
              ))}
            </g>

            {/* ── 7. Inner rotating ring ────────────────────────── */}
            <g style={{
              transformOrigin: `${CX}px ${CY}px`,
              animation: `qv-ccw ${fastMode ? '1.5s' : '20s'} linear infinite`,
            }}>
              <circle cx={CX} cy={CY} r="89" fill="none" stroke="#0d1e30" strokeWidth="18" />
              <circle cx={CX} cy={CY} r="89" fill="none" stroke="#162636" strokeWidth="14" />
              {Array.from({ length: 36 }, (_, i) => {
                const a = (i / 36) * Math.PI * 2
                const major = i % 6 === 0
                const inner = major ? 82 : 85
                return (
                  <line key={i}
                    x1={CX + inner * Math.cos(a)} y1={CY + inner * Math.sin(a)}
                    x2={CX + 89 * Math.cos(a)}    y2={CY + 89 * Math.sin(a)}
                    stroke={major ? '#2a4558' : '#182a38'}
                    strokeWidth={major ? 1.2 : 0.6}
                  />
                )
              })}
            </g>

            {/* Inner ring glow border */}
            <circle cx={CX} cy={CY} r="80" fill="none" stroke="#d4af37" strokeWidth="0.7"
              opacity={isOpening ? '0.7' : '0.25'} filter="url(#qvg-soft)"
              style={{ transition: 'opacity 0.5s' }}
            />

            {/* Lock pins */}
            {LOCK_PINS.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.2"
                fill="#d4af37" opacity={isOpening ? '0.8' : '0.35'}
                filter="url(#qvg-soft)"
                style={{
                  animation: `qv-node ${2 + (i % 3) * 0.3}s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                  transition: 'opacity 0.5s',
                }}
              />
            ))}

            {/* ── 8. Center core ────────────────────────────────── */}
            {/* Core ambient glow */}
            <circle cx={CX} cy={CY} r="78" fill="url(#qvg-coreglow)" />
            {/* Core dark base */}
            <circle cx={CX} cy={CY} r="57" fill="#030c18" />
            {/* Core energy gradient */}
            <circle cx={CX} cy={CY} r="54" fill="url(#qvg-core)" filter="url(#qvg-core)"
              style={{ animation: 'qv-core 2s ease-in-out infinite' }}
            />
            {/* Concentric rings */}
            <circle cx={CX} cy={CY} r="52" fill="none" stroke="#d4af37" strokeWidth="1"   opacity="0.9" filter="url(#qvg-soft)" />
            <circle cx={CX} cy={CY} r="46" fill="none" stroke="#d4af37" strokeWidth="0.7" opacity="0.6" />
            <circle cx={CX} cy={CY} r="40" fill="none" stroke="#d4af37" strokeWidth="0.5" opacity="0.4" />
            <circle cx={CX} cy={CY} r="33" fill="#170f00" />
            <circle cx={CX} cy={CY} r="28" fill="#d4af37" opacity="0.12" filter="url(#qvg-strong)" />
            <circle cx={CX} cy={CY} r="20" fill="#d4af37" opacity="0.22" filter="url(#qvg-strong)" />
            {/* Shield icon */}
            <g transform={`translate(${CX - 11} ${CY - 13})`} filter="url(#qvg-strong)">
              <path
                d="M11 1.5L20.5 5.5L20.5 12.5C20.5 17.2 16.3 20.8 11 22C5.7 20.8 1.5 17.2 1.5 12.5L1.5 5.5Z"
                fill="none" stroke="#d4af37" strokeWidth="1.4" strokeLinejoin="round"
              />
              <path
                d="M11 6.5L16 8.5L16 12.5C16 14.8 13.8 16.5 11 17C8.2 16.5 6 14.8 6 12.5L6 8.5Z"
                fill="#d4af37" opacity="0.4"
              />
              <circle cx="11" cy="11" r="2.4" fill="#d4af37" />
              <path d="M11 13.2v3.4" fill="none" stroke="#d4af37" strokeWidth="1.3" strokeLinecap="round" />
            </g>

            {/* ── 9. Status text ────────────────────────────────── */}
            <text x={CX} y={CY + 83} textAnchor="middle"
              fill="#d4af37" fontSize="6.5" fontFamily="'JetBrains Mono', monospace"
              letterSpacing="3.5" opacity={isOpening ? '0.9' : '0.4'}
              filter="url(#qvg-text)" style={{ transition: 'opacity 0.5s' }}
            >
              {isOpening ? 'UNLOCKING VAULT...' : 'ZERO-KNOWLEDGE VAULT'}
            </text>
            <text x={CX} y={CY - 74} textAnchor="middle"
              fill="#d4af37" fontSize="6" fontFamily="'JetBrains Mono', monospace"
              letterSpacing="3" opacity={isOpening ? '0.9' : '0.35'}
              filter="url(#qvg-text)" style={{ transition: 'opacity 0.5s' }}
            >
              ML-KEM-768 · AES-256-GCM
            </text>

            {/* ── 10. Opening effects ───────────────────────────── */}
            {isOpening && (
              <>
                {/* Scan line */}
                <rect clipPath="url(#qvc-face)"
                  x={CX - 243} y={CY - 243} width="486" height="12"
                  fill="url(#qvg-face)" opacity="0.25"
                  style={{ animation: 'qv-scan 0.4s linear infinite' }}
                />
                {/* Core flash */}
                <circle cx={CX} cy={CY} r="243"
                  fill="#d4af37" opacity="0.05"
                  style={{ animation: 'qv-flash 0.3s ease-in-out infinite' }}
                />
              </>
            )}
          </svg>

        </div>
      </motion.div>
    </>
  )
}
