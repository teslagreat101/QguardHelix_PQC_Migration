import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Pause, RotateCcw, Terminal, CheckCircle2, XCircle,
  Clock, ArrowRight, Activity, Zap, Server, Radio, Loader2
} from 'lucide-react';

type MigrationJob = {
  id: string;
  asset: string;
  fromAlgo: string;
  toAlgo: string;
  status: 'running' | 'completed' | 'failed' | 'queued' | 'paused';
  progress: number;
  startTime: string;
  logs: string[];
  eta: string;
};

const INITIAL_JOBS: MigrationJob[] = [
  {
    id: 'job-001', asset: 'api-gateway-prod', fromAlgo: 'RSA-2048', toAlgo: 'ML-KEM-768',
    status: 'running', progress: 67, startTime: '14:22:01', eta: '~4m',
    logs: [
      '[14:22:01] Initiating key pair generation (ML-KEM-768)...',
      '[14:22:03] QRNG entropy source connected. Entropy: 99.7%',
      '[14:22:04] Key encapsulation module loaded (liboqs v0.9.2)',
      '[14:22:08] Generating hybrid certificate (RSA-2048 + ML-KEM-768)...',
      '[14:22:15] Certificate signing request submitted to PQC-CA',
      '[14:22:22] Hybrid TLS handshake test: PASS',
      '[14:25:44] Deploying to production loadbalancer...',
    ]
  },
  {
    id: 'job-002', asset: 'auth-jwt-signing', fromAlgo: 'RS256', toAlgo: 'ML-DSA-44',
    status: 'running', progress: 34, startTime: '14:28:12', eta: '~8m',
    logs: [
      '[14:28:12] Scanning JWT signing endpoints...',
      '[14:28:14] Found 12 RS256 signing instances',
      '[14:28:18] Generating ML-DSA-44 signing key pair...',
      '[14:28:22] Configuring hybrid JWT mode (RS256 + ML-DSA-44)...',
    ]
  },
  {
    id: 'job-003', asset: 'payment-encryption', fromAlgo: 'RSA-4096', toAlgo: 'ML-KEM-1024',
    status: 'completed', progress: 100, startTime: '13:45:00', eta: 'Done',
    logs: [
      '[13:45:00] Migration initiated for payment-encryption',
      '[13:52:33] ML-KEM-1024 key pair generated successfully',
      '[13:55:18] All 8 payment endpoints migrated',
      '[13:58:42] Rollback snapshot verified',
      '[14:01:15] Migration COMPLETE. Zero errors.',
    ]
  },
  {
    id: 'job-004', asset: 'session-store-redis', fromAlgo: 'AES-128', toAlgo: 'AES-256-GCM',
    status: 'failed', progress: 42, startTime: '14:10:00', eta: 'Failed',
    logs: [
      '[14:10:00] Initiating symmetric key upgrade...',
      '[14:10:03] Current key: AES-128-CBC',
      '[14:10:08] Generating AES-256-GCM key...',
      '[14:10:15] ERROR: Redis cluster node redis-03 unreachable',
      '[14:10:16] Migration FAILED. Rollback initiated.',
      '[14:10:18] Rollback SUCCESSFUL. Original AES-128 restored.',
    ]
  },
  {
    id: 'job-005', asset: 'vpn-tunnel-01', fromAlgo: 'DH-2048', toAlgo: 'ML-KEM-768',
    status: 'queued', progress: 0, startTime: '—', eta: 'Queued',
    logs: ['[Queued] Waiting for job-001 to complete...']
  },
  {
    id: 'job-006', asset: 'cdn-tls-cert', fromAlgo: 'ECDSA-P384', toAlgo: 'ML-DSA-87',
    status: 'paused', progress: 22, startTime: '14:05:00', eta: 'Paused',
    logs: [
      '[14:05:00] Certificate rotation initiated',
      '[14:05:12] Awaiting manual approval for CDN propagation...',
      '[14:05:12] PAUSED by operator.',
    ]
  },
];

function getJobStatusConfig(status: string) {
  switch (status) {
    case 'running': return { color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30', icon: Loader2, iconClass: 'animate-spin' };
    case 'completed': return { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', icon: CheckCircle2, iconClass: '' };
    case 'failed': return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircle, iconClass: '' };
    case 'queued': return { color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', icon: Clock, iconClass: '' };
    case 'paused': return { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: Pause, iconClass: '' };
    default: return { color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', icon: Clock, iconClass: '' };
  }
}

export default function LiveMigrationOperations() {
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [selectedJobId, setSelectedJobId] = useState<string>('job-001');
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Simulate progress updates
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prev => prev.map(job => {
        if (job.status === 'running' && job.progress < 100) {
          const newProgress = Math.min(100, job.progress + Math.random() * 2);
          const newLogs = [...job.logs];
          if (Math.random() > 0.7) {
            const time = new Date().toLocaleTimeString('en-US', { hour12: false });
            newLogs.push(`[${time}] Processing... ${Math.round(newProgress)}% complete`);
          }
          return { ...job, progress: newProgress, logs: newLogs };
        }
        return job;
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const runningCount = jobs.filter(j => j.status === 'running').length;
  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Live Migration <span className="text-gold">Operations</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Real-time PQC migration job monitoring, logs, and rollback management.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.15em] flex items-center gap-2">
            <Activity className="h-3 w-3 animate-pulse" />
            {runningCount} Jobs Running
          </div>
        </div>
      </header>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Running', value: runningCount, color: 'text-gold', icon: Loader2, iconClass: 'animate-spin' },
          { label: 'Completed', value: completedCount, color: 'text-green-400', icon: CheckCircle2, iconClass: '' },
          { label: 'Failed', value: failedCount, color: 'text-red-400', icon: XCircle, iconClass: '' },
          { label: 'Total', value: jobs.length, color: 'text-white', icon: Server, iconClass: '' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border glass-panel">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`h-3.5 w-3.5 text-gold/50 ${s.iconClass}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">{s.label}</span>
            </div>
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Job List */}
        <div className="lg:col-span-2 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {jobs.map((job, i) => {
            const cfg = getJobStatusConfig(job.status);
            const StatusIcon = cfg.icon;
            const isSelected = selectedJobId === job.id;

            return (
              <motion.button
                key={job.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedJobId(job.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden ${
                  isSelected
                    ? `${cfg.bg} ${cfg.border} shadow-lg`
                    : 'border-gold/8 bg-[#0f1428]/30 hover:border-gold/20'
                }`}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold rounded-r" />}
                <div className="flex items-center gap-3">
                  <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.color} ${cfg.iconClass}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-white/80 truncate">{job.asset}</span>
                      <span className={`text-[9px] font-black uppercase ${cfg.color}`}>{job.status}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-white/30 font-mono">
                      <span>{job.fromAlgo}</span>
                      <ArrowRight className="h-3 w-3 text-gold/40" />
                      <span className="text-gold/60">{job.toAlgo}</span>
                    </div>
                    {job.status === 'running' && (
                      <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-gold to-yellow-300 transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Job Details + Terminal */}
        <div className="lg:col-span-3 space-y-4">
          {selectedJob && (
            <>
              {/* Job Info */}
              <div className="rounded-xl border p-5 glass-panel">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-black text-white">{selectedJob.asset}</h3>
                    <div className="text-[10px] text-white/30 font-mono mt-1">
                      {selectedJob.fromAlgo} → {selectedJob.toAlgo}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selectedJob.status === 'running' && (
                      <button className="p-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors">
                        <Pause className="h-4 w-4" />
                      </button>
                    )}
                    {selectedJob.status === 'failed' && (
                      <button className="p-2 rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 transition-colors">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                    {selectedJob.status === 'paused' && (
                      <button className="p-2 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02] text-center">
                    <div className="text-lg font-black text-gold">{Math.round(selectedJob.progress)}%</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/25 font-bold">Progress</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02] text-center">
                    <div className="text-lg font-black text-white">{selectedJob.startTime}</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/25 font-bold">Started</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02] text-center">
                    <div className="text-lg font-black text-cyan-400">{selectedJob.eta}</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/25 font-bold">ETA</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02] text-center">
                    <div className="text-lg font-black text-white">{selectedJob.logs.length}</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/25 font-bold">Log Lines</div>
                  </div>
                </div>
              </div>

              {/* Terminal Output */}
              <div className="rounded-xl border overflow-hidden glass-panel">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gold/10 bg-gold/[0.03]">
                  <Terminal className="h-3.5 w-3.5 text-gold/50" />
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">Migration Log — {selectedJob.asset}</span>
                  <div className="ml-auto flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                  </div>
                </div>
                <div className="p-4 max-h-[300px] overflow-y-auto font-mono text-xs space-y-1">
                  {selectedJob.logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`leading-relaxed ${
                        log.includes('ERROR') || log.includes('FAILED') ? 'text-red-400' :
                        log.includes('PASS') || log.includes('COMPLETE') || log.includes('SUCCESSFUL') ? 'text-green-400' :
                        log.includes('PAUSED') ? 'text-yellow-400' :
                        'text-white/50'
                      }`}
                    >
                      {log}
                    </motion.div>
                  ))}
                  {selectedJob.status === 'running' && (
                    <div className="text-gold/50 animate-pulse">█</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
