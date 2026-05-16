import { useEffect, useState } from 'react';
import { ShieldAlert, AlertCircle, ShieldCheck, Filter, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';

export default function Vulnerabilities() {
  const [vulnerabilities, setVulnerabilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVulnerabilities() {
      const { data, error } = await supabase
        .from('crypto_inventory')
        .select(`
          *,
          assets(name, environment)
        `)
        .eq('is_vulnerable', true);
      
      if (error) console.error('Error fetching vulnerabilities:', error);
      else setVulnerabilities(data || []);
      setLoading(false);
    }

    fetchVulnerabilities();
  }, []);

  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Quantum <span className="text-red-500">Vulnerabilities</span></h1>
        <p className="text-white/50 mt-1">Identified cryptographic weaknesses vulnerable to Harvest Now, Decrypt Later (HNDL) attacks.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl">
          <div className="text-[10px] font-black uppercase tracking-widest text-red-500/60 mb-1">Critical Exposure</div>
          <div className="text-2xl font-black text-red-500">{vulnerabilities.length}</div>
        </div>
        <div className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-xl">
          <div className="text-[10px] font-black uppercase tracking-widest text-yellow-500/60 mb-1">Legacy Algorithms</div>
          <div className="text-2xl font-black text-yellow-500">
            {vulnerabilities.filter(v => v.algorithm === 'RSA' || v.algorithm === 'SHA-1').length}
          </div>
        </div>
        <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-xl">
          <div className="text-[10px] font-black uppercase tracking-widest text-green-500/60 mb-1">Remediated</div>
          <div className="text-2xl font-black text-green-500">12</div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-gold/50 font-black uppercase tracking-widest animate-pulse">Scanning for vulnerabilities...</div>
        ) : vulnerabilities.length === 0 ? (
          <div className="p-20 text-center border border-dashed border-white/10 rounded-xl">
            <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-4 opacity-50" />
            <div className="text-white/50 uppercase font-black tracking-widest">No Critical Vulnerabilities Detected</div>
            <p className="text-xs text-white/30 mt-2 uppercase">Your enterprise cryptographic posture is currently stable.</p>
          </div>
        ) : vulnerabilities.map((vuln, i) => (
          <motion.div
            key={vuln.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-5 border border-gold/20 bg-[#0f1428]/40 backdrop-blur-md rounded-xl flex items-center justify-between group hover:border-red-500/40 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white uppercase tracking-tight">{vuln.algorithm} Detected</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500 text-white font-black uppercase">Critical</span>
                </div>
                <div className="text-xs text-white/40 mt-1 uppercase font-bold tracking-wider">
                  Asset: <span className="text-white/70">{vuln.assets?.name}</span> • Env: <span className="text-white/70">{vuln.assets?.environment}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Exposure Level</div>
                <div className="text-xs font-bold text-white/70 uppercase">{vuln.exposure_level}</div>
              </div>
              <button className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                Remediate
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
