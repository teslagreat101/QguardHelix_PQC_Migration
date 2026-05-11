import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, X, Server, Globe, Database, Lock, Cloud, Cpu, Wifi, HardDrive } from 'lucide-react'
import type { ExposureNode, ExposureEdge, LoadingState } from '@/hooks/use-dashboard'

interface ExposureMapProps {
  nodes: ExposureNode[]
  edges: ExposureEdge[]
  loading: LoadingState
  onNodeClick?: (node: ExposureNode) => void
  onStartScan?: () => void
}

const typeIcons: Record<string, any> = {
  server: Server,
  api: Globe,
  database: Database,
  application: Cpu,
  certificate: Lock,
  vault: Shield,
  cloud_resource: Cloud,
  communication: Wifi,
  default: HardDrive,
}

const riskColors = {
  critical: '#ef4444',
  high: '#f97316',
  moderate: '#eab308',
  low: '#3b82f6',
  safe: '#10b981',
}

interface SimulationNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  data: ExposureNode
  radius: number
}

interface SimulationEdge {
  source: string
  target: string
}

function runForceSimulation(
  containerWidth: number,
  containerHeight: number,
  nodes: ExposureNode[],
  edges: ExposureEdge[],
  iterations = 100
): { simNodes: SimulationNode[]; simEdges: SimulationEdge[] } {
  const centerX = containerWidth / 2
  const centerY = containerHeight / 2

  const simNodes: SimulationNode[] = nodes.map((n, i) => ({
    id: n.id,
    x: centerX + (Math.random() - 0.5) * 100,
    y: centerY + (Math.random() - 0.5) * 100,
    vx: 0,
    vy: 0,
    data: n,
    radius: n.type === 'cloud_resource' ? 28 : n.criticality === 'critical' ? 24 : n.criticality === 'high' ? 20 : 16,
  }))

  const simEdges: SimulationEdge[] = edges.map(e => ({ source: e.source, target: e.target }))

  const nodeMap = new Map(simNodes.map(n => [n.id, n]))

  for (let i = 0; i < iterations; i++) {
    // Repulsion
    for (let a = 0; a < simNodes.length; a++) {
      for (let b = a + 1; b < simNodes.length; b++) {
        const na = simNodes[a]
        const nb = simNodes[b]
        const dx = nb.x - na.x
        const dy = nb.y - na.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = 2000 / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        na.vx -= fx
        na.vy -= fy
        nb.vx += fx
        nb.vy += fy
      }
    }

    // Attraction along edges
    for (const edge of simEdges) {
      const na = nodeMap.get(edge.source)
      const nb = nodeMap.get(edge.target)
      if (!na || !nb) continue
      const dx = nb.x - na.x
      const dy = nb.y - na.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist - 100) * 0.01
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      na.vx += fx
      na.vy += fy
      nb.vx -= fx
      nb.vy -= fy
    }

    // Center gravity
    for (const node of simNodes) {
      node.vx += (centerX - node.x) * 0.001
      node.vy += (centerY - node.y) * 0.001
    }

    // Apply velocity with damping
    for (const node of simNodes) {
      node.vx *= 0.6
      node.vy *= 0.6
      node.x += node.vx
      node.y += node.vy

      // Bounds
      const margin = node.radius + 10
      node.x = Math.max(margin, Math.min(containerWidth - margin, node.x))
      node.y = Math.max(margin, Math.min(containerHeight - margin, node.y))
    }
  }

  return { simNodes, simEdges }
}

export function ExposureMap({ nodes, edges, loading, onNodeClick, onStartScan }: ExposureMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [simulation, setSimulation] = useState<{ simNodes: SimulationNode[]; simEdges: SimulationEdge[] }>({ simNodes: [], simEdges: [] })
  const [selectedNode, setSelectedNode] = useState<SimulationNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0 || nodes.length === 0) return
    const sim = runForceSimulation(dimensions.width, dimensions.height, nodes, edges)
    setSimulation(sim)
  }, [dimensions.width, dimensions.height, nodes, edges])

  const handleMouseDown = useCallback((e: React.MouseEvent, node: SimulationNode) => {
    e.stopPropagation()
    setDraggingNode(node.id)
    const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect()
    dragOffset.current = {
      x: e.clientX - rect.left - node.x,
      y: e.clientY - rect.top - node.y,
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNode || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - dragOffset.current.x
    const y = e.clientY - rect.top - dragOffset.current.y

    setSimulation(prev => ({
      ...prev,
      simNodes: prev.simNodes.map(n =>
        n.id === draggingNode ? { ...n, x, y } : n
      ),
    }))
  }, [draggingNode])

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null)
  }, [])

  const isLoading = loading === 'loading'
  const isEmpty = !isLoading && nodes.length === 0
  const isOffline = loading === 'offline'

  return (
    <div className="lg:col-span-2 border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6 h-[400px] flex flex-col relative">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Quantum Exposure Map</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
              {nodes.filter(n => n.status !== 'migrated' && n.status !== 'protected').length} Exposed
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Critical</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />High</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Moderate</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Safe</div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 rounded-lg border border-gold/10 bg-black/20 relative overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid background */}
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(212,175,55,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.3)_1px,transparent_1px)] [background-size:20px_20px]" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="h-48 w-48 rounded-full border-2 border-gold/20 border-dashed animate-[spin_20s_linear_infinite] flex items-center justify-center mx-auto">
                <div className="h-32 w-32 rounded-full border-2 border-gold/40 border-dashed animate-[spin_15s_linear_infinite_reverse] flex items-center justify-center">
                  <Shield className="h-12 w-12 text-gold opacity-50" />
                </div>
              </div>
              <p className="mt-4 text-[10px] text-gold/40 uppercase font-black tracking-[0.3em]">Mapping Enterprise Topology...</p>
            </div>
          </div>
        )}

        {isEmpty && !isOffline && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto">
                <Shield className="h-8 w-8 text-gold/40" />
              </div>
              <div>
                <p className="text-sm text-white/60 font-bold">No assets discovered yet</p>
                <p className="text-[10px] text-white/30 mt-1">Run a PQC scan to map your enterprise cryptography</p>
              </div>
              <button
                onClick={onStartScan}
                className="px-4 py-2 bg-gold/10 border border-gold/20 rounded-lg text-xs font-bold text-gold hover:bg-gold/20 transition-colors"
              >
                Start PQC Discovery Scan
              </button>
            </div>
          </div>
        )}

        {isOffline && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
                <Wifi className="h-5 w-5 text-yellow-500/60" />
              </div>
              <p className="text-xs text-white/40 font-medium">Map data unavailable offline</p>
            </div>
          </div>
        )}

        {!isLoading && !isEmpty && (
          <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
            {/* Edges */}
            {simulation.simEdges.map((edge, i) => {
              const source = simulation.simNodes.find(n => n.id === edge.source)
              const target = simulation.simNodes.find(n => n.id === edge.target)
              if (!source || !target) return null
              return (
                <line
                  key={`edge-${i}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(212,175,55,0.15)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              )
            })}

            {/* Nodes */}
            {simulation.simNodes.map((node) => {
              const Icon = typeIcons[node.data.type] || typeIcons.default
              const isHovered = hoveredNode === node.id
              const isSelected = selectedNode?.id === node.id
              const color = node.data.color || riskColors.moderate

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onMouseDown={(e) => handleMouseDown(e, node)}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedNode(node)
                    onNodeClick?.(node.data)
                  }}
                  className="cursor-pointer"
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow effect */}
                  {(isHovered || isSelected) && (
                    <circle
                      r={node.radius + 8}
                      fill={color}
                      opacity={0.15}
                      className="animate-pulse"
                    />
                  )}
                  {/* Outer ring */}
                  <circle
                    r={node.radius}
                    fill="rgba(0,0,0,0.6)"
                    stroke={color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    opacity={isHovered ? 1 : 0.8}
                  />
                  {/* Icon background */}
                  <circle r={node.radius - 4} fill="rgba(0,0,0,0.8)" />
                  {/* Icon placeholder - use foreignObject for Lucide icons */}
                  <foreignObject x={-10} y={-10} width={20} height={20} style={{ pointerEvents: 'none' }}>
                    <div className="flex items-center justify-center w-full h-full">
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                  </foreignObject>
                  {/* Label */}
                  <text
                    y={node.radius + 14}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.7)"
                    fontSize={10}
                    fontWeight={600}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.data.name.length > 14 ? node.data.name.slice(0, 12) + '...' : node.data.name}
                  </text>
                </g>
              )
            })}
          </svg>
        )}

        {/* Node Detail Drawer */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute right-2 top-2 bottom-2 w-64 bg-black/90 border border-gold/20 rounded-lg p-4 overflow-y-auto z-10"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider truncate pr-2">{selectedNode.data.name}</h3>
                <button onClick={() => setSelectedNode(null)} className="text-white/30 hover:text-white/60">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-white/30 uppercase font-bold">Type</span>
                  <span className="text-white/70 font-mono">{selectedNode.data.type}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-white/30 uppercase font-bold">Environment</span>
                  <span className="text-white/70 font-mono">{selectedNode.data.environment || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-white/30 uppercase font-bold">Criticality</span>
                  <span className={`font-mono font-bold ${
                    selectedNode.data.criticality === 'critical' ? 'text-red-500' :
                    selectedNode.data.criticality === 'high' ? 'text-orange-500' :
                    selectedNode.data.criticality === 'medium' ? 'text-yellow-500' :
                    'text-blue-400'
                  }`}>
                    {selectedNode.data.criticality}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-white/30 uppercase font-bold">Status</span>
                  <span className="text-white/70 font-mono">{selectedNode.data.status}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-white/30 uppercase font-bold">Risk Score</span>
                  <span className="text-white/70 font-mono">{selectedNode.data.riskScore}</span>
                </div>

                <div className="border-t border-white/5 pt-3">
                  <div className="text-[10px] text-white/30 uppercase font-bold mb-2">Recommended Remediation</div>
                  <div className="text-[10px] text-white/50 leading-relaxed">
                    {selectedNode.data.status === 'migrated' || selectedNode.data.status === 'protected'
                      ? 'Asset is quantum-ready. Continue monitoring for crypto drift.'
                      : 'Run PQC migration to replace vulnerable algorithms. Consider hybrid mode for high-availability assets.'}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
