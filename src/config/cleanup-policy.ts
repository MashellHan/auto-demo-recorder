import { z } from 'zod';

/** Cleanup policy configuration schema. */
export const CleanupPolicySchema = z.object({
  /** Keep the N most recent sessions. */
  keep_last_n: z.number().int().min(1).optional(),
  /** Remove sessions older than N days. */
  max_age_days: z.number().int().min(1).optional(),
  /** Maximum total disk usage in MB (oldest sessions removed first). */
  max_disk_mb: z.number().min(1).optional(),
  /** Always keep sessions that contain failures (bugs > 0 or error status). */
  keep_failures: z.boolean().default(false),
}).optional();

export type CleanupPolicy = z.infer<typeof CleanupPolicySchema>;

/** Evaluation result for a cleanup policy against current state. */
export interface CleanupEvaluation {
  /** Sessions to remove. */
  sessionsToRemove: string[];
  /** Sessions to keep. */
  sessionsToKeep: string[];
  /** Reason for each removal. */
  reasons: Map<string, string>;
  /** Estimated bytes to free. */
  estimatedFreedBytes: number;
}

/** Session info for cleanup evaluation. */
export interface SessionInfo {
  id: string;
  timestamp: Date;
  sizeBytes: number;
  hasBugs: boolean;
  hasErrors: boolean;
}

/**
 * Evaluate a cleanup policy against a set of sessions.
 * Returns which sessions should be removed and why.
 */
export function evaluateCleanupPolicy(
  policy: CleanupPolicy,
  sessions: SessionInfo[],
): CleanupEvaluation {
  if (!policy) {
    return { sessionsToRemove: [], sessionsToKeep: sessions.map((s) => s.id), reasons: new Map(), estimatedFreedBytes: 0 };
  }

  // Sort sessions by timestamp descending (newest first)
  const sorted = [...sessions].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  const toRemove = new Set<string>();
  const reasons = new Map<string, string>();

  // keep_last_n: remove sessions beyond the keep count
  if (policy.keep_last_n !== undefined) {
    for (let i = policy.keep_last_n; i < sorted.length; i++) {
      const session = sorted[i];
      if (policy.keep_failures && (session.hasBugs || session.hasErrors)) continue;
      toRemove.add(session.id);
      reasons.set(session.id, `Exceeds keep_last_n (${policy.keep_last_n})`);
    }
  }

  // max_age_days: remove sessions older than threshold
  if (policy.max_age_days !== undefined) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - policy.max_age_days);

    for (const session of sorted) {
      if (session.timestamp < cutoff) {
        if (policy.keep_failures && (session.hasBugs || session.hasErrors)) continue;
        toRemove.add(session.id);
        reasons.set(session.id, `Older than ${policy.max_age_days} days`);
      }
    }
  }

  // max_disk_mb: remove oldest sessions until under budget
  if (policy.max_disk_mb !== undefined) {
    const maxBytes = policy.max_disk_mb * 1024 * 1024;
    let totalBytes = sorted.reduce((sum, s) => sum + s.sizeBytes, 0);

    // Remove from oldest first
    for (let i = sorted.length - 1; i >= 0 && totalBytes > maxBytes; i--) {
      const session = sorted[i];
      if (policy.keep_failures && (session.hasBugs || session.hasErrors)) continue;
      if (toRemove.has(session.id)) continue; // Already marked

      toRemove.add(session.id);
      reasons.set(session.id, `Exceeds max_disk_mb (${policy.max_disk_mb} MB)`);
      totalBytes -= session.sizeBytes;
    }
  }

  const sessionsToRemove = [...toRemove];
  const sessionsToKeep = sorted.filter((s) => !toRemove.has(s.id)).map((s) => s.id);
  const estimatedFreedBytes = sessions
    .filter((s) => toRemove.has(s.id))
    .reduce((sum, s) => sum + s.sizeBytes, 0);

  return { sessionsToRemove, sessionsToKeep, reasons, estimatedFreedBytes };
}

/**
 * Format a cleanup evaluation as a human-readable report.
 */
export function formatCleanupEvaluation(evaluation: CleanupEvaluation): string {
  const lines: string[] = [];

  lines.push('Cleanup Policy Evaluation');
  lines.push('─'.repeat(40));

  if (evaluation.sessionsToRemove.length === 0) {
    lines.push('  ✓ No sessions need to be removed.');
  } else {
    lines.push(`  Sessions to remove: ${evaluation.sessionsToRemove.length}`);
    for (const id of evaluation.sessionsToRemove) {
      const reason = evaluation.reasons.get(id) ?? 'Policy match';
      lines.push(`    ✗ ${id} — ${reason}`);
    }
    lines.push('');
    const mb = (evaluation.estimatedFreedBytes / (1024 * 1024)).toFixed(1);
    lines.push(`  Estimated space freed: ${mb} MB`);
  }

  lines.push(`  Sessions to keep: ${evaluation.sessionsToKeep.length}`);

  return lines.join('\n');
}
