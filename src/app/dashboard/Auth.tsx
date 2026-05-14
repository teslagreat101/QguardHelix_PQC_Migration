import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Mail, Lock, User, ArrowRight, Loader2, KeyRound, Activity, AlertCircle, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate('/dashboard');
      }
    };
    checkUser();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        // Supabase sends a confirmation email by default
        setError("Identity created! Please check your email for a confirmation link.");
        return;
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex items-center justify-center p-6 lg:p-12 relative overflow-hidden">
      {/* Background Grid Pattern & Glows */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] [background-image:linear-gradient(rgba(212,175,55,1)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,1)_1px,transparent_1px)] [background-size:60px_60px]" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-gold/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gold/[0.03] rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-[1200px] w-full grid lg:grid-cols-2 gap-12 lg:gap-24 items-center z-10">
        
        {/* Left Side: Typography and Info */}
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-12"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/30 bg-gold/10 mb-8">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Secure Identity Gateway</span>
            </div>
            
            <h1 className="text-5xl lg:text-7xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-gold to-yellow-600 drop-shadow-[0_0_30px_rgba(212,175,55,0.4)] leading-[0.9] mb-6 font-mono">
              SECURE<br />
              ACCESS<br />
              NODE
            </h1>
            
            <p className="text-white/60 text-sm lg:text-base leading-relaxed max-w-md font-sans">
              Secure your future with QGuard — advanced quantum-ready protection, intelligent security tools, and real-time defense built for the next generation of cyber threats.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-gold/30 transition-colors">
              <Shield className="h-5 w-5 text-gold mb-4" />
              <div className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">PQC Session</div>
              <div className="text-xs font-bold text-white">ML-KEM Ready</div>
            </div>
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-gold/30 transition-colors">
              <KeyRound className="h-5 w-5 text-gold mb-4" />
              <div className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Entropy</div>
              <div className="text-xs font-bold text-white">QRNG Seeded</div>
            </div>
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-gold/30 transition-colors">
              <Activity className="h-5 w-5 text-gold mb-4" />
              <div className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Threat Feed</div>
              <div className="text-xs font-bold text-white">Live</div>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Auth Card */}
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md mx-auto"
        >
          <div className="relative border border-white/10 bg-[#0f0f13] rounded-2xl overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.6)] group">
            {/* Scanner Animation */}
            <motion.div 
              animate={{ 
                top: ['0%', '100%', '0%'],
                opacity: [0, 1, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent z-20 pointer-events-none"
              style={{
                boxShadow: '0 0 15px rgba(212,175,55,0.8), 0 0 30px rgba(212,175,55,0.4)'
              }}
            />
            
            {/* Scanner Glow Overlay */}
            <motion.div 
              animate={{ 
                top: ['0%', '100%', '0%'],
                opacity: [0, 0.15, 0]
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-gold/10 to-transparent z-10 pointer-events-none"
            />

            <div className="p-8 relative z-0">

              {/* Card Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 mb-6">
                  <div className="h-8 w-8 rounded-lg border border-gold/30 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                    <Shield className="h-4 w-4 text-gold" />
                  </div>
                  <span className="text-lg font-black tracking-[0.15em] text-gold">QGUARD</span>
                </div>
                <div className="text-[9px] font-black uppercase tracking-[0.3em] text-gold/60 mb-2 font-mono">Quantum Protocol</div>
                <h2 className="text-3xl font-black tracking-tight text-white mb-2 font-mono">Identity<br />Verification</h2>
                <p className="text-white/40 text-xs">Verify quantum identity signature to proceed.</p>
              </div>

              {/* Form */}
              <form onSubmit={handleAuth} className="space-y-5">
                <AnimatePresence mode="wait">
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gold/70">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <input 
                          type="text" 
                          required 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full bg-[#16161a] border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all placeholder-white/20"
                          placeholder="Enter your name"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gold/70">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input 
                      type="email" 
                      required 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#16161a] border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all placeholder-white/20"
                      placeholder="Enter your email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-gold/70">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                    <input 
                      type="password" 
                      required 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#16161a] border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20 transition-all placeholder-white/20"
                      placeholder="Enter secure passphrase"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="w-4 h-4 rounded border border-white/20 bg-white/5 flex items-center justify-center group-hover:border-gold/50 transition-colors">
                      <div className="w-2 h-2 rounded-sm bg-white" />
                    </div>
                    <span className="text-xs text-white/60 group-hover:text-white transition-colors">Keep Terminal Persistent</span>
                  </label>
                  <Link to="#" className="text-xs text-gold hover:text-gold/80 transition-colors">Lost Token?</Link>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-3 rounded-lg border flex gap-3 items-center ${error.includes('Identity created') ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider leading-relaxed">{error}</span>
                  </motion.div>
                )}

                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gold text-black hover:bg-yellow-400 h-12 rounded-xl font-black uppercase tracking-[0.15em] group transition-all active:scale-[0.98] mt-2 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)]"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>
                      {isLogin ? 'Initialize Session' : 'Deploy Identity'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-8">
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                  <div className="relative flex justify-center text-[9px] uppercase font-black tracking-widest"><span className="bg-[#0f0f13] px-4 text-white/30">OR</span></div>
                </div>

                <button className="w-full flex items-center justify-center px-4 py-3 border border-white/10 rounded-xl bg-[#16161a] hover:bg-white/5 transition-colors text-sm font-bold text-white/80">
                  <GoogleIcon />
                  Continue with Google
                </button>
                
                <div className="text-center mt-6">
                  <button 
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-xs text-white/50 hover:text-white transition-colors"
                  >
                    {isLogin ? (
                      <>New deployment? <span className="text-gold">Request Credentials</span></>
                    ) : (
                      <>Existing session? <span className="text-gold">Initialize Login</span></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <div className="mt-6 border border-white/10 bg-[#0f0f13] rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Quantum Sync Status</span>
              <span className="text-[10px] font-black tracking-widest text-gold">100%</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gold w-full" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-mono">Encrypted Connection Established</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
