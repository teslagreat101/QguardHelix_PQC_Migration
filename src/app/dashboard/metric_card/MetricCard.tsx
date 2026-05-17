import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  trend?: string;
  trendValue?: number;
  loading?: boolean;
  delay?: number;
}

export default function MetricCard({ 
  label, value, icon: Icon, color, trend, trendValue, loading, delay = 0 
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="p-6 border rounded-xl hover:transition-all group relative overflow-hidden glass-panel"
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="h-16 w-16 text-gold" />
      </div>
      
      <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
        <div className={`p-1.5 rounded-lg bg-white/5 border border-white/10 ${color}`}>
            <Icon className="h-4 w-4" />
        </div>
        {label}
      </div>

      <div className="flex items-end gap-2 mb-2">
        <div className={`text-4xl font-black tracking-tighter ${color}`}>
            {loading ? '---' : value}
        </div>
        {!loading && trendValue !== undefined && (
            <div className={`flex items-center text-[10px] font-bold mb-1.5 ${trendValue >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {trendValue >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                {Math.abs(trendValue)}%
            </div>
        )}
      </div>

      <div className="text-[10px] text-white/30 font-bold uppercase flex items-center gap-1.5">
        <div className="w-1 h-1 rounded-full bg-gold/50" />
        {trend || 'Real-time telemetry active'}
      </div>

      {/* Decorative border beam */}
      <div className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-gold/40 to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}
