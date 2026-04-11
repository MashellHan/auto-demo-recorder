/** Session data for changelog generation. */
export interface SessionData {
  timestamp: string;
  scenarios: Array<{
    name: string;
    status: string;
    bugs: number;
    duration: number;
  }>;
}

/** A single changelog entry for one recording session. */
export interface ChangelogEntry {
  /** Date string (YYYY-MM-DD). */
  date: string;
  /** Full session timestamp (YYYY-MM-DD_HH-MM). */
  timestamp: string;
  /** Total scenarios recorded. */
  totalScenarios: number;
  /** Total bugs across all scenarios. */
  totalBugs: number;
  /** Descriptions of scenarios that improved vs previous session. */
  improvements: string[];
  /** Descriptions of scenarios that regressed vs previous session. */
  regressions: string[];
  /** Names of scenarios added since previous session. */
  newScenarios: string[];
  /** Names of scenarios removed since previous session. */
  removedScenarios: string[];
}

/**
 * Generate changelog entries from an ordered list of session data.
 * Sessions should be ordered chronologically (oldest first).
 * Returns entries in reverse chronological order (newest first).
 */
export function generateChangelog(sessions: SessionData[]): ChangelogEntry[] {
  if (sessions.length === 0) return [];

  const entries: ChangelogEntry[] = [];

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const prevSession = i > 0 ? sessions[i - 1] : undefined;
    const date = session.timestamp.split('_')[0];

    const totalBugs = session.scenarios.reduce((sum, s) => sum + s.bugs, 0);

    const improvements: string[] = [];
    const regressions: string[] = [];
    const newScenarios: string[] = [];
    const removedScenarios: string[] = [];

    if (prevSession) {
      const prevMap = new Map(prevSession.scenarios.map((s) => [s.name, s]));
      const currMap = new Map(session.scenarios.map((s) => [s.name, s]));

      // Compare scenarios present in both sessions
      for (const [name, curr] of currMap) {
        const prev = prevMap.get(name);
        if (!prev) {
          newScenarios.push(name);
          continue;
        }

        if (curr.bugs < prev.bugs) {
          improvements.push(`${name}: ${prev.bugs}→${curr.bugs} bugs (fixed)`);
        } else if (curr.bugs > prev.bugs) {
          regressions.push(`${name}: ${prev.bugs}→${curr.bugs} bugs (regressed)`);
        }
      }

      // Detect removed scenarios
      for (const name of prevMap.keys()) {
        if (!currMap.has(name)) {
          removedScenarios.push(name);
        }
      }
    }

    entries.push({
      date,
      timestamp: session.timestamp,
      totalScenarios: session.scenarios.length,
      totalBugs,
      improvements,
      regressions,
      newScenarios,
      removedScenarios,
    });
  }

  // Return newest first
  return entries.reverse();
}

/**
 * Format changelog entries as a human-readable string.
 */
export function formatChangelog(entries: ChangelogEntry[]): string {
  if (entries.length === 0) {
    return 'No recording history found.';
  }

  const lines: string[] = [];
  lines.push('# Recording Changelog');
  lines.push('');

  let lastDate = '';

  for (const entry of entries) {
    // Only emit date header when the date changes (prevents duplicate headers)
    if (entry.date !== lastDate) {
      lines.push(`## ${entry.date}`);
      lines.push('');
      lastDate = entry.date;
    }

    // Show session timestamp as a sub-heading when grouping by date
    lines.push(`### Session ${entry.timestamp}`);
    lines.push('');
    lines.push(`- Scenarios: ${entry.totalScenarios}`);
    lines.push(`- Bugs: ${entry.totalBugs}`);

    if (entry.improvements.length > 0) {
      lines.push('');
      lines.push('### Improvements');
      for (const imp of entry.improvements) {
        lines.push(`- ${imp}`);
      }
    }

    if (entry.regressions.length > 0) {
      lines.push('');
      lines.push('### Regressions');
      for (const reg of entry.regressions) {
        lines.push(`- ${reg}`);
      }
    }

    if (entry.newScenarios.length > 0) {
      lines.push('');
      lines.push('### New Scenarios');
      for (const name of entry.newScenarios) {
        lines.push(`- ${name}`);
      }
    }

    if (entry.removedScenarios.length > 0) {
      lines.push('');
      lines.push('### Removed Scenarios');
      for (const name of entry.removedScenarios) {
        lines.push(`- ${name}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
