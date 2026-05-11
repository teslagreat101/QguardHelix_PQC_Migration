import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Map as MapIcon, Terminal, ShieldAlert, LogOut,
  Eye, Route, Layers, Globe, Clock, ClipboardCheck,
  Rocket, Radio, GitCompare, BarChart3, ChevronLeft,
  ChevronRight, Menu, X, ScanSearch, ChevronDown,
  Cpu, Lock, Fingerprint, Award, Coins, MessageSquareLock, Cloud, Sparkles, Database
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const NAV_SECTIONS = [
  {
    label: 'Core',
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
    items: [
      { name: 'PQC Scanner', path: '/dashboard/scanner', icon: ScanSearch },
      { name: 'CBOM Explorer', path: '/dashboard/cbom', icon: Layers },
      { name: 'Crypto Exposure', path: '/dashboard/crypto-exposure', icon: Globe },
      { name: 'Assets & CBOM', path: '/dashboard/assets', icon: MapIcon },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Migration Timeline', path: '/dashboard/migration-timeline', icon: Clock },
      { name: 'Live Migration Ops', path: '/dashboard/live-migration', icon: Rocket },
      { name: 'Migration Terminal', path: '/dashboard/migration-terminal', icon: Terminal },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { name: 'Threat Intel', path: '/dashboard/threat-intel', icon: Radio },
      { name: 'Drift Detection', path: '/dashboard/drift', icon: GitCompare },
      { name: 'Vulnerabilities', path: '/dashboard/vulnerabilities', icon: ShieldAlert },
    ],
  },
  {
    label: 'Governance & Compliance',
    items: [
      { name: 'Quantum Governance', path: '/dashboard/quantum-governance', icon: ClipboardCheck },
      { name: 'Compliance Evidence', path: '/dashboard/compliance', icon: Award },
      { name: 'Hybrid Metrics', path: '/dashboard/hybrid-metrics', icon: BarChart3 },
    ],
  },
];

export default function DashboardLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    'Quantum Tools': false
  });

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';

  return (
    <div className="flex h-screen bg-black text-white font-mono overflow-hidden">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        ${sidebarWidth} flex flex-col border-r border-gold/15 bg-black/70 backdrop-blur-2xl transition-all duration-300 z-50
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
                            key={item.name}
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
      <main className="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyber-navy/40 via-black to-black relative">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-gold/15 bg-black/90 backdrop-blur-xl px-4 py-3">
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

        {/* Background Grid Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.07] [background-image:linear-gradient(rgba(212,175,55,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.15)_1px,transparent_1px)] [background-size:40px_40px]" />
        <div className="relative z-10 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
