import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/auth-context';
import Landing from './pages/Landing';
import DashboardLayout from './pages/DashboardLayout';
import DashboardOverview from './pages/DashboardOverview';
import AssetsMap from './pages/AssetsMap';
import MigrationTerminal from './pages/MigrationTerminal';
import Vulnerabilities from './pages/Vulnerabilities';
import Auth from './pages/Auth';
import QuantumRiskOverview from './pages/QuantumRiskOverview';
import MigrationPlanner from './pages/MigrationPlanner';
import CbomExplorer from './pages/CbomExplorer';
import CryptoExposureMap from './pages/CryptoExposureMap';
import MigrationTimeline from './pages/MigrationTimeline';
import ComplianceDashboard from './pages/ComplianceDashboard';
import LiveMigrationOps from './pages/LiveMigrationOps';
import ThreatIntelligence from './pages/ThreatIntelligence';
import DriftDetection from './pages/DriftDetection';
import HybridDeploymentMetrics from './pages/HybridDeploymentMetrics';
import ScannerDashboard from './pages/ScannerDashboard';

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
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardOverview />} />
          <Route path="assets" element={<AssetsMap />} />
          <Route path="migrations" element={<MigrationTerminal />} />
          <Route path="vulnerabilities" element={<Vulnerabilities />} />
          <Route path="quantum-risk" element={<QuantumRiskOverview />} />
          <Route path="migration-planner" element={<MigrationPlanner />} />
          <Route path="cbom" element={<CbomExplorer />} />
          <Route path="exposure-map" element={<CryptoExposureMap />} />
          <Route path="crypto-exposure" element={<CryptoExposureMap />} />
          <Route path="timeline" element={<MigrationTimeline />} />
          <Route path="migration-timeline" element={<MigrationTimeline />} />
          <Route path="compliance" element={<ComplianceDashboard />} />
          <Route path="live-ops" element={<LiveMigrationOps />} />
          <Route path="live-migration" element={<LiveMigrationOps />} />
          <Route path="migration-terminal" element={<MigrationTerminal />} />
          <Route path="threat-intel" element={<ThreatIntelligence />} />
          <Route path="drift" element={<DriftDetection />} />
          <Route path="hybrid-metrics" element={<HybridDeploymentMetrics />} />
          <Route path="scanner" element={<ScannerDashboard />} />
          
          {/* Quantum Tools */}
          <Route path="keys" element={<EncryptionKeysPage />} />
          <Route path="otp" element={<OTPPage />} />
          <Route path="pki" element={<PKIPage />} />
          <Route path="tokenize" element={<TokenizePage />} />
          <Route path="comm" element={<CommPage />} />
          <Route path="cloud" element={<CloudPage />} />
          <Route path="vault" element={<VaultPage />} />
          <Route path="quantum-governance" element={<QuantumGovernancePage />} />
          <Route path="qrng" element={<QuantumQrngPage />} />
        </Route>
      </Routes>
    </Router>
    </AuthProvider>
  );
}
