'use client'

import React from 'react'
import { Activity, Lock, Fingerprint, Cloud, ShieldCheck, Shield, Globe, AlertTriangle, MapPin, Target, Zap, Server, Map } from 'lucide-react'

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

const GLASS_PANEL_CLASSES = 'group relative overflow-hidden rounded-xl border border-[#FFD36B]/20 bg-[#0f1428]/45 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_60px_rgba(255,211,107,0.03),0_0_40px_rgba(255,211,107,0.14)] transition-all duration-500 hover:-translate-y-1 hover:border-[#FFD36B]/70 hover:bg-[#0f1428]/65 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-24px_60px_rgba(255,211,107,0.15),0_8px_30px_rgba(0,0,0,0.5),0_0_60px_rgba(255,211,107,0.5),0_0_120px_rgba(255,211,107,0.2)] hover:z-10 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#FFF4C0]/70 before:to-transparent before:transition-all before:duration-500 group-hover:before:opacity-100 group-hover:before:shadow-[0_0_15px_rgba(255,211,107,0.9)] group-hover:before:via-[#FFF4C0] after:pointer-events-none after:absolute after:-right-24 after:-top-24 after:h-48 after:w-48 after:rounded-full after:bg-[#FFD36B]/10 after:blur-3xl after:transition-all after:duration-500 group-hover:after:opacity-100 group-hover:after:bg-[#FFD36B]/25 group-hover:after:blur-[36px] text-white';

function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'p-4',
        GLASS_PANEL_CLASSES,
        className,
      )}
    >
      <div className="relative z-10 h-full flex flex-col">{children}</div>
    </div>
  )
}

function PanelTitle({ title }: { title: string }) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xs font-black uppercase tracking-wider text-[#FFE8A8]">{title}</h3>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-[#4DFF88] shadow-[0_0_8px_rgba(77,255,136,0.8)] animate-pulse" />
        <span className="text-[9px] font-black uppercase text-[#4DFF88]">Live</span>
      </div>
    </div>
  )
}

function TopPanelTitle({ title, actionText }: { title: string, actionText?: string }) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-[11px] font-black uppercase tracking-wider text-[#FFE8A8]">{title}</h3>
      {actionText && <span className="text-[9px] font-bold uppercase text-white/50 hover:text-white cursor-pointer transition-colors">{actionText}</span>}
    </div>
  )
}

function MiniLineChart({ color = "#FFD36B" }) {
  const points = '0,40 20,30 40,45 60,20 80,35 100,10 120,25 140,5'
  return (
    <svg viewBox="0 0 140 50" className="w-full h-12 overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`${points} 140,50 0,50`} fill={`rgba(255,211,107,0.1)`} stroke="none" />
      {points.split(' ').map((p, i) => {
        const [x, y] = p.split(',')
        return <circle key={i} cx={x} cy={y} r="2" fill="#fff" stroke={color} strokeWidth="1" />
      })}
    </svg>
  )
}

function MiniMultiLineChart() {
  const points1 = '0,40 20,30 40,35 60,20 80,35 100,10 120,25 140,15'
  const points2 = '0,45 20,40 40,42 60,35 80,45 100,25 120,35 140,25'
  return (
    <svg viewBox="0 0 140 50" className="w-full h-full overflow-visible">
      <polyline points={points1} fill="none" stroke="#FFD36B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points2} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {points1.split(' ').map((p, i) => {
        const [x, y] = p.split(',')
        return <circle key={'1-'+i} cx={x} cy={y} r="1.5" fill="#FFD36B" />
      })}
      {points2.split(' ').map((p, i) => {
        const [x, y] = p.split(',')
        return <circle key={'2-'+i} cx={x} cy={y} r="1.5" fill="#3b82f6" />
      })}
    </svg>
  )
}

function MiniBarChart() {
  const heights = [30, 45, 25, 60, 40, 70, 50, 80, 55, 35, 65, 40]
  return (
    <div className="flex items-end gap-1 h-12 w-full">
      {heights.map((h, i) => (
        <div key={i} className="flex-1 bg-blue-500/80 rounded-t-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

function DonutRing({ percentage, color, label }: { percentage: number, color: string, label?: string }) {
  const strokeDasharray = `${percentage} ${100 - percentage}`
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="3"
        />
        <path
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={strokeDasharray}
        />
      </svg>
      {label && <div className="absolute text-sm font-black text-white">{label}</div>}
    </div>
  )
}

function ProgressBarItem({ icon: Icon, label, value, percent, change }: { icon: any, label: string, value: string, percent: number, change: string }) {
  return (
    <div className="flex items-center gap-3 text-xs mb-2.5 last:mb-0">
      <div className="w-6 h-6 rounded-md bg-[#FFD36B]/10 border border-[#FFD36B]/20 flex items-center justify-center shrink-0 text-[#FFD36B]">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <span className="text-white/70 text-[10px]">{label}</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-[10px]">{value}</span>
            <span className="text-[#4DFF88] text-[8px]">▲ {change}</span>
          </div>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-[#FFD36B]" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  )
}

function TinyProgressBar({ label, percent, color }: { label: string, percent: number, color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2 text-[10px]">
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="w-16 text-white/70">{label}</span>
      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <span className="w-8 text-right font-bold">{percent}%</span>
    </div>
  )
}

export default function TelemetryFeatures() {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      
      {/* ROW 1 */}
      
      {/* QUANTUM SECURITY POSTURE */}
      <GlassPanel>
        <TopPanelTitle title="Quantum Security Posture" />
        <div className="flex gap-4 items-center flex-1 mt-2">
          <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
             <div className="absolute inset-0 rounded-full border border-[#FFD36B]/20 animate-[spin_10s_linear_infinite]" />
             <div className="absolute inset-2 rounded-full border border-dashed border-[#FFD36B]/40 animate-[spin_15s_linear_infinite_reverse]" />
             <Shield className="w-12 h-12 text-[#FFD36B]" />
             <Lock className="absolute w-4 h-4 text-[#0f1428] bg-[#FFD36B] rounded-sm p-0.5 mt-2" />
          </div>
          <div className="flex-1 flex flex-col items-center">
            <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">Quantum Risk Score</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-5xl font-black text-[#FFD36B]">72</span>
              <span className="text-sm font-bold text-white/50">/100</span>
            </div>
            <div className="text-[10px] font-bold mt-2 tracking-widest text-white/70">Risk Level: <span className="text-red-500">HIGH</span></div>
            <div className="w-full mt-4">
              <span className="text-[8px] text-white/40 uppercase">Trend (30 Days)</span>
              <div className="h-6">
                 <MiniLineChart color="#FFD36B" />
              </div>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* SYSTEM HEALTH */}
      <GlassPanel>
        <TopPanelTitle title="System Health" actionText="View All" />
        <div className="mt-2 flex-1 flex flex-col justify-center">
          <ProgressBarItem icon={Target} label="Assets Monitored" value="18,542" percent={75} change="12.4%" />
          <ProgressBarItem icon={Lock} label="Encrypted Connections" value="92.7%" percent={92.7} change="4.7%" />
          <ProgressBarItem icon={Zap} label="PQC Readiness" value="68.3%" percent={68.3} change="8.1%" />
          <ProgressBarItem icon={ShieldCheck} label="Policy Compliance" value="89.1%" percent={89.1} change="3.3%" />
          <ProgressBarItem icon={AlertTriangle} label="Threats Blocked (24h)" value="128" percent={40} change="15.2%" />
        </div>
      </GlassPanel>

      {/* GLOBAL STATUS */}
      <GlassPanel>
        <TopPanelTitle title="Global Status" actionText="View Map" />
        <div className="relative h-[90px] mb-4 opacity-40 bg-[url('https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg')] bg-no-repeat bg-center bg-contain filter invert" style={{ filter: 'invert(1) opacity(0.3)' }}>
           <MapPin className="absolute top-4 left-[20%] w-3 h-3 text-[#FFD36B]" />
           <MapPin className="absolute top-10 left-[40%] w-3 h-3 text-[#FFD36B]" />
           <MapPin className="absolute top-8 left-[60%] w-3 h-3 text-[#FFD36B]" />
           <MapPin className="absolute top-12 left-[80%] w-3 h-3 text-blue-400" />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-auto">
          <div className="border border-white/10 rounded-md p-1.5 flex flex-col items-center justify-center bg-white/5">
            <Server className="w-3 h-3 text-[#FFD36B] mb-1" />
            <div className="text-[8px] text-white/50 text-center leading-tight">Data Centers</div>
            <div className="font-bold text-[10px] mt-0.5">42</div>
          </div>
          <div className="border border-white/10 rounded-md p-1.5 flex flex-col items-center justify-center bg-white/5">
            <Cloud className="w-3 h-3 text-[#FFD36B] mb-1" />
            <div className="text-[8px] text-white/50 text-center leading-tight">Cloud Accounts</div>
            <div className="font-bold text-[10px] mt-0.5">17</div>
          </div>
          <div className="border border-white/10 rounded-md p-1.5 flex flex-col items-center justify-center bg-white/5">
            <Globe className="w-3 h-3 text-[#FFD36B] mb-1" />
            <div className="text-[8px] text-white/50 text-center leading-tight">Regions</div>
            <div className="font-bold text-[10px] mt-0.5">6</div>
          </div>
          <div className="border border-white/10 rounded-md p-1.5 flex flex-col items-center justify-center bg-white/5">
            <Map className="w-3 h-3 text-[#FFD36B] mb-1" />
            <div className="text-[8px] text-white/50 text-center leading-tight">Countries</div>
            <div className="font-bold text-[10px] mt-0.5">23</div>
          </div>
        </div>
      </GlassPanel>

      {/* ROW 2 */}

      {/* MIGRATION PROGRESS */}
      <GlassPanel>
        <TopPanelTitle title="Migration Progress" actionText="View Timeline" />
        <div className="flex items-center gap-6 mt-4 flex-1">
          <div className="relative flex flex-col items-center justify-center shrink-0 w-20">
             <DonutRing percentage={63} color="#FFD36B" />
             <div className="absolute flex flex-col items-center justify-center">
               <span className="text-lg font-black text-[#FFD36B]">63%</span>
             </div>
             <span className="text-[8px] text-white/50 uppercase mt-3 text-center">Overall<br/>Migration</span>
          </div>
          <div className="flex-1 space-y-1 mt-1">
            <TinyProgressBar label="Assessment" percent={100} color="#4DFF88" />
            <TinyProgressBar label="Planning" percent={85} color="#3b82f6" />
            <TinyProgressBar label="Execution" percent={63} color="#FFD36B" />
            <TinyProgressBar label="Validation" percent={40} color="#f97316" />
            <TinyProgressBar label="Optimization" percent={15} color="#ef4444" />
          </div>
        </div>
      </GlassPanel>

      {/* RUNTIME CRYPTOGRAPHIC INTELLIGENCE */}
      <GlassPanel>
        <TopPanelTitle title="Runtime Cryptographic Intelligence" actionText="View Details" />
        <div className="grid grid-cols-4 gap-2 mb-4 mt-2">
          <div>
            <div className="text-[8px] text-white/50 uppercase">Active Sessions</div>
            <div className="text-[13px] font-black mt-1">24,619</div>
          </div>
          <div>
            <div className="text-[8px] text-white/50 uppercase">Algorithms in Use</div>
            <div className="text-[13px] font-black mt-1">128</div>
          </div>
          <div>
            <div className="text-[8px] text-white/50 uppercase">PQC Algorithms</div>
            <div className="text-[13px] font-black text-[#4DFF88] flex items-center gap-1 mt-1">36 <span className="text-[8px] text-[#4DFF88]/70">▲ 22.2%</span></div>
          </div>
          <div>
            <div className="text-[8px] text-white/50 uppercase">Weak / Deprecated</div>
            <div className="text-[13px] font-black text-red-500 flex items-center gap-1 mt-1">14 <span className="text-[8px] text-red-500/70">▼ 18.5%</span></div>
          </div>
        </div>
        <div className="relative h-[60px] w-full mt-auto mb-2">
           <MiniMultiLineChart />
           <div className="absolute -bottom-1 w-full flex justify-center gap-4 text-[8px] text-white/40">
              <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-[#FFD36B]" /> Total Sessions</span>
              <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-blue-500" /> PQC Sessions</span>
           </div>
        </div>
      </GlassPanel>

      {/* THREAT INTELLIGENCE */}
      <GlassPanel>
        <TopPanelTitle title="Threat Intelligence" actionText="View All" />
        <div className="flex gap-6 items-center flex-1 mt-2">
          <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
             <div className="absolute inset-0 rounded-full border border-dashed border-[#FFD36B]/40 animate-[spin_20s_linear_infinite]" />
             <div className="absolute inset-2 rounded-full border border-dotted border-[#FFD36B]/60 animate-[spin_15s_linear_infinite_reverse]" />
             <AlertTriangle className="w-8 h-8 text-[#FFD36B]" />
          </div>
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-red-500/20 border border-red-500 flex items-center justify-center"><div className="w-0.5 h-0.5 bg-red-500 rounded-full" /></div> <span className="text-white/80">Critical Threats</span></div>
              <span className="font-black text-red-500">7</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-orange-500/20 border border-orange-500 flex items-center justify-center"><div className="w-0.5 h-0.5 bg-orange-500 rounded-full" /></div> <span className="text-white/80">High Threats</span></div>
              <span className="font-black text-orange-500">23</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-[#FFD36B]/20 border border-[#FFD36B] flex items-center justify-center"><div className="w-0.5 h-0.5 bg-[#FFD36B] rounded-full" /></div> <span className="text-white/80">Medium Threats</span></div>
              <span className="font-black text-[#FFD36B]">48</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded bg-blue-500/20 border border-blue-500 flex items-center justify-center"><div className="w-0.5 h-0.5 bg-blue-500 rounded-full" /></div> <span className="text-white/80">Low Threats</span></div>
              <span className="font-black text-blue-400">96</span>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[9px] mt-auto">
          <span className="text-white/50">Latest Threat: <span className="text-white/80">Potential downgrade attack detected</span></span>
          <span className="text-[#FFD36B] font-bold cursor-pointer hover:underline">View Report</span>
        </div>
      </GlassPanel>

      {/* ROW 3 */}

      {/* RUNTIME VISIBILITY */}
      <GlassPanel>
        <PanelTitle title="Runtime Visibility" />
        <div className="mt-2 mb-4">
          <MiniLineChart />
        </div>
        <div className="flex justify-between items-end mt-auto">
          <div>
            <div className="text-[9px] font-bold text-white/50 uppercase">Transactions / sec</div>
            <div className="text-xl font-black text-white">15,736</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold text-white/50 uppercase">Encrypted</div>
            <div className="text-xl font-black text-white">93.4%</div>
          </div>
        </div>
      </GlassPanel>

      {/* TLS TELEMETRY */}
      <GlassPanel>
        <PanelTitle title="TLS Telemetry" />
        <div className="flex items-center gap-4 mt-2 flex-1">
          <DonutRing percentage={94} color="#3b82f6" label="94%" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-white/80"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"/> TLS 1.3</div>
              <span className="font-bold">76%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-white/80"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"/> TLS 1.2</div>
              <span className="font-bold">18%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-white/80"><div className="w-1.5 h-1.5 rounded-full bg-yellow-500"/> TLS 1.1 & Below</div>
              <span className="font-bold">6%</span>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* PKI VISIBILITY */}
      <GlassPanel>
        <PanelTitle title="PKI Visibility" />
        <div className="flex items-center justify-between mt-2 flex-1">
          <div>
            <div className="text-[9px] font-bold text-white/50 uppercase">Certificates</div>
            <div className="text-xl font-black text-white">28,451</div>
            <div className="mt-3 space-y-1">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-[#FFD36B] uppercase">Expiring Soon</span>
                <span className="text-sm font-black text-[#FFD36B]">1,254</span>
              </div>
              <div className="flex flex-col mt-1">
                <span className="text-[9px] font-bold text-red-500 uppercase">Invalid / Revoked</span>
                <span className="text-sm font-black text-red-500">183</span>
              </div>
            </div>
          </div>
          <DonutRing percentage={85} color="#FFD36B" />
        </div>
      </GlassPanel>


      {/* ROW 4 */}

      {/* ENCRYPTION MONITORING */}
      <GlassPanel>
        <PanelTitle title="Encryption Monitoring" />
        <div className="flex items-center gap-4 mt-2 flex-1">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-400 font-bold">Strong</span>
              <span className="text-blue-400">85.7%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#FFD36B] font-bold">Standard</span>
              <span className="text-[#FFD36B]">11.3%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-red-500 font-bold">Weak / None</span>
              <span className="text-red-500">3.0%</span>
            </div>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <DonutRing percentage={85.7} color="#3b82f6" />
            <Lock className="absolute w-5 h-5 text-[#FFD36B]" />
          </div>
        </div>
      </GlassPanel>

      {/* QUANTUM RISK SCORING */}
      <GlassPanel>
        <PanelTitle title="Quantum Risk Scoring" />
        <div className="flex flex-col items-center justify-center mt-2 flex-1">
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-5xl font-black text-[#FFD36B] drop-shadow-[0_0_12px_rgba(255,211,107,0.8)]">72</span>
            <span className="text-sm font-bold text-white/50">/100</span>
          </div>
          <div className="w-full mt-auto">
            <MiniLineChart color="#FFD36B" />
          </div>
        </div>
      </GlassPanel>

      {/* TRUST VALIDATION */}
      <GlassPanel>
        <PanelTitle title="Trust Validation" />
        <div className="flex items-center gap-6 mt-4 flex-1">
          <div className="relative w-16 h-20 flex items-center justify-center">
             <ShieldCheck className="absolute w-full h-full text-[#FFD36B] opacity-20" />
             <Fingerprint className="relative w-8 h-8 text-[#FFD36B]" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Overall Trust Score</span>
              <span className="font-bold">91%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Identities Verified</span>
              <span className="font-bold text-[#FFD36B]">12,842</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Devices Trusted</span>
              <span className="font-bold text-[#FFD36B]">18,200</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">Zero Trust Score</span>
              <span className="font-bold">88%</span>
            </div>
          </div>
        </div>
      </GlassPanel>


      {/* ROW 5 */}

      {/* POLICY COMPLIANCE */}
      <GlassPanel>
        <PanelTitle title="Policy Compliance" />
        <div className="flex items-center gap-6 mt-4 flex-1">
          <DonutRing percentage={89} color="#4DFF88" label="89%" />
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-[#4DFF88]" />
              <span className="text-white/80 flex-1">Compliant</span>
              <span className="font-bold text-[#4DFF88]">89%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-[#FFD36B]" />
              <span className="text-white/80 flex-1">Warning</span>
              <span className="font-bold text-[#FFD36B]">8%</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-white/80 flex-1">Non-Compliant</span>
              <span className="font-bold text-red-500">3%</span>
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* TELEMETRY OVERVIEW */}
      <GlassPanel>
        <PanelTitle title="Telemetry Overview" />
        <div className="mt-2 space-y-4 flex-1 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[9px] font-bold text-white/50 uppercase">Events / sec</div>
              <div className="text-xl font-black text-white mt-1">25,987</div>
            </div>
            <div className="w-1/2">
               <MiniBarChart />
            </div>
          </div>
          <div>
            <div className="text-[9px] font-bold text-white/50 uppercase">Data Ingested (24h)</div>
            <div className="text-xl font-black text-[#FFD36B] mt-1">2.45 TB</div>
          </div>
        </div>
      </GlassPanel>

      {/* MULTI-CLOUD TELEMETRY */}
      <GlassPanel>
        <PanelTitle title="Multi-Cloud Telemetry" />
        <div className="flex items-center gap-4 mt-4 flex-1">
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80 w-16">AWS</span>
              <div className="flex-1 mx-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: '58%' }} />
              </div>
              <span className="font-bold text-blue-400">58%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80 w-16">Azure</span>
              <div className="flex-1 mx-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400" style={{ width: '27%' }} />
              </div>
              <span className="font-bold text-blue-400">27%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80 w-16">Google Cloud</span>
              <div className="flex-1 mx-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white/50" style={{ width: '12%' }} />
              </div>
              <span className="font-bold text-white/60">12%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80 w-16">Others</span>
              <div className="flex-1 mx-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white/30" style={{ width: '3%' }} />
              </div>
              <span className="font-bold text-white/40">3%</span>
            </div>
          </div>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <DonutRing percentage={58} color="#3b82f6" />
            <Cloud className="absolute w-5 h-5 text-[#FFD36B]" />
          </div>
        </div>
      </GlassPanel>

    </div>
  )
}
