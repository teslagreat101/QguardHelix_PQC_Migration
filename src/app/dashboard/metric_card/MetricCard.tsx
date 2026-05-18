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
const GLASS_PANEL_CLASSES = 'group relative overflow-hidden rounded-xl border border-[#FFD36B]/20 bg-[#0f1428]/45 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_60px_rgba(255,211,107,0.03),0_0_40px_rgba(255,211,107,0.14)] transition-all duration-500 hover:-translate-y-1 hover:border-[#FFD36B]/70 hover:bg-[#0f1428]/65 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-24px_60px_rgba(255,211,107,0.15),0_8px_30px_rgba(0,0,0,0.5),0_0_60px_rgba(255,211,107,0.5),0_0_120px_rgba(255,211,107,0.2)] hover:z-10 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#FFF4C0]/70 before:to-transparent before:transition-all before:duration-500 group-hover:before:opacity-100 group-hover:before:shadow-[0_0_15px_rgba(255,211,107,0.9)] group-hover:before:via-[#FFF4C0] after:pointer-events-none after:absolute after:-right-24 after:-top-24 after:h-48 after:w-48 after:rounded-full after:bg-[#FFD36B]/10 after:blur-3xl after:transition-all after:duration-500 group-hover:after:opacity-100 group-hover:after:bg-[#FFD36B]/25 group-hover:after:blur-[36px] text-white';

export default function MetricCard({ 
  label, value, icon: Icon, color, trend, trendValue, loading, delay = 0 
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`p-6 ${GLASS_PANEL_CLASSES}`}
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
