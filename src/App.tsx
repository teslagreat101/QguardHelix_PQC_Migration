import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/auth-context';
import Landing from './pages/Landing';
import Auth from './app/authentication/Auth';
import LoginPage from './app/authentication/login/page';
import RegisterPage from './app/authentication/register/page';
import DashboardLayout from './app/dashboard/dashboard_layout/DashboardLayout';
import DashboardPage from './app/dashboard/page';
import DashboardOverview from './app/dashboard/dashboard_overview/page';
import AssetsMap from './app/dashboard/assets_map/page';
import MigrationTerminal from './app/dashboard/migration_terminal/page';
import Vulnerabilities from './app/dashboard/vulnerabilities/page';
import QuantumRiskOverview from './app/dashboard/quantum_risk_overview/page';
import MigrationPlanner from './app/dashboard/migration_planner/page';
import CbomExplorer from './app/dashboard/cbom_explorer/page';
import CryptoExposureMap from './app/dashboard/crypto_exposure_map/page';
import MigrationTimeline from './app/dashboard/migration_timeline/page';
import ComplianceDashboard from './app/dashboard/compliance_dashboard/page';
import LiveMigrationOps from './app/dashboard/live_migration_ops/page';
import ThreatIntelligence from './app/dashboard/threat_intelligence/page';
import DriftDetection from './app/dashboard/drift_detection/page';
import HybridDeploymentMetrics from './app/dashboard/hybrid_deployment_metrics/page';
import ScannerDashboard from './app/dashboard/scanner_dashboard/page';
import ProfileSettingsPage from './app/dashboard/settings/page';

// Quantum Tools Modules
import EncryptionKeysPage from './app/dashboard/keys/page';
import OTPPage from './app/dashboard/otp/page';
import PKIPage from './app/dashboard/pki/page';
import TokenizePage from './app/dashboard/tokenize/page';
import CommPage from './app/dashboard/comm/page';
import CloudPage from './app/dashboard/cloud/page';
import VaultPage from './app/dashboard/vault/page';
import QuantumGovernancePage from './app/dashboard/quantum-governance/page';
import QuantumQrngPage from './app/dashboard/qrng/page';

export default function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/authentication" element={<Auth />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/authentication/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/authentication/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard_overview" element={<DashboardOverview />} />

          <Route path="assets" element={<AssetsMap />} />
          <Route path="assets_map" element={<AssetsMap />} />

          <Route path="migrations" element={<MigrationTerminal />} />
          <Route path="migration-terminal" element={<MigrationTerminal />} />
          <Route path="migration_terminal" element={<MigrationTerminal />} />

          <Route path="vulnerabilities" element={<Vulnerabilities />} />

          <Route path="quantum-risk" element={<QuantumRiskOverview />} />
          <Route path="quantum_risk_overview" element={<QuantumRiskOverview />} />

          <Route path="migration-planner" element={<MigrationPlanner />} />
          <Route path="migration_planner" element={<MigrationPlanner />} />

          <Route path="cbom" element={<CbomExplorer />} />
          <Route path="cbom_explorer" element={<CbomExplorer />} />

          <Route path="exposure-map" element={<CryptoExposureMap />} />
          <Route path="crypto-exposure" element={<CryptoExposureMap />} />
          <Route path="crypto_exposure_map" element={<CryptoExposureMap />} />

          <Route path="timeline" element={<MigrationTimeline />} />
          <Route path="migration-timeline" element={<MigrationTimeline />} />
          <Route path="migration_timeline" element={<MigrationTimeline />} />

          <Route path="compliance" element={<ComplianceDashboard />} />
          <Route path="compliance_dashboard" element={<ComplianceDashboard />} />

          <Route path="live-ops" element={<LiveMigrationOps />} />
          <Route path="live-migration" element={<LiveMigrationOps />} />
          <Route path="live_migration_ops" element={<LiveMigrationOps />} />

          <Route path="threat-intel" element={<ThreatIntelligence />} />
          <Route path="threat_intelligence" element={<ThreatIntelligence />} />

          <Route path="drift" element={<DriftDetection />} />
          <Route path="drift_detection" element={<DriftDetection />} />

          <Route path="hybrid-metrics" element={<HybridDeploymentMetrics />} />
          <Route path="hybrid_deployment_metrics" element={<HybridDeploymentMetrics />} />
          <Route path="settings" element={<ProfileSettingsPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />

          <Route path="scanner" element={<ScannerDashboard />} />
          <Route path="scanner_dashboard" element={<ScannerDashboard />} />
          
          {/* Quantum Tools */}
          <Route path="keys" element={<EncryptionKeysPage />} />
          <Route path="encryption" element={<EncryptionKeysPage />} />

          <Route path="otp" element={<OTPPage />} />
          <Route path="auth-sec" element={<OTPPage />} />

          <Route path="pki" element={<PKIPage />} />
          <Route path="certificates" element={<PKIPage />} />

          <Route path="tokenize" element={<TokenizePage />} />
          <Route path="tokenization" element={<TokenizePage />} />

          <Route path="comm" element={<CommPage />} />
          <Route path="communications" element={<CommPage />} />

          <Route path="cloud" element={<CloudPage />} />
          <Route path="cloud-security" element={<CloudPage />} />

          <Route path="vault" element={<VaultPage />} />

          <Route path="quantum-governance" element={<QuantumGovernancePage />} />

          <Route path="qrng" element={<QuantumQrngPage />} />
          <Route path="quantum-qrng" element={<QuantumQrngPage />} />
        </Route>
      </Routes>
    </Router>
    </AuthProvider>
  );
}
