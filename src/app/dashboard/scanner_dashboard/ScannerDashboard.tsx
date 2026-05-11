import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Shield, AlertTriangle, Activity, Eye, Zap,
  Terminal, Radio, Target, Search, Filter, ChevronRight,
  CheckCircle2, XCircle, Loader2, Clock, Server, Database,
  Globe, Wifi, Lock, Layers, BarChart3, Download, Plus, 
  Trash2, History, Network
} from 'lucide-react';
import {
  startTargetedScan,
  createInitialTelemetry,
  getScanHistory,
  type ScanTelemetry,
  type ScanHistoryEntry,
  type Finding,
} from '../lib/scanner/scan-engine';
import {
  parseAssetInput,
  deduplicateAssets,
  type ValidatedAsset
} from '../lib/scanner/asset-validator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sevColor(s: string) {
  switch (s) {
    case 'critical': return { t: 'text-red-400', b: 'bg-red-500/10', br: 'border-red-500/30', d: 'bg-red-500' };
    case 'high': return { t: 'text-orange-400', b: 'bg-orange-500/10', br: 'border-orange-500/30', d: 'bg-orange-500' };
    case 'medium': return { t: 'text-yellow-400', b: 'bg-yellow-500/10', br: 'border-yellow-500/30', d: 'bg-yellow-500' };
    case 'low': return { t: 'text-green-400', b: 'bg-green-500/10', br: 'border-green-500/30', d: 'bg-green-500' };
    default: return { t: 'text-cyan-400', b: 'bg-cyan-500/10', br: 'border-cyan-500/30', d: 'bg-cyan-500' };
  }
}

function logColor(level: string) {
  switch (level) {
    case 'CRITICAL': return 'text-red-400';
    case 'WARN': return 'text-yellow-400';
    case 'ERROR': return 'text-red-500';
    case 'SUCCESS': return 'text-green-400';
    case 'DEBUG': return 'text-white/25';
    default: return 'text-white/50';
  }
}

function targetIcon(t: string) {
  if (['tls-ssl', 'ssh', 'vpn'].includes(t)) return Lock;
  if (['database', 'vault'].includes(t)) return Database;
  if (['api', 'jwt', 'cloud-service'].includes(t)) return Globe;
  if (['kubernetes', 'container', 'service-mesh'].includes(t)) return Layers;
  if (['iot', 'messaging'].includes(t)) return Wifi;
  return Server;
}

// ─── Component ───────────────────────────────────────────────────────────────

type TabId = 'setup' | 'overview' | 'findings' | 'logs' | 'history';

export default function ScannerDashboard() {
  const [tel, setTel] = useState<ScanTelemetry>(createInitialTelemetry);
  const [activeTab, setActiveTab] = useState<TabId>('setup');
  const [sevFilter, setSevFilter] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Input state
  const [inputText, setInputText] = useState('');
  const [targets, setTargets] = useState<ValidatedAsset[]>([]);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getScanHistory());
  }, [tel.status]); // Refresh history when scan completes

  const isRunning = tel.status === 'scanning' || tel.status === 'initializing' || tel.status === 'analyzing';

  const handleParseInput = () => {
    const parsed = parseAssetInput(inputText);
    const valid = deduplicateAssets([...targets, ...parsed.filter(p => p.valid)]);
    setTargets(valid);
    setInputText('');
  };

  const handleStart = useCallback(() => {
    if (isRunning || targets.length === 0) return;
    setActiveTab('overview');
    const cancel = startTargetedScan(targets, (t) => setTel({ ...t }));
    cancelRef.current = cancel;
  }, [isRunning, targets]);

  const handlePause = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs') logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tel.auditLog.length, activeTab]);

  const riskColor = tel.riskScore > 700 ? 'text-green-400' : tel.riskScore > 400 ? 'text-yellow-400' : 'text-red-400';

  // Filtered findings
  const filteredFindings = tel.findings.filter(f => {
    if (sevFilter && f.severity !== sevFilter) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return f.asset.toLowerCase().includes(q) || f.algorithm.toLowerCase().includes(q) || f.ruleName.toLowerCase().includes(q) || f.location.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            PQC Discovery <span className="text-gold">Scanner</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Enterprise-grade distributed crypto discovery and vulnerability detection.</p>
        </div>
        <div className="flex gap-3 items-center">
          {isRunning ? (
            <button onClick={handlePause} className="px-5 py-2.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:bg-yellow-500/20 transition-colors">
              <Pause className="h-3.5 w-3.5" /> Pause Scan
            </button>
          ) : (
            <button 
              onClick={handleStart} 
              disabled={targets.length === 0}
              className="px-5 py-2.5 rounded-lg border border-gold/40 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:bg-gold/20 transition-colors shadow-[0_0_20px_rgba(212,175,55,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5" /> {tel.status === 'completed' || tel.status === 'paused' ? 'New Scan' : 'Start Scan'}
            </button>
          )}
          {isRunning && (
            <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.15em] flex items-center gap-2">
              <Radio className="h-3 w-3 animate-pulse" /> Live Telemetry
            </div>
          )}
        </div>
      </header>

      {/* Progress Bar */}
      {tel.status !== 'idle' && activeTab !== 'setup' && (
        <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {isRunning && <Loader2 className="h-4 w-4 text-gold animate-spin" />}
              {tel.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
              {tel.status === 'paused' && <Pause className="h-4 w-4 text-yellow-400" />}
              <span className="text-xs font-black uppercase tracking-[0.15em] text-white/60">
                {tel.status === 'initializing' ? 'Deploying Agents...' :
                 tel.status === 'scanning' ? `Scanning ${tel.currentAsset} (${tel.assetsScanned}/${tel.totalAssets})` :
                 tel.status === 'analyzing' ? 'Analyzing Results...' :
                 tel.status === 'completed' ? 'Scan Complete' : tel.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-white/30 font-mono">
              <span><Clock className="h-3 w-3 inline mr-1" />{(tel.elapsedMs / 1000).toFixed(1)}s</span>
              <span className="text-lg font-black text-gold">{tel.progress}%</span>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className={`h-full rounded-full relative ${tel.status === 'completed' ? 'bg-green-500' : tel.status === 'paused' ? 'bg-yellow-500' : 'bg-gradient-to-r from-gold via-yellow-300 to-gold'}`}
              animate={{ width: `${tel.progress}%` }}
              transition={{ duration: 0.3 }}
            >
              {isRunning && <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)] animate-[shimmer_1.5s_infinite]" />}
            </motion.div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gold/10 pb-0 overflow-x-auto">
        {[
          { id: 'setup' as TabId, label: 'Asset Input' },
          { id: 'overview' as TabId, label: 'Dashboard' },
          { id: 'findings' as TabId, label: `Findings (${tel.totalFindings})` },
          { id: 'logs' as TabId, label: 'Audit Log' },
          { id: 'history' as TabId, label: 'History' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] border-b-2 transition-all -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-gold text-gold'
                : 'border-transparent text-white/35 hover:text-white/55'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'setup' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-5">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-gold" />
                Target Input
              </h2>
              <p className="text-xs text-white/40 mb-4 leading-relaxed">
                Enter IP addresses, domains, URLs, or hostnames to scan for quantum-vulnerable cryptography. Multiple entries can be separated by commas or newlines.
              </p>
              
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="example.com&#10;192.168.1.1&#10;https://api.company.com&#10;10.0.0.0/24"
                className="w-full h-40 bg-black/40 border border-gold/15 rounded-lg p-4 text-sm font-mono focus:outline-none focus:border-gold/40 transition-colors text-white placeholder-white/20 resize-none mb-4"
              />
              
              <div className="flex justify-end">
                <button 
                  onClick={handleParseInput}
                  disabled={!inputText.trim()}
                  className="px-4 py-2 rounded-lg border border-gold/30 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:bg-gold/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Targets
                </button>
              </div>
            </div>
            
            {/* Validation Feedback */}
            {inputText && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-bold text-white/50 mb-2">Live Validation</div>
                <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[10px]">
                  {parseAssetInput(inputText).slice(0, 5).map((a, i) => (
                    <div key={i} className={`flex items-center gap-2 ${a.valid ? 'text-green-400' : 'text-red-400'}`}>
                      {a.valid ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      <span className="truncate">{a.raw}</span>
                      {!a.valid && <span className="text-red-400/60 ml-2">- {a.error}</span>}
                      {a.valid && <span className="text-green-400/60 ml-2">- {a.type}</span>}
                    </div>
                  ))}
                  {parseAssetInput(inputText).length > 5 && (
                    <div className="text-white/30 italic">...and {parseAssetInput(inputText).length - 5} more</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-5 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 flex items-center gap-2">
                  <Network className="h-4 w-4 text-gold" />
                  Queued Targets ({targets.length})
                </h2>
                {targets.length > 0 && (
                  <button 
                    onClick={() => setTargets([])}
                    className="text-white/30 hover:text-red-400 transition-colors"
                    title="Clear All"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 min-h-[200px]">
                {targets.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/20 text-xs uppercase tracking-widest font-bold border-2 border-dashed border-white/5 rounded-lg">
                    No targets queued
                  </div>
                ) : targets.map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gold/10 bg-white/[0.02] group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="h-6 w-6 rounded bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                        <Globe className="h-3 w-3 text-gold/60" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white/80 truncate">{t.host}</div>
                        <div className="text-[9px] font-mono text-white/30 uppercase">{t.type} {t.port ? `:${t.port}` : ''}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setTargets(targets.filter((_, idx) => idx !== i))}
                      className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-1 transition-all"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-gold/10">
                <button 
                  onClick={handleStart} 
                  disabled={targets.length === 0 || isRunning}
                  className="w-full py-3 rounded-lg bg-gold text-black text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="h-4 w-4" /> Start Scan Engine
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && tel.status !== 'idle' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { label: 'Risk Score', value: `${tel.riskScore}`, icon: Shield, color: riskColor },
              { label: 'Assets Scanned', value: `${tel.assetsScanned}/${tel.totalAssets}`, icon: Eye, color: 'text-white' },
              { label: 'Total Findings', value: `${tel.totalFindings}`, icon: Target, color: 'text-gold' },
              { label: 'Critical', value: `${tel.criticalFindings}`, icon: XCircle, color: 'text-red-400' },
              { label: 'High', value: `${tel.highFindings}`, icon: AlertTriangle, color: 'text-orange-400' },
              { label: 'Medium/Low', value: `${tel.mediumFindings + tel.lowFindings}`, icon: Activity, color: 'text-yellow-400' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-4 rounded-xl border border-gold/12 bg-black/50 backdrop-blur-xl group hover:border-gold/30 transition-all"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <kpi.icon className="h-3 w-3 text-gold/40" />
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35">{kpi.label}</span>
                </div>
                <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
              </motion.div>
            ))}
          </div>
          
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 pt-2 border-t border-gold/10">Active Scan Agents</h2>
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {tel.agents.map(agent => {
              const Icon = targetIcon(agent.target);
              return (
                <div key={agent.id} className="p-5 rounded-xl border border-gold/12 bg-black/50 backdrop-blur-xl relative overflow-hidden">
                  {agent.status === 'scanning' && (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.05),transparent_60%)]" />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-lg border border-gold/20 bg-gold/5 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-gold/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white/80 truncate">{agent.name}</div>
                        <div className="text-[10px] text-white/30 font-mono truncate">{agent.currentAsset || agent.target}</div>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${
                        agent.status === 'completed' ? 'border-green-500/30 bg-green-500/10 text-green-400' :
                        agent.status === 'scanning' ? 'border-gold/30 bg-gold/10 text-gold animate-pulse' :
                        agent.status === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-400' :
                        'border-white/10 bg-white/5 text-white/30'
                      }`}>{agent.status}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] mb-3 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${
                        agent.status === 'completed' ? 'bg-green-500' : agent.status === 'scanning' ? 'bg-gradient-to-r from-gold to-yellow-300' : 'bg-white/10'
                      }`} style={{ width: `${agent.progress}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-sm font-black text-white">{agent.assetsScanned}</div><div className="text-[8px] text-white/20 uppercase font-bold">Assets</div></div>
                      <div><div className="text-sm font-black text-gold">{agent.findingsCount}</div><div className="text-[8px] text-white/20 uppercase font-bold">Findings</div></div>
                      <div><div className="text-sm font-black text-white">{agent.progress}%</div><div className="text-[8px] text-white/20 uppercase font-bold">Progress</div></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input type="text" placeholder="Search assets, algorithms..." value={searchQ} onChange={e => setSearchQ(e.target.value)}
                className="w-full bg-black/40 border border-gold/15 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-gold/40 transition-colors text-white placeholder-white/20" />
            </div>
            {['critical', 'high', 'medium', 'low'].map(s => (
              <button key={s} onClick={() => setSevFilter(sevFilter === s ? null : s)}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg border transition-all ${
                  sevFilter === s ? `${sevColor(s).br} ${sevColor(s).b} ${sevColor(s).t}` : 'border-gold/10 bg-black/30 text-white/35 hover:border-gold/25'
                }`}>{s} ({tel.findings.filter(f => f.severity === s).length})</button>
            ))}
          </div>

          {/* Findings List */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredFindings.length === 0 ? (
              <div className="text-center py-16 text-white/20 text-xs uppercase tracking-widest font-bold">
                {tel.totalFindings === 0 ? 'Run a scan to discover findings' : 'No findings match filters'}
              </div>
            ) : filteredFindings.map((f, i) => {
              const sc = sevColor(f.severity);
              const isExpanded = expandedFinding === f.id;
              const Icon = targetIcon(f.assetType);
              return (
                <motion.div key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className={`rounded-xl border overflow-hidden ${sc.br} ${sc.b}`}>
                  <button onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                    className="w-full text-left p-4 flex items-center gap-3 group">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${sc.d} ${f.severity === 'critical' ? 'animate-pulse' : ''}`} />
                    <Icon className="h-4 w-4 text-gold/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-bold text-white/80">{f.asset}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${sc.br} ${sc.b} ${sc.t}`}>{f.severity}</span>
                        <span className="text-[9px] font-bold text-gold/50">{f.ruleName}</span>
                      </div>
                      <div className="text-[10px] text-white/35 font-mono truncate">{f.location}</div>
                    </div>
                    <div className="text-right shrink-0 hidden lg:block">
                      <div className="text-[10px] font-bold text-gold/60">{f.pqcReplacement}</div>
                      <div className="text-[9px] text-white/20">{f.confidence}% confidence</div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-white/15 shrink-0 transition-transform ${isExpanded ? 'rotate-90 text-gold' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gold/10 px-4 py-4 bg-black/30">
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                          <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.015]">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-0.5">Algorithm</div>
                            <div className="text-xs font-mono text-red-400">{f.algorithm}{f.keySize ? ` (${f.keySize}-bit)` : ''}</div>
                          </div>
                          <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.015]">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-0.5">PQC Replacement</div>
                            <div className="text-xs font-mono text-green-400">{f.pqcReplacement}</div>
                          </div>
                          <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.015]">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-0.5">Quantum Threat</div>
                            <div className="text-xs font-bold text-gold capitalize">{f.quantumThreat}</div>
                          </div>
                          <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.015]">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-0.5">CWE</div>
                            <div className="text-xs font-mono text-cyan-400">{f.cweId || 'N/A'}</div>
                          </div>
                        </div>
                        <p className="text-xs text-white/45 leading-relaxed mb-2">{f.description}</p>
                        <div className="p-2.5 rounded-lg border border-green-500/15 bg-green-500/[0.03]">
                          <div className="text-[8px] font-black uppercase tracking-wider text-green-400/60 mb-0.5">Remediation</div>
                          <div className="text-xs text-green-400/80">{f.remediation}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="rounded-xl border border-gold/15 bg-black/80 backdrop-blur-xl overflow-hidden flex flex-col h-[600px]">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gold/10 bg-gold/[0.03] shrink-0">
            <Terminal className="h-3.5 w-3.5 text-gold/50" />
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">Scanner Terminal</span>
            <span className="ml-auto text-[10px] text-white/20 font-mono">{tel.auditLog.length} lines</span>
            <div className="flex gap-1.5 ml-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
            </div>
          </div>
          <div className="p-4 overflow-y-auto flex-1 font-mono text-[11px] space-y-1 scrollbar-thin">
            {tel.auditLog.length === 0 ? (
              <div className="text-white/15 text-center py-12 uppercase tracking-widest text-[10px] font-bold">Awaiting scan initiation...</div>
            ) : tel.auditLog.map((entry, i) => (
              <div key={i} className={`leading-relaxed break-words ${logColor(entry.level)}`}>
                <span className="text-white/15 inline-block w-20">{entry.timestamp.split('T')[1]?.slice(0, 12) || entry.timestamp}</span>
                <span className={`font-bold inline-block w-20 ${logColor(entry.level)}`}>[{entry.level}]</span>
                <span className="text-white/30 mr-2">[{entry.agentId.startsWith('AGT') ? entry.agentId.slice(0, 12) : entry.agentId}]</span>
                {entry.message}
              </div>
            ))}
            {isRunning && <div className="text-gold/50 animate-pulse mt-2">█</div>}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Scan History</h2>
            <span className="text-[10px] text-white/30 font-mono">{history.length} previous scans</span>
          </div>
          
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-16 text-white/20 text-xs uppercase tracking-widest font-bold border border-dashed border-white/10 rounded-xl">
                No scan history available
              </div>
            ) : history.map((entry, i) => (
              <div key={i} className="p-4 rounded-xl border border-gold/15 bg-black/40 backdrop-blur-xl hover:border-gold/30 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-gold/60" />
                    <div>
                      <div className="text-sm font-bold text-white/80">{entry.scanId}</div>
                      <div className="text-[10px] text-white/30 font-mono">{new Date(entry.startTime).toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="px-3 py-1.5 rounded bg-black/40 border border-white/5 text-center">
                      <div className="text-sm font-black text-white">{entry.targetsCount}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Targets</div>
                    </div>
                    <div className="px-3 py-1.5 rounded bg-black/40 border border-gold/10 text-center">
                      <div className="text-sm font-black text-gold">{entry.findingsCount}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Findings</div>
                    </div>
                    <div className="px-3 py-1.5 rounded bg-black/40 border border-red-500/10 text-center">
                      <div className="text-sm font-black text-red-400">{entry.criticalCount}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Critical</div>
                    </div>
                    <div className="px-3 py-1.5 rounded bg-black/40 border border-white/5 text-center">
                      <div className="text-sm font-black text-cyan-400">{entry.riskScore}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Risk Score</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-white/40 border-t border-gold/5 pt-3">
                  <span className="font-bold text-white/60 mr-2">Scanned:</span> 
                  {entry.targets.join(', ')} {entry.targets.length < entry.targetsCount && '...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
