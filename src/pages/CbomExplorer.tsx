import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, ChevronDown, ChevronRight, AlertTriangle,
  Shield, Lock, Unlock, Key, FileCode, Server, Database,
  Globe, Layers, Package, ExternalLink, Copy
} from 'lucide-react';

type CbomEntry = {
  id: string;
  component: string;
  type: 'library' | 'protocol' | 'certificate' | 'key-exchange' | 'hash';
  algorithm: string;
  keySize: number | null;
  location: string;
  isVulnerable: boolean;
  nistLevel: number;
  pqcReplacement: string | null;
  instances: number;
  lastSeen: string;
  dependencies: string[];
};

const CBOM_DATA: CbomEntry[] = [
  { id: 'cbom-001', component: 'openssl-3.2.1', type: 'library', algorithm: 'RSA-2048', keySize: 2048, location: '/usr/lib/libssl.so', isVulnerable: true, nistLevel: 0, pqcReplacement: 'ML-KEM-768', instances: 47, lastSeen: '2m ago', dependencies: ['nginx', 'node-tls', 'python-ssl'] },
  { id: 'cbom-002', component: 'tls-cert-prod', type: 'certificate', algorithm: 'ECDSA-P256', keySize: 256, location: '/etc/ssl/certs/prod.pem', isVulnerable: true, nistLevel: 0, pqcReplacement: 'ML-DSA-65', instances: 1, lastSeen: '5m ago', dependencies: ['api-gateway', 'cdn-origin'] },
  { id: 'cbom-003', component: 'jwt-rs256-auth', type: 'protocol', algorithm: 'RSA-PKCS1-v1.5', keySize: 2048, location: 'auth-service/jwt.ts', isVulnerable: true, nistLevel: 0, pqcReplacement: 'ML-DSA-44', instances: 12, lastSeen: '1m ago', dependencies: ['auth-service', 'user-api'] },
  { id: 'cbom-004', component: 'ssh-host-keys', type: 'key-exchange', algorithm: 'Diffie-Hellman', keySize: 2048, location: '/etc/ssh/sshd_config', isVulnerable: true, nistLevel: 0, pqcReplacement: 'ML-KEM-1024', instances: 23, lastSeen: '30s ago', dependencies: ['bastion-hosts', 'ci-runners'] },
  { id: 'cbom-005', component: 'argon2id-hash', type: 'hash', algorithm: 'Argon2id', keySize: null, location: 'auth-service/password.ts', isVulnerable: false, nistLevel: 5, pqcReplacement: null, instances: 1, lastSeen: '3m ago', dependencies: ['auth-service'] },
  { id: 'cbom-006', component: 'aes-256-gcm', type: 'library', algorithm: 'AES-256-GCM', keySize: 256, location: 'vault-service/encrypt.ts', isVulnerable: false, nistLevel: 5, pqcReplacement: null, instances: 8, lastSeen: '1m ago', dependencies: ['vault-service', 'file-storage'] },
  { id: 'cbom-007', component: 'sha-1-legacy', type: 'hash', algorithm: 'SHA-1', keySize: null, location: 'legacy-api/checksum.py', isVulnerable: true, nistLevel: 0, pqcReplacement: 'SHA3-256', instances: 3, lastSeen: '12m ago', dependencies: ['legacy-api'] },
  { id: 'cbom-008', component: 'ml-kem-768', type: 'library', algorithm: 'ML-KEM-768', keySize: 768, location: 'pqc-gateway/kem.ts', isVulnerable: false, nistLevel: 3, pqcReplacement: null, instances: 5, lastSeen: '45s ago', dependencies: ['pqc-gateway'] },
  { id: 'cbom-009', component: 'ml-dsa-65-sig', type: 'protocol', algorithm: 'ML-DSA-65', keySize: null, location: 'pqc-gateway/sign.ts', isVulnerable: false, nistLevel: 3, pqcReplacement: null, instances: 5, lastSeen: '45s ago', dependencies: ['pqc-gateway'] },
  { id: 'cbom-010', component: 'rsa-4096-backup', type: 'key-exchange', algorithm: 'RSA-4096', keySize: 4096, location: 'backup-service/encrypt.ts', isVulnerable: true, nistLevel: 0, pqcReplacement: 'ML-KEM-1024', instances: 2, lastSeen: '8m ago', dependencies: ['backup-service'] },
];

function getTypeIcon(type: CbomEntry['type']) {
  switch (type) {
    case 'library': return Package;
    case 'protocol': return Globe;
    case 'certificate': return FileCode;
    case 'key-exchange': return Key;
    case 'hash': return Lock;
  }
}

function getTypeColor(type: CbomEntry['type']) {
  switch (type) {
    case 'library': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    case 'protocol': return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    case 'certificate': return 'text-gold border-gold/30 bg-gold/10';
    case 'key-exchange': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    case 'hash': return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
  }
}

export default function CbomExplorer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showVulnerableOnly, setShowVulnerableOnly] = useState(false);

  const filtered = CBOM_DATA.filter(entry => {
    if (searchQuery && !entry.component.toLowerCase().includes(searchQuery.toLowerCase()) && !entry.algorithm.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedType && entry.type !== selectedType) return false;
    if (showVulnerableOnly && !entry.isVulnerable) return false;
    return true;
  });

  const stats = {
    total: CBOM_DATA.length,
    vulnerable: CBOM_DATA.filter(e => e.isVulnerable).length,
    pqcReady: CBOM_DATA.filter(e => !e.isVulnerable).length,
    totalInstances: CBOM_DATA.reduce((a, e) => a + e.instances, 0),
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white">
          CBOM <span className="text-gold">Explorer</span>
        </h1>
        <p className="text-white/50 mt-1 text-sm">Cryptography Bill of Materials — Full cryptographic asset inventory with quantum vulnerability analysis.</p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Components', value: stats.total, icon: Layers, color: 'text-white' },
          { label: 'Quantum Vulnerable', value: stats.vulnerable, icon: Unlock, color: 'text-red-400' },
          { label: 'PQC Ready', value: stats.pqcReady, icon: Shield, color: 'text-green-400' },
          { label: 'Total Instances', value: stats.totalInstances, icon: Server, color: 'text-gold' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="p-4 rounded-xl border border-gold/12 bg-black/50 backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="h-3.5 w-3.5 text-gold/50" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">{stat.label}</span>
            </div>
            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search components, algorithms..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-gold/15 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-gold/40 transition-colors text-white placeholder-white/25"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {['library', 'protocol', 'certificate', 'key-exchange', 'hash'].map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(selectedType === type ? null : type)}
              className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg border transition-all ${
                selectedType === type
                  ? 'border-gold/50 bg-gold/10 text-gold'
                  : 'border-gold/10 bg-black/30 text-white/40 hover:border-gold/25 hover:text-white/60'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowVulnerableOnly(!showVulnerableOnly)}
          className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg border transition-all flex items-center gap-1.5 ${
            showVulnerableOnly
              ? 'border-red-500/50 bg-red-500/10 text-red-400'
              : 'border-gold/10 bg-black/30 text-white/40 hover:border-gold/25'
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          Vulnerable Only
        </button>
      </div>

      {/* CBOM Table */}
      <div className="rounded-xl border border-gold/15 bg-black/50 backdrop-blur-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-gold/15 bg-gold/[0.03]">
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/40 w-8" />
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Component</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Type</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Algorithm</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Key Size</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Status</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">PQC Replacement</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Instances</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/8">
              {filtered.map(entry => {
                const TypeIcon = getTypeIcon(entry.type);
                const typeColor = getTypeColor(entry.type);
                const isExpanded = expandedId === entry.id;

                return (
                  <>
                    <tr
                      key={entry.id}
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                    >
                      <td className="p-4">
                        <ChevronRight className={`h-3.5 w-3.5 text-white/20 transition-transform ${isExpanded ? 'rotate-90 text-gold' : ''}`} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 text-gold/40" />
                          <span className="text-sm font-bold text-white/80 group-hover:text-white transition-colors">{entry.component}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${typeColor}`}>
                          {entry.type}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs text-white/60">{entry.algorithm}</td>
                      <td className="p-4 font-mono text-xs text-white/40">{entry.keySize || '—'}</td>
                      <td className="p-4">
                        {entry.isVulnerable ? (
                          <span className="text-[9px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1">
                            <Unlock className="h-3 w-3" /> Vulnerable
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-wider text-green-400 flex items-center gap-1">
                            <Shield className="h-3 w-3" /> Secure
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {entry.pqcReplacement ? (
                          <span className="text-xs font-bold text-gold">{entry.pqcReplacement}</span>
                        ) : (
                          <span className="text-xs text-green-400/50">N/A</span>
                        )}
                      </td>
                      <td className="p-4 text-xs font-mono text-white/50">{entry.instances}</td>
                    </tr>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          key={`${entry.id}-expanded`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <td colSpan={8} className="p-0">
                            <div className="px-8 py-5 bg-gold/[0.02] border-l-2 border-gold/30 space-y-3">
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                  <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-1">Location</div>
                                  <div className="flex items-center gap-1 text-xs font-mono text-white/60">
                                    <span className="truncate">{entry.location}</span>
                                    <Copy className="h-3 w-3 text-gold/30 hover:text-gold cursor-pointer shrink-0" />
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-1">NIST Security Level</div>
                                  <div className={`text-xs font-black ${entry.nistLevel > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    Level {entry.nistLevel}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-1">Last Seen</div>
                                  <div className="text-xs text-white/50 font-mono">{entry.lastSeen}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] font-black uppercase tracking-wider text-white/30 mb-1">Dependencies</div>
                                  <div className="flex flex-wrap gap-1">
                                    {entry.dependencies.map(dep => (
                                      <span key={dep} className="text-[9px] px-1.5 py-0.5 rounded border border-gold/15 bg-gold/5 text-gold/60 font-bold">{dep}</span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gold/10 flex items-center justify-between">
          <span className="text-[10px] text-white/30 font-bold">
            Showing {filtered.length} of {CBOM_DATA.length} components
          </span>
          <button className="text-[10px] font-black uppercase tracking-wider text-gold hover:text-gold/80 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Export CBOM
          </button>
        </div>
      </div>
    </div>
  );
}
