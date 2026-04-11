import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

/** Cell in the comparison matrix. */
export interface MatrixCell {
  status: string;
  bugs: number;
  duration: number;
  exists: boolean;
}

/** A row (session) in the comparison matrix. */
export interface MatrixRow {
  sessionId: string;
  cells: Map<string, MatrixCell>;
}

/** Complete comparison matrix. */
export interface ComparisonMatrix {
  /** Session IDs (row headers). */
  sessions: string[];
  /** Scenario names (column headers). */
  scenarios: string[];
  /** Matrix data: session → scenario → cell. */
  rows: MatrixRow[];
}

/**
 * Generate a comparison matrix from the output directory.
 * Rows = sessions, Columns = scenarios.
 */
export async function generateComparisonMatrix(outputDir: string): Promise<ComparisonMatrix> {
  if (!existsSync(outputDir)) {
    return { sessions: [], scenarios: [], rows: [] };
  }

  const entries = await readdir(outputDir);
  const sessionDirs = entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/.test(e))
    .sort();

  const allScenarios = new Set<string>();
  const rows: MatrixRow[] = [];

  for (const dir of sessionDirs) {
    const sessionPath = join(outputDir, dir);
    const scenarioEntries = await readdir(sessionPath);
    const cells = new Map<string, MatrixCell>();

    for (const entry of scenarioEntries) {
      const reportPath = join(sessionPath, entry, 'report.json');
      if (!existsSync(reportPath)) continue;

      try {
        const report = JSON.parse(await readFile(reportPath, 'utf-8'));
        const name = report.scenario ?? entry;
        allScenarios.add(name);

        cells.set(name, {
          status: report.overall_status ?? 'unknown',
          bugs: report.bugs_found ?? 0,
          duration: report.duration_seconds ?? 0,
          exists: true,
        });
      } catch {
        // Skip corrupt reports
      }
    }

    rows.push({ sessionId: dir, cells });
  }

  const scenarios = [...allScenarios].sort();

  return { sessions: sessionDirs, scenarios, rows };
}

/**
 * Format a comparison matrix as a human-readable table.
 */
export function formatComparisonMatrix(matrix: ComparisonMatrix): string {
  if (matrix.sessions.length === 0) {
    return 'No recording sessions found.';
  }

  const lines: string[] = [];
  lines.push('Recording Comparison Matrix');
  lines.push('═'.repeat(60));

  // Header row
  const sessionWidth = 20;
  const cellWidth = 14;
  const header = ''.padEnd(sessionWidth) + matrix.scenarios.map((s) => s.padEnd(cellWidth)).join('');
  lines.push(header);
  lines.push('─'.repeat(sessionWidth + matrix.scenarios.length * cellWidth));

  // Data rows
  for (const row of matrix.rows) {
    const cells = matrix.scenarios.map((scenario) => {
      const cell = row.cells.get(scenario);
      if (!cell || !cell.exists) {
        return '—'.padEnd(cellWidth);
      }
      const icon = cell.status === 'ok' ? '✓' : cell.status === 'warning' ? '⚠' : '✗';
      const bugsStr = cell.bugs > 0 ? `${cell.bugs}b` : '';
      return `${icon} ${bugsStr}`.padEnd(cellWidth);
    });

    lines.push(`${row.sessionId.padEnd(sessionWidth)}${cells.join('')}`);
  }

  lines.push('');
  lines.push(`Sessions: ${matrix.sessions.length}  |  Scenarios: ${matrix.scenarios.length}`);

  return lines.join('\n');
}
