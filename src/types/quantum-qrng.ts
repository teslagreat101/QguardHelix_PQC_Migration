export type EntropySourceType = 'hardware' | 'api' | 'pool' | 'hybrid' | 'simulation' | 'fallback';
export type EntropySourceMode = 'production' | 'simulation' | 'demo' | 'fallback' | 'degraded' | 'offline';
export type HealthStatus = 'passed' | 'warning' | 'failed' | 'insufficient_samples' | 'degraded' | 'offline' | 'simulation_only';

export interface EntropySource {
  id: string;
  name: string;
  type: EntropySourceType;
  mode: EntropySourceMode;
  health: HealthStatus;
  qualityScore: number;
  throughput: string; // e.g. "1.2 Gbps"
  bitstreamHealth: number; // 0-100
  uptime: string;
  latency: number; // ms
  isProductionSafe: boolean;
  lastCheck: string;
}

export interface EntropyHealthTest {
  name: string;
  result: number | string;
  threshold: number | string;
  status: HealthStatus;
  lastRun: string;
  sampleSize: number;
  details: string;
  recommendation?: string;
}

export interface QrngOutput {
  id: string;
  type: string;
  source: string;
  length: number;
  format: string;
  purpose: string;
  fingerprint: string;
  maskedPreview: string;
  entropyQuality: number;
  createdAt: string;
  expiresAt?: string;
}

export interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  timestamp?: string;
  details?: string;
}

export interface QrngAuditLog {
  id: string;
  event: string;
  actor: string;
  action: 'generate' | 'copy' | 'reveal' | 'export' | 'health_check';
  targetId: string;
  status: 'success' | 'failure' | 'warning';
  timestamp: string;
  metadata: any;
}

export interface GeneratedSecret {
  id: string;
  type: string;
  algorithm: string;
  length: number;
  source: string;
  qualityScore: number;
  fingerprint: string;
  purpose: string;
  owner: string;
  createdAt: string;
  expiresAt?: string;
  rotationPolicy: string;
  storageStatus: 'ephemeral' | 'vaulted' | 'wrapped';
}

export interface QrngKPI {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'stable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  updatedAt: string;
}
