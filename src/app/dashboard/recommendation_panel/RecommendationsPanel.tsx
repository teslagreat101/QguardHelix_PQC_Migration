import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, ShieldAlert, Key, Lock, Globe, Database } from 'lucide-react';
import { DashboardSummary } from '@/lib/dashboard-service';

interface Props {
  summary: DashboardSummary | null;
  loading: boolean;
}

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
    <div className="rounded-xl border p-6 glass-panel">
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
