import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BorderBeam } from "./border-beam";
import { Button } from "./button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Card } from "./card";
import { TracingBeam } from "./tracing-beam";
import { Shield, Search, Lock, FileCheck, ArrowRight, Zap, Database, Activity } from "lucide-react";

export const Hero195 = () => {
  const navigate = useNavigate();

  return (
    <section className="relative py-24 overflow-hidden bg-transparent">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full" />
      </div>

      <TracingBeam className="px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block px-4 py-1.5 rounded-full border border-gold/30 bg-gold/10 text-gold text-xs font-mono font-bold uppercase tracking-[0.2em] mb-6">
                Next-Gen PQC Infrastructure
              </span>
              <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-white mb-6">
                Qguard Helix <span className="text-gold gold-glow">Command Center</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
                A unified dashboard to visualize, migrate, and protect your entire cryptographic infrastructure 
                against tomorrow's quantum threats. Built for global scale and military precision.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mt-10 flex justify-center gap-4"
            >
              <Button 
                onClick={() => navigate('/auth')}
                size="lg" 
                className="bg-gold text-black hover:bg-white transition-all font-bold uppercase tracking-widest px-8"
              >
                Launch Command Center <Zap className="ml-2 w-4 h-4" />
              </Button>
            </motion.div>
          </div>

          {/* Tabbed Interface */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="relative"
          >
            <Tabs defaultValue="scanner" className="w-full">
              <div className="flex justify-center mb-12">
                <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl h-auto flex flex-wrap justify-center">
                  <TabsTrigger value="scanner" className="data-[state=active]:bg-gold data-[state=active]:text-black px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all">
                    <Search className="w-4 h-4 mr-2" /> Scanner
                  </TabsTrigger>
                  <TabsTrigger value="vault" className="data-[state=active]:bg-gold data-[state=active]:text-black px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all">
                    <Database className="w-4 h-4 mr-2" /> Vault
                  </TabsTrigger>
                  <TabsTrigger value="policy" className="data-[state=active]:bg-gold data-[state=active]:text-black px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all">
                    <FileCheck className="w-4 h-4 mr-2" /> Policy
                  </TabsTrigger>
                  <TabsTrigger value="planner" className="data-[state=active]:bg-gold data-[state=active]:text-black px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all">
                    <Zap className="w-4 h-4 mr-2" /> Planner
                  </TabsTrigger>
                  <TabsTrigger value="intel" className="data-[state=active]:bg-gold data-[state=active]:text-black px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all">
                    <Activity className="w-4 h-4 mr-2" /> Intelligence
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab Content 1: Scanner */}
              <TabsContent value="scanner" className="mt-0 focus-visible:ring-0 outline-none">
                <Card className="bg-cyber-navy/40 border-gold/20 backdrop-blur-xl relative overflow-hidden group">
                  <BorderBeam size={300} duration={8} delay={2} />
                  <div className="p-4 md:p-6">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-[16/9]">
                       <img 
                        src="/PQC_Scanner.png" 
                        alt="Scanner Dashboard" 
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                      
                      {/* Floating Status Indicator */}
                      <div className="absolute top-6 right-6">
                        <div className="flex items-center gap-2 bg-black/60 border border-gold/30 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                          <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
                          <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Live Scanner Active</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Tab Content 2: Vault */}
              <TabsContent value="vault" className="mt-0 focus-visible:ring-0 outline-none">
                <Card className="bg-cyber-navy/40 border-gold/20 backdrop-blur-xl relative overflow-hidden group">
                  <BorderBeam size={300} duration={8} delay={2} />
                  <div className="p-4 md:p-6">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-[16/9]">
                       <img 
                        src="/vault.png" 
                        alt="Quantum Vault Infrastructure" 
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                      
                      {/* Floating Status Indicator */}
                      <div className="absolute top-6 right-6">
                        <div className="flex items-center gap-2 bg-black/60 border border-gold/30 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                          <Lock className="w-3 h-3 text-gold" />
                          <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Vault Secure & Isolated</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Tab Content 3: Policy */}
              <TabsContent value="policy" className="mt-0 focus-visible:ring-0 outline-none">
                <Card className="bg-cyber-navy/40 border-gold/20 backdrop-blur-xl relative overflow-hidden group">
                  <BorderBeam size={300} duration={8} delay={2} />
                  <div className="p-4 md:p-6">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-[16/9]">
                       <img 
                        src="/Governance_Compliance.png" 
                        alt="PQC Compliance Engine" 
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                      
                      {/* Floating Status Indicator */}
                      <div className="absolute top-6 right-6">
                        <div className="flex items-center gap-2 bg-black/60 border border-gold/30 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                          <FileCheck className="w-3 h-3 text-gold" />
                          <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Compliance Aligned: CNSA 2.0</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Tab Content 4: Migration Planner */}
              <TabsContent value="planner" className="mt-0 focus-visible:ring-0 outline-none">
                <Card className="bg-cyber-navy/40 border-gold/20 backdrop-blur-xl relative overflow-hidden group">
                  <BorderBeam size={300} duration={8} delay={2} />
                  <div className="p-4 md:p-6">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-[16/9]">
                       <img 
                        src="/Migration_Planner.png" 
                        alt="PQC Migration Planner" 
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                      
                      {/* Floating Status Indicator */}
                      <div className="absolute top-6 right-6">
                        <div className="flex items-center gap-2 bg-black/60 border border-gold/30 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                          <Zap className="w-3 h-3 text-gold" />
                          <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Strategy Phase: Implementation</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>

              {/* Tab Content 5: Threat Intelligence */}
              <TabsContent value="intel" className="mt-0 focus-visible:ring-0 outline-none">
                <Card className="bg-cyber-navy/40 border-gold/20 backdrop-blur-xl relative overflow-hidden group">
                  <BorderBeam size={300} duration={8} delay={2} />
                  <div className="p-4 md:p-6">
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-[16/9]">
                       <img 
                        src="/Threat_Intelligence.png" 
                        alt="Quantum Threat Intelligence" 
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                      
                      {/* Floating Status Indicator */}
                      <div className="absolute top-6 right-6">
                        <div className="flex items-center gap-2 bg-black/60 border border-gold/30 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                          <Activity className="w-3 h-3 text-gold" />
                          <span className="text-[10px] text-gold font-bold uppercase tracking-widest">Global Threat Feed: ACTIVE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </TracingBeam>
    </section>
  );
};
