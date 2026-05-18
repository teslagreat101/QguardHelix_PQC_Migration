import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Activity, Lock, Server, Cpu, Zap, Wifi } from 'lucide-react';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';

export default function ProtocolAnalyticsPage() {
  const telemetry = useRealtimeStream('Protocol Analytics');

  return (
    <div className="min-h-screen bg-[#050816] text-white p-6 relative overflow-hidden font-mono">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(255,211,107,0.08)_0%,transparent_70%)] blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(255,211,107,0.05)_0%,transparent_70%)] blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#FFD36B]/20 pb-6"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-[#FFD36B] drop-shadow-[0_0_15px_rgba(255,211,107,0.4)] flex items-center gap-3">
              <Zap className="w-8 h-8" />
              Protocol Analytics
            </h1>
            <p className="text-[#FFD36B]/60 mt-2 text-sm tracking-wide">
              Analysis of cryptographic protocols and handshakes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg border border-[#FFD36B]/30 bg-[#FFD36B]/10 flex items-center gap-2 backdrop-blur-md">
              <div className={`w-2 h-2 rounded-full ${telemetry.status === 'ACTIVE' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}`}></div>
              <span className="text-xs font-bold text-[#FFD36B] tracking-wider uppercase">
                {telemetry.status === 'ACTIVE' ? 'Stream Active' : 'Connecting SSE...'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visualization Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FFD36B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <Activity className="w-5 h-5 text-[#FFD36B]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFD36B]/60">Latency</span>
                  </div>
                  <div className="text-3xl font-black text-white">{telemetry.latency}<span className="text-sm text-[#FFD36B]/50 ml-1">ms</span></div>
               </div>
               <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FFD36B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <Wifi className="w-5 h-5 text-[#FFD36B]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFD36B]/60">Throughput</span>
                  </div>
                  <div className="text-3xl font-black text-white">{telemetry.throughput}<span className="text-sm text-[#FFD36B]/50 ml-1">ops/s</span></div>
               </div>
               <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/60">Quantum Risk</span>
                  </div>
                  <div className="text-3xl font-black text-red-400">{telemetry.quantumRiskScore}<span className="text-sm text-red-400/50 ml-1">/100</span></div>
               </div>
            </div>

            {/* Live Chart Area */}
            <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-6 h-[320px] flex flex-col">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#FFD36B]/60 mb-6 font-bold flex items-center gap-2">
                <Activity className="w-3 h-3" /> Live Operations Activity
              </h3>
              <div className="flex-1 flex items-end justify-between gap-1 mt-auto">
                {telemetry.metrics.map((m, i) => (
                  <div key={i} className="relative flex-1 group flex justify-center h-full items-end">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${m.value}%` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                      className="w-full max-w-[12px] bg-gradient-to-t from-[#FFD36B]/10 to-[#FFD36B] rounded-t-sm opacity-70 group-hover:opacity-100"
                    />
                    {/* Tooltip */}
                    <div className="absolute -top-8 bg-[#050816] border border-[#FFD36B]/30 px-2 py-1 rounded text-[9px] opacity-0 group-hover:opacity-100 pointer-events-none z-20 transition-opacity whitespace-nowrap shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                      {m.value} ops/s
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Side Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6 flex flex-col h-full"
          >
            {/* System Context */}
            <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#FFD36B]/60 mb-4 font-bold flex items-center gap-2">
                 <Server className="w-3 h-3" /> Infrastructure Context
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#FFD36B]/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#FFD36B]" />
                    <span className="text-xs text-white/80 uppercase tracking-wider">Encryption Protocol</span>
                  </div>
                  <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">{telemetry.encryption}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#FFD36B]/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#FFD36B]" />
                    <span className="text-xs text-white/80 uppercase tracking-wider">Primary Node</span>
                  </div>
                  <span className="text-xs font-mono text-[#FFD36B]">{telemetry.node}</span>
                </div>
              </div>
            </div>

            {/* Audit Log Stream */}
            <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden flex-1 flex flex-col min-h-[300px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD36B]/5 rounded-bl-[100px] border-b border-l border-[#FFD36B]/10 pointer-events-none"></div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#FFD36B]/60 mb-4 font-bold relative z-10 flex items-center justify-between">
                <span>Real-Time Audit Events</span>
                <span className="flex h-2 w-2 relative">
                  {telemetry.status === 'ACTIVE' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD36B] opacity-75"></span>
                  )}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFD36B]"></span>
                </span>
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 relative z-10 scrollbar-thin scrollbar-thumb-[#FFD36B]/20 max-h-[350px]">
                <AnimatePresence>
                  {telemetry.logs.map((log, i) => (
                    <motion.div 
                      key={log.timestamp + i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs space-y-1 border-l-2 pl-2"
                      style={{ borderColor: log.level === 'warn' ? '#fbbf24' : log.level === 'error' ? '#ef4444' : 'rgba(255,211,107,0.3)' }}
                    >
                      <div className="text-[#FFD36B]/50 font-mono text-[9px]">
                        {new Date(log.timestamp).toISOString().split('T')[1].replace('Z', '')}
                      </div>
                      <div className={`${log.level === 'warn' ? 'text-yellow-400/90' : log.level === 'error' ? 'text-red-400/90' : 'text-white/80'}`}>
                        {log.message}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {telemetry.logs.length === 0 && (
                  <div className="text-xs text-white/30 italic text-center mt-10">Waiting for events...</div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}