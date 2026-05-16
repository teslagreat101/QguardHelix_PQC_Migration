import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Globe, Server, Database, Shield, Lock, Unlock,
  Wifi, Cloud, Radio, Eye, Loader2, RefreshCw, ExternalLink
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

type MapNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  size: number;
  type: string;
  assetType: string;
  algorithm: string;
  vulnerable: boolean;
  risk: number;
  connections: string[];
  pqcReadiness: string;
  linkedFindings: Array<{
    id: string;
    algorithm: string;
    category: string;
    status: string;
    evidence?: string;
  }>;
  recommendedMigrationPath: string | null;
};

type RiskDistribution = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

function getRiskColor(risk: number) {
  if (risk >= 80) return '#ef4444';
  if (risk >= 60) return '#f97316';
  if (risk >= 40) return '#eab308';
  if (risk >= 20) return '#22c55e';
  return '#10b981';
}

function getNodeIcon(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('database')) return Database;
  if (lower.includes('cloud')) return Cloud;
  if (lower.includes('network') || lower.includes('ssh')) return Wifi;
  if (lower.includes('endpoint')) return Radio;
  if (lower.includes('certificate') || lower.includes('tls')) return Lock;
  return Server;
}

export default function CryptoExposureMap() {
  const { session } = useAuth();
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [distribution, setDistribution] = useState<RiskDistribution>({ critical: 0, high: 0, medium: 0, low: 0 });
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const fetchMap = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/scanner/exposure-map', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Unable to load exposure map');
      setNodes(json?.data?.nodes || []);
      setDistribution(json?.data?.distribution || { critical: 0, high: 0, medium: 0, low: 0 });
      setSelectedNode((current) => {
        if (!current) return null;
        return (json?.data?.nodes || []).find((node: MapNode) => node.id === current.id) || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load exposure map');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);

  const drawParticles = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width = canvas.offsetWidth;
    const h = canvas.height = canvas.offsetHeight;
    const t = Date.now() * 0.001;

    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) {
      const x = ((i * 37.7 + t * 20) % (w + 40)) - 20;
      const y = ((i * 53.3 + Math.sin(t + i) * 30) % h);
      const alpha = 0.06 + Math.sin(t * 2 + i) * 0.03;
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

  const vulnerable = nodes.filter((node) => node.vulnerable).length;
  const secured = nodes.filter((node) => !node.vulnerable && node.linkedFindings.length > 0).length;

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            Crypto Exposure <span className="text-gold">Map</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Interactive topology of authorized cryptographic scan results and PQC readiness.</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 text-[10px] font-bold">
            <span className="flex items-center gap-1.5 text-red-400"><span className="h-2 w-2 rounded-full bg-red-500" /> Vulnerable: {vulnerable}</span>
            <span className="text-white/10">|</span>
            <span className="flex items-center gap-1.5 text-green-400"><span className="h-2 w-2 rounded-full bg-green-500" /> Secured: {secured}</span>
          </div>
          <button onClick={fetchMap} className="px-3 py-2 rounded-lg border border-gold/20 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl relative overflow-hidden" style={{ minHeight: 520 }}>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(212,175,55,0.06),transparent_60%)]" />

          {loading ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center text-gold/70 font-black uppercase tracking-widest">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading Exposure Map
            </div>
          ) : nodes.length === 0 ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6">
              <Globe className="h-10 w-10 text-gold/20 mb-4" />
              <div className="text-white/30 uppercase tracking-widest text-xs font-black mb-4">
                No authorized crypto exposure data yet
              </div>
              <a href="/dashboard/scanner" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gold/30 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-wider">
                <ExternalLink className="h-3.5 w-3.5" /> Start Authorized Scan
              </a>
            </div>
          ) : (
            <svg className="w-full h-full relative z-10" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ minHeight: 520 }}>
              {nodes.flatMap((node) =>
                node.connections.map((targetId) => {
                  const target = nodes.find((item) => item.id === targetId);
                  if (!target) return null;
                  const isHighlighted = hoveredNode === node.id || hoveredNode === targetId;
                  return (
                    <line
                      key={`${node.id}-${targetId}`}
                      x1={node.x}
                      y1={node.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={isHighlighted ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.08)'}
                      strokeWidth={isHighlighted ? 0.4 : 0.15}
                      strokeDasharray={isHighlighted ? 'none' : '1 1'}
                    />
                  );
                })
              )}

              {nodes.map((node) => {
                const isHovered = hoveredNode === node.id;
                const isSelected = selectedNode?.id === node.id;
                const color = getRiskColor(node.risk);
                const r = (node.size / 10) * 1.5;

                return (
                  <g key={node.id} className="cursor-pointer" onMouseEnter={() => setHoveredNode(node.id)} onMouseLeave={() => setHoveredNode(null)} onClick={() => setSelectedNode(node)}>
                    {node.vulnerable && (
                      <circle cx={node.x} cy={node.y} r={r * 2.5} fill="none" stroke={color} strokeWidth="0.15" opacity={isHovered ? 0.6 : 0.2}>
                        <animate attributeName="r" values={`${r * 2};${r * 3};${r * 2}`} dur="3s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values={`${isHovered ? 0.6 : 0.3};0.05;${isHovered ? 0.6 : 0.3}`} dur="3s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle cx={node.x} cy={node.y} r={r} fill={`${color}20`} stroke={isSelected ? '#D4AF37' : color} strokeWidth={isSelected ? 0.6 : 0.3} />
                    <circle cx={node.x} cy={node.y} r={r * 0.35} fill={color} opacity={isHovered ? 1 : 0.7} />
                    <text x={node.x} y={node.y + r + 2.5} textAnchor="middle" fill={isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'} fontSize="2" fontFamily="monospace" fontWeight="bold">
                      {node.label}
                    </text>
                    <text x={node.x} y={node.y + r + 4.5} textAnchor="middle" fill={`${color}90`} fontSize="1.6" fontFamily="monospace">
                      {node.algorithm}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(212,175,55,0.05),transparent_50%)]" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-4 relative z-10">
              <Eye className="h-3.5 w-3.5 inline mr-2 text-gold/50" /> Node Inspector
            </h3>
            {selectedNode ? (
              <div className="relative z-10 space-y-3">
                <div className="flex items-center gap-3">
                  {(() => { const Icon = getNodeIcon(selectedNode.assetType || selectedNode.type); return <Icon className="h-5 w-5 text-gold" />; })()}
                  <div>
                    <div className="text-sm font-bold text-white">{selectedNode.label}</div>
                    <div className="text-[10px] text-white/40 font-mono">{selectedNode.assetType}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02]">
                    <div className="text-lg font-black" style={{ color: getRiskColor(selectedNode.risk) }}>{selectedNode.risk}</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Risk Score</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02]">
                    <div className="text-lg font-black text-white">{selectedNode.linkedFindings.length}</div>
                    <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Findings</div>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02]">
                  <div className="text-[9px] uppercase tracking-wider text-white/30 font-bold mb-1">Detected Algorithm</div>
                  <div className="text-xs font-mono font-bold text-white/70">{selectedNode.algorithm}</div>
                </div>
                <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.02]">
                  <div className="text-[9px] uppercase tracking-wider text-white/30 font-bold mb-1">Migration Path</div>
                  <div className="text-xs text-gold/80">{selectedNode.recommendedMigrationPath || 'Manual review'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNode.vulnerable ? (
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1"><Unlock className="h-3 w-3" /> {selectedNode.pqcReadiness}</span>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-wider text-green-400 flex items-center gap-1"><Shield className="h-3 w-3" /> {selectedNode.pqcReadiness}</span>
                  )}
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {selectedNode.linkedFindings.map((finding) => (
                    <div key={finding.id} className="rounded-lg border border-gold/10 bg-white/[0.02] p-2">
                      <div className="text-[10px] font-bold text-white/70">{finding.algorithm}</div>
                      <div className="text-[9px] text-white/35">{finding.category} - {finding.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative z-10 text-center py-8">
                <Globe className="h-8 w-8 text-gold/15 mx-auto mb-3" />
                <p className="text-[10px] text-white/25 uppercase tracking-wider font-bold">Select a node to inspect</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gold/15 bg-[#0f1428]/50 backdrop-blur-xl p-5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/50 mb-3">Risk Distribution</h3>
            {[
              { label: 'Critical (80+)', count: distribution.critical, color: '#ef4444' },
              { label: 'High (60-79)', count: distribution.high, color: '#f97316' },
              { label: 'Medium (40-59)', count: distribution.medium, color: '#eab308' },
              { label: 'Low (0-39)', count: distribution.low, color: '#22c55e' },
            ].map((level) => (
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
