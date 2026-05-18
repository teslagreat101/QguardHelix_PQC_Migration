import { useState, useEffect } from 'react';

export interface TelemetryData {
  status: 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'CONNECTING';
  encryption: string;
  node: string;
  latency: number;
  throughput: number;
  quantumRiskScore: number;
  logs: Array<{ timestamp: string; message: string; level: 'info' | 'warn' | 'error' }>;
  metrics: Array<{ time: string; value: number }>;
}

export function useRealtimeStream(moduleName: string) {
  const [data, setData] = useState<TelemetryData>({
    status: 'CONNECTING',
    encryption: 'AES-GCM-256',
    node: 'QG-CORE-01',
    latency: 0,
    throughput: 0,
    quantumRiskScore: 0,
    logs: [],
    metrics: Array(30).fill({ time: '', value: 0 }),
  });

  useEffect(() => {
    // Simulate initial SSE connection delay
    const connectTimer = setTimeout(() => {
      setData(prev => ({ ...prev, status: 'ACTIVE' }));
    }, 1500);

    const interval = setInterval(() => {
      setData(prev => {
        if (prev.status === 'CONNECTING') return prev;

        const now = new Date();
        
        // Sometimes generate a log
        let newLogs = prev.logs;
        if (Math.random() > 0.4) {
          const newLog = {
            timestamp: now.toISOString(),
            message: generateRandomLog(moduleName),
            level: Math.random() > 0.85 ? 'warn' : 'info' as const,
          };
          newLogs = [newLog, ...prev.logs].slice(0, 50);
        }

        const newValue = Math.floor(Math.random() * 80) + 20; // 20 to 100
        
        return {
          ...prev,
          latency: Math.floor(Math.random() * 30) + 12,
          throughput: Math.floor(Math.random() * 4000) + 2500,
          quantumRiskScore: Math.floor(Math.random() * 15) + 5, // Keep risk relatively low to signify safety
          logs: newLogs,
          metrics: [...prev.metrics.slice(1), { time: now.toLocaleTimeString(), value: newValue }],
        };
      });
    }, 1200); // 1.2s updates for fast real-time feel

    return () => {
      clearTimeout(connectTimer);
      clearInterval(interval);
    };
  }, [moduleName]);

  return data;
}

function generateRandomLog(module: string) {
  const actions = ['Validating', 'Synchronizing', 'Analyzing', 'Encrypting', 'Routing', 'Verifying'];
  const targets = ['payload stream', 'quantum keys', 'telemetry data', 'handshake protocol', 'certificate chain', 'identity token'];
  const results = ['success', 'optimized', 'processed', 'secured'];
  
  const action = actions[Math.floor(Math.random() * actions.length)];
  const target = targets[Math.floor(Math.random() * targets.length)];
  const result = results[Math.floor(Math.random() * results.length)];
  return `${action} ${target} for ${module} - ${result}.`;
}
