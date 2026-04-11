/**
 * Recording heat map — visualize recording frequency by
 * day-of-week and hour-of-day as an ASCII heat map.
 *
 * Useful for understanding recording patterns, identifying
 * peak usage times, and optimizing CI schedules.
 */

import type { HistoryEntry } from './history.js';

/** Heat map cell with count and intensity. */
export interface HeatMapCell {
  /** Day of week (0=Sunday, 6=Saturday). */
  readonly day: number;
  /** Hour of day (0-23). */
  readonly hour: number;
  /** Number of recordings in this slot. */
  readonly count: number;
  /** Intensity (0-1) relative to max. */
  readonly intensity: number;
}

/** Heat map result. */
export interface HeatMapResult {
  /** 7×24 grid of cells. */
  readonly cells: readonly HeatMapCell[];
  /** Peak day name. */
  readonly peakDay: string;
  /** Peak hour. */
  readonly peakHour: number;
  /** Max count in any single cell. */
  readonly maxCount: number;
  /** Total recordings analyzed. */
  readonly totalRecordings: number;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Generate a heat map from recording history entries.
 */
export function generateHeatMap(entries: readonly HistoryEntry[]): HeatMapResult {
  // Initialize 7×24 grid
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);

  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    if (isNaN(date.getTime())) continue;
    const day = date.getDay(); // 0=Sun
    const hour = date.getHours();
    grid[day][hour]++;
  }

  // Find max
  let maxCount = 0;
  let peakDay = 0;
  let peakHour = 0;

  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (grid[d][h] > maxCount) {
        maxCount = grid[d][h];
        peakDay = d;
        peakHour = h;
      }
    }
  }

  // Build cells
  const cells: HeatMapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      cells.push({
        day: d,
        hour: h,
        count: grid[d][h],
        intensity: maxCount > 0 ? grid[d][h] / maxCount : 0,
      });
    }
  }

  return {
    cells,
    peakDay: DAY_NAMES[peakDay],
    peakHour,
    maxCount,
    totalRecordings: entries.length,
  };
}

/**
 * Format heat map as an ASCII visualization.
 */
export function formatHeatMap(result: HeatMapResult): string {
  const lines: string[] = [];
  lines.push('Recording Heat Map');
  lines.push('═'.repeat(60));
  lines.push('');

  if (result.totalRecordings === 0) {
    lines.push('  No recordings to analyze.');
    return lines.join('\n');
  }

  // Intensity blocks: empty, light, medium, heavy, full
  const blocks = [' ', '░', '▒', '▓', '█'];

  // Header: hours
  const hourLabels = Array.from({ length: 24 }, (_, i) =>
    i % 3 === 0 ? String(i).padStart(2) : '  ',
  );
  lines.push(`      ${hourLabels.join('')}`);

  // Each day row
  for (let d = 0; d < 7; d++) {
    const row = DAY_NAMES[d].padEnd(4);
    let bar = '';
    for (let h = 0; h < 24; h++) {
      const cell = result.cells[d * 24 + h];
      const blockIndex = Math.min(4, Math.floor(cell.intensity * 4.99));
      bar += blocks[blockIndex] + blocks[blockIndex];
    }
    lines.push(`  ${row} ${bar}`);
  }

  lines.push('');
  lines.push(`  Legend:  ${blocks[0]}${blocks[0]}=0  ${blocks[1]}${blocks[1]}=low  ${blocks[2]}${blocks[2]}=medium  ${blocks[3]}${blocks[3]}=high  ${blocks[4]}${blocks[4]}=peak`);
  lines.push('');
  lines.push(`  Total: ${result.totalRecordings} recordings`);
  lines.push(`  Peak: ${result.peakDay} at ${result.peakHour}:00 (${result.maxCount} recordings)`);

  return lines.join('\n');
}
