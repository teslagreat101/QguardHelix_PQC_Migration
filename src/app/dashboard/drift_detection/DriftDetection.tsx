import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Shield, RefreshCcw, Clock, Eye, Activity,
  GitCompare, ArrowRight, CheckCircle2, XCircle, Radio,
  Server, Database, Globe, ChevronRight, Bell
} from 'lucide-react';

type DriftEvent = {
  id: string;
  timestamp: string;
  asset: string;
  assetType: 'server' | 'database' | 'api' | 'certificate';
  driftType: 'algorithm-downgrade' | 'key-rotation-missed' | 'config-change' | 'new-vulnerability' | 'unauthorized-algo';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  expected: string;
  actual: string;
  resolved: boolean;
  autoRemediated: boolean;
};

const DRIFT_EVENTS: DriftEvent[] = [
  { id: 'd-01', timestamp: '14:55:02', asset: 'api-gateway-prod', assetType: 'server', driftType: 'algorithm-downgrade', description: 'TLS negotiation fell back to RSA-2048 from ML-KEM-768 hybrid', severity: 'critical', expected: 'ML-KEM-768 + RSA-2048 (hybrid)', actual: 'RSA-2048 only', resolved: false, autoRemediated: false },
  { id: 'd-02', timestamp: '14:42:18', asset: 'auth-service-jwt', assetType: 'api', driftType: 'unauthorized-algo', description: 'New deployment introduced RS256 JWT signing, bypassing ML-DSA-44 policy', severity: 'critical', expected: 'ML-DSA-44', actual: 'RS256 (RSA PKCS#1)', resolved: false, autoRemediated: false },
  { id: 'd-03', timestamp: '14:30:11', asset: 'session-store', assetType: 'database', driftType: 'config-change', description: 'Redis encryption config changed from AES-256-GCM to AES-128-CBC', severity: 'high', expected: 'AES-256-GCM', actual: 'AES-128-CBC', resolved: false, autoRemediated: false },
  { id: 'd-04', timestamp: '14:15:44', asset: 'cert-prod-wildcard', assetType: 'certificate', driftType: 'key-rotation-missed', description: 'Certificate key rotation overdue by 12 days', severity: 'high', expected: 'Rotation every 30 days', actual: '42 days since last rotation', resolved: false, autoRemediated: false },
  { id: 'd-05', timestamp: '13:58:20', asset: 'backup-service', assetType: 'server', driftType: 'new-vulnerability', description: 'New CVE published affecting RSA-4096 padding scheme in use', severity: 'medium', expected: 'No known vulnerabilities', actual: 'CVE-2026-5812 applicable', resolved: false, autoRemediated: false },
  { id: 'd-06', timestamp: '12:22:05', asset: 'cdn-origin', assetType: 'server', driftType: 'algorithm-downgrade', description: 'CDN edge node reverted to ECDSA-P256 after config push failure', severity: 'high', expected: 'ML-DSA-65 hybrid', actual: 'ECDSA-P256', resolved: true, autoRemediated: true },
  { id: 'd-07', timestamp: '11:45:33', asset: 'payment-processor', assetType: 'api', driftType: 'config-change', description: 'TLS minimum version changed from 1.3 to 1.2 in load balancer', severity: 'medium', expected: 'TLS 1.3 minimum', actual: 'TLS 1.2 minimum', resolved: true, autoRemediated: false },
  { id: 'd-08', timestamp: '10:12:00', asset: 'vpn-tunnel-03', assetType: 'server', driftType: 'key-rotation-missed', description: 'IPsec pre-shared key rotation was auto-remediated', severity: 'low', expected: 'Weekly rotation', actual: 'Rotated after 9 days', resolved: true, autoRemediated: true },
];

function getSeverityConfig(severity: string) {
  switch (severity) {
    case 'critical': return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' };
    case 'high': return { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500' };
    case 'medium': return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' };
    case 'low': return { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-500' };
    default: return { text: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', dot: 'bg-white/30' };
  }
}

function getDriftTypeLabel(type: string) {
  switch (type) {
    case 'algorithm-downgrade': return 'Algo Downgrade';
    case 'key-rotation-missed': return 'Rotation Missed';
    case 'config-change': return 'Config Change';
    case 'new-vulnerability': return 'New CVE';
    case 'unauthorized-algo': return 'Unauthorized Algo';
    default: return type;
  }
}

function getAssetIcon(type: string) {
  switch (type) {
    case 'server': return Server;
    case 'database': return Database;
    case 'api': return Globe;
    case 'certificate': return Shield;
    default: return Server;
  }
}

export default function DriftDetection() {
  const [events, setEvents] = useState(DRIFT_EVENTS);
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');
  const [expandedId, setExpandedId] = useState<string | null>('d-01');

  const unresolvedCount = events.filter(e => !e.resolved).length;
  const criticalCount = events.filter(e => e.severity === 'critical' && !e.resolved).length;
  const autoRemCount = events.filter(e => e.autoRemediated).length;

  const filtered = events.filter(e => {
    if (filter === 'unresolved') return !e.resolved;
    if (filter === 'resolved') return e.resolved;
    return true;
  });

  const handleResolve = (id: string) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, resolved: true } : e));
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Drift <span className="text-gold">Detection</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Continuous monitoring for cryptographic configuration drift, algorithm downgrades, and policy violations.</p>
        </div>
        <div className="flex gap-3 items-center">
          {criticalCount > 0 && (
            <div className="px-4 py-2 border border-red-500/30 bg-red-500/5 rounded-lg text-[10px] font-black text-red-400 uppercase tracking-[0.15em] flex items-center gap-2 animate-pulse">
              <Bell className="h-3 w-3" />
              {criticalCount} Critical Drifts
            </div>
          )}
          <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.15em] flex items-center gap-2">
            <Activity className="h-3 w-3 animate-pulse" />
            Watching {events.length} Events
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Unresolved Drifts', value: unresolvedCount, icon: AlertTriangle, color: unresolvedCount > 0 ? 'text-red-400' : 'text-green-400' },
          { label: 'Critical', value: criticalCount, icon: XCircle, color: 'text-red-400' },
          { label: 'Auto-Remediated', value: autoRemCount, icon: RefreshCcw, color: 'text-cyan-400' },
          { label: 'Total Events (24h)', value: events.length, icon: Eye, color: 'text-gold' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="p-4 rounded-xl border group hover:transition-all glass-panel"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="h-3.5 w-3.5 text-gold/50" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">{stat.label}</span>
            </div>
            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all' as const, label: 'All Events', count: events.length },
          { key: 'unresolved' as const, label: 'Unresolved', count: unresolvedCount },
          { key: 'resolved' as const, label: 'Resolved', count: events.filter(e => e.resolved).length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${
              filter === tab.key
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'border-gold/10 bg-[#0f1428]/30 text-white/40 hover:border-gold/25'
            }`}
          >
            {tab.label}
            <span className="text-[9px] opacity-60">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Drift Events List */}
      <div className="space-y-3">
        {filtered.map((event, i) => {
          const colors = getSeverityConfig(event.severity);
          const AssetIcon = getAssetIcon(event.assetType);
          const isExpanded = expandedId === event.id;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`rounded-xl border transition-all overflow-hidden ${
                event.resolved
                  ? 'border-green-500/15 bg-green-500/[0.02]'
                  : `${colors.border} ${colors.bg}`
              }`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : event.id)}
                className="w-full text-left p-4 flex items-center gap-4 group"
              >
                <div className="shrink-0">
                  {event.resolved ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  ) : (
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center border ${colors.border}`}>
                      <span className={`h-2 w-2 rounded-full ${colors.dot} ${event.severity === 'critical' ? 'animate-pulse' : ''}`} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <AssetIcon className="h-3.5 w-3.5 text-gold/40" />
                    <span className="text-sm font-bold text-white/80">{event.asset}</span>
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${colors.border} ${colors.bg} ${colors.text}`}>
                      {event.severity}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-gold/15 bg-gold/5 text-gold/60">
                      {getDriftTypeLabel(event.driftType)}
                    </span>
                    {event.autoRemediated && (
                      <span className="text-[9px] font-bold text-cyan-400 flex items-center gap-1">
                        <RefreshCcw className="h-3 w-3" /> Auto-fixed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 truncate">{event.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-mono text-white/25">{event.timestamp}</span>
                  <ChevronRight className={`h-4 w-4 text-white/20 transition-transform ${isExpanded ? 'rotate-90 text-gold' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="border-t px-4 py-4 glass-panel"
                >
                  <div className="grid lg:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg border border-gold/10 bg-white/[0.02]">
                      <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-1">Expected State</div>
                      <div className="text-xs font-mono text-green-400/70">{event.expected}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-gold/10 bg-white/[0.02]">
                      <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-1">Actual State</div>
                      <div className="text-xs font-mono text-red-400/70">{event.actual}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-gold/10 bg-white/[0.02] flex items-center justify-center">
                      {!event.resolved ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleResolve(event.id); }}
                          className="py-2 px-4 rounded-lg border border-gold/30 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-[0.15em] hover:bg-gold/20 transition-colors flex items-center gap-2"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Mark Resolved
                        </button>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-wider text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
