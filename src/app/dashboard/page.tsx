'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, AlertTriangle, Zap, Search, Activity, 
  RefreshCw, Lock, Radio, Database, ShieldCheck, Globe
} from 'lucide-react'
import { dashboardService, DashboardSummary, ExposureMapData, SecurityEvent } from '@/lib/dashboard-service'
import MetricCard from './metric_card/MetricCard'
import QuantumExposureMap from './crypto_exposure_map/QuantumExposureMap'
import SecurityEventsPanel from './security_events_panel/SecurityEventsPanel'
import RecommendationsPanel from './recommendation_panel/RecommendationsPanel'

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [mapData, setMapData] = useState<ExposureMapData>({ nodes: [], edges: [] })
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [monitoringStatus, setMonitoringStatus] = useState<'active' | 'degraded' | 'offline' | 'scanning' | 'migrating'>('active')

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const [summaryRes, mapRes, eventsRes] = await Promise.all([
        dashboardService.getSummary(),
        dashboardService.getExposureMap(),
        dashboardService.getRecentEvents(20)
      ])
      
      setSummary(summaryRes)
      setMapData(mapRes)
      setEvents(eventsRes)
      setMonitoringStatus(summaryRes.monitoringStatus as any || 'active')
      setError(null)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Connection failure')
      setMonitoringStatus('offline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardData()

    const handleStatus = (status: string) => {
      if (status === 'SUBSCRIBED') setMonitoringStatus('active')
      else if (status === 'CHANNEL_ERROR') setMonitoringStatus('degraded')
      else if (status === 'CLOSED') setMonitoringStatus('offline')
    }

    // Real-time subscriptions
    const eventsSub = dashboardService.subscribeToEvents((newEvent) => {
      setEvents(prev => [newEvent, ...prev].slice(0, 50))
      // Potentially refresh summary if event is critical
      if (newEvent.severity === 'critical') {
        fetchDashboardData()
      }
    }, handleStatus)

    const updateSub = dashboardService.subscribeToDashboardUpdates(() => {
      fetchDashboardData()
    }, handleStatus)

    return () => {
      eventsSub.unsubscribe()
      updateSub.unsubscribe()
    }
  }, [fetchDashboardData])

  if (error && !summary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Security Nexus Disconnected</h2>
        <p className="text-white/40 max-w-md mb-8">Unable to establish a secure handshake with the backend telemetry services. Please check your connection or session status.</p>
        <button 
          onClick={fetchDashboardData}
          className="px-8 py-3 bg-gold border border-gold text-black text-xs font-black uppercase tracking-widest rounded-lg hover:bg-gold/90 transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Reconnect Now
        </button>
      </div>
    )
  }

  const riskScoreColor = summary?.riskBand === 'Quantum Ready' ? 'text-green-500' : 
                         summary?.riskBand === 'Low Risk' ? 'text-gold' : 
                         summary?.riskBand === 'High Risk' ? 'text-orange-500' : 'text-red-500'

  return (
    <div className="p-4 lg:p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded bg-gold/10 border border-gold/20">
                <Shield className="w-6 h-6 text-gold" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white leading-none">
              Quantum Risk <span className="text-gold">Intelligence</span>
            </h1>
          </div>
          <p className="text-white/50 text-sm font-medium">Enterprise Command Center • Post-Quantum Cryptographic Posture</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className={`px-4 py-2 border rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all duration-500 ${
            monitoringStatus === 'active' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
            monitoringStatus === 'degraded' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
            monitoringStatus === 'offline' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
            'bg-gold/10 border-gold/20 text-gold'
          }`}>
            <Activity className={`h-3 w-3 ${monitoringStatus === 'active' || monitoringStatus === 'scanning' ? 'animate-pulse' : ''}`} />
            Live Monitoring {monitoringStatus}
          </div>
          
          <button 
            onClick={fetchDashboardData}
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-gold hover:border-gold/30 transition-all"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          label="Quantum Risk Score"
          value={summary?.quantumRiskScore || 0}
          icon={ShieldCheck}
          color={riskScoreColor}
          trend={summary?.riskBand || 'Calculating...'}
          trendValue={2} // Mock trend for visual flair, could be calculated
          loading={loading && !summary}
          delay={0.1}
        />
        <MetricCard 
          label="Vulnerable Assets"
          value={summary?.vulnerableAssetsCount || 0}
          icon={AlertTriangle}
          color="text-red-500"
          trend={`${summary?.newVulnerableAssets || 0} discovered since last scan`}
          loading={loading && !summary}
          delay={0.2}
        />
        <MetricCard 
          label="Total CBOM Items"
          value={summary?.totalCbomItems || 0}
          icon={Search}
          color="text-blue-400"
          trend="Inventory complete"
          loading={loading && !summary}
          delay={0.3}
        />
        <MetricCard 
          label="Active Migrations"
          value={summary?.activeMigrations || 0}
          icon={Zap}
          color="text-gold"
          trend={`${summary?.failedMigrations || 0} jobs require attention`}
          loading={loading && !summary}
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Center Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Exposure Map Section */}
          <section className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80 flex items-center gap-2">
                <Globe className="h-4 w-4 text-gold" />
                Quantum Exposure Map
              </h2>
              {summary?.lastScanAt && (
                <div className="text-[10px] font-mono text-white/30 uppercase">
                    Last Global Scan: {new Date(summary.lastScanAt).toLocaleString()}
                </div>
              )}
            </div>
            <QuantumExposureMap 
                data={mapData} 
                loading={loading} 
                onRefresh={fetchDashboardData}
            />
          </section>

          {/* Real-time Events */}
          <section className="space-y-4 h-[450px]">
            <SecurityEventsPanel events={events} loading={loading} />
          </section>
        </div>

        {/* Sidebar Insights */}
        <aside className="space-y-8">
          <RecommendationsPanel summary={summary} loading={loading} />
          
          {/* Quick Actions / Status */}
          <div className="rounded-xl border border-gold/15 bg-[#0f1428]/45 backdrop-blur-md p-6 overflow-hidden relative">
            <div className="absolute -right-4 -bottom-4 opacity-5">
                <Shield className="w-32 h-32 text-gold" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80 mb-4">System Integrity</h2>
            <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/40 uppercase">PQC Engine</span>
                    <span className="text-[10px] font-black text-green-500 uppercase flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Optimal
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/40 uppercase">QRNG Entropy</span>
                    <span className="text-[10px] font-black text-green-500 uppercase flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> 256-bit
                    </span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white/40 uppercase">Real-time Hook</span>
                    <span className="text-[10px] font-black text-gold uppercase flex items-center gap-1.5">
                        Connected
                    </span>
                </div>
                <div className="pt-4 mt-4 border-t border-white/5">
                    <button className="w-full py-2 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60 rounded hover:bg-white/10 transition-colors">
                        Download Compliance Report
                    </button>
                </div>
            </div>
          </div>
        </aside>
      </div>
      
      {/* Footer Branding */}
      <footer className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 opacity-30">
            <img src="/NEW_LOGO.png" alt="Logo" className="w-5 h-5 grayscale" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white">QGuard Helix Protocol v2.4</span>
        </div>
        <div className="flex gap-6 text-[9px] font-bold text-white/20 uppercase tracking-widest">
            <span>End-to-End PQC Encrypted</span>
            <span>GDPR / NIST / FIPS 140-3 Compliant</span>
        </div>
      </footer>
    </div>
  )
}
