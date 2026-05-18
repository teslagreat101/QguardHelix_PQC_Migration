import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, AlertTriangle, Shield, CheckCircle, Info, 
  ExternalLink, FileSearch, ShieldAlert, History
} from 'lucide-react';
import { SecurityEvent, dashboardService } from '@/lib/dashboard-service';

interface Props {
  events: SecurityEvent[];
  loading: boolean;
}

const SEVERITY_COLORS = {
  critical: 'text-red-500 bg-red-500/10 border-red-500/20',
  warning: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  success: 'text-green-500 bg-green-500/10 border-green-500/20',
};

const SEVERITY_ICONS = {
  critical: AlertTriangle,
  warning: ShieldAlert,
  info: Info,
  success: CheckCircle,
};

const GLASS_PANEL_CLASSES = 'group relative overflow-hidden rounded-xl border border-[#FFD36B]/20 bg-[#0f1428]/45 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_60px_rgba(255,211,107,0.03),0_0_40px_rgba(255,211,107,0.14)] transition-all duration-500 hover:-translate-y-1 hover:border-[#FFD36B]/70 hover:bg-[#0f1428]/65 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-24px_60px_rgba(255,211,107,0.15),0_8px_30px_rgba(0,0,0,0.5),0_0_60px_rgba(255,211,107,0.5),0_0_120px_rgba(255,211,107,0.2)] hover:z-10 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#FFF4C0]/70 before:to-transparent before:transition-all before:duration-500 group-hover:before:opacity-100 group-hover:before:shadow-[0_0_15px_rgba(255,211,107,0.9)] group-hover:before:via-[#FFF4C0] after:pointer-events-none after:absolute after:-right-24 after:-top-24 after:h-48 after:w-48 after:rounded-full after:bg-[#FFD36B]/10 after:blur-3xl after:transition-all after:duration-500 group-hover:after:opacity-100 group-hover:after:bg-[#FFD36B]/25 group-hover:after:blur-[36px] text-white';

export default function SecurityEventsPanel({ events, loading }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (loading && events.length === 0) {
    return (
      <div className={`h-full flex flex-col items-center justify-center ${GLASS_PANEL_CLASSES}`}>
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-3" />
        <p className="text-[10px] text-gold/40 uppercase font-black tracking-widest">Awaiting Telemetry...</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full overflow-hidden ${GLASS_PANEL_CLASSES}`}>
      <div className="p-4 border-b border-gold/10 flex justify-between items-center bg-white/[0.02]">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/80 flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-gold" />
          Security Events
        </h2>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/20">
            <span className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse" />
            <span className="text-[9px] font-black text-gold uppercase tracking-widest">Real-time</span>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12">
                <History className="w-10 h-10 mb-4 text-gold/50" />
                <p className="text-[10px] uppercase font-black tracking-widest">No recent security events</p>
            </div>
          ) : (
            events.map((event) => {
              const Icon = SEVERITY_ICONS[event.severity] || Info;
              const colorClass = SEVERITY_COLORS[event.severity];
              
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-3 rounded-lg border flex gap-3 relative group overflow-hidden ${colorClass}`}
                >
                  <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:bg-white/10 rounded" title="View Details">
                        <ExternalLink className="w-3 h-3 text-white/40" />
                    </button>
                  </div>

                  <div className="mt-0.5 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <div className="text-[10px] font-black uppercase tracking-wider">{event.eventType.replace(/_/g, ' ')}</div>
                      <div className="text-[8px] font-mono opacity-50 whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <p className="text-[11px] text-white/70 leading-relaxed font-medium">
                      {event.message}
                    </p>
                    {event.resourceName && (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-white/30 uppercase tracking-tighter pt-1">
                            <FileSearch className="w-2.5 h-2.5" />
                            {event.resourceType}: <span className="text-white/50">{event.resourceName}</span>
                        </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <div className="p-3 border-t border-gold/10 text-center relative z-20">
        <button className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-gold transition-colors">
            View All Audit Logs
        </button>
      </div>
    </div>
  );
}
