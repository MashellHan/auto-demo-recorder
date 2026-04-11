import { describe, it, expect } from 'vitest';
import { buildReplayPlan, formatReplayStep, type ReplayStep } from '../src/pipeline/replay.js';

describe('buildReplayPlan', () => {
  it('creates steps from report frames', () => {
    const report = {
      scenario: 'basic-navigation',
      frames: [
        { frame_number: 1, timestamp_seconds: 0, description: 'Initial state', bugs_detected: false },
        { frame_number: 2, timestamp_seconds: 2, description: 'After typing command', bugs_detected: false },
        { frame_number: 3, timestamp_seconds: 5, description: 'Output displayed', bugs_detected: true, bug_description: 'Error message visible' },
      ],
      overall_status: 'warning',
      total_frames_analyzed: 3,
      bugs_found: 1,
      duration_seconds: 5,
    };

    const plan = buildReplayPlan(report);

    expect(plan.scenarioName).toBe('basic-navigation');
    expect(plan.totalSteps).toBe(3);
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0].frameNumber).toBe(1);
    expect(plan.steps[0].description).toBe('Initial state');
    expect(plan.steps[2].hasBug).toBe(true);
    expect(plan.steps[2].bugDescription).toBe('Error message visible');
  });

  it('handles report with no frames', () => {
    const report = {
      scenario: 'empty',
      frames: [],
      overall_status: 'ok',
      total_frames_analyzed: 0,
      bugs_found: 0,
      duration_seconds: 0,
    };

    const plan = buildReplayPlan(report);

    expect(plan.steps).toHaveLength(0);
    expect(plan.totalSteps).toBe(0);
  });

  it('includes timing between steps', () => {
    const report = {
      scenario: 'timed',
      frames: [
        { frame_number: 1, timestamp_seconds: 0, description: 'Start' },
        { frame_number: 2, timestamp_seconds: 3, description: 'After 3s' },
        { frame_number: 3, timestamp_seconds: 7, description: 'After 7s' },
      ],
      overall_status: 'ok',
      total_frames_analyzed: 3,
      bugs_found: 0,
      duration_seconds: 7,
    };

    const plan = buildReplayPlan(report);

    expect(plan.steps[0].delayMs).toBe(0);
    expect(plan.steps[1].delayMs).toBe(3000);
    expect(plan.steps[2].delayMs).toBe(4000);
  });
});

describe('formatReplayStep', () => {
  it('formats a normal step', () => {
    const step: ReplayStep = {
      frameNumber: 1,
      timestampSeconds: 2.5,
      description: 'User typed a command',
      hasBug: false,
      delayMs: 2500,
    };

    const output = formatReplayStep(step, 5);

    expect(output).toContain('Step 1/5');
    expect(output).toContain('2.5s');
    expect(output).toContain('User typed a command');
    expect(output).not.toContain('BUG');
  });

  it('formats a step with a bug', () => {
    const step: ReplayStep = {
      frameNumber: 3,
      timestampSeconds: 5,
      description: 'Error state',
      hasBug: true,
      bugDescription: 'Fatal error in console',
      delayMs: 2000,
    };

    const output = formatReplayStep(step, 5);

    expect(output).toContain('BUG');
    expect(output).toContain('Fatal error in console');
  });

  it('formats first step (no delay)', () => {
    const step: ReplayStep = {
      frameNumber: 1,
      timestampSeconds: 0,
      description: 'Initial state',
      hasBug: false,
      delayMs: 0,
    };

    const output = formatReplayStep(step, 3);

    expect(output).toContain('Step 1/3');
    expect(output).toContain('0.0s');
  });
});
