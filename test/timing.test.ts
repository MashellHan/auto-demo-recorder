import { describe, it, expect } from 'vitest';
import {
  analyzeTimingFromData,
  renderTimingChart,
  formatTimingReport,
  type TimingAnalysis,
} from '../src/analytics/timing.js';

describe('analyzeTimingFromData', () => {
  it('analyzes timing from frames with timestamps', () => {
    const report = {
      scenario: 'basic',
      duration_seconds: 10,
      frames: [
        { timestamp_seconds: 0, description: 'App startup' },
        { timestamp_seconds: 2.5, description: 'Menu visible' },
        { timestamp_seconds: 7.0, description: 'Action complete' },
      ],
    };

    const result = analyzeTimingFromData(report);

    expect(result.scenarioName).toBe('basic');
    expect(result.totalDurationSeconds).toBe(10);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].durationSeconds).toBe(2.5);
    expect(result.steps[1].durationSeconds).toBe(4.5);
    expect(result.steps[2].durationSeconds).toBe(3.0);
  });

  it('falls back to step definitions when no frames', () => {
    const report = {
      scenario: 'adhoc',
      duration_seconds: 5,
      steps: [
        { action: 'type', value: 'hello', pause: '2s' },
        { action: 'key', value: 'Enter', pause: '500ms' },
        { action: 'sleep', value: '2s', pause: '2s' },
      ],
    };

    const result = analyzeTimingFromData(report);

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].action).toBe('type');
    expect(result.steps[0].durationSeconds).toBe(2);
    expect(result.steps[1].durationSeconds).toBe(0.5);
    expect(result.steps[2].durationSeconds).toBe(2);
  });

  it('identifies the slowest step', () => {
    const report = {
      scenario: 'test',
      duration_seconds: 10,
      frames: [
        { timestamp_seconds: 0, description: 'Start' },
        { timestamp_seconds: 1, description: 'Fast step' },
        { timestamp_seconds: 8, description: 'Slow step' },
      ],
    };

    const result = analyzeTimingFromData(report);

    expect(result.slowestStep).not.toBeNull();
    expect(result.slowestStep!.index).toBe(2);
    expect(result.slowestStep!.durationSeconds).toBe(7);
  });

  it('handles empty report gracefully', () => {
    const report = { scenario: 'empty', duration_seconds: 0 };
    const result = analyzeTimingFromData(report);

    expect(result.steps).toHaveLength(0);
    expect(result.slowestStep).toBeNull();
    expect(result.suggestions).toHaveLength(0);
  });

  it('generates suggestions for long sleep steps', () => {
    const report = {
      scenario: 'slow',
      duration_seconds: 20,
      steps: [
        { action: 'type', value: 'cmd', pause: '1s' },
        { action: 'sleep', value: '15s', pause: '15s' },
        { action: 'key', value: 'q', pause: '500ms' },
      ],
    };

    const result = analyzeTimingFromData(report);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.some((s) => s.includes('sleep'))).toBe(true);
  });

  it('generates suggestion when total > 60s', () => {
    const report = {
      scenario: 'long',
      duration_seconds: 90,
      frames: [
        { timestamp_seconds: 0, description: 'Start' },
        { timestamp_seconds: 90, description: 'End' },
      ],
    };

    const result = analyzeTimingFromData(report);
    expect(result.suggestions.some((s) => s.includes('exceeds 60s'))).toBe(true);
  });

  it('computes percentOfTotal correctly', () => {
    const report = {
      scenario: 'test',
      duration_seconds: 10,
      frames: [
        { timestamp_seconds: 0, description: 'A' },
        { timestamp_seconds: 5, description: 'B' },
      ],
    };

    const result = analyzeTimingFromData(report);
    expect(result.steps[0].percentOfTotal).toBe(50);
    expect(result.steps[1].percentOfTotal).toBe(50);
  });
});

describe('renderTimingChart', () => {
  it('renders a bar chart for steps', () => {
    const steps = [
      { index: 1, action: 'type', value: 'hello', durationSeconds: 2, percentOfTotal: 40 },
      { index: 2, action: 'sleep', value: '3s', durationSeconds: 3, percentOfTotal: 60 },
    ];

    const chart = renderTimingChart(steps);
    expect(chart).toContain('Step Timing Analysis');
    expect(chart).toContain('█');
    expect(chart).toContain('2.0s');
    expect(chart).toContain('3.0s');
  });

  it('returns message for empty steps', () => {
    expect(renderTimingChart([])).toBe('No steps to display.');
  });

  it('returns message for zero-duration steps', () => {
    const steps = [
      { index: 1, action: 'key', value: 'Enter', durationSeconds: 0, percentOfTotal: 0 },
    ];
    expect(renderTimingChart(steps)).toBe('All steps have zero duration.');
  });
});

describe('formatTimingReport', () => {
  it('formats a complete timing analysis', () => {
    const analysis: TimingAnalysis = {
      scenarioName: 'basic',
      totalDurationSeconds: 10,
      steps: [
        { index: 1, action: 'type', value: 'cmd', durationSeconds: 3, percentOfTotal: 30 },
        { index: 2, action: 'sleep', value: '7s', durationSeconds: 7, percentOfTotal: 70 },
      ],
      slowestStep: { index: 2, action: 'sleep', value: '7s', durationSeconds: 7, percentOfTotal: 70 },
      suggestions: ['Step 2: sleep takes too long'],
    };

    const report = formatTimingReport(analysis);
    expect(report).toContain('Total: 10.0s');
    expect(report).toContain('Slowest: Step 2');
    expect(report).toContain('Suggestions:');
    expect(report).toContain('Step 2: sleep takes too long');
  });

  it('omits suggestions section when none', () => {
    const analysis: TimingAnalysis = {
      scenarioName: 'clean',
      totalDurationSeconds: 5,
      steps: [{ index: 1, action: 'type', value: 'hi', durationSeconds: 5, percentOfTotal: 100 }],
      slowestStep: { index: 1, action: 'type', value: 'hi', durationSeconds: 5, percentOfTotal: 100 },
      suggestions: [],
    };

    const report = formatTimingReport(analysis);
    expect(report).not.toContain('Suggestions:');
  });
});
