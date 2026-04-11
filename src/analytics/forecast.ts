/**
 * Recording forecast — predicts future recording volumes and success rates
 * using simple moving average (SMA) and exponential smoothing (EMA).
 */

import type { HistoryEntry } from './history.js';

/** Forecast method. */
export type ForecastMethod = 'sma' | 'ema';

/** A single forecast data point. */
export interface ForecastPoint {
  /** Date label (ISO date string). */
  readonly date: string;
  /** Predicted recording count for this day. */
  readonly predictedCount: number;
  /** Predicted success rate (0-100). */
  readonly predictedSuccessRate: number;
  /** Confidence level (0-100, decreases with distance). */
  readonly confidence: number;
}

/** Observed daily data point for building the model. */
export interface DailyObservation {
  /** ISO date string. */
  readonly date: string;
  /** Total recordings on this day. */
  readonly count: number;
  /** Success rate (0-100). */
  readonly successRate: number;
}

/** Complete forecast result. */
export interface ForecastResult {
  /** Method used. */
  readonly method: ForecastMethod;
  /** Number of historical days used. */
  readonly historicalDays: number;
  /** Window size for averaging. */
  readonly windowSize: number;
  /** Alpha for EMA (only relevant for EMA method). */
  readonly alpha: number;
  /** Historical daily observations. */
  readonly observations: readonly DailyObservation[];
  /** Forecast data points. */
  readonly forecast: readonly ForecastPoint[];
  /** Average daily count from history. */
  readonly avgDailyCount: number;
  /** Average success rate from history. */
  readonly avgSuccessRate: number;
  /** Trend direction based on recent vs. overall. */
  readonly trend: 'increasing' | 'decreasing' | 'stable';
  /** Whether there's enough data to forecast. */
  readonly hasEnoughData: boolean;
}

/**
 * Build daily observation series from history entries.
 */
export function buildDailyObservations(
  entries: readonly HistoryEntry[],
  now: Date = new Date(),
  lookbackDays: number = 30,
): readonly DailyObservation[] {
  const startMs = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;

  const filtered = entries.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t > startMs && t <= now.getTime();
  });

  // Group by date
  const byDate = new Map<string, { total: number; ok: number }>();
  for (const e of filtered) {
    const date = e.timestamp.slice(0, 10);
    const cur = byDate.get(date) ?? { total: 0, ok: 0 };
    cur.total += 1;
    if (e.status === 'ok') cur.ok += 1;
    byDate.set(date, cur);
  }

  // Fill gaps with zero-count days
  const result: DailyObservation[] = [];
  const current = new Date(startMs);
  current.setUTCHours(0, 0, 0, 0);
  const endDate = new Date(now);
  endDate.setUTCHours(0, 0, 0, 0);

  while (current <= endDate) {
    const dateStr = current.toISOString().slice(0, 10);
    const data = byDate.get(dateStr);
    result.push({
      date: dateStr,
      count: data?.total ?? 0,
      successRate: data ? round2((data.ok / data.total) * 100) : 0,
    });
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

/**
 * Compute Simple Moving Average over a series of values.
 */
function computeSMA(values: readonly number[], windowSize: number): number {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return window.reduce((s, v) => s + v, 0) / window.length;
}

/**
 * Compute Exponential Moving Average over a series of values.
 */
function computeEMA(values: readonly number[], alpha: number): number {
  if (values.length === 0) return 0;
  let ema = values[0]!;
  for (let i = 1; i < values.length; i++) {
    ema = alpha * values[i]! + (1 - alpha) * ema;
  }
  return ema;
}

/**
 * Generate recording forecast.
 */
export function generateForecast(
  entries: readonly HistoryEntry[],
  forecastDays: number = 7,
  method: ForecastMethod = 'ema',
  windowSize: number = 7,
  alpha: number = 0.3,
  now: Date = new Date(),
  lookbackDays: number = 30,
): ForecastResult {
  const observations = buildDailyObservations(entries, now, lookbackDays);
  const hasEnoughData = observations.some((o) => o.count > 0);

  if (!hasEnoughData) {
    return {
      method,
      historicalDays: lookbackDays,
      windowSize,
      alpha,
      observations,
      forecast: [],
      avgDailyCount: 0,
      avgSuccessRate: 0,
      trend: 'stable',
      hasEnoughData: false,
    };
  }

  const counts = observations.map((o) => o.count);

  // For success rate, use only days with actual data to avoid
  // zero-data days dragging the rate down (bug T2210 fix).
  const activeDayRates = observations
    .filter((o) => o.count > 0)
    .map((o) => o.successRate);

  // Compute base predictions
  const predictedCount = method === 'sma'
    ? computeSMA(counts, windowSize)
    : computeEMA(counts, alpha);

  const predictedRate = activeDayRates.length > 0
    ? (method === 'sma'
        ? computeSMA(activeDayRates, windowSize)
        : computeEMA(activeDayRates, alpha))
    : 0;

  // Build forecast points with decaying confidence
  const forecast: ForecastPoint[] = [];
  const baseConfidence = 90;
  const decayPerDay = 8;

  for (let d = 1; d <= forecastDays; d++) {
    const forecastDate = new Date(now);
    forecastDate.setUTCDate(forecastDate.getUTCDate() + d);

    forecast.push({
      date: forecastDate.toISOString().slice(0, 10),
      predictedCount: round2(Math.max(0, predictedCount)),
      predictedSuccessRate: round2(Math.min(100, Math.max(0, predictedRate))),
      confidence: Math.max(10, baseConfidence - (d - 1) * decayPerDay),
    });
  }

  // Compute averages
  const totalCount = counts.reduce((s, v) => s + v, 0);
  const activeDays = counts.filter((c) => c > 0).length;
  const avgDailyCount = activeDays > 0 ? round2(totalCount / activeDays) : 0;

  const activeRates = observations.filter((o) => o.count > 0).map((o) => o.successRate);
  const avgSuccessRate = activeRates.length > 0
    ? round2(activeRates.reduce((s, v) => s + v, 0) / activeRates.length)
    : 0;

  // Determine trend: compare recent (last windowSize days) vs overall
  const recentCounts = counts.slice(-windowSize);
  const recentAvg = recentCounts.length > 0
    ? recentCounts.reduce((s, v) => s + v, 0) / recentCounts.length
    : 0;
  const overallAvg = counts.length > 0
    ? counts.reduce((s, v) => s + v, 0) / counts.length
    : 0;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (overallAvg > 0) {
    const change = (recentAvg - overallAvg) / overallAvg;
    if (change > 0.15) trend = 'increasing';
    else if (change < -0.15) trend = 'decreasing';
  }

  return {
    method,
    historicalDays: lookbackDays,
    windowSize,
    alpha,
    observations,
    forecast,
    avgDailyCount,
    avgSuccessRate,
    trend,
    hasEnoughData: true,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Format forecast as a readable report.
 */
export function formatForecast(result: ForecastResult): string {
  const lines: string[] = [];
  const methodLabel = result.method === 'sma'
    ? `Simple Moving Average (window=${result.windowSize})`
    : `Exponential Smoothing (α=${result.alpha})`;

  lines.push('Recording Forecast');
  lines.push('═'.repeat(60));
  lines.push(`  Method:          ${methodLabel}`);
  lines.push(`  Historical data: ${result.historicalDays} days`);
  lines.push(`  Avg daily count: ${result.avgDailyCount}`);
  lines.push(`  Avg success rate: ${result.avgSuccessRate}%`);

  const trendIcon = result.trend === 'increasing' ? '📈' : result.trend === 'decreasing' ? '📉' : '➡️';
  lines.push(`  Trend:           ${trendIcon} ${result.trend}`);
  lines.push('');

  if (!result.hasEnoughData) {
    lines.push('  ⚠️  No recording data available for forecasting.');
    return lines.join('\n');
  }

  if (result.forecast.length > 0) {
    lines.push('  Forecast:');
    lines.push('    Date         Count   Success  Confidence');
    lines.push('    ────────── ─────── ───────── ──────────');
    for (const pt of result.forecast) {
      const count = pt.predictedCount.toFixed(1).padStart(7);
      const rate = `${pt.predictedSuccessRate.toFixed(1)}%`.padStart(8);
      const conf = `${pt.confidence}%`.padStart(5);
      lines.push(`    ${pt.date} ${count} ${rate}      ${conf}`);
    }
    lines.push('');
  }

  // Show recent history summary
  const activeDays = result.observations.filter((o) => o.count > 0);
  if (activeDays.length > 0) {
    const last5 = activeDays.slice(-5);
    lines.push('  Recent activity:');
    for (const day of last5) {
      lines.push(`    ${day.date}  ${day.count} recordings  ${day.successRate}% success`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
