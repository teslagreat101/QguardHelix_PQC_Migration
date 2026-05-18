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
import { motion } from 'framer-motion';
import { ShieldAlert, Activity, Lock, Server } from 'lucide-react';

export default function ${compName}() {
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
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-[#FFD36B] drop-shadow-[0_0_15px_rgba(255,211,107,0.4)]">
              ${title}
            </h1>
            <p className="text-[#FFD36B]/60 mt-2 text-sm tracking-wide">
              ${desc}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-lg border border-[#FFD36B]/30 bg-[#FFD36B]/10 flex items-center gap-2 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs font-bold text-[#FFD36B] tracking-wider uppercase">System Active</span>
            </div>
          </div>
        </motion.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 relative rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl overflow-hidden min-h-[400px] flex items-center justify-center p-8 group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#FFD36B]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl border border-[#FFD36B]/30 bg-[#FFD36B]/10 flex items-center justify-center shadow-[0_0_30px_rgba(255,211,107,0.15)] mb-6">
                <ShieldAlert className="w-8 h-8 text-[#FFD36B]" />
              </div>
              <h2 className="text-xl font-bold tracking-widest text-white uppercase">Module Initializing</h2>
              <p className="text-[#FFD36B]/60 max-w-md mx-auto text-sm leading-relaxed">
                Secure backend connections (SSE) and data hooks are currently establishing trust with the Quantum SOC core. Please wait for telemetry stream...
              </p>
              
              <div className="mt-8 flex justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFD36B] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFD36B] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFD36B] animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </motion.div>

          {/* Side Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Status Card */}
            <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#FFD36B]/60 mb-4 font-bold">Live Telemetry</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#FFD36B]" />
                    <span className="text-sm text-white/80">Stream Status</span>
                  </div>
                  <span className="text-xs font-bold text-green-400">CONNECTING</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#FFD36B]" />
                    <span className="text-sm text-white/80">Encryption</span>
                  </div>
                  <span className="text-xs font-bold text-white">AES-GCM-256</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-[#FFD36B]" />
                    <span className="text-sm text-white/80">Node</span>
                  </div>
                  <span className="text-xs font-mono text-[#FFD36B]/80">QG-CORE-01</span>
                </div>
              </div>
            </div>

            {/* Audit Log Stub */}
            <div className="rounded-xl border border-[#FFD36B]/20 bg-[#050816]/60 backdrop-blur-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFD36B]/5 rounded-bl-full border-b border-l border-[#FFD36B]/10"></div>
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#FFD36B]/60 mb-4 font-bold relative z-10">Audit Log</h3>
              <div className="space-y-3 relative z-10">
                <div className="text-xs space-y-1">
                  <div className="text-[#FFD36B]/50 font-mono text-[9px]">10:45:21.042Z</div>
                  <div className="text-white/80">Initializing secure module container...</div>
                </div>
                <div className="text-xs space-y-1">
                  <div className="text-[#FFD36B]/50 font-mono text-[9px]">10:45:21.156Z</div>
                  <div className="text-white/80">Validating user authorization tokens...</div>
                </div>
                <div className="text-xs space-y-1">
                  <div className="text-[#FFD36B]/50 font-mono text-[9px]">10:45:21.304Z</div>
                  <div className="text-[#FFD36B]">Awaiting SSE stream payload...</div>
                </div>
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
  console.log('Created ' + filePath);
});
