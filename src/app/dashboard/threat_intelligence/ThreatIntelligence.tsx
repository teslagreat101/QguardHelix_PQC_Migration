import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Radio, Globe, AlertTriangle, Shield, Eye, Crosshair,
  TrendingUp, Clock, Zap, Target, Skull, Lock, Activity,
  ExternalLink, ChevronRight, MapPin
} from 'lucide-react';

type ThreatActor = {
  id: string;
  name: string;
  origin: string;
  type: 'nation-state' | 'criminal' | 'hacktivist' | 'insider';
  capability: 'quantum-ready' | 'pre-quantum' | 'classical';
  targets: string[];
  lastActivity: string;
  threatLevel: number;
};

type IntelFeed = {
  id: string;
  timestamp: string;
  source: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  ioc: string | null;
};

const THREAT_ACTORS: ThreatActor[] = [
  { id: 'ta-01', name: 'APT-Q1 (Quantum Dragon)', origin: 'East Asia', type: 'nation-state', capability: 'quantum-ready', targets: ['Financial', 'Government', 'Defense'], lastActivity: '2h ago', threatLevel: 96 },
  { id: 'ta-02', name: 'CipherStorm', origin: 'Eastern Europe', type: 'criminal', capability: 'pre-quantum', targets: ['Healthcare', 'Financial'], lastActivity: '4h ago', threatLevel: 82 },
  { id: 'ta-03', name: 'ShadowHarvest', origin: 'Unknown', type: 'nation-state', capability: 'quantum-ready', targets: ['Telecom', 'Energy', 'Government'], lastActivity: '45m ago', threatLevel: 91 },
  { id: 'ta-04', name: 'NullEntropy', origin: 'South America', type: 'hacktivist', capability: 'classical', targets: ['Critical Infrastructure'], lastActivity: '1d ago', threatLevel: 54 },
  { id: 'ta-05', name: 'Project Meridian', origin: 'Central Asia', type: 'nation-state', capability: 'pre-quantum', targets: ['Defense', 'Aerospace'], lastActivity: '6h ago', threatLevel: 78 },
];

const INTEL_FEEDS: IntelFeed[] = [
  { id: 'if-01', timestamp: '14:58:22', source: 'NIST Advisory', title: 'Critical vulnerability in legacy RSA padding scheme (CVE-2026-5812)', severity: 'critical', category: 'Vulnerability', ioc: 'CVE-2026-5812' },
  { id: 'if-02', timestamp: '14:52:10', source: 'QGuard Honeypot', title: 'HNDL traffic spike detected — 340% increase on port 443', severity: 'critical', category: 'HNDL Campaign', ioc: '192.168.45.0/24' },
  { id: 'if-03', timestamp: '14:44:33', source: 'MITRE ATT&CK', title: 'New TTP: Quantum key extraction via timing side-channel', severity: 'high', category: 'TTP Update', ioc: 'T1557.003' },
  { id: 'if-04', timestamp: '14:38:01', source: 'Vendor Alert', title: 'IBM announces 1,500-qubit processor "Flamingo" deployment', severity: 'high', category: 'Quantum Hardware', ioc: null },
  { id: 'if-05', timestamp: '14:30:15', source: 'CryptoWatch', title: 'Google demonstrates lattice-based attack on reduced-parameter ML-KEM', severity: 'medium', category: 'Research', ioc: null },
  { id: 'if-06', timestamp: '14:22:44', source: 'QGuard Scanner', title: 'New ML-DSA-65 signature verification: All tests PASS', severity: 'info', category: 'Internal', ioc: null },
  { id: 'if-07', timestamp: '14:15:08', source: 'Dark Web Intel', title: 'Forum post selling stolen ECDSA private keys from telecom breach', severity: 'high', category: 'Dark Web', ioc: 'forum.onion/thread/28491' },
  { id: 'if-08', timestamp: '14:08:55', source: 'CERT Feed', title: 'OpenSSL advisory: Side-channel in RSA decryption path', severity: 'medium', category: 'Vulnerability', ioc: 'CVE-2026-5799' },
];

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' };
    case 'high': return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500' };
    case 'medium': return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' };
    case 'low': return { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-500' };
    case 'info': return { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', dot: 'bg-cyan-500' };
    default: return { text: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', dot: 'bg-white/30' };
  }
}

function getThreatColor(level: number) {
  if (level > 85) return '#ef4444';
  if (level > 70) return '#f97316';
  if (level > 50) return '#eab308';
  return '#22c55e';
}

function getCapabilityBadge(cap: string) {
  switch (cap) {
    case 'quantum-ready': return 'text-red-400 border-red-500/30 bg-red-500/10';
    case 'pre-quantum': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    case 'classical': return 'text-green-400 border-green-500/30 bg-green-500/10';
    default: return 'text-white/40 border-white/10 bg-white/5';
  }
}

export default function ThreatIntelligence() {
  const [feedItems, setFeedItems] = useState(INTEL_FEEDS);
  const [selectedActor, setSelectedActor] = useState<ThreatActor | null>(THREAT_ACTORS[0]);
  const [hndlCounter, setHndlCounter] = useState(128472);

  // Simulate SSE live feed
  useEffect(() => {
    const interval = setInterval(() => {
      setHndlCounter(prev => prev + Math.floor(Math.random() * 5));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Threat <span className="text-gold">Intelligence</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Quantum threat landscape monitoring, adversary tracking, and HNDL campaign detection.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="px-4 py-2 border border-red-500/30 bg-red-500/5 rounded-lg text-[10px] font-black text-red-400 uppercase tracking-[0.15em] flex items-center gap-2 animate-pulse">
            <Radio className="h-3 w-3" />
            HNDL Alert Active
          </div>
        </div>
      </header>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'HNDL Intercepts (24h)', value: hndlCounter.toLocaleString(), icon: Eye, color: 'text-red-400' },
          { label: 'Active Threat Actors', value: THREAT_ACTORS.length, icon: Skull, color: 'text-orange-400' },
          { label: 'IOCs Detected', value: '1,247', icon: Crosshair, color: 'text-gold' },
          { label: 'Threat Level', value: 'ELEVATED', icon: AlertTriangle, color: 'text-yellow-400' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="p-5 rounded-xl border border-gold/12 bg-[#0f1428]/50 backdrop-blur-xl relative overflow-hidden group hover:border-gold/30 transition-all"
          >
            <div className="absolute top-3 right-3 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity">
              <card.icon className="h-12 w-12" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className="h-3.5 w-3.5 text-gold/50" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">{card.label}</span>
            </div>
            <div className={`text-2xl font-black ${card.color}`}>{card.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Threat Actors Panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-5">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-4">
              <Skull className="h-3.5 w-3.5 inline mr-2 text-gold/60" />
              Tracked Adversaries
            </h2>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {THREAT_ACTORS.map((actor, i) => {
                const isSelected = selectedActor?.id === actor.id;
                return (
                  <motion.button
                    key={actor.id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setSelectedActor(actor)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-gold/40 bg-gold/[0.06] shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                        : 'border-gold/8 bg-white/[0.015] hover:border-gold/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white/80">{actor.name}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getThreatColor(actor.threatLevel) }} />
                        <span className="text-xs font-black" style={{ color: getThreatColor(actor.threatLevel) }}>{actor.threatLevel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] text-white/30 font-bold flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {actor.origin}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${getCapabilityBadge(actor.capability)}`}>
                        {actor.capability}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Actor Detail */}
          {selectedActor && (
            <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(239,68,68,0.04),transparent_50%)]" />
              <div className="relative z-10">
                <h3 className="text-lg font-black text-white mb-1">{selectedActor.name}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] text-white/30 font-bold uppercase">{selectedActor.type}</span>
                  <span className="text-white/10">•</span>
                  <span className="text-[10px] text-white/30 font-bold">Last seen: {selectedActor.lastActivity}</span>
                </div>
                <div className="mb-3">
                  <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-2">Target Sectors</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedActor.targets.map(t => (
                      <span key={t} className="text-[9px] px-2 py-1 rounded border border-gold/15 bg-gold/5 text-gold/70 font-bold">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-gold/10 bg-white/[0.02]">
                  <span className="text-[10px] text-white/40 font-bold">Threat Score</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${selectedActor.threatLevel}%`, backgroundColor: getThreatColor(selectedActor.threatLevel) }} />
                    </div>
                    <span className="text-sm font-black" style={{ color: getThreatColor(selectedActor.threatLevel) }}>{selectedActor.threatLevel}/100</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Intel Feed */}
        <div className="lg:col-span-3 rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(212,175,55,0.04),transparent_40%)]" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                <Radio className="h-3.5 w-3.5 inline mr-2 text-gold/60 animate-pulse" />
                Live Intelligence Feed
              </h2>
              <span className="text-[10px] text-gold/40 font-bold">{feedItems.length} alerts</span>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {feedItems.map((feed, i) => {
                const colors = getSeverityColor(feed.severity);
                return (
                  <motion.div
                    key={feed.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`p-4 rounded-xl border ${colors.border} ${colors.bg} hover:bg-white/[0.04] transition-colors group`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <span className={`h-2.5 w-2.5 rounded-full block ${colors.dot}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${colors.border} ${colors.bg} ${colors.text}`}>
                            {feed.severity}
                          </span>
                          <span className="text-[10px] text-white/30 font-bold">{feed.source}</span>
                          <span className="text-[10px] text-white/20 font-mono ml-auto">{feed.timestamp}</span>
                        </div>
                        <p className="text-sm text-white/70 group-hover:text-white/90 transition-colors leading-relaxed">{feed.title}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[9px] text-gold/40 font-bold uppercase">{feed.category}</span>
                          {feed.ioc && (
                            <span className="text-[9px] font-mono text-cyan-400/60 flex items-center gap-1">
                              <Target className="h-3 w-3" /> {feed.ioc}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
