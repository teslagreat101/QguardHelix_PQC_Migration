import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Shield, AlertTriangle, Activity, Terminal,
  Radio, Target, Search, ChevronRight, CheckCircle2, XCircle,
  Loader2, Server, Database, Globe, Wifi, Lock, Layers,
  Plus, Trash2, History, Network, RefreshCw, Copy, Download,
  RotateCcw, Eraser, FileWarning, KeyRound, Settings, Eye,
  PowerOff, ClipboardCheck, Package, Cloud, Code2, HardDrive
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import {
  parseAssetInput,
  deduplicateAssets,
  type ValidatedAsset
} from '@/lib/scanner/asset-validator';

type ScanStatus = 'idle' | 'queued' | 'running' | 'analyzing' | 'completed' | 'failed' | 'cancelled';
type TabId = 'setup' | 'overview' | 'findings' | 'logs' | 'history' | 'agents' | 'settings';

type DefensiveFinding = {
  id: string;
  algorithm: string;
  category: string;
  location: string;
  threatLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  status: string;
  description: string;
  recommendation: string;
  pqcReplacement: string | null;
  keySize: number | null;
  evidence: string;
  detectionMethod: string;
  source: string;
};

type ScanSummary = {
  targetsScanned: number;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  safe: number;
  vulnerable: number;
  pqcReady: number;
  riskScore: number;
  qScore: number;
};

type LogEntry = {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  phase?: string;
  severity?: DefensiveFinding['threatLevel'];
  elapsed?: string;
  moduleName?: string;
};

type ModuleStatus = 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Skipped' | 'No findings';

type ModuleState = {
  id: string;
  name: string;
  status: ModuleStatus;
  target?: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  findingsCount: number;
  severityCounts?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    safe: number;
  };
  error: string | null;
};

type HistoryEntry = {
  scanId: string;
  userId: string;
  target: string;
  scanType: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  status: string;
  detectedComponents: number;
  vulnerableFindings: number;
  pqcReadyFindings: number;
  riskScore: number | null;
  qScore: number | null;
  telemetry: any[];
  moduleStates?: ModuleState[];
  scannerModulesUsed?: string[];
  errorLogs: string[];
  linkedCbomRecords: string[];
  linkedAssetRecords: string[];
  linkedExposureNodes: string[];
};

type AgentPolicy = {
  enabled?: boolean;
  intervalSeconds?: number;
  interval_seconds?: number;
  allowedTargets?: string[];
  allowed_targets?: string[];
  allowedPaths?: string[];
  allowed_paths?: string[];
  scanTypes?: string[];
  scan_types?: string[];
  alertThreshold?: string;
  alert_threshold?: string;
};

type CollectorAgent = {
  id: string;
  user_id: string;
  name: string;
  status: 'active' | 'online' | 'offline' | 'pending' | 'degraded' | 'unhealthy' | 'revoked' | 'updating' | string;
  hostname?: string | null;
  platform?: string | null;
  version?: string | null;
  capabilities?: Record<string, unknown>;
  policy?: AgentPolicy;
  last_seen_at?: string | null;
  revoked_at?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
};

type ScannerEvidenceRow = {
  id: string;
  agent_id?: string | null;
  evidence_type?: string | null;
  asset_name?: string | null;
  observed_algorithm?: string | null;
  host?: string | null;
  file_path?: string | null;
  observed_at?: string | null;
  created_at?: string | null;
};

type ScannerAlertRow = {
  id: string;
  agent_id?: string | null;
  severity?: string | null;
  category?: string | null;
  title?: string | null;
  message?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AgentFormState = {
  name: string;
  environment: string;
  allowedTargets: string;
  allowedPaths: string;
  intervalSeconds: string;
  scanTypes: string[];
  alertThreshold: string;
};

type OneTimeAgentToken = {
  agentId: string;
  token: string;
  createdAt: string;
  mode: 'created' | 'rotated';
} | null;

function sevColor(s: string) {
  switch (s.toLowerCase()) {
    case 'critical': return { t: 'text-red-400', b: 'bg-red-500/10', br: 'border-red-500/30', d: 'bg-red-500' };
    case 'high': return { t: 'text-orange-400', b: 'bg-orange-500/10', br: 'border-orange-500/30', d: 'bg-orange-500' };
    case 'medium': return { t: 'text-yellow-400', b: 'bg-yellow-500/10', br: 'border-yellow-500/30', d: 'bg-yellow-500' };
    case 'low': return { t: 'text-green-400', b: 'bg-green-500/10', br: 'border-green-500/30', d: 'bg-green-500' };
    case 'safe': return { t: 'text-green-400', b: 'bg-green-500/10', br: 'border-green-500/30', d: 'bg-green-500' };
    default: return { t: 'text-cyan-400', b: 'bg-cyan-500/10', br: 'border-cyan-500/30', d: 'bg-cyan-500' };
  }
}

function logColor(level: string) {
  switch (level) {
    case 'WARN': return 'text-yellow-400';
    case 'ERROR': return 'text-red-500';
    case 'SUCCESS': return 'text-green-400';
    default: return 'text-white/50';
  }
}

function targetIcon(t: string) {
  const lower = t.toLowerCase();
  if (lower.includes('certificate') || lower.includes('tls') || lower.includes('ssh') || lower.includes('key')) return Lock;
  if (lower.includes('database')) return Database;
  if (lower.includes('protocol') || lower.includes('api') || lower.includes('url')) return Globe;
  if (lower.includes('library') || lower.includes('source')) return Layers;
  if (lower.includes('wireless')) return Wifi;
  return Server;
}

function statusToLevel(type: string, status?: string): LogEntry['level'] {
  if (type.includes('failed') || status === 'failed' || type === 'error') return 'ERROR';
  if (type.includes('complete') || status === 'completed') return 'SUCCESS';
  if (type.includes('warning') || type.includes('cancel')) return 'WARN';
  return 'INFO';
}

function formatMs(ms: number | null) {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatElapsed(startedAt: number | null, timestamp?: string) {
  if (!startedAt) return '00:00';
  const end = timestamp ? Date.parse(timestamp) : Date.now();
  const seconds = Math.max(0, Math.floor((end - startedAt) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function moduleStatusColor(status: ModuleStatus) {
  switch (status) {
    case 'Running': return 'border-gold/40 bg-gold/10 text-gold';
    case 'Completed': return 'border-green-500/30 bg-green-500/10 text-green-400';
    case 'Failed': return 'border-red-500/30 bg-red-500/10 text-red-400';
    case 'Skipped': return 'border-white/10 bg-white/[0.03] text-white/35';
    case 'No findings': return 'border-cyan-500/25 bg-cyan-500/10 text-cyan-400';
    default: return 'border-white/10 bg-[#0f1428]/30 text-white/35';
  }
}

function normalizeAgentPolicy(policy?: AgentPolicy) {
  return {
    enabled: policy?.enabled !== false,
    intervalSeconds: Number(policy?.intervalSeconds || policy?.interval_seconds || 300),
    allowedTargets: policy?.allowedTargets || policy?.allowed_targets || [],
    allowedPaths: policy?.allowedPaths || policy?.allowed_paths || [],
    scanTypes: policy?.scanTypes || policy?.scan_types || ['tls', 'ssh', 'packages', 'configs'],
    alertThreshold: policy?.alertThreshold || policy?.alert_threshold || 'moderate',
  };
}

function isAgentOnline(agent: CollectorAgent) {
  if (agent.revoked_at || agent.status === 'revoked') return false;
  if (!agent.last_seen_at) return false;
  return Date.now() - Date.parse(agent.last_seen_at) < 10 * 60 * 1000;
}

function agentDisplayStatus(agent: CollectorAgent) {
  if (agent.revoked_at || agent.status === 'revoked') return 'Revoked';
  if (agent.status === 'updating') return 'Updating';
  if (agent.status === 'degraded' || agent.status === 'unhealthy') return 'Unhealthy';
  if (isAgentOnline(agent)) return 'Online';
  if (!agent.last_seen_at) return 'Pending setup';
  return 'Offline';
}

function agentStatusClass(status: string) {
  switch (status.toLowerCase()) {
    case 'online': return 'border-green-500/30 bg-green-500/10 text-green-400';
    case 'offline': return 'border-red-500/30 bg-red-500/10 text-red-400';
    case 'pending setup': return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
    case 'unhealthy': return 'border-orange-500/30 bg-orange-500/10 text-orange-400';
    case 'revoked': return 'border-white/10 bg-white/[0.03] text-white/35';
    case 'updating': return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400';
    default: return 'border-gold/20 bg-gold/10 text-gold';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function serializeLogs(logs: LogEntry[]) {
  return logs.map((entry) => `[${entry.elapsed || entry.timestamp}] [${entry.level}] ${entry.moduleName ? `[${entry.moduleName}] ` : ''}${entry.message}`).join('\n');
}

export default function ScannerDashboard() {
  const { session, user } = useAuth();
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [activeTab, setActiveTab] = useState<TabId>('setup');
  const [sevFilter, setSevFilter] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [targets, setTargets] = useState<ValidatedAsset[]>([]);
  const [authorizationAccepted, setAuthorizationAccepted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [findings, setFindings] = useState<DefensiveFinding[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [terminalPaused, setTerminalPaused] = useState(false);
  const [terminalPinned, setTerminalPinned] = useState(true);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
  const [agents, setAgents] = useState<CollectorAgent[]>([]);
  const [agentEvidence, setAgentEvidence] = useState<ScannerEvidenceRow[]>([]);
  const [agentAlerts, setAgentAlerts] = useState<ScannerAlertRow[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [oneTimeAgentToken, setOneTimeAgentToken] = useState<OneTimeAgentToken>(null);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState<AgentFormState>({
    name: 'Production Collector Agent',
    environment: 'production',
    allowedTargets: 'https://api.customer.com\nssh://server.customer.com:22',
    allowedPaths: 'C:\\Apps\\CustomerApi',
    intervalSeconds: '300',
    scanTypes: ['tls', 'ssh', 'packages', 'configs'],
    alertThreshold: 'moderate',
  });
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const isRunning = status === 'queued' || status === 'running' || status === 'analyzing';

  const authHeaders = useCallback(() => {
    if (!session?.access_token) return null;
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session?.access_token]);

  const addLog = useCallback((entry: Omit<LogEntry, 'timestamp'> & { timestamp?: string }) => {
    setLogs((prev) => [
      ...prev.slice(-499),
      {
        timestamp: entry.timestamp || new Date().toISOString(),
        level: entry.level,
        message: entry.message,
        phase: entry.phase,
        severity: entry.severity,
        elapsed: entry.elapsed || formatElapsed(scanStartedAt, entry.timestamp),
        moduleName: entry.moduleName,
      },
    ]);
  }, [scanStartedAt]);

  const fetchHistory = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/v1/scanner/history', { headers });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Unable to load scan history');
      setHistory(json?.data?.history || []);
    } catch (err) {
      addLog({ level: 'ERROR', message: err instanceof Error ? err.message : 'History load failed' });
    } finally {
      setHistoryLoading(false);
    }
  }, [addLog, authHeaders]);

  const fetchAgents = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) return;
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const [agentsRes, evidenceRes, alertsRes] = await Promise.all([
        fetch('/api/v1/agent-scanner/agents', { headers }),
        fetch('/api/v1/agent-scanner/evidence', { headers }),
        fetch('/api/v1/agent-scanner/alerts', { headers }),
      ]);
      const agentsJson = await agentsRes.json();
      const evidenceJson = await evidenceRes.json();
      const alertsJson = await alertsRes.json();
      if (!agentsRes.ok) throw new Error(agentsJson?.error?.message || 'Unable to load collector agents');
      if (!evidenceRes.ok) throw new Error(evidenceJson?.error?.message || 'Unable to load collector evidence');
      if (!alertsRes.ok) throw new Error(alertsJson?.error?.message || 'Unable to load collector alerts');
      const nextAgents = agentsJson?.data?.agents || [];
      setAgents(nextAgents);
      setAgentEvidence(evidenceJson?.data?.evidence || []);
      setAgentAlerts(alertsJson?.data?.alerts || []);
      setSelectedAgentId((current) => current || nextAgents[0]?.id || null);
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Collector agents load failed');
    } finally {
      setAgentsLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchHistory();
    fetchAgents();
  }, [fetchAgents, fetchHistory]);

  useEffect(() => {
    if (!terminalPaused && terminalPinned) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length, terminalPaused, terminalPinned]);

  const handleParseInput = () => {
    const parsed = parseAssetInput(inputText);
    const valid = parsed.filter((item) => item.valid);
    const invalid = parsed.filter((item) => !item.valid);
    setTargets(deduplicateAssets([...targets, ...valid]));
    setInputText('');
    if (invalid.length) {
      addLog({ level: 'WARN', message: `${invalid.length} invalid target(s) were skipped during local validation` });
    }
  };

  const handleStart = useCallback(async () => {
    const headers = authHeaders();
    if (!headers || !user) {
      setError('Sign in before starting an authorized scan.');
      return;
    }
    if (!authorizationAccepted) {
      setError('Confirm authorization for every submitted target before scanning.');
      return;
    }
    if (isRunning || targets.length === 0) return;

    const startedAtMs = Date.now();
    setError(null);
    setSummary(null);
    setFindings([]);
    setLogs([]);
    setModules([]);
    setProgress(0);
    setJobId(null);
    setCopiedLogs(false);
    setTerminalPaused(false);
    setTerminalPinned(true);
    setScanStartedAt(startedAtMs);
    setStatus('queued');
    setActiveTab('overview');
    addLog({ level: 'INFO', message: 'Scan job created', elapsed: '00:00' });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const params = new URLSearchParams({
        authorized: 'true',
        targets: JSON.stringify(targets.map((target) => target.normalized || target.raw)),
      });
      const response = await fetch(`/api/v1/scanner/stream?${params.toString()}`, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error?.message || `Scanner request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const line = chunk.split('\n').find((item) => item.startsWith('data: '));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));
          if (event.jobId) setJobId(event.jobId);
          if (typeof event.progress === 'number') setProgress(Math.max(0, Math.min(100, event.progress)));
          if (event.status) setStatus(event.status);
          if (Array.isArray(event.moduleCatalog)) setModules(event.moduleCatalog);
          if (Array.isArray(event.modules) && event.type === 'module-catalog') setModules(event.modules);
          if (event.type === 'module-state' && event.module) {
            setModules((prev) => {
              const incoming = event.module as ModuleState;
              const exists = prev.some((module) => module.id === incoming.id);
              return exists
                ? prev.map((module) => module.id === incoming.id ? { ...module, ...incoming } : module)
                : [...prev, incoming];
            });
          }

          const message = event.message || event.label || event.moduleName || event.type || 'Scanner event';
          addLog({
            timestamp: event.timestamp,
            level: event.type === 'finding-detected'
              ? event.severity === 'CRITICAL' || event.severity === 'HIGH' ? 'WARN' : event.severity === 'SAFE' ? 'SUCCESS' : 'INFO'
              : statusToLevel(String(event.type || ''), event.status),
            message,
            phase: event.phase,
            severity: event.severity,
            moduleName: event.moduleName || event.module?.name,
            elapsed: formatElapsed(startedAtMs, event.timestamp),
          });

          if (event.finding) {
            setFindings((prev) => prev.some((finding) => finding.id === event.finding.id) ? prev : [...prev, event.finding]);
          }
          if (event.type === 'finding-detected' && event.summary) setSummary(event.summary);

          if (Array.isArray(event.results)) {
            const allFindings = event.results.flatMap((result: any) => result.findings || []);
            setFindings(allFindings);
          }

          if (event.summary) setSummary(event.summary);
          if (Array.isArray(event.moduleStates)) setModules(event.moduleStates);
          if (event.type === 'scan-complete') {
            setStatus('completed');
            setProgress(100);
            setActiveTab('findings');
            await fetchHistory();
          }
          if (event.type === 'scan-failed') {
            setStatus('failed');
            setError(event.message || 'Scan failed');
            await fetchHistory();
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('cancelled');
        addLog({ level: 'WARN', message: 'Scan stream cancelled by user' });
      } else {
        const message = err instanceof Error ? err.message : 'Scan failed';
        setStatus('failed');
        setError(message);
        addLog({ level: 'ERROR', message });
      }
    } finally {
      abortRef.current = null;
    }
  }, [addLog, authHeaders, authorizationAccepted, fetchHistory, isRunning, targets, user]);

  const handleCancel = useCallback(async () => {
    abortRef.current?.abort();
    if (jobId && session?.access_token) {
      await fetch(`/api/v1/scanner/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch(() => undefined);
    }
    setStatus('cancelled');
  }, [jobId, session?.access_token]);

  const handleCopyLogs = useCallback(async () => {
    const text = serializeLogs(logs);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 1500);
    } catch {
      addLog({ level: 'ERROR', message: 'Unable to copy logs to clipboard' });
    }
  }, [addLog, logs]);

  const handleDownloadReport = useCallback(() => {
    const payload = {
      generatedAt: new Date().toISOString(),
      status,
      progress,
      jobId,
      summary,
      modules,
      findings,
      logs,
      targets,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qguard-scan-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [findings, jobId, logs, modules, progress, status, summary, targets]);

  const handleClearTerminal = useCallback(() => {
    if (isRunning) return;
    setLogs([]);
    setCopiedLogs(false);
  }, [isRunning]);

  const copyPlainText = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(key);
      setTimeout(() => setCopiedCommand(null), 1600);
    } catch {
      setAgentsError('Unable to copy to clipboard');
    }
  }, []);

  const agentPolicyFromForm = useCallback(() => ({
    enabled: true,
    intervalSeconds: Math.max(60, Number(agentForm.intervalSeconds || 300)),
    allowedTargets: agentForm.allowedTargets.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
    allowedPaths: agentForm.allowedPaths.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean),
    scanTypes: agentForm.scanTypes,
    alertThreshold: agentForm.alertThreshold,
  }), [agentForm]);

  const handleCreateAgent = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) {
      setAgentsError('Sign in before creating a collector agent.');
      return;
    }
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const response = await fetch('/api/v1/agent-scanner/agents/enroll', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentForm.name,
          environment: agentForm.environment,
          hostname: 'pending-customer-install',
          platform: 'customer-managed',
          version: '0.1.0',
          capabilities: Object.fromEntries(agentForm.scanTypes.map((scanType) => [scanType, true])),
          policy: agentPolicyFromForm(),
          metadata: { environment: agentForm.environment, source: 'dashboard-agent-collector-tab' },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || 'Unable to create collector agent');
      const agentId = json?.data?.enrollment?.agentId;
      const token = json?.data?.enrollment?.agentToken;
      if (agentId && token) {
        setOneTimeAgentToken({ agentId, token, createdAt: new Date().toISOString(), mode: 'created' });
        setSelectedAgentId(agentId);
      }
      await fetchAgents();
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Collector agent creation failed');
    } finally {
      setAgentsLoading(false);
    }
  }, [agentForm, agentPolicyFromForm, authHeaders, fetchAgents]);

  const handleRotateAgentToken = useCallback(async (agentId: string) => {
    const headers = authHeaders();
    if (!headers) return;
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const response = await fetch(`/api/v1/agent-scanner/agents/${agentId}/token/rotate`, {
        method: 'POST',
        headers,
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || 'Unable to rotate collector token');
      setOneTimeAgentToken({
        agentId,
        token: json?.data?.agentToken,
        createdAt: json?.data?.rotatedAt || new Date().toISOString(),
        mode: 'rotated',
      });
      await fetchAgents();
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Token rotation failed');
    } finally {
      setAgentsLoading(false);
    }
  }, [authHeaders, fetchAgents]);

  const handleRevokeAgent = useCallback(async (agentId: string) => {
    const headers = authHeaders();
    if (!headers) return;
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const response = await fetch(`/api/v1/agent-scanner/agents/${agentId}/revoke`, { method: 'POST', headers });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || 'Unable to revoke collector agent');
      await fetchAgents();
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Collector revoke failed');
    } finally {
      setAgentsLoading(false);
    }
  }, [authHeaders, fetchAgents]);

  const handleDeleteAgent = useCallback(async (agentId: string) => {
    const headers = authHeaders();
    if (!headers) return;
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const response = await fetch(`/api/v1/agent-scanner/agents/${agentId}`, { method: 'DELETE', headers });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || 'Unable to delete collector agent');
      setSelectedAgentId((current) => current === agentId ? null : current);
      await fetchAgents();
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Collector delete failed');
    } finally {
      setAgentsLoading(false);
    }
  }, [authHeaders, fetchAgents]);

  const handleAssignCurrentScope = useCallback(async (agentId: string) => {
    const headers = authHeaders();
    if (!headers) return;
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const response = await fetch(`/api/v1/agent-scanner/agents/${agentId}/policy`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(agentPolicyFromForm()),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || 'Unable to assign scan scope');
      await fetchAgents();
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : 'Scan scope assignment failed');
    } finally {
      setAgentsLoading(false);
    }
  }, [agentPolicyFromForm, authHeaders, fetchAgents]);

  const handleRetryFailedModule = useCallback((module: ModuleState) => {
    addLog({ level: 'WARN', message: `Retry requested for ${module.name}; rerunning the authorized scan for the same target queue.`, moduleName: module.name });
    if (!isRunning) void handleStart();
  }, [addLog, handleStart, isRunning]);

  const riskLabel = summary
    ? summary.riskScore >= 80 ? 'Critical' : summary.riskScore >= 60 ? 'High' : summary.riskScore >= 40 ? 'Medium' : 'Low'
    : 'Idle';

  const liveCounts = {
    assets: summary?.targetsScanned ?? 0,
    components: summary?.totalFindings ?? findings.length,
    critical: summary?.critical ?? findings.filter((finding) => finding.threatLevel === 'CRITICAL').length,
    high: summary?.high ?? findings.filter((finding) => finding.threatLevel === 'HIGH').length,
    medium: summary?.medium ?? findings.filter((finding) => finding.threatLevel === 'MEDIUM').length,
    low: summary?.low ?? findings.filter((finding) => finding.threatLevel === 'LOW').length,
    pqcReady: summary?.pqcReady ?? findings.filter((finding) => finding.threatLevel === 'SAFE').length,
    vulnerable: summary?.vulnerable ?? findings.filter((finding) => finding.threatLevel !== 'SAFE').length,
  };

  const failedModules = modules.filter((module) => module.status === 'Failed');
  const terminalVisible = status !== 'idle' || logs.length > 0;
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) || agents[0] || null;
  const tenantId = user?.id || 'tenant_id_here';
  const apiUrlPlaceholder = typeof window !== 'undefined' ? window.location.origin : 'https://api.yourdomain.com';
  const selectedAgentPolicy = normalizeAgentPolicy(selectedAgent?.policy);
  const selectedAgentEvidence = selectedAgent ? agentEvidence.filter((item) => item.agent_id === selectedAgent.id) : [];
  const selectedAgentAlerts = selectedAgent ? agentAlerts.filter((item) => item.agent_id === selectedAgent.id) : [];
  const selectedAgentLastScan = selectedAgentEvidence[0]?.observed_at || selectedAgentEvidence[0]?.created_at || null;
  const onlineAgents = agents.filter(isAgentOnline).length;
  const revokedAgents = agents.filter((agent) => agent.status === 'revoked' || agent.revoked_at).length;
  const unhealthyAgents = agents.filter((agent) => ['degraded', 'unhealthy'].includes(String(agent.status))).length;

  const commandAgentId = selectedAgent?.id || oneTimeAgentToken?.agentId || 'agent_id_here';
  const dockerCommand = `docker run -d \\
  --name qguard-collector \\
  -e QGUARD_TENANT_ID="${tenantId}" \\
  -e QGUARD_AGENT_ID="${commandAgentId}" \\
  -e QGUARD_AGENT_TOKEN="agent_token_here" \\
  -e QGUARD_API_URL="${apiUrlPlaceholder}" \\
  qguard/collector-agent:latest`;
  const composeCommand = `services:
  qguard-collector:
    image: qguard/collector-agent:latest
    restart: unless-stopped
    environment:
      QGUARD_TENANT_ID: "${tenantId}"
      QGUARD_AGENT_ID: "${commandAgentId}"
      QGUARD_AGENT_TOKEN: "agent_token_here"
      QGUARD_API_URL: "${apiUrlPlaceholder}"`;
  const systemdCommand = `[Unit]
Description=QGuard Local Scanner Agent
After=network-online.target

[Service]
WorkingDirectory=/opt/qguard
Environment=QGUARD_TENANT_ID=${tenantId}
Environment=QGUARD_AGENT_ID=${commandAgentId}
Environment=QGUARD_AGENT_TOKEN=agent_token_here
Environment=QGUARD_API_URL=${apiUrlPlaceholder}
ExecStart=/usr/bin/npm run agent:watch
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`;
  const powershellCommand = `$env:QGUARD_TENANT_ID="${tenantId}"
$env:QGUARD_AGENT_ID="${commandAgentId}"
$env:QGUARD_AGENT_TOKEN="agent_token_here"
$env:QGUARD_API_URL="${apiUrlPlaceholder}"
npm run agent:watch`;
  const helmCommand = `helm install qguard-collector ./charts/qguard-collector \\
  --set tenantId="${tenantId}" \\
  --set agentId="${commandAgentId}" \\
  --set agentToken="agent_token_here" \\
  --set apiUrl="${apiUrlPlaceholder}"`;

  const workflowSteps = [
    {
      title: 'Register Collector Agent',
      description: 'Create a tenant-bound collector record for this customer account.',
      action: 'Complete the registration form and create an agent.',
      status: agents.length > 0 ? 'Completed' : 'Pending setup',
      message: agents.length > 0 ? `${agents.length} collector agent(s) registered for this tenant.` : 'No collector agent has been registered yet.',
      snippet: 'POST /api/v1/agent-scanner/agents/enroll',
    },
    {
      title: 'Generate Secure Agent Token',
      description: 'Generate a one-time token. The backend stores only a token hash.',
      action: 'Create or rotate a token, then store it securely.',
      status: oneTimeAgentToken ? 'Completed' : agents.length > 0 ? 'Pending setup' : 'Queued',
      message: oneTimeAgentToken ? `One-time token ${oneTimeAgentToken.mode}. Copy it now.` : 'Token is displayed only at creation or rotation time.',
      snippet: 'QGUARD_AGENT_TOKEN="agent_token_here"',
    },
    {
      title: 'Install Agent Package',
      description: 'Deploy the collector by Docker, systemd, PowerShell, or Kubernetes.',
      action: 'Use one of the copyable deployment commands below.',
      status: selectedAgent ? 'Running' : 'Queued',
      message: selectedAgent ? 'Install command is ready with tenant and agent placeholders.' : 'Create an agent first.',
      snippet: 'npm run agent:watch',
    },
    {
      title: 'Configure Tenant ID and API Endpoint',
      description: 'Bind the collector to this tenant and the QGuard API endpoint.',
      action: 'Set QGUARD_TENANT_ID, QGUARD_AGENT_ID, QGUARD_AGENT_TOKEN, and QGUARD_API_URL.',
      status: selectedAgent ? 'Running' : 'Queued',
      message: `Tenant ID: ${tenantId}`,
      snippet: `QGUARD_API_URL="${apiUrlPlaceholder}"`,
    },
    {
      title: 'Start Agent Service',
      description: 'Run the collector continuously so heartbeats and evidence keep flowing.',
      action: 'Start the collector process or background service.',
      status: selectedAgent?.last_seen_at ? 'Completed' : selectedAgent ? 'Pending setup' : 'Queued',
      message: selectedAgent?.last_seen_at ? `Last seen ${formatDateTime(selectedAgent.last_seen_at)}.` : 'No heartbeat received yet.',
      snippet: 'npm run agent:watch',
    },
    {
      title: 'Verify Connection',
      description: 'Confirm the collector heartbeat is tenant-scoped and healthy.',
      action: 'Check Connection Status and Registered Agents.',
      status: onlineAgents > 0 ? 'Completed' : agents.length > 0 ? 'Pending setup' : 'Queued',
      message: onlineAgents > 0 ? `${onlineAgents} collector(s) online.` : 'Waiting for first heartbeat.',
      snippet: 'GET /api/v1/agent-scanner/agents',
    },
    {
      title: 'Run Authorized Scan',
      description: 'The agent scans only assigned targets and paths from policy.',
      action: 'Assign scan scope and keep the collector running.',
      status: agentEvidence.length > 0 ? 'Completed' : agents.length > 0 ? 'Running' : 'Queued',
      message: agentEvidence.length > 0 ? `${agentEvidence.length} evidence record(s) uploaded.` : 'No collector evidence received yet.',
      snippet: 'POST /api/v1/agent-scanner/agent/evidence',
    },
    {
      title: 'Review Results',
      description: 'Evidence is normalized into CBOM, assets, exposure, history, and alerts.',
      action: 'Open CBOM, Assets, Crypto Exposure, and History.',
      status: agentEvidence.length > 0 || agentAlerts.length > 0 ? 'Completed' : 'Queued',
      message: agentAlerts.length > 0 ? `${agentAlerts.length} alert(s) available.` : 'Results appear after evidence is processed.',
      snippet: '/dashboard/cbom /dashboard/assets /dashboard/crypto-exposure',
    },
  ];

  const filteredFindings = findings.filter((finding) => {
    const severity = finding.threatLevel.toLowerCase();
    if (sevFilter && severity !== sevFilter) return false;
    if (!searchQ.trim()) return true;
    const q = searchQ.toLowerCase();
    return [finding.algorithm, finding.category, finding.location, finding.status, finding.evidence]
      .some((value) => String(value || '').toLowerCase().includes(q));
  });

  const kpis = [
    { label: 'Assets', value: `${liveCounts.assets}`, icon: Server, color: 'text-white' },
    { label: 'Components', value: `${liveCounts.components}`, icon: Target, color: 'text-white' },
    { label: 'Critical', value: `${liveCounts.critical}`, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'High', value: `${liveCounts.high}`, icon: AlertTriangle, color: 'text-orange-400' },
    { label: 'Medium', value: `${liveCounts.medium}`, icon: FileWarning, color: 'text-yellow-400' },
    { label: 'Low', value: `${liveCounts.low}`, icon: Shield, color: 'text-green-400' },
    { label: 'Vulnerable', value: `${liveCounts.vulnerable}`, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'PQC Ready', value: `${liveCounts.pqcReady}`, icon: CheckCircle2, color: 'text-green-400' },
    { label: 'Risk', value: summary ? `${summary.riskScore}/100` : 'N/A', icon: Shield, color: summary && summary.riskScore >= 60 ? 'text-red-400' : 'text-green-400' },
    { label: 'Q-Score', value: summary ? `${summary.qScore}/100` : 'N/A', icon: Activity, color: 'text-gold' },
    { label: 'Status', value: riskLabel, icon: Radio, color: 'text-cyan-400' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 min-h-screen">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">
            PQC Discovery <span className="text-gold">Scanner</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">
            Authorized defensive cryptographic inventory, CBOM generation, and PQC readiness assessment.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          {isRunning ? (
            <button onClick={handleCancel} className="px-5 py-2.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-400 text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:bg-yellow-500/20 transition-colors">
              <Pause className="h-3.5 w-3.5" /> Cancel Scan
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={targets.length === 0 || !authorizationAccepted || !session?.access_token}
              className="px-5 py-2.5 rounded-lg border border-gold/40 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:bg-gold/20 transition-colors shadow-[0_0_20px_rgba(212,175,55,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3.5 w-3.5" /> Start Authorized Scan
            </button>
          )}
          {isRunning && (
            <div className="px-4 py-2 border border-gold/30 bg-gold/5 rounded-lg text-[10px] font-black text-gold uppercase tracking-[0.15em] flex items-center gap-2">
              <Radio className="h-3 w-3 animate-pulse" /> Live SSE
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300 flex items-start gap-3">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status !== 'idle' && activeTab !== 'setup' && (
        <div className="rounded-xl border p-5 glass-panel">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {isRunning && <Loader2 className="h-4 w-4 text-gold animate-spin" />}
              {status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
              {status === 'failed' && <XCircle className="h-4 w-4 text-red-400" />}
              <span className="text-xs font-black uppercase tracking-[0.15em] text-white/60">{status}</span>
            </div>
            <span className="text-lg font-black text-gold">{progress}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${status === 'completed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-gradient-to-r from-gold via-yellow-300 to-gold'}`}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25 }}
            />
          </div>
        </div>
      )}

      {terminalVisible && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-4">
          <div className="rounded-xl border overflow-hidden shadow-[0_0_35px_rgba(212,175,55,0.08)] glass-panel">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-4 py-3 border-b border-gold/10 bg-gold/[0.04]">
              <div className="flex items-center gap-3 min-w-0">
                <Terminal className="h-4 w-4 text-gold" />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Live Terminal Telemetry</div>
                  <div className="text-[10px] text-white/30 font-mono truncate">{jobId || 'waiting-for-job-id'} - {progress}%</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setTerminalPaused((value) => !value)} className="px-2.5 py-1.5 rounded-md border border-gold/15 text-[9px] font-black uppercase tracking-wider text-white/55 hover:text-gold hover:border-gold/40 transition-colors">
                  {terminalPaused ? 'Resume View' : 'Pause View'}
                </button>
                <button onClick={() => setTerminalPinned((value) => !value)} className="px-2.5 py-1.5 rounded-md border border-gold/15 text-[9px] font-black uppercase tracking-wider text-white/55 hover:text-gold hover:border-gold/40 transition-colors">
                  {terminalPinned ? 'Auto-scroll' : 'Manual'}
                </button>
                <button onClick={handleCopyLogs} disabled={logs.length === 0} className="p-1.5 rounded-md border border-gold/15 text-white/45 hover:text-gold hover:border-gold/40 disabled:opacity-30 transition-colors" title="Copy logs">
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleDownloadReport} disabled={logs.length === 0 && findings.length === 0} className="p-1.5 rounded-md border border-gold/15 text-white/45 hover:text-gold hover:border-gold/40 disabled:opacity-30 transition-colors" title="Download scan report">
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button onClick={handleClearTerminal} disabled={isRunning || logs.length === 0} className="p-1.5 rounded-md border border-gold/15 text-white/45 hover:text-red-400 hover:border-red-500/30 disabled:opacity-30 transition-colors" title="Clear terminal after completion">
                  <Eraser className="h-3.5 w-3.5" />
                </button>
                {isRunning && (
                  <button onClick={handleCancel} className="px-2.5 py-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/10 text-[9px] font-black uppercase tracking-wider text-yellow-400 hover:bg-yellow-500/20 transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-px border-b border-gold/10 bg-gold/10">
              {[
                ['Assets', liveCounts.assets, 'text-white'],
                ['Components', liveCounts.components, 'text-white'],
                ['Critical', liveCounts.critical, 'text-red-400'],
                ['High', liveCounts.high, 'text-orange-400'],
                ['Medium', liveCounts.medium, 'text-yellow-400'],
                ['Low', liveCounts.low, 'text-green-400'],
                ['PQC Ready', liveCounts.pqcReady, 'text-green-400'],
                ['Vulnerable', liveCounts.vulnerable, 'text-red-400'],
              ].map(([label, value, color]) => (
                <div key={label as string} className="px-3 py-2 glass-panel">
                  <div className="text-[8px] uppercase tracking-wider text-white/25 font-black">{label}</div>
                  <div className={`text-lg font-black ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="h-[360px] overflow-y-auto p-4 font-mono text-[11px] space-y-1 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.06),transparent_30%)]">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/15 uppercase tracking-widest text-[10px] font-black">
                  Awaiting authorized scan initiation...
                </div>
              ) : logs.map((entry, index) => {
                const severity = entry.severity ? sevColor(entry.severity.toLowerCase()) : null;
                return (
                  <div key={`${entry.timestamp}-${index}`} className={`leading-relaxed break-words ${logColor(entry.level)}`}>
                    <span className="text-white/20 inline-block w-14">[{entry.elapsed || '00:00'}]</span>
                    <span className={`font-bold inline-block w-20 ${logColor(entry.level)}`}>[{entry.level}]</span>
                    {severity && <span className={`mr-2 px-1.5 py-0.5 rounded border text-[9px] ${severity.br} ${severity.b} ${severity.t}`}>{entry.severity}</span>}
                    {entry.phase && <span className="text-white/30 mr-2">[{entry.phase}]</span>}
                    {entry.moduleName && <span className="text-gold/50 mr-2">[{entry.moduleName}]</span>}
                    <span>{entry.message}</span>
                  </div>
                );
              })}
              {copiedLogs && <div className="text-green-400">[copy] Telemetry copied to clipboard</div>}
              {isRunning && <div className="text-gold/50 animate-pulse mt-2">|</div>}
              <div ref={logEndRef} />
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden glass-panel">
            <div className="px-4 py-3 border-b border-gold/10 bg-gold/[0.04] flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">Module Execution Timeline</div>
              <div className="text-[10px] text-white/30 font-mono">{modules.filter((module) => module.status === 'Completed').length}/{modules.length || 0}</div>
            </div>
            <div className="max-h-[456px] overflow-y-auto p-3 space-y-2">
              {modules.length === 0 ? (
                <div className="text-center text-white/20 text-[10px] uppercase tracking-widest font-bold py-16">
                  Module queue will appear when the backend stream starts
                </div>
              ) : modules.map((module) => (
                <div key={module.id} className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white/75 truncate">{module.name}</div>
                      <div className="text-[9px] text-white/25 font-mono truncate">{module.target || 'queued'}</div>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded border text-[8px] font-black uppercase tracking-wider ${moduleStatusColor(module.status)}`}>
                      {module.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-[9px]">
                    <div>
                      <div className="text-white/25 uppercase font-black">Duration</div>
                      <div className="text-white/55 font-mono">{formatMs(module.durationMs)}</div>
                    </div>
                    <div>
                      <div className="text-white/25 uppercase font-black">Findings</div>
                      <div className="text-white/55 font-mono">{module.findingsCount}</div>
                    </div>
                    <div>
                      <div className="text-white/25 uppercase font-black">Started</div>
                      <div className="text-white/55 font-mono">{module.startedAt ? new Date(module.startedAt).toLocaleTimeString() : 'N/A'}</div>
                    </div>
                  </div>
                  {module.error && (
                    <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-2">
                      <div className="text-[8px] font-black uppercase tracking-wider text-red-400/70 mb-1">Error Details</div>
                      <div className="text-[10px] text-red-300 leading-relaxed">{module.error}</div>
                      {!isRunning && (
                        <button onClick={() => handleRetryFailedModule(module)} className="mt-2 px-2.5 py-1.5 rounded border border-red-500/25 text-[8px] font-black uppercase tracking-wider text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-1.5">
                          <RotateCcw className="h-3 w-3" /> Retry Failed Module
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {failedModules.length > 0 && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4">
          <div className="flex items-center gap-2 text-red-300 text-xs font-black uppercase tracking-[0.15em] mb-2">
            <XCircle className="h-4 w-4" /> Module Errors
          </div>
          <div className="space-y-2">
            {failedModules.map((module) => (
              <div key={module.id} className="text-xs text-red-200/80 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <span><strong>{module.name}:</strong> {module.error || 'Module failed'}</span>
                {!isRunning && (
                  <button onClick={() => handleRetryFailedModule(module)} className="px-3 py-1.5 rounded border border-red-500/30 text-[9px] font-black uppercase tracking-wider text-red-300 hover:bg-red-500/10 transition-colors">
                    Retry Failed Module
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gold/10 pb-0 overflow-x-auto">
        {[
          { id: 'setup' as TabId, label: 'Scanner' },
          { id: 'history' as TabId, label: 'History' },
          { id: 'agents' as TabId, label: 'Agent Collector Scanners' },
          { id: 'settings' as TabId, label: 'Settings' },
          { id: 'overview' as TabId, label: 'Live Dashboard' },
          { id: 'findings' as TabId, label: `Findings (${findings.length})` },
          { id: 'logs' as TabId, label: 'Telemetry' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] border-b-2 transition-all -mb-px whitespace-nowrap ${
              activeTab === tab.id ? 'border-gold text-gold' : 'border-transparent text-white/35 hover:text-white/55'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'setup' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl border p-5 glass-panel">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-gold" /> Authorized Asset Input
              </h2>
              <p className="text-xs text-white/40 mb-4 leading-relaxed">
                Enter domains, URLs, public IPs, GitHub repository URLs, or SSH endpoints that you own or are explicitly authorized to assess.
              </p>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={'example.com\nhttps://api.company.com\nhttps://github.com/company/repo\nssh://bastion.company.com:22'}
                className="w-full h-40 border rounded-lg p-4 text-sm font-mono focus:outline-none focus:transition-colors text-white placeholder-white/20 resize-none mb-4 glass-panel"
              />
              <label className="flex items-start gap-3 rounded-lg border border-gold/10 bg-white/[0.02] p-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={authorizationAccepted}
                  onChange={(e) => setAuthorizationAccepted(e.target.checked)}
                  className="mt-1 accent-[#D4AF37]"
                />
                <span className="text-xs text-white/45 leading-relaxed">
                  I confirm these assets belong to this account or are explicitly authorized for defensive cryptographic inventory and compliance scanning. No exploitation, credential collection, or stealth scanning will be performed.
                </span>
              </label>
              <div className="flex justify-end">
                <button
                  onClick={handleParseInput}
                  disabled={!inputText.trim()}
                  className="px-4 py-2 rounded-lg border border-gold/30 bg-gold/10 text-gold text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:bg-gold/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Targets
                </button>
              </div>
            </div>

            {inputText && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-bold text-white/50 mb-2">Live Validation</div>
                <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[10px]">
                  {parseAssetInput(inputText).slice(0, 6).map((asset, index) => (
                    <div key={`${asset.raw}-${index}`} className={`flex items-center gap-2 ${asset.valid ? 'text-green-400' : 'text-red-400'}`}>
                      {asset.valid ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      <span className="truncate">{asset.raw}</span>
                      <span className="text-white/30 ml-2">{asset.valid ? asset.type : asset.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border p-5 flex flex-col glass-panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 flex items-center gap-2">
                <Network className="h-4 w-4 text-gold" /> Scan Queue ({targets.length})
              </h2>
              {targets.length > 0 && (
                <button onClick={() => setTargets([])} className="text-white/30 hover:text-red-400 transition-colors" title="Clear all targets">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 min-h-[250px]">
              {targets.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/20 text-xs uppercase tracking-widest font-bold border-2 border-dashed border-white/5 rounded-lg">
                  No authorized targets queued
                </div>
              ) : targets.map((target, index) => (
                <div key={`${target.host}-${target.port}-${index}`} className="flex items-center justify-between p-3 rounded-lg border border-gold/10 bg-white/[0.02] group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-6 w-6 rounded bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                      <Globe className="h-3 w-3 text-gold/60" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white/80 truncate">{target.host}</div>
                      <div className="text-[9px] font-mono text-white/30 uppercase">{target.type} {target.port ? `:${target.port}` : ''}</div>
                    </div>
                  </div>
                  <button onClick={() => setTargets(targets.filter((_, idx) => idx !== index))} className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 p-1 transition-all">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gold/10">
              <button
                onClick={handleStart}
                disabled={targets.length === 0 || isRunning || !authorizationAccepted || !session?.access_token}
                className="w-full py-3 rounded-lg bg-gold text-black text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="h-4 w-4" /> Start Defensive Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="space-y-6">
          {agentsError && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-300 flex items-start gap-3">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{agentsError}</span>
            </div>
          )}

          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
            <div className="rounded-xl border p-5 glass-panel">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white">
                    Agent Collector <span className="text-gold">Scanners</span>
                  </h2>
                  <p className="text-xs text-white/45 mt-1 leading-relaxed max-w-3xl">
                    Register tenant-bound collectors, deploy them inside authorized customer environments, and stream real cryptographic evidence back to QGuard for CBOM, assets, exposure, history, and alerts.
                  </p>
                </div>
                <button
                  onClick={fetchAgents}
                  className="px-3 py-2 rounded-lg border border-gold/20 text-[10px] font-black uppercase tracking-wider text-gold hover:bg-gold/10 transition-colors flex items-center gap-2 shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${agentsLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                  { label: 'Registered Agents', value: agents.length, icon: Server, color: 'text-white' },
                  { label: 'Online', value: onlineAgents, icon: Radio, color: 'text-green-400' },
                  { label: 'Unhealthy', value: unhealthyAgents, icon: AlertTriangle, color: 'text-orange-400' },
                  { label: 'Revoked', value: revokedAgents, icon: PowerOff, color: 'text-white/45' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-gold/10 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-white/35 mb-2">
                      <item.icon className="h-3.5 w-3.5 text-gold/45" /> {item.label}
                    </div>
                    <div className={`text-2xl font-black ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-5 glass-panel">
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-gold" /> Tenant Isolation
              </h3>
              <div className="space-y-3 text-xs text-white/45 leading-relaxed">
                <p>Agents, tokens, evidence, telemetry, alerts, scan history, CBOM, assets, and exposure records are scoped to the authenticated tenant.</p>
                <div className="rounded-lg border border-gold/10 bg-gold/[0.03] p-3">
                  <div className="text-[9px] font-black uppercase tracking-wider text-gold/70 mb-1">Tenant ID</div>
                  <div className="font-mono text-white/70 break-all">{tenantId}</div>
                </div>
                <p>Agent tokens are generated once, hashed at rest, and never displayed again after creation or rotation.</p>
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
            <div className="space-y-4">
              <div className="rounded-xl border p-5 glass-panel">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-gold" /> Create New Collector Agent
                </h3>
                <div className="space-y-3">
                  <input
                    value={agentForm.name}
                    onChange={(e) => setAgentForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Agent name"
                    className="w-full border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus: glass-panel"
                  />
                  <select
                    value={agentForm.environment}
                    onChange={(e) => setAgentForm((prev) => ({ ...prev, environment: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus: glass-panel"
                  >
                    {['production', 'staging', 'development', 'dr', 'lab'].map((env) => <option key={env} value={env}>{env}</option>)}
                  </select>
                  <textarea
                    value={agentForm.allowedTargets}
                    onChange={(e) => setAgentForm((prev) => ({ ...prev, allowedTargets: e.target.value }))}
                    className="w-full h-24 border rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:resize-none glass-panel"
                    placeholder={'https://api.customer.com\nssh://server.customer.com:22'}
                  />
                  <textarea
                    value={agentForm.allowedPaths}
                    onChange={(e) => setAgentForm((prev) => ({ ...prev, allowedPaths: e.target.value }))}
                    className="w-full h-20 border rounded-lg p-3 text-xs font-mono text-white focus:outline-none focus:resize-none glass-panel"
                    placeholder={'C:\\Apps\\CustomerApi\n/opt/customer-api'}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={agentForm.intervalSeconds}
                      onChange={(e) => setAgentForm((prev) => ({ ...prev, intervalSeconds: e.target.value }))}
                      placeholder="Interval seconds"
                      className="border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus: glass-panel"
                    />
                    <select
                      value={agentForm.alertThreshold}
                      onChange={(e) => setAgentForm((prev) => ({ ...prev, alertThreshold: e.target.value }))}
                      className="border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus: glass-panel"
                    >
                      {['low', 'moderate', 'medium', 'high', 'critical'].map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['tls', 'ssh', 'packages', 'configs'].map((scanType) => (
                      <label key={scanType} className="flex items-center gap-2 rounded-lg border border-gold/10 bg-white/[0.02] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={agentForm.scanTypes.includes(scanType)}
                          onChange={(e) => setAgentForm((prev) => ({
                            ...prev,
                            scanTypes: e.target.checked ? [...prev.scanTypes, scanType] : prev.scanTypes.filter((item) => item !== scanType),
                          }))}
                          className="accent-[#D4AF37]"
                        />
                        {scanType}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handleCreateAgent}
                    disabled={agentsLoading || !agentForm.name.trim() || agentForm.scanTypes.length === 0}
                    className="w-full py-3 rounded-lg bg-gold text-black text-xs font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:bg-yellow-400 transition-colors disabled:opacity-50"
                  >
                    {agentsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Create Agent and Generate Token
                  </button>
                </div>
              </div>

              {oneTimeAgentToken && (
                <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-5">
                  <div className="flex items-start gap-3">
                    <KeyRound className="h-5 w-5 text-yellow-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs font-black uppercase tracking-[0.18em] text-yellow-300 mb-2">One-Time Agent Token</h3>
                      <p className="text-xs text-yellow-100/70 mb-3">Copy this token now. It is not recoverable after this page state is cleared.</p>
                      <div className="rounded-lg border border-yellow-500/20 p-3 font-mono text-[11px] text-yellow-100 break-all glass-panel">{oneTimeAgentToken.token}</div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => copyPlainText(oneTimeAgentToken.token, 'one-time-token')} className="px-3 py-2 rounded-lg border border-yellow-500/30 text-[10px] font-black uppercase tracking-wider text-yellow-300 hover:bg-yellow-500/10 flex items-center gap-2">
                          <Copy className="h-3.5 w-3.5" /> {copiedCommand === 'one-time-token' ? 'Copied' : 'Copy Token'}
                        </button>
                        <button onClick={() => setOneTimeAgentToken(null)} className="px-3 py-2 rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-wider text-white/45 hover:text-white">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border p-5 glass-panel">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-4 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-gold" /> Agent Setup Workflow
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {workflowSteps.map((step, index) => (
                    <div key={step.title} className="rounded-lg border border-gold/10 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-gold/60">Step {index + 1}</div>
                          <div className="text-sm font-bold text-white/80">{step.title}</div>
                        </div>
                        <span className={`px-2 py-1 rounded border text-[8px] font-black uppercase tracking-wider ${agentStatusClass(step.status)}`}>{step.status}</span>
                      </div>
                      <p className="text-xs text-white/45 leading-relaxed mb-2">{step.description}</p>
                      <div className="text-[10px] text-white/35 mb-3"><span className="font-black text-white/50">Action:</span> {step.action}</div>
                      <div className="rounded-md border p-2 font-mono text-[10px] text-gold/70 break-all glass-panel">{step.snippet}</div>
                      <div className="mt-2 text-[10px] text-white/35">{step.message}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border p-5 glass-panel">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-4 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-gold" /> Installation Commands
                </h3>
                <div className="grid xl:grid-cols-2 gap-3">
                  {[
                    { key: 'docker', label: 'Docker', icon: Package, command: dockerCommand },
                    { key: 'compose', label: 'Docker Compose', icon: HardDrive, command: composeCommand },
                    { key: 'systemd', label: 'Linux systemd', icon: Server, command: systemdCommand },
                    { key: 'powershell', label: 'Windows PowerShell', icon: Terminal, command: powershellCommand },
                    { key: 'helm', label: 'Kubernetes / Helm', icon: Cloud, command: helmCommand },
                  ].map((block) => (
                    <div key={block.key} className="rounded-lg border border-gold/10 bg-white/[0.02] overflow-hidden">
                      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gold/10 bg-gold/[0.03]">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-white/55">
                          <block.icon className="h-3.5 w-3.5 text-gold/60" /> {block.label}
                        </div>
                        <button onClick={() => copyPlainText(block.command, block.key)} className="p-1.5 rounded border border-gold/15 text-white/45 hover:text-gold hover:border-gold/40 transition-colors" title={`Copy ${block.label} command`}>
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <pre className="p-3 text-[10px] text-white/60 font-mono overflow-x-auto whitespace-pre-wrap">{block.command}</pre>
                      {copiedCommand === block.key && <div className="px-3 pb-3 text-[10px] text-green-400">Copied {block.label} command</div>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[10px] text-white/35">
                  Commands intentionally use placeholders for agent tokens. Paste the one-time token only in the customer-controlled deployment environment.
                </div>
              </div>
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
            <div className="rounded-xl border overflow-hidden glass-panel">
              <div className="px-5 py-4 border-b border-gold/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 flex items-center gap-2">
                  <Server className="h-4 w-4 text-gold" /> Registered Agents
                </h3>
                <div className="text-[10px] text-white/30 font-mono">{agents.length} tenant-scoped record(s)</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[980px]">
                  <thead className="bg-gold/[0.03] border-b border-gold/10">
                    <tr className="text-[9px] uppercase tracking-[0.15em] text-white/35">
                      {['Agent', 'Tenant', 'Environment', 'Status', 'Version', 'Last seen', 'Health', 'Scope', 'Recent scans', 'Actions'].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-black">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agents.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-14 text-center text-white/20 text-xs uppercase tracking-widest font-bold">
                          No collector agents registered for this tenant
                        </td>
                      </tr>
                    ) : agents.map((agent) => {
                      const policy = normalizeAgentPolicy(agent.policy);
                      const displayStatus = agentDisplayStatus(agent);
                      const recentScanCount = agentEvidence.filter((item) => item.agent_id === agent.id).length;
                      return (
                        <tr key={agent.id} className={`border-b border-gold/5 hover:bg-gold/[0.03] transition-colors ${selectedAgent?.id === agent.id ? 'bg-gold/[0.04]' : ''}`}>
                          <td className="px-4 py-3">
                            <button onClick={() => setSelectedAgentId(agent.id)} className="text-left">
                              <div className="text-sm font-bold text-white/80">{agent.name}</div>
                              <div className="text-[10px] font-mono text-white/30">{agent.id}</div>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-[10px] font-mono text-white/35">{agent.user_id.slice(0, 8)}...</td>
                          <td className="px-4 py-3 text-xs text-white/50">{agent.metadata?.environment || 'production'}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded border text-[8px] font-black uppercase tracking-wider ${agentStatusClass(displayStatus)}`}>{displayStatus}</span></td>
                          <td className="px-4 py-3 text-xs font-mono text-white/50">{agent.version || 'unknown'}</td>
                          <td className="px-4 py-3 text-xs text-white/45">{formatDateTime(agent.last_seen_at)}</td>
                          <td className="px-4 py-3 text-xs text-white/45">{isAgentOnline(agent) ? 'Healthy' : agent.revoked_at ? 'Revoked' : 'Needs heartbeat'}</td>
                          <td className="px-4 py-3 text-xs text-white/45">{policy.allowedTargets.length + policy.allowedPaths.length} item(s)</td>
                          <td className="px-4 py-3 text-xs text-white/45">{recentScanCount}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setSelectedAgentId(agent.id)} className="p-1.5 rounded border border-gold/15 text-white/45 hover:text-gold" title="View details"><Eye className="h-3.5 w-3.5" /></button>
                              <button onClick={() => copyPlainText(dockerCommand.replace(commandAgentId, agent.id), `install-${agent.id}`)} className="p-1.5 rounded border border-gold/15 text-white/45 hover:text-gold" title="Copy install command"><Copy className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleAssignCurrentScope(agent.id)} className="p-1.5 rounded border border-gold/15 text-white/45 hover:text-gold" title="Assign scan scope"><Settings className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleRotateAgentToken(agent.id)} className="p-1.5 rounded border border-yellow-500/20 text-yellow-400/70 hover:text-yellow-300" title="Rotate token"><KeyRound className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleRevokeAgent(agent.id)} className="p-1.5 rounded border border-orange-500/20 text-orange-400/70 hover:text-orange-300" title="Revoke"><PowerOff className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDeleteAgent(agent.id)} className="p-1.5 rounded border border-red-500/20 text-red-400/70 hover:text-red-300" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border p-5 glass-panel">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gold" /> Connection Status
                </h3>
                {selectedAgent ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white/80">{selectedAgent.name}</div>
                        <div className="text-[10px] font-mono text-white/30">{selectedAgent.id}</div>
                      </div>
                      <span className={`px-2 py-1 rounded border text-[8px] font-black uppercase tracking-wider ${agentStatusClass(agentDisplayStatus(selectedAgent))}`}>{agentDisplayStatus(selectedAgent)}</span>
                    </div>
                    {[
                      ['Hostname / IP', `${selectedAgent.hostname || 'pending'}${selectedAgent.metadata?.lastIpAddress ? ` / ${selectedAgent.metadata.lastIpAddress}` : ''}`],
                      ['Environment', selectedAgent.metadata?.environment || 'production'],
                      ['Version', selectedAgent.version || 'unknown'],
                      ['Last seen', formatDateTime(selectedAgent.last_seen_at)],
                      ['Last scan', formatDateTime(selectedAgentLastScan)],
                      ['Assigned scope', `${selectedAgentPolicy.allowedTargets.length} target(s), ${selectedAgentPolicy.allowedPaths.length} path(s)`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">
                        <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-1">{label}</div>
                        <div className="text-xs text-white/60 break-all">{value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-white/20 text-xs uppercase tracking-widest font-bold">Select or create an agent</div>
                )}
              </div>

              <div className="rounded-xl border p-5 glass-panel">
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-4 flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-gold" /> Recent Telemetry
                </h3>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {[...selectedAgentAlerts.slice(0, 5).map((alert) => ({
                    id: alert.id,
                    label: alert.title || alert.category || 'Scanner alert',
                    detail: alert.message || alert.severity || 'Alert recorded',
                    time: alert.created_at,
                    color: sevColor(alert.severity || 'low').t,
                  })), ...selectedAgentEvidence.slice(0, 6).map((evidence) => ({
                    id: evidence.id,
                    label: evidence.evidence_type || 'scanner_evidence',
                    detail: `${evidence.observed_algorithm || 'metadata'} ${evidence.host || evidence.file_path || evidence.asset_name || ''}`,
                    time: evidence.observed_at || evidence.created_at,
                    color: 'text-cyan-400',
                  }))].slice(0, 8).map((event) => (
                    <div key={event.id} className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">
                      <div className={`text-[10px] font-black uppercase tracking-wider ${event.color}`}>{event.label}</div>
                      <div className="text-xs text-white/50 mt-1 break-all">{event.detail}</div>
                      <div className="text-[9px] text-white/25 mt-2">{formatDateTime(event.time)}</div>
                    </div>
                  ))}
                  {selectedAgent && selectedAgentAlerts.length === 0 && selectedAgentEvidence.length === 0 && (
                    <div className="text-center py-8 text-white/20 text-xs uppercase tracking-widest font-bold">
                      No real telemetry received yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="rounded-xl border p-5 glass-panel">
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4 text-gold" /> Security Notes
              </h3>
              <div className="grid md:grid-cols-2 gap-3 text-xs text-white/45 leading-relaxed">
                {[
                  'Collectors are outbound-only and do not expose inbound ports.',
                  'Tokens are hashed at rest and are shown only once during creation or rotation.',
                  'Server-side policy enforcement rejects evidence outside allowed targets and paths.',
                  'The collector skips secrets, private keys, credential stores, .env files, and unapproved directories.',
                  'Every agent, scan, evidence record, alert, CBOM record, asset, and exposure is scoped by tenant user ID.',
                  'Connector integrations should use read-only scopes and upload observed evidence, not inferred findings.',
                ].map((note) => (
                  <div key={note} className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">{note}</div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-5 glass-panel">
              <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-4 flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-gold" /> Troubleshooting
              </h3>
              <div className="space-y-2">
                {[
                  ['Agent not connecting', 'Verify QGUARD_API_URL, outbound HTTPS access, and that agent:watch is running.'],
                  ['Invalid token', 'Rotate the token and update the customer deployment environment. Tokens are not recoverable.'],
                  ['Tenant ID mismatch', 'Use the tenant ID shown in this tab and confirm the agent belongs to this account.'],
                  ['API URL unreachable', 'Check DNS, TLS inspection, proxy configuration, and firewall egress policy.'],
                  ['Firewall blocking outbound connection', 'Allow outbound HTTPS to the QGuard API host. No inbound access is required.'],
                  ['Collector version outdated', 'Update the deployed collector image/package and restart the service.'],
                  ['SSE/WebSocket disconnected', 'Refresh dashboard telemetry; agent evidence remains persisted by backend API upload.'],
                  ['Scan job stuck', 'Check agent heartbeat, policy scope, and backend scanner_alerts for module failures.'],
                  ['No telemetry received', 'Confirm allowedTargets or allowedPaths are configured and reachable from the customer machine.'],
                ].map(([issue, fix]) => (
                  <div key={issue} className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">
                    <div className="text-xs font-bold text-white/75">{issue}</div>
                    <div className="text-xs text-white/40 mt-1">{fix}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="rounded-xl border p-5 glass-panel">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4 text-gold" /> Scanner Settings
            </h2>
            <div className="grid md:grid-cols-3 gap-3 text-xs text-white/45">
              <div className="rounded-lg border border-gold/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-black uppercase tracking-wider text-gold/60 mb-2">Authorization</div>
                Only explicitly authorized targets and policy-scoped collector evidence are accepted.
              </div>
              <div className="rounded-lg border border-gold/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-black uppercase tracking-wider text-gold/60 mb-2">Persistence</div>
                Results are written per tenant to scan history, CBOM, assets, crypto exposures, alerts, and audit logs.
              </div>
              <div className="rounded-lg border border-gold/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-black uppercase tracking-wider text-gold/60 mb-2">Telemetry</div>
                Dashboard scans use SSE; collector scans upload authenticated heartbeats, telemetry, and evidence.
              </div>
            </div>
          </div>

          <div className="rounded-xl border p-5 glass-panel">
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white/60 mb-4 flex items-center gap-2">
              <Code2 className="h-4 w-4 text-gold" /> Tenant API References
            </h3>
            <div className="grid md:grid-cols-2 gap-3 font-mono text-[11px] text-white/50">
              {[
                'POST /api/v1/agent-scanner/agents/enroll',
                'GET /api/v1/agent-scanner/agents',
                'PUT /api/v1/agent-scanner/agents/{agentId}/policy',
                'POST /api/v1/agent-scanner/agents/{agentId}/token/rotate',
                'POST /api/v1/agent-scanner/agent/heartbeat',
                'POST /api/v1/agent-scanner/agent/evidence',
                'GET /api/v1/agent-scanner/evidence',
                'GET /api/v1/agent-scanner/alerts',
              ].map((route) => (
                <div key={route} className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">{route}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpis.map((kpi, index) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="p-4 rounded-xl border glass-panel">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <kpi.icon className="h-3 w-3 text-gold/40" />
                  <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35">{kpi.label}</span>
                </div>
                <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
              </motion.div>
            ))}
          </div>
          <div className="rounded-xl border p-5 glass-panel">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-3">Defensive Scanner Scope</h2>
            <div className="grid md:grid-cols-3 gap-3 text-xs text-white/45">
              <div className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">Public TLS certificate, protocol, cipher, API header, web crypto, GitHub code-pattern, and SSH public metadata checks.</div>
              <div className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">No exploitation, credential collection, stealth behavior, persistence, or unauthorized reconnaissance.</div>
              <div className="rounded-lg border border-gold/10 bg-white/[0.02] p-3">Results persist per authenticated user and populate CBOM, assets, exposure map, history, and audit records.</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input
                type="text"
                placeholder="Search algorithms, evidence, locations..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:transition-colors text-white placeholder-white/20 glass-panel"
              />
            </div>
            {['critical', 'high', 'medium', 'low', 'safe'].map((severity) => (
              <button key={severity} onClick={() => setSevFilter(sevFilter === severity ? null : severity)} className={`text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg border transition-all ${sevFilter === severity ? `${sevColor(severity).br} ${sevColor(severity).b} ${sevColor(severity).t}` : 'text-white/35 hover:'} glass-panel`}>
                {severity} ({findings.filter((finding) => finding.threatLevel.toLowerCase() === severity).length})
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {filteredFindings.length === 0 ? (
              <div className="text-center py-16 text-white/20 text-xs uppercase tracking-widest font-bold">
                {findings.length === 0 ? 'Run an authorized scan to discover cryptographic findings' : 'No findings match filters'}
              </div>
            ) : filteredFindings.map((finding, index) => {
              const severity = finding.threatLevel.toLowerCase();
              const sc = sevColor(severity);
              const isExpanded = expandedFinding === finding.id;
              const Icon = targetIcon(finding.category);
              return (
                <motion.div key={finding.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(index * 0.02, 0.5) }} className={`rounded-xl border overflow-hidden ${sc.br} ${sc.b}`}>
                  <button onClick={() => setExpandedFinding(isExpanded ? null : finding.id)} className="w-full text-left p-4 flex items-center gap-3 group">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${sc.d}`} />
                    <Icon className="h-4 w-4 text-gold/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs font-bold text-white/80">{finding.algorithm}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${sc.br} ${sc.b} ${sc.t}`}>{finding.threatLevel}</span>
                        <span className="text-[9px] font-bold text-gold/50">{finding.status}</span>
                      </div>
                      <div className="text-[10px] text-white/35 font-mono truncate">{finding.location}</div>
                    </div>
                    <div className="text-right shrink-0 hidden lg:block">
                      <div className="text-[10px] font-bold text-gold/60">{finding.pqcReplacement || 'Review'}</div>
                      <div className="text-[9px] text-white/20">{finding.detectionMethod}</div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-white/15 shrink-0 transition-transform ${isExpanded ? 'rotate-90 text-gold' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t px-4 py-4 glass-panel">
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                          <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.015]">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-0.5">Category</div>
                            <div className="text-xs font-mono text-white/70">{finding.category}</div>
                          </div>
                          <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.015]">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-0.5">Key Size</div>
                            <div className="text-xs font-mono text-white/70">{finding.keySize ? `${finding.keySize} bit` : 'Unknown'}</div>
                          </div>
                          <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.015]">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-0.5">Source</div>
                            <div className="text-xs font-mono text-cyan-400">{finding.source}</div>
                          </div>
                          <div className="p-2.5 rounded-lg border border-gold/10 bg-white/[0.015]">
                            <div className="text-[8px] font-black uppercase tracking-wider text-white/25 mb-0.5">Replacement</div>
                            <div className="text-xs font-mono text-green-400">{finding.pqcReplacement || 'Manual review'}</div>
                          </div>
                        </div>
                        <p className="text-xs text-white/45 leading-relaxed mb-2">{finding.description}</p>
                        <div className="p-2.5 rounded-lg border border-gold/15 bg-gold/[0.03] mb-2">
                          <div className="text-[8px] font-black uppercase tracking-wider text-gold/70 mb-0.5">Evidence</div>
                          <div className="text-xs text-white/60">{finding.evidence}</div>
                        </div>
                        <div className="p-2.5 rounded-lg border border-green-500/15 bg-green-500/[0.03]">
                          <div className="text-[8px] font-black uppercase tracking-wider text-green-400/60 mb-0.5">Remediation</div>
                          <div className="text-xs text-green-400/80">{finding.recommendation}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="rounded-xl border overflow-hidden flex flex-col h-[600px] glass-panel">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gold/10 bg-gold/[0.03] shrink-0">
            <Terminal className="h-3.5 w-3.5 text-gold/50" />
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">Scanner Telemetry</span>
            <span className="ml-auto text-[10px] text-white/20 font-mono">{logs.length} lines</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 font-mono text-[11px] space-y-1">
            {logs.length === 0 ? (
              <div className="text-white/15 text-center py-12 uppercase tracking-widest text-[10px] font-bold">Awaiting authorized scan initiation...</div>
            ) : logs.map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className={`leading-relaxed break-words ${logColor(entry.level)}`}>
                <span className="text-white/15 inline-block w-20">{entry.timestamp.split('T')[1]?.slice(0, 12) || entry.timestamp}</span>
                <span className={`font-bold inline-block w-20 ${logColor(entry.level)}`}>[{entry.level}]</span>
                {entry.phase && <span className="text-white/30 mr-2">[{entry.phase}]</span>}
                {entry.message}
              </div>
            ))}
            {isRunning && <div className="text-gold/50 animate-pulse mt-2">|</div>}
            <div ref={logEndRef} />
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Audit-Ready Scan History</h2>
            <button onClick={fetchHistory} className="text-[10px] font-black uppercase tracking-wider text-gold flex items-center gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="text-center py-16 text-white/20 text-xs uppercase tracking-widest font-bold border border-dashed border-white/10 rounded-xl">
                No authorized scan history available
              </div>
            ) : history.map((entry) => (
              <div key={entry.scanId} className="p-4 rounded-xl border hover:transition-colors glass-panel">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <History className="h-5 w-5 text-gold/60" />
                    <div>
                      <div className="text-sm font-bold text-white/80">{entry.scanId}</div>
                      <div className="text-[10px] text-white/30 font-mono">{new Date(entry.startedAt).toLocaleString()} - {formatMs(entry.durationMs)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="px-3 py-1.5 rounded border border-white/5 text-center glass-panel">
                      <div className="text-sm font-black text-white">{entry.detectedComponents}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Components</div>
                    </div>
                    <div className="px-3 py-1.5 rounded border border-red-500/10 text-center glass-panel">
                      <div className="text-sm font-black text-red-400">{entry.vulnerableFindings}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Vulnerable</div>
                    </div>
                    <div className="px-3 py-1.5 rounded border border-green-500/10 text-center glass-panel">
                      <div className="text-sm font-black text-green-400">{entry.pqcReadyFindings}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">PQC Ready</div>
                    </div>
                    <div className="px-3 py-1.5 rounded border text-center glass-panel">
                      <div className="text-sm font-black text-gold">{entry.qScore ?? 'N/A'}</div>
                      <div className="text-[8px] uppercase tracking-wider text-white/30 font-bold">Q-Score</div>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-white/40 border-t border-gold/5 pt-3 grid md:grid-cols-2 gap-2">
                  <span><span className="font-bold text-white/60 mr-2">Target:</span>{entry.target}</span>
                  <span><span className="font-bold text-white/60 mr-2">Status:</span>{entry.status}</span>
                  <span><span className="font-bold text-white/60 mr-2">CBOM Records:</span>{entry.linkedCbomRecords.length}</span>
                  <span><span className="font-bold text-white/60 mr-2">Exposure Nodes:</span>{entry.linkedExposureNodes.length}</span>
                  <span><span className="font-bold text-white/60 mr-2">Modules:</span>{entry.scannerModulesUsed?.length || entry.moduleStates?.filter((module) => module.status !== 'Skipped').length || 0}</span>
                  <span><span className="font-bold text-white/60 mr-2">Errors:</span>{entry.errorLogs?.length || 0}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
