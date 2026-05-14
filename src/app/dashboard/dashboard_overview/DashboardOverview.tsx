import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, Zap, Activity, TrendingUp, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function DashboardOverview() {
  const [stats, setStats] = useState({
    vulnerableAssets: 0,
    totalAssets: 0,
    averageRiskScore: 0,
    activeMigrations: 0,
    totalCbomItems: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOverviewStats() {
      try {
        // Fetch real data from Supabase
        const { count: totalAssets } = await supabase.from('assets').select('*', { count: 'exact', head: true });
        const { count: vulnerableAssets } = await supabase.from('crypto_inventory').select('*', { count: 'exact', head: true }).eq('is_vulnerable', true);
        const { data: riskScores } = await supabase.from('risk_scores').select('score');
        const { count: activeMigrations } = await supabase.from('migrations').select('*', { count: 'exact', head: true }).eq('status', 'IN_PROGRESS');
        const { count: totalCbomItems } = await supabase.from('crypto_inventory').select('*', { count: 'exact', head: true });

        const avgScore = riskScores && riskScores.length > 0 
          ? Math.round(riskScores.reduce((acc, curr) => acc + curr.score, 0) / riskScores.length)
          : 0;

        setStats({
          totalAssets: totalAssets || 0,
          vulnerableAssets: vulnerableAssets || 0,
          averageRiskScore: avgScore,
          activeMigrations: activeMigrations || 0,
          totalCbomItems: totalCbomItems || 0
        });
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchOverviewStats();

    // Subscribe to realtime updates
    const channel = supabase.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        fetchOverviewStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const statCards = [
    { label: 'Quantum Risk Score', value: stats.averageRiskScore, icon: Shield, color: stats.averageRiskScore > 700 ? 'text-green-500' : stats.averageRiskScore > 400 ? 'text-yellow-500' : 'text-red-500', trend: '-2% vs last scan' },
    { label: 'Vulnerable Assets', value: stats.vulnerableAssets, icon: AlertTriangle, color: 'text-red-500', trend: '+1 new discovered' },
    { label: 'Total CBOM Items', value: stats.totalCbomItems, icon: Search, color: 'text-blue-500', trend: 'Comprehensive inventory' },
    { label: 'Active Migrations', value: stats.activeMigrations, icon: Zap, color: 'text-gold', trend: 'Automated autopilot active' }
  ];

  return (
    <div className="p-8 space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Quantum Risk <span className="text-gold">Intelligence</span></h1>
          <p className="text-white/50 mt-1">Enterprise-wide cryptographic posture and exposure analysis.</p>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded text-xs font-bold text-gold uppercase tracking-widest flex items-center gap-2">
            <Activity className="h-3 w-3 animate-pulse" />
            Live Monitoring Active
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl hover:border-gold/40 transition-colors group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon className="h-16 w-16" />
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
              <stat.icon className="h-4 w-4" />
              {stat.label}
            </div>
            <div className={`text-4xl font-black ${stat.color} mb-2 tracking-tighter`}>
              {loading ? '---' : stat.value}
            </div>
            <div className="text-[10px] text-white/30 font-bold uppercase flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {stat.trend}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Risk Exposure Map Placeholder */}
        <div className="lg:col-span-2 border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6 h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Quantum Exposure Map</h2>
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">HNDL Risk High</span>
            </div>
          </div>
          <div className="flex-1 rounded-lg border border-gold/10 bg-black/20 relative overflow-hidden flex items-center justify-center">
             {/* This would be the Three.js or SVG map */}
             <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
             <div className="z-10 text-center">
                <div className="h-48 w-48 rounded-full border-2 border-gold/20 border-dashed animate-[spin_20s_linear_infinite] flex items-center justify-center">
                  <div className="h-32 w-32 rounded-full border-2 border-gold/40 border-dashed animate-[spin_15s_linear_infinite_reverse] flex items-center justify-center">
                    <Shield className="h-12 w-12 text-gold opacity-50" />
                  </div>
                </div>
                <p className="mt-4 text-[10px] text-gold/40 uppercase font-black tracking-[0.3em]">Mapping Enterprise Topography...</p>
             </div>
          </div>
        </div>

        {/* Recent Events Log */}
        <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6 h-[400px] flex flex-col">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/80 mb-6">Security Events</h2>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {[
              { time: '12:45:02', msg: 'New RSA-2048 detected on api-gateway-01', level: 'CRITICAL' },
              { time: '12:42:15', msg: 'HNDL risk elevated for /db/customer-records', level: 'WARNING' },
              { time: '12:30:11', msg: 'PQC Key Rotation successful (ML-KEM-768)', level: 'SUCCESS' },
              { time: '12:15:44', msg: 'Scan completed: 42 assets analyzed', level: 'INFO' },
              { time: '11:58:20', msg: 'Algorithm drift detected: SSH-RSA found', level: 'WARNING' }
            ].map((ev, i) => (
              <div key={i} className="text-[10px] flex gap-3 border-l-2 border-gold/20 pl-3 py-1">
                <span className="text-white/30 font-mono">{ev.time}</span>
                <div className="flex-1">
                  <div className={`font-bold ${ev.level === 'CRITICAL' ? 'text-red-500' : ev.level === 'WARNING' ? 'text-yellow-500' : ev.level === 'SUCCESS' ? 'text-green-500' : 'text-blue-400'}`}>
                    [{ev.level}]
                  </div>
                  <div className="text-white/70">{ev.msg}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
