import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle2, Circle, ArrowRight,
  AlertTriangle, Milestone, Flag, Zap, Timer
} from 'lucide-react';

type TimelineEvent = {
  id: string;
  date: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'upcoming' | 'overdue';
  category: 'discovery' | 'migration' | 'validation' | 'compliance' | 'deployment';
  impact: 'critical' | 'high' | 'medium' | 'low';
  assetsAffected: number;
};

const TIMELINE_EVENTS: TimelineEvent[] = [
  { id: 't1', date: '2026-03-15', title: 'Initial CBOM Discovery Scan', description: 'Full enterprise-wide cryptographic inventory completed. 847 assets scanned.', status: 'completed', category: 'discovery', impact: 'critical', assetsAffected: 847 },
  { id: 't2', date: '2026-03-22', title: 'Quantum Risk Assessment', description: 'All RSA-2048 and ECDSA instances flagged for quantum vulnerability.', status: 'completed', category: 'discovery', impact: 'critical', assetsAffected: 234 },
  { id: 't3', date: '2026-04-01', title: 'Phase 1: Auth Service Migration', description: 'JWT signing migrated from RS256 to ML-DSA-44 with hybrid mode.', status: 'completed', category: 'migration', impact: 'high', assetsAffected: 12 },
  { id: 't4', date: '2026-04-10', title: 'TLS Certificate Rotation', description: 'Production TLS certificates upgraded to ML-DSA-65 hybrid certificates.', status: 'completed', category: 'migration', impact: 'critical', assetsAffected: 6 },
  { id: 't5', date: '2026-04-20', title: 'Hybrid Mode Validation', description: 'All hybrid PQC/classical connections validated with zero compatibility issues.', status: 'completed', category: 'validation', impact: 'high', assetsAffected: 18 },
  { id: 't6', date: '2026-05-01', title: 'Phase 2: Payment Service Migration', description: 'Payment encryption migrating from RSA-4096 to ML-KEM-1024.', status: 'in-progress', category: 'migration', impact: 'critical', assetsAffected: 8 },
  { id: 't7', date: '2026-05-09', title: 'Session Store AES Upgrade', description: 'Session encryption upgrading from AES-128 to AES-256-GCM.', status: 'in-progress', category: 'migration', impact: 'medium', assetsAffected: 4 },
  { id: 't8', date: '2026-05-20', title: 'SSH Key Infrastructure Update', description: 'Replace all DH-2048 SSH key exchange with ML-KEM-768.', status: 'upcoming', category: 'migration', impact: 'high', assetsAffected: 23 },
  { id: 't9', date: '2026-06-01', title: 'IoT Fleet Firmware Update', description: 'Push PQC-enabled firmware to all IoT sensor endpoints.', status: 'upcoming', category: 'deployment', impact: 'medium', assetsAffected: 142 },
  { id: 't10', date: '2026-06-15', title: 'NIST FIPS 203/204 Compliance Audit', description: 'Full compliance verification against NIST PQC standards.', status: 'upcoming', category: 'compliance', impact: 'critical', assetsAffected: 847 },
  { id: 't11', date: '2026-07-01', title: 'Legacy RSA Deprecation', description: 'Complete removal of all classical RSA usage from production.', status: 'upcoming', category: 'deployment', impact: 'critical', assetsAffected: 47 },
  { id: 't12', date: '2026-04-08', title: 'SHA-1 Elimination', description: 'Legacy SHA-1 checksum usage was scheduled for removal.', status: 'overdue', category: 'migration', impact: 'medium', assetsAffected: 3 },
];

function getStatusStyles(status: string) {
  switch (status) {
    case 'completed': return { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', icon: CheckCircle2 };
    case 'in-progress': return { color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30', icon: Timer };
    case 'upcoming': return { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: Circle };
    case 'overdue': return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertTriangle };
    default: return { color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', icon: Circle };
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'discovery': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    case 'migration': return 'text-gold border-gold/30 bg-gold/10';
    case 'validation': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    case 'compliance': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
    case 'deployment': return 'text-green-400 border-green-500/30 bg-green-500/10';
    default: return 'text-white/40 border-white/10 bg-white/5';
  }
}

export default function MigrationTimeline() {
  const [filter, setFilter] = useState<string | null>(null);
  const [now] = useState(new Date());

  const sorted = [...TIMELINE_EVENTS]
    .filter(e => !filter || e.status === filter)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const completedCount = TIMELINE_EVENTS.filter(e => e.status === 'completed').length;
  const totalCount = TIMELINE_EVENTS.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Migration <span className="text-gold">Timeline</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Chronological roadmap of your PQC migration journey with milestone tracking.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.15em] flex items-center gap-2">
            <Flag className="h-3 w-3" />
            {completedCount}/{totalCount} Milestones
          </div>
        </div>
      </header>

      {/* Progress overview */}
      <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Timeline Progress</span>
          <span className="text-lg font-black text-gold">{progressPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden relative">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-green-500 via-gold to-cyan-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {[
            { label: 'Completed', count: TIMELINE_EVENTS.filter(e => e.status === 'completed').length, color: 'text-green-400', filter: 'completed' },
            { label: 'In Progress', count: TIMELINE_EVENTS.filter(e => e.status === 'in-progress').length, color: 'text-gold', filter: 'in-progress' },
            { label: 'Upcoming', count: TIMELINE_EVENTS.filter(e => e.status === 'upcoming').length, color: 'text-cyan-400', filter: 'upcoming' },
            { label: 'Overdue', count: TIMELINE_EVENTS.filter(e => e.status === 'overdue').length, color: 'text-red-400', filter: 'overdue' },
          ].map(f => (
            <button
              key={f.label}
              onClick={() => setFilter(filter === f.filter ? null : f.filter)}
              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all ${
                filter === f.filter
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-white/8 text-white/40 hover:border-white/20'
              }`}
            >
              <span className={f.color}>{f.count}</span>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 lg:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-gold/30 via-gold/10 to-transparent" />

        <div className="space-y-6">
          {sorted.map((event, idx) => {
            const styles = getStatusStyles(event.status);
            const StatusIcon = styles.icon;
            const isLeft = idx % 2 === 0;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className={`relative flex items-start gap-4 ${
                  isLeft ? 'lg:flex-row' : 'lg:flex-row-reverse'
                } lg:gap-8`}
              >
                {/* Timeline dot */}
                <div className="absolute left-6 lg:left-1/2 -translate-x-1/2 z-10">
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${styles.border} ${styles.bg}`}>
                    <StatusIcon className={`h-2.5 w-2.5 ${styles.color}`} />
                  </div>
                </div>

                {/* Content card */}
                <div className={`ml-14 lg:ml-0 lg:w-[calc(50%-2rem)] ${isLeft ? '' : 'lg:ml-auto'}`}>
                  <div className={`p-5 rounded-xl border ${styles.border} bg-[#0f1428]/50 backdrop-blur-xl hover:bg-white/[0.02] transition-colors group relative overflow-hidden`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${event.status === 'in-progress' ? 'from-gold/[0.04]' : 'from-transparent'} to-transparent pointer-events-none`} />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-[10px] font-mono text-white/30 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {event.date}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${getCategoryColor(event.category)}`}>
                          {event.category}
                        </span>
                        <span className={`text-[9px] font-black uppercase tracking-wider ${styles.color}`}>
                          {event.status.replace('-', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white group-hover:text-gold transition-colors">{event.title}</h3>
                      <p className="text-xs text-white/40 mt-1 leading-relaxed">{event.description}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-[10px] text-white/30 font-bold flex items-center gap-1">
                          <Zap className="h-3 w-3 text-gold/40" />
                          {event.assetsAffected} assets
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
