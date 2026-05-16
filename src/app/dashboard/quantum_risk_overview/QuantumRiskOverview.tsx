import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, Activity, TrendingUp, TrendingDown,
  Eye, Zap, Lock, Unlock, Globe, Server, Database,
  Radio, Wifi, Target, Crosshair
} from 'lucide-react';

type RiskNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  risk: number;
  type: 'server' | 'database' | 'api' | 'network';
  vulnerable: boolean;
};

type AttackPath = {
  from: string;
  to: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
};

const RISK_NODES: RiskNode[] = [
  { id: 'gw-01', label: 'API Gateway', x: 50, y: 20, risk: 82, type: 'api', vulnerable: true },
  { id: 'db-01', label: 'Customer DB', x: 80, y: 45, risk: 94, type: 'database', vulnerable: true },
  { id: 'sv-01', label: 'Auth Server', x: 20, y: 40, risk: 45, type: 'server', vulnerable: false },
  { id: 'sv-02', label: 'Payment Svc', x: 65, y: 70, risk: 88, type: 'server', vulnerable: true },
  { id: 'nw-01', label: 'Edge Router', x: 35, y: 65, risk: 67, type: 'network', vulnerable: true },
  { id: 'db-02', label: 'Session Store', x: 15, y: 80, risk: 31, type: 'database', vulnerable: false },
  { id: 'sv-03', label: 'CDN Origin', x: 85, y: 15, risk: 52, type: 'server', vulnerable: false },
  { id: 'api-02', label: 'GraphQL EP', x: 50, y: 50, risk: 76, type: 'api', vulnerable: true },
];

const ATTACK_PATHS: AttackPath[] = [
  { from: 'gw-01', to: 'api-02', severity: 'critical' },
  { from: 'api-02', to: 'db-01', severity: 'critical' },
  { from: 'api-02', to: 'sv-02', severity: 'high' },
  { from: 'nw-01', to: 'sv-01', severity: 'medium' },
  { from: 'sv-01', to: 'db-02', severity: 'low' },
  { from: 'sv-03', to: 'gw-01', severity: 'medium' },
  { from: 'nw-01', to: 'api-02', severity: 'high' },
];

const THREAT_FEEDS = [
  { time: '14:32:01', source: 'NIST CVE-2026-4821', msg: 'RSA-2048 quantum factoring POC published', severity: 'CRITICAL' },
  { time: '14:28:15', source: 'MITRE ATT&CK', msg: 'New HNDL campaign targeting financial sector', severity: 'HIGH' },
  { time: '14:22:44', source: 'QGuard Intel', msg: 'ML-KEM-768 implementation verified secure', severity: 'INFO' },
  { time: '14:15:02', source: 'CERT Alert', msg: 'OpenSSL 3.4 RSA side-channel vulnerability', severity: 'HIGH' },
  { time: '14:08:33', source: 'QGuard Scanner', msg: 'ECDSA P-256 detected in TLS handshake', severity: 'WARNING' },
  { time: '14:01:18', source: 'Threat Feed', msg: 'IBM Condor 1121-qubit milestone confirmed', severity: 'WARNING' },
];

function getNodeIcon(type: RiskNode['type']) {
  switch (type) {
    case 'server': return Server;
    case 'database': return Database;
    case 'api': return Globe;
    case 'network': return Wifi;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical':
    case 'CRITICAL': return '#ef4444';
    case 'high':
    case 'HIGH': return '#f97316';
    case 'medium':
    case 'WARNING': return '#eab308';
    case 'low':
    case 'INFO': return '#22c55e';
    default: return '#6b7280';
  }
}

export default function QuantumRiskOverview() {
  const [riskScore, setRiskScore] = useState(687);
  const [activePulse, setActivePulse] = useState(0);
  const [telemetry, setTelemetry] = useState({
    scansPerMin: 142,
    threatsBlocked: 23847,
    keysRotated: 1294,
    assetsMonitored: 847
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Simulate live SSE telemetry updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetry(prev => ({
        scansPerMin: prev.scansPerMin + Math.floor(Math.random() * 5 - 2),
        threatsBlocked: prev.threatsBlocked + Math.floor(Math.random() * 3),
        keysRotated: prev.keysRotated + (Math.random() > 0.7 ? 1 : 0),
        assetsMonitored: prev.assetsMonitored + (Math.random() > 0.9 ? 1 : 0),
      }));
      setRiskScore(prev => Math.max(0, Math.min(1000, prev + Math.floor(Math.random() * 7 - 3))));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setActivePulse(p => (p + 1) % ATTACK_PATHS.length);
    }, 1800);
    return () => clearInterval(pulseInterval);
  }, []);

  // 3D Globe canvas
  const drawGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);
    const cw = w / 4;
    const ch = h / 4;
    const r = Math.min(cw, ch) * 0.7;
    const time = Date.now() * 0.001;

    ctx.clearRect(0, 0, w, h);

    // Globe glow
    const glow = ctx.createRadialGradient(cw, ch, r * 0.2, cw, ch, r * 1.4);
    glow.addColorStop(0, 'rgba(212,175,55,0.08)');
    glow.addColorStop(0.6, 'rgba(0,243,255,0.04)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w / 2, h / 2);

    // Globe wireframe
    ctx.strokeStyle = 'rgba(212,175,55,0.15)';
    ctx.lineWidth = 0.5;

    // Longitude lines
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI + time * 0.3;
      ctx.beginPath();
      for (let j = 0; j <= 60; j++) {
        const phi = (j / 60) * Math.PI * 2;
        const x = cw + r * Math.cos(angle) * Math.sin(phi);
        const y = ch + r * Math.cos(phi);
        j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Latitude lines
    for (let i = 1; i < 6; i++) {
      const lat = (i / 6) * Math.PI;
      const lr = r * Math.sin(lat);
      const ly = ch + r * Math.cos(lat);
      ctx.beginPath();
      ctx.ellipse(cw, ly, lr, lr * 0.3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Threat nodes on globe
    RISK_NODES.forEach((node, idx) => {
      const phi = (node.x / 100) * Math.PI * 2 + time * 0.3;
      const theta = (node.y / 100) * Math.PI;
      const x = cw + r * 0.85 * Math.sin(theta) * Math.cos(phi);
      const y = ch + r * 0.85 * Math.cos(theta);
      const z = Math.sin(theta) * Math.sin(phi);

      if (z > -0.2) {
        const alpha = Math.max(0.3, (z + 0.2) / 1.2);
        const size = 3 + (node.risk / 100) * 4;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = node.vulnerable
          ? `rgba(239,68,68,${alpha})`
          : `rgba(34,197,94,${alpha})`;
        ctx.fill();

        if (node.vulnerable) {
          ctx.beginPath();
          ctx.arc(x, y, size + 4 + Math.sin(time * 3 + idx) * 2, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(239,68,68,${alpha * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    });

    animRef.current = requestAnimationFrame(drawGlobe);
  }, []);

  useEffect(() => {
    drawGlobe();
    return () => cancelAnimationFrame(animRef.current);
  }, [drawGlobe]);

  const riskColor = riskScore > 700 ? 'text-green-400' : riskScore > 400 ? 'text-yellow-400' : 'text-red-400';
  const riskLabel = riskScore > 700 ? 'QUANTUM SAFE' : riskScore > 400 ? 'AT RISK' : 'CRITICAL';

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Quantum Risk <span className="text-gold">Overview</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Enterprise-wide quantum threat posture and real-time attack surface analysis.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.2em] flex items-center gap-2">
            <Radio className="h-3 w-3 animate-pulse" />
            SSE Live Feed
          </div>
          <div className="px-4 py-2 border border-green-500/30 bg-green-500/5 rounded-lg text-[10px] font-black text-green-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <Activity className="h-3 w-3 animate-pulse" />
            Telemetry Active
          </div>
        </div>
      </header>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Q-Risk Score', value: riskScore, icon: Shield, color: riskColor, suffix: '/1000', trend: riskScore > 650 ? '+12' : '-8' },
          { label: 'Scans/min', value: telemetry.scansPerMin, icon: Eye, color: 'text-cyan-400', trend: '+3' },
          { label: 'Threats Blocked', value: telemetry.threatsBlocked.toLocaleString(), icon: Zap, color: 'text-gold', trend: '+47' },
          { label: 'Keys Rotated', value: telemetry.keysRotated.toLocaleString(), icon: Lock, color: 'text-purple-400', trend: '+2' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="relative overflow-hidden rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-5 group hover:border-gold/40 transition-all duration-500"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gold/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="absolute top-3 right-3 opacity-[0.06] group-hover:opacity-[0.12] transition-opacity">
              <card.icon className="h-12 w-12" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <card.icon className="h-3.5 w-3.5 text-gold/60" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{card.label}</span>
              </div>
              <div className={`text-3xl font-black tracking-tight ${card.color}`}>
                {card.value}<span className="text-sm text-white/20 ml-1">{card.suffix || ''}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-green-400/70">
                <TrendingUp className="h-3 w-3" /> {card.trend} this hour
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* 3D Globe */}
        <div className="lg:col-span-2 rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.06),transparent_60%)]" />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-4 relative z-10">
            <Globe className="h-3.5 w-3.5 inline mr-2 text-gold/60" />
            Global Threat Surface
          </h2>
          <div className="relative z-10 aspect-square max-h-[340px] mx-auto">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Vulnerable ({RISK_NODES.filter(n => n.vulnerable).length})
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/40">
              <span className="h-2 w-2 rounded-full bg-green-500" /> Secured ({RISK_NODES.filter(n => !n.vulnerable).length})
            </div>
          </div>
        </div>

        {/* Attack Graph */}
        <div className="lg:col-span-3 rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(0,243,255,0.04),transparent_50%)]" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
              <Target className="h-3.5 w-3.5 inline mr-2 text-gold/60" />
              Animated Attack Graph
            </h2>
            <span className="text-[10px] font-bold text-gold/50 uppercase tracking-wider">
              {ATTACK_PATHS.length} Active Paths
            </span>
          </div>
          <div className="relative z-10 h-[340px] rounded-lg border border-gold/10 bg-[#0f1428]/30 overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {/* Attack path lines */}
              {ATTACK_PATHS.map((path, idx) => {
                const fromNode = RISK_NODES.find(n => n.id === path.from)!;
                const toNode = RISK_NODES.find(n => n.id === path.to)!;
                const isActive = activePulse === idx;
                return (
                  <g key={`${path.from}-${path.to}`}>
                    <line
                      x1={fromNode.x} y1={fromNode.y}
                      x2={toNode.x} y2={toNode.y}
                      stroke={getSeverityColor(path.severity)}
                      strokeWidth={isActive ? 0.8 : 0.3}
                      strokeOpacity={isActive ? 0.9 : 0.25}
                      strokeDasharray={isActive ? '2 1' : '1 2'}
                    >
                      {isActive && (
                        <animate attributeName="stroke-dashoffset" from="10" to="0" dur="0.8s" repeatCount="indefinite" />
                      )}
                    </line>
                    {isActive && (
                      <circle r="1.2" fill={getSeverityColor(path.severity)}>
                        <animateMotion
                          path={`M${fromNode.x},${fromNode.y} L${toNode.x},${toNode.y}`}
                          dur="1.2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* Node circles */}
              {RISK_NODES.map(node => (
                <g key={node.id}>
                  <circle
                    cx={node.x} cy={node.y} r={2.5 + (node.risk / 100) * 1.5}
                    fill={node.vulnerable ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}
                    stroke={node.vulnerable ? '#ef4444' : '#22c55e'}
                    strokeWidth="0.4"
                  />
                  {node.vulnerable && (
                    <circle
                      cx={node.x} cy={node.y} r={4 + (node.risk / 100) * 2}
                      fill="none"
                      stroke="rgba(239,68,68,0.15)"
                      strokeWidth="0.3"
                    >
                      <animate attributeName="r" values={`${3 + (node.risk/100)*1.5};${5 + (node.risk/100)*2.5};${3 + (node.risk/100)*1.5}`} dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <text
                    x={node.x} y={node.y + 6}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.5)"
                    fontSize="2.2"
                    fontFamily="monospace"
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Risk Score Gauge */}
        <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-6 relative overflow-hidden">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-6">
            <Crosshair className="h-3.5 w-3.5 inline mr-2 text-gold/60" />
            Composite Risk Gauge
          </h2>
          <div className="flex flex-col items-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="url(#riskGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(riskScore / 1000) * 264} 264`}
                  transform="rotate(-90 50 50)"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="50%" stopColor="#eab308" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
                <text x="50" y="46" textAnchor="middle" fill="white" fontSize="16" fontWeight="900" fontFamily="monospace">{riskScore}</text>
                <text x="50" y="58" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="5" fontWeight="700">/1000</text>
              </svg>
            </div>
            <div className={`mt-4 text-xs font-black uppercase tracking-[0.2em] ${riskColor}`}>
              {riskLabel}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 w-full text-center">
              {[
                { label: 'RSA', count: 14, color: 'text-red-400' },
                { label: 'ECC', count: 8, color: 'text-yellow-400' },
                { label: 'PQC', count: 23, color: 'text-green-400' },
              ].map(item => (
                <div key={item.label}>
                  <div className={`text-lg font-black ${item.color}`}>{item.count}</div>
                  <div className="text-[9px] uppercase tracking-wider text-white/30 font-bold">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live Threat Intelligence Feed */}
        <div className="lg:col-span-2 rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(212,175,55,0.04),transparent_40%)]" />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-4 relative z-10">
            <Radio className="h-3.5 w-3.5 inline mr-2 text-gold/60 animate-pulse" />
            Live Threat Intelligence Feed
          </h2>
          <div className="relative z-10 space-y-3 max-h-[280px] overflow-y-auto pr-2">
            {THREAT_FEEDS.map((feed, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 p-3 rounded-lg border border-gold/8 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
              >
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className="font-mono text-[10px] text-white/30">{feed.time}</span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: getSeverityColor(feed.severity) }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border"
                      style={{
                        color: getSeverityColor(feed.severity),
                        borderColor: getSeverityColor(feed.severity) + '40',
                        backgroundColor: getSeverityColor(feed.severity) + '10'
                      }}
                    >
                      {feed.severity}
                    </span>
                    <span className="text-[10px] text-gold/50 font-bold">{feed.source}</span>
                  </div>
                  <p className="text-xs text-white/60 group-hover:text-white/80 transition-colors truncate">{feed.msg}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
