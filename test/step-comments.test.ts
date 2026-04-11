import { describe, it, expect, vi } from 'vitest';
import { buildTape } from '../src/pipeline/tape-builder.js';
import type { Scenario, RecordingConfig } from '../src/config/schema.js';

describe('step comments in tape-builder', () => {
  const baseRecording: RecordingConfig = {
    width: 1200,
    height: 800,
    font_size: 16,
    theme: 'Catppuccin Mocha',
    fps: 25,
    max_duration: 60,
    format: 'mp4',
    backend: 'vhs',
    browser: { headless: true, browser: 'chromium', viewport_width: 1280, viewport_height: 720, timeout_ms: 30000, device_scale_factor: 1, record_video: true },
    frame: { style: 'none' },
    parallel: false,
    max_workers: 3,
  };

  it('includes VHS comment for steps with comment field', () => {
    const scenario: Scenario = {
      name: 'test',
      description: 'Test scenario',
      setup: [],
      steps: [
        { action: 'type', value: 'npm install', pause: '500ms', comment: 'Install dependencies' },
        { action: 'key', value: 'Enter', pause: '500ms' },
      ],
      tags: [],
      depends_on: [],
    };

    const tape = buildTape({ scenario, recording: baseRecording, outputPath: '/out/raw.mp4' });
    expect(tape).toContain('# Install dependencies');
  });

  it('does not include VHS comment for steps without comment', () => {
    const scenario: Scenario = {
      name: 'test',
      description: 'Test scenario',
      setup: [],
      steps: [
        { action: 'type', value: 'ls', pause: '500ms' },
      ],
      tags: [],
      depends_on: [],
    };

    const tape = buildTape({ scenario, recording: baseRecording, outputPath: '/out/raw.mp4' });
    const lines = tape.split('\n');
    // Only the auto-generated header comment and recording phase comment should exist
    const commentLines = lines.filter((l) => l.startsWith('#'));
    expect(commentLines.length).toBe(2); // "# Auto-generated..." and "# Recording phase"
  });

  it('places comment before the step command', () => {
    const scenario: Scenario = {
      name: 'test',
      description: 'Test scenario',
      setup: [],
      steps: [
        { action: 'type', value: 'echo hello', pause: '500ms', comment: 'Print greeting' },
      ],
      tags: [],
      depends_on: [],
    };

    const tape = buildTape({ scenario, recording: baseRecording, outputPath: '/out/raw.mp4' });
    const lines = tape.split('\n');
    const commentIndex = lines.findIndex((l) => l === '# Print greeting');
    const typeIndex = lines.findIndex((l) => l === 'Type "echo hello"');
    expect(commentIndex).toBeGreaterThan(-1);
    expect(typeIndex).toBeGreaterThan(commentIndex);
  });
});
