import { motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Zap, Shield, Lock, FileSearch, RefreshCw, Award } from 'lucide-react'
import type { Recommendation, LoadingState } from '@/hooks/use-dashboard'

interface RecommendationsProps {
  recommendations: Recommendation[]
  loading: LoadingState
}

const categoryConfig: Record<string, { icon: any; color: string }> = {
  cryptography: { icon: Lock, color: 'text-red-400' },
  protocol: { icon: Shield, color: 'text-orange-400' },
  certificate: { icon: Award, color: 'text-yellow-400' },
  migration: { icon: RefreshCw, color: 'text-blue-400' },
  discovery: { icon: FileSearch, color: 'text-green-400' },
  default: { icon: Zap, color: 'text-gold' },
}

const priorityLabel = (priority: number) => {
  if (priority === 1) return { label: 'Critical', color: 'text-red-500 bg-red-500/10 border-red-500/30' }
  if (priority === 2) return { label: 'High', color: 'text-orange-500 bg-orange-500/10 border-orange-500/30' }
  return { label: 'Medium', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' }
}

export function Recommendations({ recommendations, loading }: RecommendationsProps) {
  const isLoading = loading === 'loading'
  const isEmpty = !isLoading && recommendations.length === 0
  const isOffline = loading === 'offline'

  if (isLoading) {
    return (
      <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/80 mb-4">Prioritized Recommendations</h2>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3 border border-white/5 rounded-lg bg-white/[0.02]">
              <div className="h-3 w-3 rounded bg-white/5 animate-pulse mb-2" />
              <div className="h-3 w-full bg-white/5 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isOffline) {
    return (
      <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/80 mb-4">Prioritized Recommendations</h2>
        <div className="text-center py-6">
          <AlertTriangle className="h-6 w-6 text-yellow-500/40 mx-auto mb-2" />
          <p className="text-xs text-white/30">Recommendations unavailable offline</p>
        </div>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/80 mb-4">Prioritized Recommendations</h2>
        <div className="text-center py-6">
          <Shield className="h-6 w-6 text-green-500/40 mx-auto mb-2" />
          <p className="text-xs text-white/30">No active recommendations</p>
          <p className="text-[10px] text-white/20 mt-1">Your posture is strong or no assets have been scanned yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-white/80 mb-4">Prioritized Recommendations</h2>
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
        {recommendations.map((rec, i) => {
          const config = categoryConfig[rec.category] || categoryConfig.default
          const Icon = config.icon
          const priority = priorityLabel(rec.priority)

          return (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group p-3 border border-white/5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] hover:border-gold/20 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 p-1.5 rounded ${config.color} bg-white/5`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${priority.color}`}>
                      {priority.label}
                    </span>
                    <span className="text-[9px] text-white/30 uppercase font-bold">{rec.category}</span>
                  </div>
                  <div className="text-[11px] text-white/80 font-medium leading-snug mb-1">{rec.title}</div>
                  <div className="text-[10px] text-white/40 leading-relaxed">{rec.description}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] text-white/20 uppercase font-bold">Effort: {rec.estimatedEffort}</span>
                    <span className="text-[9px] text-gold/50 uppercase font-bold flex items-center gap-0.5 group-hover:text-gold transition-colors">
                      Take action <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
