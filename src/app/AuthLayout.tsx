"use client";

import React from "react";
import Link from "next/link";
import { Shield, Zap, Cpu, Lock, Activity } from "lucide-react";
import EliteCyberBackground from "@/components/EliteCyberBackground";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const FEATURES = [
  {
    icon: <Zap size={15} className="text-[var(--qg-cyan)]" />,
    label: "Post-Quantum Cryptography",
    desc: "NIST ML-KEM & ML-DSA aligned",
  },
  {
    icon: <Cpu size={15} className="text-[var(--qg-violet)]" />,
    label: "AI Risk Intelligence",
    desc: "Harvest-now threat detection",
  },
  {
    icon: <Lock size={15} className="text-[var(--qg-cyan)]" />,
    label: "Zero-Trust Architecture",
    desc: "Cryptographic policy enforcement",
  },
  {
    icon: <Activity size={15} className="text-[var(--qg-violet)]" />,
    label: "Continuous Audit Trail",
    desc: "Immutable governance logging",
  },
];

// Six hexagon corner positions (flat-top)
const HEX_NODES = [0, 1, 2, 3, 4, 5].map((i) => ({
  top: `${50 - 44 * Math.cos((i * Math.PI) / 3)}%`,
  left: `${50 + 44 * Math.sin((i * Math.PI) / 3)}%`,
}));

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-[#020817] text-white relative overflow-hidden flex">
      {/* Full-screen canvas network */}
      <EliteCyberBackground />

      {/* Subtle hex grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* ── LEFT PANEL ─────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[480px] xl:w-[520px] shrink-0 relative border-r border-white/[0.05] bg-[#020817]/80 backdrop-blur-sm q-left-in">

        {/* Top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--qg-cyan)]/40 to-transparent" />

        {/* Logo */}
        <div className="p-10 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--qg-cyan)]/10 border border-[var(--qg-cyan)]/20 flex items-center justify-center">
              <Shield size={17} className="text-[var(--qg-cyan)]" />
            </div>
            <div>
              <p className="text-[13px] font-bold tracking-[0.18em] text-white" style={{ fontFamily: "var(--font-display)" }}>
                QGUARD HELIX
              </p>
              <p className="text-[10px] text-[var(--qg-text-muted)] tracking-widest" style={{ fontFamily: "var(--font-mono)" }}>
                POST-QUANTUM SECURITY
              </p>
            </div>
          </div>
        </div>

        {/* ── QUANTUM ORB VISUALIZATION ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-8">

          {/* Orb container */}
          <div className="relative w-[260px] h-[260px] q-float">

            {/* Outermost dashed rotating ring */}
            <div
              className="absolute inset-0 rounded-full border-2 border-dashed border-[var(--qg-cyan)]/20 q-ring"
            />

            {/* Tick marks (12 segments on outer ring) */}
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-[2px] h-[10px] bg-[var(--qg-cyan)]/30 rounded-full"
                style={{
                  top: "50%",
                  left: "50%",
                  transformOrigin: "1px -124px",
                  transform: `rotate(${i * 30}deg) translateY(-124px)`,
                }}
              />
            ))}

            {/* Second ring – reverse violet */}
            <div
              className="absolute inset-7 rounded-full border border-[var(--qg-violet)]/25 q-ring-r q-pulse-vio"
            />

            {/* Third ring – pulsing cyan */}
            <div
              className="absolute inset-14 rounded-full border border-[var(--qg-cyan)]/40 q-pulse-cyan"
            />

            {/* Innermost filled glow disc */}
            <div className="absolute inset-[72px] rounded-full bg-[var(--qg-cyan)]/5 border border-[var(--qg-cyan)]/20" />

            {/* Center shield icon */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Shield
                size={52}
                className="text-[var(--qg-cyan)] q-glow-icon"
              />
            </div>

            {/* ── SCAN BEAM (sweeps top→bottom, clipped to outer ring) ── */}
            <div className="absolute inset-0 overflow-hidden rounded-full">
              {/* Glow halo */}
              <div
                className="q-scan absolute left-0 right-0"
                style={{ height: "48px", background: "linear-gradient(to bottom, transparent, rgba(0,212,255,0.14), transparent)" }}
              />
              {/* Crisp scan line */}
              <div
                className="q-scan absolute left-0 right-0"
                style={{
                  height: "1.5px",
                  background: "rgba(0,212,255,0.75)",
                  boxShadow: "0 0 8px 2px rgba(0,212,255,0.45)",
                  marginTop: "23px",
                }}
              />
            </div>

            {/* Six corner nodes */}
            {HEX_NODES.map((pos, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-[var(--qg-cyan)] q-node-pulse"
                style={{
                  top: pos.top,
                  left: pos.left,
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 0 6px rgba(0,212,255,0.8)",
                  animationDelay: `${i * 0.32}s`,
                }}
              />
            ))}
          </div>

          {/* Status readout */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--qg-green)] shadow-[0_0_6px_rgba(48,209,88,0.9)] q-node-pulse" />
              <span
                className="text-[11px] text-[var(--qg-green)] tracking-[0.22em] uppercase"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                QUANTUM SCAN ACTIVE
              </span>
            </div>
            {/* Scan progress bar */}
            <div className="w-40 h-[2px] rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full q-scan-bar-fill" style={{ width: "82%" }} />
            </div>
            {/* Mini stats */}
            <div
              className="flex items-center gap-4 mt-1 text-[10px] text-[var(--qg-text-muted)] tracking-widest uppercase"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span>Threats: <span className="text-[var(--qg-green)]">0</span></span>
              <span className="opacity-30">|</span>
              <span>Nodes: <span className="text-[var(--qg-cyan)]">256</span></span>
              <span className="opacity-30">|</span>
              <span>Score: <span className="text-[var(--qg-cyan)]">94</span></span>
            </div>
          </div>
        </div>

        {/* ── FEATURE LIST ── */}
        <div className="px-10 pb-8 space-y-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-3 q-fade-in" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
              <div className="mt-0.5 w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                {f.icon}
              </div>
              <div>
                <p className="text-[13px] font-semibold text-[var(--qg-text-primary)]">{f.label}</p>
                <p className="text-[11px] text-[var(--qg-text-muted)]" style={{ fontFamily: "var(--font-mono)" }}>{f.desc}</p>
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-white/[0.05]">
            <Link
              href="/"
              className="text-[11px] text-[var(--qg-text-muted)] hover:text-[var(--qg-cyan)] tracking-widest uppercase transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ← Return to Command Center
            </Link>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative min-h-screen">
        {/* Radial glow behind card */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_60%_50%,rgba(0,212,255,0.04),transparent)]" />

        <div className="relative w-full max-w-[720px] xl:max-w-[760px] q-card-in">
          {children}
        </div>
      </div>
    </div>
  );
}
