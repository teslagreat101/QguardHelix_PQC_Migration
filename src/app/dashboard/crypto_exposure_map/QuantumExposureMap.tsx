import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Server, Database, Shield, AlertTriangle,
  Lock, Unlock, Wifi, Cloud, Radio, Eye, Info, RefreshCw
} from 'lucide-react';
import { ExposureNode, ExposureEdge, dashboardService } from '@/lib/dashboard-service';

interface Props {
  data: { nodes: ExposureNode[]; edges: ExposureEdge[] };
  loading: boolean;
  onRefresh?: () => void;
}

function getRiskColor(riskScore: number) {
  if (riskScore > 10) return '#ef4444'; // Scale might be different, adjusting
  if (riskScore > 5) return '#f97316';
  if (riskScore > 2) return '#eab308';
  if (riskScore > 0) return '#22c55e';
  return '#10b981';
}

const TYPE_ICONS = {
  server: Server,
  api: Radio,
  database: Database,
  application: Globe,
  cloud_resource: Cloud,
  certificate: Shield,
  vault: Lock,
};

export default function QuantumExposureMap({ data, loading, onRefresh }: Props) {
  const [selectedNode, setSelectedNode] = useState<ExposureNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Simple layout simulation (randomish but grouped by environment)
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number, y: number }>>({});

  useEffect(() => {
    if (data.nodes.length > 0) {
      const positions: Record<string, { x: number, y: number }> = {};
      data.nodes.forEach((node, i) => {
        // Deterministic random positions based on ID
        const seed = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const x = 10 + (seed % 80);
        const y = 10 + ((seed * 1.3) % 80);
        positions[node.id] = { x, y };
      });
      setNodePositions(positions);
    }
  }, [data.nodes]);

  const drawParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width = canvas.offsetWidth;
    const h = canvas.height = canvas.offsetHeight;
    const t = Date.now() * 0.001;

    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < 40; i++) {
      const x = ((i * 37.7 + t * 15) % (w + 40)) - 20;
      const y = ((i * 53.3 + Math.sin(t + i) * 20) % h);
      const alpha = 0.05 + Math.sin(t * 1.5 + i) * 0.03;
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,175,55,${alpha})`;
      ctx.fill();
    }

    animRef.current = requestAnimationFrame(drawParticles);
  }, []);

  useEffect(() => {
    drawParticles();
    return () => cancelAnimationFrame(animRef.current);
  }, [drawParticles]);

  if (loading && data.nodes.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center border border-gold/10 bg-[#0f1428]/40 rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[10px] text-gold/50 uppercase font-black tracking-widest">Synthesizing Topology...</p>
        </div>
      </div>
    );
  }

  if (!loading && data.nodes.length === 0) {
    return (
      <div className="h-[500px] flex items-center justify-center border border-gold/10 bg-[#0f1428]/40 rounded-xl p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gold/5 border border-gold/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Globe className="w-8 h-8 text-gold/30" />
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">No Assets Detected</h3>
          <p className="text-white/40 text-sm mb-6">Start a PQC Discovery Scan or import your infrastructure to visualize cryptographic exposure paths.</p>
          <div className="flex gap-3 justify-center">
            <button className="px-4 py-2 bg-gold/10 border border-gold/30 text-gold text-[10px] font-black uppercase tracking-widest rounded hover:bg-gold/20 transition-all">
              Start Discovery
            </button>
            <button className="px-4 py-2 bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase tracking-widest rounded hover:bg-white/10 transition-all">
              Import CBOM
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl relative overflow-hidden h-[500px]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        
        <div className="absolute top-4 left-4 z-20 flex gap-2">
            <button onClick={onRefresh} className="p-2 bg-[#0f1428]/40 border border-gold/20 rounded hover:border-gold/50 transition-colors group">
                <RefreshCw className={`w-3.5 h-3.5 text-gold/60 group-hover:text-gold ${loading ? 'animate-spin' : ''}`} />
            </button>
        </div>

        <svg className="w-full h-full relative z-10" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* Edges */}
          {data.edges.map((edge, i) => {
            const source = nodePositions[edge.source];
            const target = nodePositions[edge.target];
            if (!source || !target) return null;
            const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
            return (
              <line
                key={`edge-${i}`}
                x1={source.x} y1={source.y}
                x2={target.x} y2={target.y}
                stroke={isHighlighted ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.05)'}
                strokeWidth={isHighlighted ? 0.4 : 0.2}
                strokeDasharray={isHighlighted ? 'none' : '1 1'}
              />
            );
          })}

          {/* Nodes */}
          {data.nodes.map(node => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode?.id === node.id;
            const color = getRiskColor(node.riskScore);
            const r = isHovered ? 2.2 : 1.8;

            return (
              <g
                key={node.id}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => setSelectedNode(node)}
              >
                {node.riskScore > 0 && (
                  <circle
                    cx={pos.x} cy={pos.y} r={r * 2.5}
                    fill="none" stroke={color} strokeWidth="0.1"
                    opacity={isHovered ? 0.6 : 0.2}
                  >
                    <animate attributeName="r" values={`${r*2};${r*3};${r*2}`} dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.3;0.05;0.3" dur="3s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={pos.x} cy={pos.y} r={r}
                  fill={`${color}20`}
                  stroke={isSelected ? '#D4AF37' : color}
                  strokeWidth={isSelected ? 0.6 : 0.3}
                />
                <circle
                    cx={pos.x} cy={pos.y} r={r * 0.3}
                    fill={color}
                    opacity={isHovered ? 1 : 0.7}
                  />
                <text
                  x={pos.x} y={pos.y + r + 2.5}
                  textAnchor="middle"
                  fill={isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)'}
                  fontSize="1.8"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {node.name.length > 15 ? node.name.slice(0, 12) + '...' : node.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute bottom-4 left-4 z-20 flex gap-4 text-[8px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Critical</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> High</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Moderate</div>
            <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Secure</div>
        </div>
      </div>

      {/* Detail Inspector */}
      <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-5 flex flex-col h-[500px]">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-4 flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-gold/50" />
          Node Inspector
        </h3>
        
        {selectedNode ? (
          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-gold/10 border border-gold/20 flex items-center justify-center">
                {(() => {
                    const Icon = TYPE_ICONS[selectedNode.type as keyof typeof TYPE_ICONS] || Server;
                    return <Icon className="w-5 h-5 text-gold" />;
                })()}
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-tight">{selectedNode.name}</div>
                <div className="text-[10px] text-white/40 font-mono uppercase">{selectedNode.type}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-xs text-white/30 font-bold uppercase mb-1">Risk Score</div>
                    <div className={`text-xl font-black ${getRiskColor(selectedNode.riskScore) === '#ef4444' ? 'text-red-500' : 'text-gold'}`}>
                        {selectedNode.riskScore.toFixed(1)}
                    </div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="text-xs text-white/30 font-bold uppercase mb-1">Status</div>
                    <div className="text-xs font-black text-white/80 uppercase">{selectedNode.status}</div>
                </div>
            </div>

            <div className="space-y-2">
                <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Environment</div>
                <div className="px-2 py-1 bg-white/5 rounded border border-white/10 text-[10px] font-mono text-white/60 inline-block uppercase">
                    {selectedNode.environment}
                </div>
            </div>

            <div className="space-y-2">
                <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Remediation</div>
                <div className="p-3 rounded-lg bg-gold/5 border border-gold/10 text-[10px] text-gold/70 leading-relaxed italic">
                    {selectedNode.riskScore > 5 
                      ? "High-priority upgrade recommended. Migrate to ML-KEM-768 for quantum-safe key encapsulation."
                      : "Low risk detected. Monitor for cryptographic drift and schedule periodic key rotation."}
                </div>
            </div>

            <button className="w-full py-2.5 bg-gold/10 border border-gold/30 text-gold text-[10px] font-black uppercase tracking-[0.2em] rounded-lg hover:bg-gold/20 transition-all mt-4">
                Deploy PQC Agent
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
            <Info className="w-8 h-8 mb-4 text-gold" />
            <p className="text-[10px] uppercase font-black tracking-widest">Select Node for Analysis</p>
          </div>
        )}
      </div>
    </div>
  );
}
