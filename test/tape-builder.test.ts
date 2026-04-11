import { describe, it, expect } from 'vitest';
import { buildTape } from '../src/pipeline/tape-builder.js';
import type { Scenario, RecordingConfig } from '../src/config/schema.js';

const defaultRecording: RecordingConfig = {
  width: 1200,
  height: 800,
  font_size: 16,
  theme: 'Catppuccin Mocha',
  fps: 25,
  max_duration: 60,
};

describe('buildTape', () => {
  it('generates valid tape with setup and steps', () => {
    const scenario: Scenario = {
      name: 'test-scenario',
      description: 'Test scenario',
      setup: ['echo setup1', 'echo setup2'],
      steps: [
        { action: 'type', value: 'my-app', pause: '2s' },
        { action: 'key', value: 'j', pause: '500ms' },
        { action: 'key', value: 'Enter', pause: '1s' },
        { action: 'key', value: 'q', pause: '500ms' },
      ],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    expect(tape).toContain('Output "/tmp/test.mp4"');
    expect(tape).toContain('Set Width 1200');
    expect(tape).toContain('Set Height 800');
    expect(tape).toContain('Set FontSize 16');
    expect(tape).toContain('Set Theme "Catppuccin Mocha"');

    // Setup should be hidden
    expect(tape).toContain('Hide');
    expect(tape).toContain('Type "echo setup1"');
    expect(tape).toContain('Type "echo setup2"');
    expect(tape).toContain('Show');

    // Steps
    expect(tape).toContain('Type "my-app"');
    expect(tape).toContain('Enter');
    expect(tape).toContain('Type "j"');
    expect(tape).toContain('Type "q"');
    expect(tape).toContain('Sleep 500ms');
    expect(tape).toContain('Sleep 2s');
  });

  it('generates tape without setup', () => {
    const scenario: Scenario = {
      name: 'no-setup',
      description: 'No setup',
      setup: [],
      steps: [{ action: 'type', value: 'hello', pause: '1s' }],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    expect(tape).not.toContain('Hide');
    expect(tape).not.toContain('Show');
    expect(tape).toContain('Type "hello"');
  });

  it('handles repeat in steps', () => {
    const scenario: Scenario = {
      name: 'repeat-test',
      description: 'Repeat test',
      setup: [],
      steps: [{ action: 'key', value: 'j', pause: '500ms', repeat: 3 }],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    const matches = tape.match(/Type "j"/g);
    expect(matches).toHaveLength(3);
  });

  it('maps special keys correctly', () => {
    const scenario: Scenario = {
      name: 'keys-test',
      description: 'Keys test',
      setup: [],
      steps: [
        { action: 'key', value: 'Enter', pause: '500ms' },
        { action: 'key', value: 'Tab', pause: '500ms' },
        { action: 'key', value: 'Escape', pause: '500ms' },
        { action: 'key', value: 'Up', pause: '500ms' },
        { action: 'key', value: 'Down', pause: '500ms' },
        { action: 'key', value: 'Space', pause: '500ms' },
      ],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    expect(tape).toContain('\nEnter\n');
    expect(tape).toContain('\nTab\n');
    expect(tape).toContain('\nEscape\n');
    expect(tape).toContain('\nUp\n');
    expect(tape).toContain('\nDown\n');
    expect(tape).toContain('\nSpace\n');
  });

  it('handles sleep action', () => {
    const scenario: Scenario = {
      name: 'sleep-test',
      description: 'Sleep test',
      setup: [],
      steps: [{ action: 'sleep', value: '3s', pause: '500ms' }],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    expect(tape).toContain('Sleep 3s');
    // sleep action should NOT emit the default pause after it (continue skips it)
    const lines = tape.split('\n');
    const sleepIdx = lines.findIndex((l) => l === 'Sleep 3s');
    expect(sleepIdx).toBeGreaterThan(-1);
    // next non-empty line should NOT be 'Sleep 500ms'
    const nextLine = lines.slice(sleepIdx + 1).find((l) => l.trim() !== '');
    expect(nextLine).not.toBe('Sleep 500ms');
  });

  it('maps Backspace, Left, and Right keys', () => {
    const scenario: Scenario = {
      name: 'extra-keys',
      description: 'Extra keys test',
      setup: [],
      steps: [
        { action: 'key', value: 'Backspace', pause: '500ms' },
        { action: 'key', value: 'Left', pause: '500ms' },
        { action: 'key', value: 'Right', pause: '500ms' },
        { action: 'key', value: 'esc', pause: '500ms' },
      ],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    expect(tape).toContain('\nBackspace\n');
    expect(tape).toContain('\nLeft\n');
    expect(tape).toContain('\nRight\n');
    expect(tape).toContain('\nEscape\n');
  });

  it('handles sleep with repeat', () => {
    const scenario: Scenario = {
      name: 'sleep-repeat',
      description: 'Sleep repeat test',
      setup: [],
      steps: [{ action: 'sleep', value: '1s', pause: '0ms', repeat: 2 }],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    const matches = tape.match(/Sleep 1s/g);
    expect(matches).toHaveLength(2);
  });

  it('generates Screenshot directive for screenshot action', () => {
    const scenario: Scenario = {
      name: 'screenshot-test',
      description: 'Screenshot test',
      setup: [],
      steps: [{ action: 'screenshot', value: 'capture.png', pause: '500ms' }],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    expect(tape).toContain('Screenshot "capture.png"');
    // screenshot should NOT emit a trailing pause
    const lines = tape.split('\n');
    const screenshotIdx = lines.findIndex((l) => l === 'Screenshot "capture.png"');
    expect(screenshotIdx).toBeGreaterThan(-1);
    const nextLine = lines.slice(screenshotIdx + 1).find((l) => l.trim() !== '');
    expect(nextLine).not.toBe('Sleep 500ms');
  });

  it('escapes quotes in screenshot filename', () => {
    const scenario: Scenario = {
      name: 'screenshot-escape',
      description: 'Screenshot escape test',
      setup: [],
      steps: [{ action: 'screenshot', value: 'my "file".png', pause: '0ms' }],
    };

    const tape = buildTape({
      scenario,
      recording: defaultRecording,
      outputPath: '/tmp/test.mp4',
    });

    expect(tape).toContain('Screenshot "my \\"file\\".png"');
  });

  it('caps pause duration when idle_time_limit is set', () => {
    const scenario: Scenario = {
      name: 'idle-limit',
      description: 'Idle limit test',
      setup: [],
      steps: [{ action: 'type', value: 'hello', pause: '10s' }],
    };
    const recording = { ...defaultRecording, idle_time_limit: 3 };
    const tape = buildTape({ scenario, recording, outputPath: '/tmp/test.mp4' });
    expect(tape).toContain('Sleep 3s');
    expect(tape).not.toContain('Sleep 10s');
  });

  it('caps sleep action duration when idle_time_limit is set', () => {
    const scenario: Scenario = {
      name: 'idle-limit-sleep',
      description: 'Idle limit sleep test',
      setup: [],
      steps: [{ action: 'sleep', value: '15s', pause: '0ms' }],
    };
    const recording = { ...defaultRecording, idle_time_limit: 5 };
    const tape = buildTape({ scenario, recording, outputPath: '/tmp/test.mp4' });
    expect(tape).toContain('Sleep 5s');
    expect(tape).not.toContain('Sleep 15s');
  });

  it('does not cap pause when within idle_time_limit', () => {
    const scenario: Scenario = {
      name: 'idle-within-limit',
      description: 'Within limit test',
      setup: [],
      steps: [{ action: 'type', value: 'hello', pause: '2s' }],
    };
    const recording = { ...defaultRecording, idle_time_limit: 5 };
    const tape = buildTape({ scenario, recording, outputPath: '/tmp/test.mp4' });
    expect(tape).toContain('Sleep 2s');
  });

  it('does not cap when idle_time_limit is not set', () => {
    const scenario: Scenario = {
      name: 'no-limit',
      description: 'No limit test',
      setup: [],
      steps: [{ action: 'type', value: 'hello', pause: '10s' }],
    };
    const tape = buildTape({ scenario, recording: defaultRecording, outputPath: '/tmp/test.mp4' });
    expect(tape).toContain('Sleep 10s');
  });

  it('caps millisecond pauses when idle_time_limit is set', () => {
    const scenario: Scenario = {
      name: 'idle-ms',
      description: 'Millisecond cap test',
      setup: [],
      steps: [{ action: 'type', value: 'hello', pause: '5000ms' }],
    };
    const recording = { ...defaultRecording, idle_time_limit: 2 };
    const tape = buildTape({ scenario, recording, outputPath: '/tmp/test.mp4' });
    expect(tape).toContain('Sleep 2s');
    expect(tape).not.toContain('Sleep 5000ms');
  });
});
