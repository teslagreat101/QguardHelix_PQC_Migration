import { supabase } from '@/lib/supabase';

export interface DashboardSummary {
  quantumRiskScore: number;
  riskBand: string;
  vulnerableAssetsCount: number;
  newVulnerableAssets: number;
  totalCbomItems: number;
  activeMigrations: number;
  failedMigrations: number;
  criticalExposures: number;
  highExposures: number;
  unresolvedVulns: number;
  expiringCerts: number;
  totalAssets: number;
  lastScanAt: string | null;
  monitoringStatus: string;
}

export interface ExposureNode {
  id: string;
  name: string;
  type: string;
  environment: string;
  criticality: string;
  status: string;
  riskScore: number;
}

export interface ExposureEdge {
  source: string;
  target: string;
  type: string;
}

export interface ExposureMapData {
  nodes: ExposureNode[];
  edges: ExposureEdge[];
}

export interface SecurityEvent {
  id: string;
  eventType: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  message: string;
  assetId: string | null;
  resourceName: string | null;
  resourceType: string | null;
  metadata: any;
  isRead: boolean;
  createdAt: string;
}

async function apiRequest<T>(path: string): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed with HTTP ${response.status}`);
  }
  return payload.data as T;
}

const EMPTY_SUMMARY: DashboardSummary = {
  quantumRiskScore: 0,
  riskBand: 'Unknown',
  vulnerableAssetsCount: 0,
  newVulnerableAssets: 0,
  totalCbomItems: 0,
  activeMigrations: 0,
  failedMigrations: 0,
  criticalExposures: 0,
  highExposures: 0,
  unresolvedVulns: 0,
  expiringCerts: 0,
  totalAssets: 0,
  lastScanAt: null,
  monitoringStatus: 'offline',
};

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    return apiRequest<DashboardSummary>('/api/v1/dashboard/summary').catch((error) => {
      console.error('Dashboard summary API error:', error);
      return EMPTY_SUMMARY;
    });
  },

  async getExposureMap(): Promise<ExposureMapData> {
    return apiRequest<ExposureMapData>('/api/v1/dashboard/exposure-map').catch((error) => {
      console.error('Dashboard exposure API error:', error);
      return { nodes: [], edges: [] };
    });
  },

  async getRecentEvents(limit = 50): Promise<SecurityEvent[]> {
    const data = await apiRequest<{ events: Array<SecurityEvent & { timestamp?: string }> }>(`/api/v1/dashboard/events?limit=${limit}`).catch((error) => {
      console.error('Dashboard events API error:', error);
      return { events: [] };
    });

    return (data.events || []).map((event) => ({
      ...event,
      createdAt: event.createdAt || event.timestamp || new Date().toISOString(),
    }));
  },

  subscribeToEvents(callback: (event: SecurityEvent) => void, onStatusChange?: (status: string) => void) {
    const channel = supabase
      .channel('security_events_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'security_events' },
        (payload) => {
          callback(payload.new as SecurityEvent);
        }
      )
      .subscribe((status) => {
        if (onStatusChange) onStatusChange(status);
      });
    return channel;
  },

  subscribeToDashboardUpdates(callback: () => void, onStatusChange?: (status: string) => void) {
    const channel = supabase
      .channel('dashboard_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          callback();
        }
      )
      .subscribe((status) => {
        if (onStatusChange) onStatusChange(status);
      });
    return channel;
  }
};
