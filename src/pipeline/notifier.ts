import type { RecordResult } from '../index.js';

/** Payload sent to notification handlers. */
export interface NotificationPayload {
  /** Project name. */
  project: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** Total scenarios recorded. */
  totalScenarios: number;
  /** Scenarios that completed successfully. */
  successful: number;
  /** Scenarios that failed. */
  failed: number;
  /** Total bugs found across all scenarios. */
  totalBugs: number;
  /** Total recording duration in seconds. */
  totalDuration: number;
  /** Overall status: 'ok', 'warning', or 'error'. */
  status: 'ok' | 'warning' | 'error';
}

/**
 * Build a notification payload from recording results.
 */
export function buildNotification(
  project: string,
  results: Array<Pick<RecordResult, 'success' | 'summary'>>,
): NotificationPayload {
  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;
  const totalBugs = results.reduce((sum, r) => sum + (r.summary?.bugsFound ?? 0), 0);
  const totalDuration = results.reduce((sum, r) => sum + (r.summary?.durationSeconds ?? 0), 0);

  let status: 'ok' | 'warning' | 'error' = 'ok';
  if (failed > 0) {
    status = 'error';
  } else if (totalBugs > 0) {
    status = 'warning';
  }

  return {
    project,
    timestamp: new Date().toISOString(),
    totalScenarios: results.length,
    successful,
    failed,
    totalBugs,
    totalDuration,
    status,
  };
}

/**
 * Format a notification payload as a human-readable summary string.
 */
export function formatNotificationSummary(payload: NotificationPayload): string {
  const lines: string[] = [];

  const statusIcon = payload.status === 'ok' ? '✅' : payload.status === 'warning' ? '⚠️' : '❌';

  lines.push(`${statusIcon} Recording complete: ${payload.project}`);
  lines.push(`  ${payload.successful}/${payload.totalScenarios} scenarios passed`);

  if (payload.failed > 0) {
    lines.push(`  ${payload.failed} failed`);
  }

  lines.push(`  ${payload.totalBugs} bugs found`);
  lines.push(`  Duration: ${payload.totalDuration.toFixed(1)}s`);

  return lines.join('\n');
}

/**
 * Send a notification via webhook (POST request).
 * Returns true if the request succeeds (2xx status).
 */
export async function sendWebhook(url: string, payload: NotificationPayload): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Run a notification command with environment variables set.
 */
export async function runNotificationCommand(
  command: string,
  payload: NotificationPayload,
): Promise<void> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);

  const env = {
    ...process.env,
    DEMO_PROJECT: payload.project,
    DEMO_STATUS: payload.status,
    DEMO_SCENARIOS: String(payload.totalScenarios),
    DEMO_SUCCESSFUL: String(payload.successful),
    DEMO_FAILED: String(payload.failed),
    DEMO_BUGS: String(payload.totalBugs),
    DEMO_DURATION: String(payload.totalDuration),
  };

  await execFileAsync('sh', ['-c', command], { env });
}
