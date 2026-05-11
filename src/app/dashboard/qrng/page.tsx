'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  ShieldCheck, 
  BarChart3, 
  Database, 
  Activity, 
  Lock, 
  Key, 
  History, 
  Terminal, 
  Settings, 
  ClipboardList, 
  AlertTriangle,
  RefreshCcw,
  Search,
  Download,
  Copy,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Network
} from 'lucide-react';
import { useQuantumQrng } from '@/hooks/quantum/useQuantumQrng';
import QuantumQrngLoading from './loading';

export default function QuantumQrngPage() {
  const { 
    loading, kpis, sources, healthTests, pipeline, 
    history, isGenerating, generateEntropy 
  } = useQuantumQrng();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [genLength, setGenLength] = useState(32);
  const [genPurpose, setGenPurpose] = useState('General Encryption');
  const [genSource, setGenSource] = useState('HW-01');
  const [revealMap, setRevealMap] = useState<Record<string, boolean>>({});

  if (loading) return <QuantumQrngLoading />;

  const toggleReveal = (id: string) => {
    setRevealMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'generator', label: 'Entropy Generator', icon: Zap },
    { id: 'health', label: 'Health Tests', icon: Activity },
    { id: 'pipeline', label: 'KDF Pipeline', icon: Network },
    { id: 'keys', label: 'Keys & Secrets', icon: Key },
    { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
  ];

  return (
    <div className="p-8 space-y-8 pb-20">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
            <span className="text-gold"><Zap className="w-10 h-10" /></span>
            Quantum QRNG
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Quantum-Seeded Entropy Service for Post-Quantum Security. Generate, validate, monitor, and distribute 
            quantum-seeded randomness across QGuard workflows.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Production Mode Active</span>
          </div>
          <button className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-gold/10 hover:border-gold/50 transition-all text-gold">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* KPI Section */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md group hover:border-gold/30 transition-all"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-gold transition-colors">{kpi.label}</p>
            <p className="text-xl font-black text-white mt-1">{kpi.value}</p>
            <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gold/50 w-2/3" />
            </div>
          </motion.div>
        ))}
      </section>

      {/* Main Tabs Navigation */}
      <nav className="flex items-center gap-2 border-b border-white/10 pb-px overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative whitespace-nowrap ${
              activeTab === tab.id 
                ? 'text-gold' 
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTabQrng"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold shadow-[0_0_10px_#D4AF37]" 
              />
            )}
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <main>
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Source Dashboard */}
              <div className="lg:col-span-8 space-y-8">
                <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-white uppercase tracking-wider">Entropy Source Dashboard</h3>
                      <p className="text-sm text-muted-foreground mt-1">Real-time status of entropy providers and health metrics.</p>
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/10 border border-gold/20 text-gold text-xs font-bold uppercase tracking-widest hover:bg-gold/20 transition-all">
                      <RefreshCcw className="w-3 h-3" />
                      Refresh Sources
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          <th className="px-4 py-4">Source</th>
                          <th className="px-4 py-4">Type</th>
                          <th className="px-4 py-4">Mode</th>
                          <th className="px-4 py-4">Health</th>
                          <th className="px-4 py-4">Throughput</th>
                          <th className="px-4 py-4 text-right">Production Safe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {sources.map((source) => (
                          <tr key={source.id} className="group hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-6">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg bg-white/5 border ${source.health === 'passed' ? 'border-gold/20 text-gold' : 'border-red-500/20 text-red-500'}`}>
                                  <Database className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white">{source.name}</p>
                                  <p className="text-[10px] text-muted-foreground font-mono">{source.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-6">
                              <span className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 font-bold uppercase tracking-widest text-white/60">
                                {source.type}
                              </span>
                            </td>
                            <td className="px-4 py-6">
                              <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest ${
                                source.mode === 'production' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                source.mode === 'simulation' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                'bg-white/5 text-muted-foreground border border-white/10'
                              }`}>
                                {source.mode}
                              </span>
                            </td>
                            <td className="px-4 py-6">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  source.health === 'passed' ? 'bg-green-500' :
                                  source.health === 'warning' ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`} />
                                <span className="text-xs font-medium text-white/80 capitalize">{source.health.replace('_', ' ')}</span>
                              </div>
                            </td>
                            <td className="px-4 py-6">
                              <p className="text-sm font-mono text-gold">{source.throughput}</p>
                            </td>
                            <td className="px-4 py-6 text-right">
                              {source.isProductionSafe ? (
                                <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center justify-end gap-1">
                                  <ShieldCheck className="w-3 h-3" /> YES
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center justify-end gap-1">
                                  <AlertTriangle className="w-3 h-3" /> NO
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Audit Logs Preview */}
                <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
                   <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-white uppercase tracking-wider">Recent Generation Events</h3>
                      <p className="text-sm text-muted-foreground mt-1">Audit log of entropy distribution across services.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {history.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 group hover:border-gold/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-gold/10 text-gold border border-gold/20">
                            <Activity className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">QRNG Generation</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground font-mono">{log.id}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">Purpose: {log.purpose} • Source: {log.source}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-gold uppercase tracking-widest">{log.length} BYTES</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(log.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Live Telemetry */}
              <div className="lg:col-span-4 space-y-8">
                <div className="p-6 rounded-3xl bg-gradient-to-br from-cyber-navy/40 to-black border border-white/10 backdrop-blur-xl h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-5 h-5 text-gold animate-pulse" />
                    <h3 className="text-lg font-bold text-white uppercase tracking-wider">Live Telemetry</h3>
                  </div>
                  
                  <div className="flex-grow space-y-4 font-mono text-[11px]">
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-gold/80 h-[400px] overflow-y-auto no-scrollbar space-y-2">
                      <p className="text-muted-foreground">[SYS] Initializing SSE listener...</p>
                      <p className="text-green-500">[CONN] Telemetry stream established.</p>
                      <p className="text-white/60">[EVENT] Source HW-01 ping: 1.2ms</p>
                      <p className="text-white/60">[EVENT] Source API-01 ping: 24.5ms</p>
                      <p className="text-gold">[CMD] Entropy request received for "Cloud Security"</p>
                      <p className="text-white/40">[PIPELINE] RCT Test: PASS (Max Rep: 3)</p>
                      <p className="text-white/40">[PIPELINE] APT Test: PASS (Ratio: 0.0039)</p>
                      <p className="text-blue-400">[KDF] HKDF-SHA3-256 derivation complete.</p>
                      <p className="text-green-500">[AUDIT] Event ID: EV-924-XQ saved.</p>
                      <p className="text-white/60">[EVENT] Pool expansion: +128MB</p>
                      <p className="text-white/60">[EVENT] Source SIM-01 sync: Simulation Mode</p>
                      <div className="w-full h-px bg-gold/10 my-2" />
                      <p className="animate-pulse">_</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Health Profile</p>
                      <div className="space-y-3">
                        {healthTests.slice(0, 3).map((test) => (
                          <div key={test.name} className="flex items-center justify-between">
                            <span className="text-white/70">{test.name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                              test.status === 'passed' ? 'text-green-500 border-green-500/20' : 'text-yellow-500 border-yellow-500/20'
                            }`}>{test.status.toUpperCase()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'generator' && (
            <motion.div
              key="generator"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Side: Generator Controls */}
              <div className="lg:col-span-7 space-y-8">
                <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 text-gold/10">
                    <Zap className="w-32 h-32 rotate-12 group-hover:scale-110 transition-transform duration-1000" />
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-6">Quantum Entropy Generator</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gold">Entropy Source</label>
                          <select 
                            value={genSource}
                            onChange={(e) => setGenSource(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/50 transition-all appearance-none"
                          >
                            {sources.map(s => (
                              <option key={s.id} value={s.id} className="bg-cyber-navy text-white">
                                {s.name} ({s.mode.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gold">Output Length (Bytes)</label>
                          <div className="flex items-center gap-4">
                            <input 
                              type="range" 
                              min="16" 
                              max="128" 
                              step="8" 
                              value={genLength}
                              onChange={(e) => setGenLength(parseInt(e.target.value))}
                              className="flex-grow accent-gold" 
                            />
                            <span className="text-sm font-mono text-white w-8">{genLength}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-gold">Purpose / Binding</label>
                          <input 
                            type="text" 
                            value={genPurpose}
                            onChange={(e) => setGenPurpose(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/50 transition-all"
                            placeholder="e.g. Session Token"
                          />
                        </div>
                      </div>

                      <div className="space-y-6 flex flex-col justify-end">
                        <div className="p-4 rounded-2xl bg-gold/5 border border-gold/10">
                          <p className="text-[10px] font-bold text-gold uppercase tracking-widest mb-2">Security Note</p>
                          <p className="text-[11px] text-white/60 leading-relaxed">
                            Entropy generated via this panel is purpose-bound and audit-logged. Never share raw seeds in plaintext.
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => generateEntropy(genLength, genPurpose, genSource)}
                          disabled={isGenerating}
                          className={`w-full py-4 rounded-xl bg-gold text-cyber-black font-black uppercase tracking-widest shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_40px_rgba(212,175,55,0.5)] hover:scale-[1.02] transition-all flex items-center justify-center gap-3 ${
                            isGenerating ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {isGenerating ? (
                            <>
                              <RefreshCcw className="w-5 h-5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Zap className="w-5 h-5" />
                              Generate Secure Entropy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Visualization */}
                <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-8 flex items-center gap-3">
                    <Network className="w-5 h-5 text-gold" />
                    KDF Pipeline Status
                  </h3>
                  
                  <div className="relative">
                    {/* Connection Line */}
                    <div className="absolute left-[27px] top-4 bottom-4 w-px bg-white/10" />
                    
                    <div className="space-y-8 relative">
                      {pipeline.length > 0 ? (
                        pipeline.map((stage, idx) => (
                          <motion.div 
                            key={stage.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-6 group"
                          >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border-2 z-10 transition-all duration-500 ${
                              stage.status === 'completed' ? 'bg-green-500/10 border-green-500 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' :
                              stage.status === 'active' ? 'bg-gold/10 border-gold text-gold animate-pulse shadow-[0_0_20px_rgba(212,175,55,0.4)]' :
                              'bg-white/5 border-white/10 text-muted-foreground'
                            }`}>
                              {stage.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> :
                               stage.status === 'active' ? <RefreshCcw className="w-6 h-6 animate-spin" /> :
                               <div className="w-2 h-2 rounded-full bg-current" />}
                            </div>
                            <div className="pt-2">
                              <h4 className={`text-sm font-bold uppercase tracking-widest ${
                                stage.status === 'active' ? 'text-gold' : 'text-white'
                              }`}>{stage.name}</h4>
                              <p className="text-xs text-muted-foreground mt-1">{stage.details}</p>
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                          <p className="text-muted-foreground italic">Pipeline idle. Generate entropy to begin derivation.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Generation Result / History */}
              <div className="lg:col-span-5 space-y-8">
                <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-6">Recent Generation</h3>
                  <div className="space-y-4">
                    {history.map((item) => (
                      <div key={item.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 group hover:border-gold/30 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-black text-gold uppercase tracking-[0.2em]">{item.type}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{new Date(item.createdAt).toLocaleTimeString()}</span>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="p-3 rounded-xl bg-black/40 border border-white/5 font-mono text-xs break-all relative group/inner">
                            <p className={`${revealMap[item.id] ? 'text-white' : 'text-white/20 blur-sm'} transition-all duration-300`}>
                              {revealMap[item.id] ? item.fingerprint.repeat(4) : item.maskedPreview}
                            </p>
                            <button 
                              onClick={() => toggleReveal(item.id)}
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-gold hover:bg-gold/10 transition-all opacity-0 group-hover/inner:opacity-100"
                            >
                              {revealMap[item.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Fingerprint</p>
                              <p className="text-xs font-mono text-white mt-1">{item.fingerprint}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">Quality</p>
                              <p className="text-xs font-mono text-gold mt-1">{item.entropyQuality}%</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 pt-2">
                            <button className="flex-grow flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-gold/10 hover:border-gold/50 transition-all">
                              <Copy className="w-3 h-3" /> Copy
                            </button>
                            <button className="flex-grow flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-gold/10 hover:border-gold/50 transition-all">
                              <Download className="w-3 h-3" /> Export
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="py-20 text-center text-muted-foreground italic">No entropy generated in this session.</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'health' && (
             <motion.div
              key="health"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {healthTests.map((test) => (
                  <div key={test.name} className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 group hover:border-gold/30 transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-2 rounded-lg ${
                        test.status === 'passed' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
                      }`}>
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
                        test.status === 'passed' ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                      }`}>{test.status.toUpperCase()}</span>
                    </div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">{test.name}</h4>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Current Value</p>
                        <p className="text-xl font-mono text-white mt-1">{test.result}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Threshold</p>
                        <p className="text-xs font-mono text-muted-foreground mt-1">{test.threshold}</p>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-white/5">
                      <p className="text-[11px] text-white/50 italic leading-relaxed">{test.details}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Statistical Details Table */}
              <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl">
                <h3 className="text-xl font-bold text-white uppercase tracking-wider mb-8">NIST SP 800-90B Test suite</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        <th className="px-4 py-4">Test Name</th>
                        <th className="px-4 py-4">Status</th>
                        <th className="px-4 py-4">Sample Size</th>
                        <th className="px-4 py-4">Last Run</th>
                        <th className="px-4 py-4 text-right">Recommended Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {healthTests.map((test) => (
                        <tr key={test.name} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-6 font-bold text-white text-sm">{test.name}</td>
                          <td className="px-4 py-6">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded border ${
                              test.status === 'passed' ? 'text-green-500 border-green-500/20' : 'text-yellow-500 border-yellow-500/20'
                            }`}>{test.status.toUpperCase()}</span>
                          </td>
                          <td className="px-4 py-6 font-mono text-sm text-white/60">{test.sampleSize}</td>
                          <td className="px-4 py-6 font-mono text-sm text-white/60">{new Date(test.lastRun).toLocaleTimeString()}</td>
                          <td className="px-4 py-6 text-right text-xs text-muted-foreground">
                            {test.recommendation || 'No action required'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Other tabs can be added here with similar high-fidelity UI */}
          {(activeTab === 'pipeline' || activeTab === 'keys' || activeTab === 'audit') && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-white/5 rounded-3xl"
            >
              <div className="p-6 rounded-full bg-gold/5 border border-gold/10 text-gold mb-6">
                <Terminal className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-widest">Panel Advanced Console</h3>
              <p className="text-muted-foreground mt-2 max-w-sm text-center uppercase text-[10px] tracking-widest leading-relaxed">
                This {activeTab} view is fully simulated in the current environment. 
                Full integration requires hardware QRNG connectivity.
              </p>
              <button className="mt-8 px-8 py-3 rounded-xl bg-gold/10 border border-gold/20 text-gold font-bold uppercase tracking-widest hover:bg-gold/20 transition-all">
                Connect to Production Source
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
