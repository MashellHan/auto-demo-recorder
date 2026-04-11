import { describe, it, expect } from 'vitest';
import { compareFrameDescriptions, formatVisualDiff, type VisualDiffResult } from '../src/analytics/visual-diff.js';

describe('compareFrameDescriptions', () => {
  it('detects identical descriptions as unchanged', () => {
    const reportA = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Terminal showing file list' },
        { frame_number: 2, description: 'File opened in editor' },
      ],
    };
    const reportB = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Terminal showing file list' },
        { frame_number: 2, description: 'File opened in editor' },
      ],
    };

    const result = compareFrameDescriptions(reportA, reportB, 'session-a', 'session-b');
    expect(result.changedFrames).toBe(0);
    expect(result.changePercent).toBe(0);
  });

  it('detects different descriptions as changed', () => {
    const reportA = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Terminal showing file list' },
      ],
    };
    const reportB = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Error message displayed on screen' },
      ],
    };

    const result = compareFrameDescriptions(reportA, reportB, 'session-a', 'session-b');
    expect(result.changedFrames).toBe(1);
    expect(result.changePercent).toBeGreaterThan(0);
  });

  it('detects similar descriptions as unchanged', () => {
    const reportA = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Terminal showing file navigation with list' },
      ],
    };
    const reportB = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Terminal showing file navigation list view' },
      ],
    };

    const result = compareFrameDescriptions(reportA, reportB, 'session-a', 'session-b');
    expect(result.changedFrames).toBe(0);
  });

  it('handles different frame counts', () => {
    const reportA = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Frame 1' },
      ],
    };
    const reportB = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Frame 1' },
        { frame_number: 2, description: 'Extra frame' },
      ],
    };

    const result = compareFrameDescriptions(reportA, reportB, 'session-a', 'session-b');
    expect(result.totalFrames).toBe(2);
    expect(result.changedFrames).toBe(1); // The missing frame
  });

  it('detects bug status changes', () => {
    const reportA = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Terminal output', bugs_detected: false },
      ],
    };
    const reportB = {
      scenario: 'basic',
      frames: [
        { frame_number: 1, description: 'Terminal output', bugs_detected: true },
      ],
    };

    const result = compareFrameDescriptions(reportA, reportB, 'session-a', 'session-b');
    expect(result.frameDiffs[0].bugStatusChanged).toBe(true);
  });

  it('handles empty frames', () => {
    const reportA = { scenario: 'basic', frames: [] };
    const reportB = { scenario: 'basic', frames: [] };

    const result = compareFrameDescriptions(reportA, reportB, 'session-a', 'session-b');
    expect(result.totalFrames).toBe(0);
    expect(result.changedFrames).toBe(0);
    expect(result.changePercent).toBe(0);
  });
});

describe('formatVisualDiff', () => {
  it('shows no changes message when identical', () => {
    const result: VisualDiffResult = {
      scenarioName: 'basic',
      sessionA: '2026-04-10_08-00',
      sessionB: '2026-04-11_08-00',
      frameDiffs: [],
      totalFrames: 0,
      changedFrames: 0,
      changePercent: 0,
    };

    const output = formatVisualDiff(result);
    expect(output).toContain('No visual changes');
  });

  it('shows changed frames with descriptions', () => {
    const result: VisualDiffResult = {
      scenarioName: 'basic',
      sessionA: '2026-04-10_08-00',
      sessionB: '2026-04-11_08-00',
      frameDiffs: [
        {
          frameIndex: 1,
          descriptionA: 'File list',
          descriptionB: 'Error screen',
          changed: true,
          bugStatusChanged: false,
        },
      ],
      totalFrames: 1,
      changedFrames: 1,
      changePercent: 100,
    };

    const output = formatVisualDiff(result);
    expect(output).toContain('Frame 1');
    expect(output).toContain('File list');
    expect(output).toContain('Error screen');
  });

  it('shows bug status change indicator', () => {
    const result: VisualDiffResult = {
      scenarioName: 'basic',
      sessionA: '2026-04-10_08-00',
      sessionB: '2026-04-11_08-00',
      frameDiffs: [
        {
          frameIndex: 1,
          descriptionA: 'Output',
          descriptionB: 'Output',
          changed: false,
          bugStatusChanged: true,
        },
      ],
      totalFrames: 1,
      changedFrames: 1,
      changePercent: 100,
    };

    const output = formatVisualDiff(result);
    expect(output).toContain('Bug status changed');
  });
});
