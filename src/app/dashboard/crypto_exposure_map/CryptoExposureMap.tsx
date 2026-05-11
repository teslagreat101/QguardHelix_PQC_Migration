import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Globe, Server, Database, Shield, AlertTriangle,
  Lock, Unlock, Wifi, Cloud, Radio, Eye
} from 'lucide-react';

type MapNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  type: 'server' | 'database' | 'cloud' | 'network' | 'endpoint';
  algorithm: string;
  vulnerable: boolean;
  risk: number;
  connections: string[];
};

const MAP_NODES: MapNode[] = [
  { id: 'gw', label: 'API Gateway', x: 50, y: 12, size: 18, type: 'server', algorithm: 'RSA-2048', vulnerable: true, risk: 87, connections: ['auth', 'pay', 'cdn'] },
  { id: 'auth', label: 'Auth Service', x: 22, y: 30, size: 14, type: 'server', algorithm: 'ECDSA-P256', vulnerable: true, risk: 72, connections: ['db-user', 'session'] },
  { id: 'pay', label: 'Payment Svc', x: 78, y: 30, size: 16, type: 'server', algorithm: 'RSA-4096', vulnerable: true, risk: 94, connections: ['db-pay', 'vault'] },
  { id: 'cdn', label: 'CDN Edge', x: 50, y: 35, size: 12, type: 'cloud', algorithm: 'TLS 1.2', vulnerable: true, risk: 65, connections: [] },
  { id: 'db-user', label: 'User DB', x: 12, y: 55, size: 14, type: 'database', algorithm: 'AES-256', vulnerable: false, risk: 18, connections: [] },
  { id: 'session', label: 'Session Store', x: 32, y: 55, size: 10, type: 'database', algorithm: 'AES-128', vulnerable: true, risk: 58, connections: [] },
  { id: 'db-pay', label: 'Payment DB', x: 68, y: 55, size: 14, type: 'database', algorithm: 'AES-256', vulnerable: false, risk: 22, connections: [] },
  { id: 'vault', label: 'PQC Vault', x: 88, y: 55, size: 12, type: 'server', algorithm: 'ML-KEM-768', vulnerable: false, risk: 5, connections: [] },
  { id: 'vpn', label: 'VPN Tunnel', x: 20, y: 78, size: 12, type: 'network', algorithm: 'DH-2048', vulnerable: true, risk: 78, connections: ['auth'] },
  { id: 'iot', label: 'IoT Sensors', x: 50, y: 78, size: 10, type: 'endpoint', algorithm: 'RSA-1024', vulnerable: true, risk: 96, connections: ['gw'] },
  { id: 'backup', label: 'Backup Svc', x: 80, y: 78, size: 10, type: 'cloud', algorithm: 'RSA-2048', vulnerable: true, risk: 81, connections: ['db-pay'] },
];

function getRiskColor(risk: number) {
  if (risk > 80) return '#ef4444';
  if (risk > 60) return '#f97316';
  if (risk > 40) return '#eab308';
  if (risk > 20) return '#22c55e';
  return '#10b981';
}

function getNodeIcon(type: MapNode['type']) {
  switch (type) {
    case 'server': return Server;
    case 'database': return Database;
    case 'cloud': return Cloud;
    case 'network': return Wifi;
    case 'endpoint': return Radio;
  }
}

export default function CryptoExposureMap() {
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const vulnerable = MAP_NODES.filter(n => n.vulnerable).length;
  const secured = MAP_NODES.filter(n => !n.vulnerable).length;

  // Animated particle canvas for background
  const drawParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width = canvas.offsetWidth;
    const h = canvas.height = canvas.offsetHeight;
    const t = Date.now() * 0.001;

    ctx.clearRect(0, 0, w, h);

    // Draw flowing particles
    for (let i = 0; i < 80; i++) {
      const x = ((i * 37.7 + t * 20) % (w + 40)) - 20;
      const y = ((i * 53.3 + Math.sin(t + i) * 30) % h);
      const alpha = 0.08 + Math.sin(t * 2 + i) * 0.04;
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,175,55,${alpha})`;
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(drawParticles);
  }, []);

  useEffect(() => {
    drawParticles();
    return () => cancelAnimationFrame(animRef.current);
  }, [drawParticles]);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Crypto Exposure <span className="text-gold">Map</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Interactive topology of cryptographic usage across your infrastructure with real-time risk heatmapping.</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="flex items-center gap-1.5 text-red-400"><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Vulnerable: {vulnerable}</span>
            <span className="text-white/10">|</span>
            <span className="flex items-center gap-1.5 text-green-400"><span className="h-2 w-2 rounded-full bg-green-500" /> Secured: {secured}</span>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Main Map */}
        <div className="lg:col-span-3 rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl relative overflow-hidden" style={{ minHeight: 520 }}>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(212,175,55,0.06),transparent_60%)]" />

          {/* SVG Map */}
          <svg className="w-full h-full relative z-10" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ minHeight: 520 }}>
            {/* Connection lines */}
            {MAP_NODES.flatMap(node =>
              node.connections.map(targetId => {
                const target = MAP_NODES.find(n => n.id === targetId);
                if (!target) return null;
                const isHighlighted = hoveredNode === node.id || hoveredNode === targetId;
                return (
                  <line
                    key={`${node.id}-${targetId}`}
                    x1={node.x} y1={node.y}
                    x2={target.x} y2={target.y}
                    stroke={isHighlighted ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={isHighlighted ? 0.4 : 0.15}
                    strokeDasharray={isHighlighted ? 'none' : '1 1'}
                  />
                );
              })
            )}

            {/* Nodes */}
            {MAP_NODES.map(node => {
              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode?.id === node.id;
              const color = getRiskColor(node.risk);
              const r = (node.size / 10) * 1.5;

              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(node)}
                >
                  {/* Risk halo */}
                  {node.vulnerable && (
                    <circle
                      cx={node.x} cy={node.y} r={r * 2.5}
                      fill="none" stroke={color} strokeWidth="0.15"
                      opacity={isHovered ? 0.6 : 0.2}
                    >
                      <animate attributeName="r" values={`${r*2};${r*3};${r*2}`} dur="3s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values={`${isHovered ? 0.6 : 0.3};0.05;${isHovered ? 0.6 : 0.3}`} dur="3s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Main circle */}
                  <circle
                    cx={node.x} cy={node.y} r={r}
                    fill={`${color}20`}
                    stroke={isSelected ? '#D4AF37' : color}
                    strokeWidth={isSelected ? 0.6 : 0.3}
                  />

                  {/* Center dot */}
                  <circle
                    cx={node.x} cy={node.y} r={r * 0.35}
                    fill={color}
                    opacity={isHovered ? 1 : 0.7}
                  />

                  {/* Label */}
                  <text
                    x={node.x} y={node.y + r + 2.5}
                    textAnchor="middle"
                    fill={isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}
                    fontSize="2"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {node.label}
                  </text>
                  <text
                    x={node.x} y={node.y + r + 4.5}
                    textAnchor="middle"
                    fill={`${color}80`}
                    fontSize="1.6"
                    fontFamily="monospace"
                  >
                    {node.algorithm}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          {/* Selected Node */}
          <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(212,175,55,0.05),transparent_50%)]" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-4 relative z-10">
              <Eye className="h-3.5 w-3.5 inline mr-2 text-gold/50" />
              Node Inspector
            </h3>
            {selectedNode ? (
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-3">
                  {(() => { const Icon = getNodeIcon(selectedNode.type); return <Icon className="h-5 w-5 text-gold" />; })()}
                  <div>
                    <div className="text-sm font-bold text-white">{selectedNode.label}</div>
                    <div className="text-[10px] text-white/40 font-mono">{selectedNode.type}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02]">
                    <div className="text-lg font-black" style={{ color: getRiskColor(selectedNode.risk) }}>{selectedNode.risk}</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Risk Score</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02]">
                    <div className="text-lg font-black text-white">{selectedNode.size}</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Crypto Ops</div>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02]">
                  <div className="text-[9px] uppercase tracking-wider text-white/30 font-bold mb-1">Algorithm</div>
                  <div className="text-xs font-mono font-bold text-white/70">{selectedNode.algorithm}</div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNode.vulnerable ? (
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1">
                      <Unlock className="h-3 w-3" /> Quantum Vulnerable
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-wider text-green-400 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Quantum Safe
                    </span>
                  )}
                </div>
                {selectedNode.vulnerable && (
                  <button className="w-full py-2 rounded-lg border border-gold/30 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-[0.15em] hover:bg-gold/20 transition-colors">
                    Initiate Migration
                  </button>
                )}
              </div>
            ) : (
              <div className="relative z-10 text-center py-8">
                <Globe className="h-8 w-8 text-gold/15 mx-auto mb-3" />
                <p className="text-[10px] text-white/25 uppercase tracking-wider font-bold">Select a node to inspect</p>
              </div>
            )}
          </div>

          {/* Risk Distribution */}
          <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl p-5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-3">Risk Distribution</h3>
            {[
              { label: 'Critical (80+)', count: MAP_NODES.filter(n => n.risk > 80).length, color: '#ef4444' },
              { label: 'High (60-80)', count: MAP_NODES.filter(n => n.risk > 60 && n.risk <= 80).length, color: '#f97316' },
              { label: 'Medium (40-60)', count: MAP_NODES.filter(n => n.risk > 40 && n.risk <= 60).length, color: '#eab308' },
              { label: 'Low (0-40)', count: MAP_NODES.filter(n => n.risk <= 40).length, color: '#22c55e' },
            ].map(level => (
              <div key={level.label} className="flex items-center gap-3 py-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: level.color }} />
                <span className="text-[10px] text-white/40 font-bold flex-1">{level.label}</span>
                <span className="text-xs font-black text-white/60">{level.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
