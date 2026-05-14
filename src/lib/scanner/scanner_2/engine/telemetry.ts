/**
 * QGuard Scanner Telemetry System
 * Emits and tracks events during vulnerability scanning.
 */

import type { ScanTelemetry, ScanFinding, DetectionRuleResult } from '@/types/scanner.types'

/**
 * TelemetryEmitter manages scan events, allowing subscription
 * and retrieval of telemetry data across the scanning lifecycle.
 */
export class TelemetryEmitter {
  private events: ScanTelemetry[] = []
  private listeners: ((event: ScanTelemetry) => void)[] = []

  /**
   * Emit a telemetry event. Automatically adds a timestamp,
   * stores the event, and notifies all listeners.
   */
  emit(event: Omit<ScanTelemetry, 'timestamp'>): void {
    const fullEvent: ScanTelemetry = {
      ...event,
      timestamp: new Date().toISOString(),
    }
    this.events.push(fullEvent)
    for (const listener of this.listeners) {
      try {
        listener(fullEvent)
      } catch {
        // Listener errors must not break the emitter
      }
    }
  }

  /**
   * Subscribe to telemetry events.
   * Returns an unsubscribe function.
   */
  onEvent(listener: (event: ScanTelemetry) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /** Returns all stored telemetry events. */
  getEvents(): ScanTelemetry[] {
    return [...this.events]
  }

  /** Returns telemetry events filtered by scan ID. */
  getEventsByScan(scanId: string): ScanTelemetry[] {
    return this.events.filter((e) => e.scanId === scanId)
  }

  /** Clears all stored events. */
  clear(): void {
    this.events = []
  }

  // ─── Helper Methods ──────────────────────────────────────────

  /** Emit a module-start event. */
  emitModuleStart(
    scanId: string,
    moduleId: string,
    moduleName: string,
    targetName: string
  ): void {
    this.emit({
      eventType: 'module-start',
      scanId,
      moduleId,
      moduleName,
      targetName,
      message: `Module "${moduleName}" started scanning target "${targetName}"`,
    })
  }

  /** Emit a module-complete event with finding count. */
  emitModuleComplete(
    scanId: string,
    moduleId: string,
    moduleName: string,
    targetName: string,
    findingCount: number
  ): void {
    this.emit({
      eventType: 'module-complete',
      scanId,
      moduleId,
      moduleName,
      targetName,
      message: `Module "${moduleName}" completed with ${findingCount} finding(s)`,
      metadata: { findingCount },
    })
  }

  /** Emit a finding-detected event. */
  emitFindingDetected(
    scanId: string,
    moduleId: string,
    finding: ScanFinding
  ): void {
    this.emit({
      eventType: 'finding-detected',
      scanId,
      moduleId,
      finding,
      message: `Finding detected: ${finding.detectedAlgorithm} (${finding.severity})`,
    })
  }

  /** Emit a rule-triggered event. */
  emitRuleTriggered(scanId: string, ruleResult: DetectionRuleResult): void {
    this.emit({
      eventType: 'rule-triggered',
      scanId,
      ruleResult,
      message: `Rule triggered: ${ruleResult.ruleName} (severity: ${ruleResult.severity})`,
    })
  }

  /** Emit a scan-progress event. */
  emitProgress(scanId: string, progress: number, message: string): void {
    this.emit({
      eventType: 'scan-progress',
      scanId,
      progress,
      message,
    })
  }

  /** Emit a scan-complete event with summary stats. */
  emitScanComplete(
    scanId: string,
    totalFindings: number,
    riskScore: number
  ): void {
    this.emit({
      eventType: 'scan-complete',
      scanId,
      message: `Scan completed with ${totalFindings} finding(s). Risk score: ${riskScore}/1000`,
      metadata: { totalFindings, riskScore },
    })
  }

  /** Emit an error event. */
  emitError(scanId: string, message: string, moduleId?: string): void {
    this.emit({
      eventType: 'error',
      scanId,
      moduleId,
      message,
    })
  }
}

/** Singleton telemetry emitter instance. */
export const telemetry = new TelemetryEmitter()
