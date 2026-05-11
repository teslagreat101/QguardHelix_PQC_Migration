import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, AlertTriangle, Info, CheckCircle, ChevronRight, Eye } from 'lucide-react'
import type { SecurityEvent, LoadingState } from '@/hooks/use-dashboard'

interface SecurityEventsProps {
  events: SecurityEvent[]
  loading: LoadingState
  onEventClick?: (event: SecurityEvent) => void
}

const severityConfig = {
  critical: { icon: AlertTriangle, color: 'text-red-500', borderColor: 'border-red-500/50', bgColor: 'bg-red-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', borderColor: 'border-yellow-500/50', bgColor: 'bg-yellow-500/10' },
  info: { icon: Info, color: 'text-blue-400', borderColor: 'border-blue-400/50', bgColor: 'bg-blue-400/10' },
  success: { icon: CheckCircle, color: 'text-green-500', borderColor: 'border-green-500/50', bgColor: 'bg-green-500/10' },
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function SecurityEvents({ events, loading, onEventClick }: SecurityEventsProps) {
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const filteredEvents = filter === 'all' ? events : events.filter(e => e.severity === filter)

  const isLoading = loading === 'loading'
  const isEmpty = !isLoading && events.length === 0
  const isOffline = loading === 'offline'

  return (
    <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl p-6 h-[400px] flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-white/80">Security Events</h2>
        <div className="flex gap-1">
          {(['all', 'critical', 'warning', 'info', 'success'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                filter === f ? 'bg-gold/20 text-gold border border-gold/30' : 'text-white/30 hover:text-white/60 border border-transparent'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar relative">
        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 border-l-2 border-white/5 pl-3 py-2">
                <div className="h-8 w-8 rounded bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-16 bg-white/5 animate-pulse rounded" />
                  <div className="h-3 w-full bg-white/5 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isOffline && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-yellow-500/60" />
            </div>
            <p className="text-xs text-white/40 font-medium">Realtime connection lost</p>
            <p className="text-[10px] text-white/20">Events will resume when connection restores</p>
          </div>
        )}

        {isEmpty && !isOffline && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-gold/60" />
            </div>
            <p className="text-xs text-white/40 font-medium">No security events</p>
            <p className="text-[10px] text-white/20">All systems nominal. Events appear here when detected.</p>
          </div>
        )}

        {!isLoading && !isEmpty && (
          <AnimatePresence initial={false}>
            {filteredEvents.map((ev, i) => {
              const config = severityConfig[ev.severity] || severityConfig.info
              const Icon = config.icon
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => {
                    setSelectedEvent(ev)
                    onEventClick?.(ev)
                  }}
                  className={`group flex gap-3 border-l-2 ${config.borderColor} pl-3 py-2 rounded-r-lg hover:bg-white/[0.03] cursor-pointer transition-colors`}
                >
                  <div className={`mt-0.5 shrink-0`}>
                    <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-black uppercase ${config.color}`}>
                        [{ev.severity}]
                      </span>
                      <span className="text-white/20 text-[10px] font-mono">
                        {formatRelativeTime(ev.timestamp)}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/70 leading-relaxed truncate group-hover:text-white/90 transition-colors">
                      {ev.message}
                    </div>
                    {ev.resourceName && (
                      <div className="text-[10px] text-white/30 mt-0.5">
                        {ev.resourceType}: {ev.resourceName}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-3 w-3 text-white/10 group-hover:text-white/30 shrink-0 self-center transition-colors" />
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-black/90 border border-gold/20 rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const config = severityConfig[selectedEvent.severity] || severityConfig.info
                  const Icon = config.icon
                  return (
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                  )
                })()}
                <div>
                  <div className="text-sm font-bold text-white">{selectedEvent.eventType}</div>
                  <div className="text-[10px] text-white/40 font-mono">{formatTime(selectedEvent.timestamp)}</div>
                </div>
              </div>
              <div className="text-sm text-white/80 mb-4 leading-relaxed">{selectedEvent.message}</div>
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div className="bg-white/[0.03] rounded-lg p-3 mb-4">
                  <div className="text-[10px] text-white/30 uppercase font-bold mb-2">Metadata</div>
                  <pre className="text-[10px] text-white/50 font-mono overflow-x-auto">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}
              <div className="flex gap-2">
                {selectedEvent.assetId && (
                  <button
                    onClick={() => {
                      // Navigate to asset detail
                      setSelectedEvent(null)
                    }}
                    className="flex-1 px-4 py-2 bg-gold/10 border border-gold/20 rounded-lg text-xs font-bold text-gold hover:bg-gold/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye className="h-3 w-3" />
                    View Asset
                  </button>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 border border-white/10 rounded-lg text-xs font-bold text-white/60 hover:text-white hover:border-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
