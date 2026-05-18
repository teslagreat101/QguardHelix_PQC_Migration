const fs = require('fs');
const path = require('path');

const pages = [
  { path: 'runtime-discovery', name: 'Runtime Discovery', desc: 'Real-time discovery of cryptographic assets and communications.', comp: 'RuntimeDiscoveryPage' },
  { path: 'shadow-crypto', name: 'Shadow Crypto', desc: 'Identify undocumented or non-compliant cryptographic implementations.', comp: 'ShadowCryptoPage' },
  { path: 'asset-intelligence', name: 'Asset Intelligence', desc: 'Advanced analytics and contextual intelligence for cryptographic assets.', comp: 'AssetIntelligencePage' },
  { path: 'hybrid-crypto', name: 'Hybrid Crypto Manager', desc: 'Manage hybrid post-quantum and classical cryptographic deployments.', comp: 'HybridCryptoManagerPage' },
  { path: 'crypto-agility', name: 'Crypto-Agility Engine', desc: 'Automated cryptographic transitions and agility enforcement.', comp: 'CryptoAgilityEnginePage' },
  { path: 'pqc-orchestration', name: 'PQC Orchestration', desc: 'Centralized orchestration for Post-Quantum Cryptography.', comp: 'PqcOrchestrationPage' },
  { path: 'migration-sandbox', name: 'Migration Sandbox', desc: 'Safe environment to test quantum-safe cryptographic migrations.', comp: 'MigrationSandboxPage' },
  { path: 'runtime-crypto-intel', name: 'Runtime Cryptographic Intelligence', desc: 'Live intelligence gathering on cryptographic operations.', comp: 'RuntimeCryptoIntelPage' },
  { path: 'behavioral-analytics', name: 'Behavioral Analytics', desc: 'AI-driven analysis of cryptographic usage patterns.', comp: 'BehavioralAnalyticsPage' },
  { path: 'telemetry-correlation', name: 'Telemetry Correlation', desc: 'Correlate telemetry data across multiple cryptographic endpoints.', comp: 'TelemetryCorrelationPage' },
  { path: 'quantum-risk-scoring', name: 'Quantum Risk Scoring', desc: 'Dynamic risk assessment of quantum vulnerability.', comp: 'QuantumRiskScoringPage' },
  { path: 'runtime-visibility', name: 'Runtime Visibility', desc: 'Complete observability of runtime cryptographic operations.', comp: 'RuntimeVisibilityPage' },
  { path: 'tls-telemetry', name: 'TLS Telemetry', desc: 'Deep inspection and telemetry for TLS/SSL connections.', comp: 'TlsTelemetryPage' },
  { path: 'pki-visibility', name: 'PKI Visibility', desc: 'Comprehensive monitoring of public key infrastructure.', comp: 'PkiVisibilityPage' },
  { path: 'protocol-analytics', name: 'Protocol Analytics', desc: 'Analysis of cryptographic protocols and handshakes.', comp: 'ProtocolAnalyticsPage' },
  { path: 'encryption-monitoring', name: 'Encryption Monitoring', desc: 'Continuous monitoring of encryption status across assets.', comp: 'EncryptionMonitoringPage' },
  { path: 'continuous-trust', name: 'Continuous Trust Validation', desc: 'Ongoing validation of cryptographic trust chains.', comp: 'ContinuousTrustPage' },
  { path: 'identity-trust', name: 'Identity Trust', desc: 'Verification and trust scoring for cryptographic identities.', comp: 'IdentityTrustPage' },
  { path: 'device-trust', name: 'Device Trust', desc: 'Hardware and endpoint cryptographic trust validation.', comp: 'DeviceTrustPage' },
  { path: 'trust-analytics', name: 'Trust Analytics', desc: 'Metrics and reporting on organizational cryptographic trust.', comp: 'TrustAnalyticsPage' },
  { path: 'zero-trust', name: 'Zero Trust Validation', desc: 'Zero trust architecture compliance and validation.', comp: 'ZeroTrustPage' },
  { path: 'crypto-policies', name: 'Crypto Policies', desc: 'Define and enforce enterprise cryptographic policies.', comp: 'CryptoPoliciesPage' },
  { path: 'audit-vault', name: 'Audit Vault', desc: 'Secure, immutable logging of cryptographic audits.', comp: 'AuditVaultPage' },
  { path: 'executive-risk', name: 'Executive Risk Dashboard', desc: 'High-level overview of quantum risk for executives.', comp: 'ExecutiveRiskPage' },
  { path: 'regulatory-mapping', name: 'Regulatory Mapping', desc: 'Map cryptographic posture to compliance frameworks.', comp: 'RegulatoryMappingPage' },
  { path: 'runtime-telemetry', name: 'Runtime Telemetry', desc: 'Streaming telemetry for runtime environments.', comp: 'RuntimeTelemetryPage' },
  { path: 'certificate-telemetry', name: 'Certificate Telemetry', desc: 'Detailed tracking of certificate lifecycles and usage.', comp: 'CertificateTelemetryPage' },
  { path: 'key-analytics', name: 'Key Analytics', desc: 'Advanced analytics on cryptographic key usage and rotation.', comp: 'KeyAnalyticsPage' },
  { path: 'api-encryption', name: 'API Encryption Monitoring', desc: 'Monitor encryption standards for API communications.', comp: 'ApiEncryptionPage' },
  { path: 'multi-cloud-telemetry', name: 'Multi-Cloud Telemetry', desc: 'Unified telemetry across multi-cloud cryptographic deployments.', comp: 'MultiCloudTelemetryPage' }
];

const template = (compName, title, desc) => `import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Activity, Lock, Server, Cpu, Zap, Wifi } from 'lucide-react';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';

export default function ${compName}() {
  const telemetry = useRealtimeStream('${title}');

  return (
    <div className="min-h-screen bg-[#050816] text-white p-6 relative overflow-hidden font-mono">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-[radial-gradient(circle,rgba(255,211,107,0.08)_0%,transparent_70%)] blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-[radial-gradient(circle,rgba(255,211,107,0.05)_0%,transparent_70%)] blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#FFD36B]/20 pb-6"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-[#FFD36B] drop-shadow-[0_0_15px_rgba(255,211,107,0.4)] flex items-center gap-3">
              <Zap className="w-8 h-8" />
              ${title}
            </h1>
            <p className="text-[#FFD36B]/60 mt-2 text-sm tracking-wide">
              ${desc}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg border border-[#FFD36B]/30 bg-[#FFD36B]/10 flex items-center gap-2 backdrop-blur-md">
              <div className={\`w-2 h-2 rounded-full \${telemetry.status === 'ACTIVE' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400 animate-pulse'}\`}></div>
              <span className="text-xs font-bold text-[#FFD36B] tracking-wider uppercase">
                {telemetry.status === 'ACTIVE' ? 'Stream Active' : 'Connecting SSE...'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visualization Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-6"
          >
            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FFD36B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <Activity className="w-5 h-5 text-[#FFD36B]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFD36B]/60">Latency</span>
                  </div>
                  <div className="text-3xl font-black text-white">{telemetry.latency}<span className="text-sm text-[#FFD36B]/50 ml-1">ms</span></div>
               </div>
               <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FFD36B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <Wifi className="w-5 h-5 text-[#FFD36B]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFD36B]/60">Throughput</span>
                  </div>
                  <div className="text-3xl font-black text-white">{telemetry.throughput}<span className="text-sm text-[#FFD36B]/50 ml-1">ops/s</span></div>
               </div>
               <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-start mb-4">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400/60">Quantum Risk</span>
                  </div>
                  <div className="text-3xl font-black text-red-400">{telemetry.quantumRiskScore}<span className="text-sm text-red-400/50 ml-1">/100</span></div>
               </div>
            </div>

            {/* Live Chart Area */}
            <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-6 h-[320px] flex flex-col">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#FFD36B]/60 mb-6 font-bold flex items-center gap-2">
                <Activity className="w-3 h-3" /> Live Operations Activity
              </h3>
              <div className="flex-1 flex items-end justify-between gap-1 mt-auto">
                {telemetry.metrics.map((m, i) => (
                  <div key={i} className="relative flex-1 group flex justify-center h-full items-end">
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: \`\${m.value}%\` }}
                      transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                      className="w-full max-w-[12px] bg-gradient-to-t from-[#FFD36B]/10 to-[#FFD36B] rounded-t-sm opacity-70 group-hover:opacity-100"
                    />
                    {/* Tooltip */}
                    <div className="absolute -top-8 bg-[#050816] border border-[#FFD36B]/30 px-2 py-1 rounded text-[9px] opacity-0 group-hover:opacity-100 pointer-events-none z-20 transition-opacity whitespace-nowrap shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                      {m.value} ops/s
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Side Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6 flex flex-col h-full"
          >
            {/* System Context */}
            <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#FFD36B]/60 mb-4 font-bold flex items-center gap-2">
                 <Server className="w-3 h-3" /> Infrastructure Context
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#FFD36B]/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#FFD36B]" />
                    <span className="text-xs text-white/80 uppercase tracking-wider">Encryption Protocol</span>
                  </div>
                  <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded">{telemetry.encryption}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#FFD36B]/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#FFD36B]" />
                    <span className="text-xs text-white/80 uppercase tracking-wider">Primary Node</span>
                  </div>
                  <span className="text-xs font-mono text-[#FFD36B]">{telemetry.node}</span>
                </div>
              </div>
            </div>

            {/* Audit Log Stream */}
            <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden flex-1 flex flex-col min-h-[300px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD36B]/5 rounded-bl-[100px] border-b border-l border-[#FFD36B]/10 pointer-events-none"></div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#FFD36B]/60 mb-4 font-bold relative z-10 flex items-center justify-between">
                <span>Real-Time Audit Events</span>
                <span className="flex h-2 w-2 relative">
                  {telemetry.status === 'ACTIVE' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD36B] opacity-75"></span>
                  )}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFD36B]"></span>
                </span>
              </h3>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 relative z-10 scrollbar-thin scrollbar-thumb-[#FFD36B]/20 max-h-[350px]">
                <AnimatePresence>
                  {telemetry.logs.map((log, i) => (
                    <motion.div 
                      key={log.timestamp + i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs space-y-1 border-l-2 pl-2"
                      style={{ borderColor: log.level === 'warn' ? '#fbbf24' : log.level === 'error' ? '#ef4444' : 'rgba(255,211,107,0.3)' }}
                    >
                      <div className="text-[#FFD36B]/50 font-mono text-[9px]">
                        {new Date(log.timestamp).toISOString().split('T')[1].replace('Z', '')}
                      </div>
                      <div className={\`\${log.level === 'warn' ? 'text-yellow-400/90' : log.level === 'error' ? 'text-red-400/90' : 'text-white/80'}\`}>
                        {log.message}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {telemetry.logs.length === 0 && (
                  <div className="text-xs text-white/30 italic text-center mt-10">Waiting for events...</div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}`;

const baseDir = path.join(__dirname, 'src', 'app', 'dashboard');

pages.forEach(p => {
  const dirPath = path.join(baseDir, p.path);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  const filePath = path.join(dirPath, 'page.tsx');
  fs.writeFileSync(filePath, template(p.comp, p.name, p.desc));
  console.log('Updated ' + filePath);
});
