import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map, ChevronRight, AlertTriangle, Shield, Check, Clock,
  ArrowRight, GitBranch, Layers, Settings2, Zap, Target
} from 'lucide-react';

type MigrationPhase = {
  id: string;
  name: string;
  status: 'completed' | 'in-progress' | 'pending' | 'blocked';
  progress: number;
  tasks: number;
  completedTasks: number;
  eta: string;
  dependencies: string[];
};

const MIGRATION_PHASES: MigrationPhase[] = [
  { id: 'discovery', name: 'Asset Discovery & CBOM Generation', status: 'completed', progress: 100, tasks: 12, completedTasks: 12, eta: 'Complete', dependencies: [] },
  { id: 'assessment', name: 'Quantum Vulnerability Assessment', status: 'completed', progress: 100, tasks: 8, completedTasks: 8, eta: 'Complete', dependencies: ['discovery'] },
  { id: 'prioritization', name: 'Risk Prioritization & Scoring', status: 'in-progress', progress: 73, tasks: 6, completedTasks: 4, eta: '2h 15m', dependencies: ['assessment'] },
  { id: 'algorithm', name: 'Algorithm Selection (ML-KEM/ML-DSA)', status: 'in-progress', progress: 45, tasks: 10, completedTasks: 4, eta: '6h 30m', dependencies: ['prioritization'] },
  { id: 'testing', name: 'Hybrid Mode Testing & Validation', status: 'pending', progress: 0, tasks: 15, completedTasks: 0, eta: '—', dependencies: ['algorithm'] },
  { id: 'deployment', name: 'Production PQC Deployment', status: 'pending', progress: 0, tasks: 8, completedTasks: 0, eta: '—', dependencies: ['testing'] },
  { id: 'monitoring', name: 'Post-Migration Monitoring', status: 'pending', progress: 0, tasks: 5, completedTasks: 0, eta: '—', dependencies: ['deployment'] },
  { id: 'compliance', name: 'NIST FIPS 203/204 Compliance Audit', status: 'blocked', progress: 0, tasks: 4, completedTasks: 0, eta: 'Blocked', dependencies: ['deployment'] },
];

const MIGRATION_QUEUE = [
  { asset: 'api-gateway-prod', algo: 'RSA-2048 → ML-KEM-768', priority: 'CRITICAL', status: 'Queued' },
  { asset: 'auth-service-main', algo: 'ECDSA-P256 → ML-DSA-65', priority: 'HIGH', status: 'Queued' },
  { asset: 'payment-processor', algo: 'RSA-4096 → ML-KEM-1024', priority: 'HIGH', status: 'Scheduled' },
  { asset: 'session-store-redis', algo: 'AES-128 → AES-256', priority: 'MEDIUM', status: 'Scheduled' },
  { asset: 'cdn-tls-cert', algo: 'ECDSA-P384 → ML-DSA-87', priority: 'MEDIUM', status: 'Pending' },
  { asset: 'vpn-tunnel-01', algo: 'DH-2048 → ML-KEM-768', priority: 'LOW', status: 'Pending' },
];

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', dot: 'bg-green-500' };
    case 'in-progress': return { bg: 'bg-gold/10', border: 'border-gold/30', text: 'text-gold', dot: 'bg-gold' };
    case 'pending': return { bg: 'bg-white/5', border: 'border-white/10', text: 'text-white/40', dot: 'bg-white/30' };
    case 'blocked': return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-500' };
    default: return { bg: 'bg-white/5', border: 'border-white/10', text: 'text-white/40', dot: 'bg-white/30' };
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'CRITICAL': return 'text-red-400 border-red-500/30 bg-red-500/10';
    case 'HIGH': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    case 'MEDIUM': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    case 'LOW': return 'text-green-400 border-green-500/30 bg-green-500/10';
    default: return 'text-white/40 border-white/10 bg-white/5';
  }
}

export default function MigrationPlanner() {
  const [selectedPhase, setSelectedPhase] = useState<string | null>('prioritization');
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    const total = MIGRATION_PHASES.reduce((a, p) => a + p.tasks, 0);
    const completed = MIGRATION_PHASES.reduce((a, p) => a + p.completedTasks, 0);
    const target = Math.round((completed / total) * 100);
    const timer = setTimeout(() => setOverallProgress(target), 300);
    return () => clearTimeout(timer);
  }, []);

  const selected = MIGRATION_PHASES.find(p => p.id === selectedPhase);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Migration <span className="text-gold">Planner</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Strategic PQC migration roadmap with dependency tracking and intelligent scheduling.</p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.15em] flex items-center gap-2">
            <GitBranch className="h-3 w-3" />
            Phase 3/8 Active
          </div>
        </div>
      </header>

      {/* Overall Progress Bar */}
      <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Overall Migration Progress</span>
          <span className="text-lg font-black text-gold">{overallProgress}%</span>
        </div>
        <div className="h-3 rounded-full bg-white/[0.06] overflow-hidden relative">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-gold via-yellow-300 to-gold relative"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[shimmer_2s_infinite]" />
          </motion.div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-4">
          {[
            { label: 'Completed', count: MIGRATION_PHASES.filter(p => p.status === 'completed').length, color: 'text-green-400' },
            { label: 'In Progress', count: MIGRATION_PHASES.filter(p => p.status === 'in-progress').length, color: 'text-gold' },
            { label: 'Pending', count: MIGRATION_PHASES.filter(p => p.status === 'pending').length, color: 'text-white/40' },
            { label: 'Blocked', count: MIGRATION_PHASES.filter(p => p.status === 'blocked').length, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-xl font-black ${s.color}`}>{s.count}</div>
              <div className="text-[9px] uppercase tracking-wider text-white/30 font-bold">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Phase Timeline */}
        <div className="lg:col-span-3 space-y-3">
          {MIGRATION_PHASES.map((phase, idx) => {
            const colors = getStatusColor(phase.status);
            const isSelected = selectedPhase === phase.id;

            return (
              <motion.button
                key={phase.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06 }}
                onClick={() => setSelectedPhase(phase.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 group relative overflow-hidden ${
                  isSelected
                    ? `${colors.bg} ${colors.border} shadow-lg`
                    : 'border-gold/8 bg-[#0f1428]/30 hover:border-gold/20 hover:bg-white/[0.02]'
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold rounded-r" />
                )}
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1 shrink-0 w-10">
                    <div className={`h-8 w-8 rounded-lg border flex items-center justify-center text-xs font-black ${colors.border} ${colors.bg}`}>
                      {phase.status === 'completed' ? (
                        <Check className={`h-4 w-4 ${colors.text}`} />
                      ) : (
                        <span className={colors.text}>{idx + 1}</span>
                      )}
                    </div>
                    {idx < MIGRATION_PHASES.length - 1 && (
                      <div className="h-4 w-px bg-gold/15" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-white/70'}`}>
                        {phase.name}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${colors.border} ${colors.bg} ${colors.text}`}>
                        {phase.status.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            phase.status === 'completed' ? 'bg-green-500' :
                            phase.status === 'in-progress' ? 'bg-gradient-to-r from-gold to-yellow-300' :
                            'bg-white/10'
                          }`}
                          style={{ width: `${phase.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/30 font-mono shrink-0">
                        {phase.completedTasks}/{phase.tasks} tasks
                      </span>
                      <span className="text-[10px] text-white/30 font-mono shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {phase.eta}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'text-gold rotate-90' : 'text-white/20'}`} />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Details Panel + Migration Queue */}
        <div className="lg:col-span-2 space-y-6">
          {/* Selected Phase Details */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-6 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(212,175,55,0.06),transparent_50%)]" />
                <div className="relative z-10">
                  <h3 className="text-lg font-black text-white mb-1">{selected.name}</h3>
                  <div className={`text-[10px] font-black uppercase tracking-[0.15em] ${getStatusColor(selected.status).text} mb-4`}>
                    {selected.status.replace('-', ' ')}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg border border-gold/10 bg-white/[0.02]">
                      <div className="text-xl font-black text-gold">{selected.progress}%</div>
                      <div className="text-[9px] uppercase tracking-wider text-white/30 font-bold">Progress</div>
                    </div>
                    <div className="p-3 rounded-lg border border-gold/10 bg-white/[0.02]">
                      <div className="text-xl font-black text-white">{selected.completedTasks}/{selected.tasks}</div>
                      <div className="text-[9px] uppercase tracking-wider text-white/30 font-bold">Tasks</div>
                    </div>
                  </div>

                  {selected.dependencies.length > 0 && (
                    <div className="mb-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-2">Dependencies</div>
                      <div className="flex flex-wrap gap-2">
                        {selected.dependencies.map(dep => (
                          <span key={dep} className="text-[10px] px-2 py-1 rounded border border-gold/20 bg-gold/5 text-gold/70 font-bold">
                            {MIGRATION_PHASES.find(p => p.id === dep)?.name || dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button className="w-full mt-2 py-2.5 rounded-lg border border-gold/30 bg-gold/10 text-gold text-xs font-black uppercase tracking-[0.15em] hover:bg-gold/20 transition-colors flex items-center justify-center gap-2">
                    <Settings2 className="h-3.5 w-3.5" />
                    Configure Phase
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Migration Queue */}
          <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-6 relative overflow-hidden">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-4">
              <Layers className="h-3.5 w-3.5 inline mr-2 text-gold/60" />
              Migration Queue
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {MIGRATION_QUEUE.map((item, i) => (
                <motion.div
                  key={item.asset}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-3 rounded-lg border border-gold/8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white/80 group-hover:text-white transition-colors">{item.asset}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getPriorityColor(item.priority)}`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <ArrowRight className="h-3 w-3 text-gold/40" />
                    <span className="font-mono">{item.algo}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
