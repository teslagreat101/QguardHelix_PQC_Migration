import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Filter, Shield, AlertTriangle, ChevronRight, Globe, Server, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/auth-context';

type AssetRecord = {
  id: string;
  name: string;
  type: string;
  domain: string;
  ipAddress: string | null;
  url: string | null;
  cryptography: string[];
  cryptoInventory: any[];
  riskScore: number;
  qScore: number;
  riskLevel: string;
  complianceStatus: string;
  lastScanned: string;
  status: string;
  findingsCount: number;
  vulnerableCount: number;
  metadata: Record<string, unknown>;
};

function riskColor(score: number) {
  if (score >= 80) return 'text-red-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-green-400';
}

function riskBar(score: number) {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-green-500';
}

function formatDate(value: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function typeIcon(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('api') || lower.includes('web') || lower.includes('tls')) return Globe;
  if (lower.includes('ssh')) return ChevronRight;
  return Server;
}

export default function AssetsMap() {
  const { session } = useAuth();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/scanner/assets', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Unable to load asset inventory');
      setAssets(json?.data?.assets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load asset inventory');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return assets.filter((asset) => {
      if (query) {
        const values = [
          asset.name,
          asset.type,
          asset.domain,
          asset.ipAddress,
          asset.url,
          asset.complianceStatus,
          ...asset.cryptography,
        ];
        if (!values.some((value) => String(value || '').toLowerCase().includes(query))) return false;
      }
      if (riskFilter && asset.riskLevel?.toLowerCase() !== riskFilter) return false;
      return true;
    });
  }, [assets, riskFilter, searchQuery]);

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">Asset <span className="text-gold">Inventory</span></h1>
          <p className="text-white/50 mt-1 text-sm">Authorized cryptographic assets discovered from real scanner results.</p>
        </div>
        <button onClick={fetchAssets} className="px-4 py-2 rounded-lg border border-gold/20 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search assets, algorithms, domains, IP addresses..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-black/40 border border-gold/20 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-gold/50 transition-colors text-white placeholder-white/25"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['critical', 'high', 'medium', 'low'].map((level) => (
            <button key={level} onClick={() => setRiskFilter(riskFilter === level ? null : level)} className={`px-3 py-2 bg-black/40 border rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2 ${riskFilter === level ? 'border-gold/50 text-gold bg-gold/10' : 'border-gold/20 text-white/45 hover:text-white/70'}`}>
              <Filter className="h-3.5 w-3.5" /> {level}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Authorized Assets', value: assets.length, color: 'text-white', icon: Server },
          { label: 'Vulnerable Assets', value: assets.filter((asset) => asset.vulnerableCount > 0).length, color: 'text-red-400', icon: AlertTriangle },
          { label: 'Crypto Components', value: assets.reduce((sum, asset) => sum + asset.findingsCount, 0), color: 'text-gold', icon: Shield },
          { label: 'PQC Ready', value: assets.filter((asset) => asset.findingsCount > 0 && asset.vulnerableCount === 0).length, color: 'text-green-400', icon: Shield },
        ].map((item) => (
          <div key={item.label} className="p-4 rounded-xl border border-gold/12 bg-black/50 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className="h-3.5 w-3.5 text-gold/50" />
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/40">{item.label}</span>
            </div>
            <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-gold/5 border-b border-gold/20">
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Asset Name</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Type</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Domain / URL / IP</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Cryptography</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Risk Score</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Compliance</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Last Scanned</th>
                <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-gold/50 font-black uppercase tracking-widest">
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading Asset Inventory
                  </td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-14 text-center">
                    <div className="text-white/30 uppercase tracking-widest text-xs font-black mb-4">
                      No authorized assets scanned yet. Start a scan to build your cryptographic asset inventory.
                    </div>
                    <a href="/dashboard/scanner" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gold/30 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-wider">
                      <ExternalLink className="h-3.5 w-3.5" /> Start Authorized Scan
                    </a>
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-white/30 uppercase tracking-widest">No assets match the current search or filter.</td>
                </tr>
              ) : filteredAssets.map((asset) => {
                const Icon = typeIcon(asset.type);
                return (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={asset.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-gold transition-colors">{asset.name}</div>
                          <div className="text-[10px] text-white/30 font-mono">{asset.status}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-bold text-white/60">{asset.type}</td>
                    <td className="p-4 text-xs font-mono text-white/45">
                      <div className="max-w-[220px] truncate">{asset.url || asset.domain || asset.ipAddress || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1 max-w-[320px]">
                        {asset.cryptography.length === 0 ? (
                          <span className="text-[9px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-white/35 font-bold">Manual review</span>
                        ) : asset.cryptoInventory.slice(0, 8).map((crypto: any) => (
                          <span key={crypto.id} className={`text-[9px] px-2 py-0.5 rounded border ${crypto.is_vulnerable ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-green-500/30 bg-green-500/10 text-green-400'} font-bold`}>
                            {crypto.algorithm} {crypto.key_size ? `(${crypto.key_size})` : ''}
                          </span>
                        ))}
                        {asset.cryptoInventory.length > 8 && <span className="text-[9px] text-white/30">+{asset.cryptoInventory.length - 8}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className={`text-xs font-black ${riskColor(asset.riskScore)}`}>{asset.riskScore}/100</div>
                        <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full ${riskBar(asset.riskScore)}`} style={{ width: `${asset.riskScore}%` }} />
                        </div>
                      </div>
                      <div className="text-[9px] text-white/25 mt-1">Q-Score {asset.qScore}/100</div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${asset.vulnerableCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {asset.complianceStatus}
                      </span>
                    </td>
                    <td className="p-4 text-[10px] font-mono text-white/40">{formatDate(asset.lastScanned)}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <a href="/dashboard/cbom" className="text-[10px] font-black text-gold uppercase hover:underline">CBOM</a>
                        <a href="/dashboard/scanner" className="text-[10px] font-black text-white/40 uppercase hover:text-gold">Rescan</a>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
