import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Layers, Activity, TrendingUp, TrendingDown, Shield,
  Server, Clock, Zap, GitBranch, ArrowRight, CheckCircle2,
  XCircle, AlertTriangle, Radio, BarChart3, RefreshCcw
} from 'lucide-react';

type DeploymentNode = {
  id: string;
  name: string;
  region: string;
  classicalAlgo: string;
  pqcAlgo: string;
  trafficPct: number; // % going through PQC path
  latencyClassical: number; // ms
  latencyPqc: number; // ms
  throughput: number; // req/s
  errorRate: number; // %
  status: 'healthy' | 'degraded' | 'down';
};

const DEPLOYMENT_NODES: DeploymentNode[] = [
  { id: 'us-east', name: 'US East (Virginia)', region: 'us-east-1', classicalAlgo: 'RSA-2048', pqcAlgo: 'ML-KEM-768', trafficPct: 72, latencyClassical: 12, latencyPqc: 18, throughput: 14200, errorRate: 0.02, status: 'healthy' },
  { id: 'us-west', name: 'US West (Oregon)', region: 'us-west-2', classicalAlgo: 'RSA-2048', pqcAlgo: 'ML-KEM-768', trafficPct: 65, latencyClassical: 14, latencyPqc: 21, throughput: 8700, errorRate: 0.04, status: 'healthy' },
  { id: 'eu-west', name: 'EU West (Ireland)', region: 'eu-west-1', classicalAlgo: 'ECDSA-P256', pqcAlgo: 'ML-DSA-65', trafficPct: 48, latencyClassical: 18, latencyPqc: 28, throughput: 6300, errorRate: 0.08, status: 'degraded' },
  { id: 'ap-east', name: 'Asia Pacific (Tokyo)', region: 'ap-northeast-1', classicalAlgo: 'RSA-4096', pqcAlgo: 'ML-KEM-1024', trafficPct: 35, latencyClassical: 22, latencyPqc: 34, throughput: 4100, errorRate: 0.12, status: 'healthy' },
  { id: 'ap-south', name: 'Asia Pacific (Mumbai)', region: 'ap-south-1', classicalAlgo: 'ECDSA-P384', pqcAlgo: 'ML-DSA-87', trafficPct: 20, latencyClassical: 25, latencyPqc: 38, throughput: 2800, errorRate: 0.15, status: 'degraded' },
  { id: 'sa-east', name: 'South America (São Paulo)', region: 'sa-east-1', classicalAlgo: 'RSA-2048', pqcAlgo: 'ML-KEM-768', trafficPct: 0, latencyClassical: 30, latencyPqc: 0, throughput: 1200, errorRate: 0.03, status: 'healthy' },
];

function getStatusConfig(status: string) {
  switch (status) {
    case 'healthy': return { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', dot: 'bg-green-500' };
    case 'degraded': return { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' };
    case 'down': return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' };
    default: return { text: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', dot: 'bg-white/30' };
  }
}

export default function HybridDeploymentMetrics() {
  const [nodes, setNodes] = useState(DEPLOYMENT_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState('us-east');
  const [latencyHistory, setLatencyHistory] = useState<number[]>([18, 19, 17, 20, 18, 21, 19, 20, 22, 18, 19, 17, 20, 21, 18]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId)!;

  // Simulate real-time metric updates
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prev => prev.map(node => ({
        ...node,
        throughput: Math.max(0, node.throughput + Math.floor(Math.random() * 200 - 100)),
        trafficPct: Math.min(100, Math.max(0, node.trafficPct + (Math.random() > 0.7 ? 1 : 0))),
        latencyPqc: Math.max(5, node.latencyPqc + (Math.random() > 0.5 ? 1 : -1)),
        errorRate: Math.max(0, +(node.errorRate + (Math.random() * 0.02 - 0.01)).toFixed(2)),
      })));

      setLatencyHistory(prev => {
        const next = [...prev.slice(1), Math.max(12, Math.floor(Math.random() * 15 + 14))];
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const totalThroughput = nodes.reduce((a, n) => a + n.throughput, 0);
  const avgPqcTraffic = Math.round(nodes.reduce((a, n) => a + n.trafficPct, 0) / nodes.length);
  const avgLatency = Math.round(nodes.reduce((a, n) => a + n.latencyPqc, 0) / nodes.filter(n => n.latencyPqc > 0).length);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Hybrid Deployment <span className="text-gold">Metrics</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Real-time performance metrics for hybrid classical/PQC deployments across all regions.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.15em] flex items-center gap-2">
            <Radio className="h-3 w-3 animate-pulse" />
            Live Metrics
          </div>
        </div>
      </header>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Global Throughput', value: `${(totalThroughput / 1000).toFixed(1)}K`, suffix: 'req/s', icon: BarChart3, color: 'text-gold' },
          { label: 'Avg PQC Traffic', value: `${avgPqcTraffic}%`, suffix: '', icon: GitBranch, color: 'text-cyan-400' },
          { label: 'Avg PQC Latency', value: `${avgLatency}`, suffix: 'ms', icon: Clock, color: avgLatency > 30 ? 'text-yellow-400' : 'text-green-400' },
          { label: 'Active Regions', value: `${nodes.length}`, suffix: '', icon: Server, color: 'text-white' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="p-5 rounded-xl border border-gold/12 bg-black/50 backdrop-blur-xl relative overflow-hidden group hover:border-gold/30 transition-all"
          >
            <div className="absolute top-3 right-3 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity">
              <kpi.icon className="h-12 w-12" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className="h-3.5 w-3.5 text-gold/50" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">{kpi.label}</span>
            </div>
            <div className={`text-2xl font-black ${kpi.color}`}>
              {kpi.value}<span className="text-xs text-white/20 ml-1">{kpi.suffix}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Region List */}
        <div className="lg:col-span-2 space-y-2">
          {nodes.map((node, i) => {
            const cfg = getStatusConfig(node.status);
            const isSelected = selectedNodeId === node.id;

            return (
              <motion.button
                key={node.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedNodeId(node.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all relative overflow-hidden ${
                  isSelected
                    ? 'border-gold/40 bg-gold/[0.06] shadow-[0_0_20px_rgba(212,175,55,0.1)]'
                    : 'border-gold/8 bg-black/30 hover:border-gold/20'
                }`}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gold rounded-r" />}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    <span className="text-sm font-bold text-white/80">{node.name}</span>
                  </div>
                  <span className={`text-[9px] font-black uppercase ${cfg.text}`}>{node.status}</span>
                </div>
                <div className="flex items-center gap-4">
                  {/* PQC Traffic bar */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-white/30 font-bold uppercase">PQC Traffic</span>
                      <span className="text-[10px] font-black text-cyan-400">{node.trafficPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-gold transition-all duration-1000"
                        style={{ width: `${node.trafficPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-white/60">{(node.throughput / 1000).toFixed(1)}K</div>
                    <div className="text-[8px] text-white/25 uppercase">req/s</div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Selected Region Details */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,243,255,0.04),transparent_50%)]" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-black text-white">{selectedNode.name}</h2>
                  <span className="text-[10px] text-white/30 font-mono">{selectedNode.region}</span>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider ${getStatusConfig(selectedNode.status).border} ${getStatusConfig(selectedNode.status).bg} ${getStatusConfig(selectedNode.status).text}`}>
                  {selectedNode.status}
                </div>
              </div>

              {/* Hybrid split visualization */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/40">Traffic Split</span>
                  <div className="flex items-center gap-4 text-[10px]">
                    <span className="flex items-center gap-1 text-cyan-400"><span className="h-2 w-2 rounded-full bg-cyan-500" /> PQC ({selectedNode.trafficPct}%)</span>
                    <span className="flex items-center gap-1 text-orange-400"><span className="h-2 w-2 rounded-full bg-orange-500" /> Classical ({100 - selectedNode.trafficPct}%)</span>
                  </div>
                </div>
                <div className="h-4 rounded-full overflow-hidden flex bg-white/[0.04]">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-l-full"
                    animate={{ width: `${selectedNode.trafficPct}%` }}
                    transition={{ duration: 0.8 }}
                  />
                  <motion.div
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-r-full"
                    animate={{ width: `${100 - selectedNode.trafficPct}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'PQC Algorithm', value: selectedNode.pqcAlgo, color: 'text-cyan-400' },
                  { label: 'Classical Algo', value: selectedNode.classicalAlgo, color: 'text-orange-400' },
                  { label: 'PQC Latency', value: `${selectedNode.latencyPqc}ms`, color: selectedNode.latencyPqc > 30 ? 'text-yellow-400' : 'text-green-400' },
                  { label: 'Error Rate', value: `${selectedNode.errorRate}%`, color: selectedNode.errorRate > 0.1 ? 'text-red-400' : 'text-green-400' },
                ].map(m => (
                  <div key={m.label} className="p-3 rounded-lg border border-gold/10 bg-white/[0.02] text-center">
                    <div className={`text-sm font-black ${m.color}`}>{m.value}</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/25 font-bold mt-1">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Latency Chart Visualization */}
          <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(212,175,55,0.04),transparent_50%)]" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                  <Activity className="h-3.5 w-3.5 inline mr-2 text-gold/60" />
                  PQC Latency Trend (last 15 samples)
                </h3>
                <span className="text-[10px] text-gold/40 font-bold">Auto-updating</span>
              </div>
              <div className="h-32 flex items-end gap-1.5">
                {latencyHistory.map((val, i) => {
                  const maxVal = Math.max(...latencyHistory);
                  const heightPct = (val / maxVal) * 100;
                  const isLast = i === latencyHistory.length - 1;
                  return (
                    <motion.div
                      key={i}
                      className={`flex-1 rounded-t transition-all duration-500 ${
                        val > 25 ? 'bg-yellow-500/60' : 'bg-cyan-500/50'
                      } ${isLast ? 'ring-1 ring-gold/40' : ''}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[9px] text-white/20 font-mono">oldest</span>
                <span className="text-[9px] text-white/20 font-mono">latest</span>
              </div>
            </div>
          </div>

          {/* Comparison */}
          <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-4">
              <GitBranch className="h-3.5 w-3.5 inline mr-2 text-gold/60" />
              Classical vs PQC Performance
            </h3>
            <div className="space-y-3">
              {[
                { metric: 'Key Exchange Latency', classical: `${selectedNode.latencyClassical}ms`, pqc: `${selectedNode.latencyPqc}ms`, delta: `+${selectedNode.latencyPqc - selectedNode.latencyClassical}ms` },
                { metric: 'Key Size', classical: selectedNode.classicalAlgo.includes('RSA') ? '256 bytes' : '64 bytes', pqc: selectedNode.pqcAlgo.includes('KEM') ? '1,184 bytes' : '2,420 bytes', delta: 'Larger' },
                { metric: 'Quantum Security', classical: 'None', pqc: 'NIST Level 3+', delta: '∞ improvement' },
                { metric: 'Backward Compatible', classical: '—', pqc: 'Yes (Hybrid)', delta: 'Full support' },
              ].map(row => (
                <div key={row.metric} className="grid grid-cols-4 gap-3 items-center p-2.5 rounded-lg border border-gold/8 bg-white/[0.015]">
                  <span className="text-[10px] font-bold text-white/50">{row.metric}</span>
                  <span className="text-[10px] font-mono text-orange-400/70 text-center">{row.classical}</span>
                  <span className="text-[10px] font-mono text-cyan-400/70 text-center">{row.pqc}</span>
                  <span className="text-[10px] font-bold text-gold/60 text-center">{row.delta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
