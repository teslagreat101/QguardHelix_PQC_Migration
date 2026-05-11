import { useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle, Zap, Activity, TrendingUp, Search, RefreshCw, Wifi, WifiOff, Radio, ScanSearch, ArrowRight } from 'lucide-react'
import { useDashboard } from '@/hooks/use-dashboard'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ExposureMap } from '@/components/dashboard/ExposureMap'
import { SecurityEvents } from '@/components/dashboard/SecurityEvents'
import { Recommendations } from '@/components/dashboard/Recommendations'
import type { ExposureNode } from '@/hooks/use-dashboard'

export default function DashboardOverview() {
  const {
    summary,
    events,
    exposureMap,
    recommendations,
    health,
    summaryState,
    eventsState,
    mapState,
    recommendationsState,
    lastSyncAt,
    sseConnected,
    refreshAll,
  } = useDashboard()

  const [selectedNode, setSelectedNode] = useState<ExposureNode | null>(null)
  const [showRiskDetails, setShowRiskDetails] = useState(false)

  // Monitoring status badge
  const monitoringStatus = health?.services?.scanner === 'scanning'
    ? { label: 'Scanning', color: 'text-blue-400 border-blue-400/30 bg-blue-400/10', icon: ScanSearch }
    : health?.services?.migration === 'migrating'
    ? { label: 'Migrating', color: 'text-orange-400 border-orange-400/30 bg-orange-400/10', icon: Zap }
    : health?.status === 'healthy'
    ? { label: 'Live Monitoring Active', color: 'text-green-400 border-green-400/30 bg-green-400/10', icon: Radio }
    : health?.status === 'degraded'
    ? { label: 'Degraded', color: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10', icon: Wifi }
    : { label: 'Offline', color: 'text-red-400 border-red-400/30 bg-red-400/10', icon: WifiOff }

  const StatusIcon = monitoringStatus.icon

  const isLoading = summaryState === 'loading'
  const isError = summaryState === 'error'
  const isOffline = summaryState === 'offline'

  // Build metric cards from real data
  const riskScore = summary?.quantumRiskScore ?? 0
  const riskColor = riskScore >= 900 ? 'text-green-500' : riskScore >= 700 ? 'text-blue-400' : riskScore >= 400 ? 'text-yellow-500' : 'text-red-500'
  const riskBand = summary?.riskBand || 'Unknown'
  const trendText = summary?.riskTrend !== undefined && summary.riskTrend !== 0
    ? `${summary.riskTrend > 0 ? '↑' : '↓'} ${Math.abs(summary.riskTrend)} since last scan`
    : 'No previous scan data'

  const metricCards = [
    {
      label: 'Quantum Risk Score',
      value: riskScore,
      icon: Shield,
      color: riskColor,
      trend: `${riskBand} · ${trendText}`,
      trendValue: summary?.riskTrend ?? 0,
      onClick: () => setShowRiskDetails(true),
    },
    {
      label: 'Vulnerable Assets',
      value: summary?.vulnerableAssetsCount ?? 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      trend: summary?.newVulnerableAssets ? `+${summary.newVulnerableAssets} new since last scan` : 'No new exposures detected',
      trendValue: -(summary?.newVulnerableAssets ?? 0),
    },
    {
      label: 'Total CBOM Items',
      value: summary?.totalCbomItems ?? 0,
      icon: Search,
      color: 'text-blue-400',
      trend: 'Cryptographic inventory',
      trendValue: 0,
    },
    {
      label: 'Active Migrations',
      value: summary?.activeMigrations ?? 0,
      icon: Zap,
      color: 'text-gold',
      trend: summary?.failedMigrations ? `${summary.failedMigrations} failed — review needed` : 'All systems operational',
      trendValue: summary?.failedMigrations ? -1 : 0,
    },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter text-white">
            Quantum Risk <span className="text-gold">Intelligence</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">
            Enterprise-wide cryptographic posture and exposure analysis.
            {lastSyncAt && (
              <span className="ml-2 text-white/30 text-[10px] font-mono">
                Synced {new Date(lastSyncAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-2 border rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${monitoringStatus.color}`}>
            <StatusIcon className={`h-3 w-3 ${health?.status === 'healthy' ? 'animate-pulse' : ''}`} />
            {monitoringStatus.label}
            {sseConnected && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="SSE Connected" />
            )}
          </div>
          <button
            onClick={refreshAll}
            disabled={isLoading}
            className="p-2 border border-gold/20 bg-gold/5 rounded text-gold hover:bg-gold/10 transition-colors disabled:opacity-30"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Error State */}
      {isError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border border-red-500/30 bg-red-500/10 rounded-xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-sm font-bold text-red-400">Dashboard data unavailable</p>
              <p className="text-[10px] text-white/40">Check your network connection and try again.</p>
            </div>
          </div>
          <button
            onClick={refreshAll}
            className="px-4 py-2 border border-red-400/30 bg-red-400/10 rounded-lg text-xs font-bold text-red-400 hover:bg-red-400/20 transition-colors"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Offline State Banner */}
      {isOffline && !isError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 border border-yellow-500/20 bg-yellow-500/5 rounded-xl flex items-center gap-3"
        >
          <WifiOff className="h-4 w-4 text-yellow-500/60" />
          <p className="text-xs text-yellow-500/70 font-medium">
            Working offline. Displaying last known data from {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'previous session'}.
          </p>
        </motion.div>
      )}

      {/* Empty State — No assets */}
      {!isLoading && !isError && summary && summary.totalAssets === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl text-center space-y-4"
        >
          <div className="h-16 w-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto">
            <Shield className="h-8 w-8 text-gold/40" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">No Assets Scanned Yet</h2>
            <p className="text-sm text-white/40 max-w-md mx-auto">
              Your dashboard is ready. Start a PQC discovery scan to identify quantum-vulnerable cryptography across your enterprise.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a
              href="/dashboard/scanner"
              className="px-5 py-2.5 bg-gold/10 border border-gold/20 rounded-lg text-sm font-bold text-gold hover:bg-gold/20 transition-colors inline-flex items-center gap-2"
            >
              <ScanSearch className="h-4 w-4" />
              Start PQC Discovery Scan
            </a>
            <a
              href="/dashboard/assets"
              className="px-5 py-2.5 border border-white/10 rounded-lg text-sm font-bold text-white/60 hover:text-white hover:border-white/20 transition-colors inline-flex items-center gap-2"
            >
              Import Assets
            </a>
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {metricCards.map((stat, i) => (
          <MetricCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            trend={stat.trend}
            trendValue={stat.trendValue}
            loading={summaryState}
            index={i}
            onClick={'onClick' in stat ? stat.onClick : undefined}
          />
        ))}
      </div>

      {/* Exposure Map + Security Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ExposureMap
          nodes={exposureMap.nodes}
          edges={exposureMap.edges}
          loading={mapState}
          onNodeClick={(node) => setSelectedNode(node)}
          onStartScan={() => window.location.href = '/dashboard/scanner'}
        />
        <SecurityEvents
          events={events}
          loading={eventsState}
        />
      </div>

      {/* Recommendations + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Recommendations
          recommendations={recommendations}
          loading={recommendationsState}
        />

        {/* Activity Feed */}
        <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/80 mb-4">Recent Activity</h2>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
            {recommendationsState === 'loading' && (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-3 p-3 border border-white/5 rounded-lg bg-white/[0.02]">
                    <div className="h-8 w-8 rounded bg-white/5 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-20 bg-white/5 animate-pulse rounded" />
                      <div className="h-3 w-full bg-white/5 animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {recommendationsState !== 'loading' && (
              <>
                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <a href="/dashboard/scanner" className="p-3 border border-white/5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] hover:border-gold/20 transition-all group">
                    <div className="flex items-center gap-2 mb-1">
                      <ScanSearch className="h-3.5 w-3.5 text-gold/60 group-hover:text-gold" />
                      <span className="text-[10px] font-bold text-white/50 uppercase">Scan</span>
                    </div>
                    <p className="text-[11px] text-white/70">Run PQC vulnerability scan</p>
                  </a>
                  <a href="/dashboard/migration-planner" className="p-3 border border-white/5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] hover:border-gold/20 transition-all group">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-3.5 w-3.5 text-gold/60 group-hover:text-gold" />
                      <span className="text-[10px] font-bold text-white/50 uppercase">Migrate</span>
                    </div>
                    <p className="text-[11px] text-white/70">Plan PQC migration path</p>
                  </a>
                </div>

                {/* Placeholder for future activity feed integration */}
                <div className="text-center py-4">
                  <p className="text-[10px] text-white/20 uppercase font-bold tracking-wider">Activity timeline coming in v2.1</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Risk Score Details Modal */}
      {showRiskDetails && summary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRiskDetails(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-black/90 border border-gold/20 rounded-xl p-6 max-w-lg w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Quantum Risk Score</h3>
              <button onClick={() => setShowRiskDetails(false)} className="text-white/30 hover:text-white/60">
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className={`text-5xl font-black mb-2 ${riskColor}`}>{summary.quantumRiskScore}</div>
            <div className="text-sm font-bold text-white/60 mb-6">{summary.riskBand}</div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-white/40">Critical Exposures</span>
                <span className="text-xs font-bold text-red-400">{summary.criticalExposures}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-white/40">High Exposures</span>
                <span className="text-xs font-bold text-orange-400">{summary.highExposures}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-white/40">Unresolved Vulnerabilities</span>
                <span className="text-xs font-bold text-yellow-400">{summary.unresolvedVulns}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-white/40">Expiring Certificates (30d)</span>
                <span className="text-xs font-bold text-blue-400">{summary.expiringCerts}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-white/40">Failed Migrations</span>
                <span className="text-xs font-bold text-red-400">{summary.failedMigrations}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-white/40">Total Active Assets</span>
                <span className="text-xs font-bold text-white/70">{summary.totalAssets}</span>
              </div>
            </div>

            <div className="mt-6 p-3 bg-gold/5 border border-gold/10 rounded-lg">
              <p className="text-[10px] text-gold/60 leading-relaxed">
                <strong className="text-gold/80">Score Calculation:</strong> Starting from 1000 points.
                Deducts based on critical/high exposures, unresolved vulnerabilities, expiring certificates,
                and failed migrations. Higher scores indicate better quantum readiness.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Node Detail Modal */}
      {selectedNode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedNode(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onClick={e => e.stopPropagation()}
            className="bg-black/90 border border-gold/20 rounded-xl p-6 max-w-lg w-full shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white uppercase tracking-tight truncate pr-4">{selectedNode.name}</h3>
              <button onClick={() => setSelectedNode(null)} className="text-white/30 hover:text-white/60 shrink-0">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-2 bg-white/[0.03] rounded border border-white/5">
                <div className="text-[9px] text-white/30 uppercase font-bold">Type</div>
                <div className="text-xs text-white/70 font-mono">{selectedNode.type}</div>
              </div>
              <div className="p-2 bg-white/[0.03] rounded border border-white/5">
                <div className="text-[9px] text-white/30 uppercase font-bold">Environment</div>
                <div className="text-xs text-white/70 font-mono">{selectedNode.environment || 'N/A'}</div>
              </div>
              <div className="p-2 bg-white/[0.03] rounded border border-white/5">
                <div className="text-[9px] text-white/30 uppercase font-bold">Status</div>
                <div className="text-xs text-white/70 font-mono">{selectedNode.status}</div>
              </div>
              <div className="p-2 bg-white/[0.03] rounded border border-white/5">
                <div className="text-[9px] text-white/30 uppercase font-bold">Risk Score</div>
                <div className={`text-xs font-mono font-bold ${selectedNode.riskScore >= 3 ? 'text-red-400' : selectedNode.riskScore >= 2 ? 'text-orange-400' : selectedNode.riskScore >= 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {selectedNode.riskScore}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="text-[10px] text-white/30 uppercase font-bold mb-1">Recommended Remediation</div>
              <p className="text-xs text-white/50 leading-relaxed">
                {selectedNode.status === 'migrated' || selectedNode.status === 'protected'
                  ? 'Asset is quantum-ready. Continue monitoring for crypto drift.'
                  : 'Run PQC migration to replace vulnerable algorithms. Consider hybrid mode for high-availability assets.'}
              </p>
            </div>

            <div className="flex gap-2">
              <a
                href={`/dashboard/assets`}
                className="flex-1 px-4 py-2 bg-gold/10 border border-gold/20 rounded-lg text-xs font-bold text-gold hover:bg-gold/20 transition-colors flex items-center justify-center gap-2"
              >
                View Asset Details
                <ArrowRight className="h-3 w-3" />
              </a>
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 border border-white/10 rounded-lg text-xs font-bold text-white/60 hover:text-white hover:border-white/20 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
