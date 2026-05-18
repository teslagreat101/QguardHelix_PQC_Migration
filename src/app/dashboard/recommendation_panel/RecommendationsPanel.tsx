import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldAlert, Key, Lock, Globe, Database } from 'lucide-react';
import { DashboardSummary } from '@/lib/dashboard-service';

interface Props {
  summary: DashboardSummary | null;
  loading: boolean;
}

const GLASS_PANEL_CLASSES = 'group relative overflow-hidden rounded-xl border border-[#FFD36B]/20 bg-[#0f1428]/45 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_60px_rgba(255,211,107,0.03),0_0_40px_rgba(255,211,107,0.14)] transition-all duration-500 hover:-translate-y-1 hover:border-[#FFD36B]/70 hover:bg-[#0f1428]/65 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-24px_60px_rgba(255,211,107,0.15),0_8px_30px_rgba(0,0,0,0.5),0_0_60px_rgba(255,211,107,0.5),0_0_120px_rgba(255,211,107,0.2)] hover:z-10 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#FFF4C0]/70 before:to-transparent before:transition-all before:duration-500 group-hover:before:opacity-100 group-hover:before:shadow-[0_0_15px_rgba(255,211,107,0.9)] group-hover:before:via-[#FFF4C0] after:pointer-events-none after:absolute after:-right-24 after:-top-24 after:h-48 after:w-48 after:rounded-full after:bg-[#FFD36B]/10 after:blur-3xl after:transition-all after:duration-500 group-hover:after:opacity-100 group-hover:after:bg-[#FFD36B]/25 group-hover:after:blur-[36px] text-white';

export default function RecommendationsPanel({ summary, loading }: Props) {
  if (loading || !summary) return null;

  const recommendations = [];

  if (summary.vulnerableAssetsCount > 0) {
    recommendations.push({
      id: 'rec-1',
      title: 'Upgrade High-Risk Assets',
      description: `Detected ${summary.vulnerableAssetsCount} assets using quantum-vulnerable cryptography. Priority: Critical.`,
      icon: ShieldAlert,
      color: 'text-red-500',
      action: 'Start Migration'
    });
  }

  if (summary.expiringCerts > 0) {
    recommendations.push({
      id: 'rec-2',
      title: 'Rotate Expiring Certificates',
      description: `${summary.expiringCerts} certificates are expiring soon. Replace with PQC-ready hybrid certificates.`,
      icon: Lock,
      color: 'text-orange-500',
      action: 'Rotate Now'
    });
  }

  if (summary.failedMigrations > 0) {
    recommendations.push({
        id: 'rec-3',
        title: 'Review Failed Migrations',
        description: `${summary.failedMigrations} migration jobs failed. Audit the logs to ensure cryptographic continuity.`,
        icon: Database,
        color: 'text-yellow-500',
        action: 'Review Logs'
    });
  }

  if (summary.totalCbomItems === 0) {
      recommendations.push({
          id: 'rec-4',
          title: 'Generate Enterprise CBOM',
          description: 'No cryptographic inventory detected. Perform a deep scan to map your enterprise crypto dependency graph.',
          icon: Globe,
          color: 'text-blue-400',
          action: 'Run Scan'
      });
  } else {
      recommendations.push({
          id: 'rec-5',
          title: 'Rotate Master Keys',
          description: 'Best practice: Periodic rotation of master encryption keys using QRNG-sourced entropy.',
          icon: Key,
          color: 'text-green-400',
          action: 'Initiate Rotation'
      });
  }

  return (
    <div className={`p-6 ${GLASS_PANEL_CLASSES}`}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/80 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          Prioritized Actions
        </h2>
        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">AI-Driven Insights</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
        {recommendations.slice(0, 4).map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-gold/20 transition-all group cursor-pointer"
          >
            <div className="flex gap-4">
              <div className={`mt-1 shrink-0 ${rec.color}`}>
                <rec.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-white group-hover:text-gold transition-colors mb-1">{rec.title}</h3>
                <p className="text-[11px] text-white/40 leading-relaxed mb-3">{rec.description}</p>
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gold opacity-60 group-hover:opacity-100 transition-opacity">
                    {rec.action} <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
