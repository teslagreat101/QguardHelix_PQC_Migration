import { useEffect, useState } from 'react';
import { Search, Filter, Shield, AlertTriangle, ChevronRight, Database, Globe, Server } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

export default function AssetsMap() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchAssets() {
      const { data, error } = await supabase
        .from('assets')
        .select(`
          *,
          crypto_inventory(*),
          risk_scores(score, level)
        `);
      
      if (error) console.error('Error fetching assets:', error);
      else setAssets(data || []);
      setLoading(false);
    }

    fetchAssets();
  }, []);

  const filteredAssets = assets.filter(asset => 
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Asset <span className="text-gold">Inventory</span></h1>
        <p className="text-white/50 mt-1">Comprehensive Cryptography Bill of Materials (CBOM) across enterprise infrastructure.</p>
      </header>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input 
            type="text" 
            placeholder="Search assets, algorithms, IP addresses..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-gold/20 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-gold/50 transition-colors text-white"
          />
        </div>
        <button className="px-4 py-2 bg-gold/10 border border-gold/30 rounded-lg text-gold text-xs font-bold uppercase tracking-widest hover:bg-gold/20 transition-colors flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filter
        </button>
      </div>

      <div className="border border-gold/20 bg-black/40 backdrop-blur-md rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gold/5 border-b border-gold/20">
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Asset Name</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Type</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Cryptography</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Risk Score</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Compliance</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold/10">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gold/50 font-black uppercase tracking-widest animate-pulse">Loading Asset Inventory...</td>
              </tr>
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-white/30 uppercase tracking-widest">No assets found matching your criteria.</td>
              </tr>
            ) : filteredAssets.map((asset) => (
              <motion.tr 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={asset.id} 
                className="hover:bg-white/5 transition-colors group"
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                      {asset.type === 'Cloud' ? <Globe className="h-4 w-4" /> : asset.type === 'API' ? <ChevronRight className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-gold transition-colors">{asset.name}</div>
                      <div className="text-[10px] text-white/30 font-mono">{asset.ip_address}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-xs font-bold text-white/60">{asset.type}</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {asset.crypto_inventory?.map((crypto: any, i: number) => (
                      <span key={i} className={`text-[9px] px-2 py-0.5 rounded border ${crypto.is_vulnerable ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-green-500/30 bg-green-500/10 text-green-400'} font-bold`}>
                        {crypto.algorithm} {crypto.key_size ? `(${crypto.key_size})` : ''}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <div className={`text-xs font-black ${asset.risk_scores?.[0]?.score < 400 ? 'text-red-500' : asset.risk_scores?.[0]?.score < 700 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {asset.risk_scores?.[0]?.score || 'N/A'}
                    </div>
                    <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${asset.risk_scores?.[0]?.score < 400 ? 'bg-red-500' : asset.risk_scores?.[0]?.score < 700 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                        style={{ width: `${(asset.risk_scores?.[0]?.score || 0) / 10}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${asset.risk_scores?.[0]?.level === 'Quantum Safe' ? 'text-green-500' : 'text-red-500/70'}`}>
                    {asset.risk_scores?.[0]?.level || 'UNKNOWN'}
                  </span>
                </td>
                <td className="p-4">
                  <button className="text-[10px] font-black text-gold uppercase hover:underline">Manage</button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
