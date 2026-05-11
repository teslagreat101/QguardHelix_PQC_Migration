import React from 'react'
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { LoadingState } from '@/hooks/use-dashboard'

interface MetricCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  color: string
  trend?: string
  trendValue?: number
  loading: LoadingState
  index?: number
  onClick?: () => void
  key?: React.Key
}

export function MetricCard({ label, value, icon: Icon, color, trend, trendValue, loading, index = 0, onClick }: MetricCardProps) {
  const isLoading = loading === 'loading'
  const isOffline = loading === 'offline'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      onClick={onClick}
      className={`p-6 border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl hover:border-gold/40 transition-colors group relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="h-16 w-16" />
      </div>
      <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`text-4xl font-black mb-2 tracking-tighter ${color}`}>
        {isLoading ? (
          <span className="inline-block h-8 w-20 bg-white/10 animate-pulse rounded" />
        ) : isOffline ? (
          <span className="text-white/30">--</span>
        ) : (
          value
        )}
      </div>
      {trend && (
        <div className={`text-[10px] font-bold uppercase flex items-center gap-1 ${
          trendValue !== undefined
            ? trendValue > 0 ? 'text-green-500' : trendValue < 0 ? 'text-red-500' : 'text-white/30'
            : 'text-white/30'
        }`}>
          {isLoading ? (
            <span className="inline-block h-3 w-24 bg-white/10 animate-pulse rounded" />
          ) : isOffline ? (
            <span className="text-white/20">Sync offline</span>
          ) : (
            <>
              <span>{trendValue !== undefined && trendValue > 0 ? '↑' : trendValue !== undefined && trendValue < 0 ? '↓' : '•'}</span>
              {trend}
            </>
          )}
        </div>
      )}
      {isOffline && (
        <div className="mt-2 text-[10px] text-yellow-500/70 uppercase font-bold">Last sync failed</div>
      )}
    </motion.div>
  )
}
