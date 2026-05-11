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

export default function SecurityEventsPanel({ events, loading }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (loading && events.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center border border-gold/10 bg-black/40 rounded-xl">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-3" />
        <p className="text-[10px] text-gold/40 uppercase font-black tracking-widest">Awaiting Telemetry...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl overflow-hidden">
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

      <div className="p-3 border-t border-gold/10 bg-black/20 text-center">
        <button className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-gold transition-colors">
            View All Audit Logs
        </button>
      </div>
    </div>
  );
}
