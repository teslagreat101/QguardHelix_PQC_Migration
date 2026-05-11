import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Clock,
  FileText, Download, Filter, TrendingUp, Award, Lock
} from 'lucide-react';

type ComplianceFramework = {
  id: string;
  name: string;
  shortName: string;
  score: number;
  maxScore: number;
  status: 'compliant' | 'partial' | 'non-compliant';
  controls: { name: string; status: 'pass' | 'fail' | 'warning' | 'pending'; }[];
  lastAudit: string;
  nextAudit: string;
};

const FRAMEWORKS: ComplianceFramework[] = [
  {
    id: 'fips-203', name: 'NIST FIPS 203 (ML-KEM)', shortName: 'FIPS 203', score: 78, maxScore: 100,
    status: 'partial',
    controls: [
      { name: 'ML-KEM key encapsulation implementation', status: 'pass' },
      { name: 'Key generation entropy source (QRNG)', status: 'pass' },
      { name: 'Decapsulation validation', status: 'pass' },
      { name: 'Side-channel resistance', status: 'warning' },
      { name: 'Parameter set compliance (512/768/1024)', status: 'pass' },
      { name: 'Full production deployment', status: 'fail' },
    ],
    lastAudit: '2026-04-15', nextAudit: '2026-06-15'
  },
  {
    id: 'fips-204', name: 'NIST FIPS 204 (ML-DSA)', shortName: 'FIPS 204', score: 65, maxScore: 100,
    status: 'partial',
    controls: [
      { name: 'ML-DSA signature generation', status: 'pass' },
      { name: 'Signature verification', status: 'pass' },
      { name: 'Key pair generation', status: 'pass' },
      { name: 'Deterministic signing mode', status: 'warning' },
      { name: 'Certificate integration', status: 'fail' },
      { name: 'Legacy RSA deprecation', status: 'fail' },
    ],
    lastAudit: '2026-04-15', nextAudit: '2026-06-15'
  },
  {
    id: 'cnsa-2', name: 'NSA CNSA 2.0 Suite', shortName: 'CNSA 2.0', score: 52, maxScore: 100,
    status: 'non-compliant',
    controls: [
      { name: 'AES-256 symmetric encryption', status: 'pass' },
      { name: 'SHA-384 or higher hash functions', status: 'warning' },
      { name: 'ML-KEM-1024 for key establishment', status: 'fail' },
      { name: 'ML-DSA-87 for digital signatures', status: 'fail' },
      { name: 'XMSS/LMS for firmware signing', status: 'pending' },
    ],
    lastAudit: '2026-03-01', nextAudit: '2026-06-01'
  },
  {
    id: 'iso-27001', name: 'ISO 27001:2022 Annex A', shortName: 'ISO 27001', score: 91, maxScore: 100,
    status: 'compliant',
    controls: [
      { name: 'Cryptographic policy documented', status: 'pass' },
      { name: 'Key management lifecycle', status: 'pass' },
      { name: 'Information classification', status: 'pass' },
      { name: 'Access control implementation', status: 'pass' },
      { name: 'Incident response for crypto events', status: 'warning' },
    ],
    lastAudit: '2026-02-20', nextAudit: '2026-08-20'
  },
];

function getStatusConfig(status: string) {
  switch (status) {
    case 'compliant': return { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', label: 'Compliant' };
    case 'partial': return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Partial' };
    case 'non-compliant': return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Non-Compliant' };
    default: return { color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', label: 'Unknown' };
  }
}

function getControlIcon(status: string) {
  switch (status) {
    case 'pass': return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
    case 'fail': return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    case 'warning': return <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />;
    case 'pending': return <Clock className="h-3.5 w-3.5 text-white/30" />;
    default: return null;
  }
}

export default function ComplianceDashboard() {
  const [selectedFramework, setSelectedFramework] = useState<string>('fips-203');
  const selected = FRAMEWORKS.find(f => f.id === selectedFramework)!;
  const selectedStatus = getStatusConfig(selected.status);

  const overallScore = Math.round(FRAMEWORKS.reduce((a, f) => a + f.score, 0) / FRAMEWORKS.length);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Compliance <span className="text-gold">Dashboard</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">NIST, CNSA, and ISO compliance posture for post-quantum cryptographic standards.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.15em] flex items-center gap-2 hover:bg-gold/10 transition-colors">
            <Download className="h-3 w-3" />
            Export Audit Report
          </button>
        </div>
      </header>

      {/* Overall Score */}
      <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(212,175,55,0.06),transparent_50%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
          <div className="flex flex-col items-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40"
                  fill="none"
                  stroke={overallScore > 80 ? '#22c55e' : overallScore > 60 ? '#eab308' : '#ef4444'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallScore / 100) * 251.3} 251.3`}
                  transform="rotate(-90 50 50)"
                  className="transition-all duration-1000"
                />
                <text x="50" y="48" textAnchor="middle" fill="white" fontSize="18" fontWeight="900" fontFamily="monospace">{overallScore}</text>
                <text x="50" y="60" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="5" fontWeight="700">OVERALL</text>
              </svg>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {FRAMEWORKS.map(fw => {
              const cfg = getStatusConfig(fw.status);
              return (
                <button
                  key={fw.id}
                  onClick={() => setSelectedFramework(fw.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedFramework === fw.id
                      ? `${cfg.border} ${cfg.bg} shadow-lg`
                      : 'border-gold/8 bg-white/[0.02] hover:border-gold/20'
                  }`}
                >
                  <div className="text-xs font-black text-white/80 mb-1">{fw.shortName}</div>
                  <div className={`text-2xl font-black ${cfg.color}`}>{fw.score}%</div>
                  <div className={`text-[9px] font-black uppercase tracking-wider mt-1 ${cfg.color}`}>{cfg.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Framework Details */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,243,255,0.03),transparent_50%)]" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-white">{selected.name}</h2>
                <span className={`text-[10px] font-black uppercase tracking-wider ${selectedStatus.color}`}>{selectedStatus.label}</span>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-black ${selectedStatus.color}`}>{selected.score}%</div>
                <div className="text-[9px] text-white/30 font-bold uppercase">Compliance Score</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden mb-6">
              <motion.div
                className={`h-full rounded-full ${
                  selected.score > 80 ? 'bg-green-500' : selected.score > 60 ? 'bg-gradient-to-r from-yellow-500 to-gold' : 'bg-red-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${selected.score}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>

            {/* Control Items */}
            <div className="space-y-2">
              {selected.controls.map((control, i) => (
                <motion.div
                  key={control.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gold/8 bg-white/[0.015] hover:bg-white/[0.03] transition-colors"
                >
                  {getControlIcon(control.status)}
                  <span className="text-sm text-white/70 flex-1">{control.name}</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${
                    control.status === 'pass' ? 'text-green-400' :
                    control.status === 'fail' ? 'text-red-400' :
                    control.status === 'warning' ? 'text-yellow-400' : 'text-white/30'
                  }`}>
                    {control.status}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-4">
              <FileText className="h-3.5 w-3.5 inline mr-2 text-gold/50" />
              Audit Schedule
            </h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg border border-gold/10 bg-white/[0.02]">
                <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-1">Last Audit</div>
                <div className="text-sm font-bold text-white/70">{selected.lastAudit}</div>
              </div>
              <div className="p-3 rounded-lg border border-gold/10 bg-white/[0.02]">
                <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-1">Next Audit</div>
                <div className="text-sm font-bold text-gold">{selected.nextAudit}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-4">
              <Award className="h-3.5 w-3.5 inline mr-2 text-gold/50" />
              Quick Stats
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Pass', count: selected.controls.filter(c => c.status === 'pass').length, color: 'text-green-400' },
                { label: 'Fail', count: selected.controls.filter(c => c.status === 'fail').length, color: 'text-red-400' },
                { label: 'Warning', count: selected.controls.filter(c => c.status === 'warning').length, color: 'text-yellow-400' },
                { label: 'Pending', count: selected.controls.filter(c => c.status === 'pending').length, color: 'text-white/30' },
              ].map(s => (
                <div key={s.label} className="text-center p-2 rounded-lg border border-gold/8 bg-white/[0.015]">
                  <div className={`text-xl font-black ${s.color}`}>{s.count}</div>
                  <div className="text-[8px] uppercase tracking-wider text-white/25 font-bold">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <button className="w-full py-3 rounded-xl border border-gold/30 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-[0.15em] hover:bg-gold/20 transition-colors flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            Run Compliance Scan
          </button>
        </div>
      </div>
    </div>
  );
}
