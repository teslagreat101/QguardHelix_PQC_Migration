import { useState } from 'react';
import { Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map as MapIcon, Terminal, ShieldAlert, LogOut,
  Eye, Route, Layers, Globe, Clock, ClipboardCheck,
  Rocket, Radio, GitCompare, BarChart3, ChevronLeft,
  ChevronRight, Menu, X, ScanSearch, ChevronDown,
  Cpu, Lock, Fingerprint, Award, Coins, MessageSquareLock, Cloud, Sparkles, Database, UserCog,
  Activity, EyeOff, Brain, Settings, Zap, Network, Box, Microscope, LineChart, Target, Shield, CheckCircle, UserCheck, MonitorCheck, PieChart, ShieldCheck, Scale, FileText, Layout, Key, Webhook, FileWarning, Search, Ghost
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

const NAV_SECTIONS = [
  {
    label: 'Core',
    collapsible: true,
    items: [
      { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Quantum Risk', path: '/dashboard/quantum-risk', icon: Eye },
      { name: 'Migration Planner', path: '/dashboard/migration-planner', icon: Route },
    ],
  },
  {
    label: 'Quantum Tools',
    collapsible: true,
    items: [
      { name: 'Quantum QRNG', path: '/dashboard/qrng', icon: Cpu },
      { name: 'Encryption Services', path: '/dashboard/keys', icon: Lock },
      { name: 'Security Authentication', path: '/dashboard/otp', icon: Fingerprint },
      { name: 'Digital Certificates', path: '/dashboard/pki', icon: Award },
      { name: 'Tokenization', path: '/dashboard/tokenize', icon: Coins },
      { name: 'Secure Communications', path: '/dashboard/comm', icon: MessageSquareLock },
      { name: 'Cloud Security', path: '/dashboard/cloud', icon: Cloud },
      { name: 'Quantum Vault', path: '/dashboard/vault', icon: Database },
    ],
  },
  {
    label: 'Discovery',
    collapsible: true,
    items: [
      { name: 'PQC Scanner', path: '/dashboard/scanner', icon: ScanSearch },
      { name: 'CBOM Explorer', path: '/dashboard/cbom', icon: Layers },
      { name: 'Crypto Exposure', path: '/dashboard/crypto-exposure', icon: Globe },
      { name: 'Assets & CBOM', path: '/dashboard/assets', icon: MapIcon },
      { name: 'Runtime Discovery', path: '/dashboard/runtime-discovery', icon: Search },
      { name: 'Shadow Crypto', path: '/dashboard/shadow-crypto', icon: Ghost },
      { name: 'Asset Intelligence', path: '/dashboard/asset-intelligence', icon: Brain },
    ],
  },
  {
    label: 'Operations',
    collapsible: true,
    items: [
      { name: 'Migration Timeline', path: '/dashboard/migration-timeline', icon: Clock },
      { name: 'Live Migration Ops', path: '/dashboard/live-migration', icon: Rocket },
      { name: 'Migration Terminal', path: '/dashboard/migration-terminal', icon: Terminal },
      { name: 'Hybrid Crypto Manager', path: '/dashboard/hybrid-crypto', icon: Settings },
      { name: 'Crypto-Agility Engine', path: '/dashboard/crypto-agility', icon: Zap },
      { name: 'PQC Orchestration', path: '/dashboard/pqc-orchestration', icon: Network },
      { name: 'Migration Sandbox', path: '/dashboard/migration-sandbox', icon: Box },
    ],
  },
  {
    label: 'Intelligence',
    collapsible: true,
    items: [
      { name: 'Threat Intel', path: '/dashboard/threat-intel', icon: Radio },
      { name: 'Drift Detection', path: '/dashboard/drift', icon: GitCompare },
      { name: 'Vulnerabilities', path: '/dashboard/vulnerabilities', icon: ShieldAlert },
      { name: 'Runtime Cryptographic Intelligence', path: '/dashboard/runtime-crypto-intel', icon: Microscope },
      { name: 'Behavioral Analytics', path: '/dashboard/behavioral-analytics', icon: Activity },
      { name: 'Telemetry Correlation', path: '/dashboard/telemetry-correlation', icon: LineChart },
      { name: 'Quantum Risk Scoring', path: '/dashboard/quantum-risk-scoring', icon: Target },
    ],
  },
  {
    label: 'Observability',
    collapsible: true,
    items: [
      { name: 'Runtime Visibility', path: '/dashboard/runtime-visibility', icon: Eye },
      { name: 'TLS Telemetry', path: '/dashboard/tls-telemetry', icon: Shield },
      { name: 'PKI Visibility', path: '/dashboard/pki-visibility', icon: Award },
      { name: 'Protocol Analytics', path: '/dashboard/protocol-analytics', icon: Activity },
      { name: 'Encryption Monitoring', path: '/dashboard/encryption-monitoring', icon: Lock },
    ],
  },
  {
    label: 'Trust Center',
    collapsible: true,
    items: [
      { name: 'Continuous Trust Validation', path: '/dashboard/continuous-trust', icon: CheckCircle },
      { name: 'Identity Trust', path: '/dashboard/identity-trust', icon: UserCheck },
      { name: 'Device Trust', path: '/dashboard/device-trust', icon: MonitorCheck },
      { name: 'Trust Analytics', path: '/dashboard/trust-analytics', icon: PieChart },
      { name: 'Zero Trust Validation', path: '/dashboard/zero-trust', icon: ShieldCheck },
    ],
  },
  {
    label: 'Governance',
    collapsible: true,
    items: [
      { name: 'Compliance', path: '/dashboard/compliance', icon: ClipboardCheck },
      { name: 'Hybrid Metrics', path: '/dashboard/hybrid-metrics', icon: BarChart3 },
      { name: 'Quantum Governance', path: '/dashboard/quantum-governance', icon: Scale },
      { name: 'Crypto Policies', path: '/dashboard/crypto-policies', icon: FileText },
      { name: 'Audit Vault', path: '/dashboard/audit-vault', icon: Database },
      { name: 'Executive Risk Dashboard', path: '/dashboard/executive-risk', icon: Layout },
      { name: 'Regulatory Mapping', path: '/dashboard/regulatory-mapping', icon: MapIcon },
    ],
  },
  {
    label: 'Telemetry',
    collapsible: true,
    items: [
      { name: 'Runtime Telemetry', path: '/dashboard/runtime-telemetry', icon: Activity },
      { name: 'Certificate Telemetry', path: '/dashboard/certificate-telemetry', icon: FileWarning },
      { name: 'Key Analytics', path: '/dashboard/key-analytics', icon: Key },
      { name: 'API Encryption Monitoring', path: '/dashboard/api-encryption', icon: Webhook },
      { name: 'Multi-Cloud Telemetry', path: '/dashboard/multi-cloud-telemetry', icon: Cloud },
    ],
  },
  {
    label: 'System',
    collapsible: true,
    items: [
      { name: 'Profile & Settings', path: '/dashboard/settings', icon: UserCog },
    ],
  },
];

export default function DashboardLayout() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Core': true,
    'Quantum Tools': false,
    'Discovery': false,
    'Operations': false,
    'Intelligence': false,
    'Observability': false,
    'Trust Center': false,
    'Governance': false,
    'Telemetry': false,
    'System': false
  });

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#050816] text-gold">
        <div className="rounded-lg border border-gold/20 bg-gold/[0.04] px-5 py-3 text-xs font-black uppercase tracking-[0.18em]">
          Securing session
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex h-screen bg-[#050816] text-white font-mono overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 lg:hidden glass-panel"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        ${sidebarWidth} flex flex-col border-r border-[#FFD36B]/15 bg-[#050816]/90 backdrop-blur-2xl transition-all duration-300 z-50
        fixed lg:relative inset-y-0 left-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand */}
        <div className={`flex items-center border-b border-gold/15 ${collapsed ? 'justify-center p-4' : 'p-5'}`}>
          <Link to="/" className="flex items-center gap-2.5 no-underline group">
            <div className="h-9 w-9 rounded-lg border border-gold/30 bg-gold/10 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.15)] group-hover:shadow-[0_0_28px_rgba(212,175,55,0.3)] transition-all">
              <ShieldAlert className="h-5 w-5 text-gold" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="block text-sm font-black uppercase tracking-[0.06em] text-gold gold-glow">
                  Qguard Helix
                </span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
                  Quantum SOC
                </span>
              </div>
            )}
          </Link>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5 scrollbar-thin">
          {NAV_SECTIONS.map(section => {
            const isCollapsible = section.collapsible;
            const isOpen = !isCollapsible || openSections[section.label];

            return (
              <div key={section.label} className="space-y-1">
                {!collapsed && (
                  <div 
                    className={`px-3 mb-1.5 text-[9px] font-black uppercase tracking-[0.22em] flex items-center justify-between transition-colors group/header ${isCollapsible ? 'cursor-pointer hover:text-gold text-gold/60' : 'text-white/20'}`}
                    onClick={() => isCollapsible && toggleSection(section.label)}
                  >
                    <div className="flex items-center gap-2">
                      {section.label === 'Quantum Tools' && <Sparkles className="h-2.5 w-2.5 text-gold/50 group-hover/header:text-gold transition-colors" />}
                      <span>{section.label}</span>
                    </div>
                    {isCollapsible && (
                      <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                )}
                {collapsed && <div className="h-px bg-gold/10 mx-2 mb-2" />}
                
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div 
                      initial={isCollapsible ? { height: 0, opacity: 0 } : false}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="space-y-0.5 overflow-hidden"
                    >
                      {section.items.map(item => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;

                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setMobileOpen(false)}
                            title={collapsed ? item.name : undefined}
                            className={`relative flex items-center gap-2.5 rounded-lg transition-all duration-200 no-underline ${
                              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                            } ${
                              isActive 
                                ? 'bg-gold/10 text-gold border border-gold/25 shadow-[0_0_18px_rgba(212,175,55,0.12)]' 
                                : 'text-white/45 hover:bg-white/[0.04] hover:text-white/75 border border-transparent'
                            }`}
                          >
                            {isActive && (
                              <motion.div 
                                layoutId="sidebarActive"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gold rounded-r-full shadow-[0_0_12px_rgba(212,175,55,0.6)]"
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                              />
                            )}
                            <Icon className={`shrink-0 ${collapsed ? 'h-5 w-5' : 'h-4 w-4'}`} />
                            {!collapsed && (
                              <span className="text-[11px] font-bold tracking-wide truncate">{item.name}</span>
                            )}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="border-t border-gold/15 p-2.5 space-y-1.5">
          {/* Collapse toggle (desktop) */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span className="text-[10px] font-bold tracking-wide">Collapse</span>}
          </button>

          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-white/30 hover:text-red-400 hover:bg-red-500/[0.06] transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className={`shrink-0 ${collapsed ? 'h-5 w-5' : 'h-4 w-4'}`} />
            {!collapsed && <span className="text-[11px] font-bold tracking-wide">Exit System</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative" style={{ background: '#050816' }}>
        {/* Atmospheric Background Layers */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {/* Deep navy base */}
          <div className="absolute inset-0 bg-[#050816]" />
          {/* Gold radial glow — top right */}
          <div className="absolute -right-24 -top-36 h-[560px] w-[560px] rounded-full border border-[#FFD36B]/10 bg-[radial-gradient(circle,rgba(255,211,107,0.14),rgba(255,179,0,0.04)_38%,transparent_68%)]" />
          {/* Gold radial glow — top left */}
          <div className="absolute left-1/4 top-0 h-80 w-[520px] bg-[radial-gradient(circle,rgba(255,211,107,0.08),transparent_68%)] blur-3xl" />
          {/* Subtle gold grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,211,107,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,211,107,0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-50" />
        </div>

        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-[#FFD36B]/15 bg-[#050816]/90 backdrop-blur-xl px-4 py-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg border border-gold/20 bg-gold/5 text-gold"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-gold" />
            <span className="text-sm font-black uppercase tracking-wider text-gold">Qguard Helix</span>
          </div>
        </div>

        <div className="relative z-10 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
