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

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_dashboard_summary', { p_user_id: user.id });
    if (error) throw error;
    
    // Fallback if RPC fails or returns empty
    return data || {
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
      monitoringStatus: 'offline'
    };
  },

  async getExposureMap(): Promise<ExposureMapData> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_exposure_map', { p_user_id: user.id });
    if (error) throw error;

    return data || { nodes: [], edges: [] };
  },

  async getRecentEvents(limit = 50): Promise<SecurityEvent[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('get_recent_security_events', { 
      p_user_id: user.id,
      p_limit: limit
    });
    if (error) throw error;

    return data || [];
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
