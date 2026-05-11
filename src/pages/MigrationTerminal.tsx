import { useEffect, useState, useRef } from 'react';
import { Terminal as TerminalIcon, Play, Square, RotateCcw, ShieldCheck, Cpu, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export default function MigrationTerminal() {
  const [logs, setLogs] = useState<any[]>([]);
  const [activeMigration, setActiveMigration] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    // Subscribe to migration logs in realtime
    const channel = supabase.channel('migration-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'migration_logs' }, (payload) => {
        setLogs(prev => [...prev, payload.new]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'migrations' }, (payload) => {
        if (activeMigration && payload.new.id === activeMigration.id) {
          setActiveMigration(payload.new);
          if (payload.new.status !== 'IN_PROGRESS') setIsRunning(false);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeMigration]);

  const startMigration = async () => {
    // In a real scenario, this would call a backend function or worker
    // For this implementation, we'll simulate the "autopilot" sequence 
    // by creating a migration record and adding logs to Supabase
    setIsRunning(true);
    setLogs([]);
    
    // 1. Create Migration Record
    const { data: migration, error } = await supabase
      .from('migrations')
      .insert({
        target_algorithm: 'ML-KEM-768 + X25519 Hybrid',
        strategy: 'Parallel Canary Rollout',
        status: 'IN_PROGRESS',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting migration:', error);
      setIsRunning(false);
      return;
    }

    setActiveMigration(migration);

    // Simulated Step Function (would be a real worker in production)
    const addLog = async (msg: string, level = 'INFO', details = {}) => {
      await supabase.from('migration_logs').insert({
        migration_id: migration.id,
        message: msg,
        level,
        details,
        timestamp: new Date().toISOString()
      });
    };

    const steps = [
      { msg: 'Initializing Qguard Helix PQC Autopilot Engine...', level: 'INFO' },
      { msg: 'Target: Legacy RSA-2048 Cryptographic Assets', level: 'INFO' },
      { msg: 'Fetching security policy from NIST Compliance Framework...', level: 'INFO' },
      { msg: 'Generating ephemeral ML-KEM-768 key pairs...', level: 'KEYGEN' },
      { msg: 'Successfully generated 256-bit entropy source from QRNG', level: 'SUCCESS' },
      { msg: 'Initiating Hybrid Key Exchange (X25519 + ML-KEM)...', level: 'INFO' },
      { msg: 'Validating TLS Handshake compatibility with Edge Nodes...', level: 'VALIDATE' },
      { msg: 'Interoperability test PASSED for 98% of clients', level: 'SUCCESS' },
      { msg: 'Injecting Post-Quantum Certificates into Vault...', level: 'INFO' },
      { msg: 'Updating Load Balancer configuration (NGINX/Envoy)...', level: 'DEPLOY' },
      { msg: 'Traffic migration: 10% Canary rollout successful', level: 'INFO' },
      { msg: 'Observing Handshake Latency: +4.2ms (Within Tolerable Limits)', level: 'METRIC' },
      { msg: 'Finalizing PQC cutover for production-gateway-01', level: 'INFO' },
      { msg: 'MIGRATION SUCCESSFUL: Asset is now Quantum-Safe', level: 'SUCCESS' }
    ];

    for (let i = 0; i < steps.length; i++) {
      if (!isRunning) break;
      await addLog(steps[i].msg, steps[i].level);
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 1000));
    }

    if (isRunning) {
      await supabase.from('migrations').update({ 
        status: 'COMPLETED', 
        completed_at: new Date().toISOString() 
      }).eq('id', migration.id);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Migration <span className="text-gold">Terminal</span></h1>
          <p className="text-white/50 mt-1">Real-time PQC orchestration and execution telemetry.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={startMigration}
            disabled={isRunning}
            className={`px-6 py-2 rounded-lg font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
              isRunning ? 'bg-gold/5 text-gold/30 border border-gold/10' : 'bg-gold text-black hover:bg-gold/80 shadow-[0_0_20px_rgba(212,175,55,0.4)]'
            }`}
          >
            <Play className="h-4 w-4 fill-current" />
            Launch Autopilot
          </button>
          <button 
            onClick={() => setIsRunning(false)}
            className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors flex items-center gap-2"
          >
            <Square className="h-4 w-4 fill-current" />
            Emergency Stop
          </button>
        </div>
      </header>

      {/* Terminal UI */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 border border-gold/20 bg-black/60 rounded-xl overflow-hidden flex flex-col shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative">
          <div className="bg-gold/5 border-b border-gold/20 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TerminalIcon className="h-4 w-4 text-gold" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gold/80">qguard-helix-pqc-engine v1.0.4 --autopilot</span>
            </div>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
              <div className="w-2 h-2 rounded-full bg-green-500/50" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-1 custom-scrollbar">
            {logs.length === 0 && !isRunning && (
              <div className="h-full flex items-center justify-center text-white/20 uppercase tracking-[0.4em] font-black text-xs">
                System Ready. Awaiting Command.
              </div>
            )}
            {logs.map((log, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={i} 
                className="flex gap-4 group"
              >
                <span className="text-white/20 select-none w-20 shrink-0 text-xs">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}]</span>
                <span className={`font-bold shrink-0 min-w-[80px] ${
                  log.level === 'SUCCESS' ? 'text-green-500' : 
                  log.level === 'CRITICAL' ? 'text-red-500' : 
                  log.level === 'KEYGEN' ? 'text-gold' : 
                  log.level === 'VALIDATE' ? 'text-blue-400' : 
                  log.level === 'DEPLOY' ? 'text-purple-400' : 'text-white/50'
                }`}>
                  {log.level.padEnd(8)}
                </span>
                <span className="text-white/80 group-hover:text-white transition-colors">
                   {log.message}
                   {log.level === 'SUCCESS' && <ShieldCheck className="inline ml-2 h-3 w-3 text-green-500" />}
                </span>
              </motion.div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          {/* Scanning Line Effect */}
          {isRunning && (
            <motion.div 
              animate={{ top: ['0%', '100%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute left-0 right-0 h-10 bg-gold/5 border-t border-gold/10 z-20 pointer-events-none blur-sm"
            />
          )}
        </div>

        {/* Status Panel */}
        <div className="space-y-6">
          <div className="border border-gold/20 bg-black/40 rounded-xl p-5 space-y-4">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Operation Status</h3>
             <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/60">Status:</span>
                  <span className={`text-xs font-black uppercase tracking-widest ${isRunning ? 'text-gold animate-pulse' : 'text-white/30'}`}>
                    {activeMigration ? activeMigration.status : 'IDLE'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-white/40">Migration Progress</span>
                    <span className="text-gold">
                      {isRunning ? '62%' : activeMigration?.status === 'COMPLETED' ? '100%' : '0%'}
                    </span>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gold"
                      initial={{ width: 0 }}
                      animate={{ width: isRunning ? '62%' : activeMigration?.status === 'COMPLETED' ? '100%' : '0%' }}
                    />
                  </div>
                </div>
             </div>
          </div>

          <div className="border border-gold/20 bg-black/40 rounded-xl p-5 space-y-4">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Encryption Engine</h3>
             <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gold/5 border border-gold/10 rounded flex flex-col items-center text-center">
                   <Key className="h-5 w-5 text-gold mb-2" />
                   <div className="text-[8px] font-black text-white/40 uppercase">KEM</div>
                   <div className="text-[10px] font-bold text-white">ML-KEM-768</div>
                </div>
                <div className="p-3 bg-gold/5 border border-gold/10 rounded flex flex-col items-center text-center">
                   <Cpu className="h-5 w-5 text-gold mb-2" />
                   <div className="text-[8px] font-black text-white/40 uppercase">Entropy</div>
                   <div className="text-[10px] font-bold text-white">QRNG High</div>
                </div>
             </div>
          </div>

          <div className="flex-1 border border-gold/20 bg-black/40 rounded-xl p-5">
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-4">Rollback Snapshots</h3>
             <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 border border-white/5 bg-white/5 rounded">
                   <RotateCcw className="h-3 w-3 text-white/40" />
                   <div className="text-[9px] font-bold uppercase text-white/60">SNAP_2026_05_08_1230</div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
