import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as any;
  return {
    ...orig,
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

const {
  parseAsciicast,
  serializeAsciicast,
  reportToAsciicast,
  asciicastToReport,
  loadAsciicast,
  saveAsciicast,
} = await import('../src/pipeline/asciicast.js');
const { readFile, writeFile } = await import('node:fs/promises');

describe('parseAsciicast', () => {
  it('parses valid asciicast v2 content', () => {
    const content = [
      '{"version":2,"width":80,"height":24}',
      '[0.5,"o","hello\\r\\n"]',
      '[1.0,"o","world\\r\\n"]',
    ].join('\n');

    const cast = parseAsciicast(content);
    expect(cast.header.version).toBe(2);
    expect(cast.header.width).toBe(80);
    expect(cast.events).toHaveLength(2);
    expect(cast.events[0]).toEqual([0.5, 'o', 'hello\r\n']);
    expect(cast.events[1]).toEqual([1.0, 'o', 'world\r\n']);
  });

  it('throws on empty content', () => {
    expect(() => parseAsciicast('')).toThrow('Empty asciicast file');
  });

  it('throws on unsupported version', () => {
    const content = '{"version":1,"width":80,"height":24}';
    expect(() => parseAsciicast(content)).toThrow('Unsupported asciicast version');
  });

  it('skips empty lines', () => {
    const content = [
      '{"version":2,"width":80,"height":24}',
      '[0.5,"o","a"]',
      '',
      '[1.0,"o","b"]',
      '',
    ].join('\n');

    const cast = parseAsciicast(content);
    expect(cast.events).toHaveLength(2);
  });
});

describe('serializeAsciicast', () => {
  it('serializes to newline-delimited JSON', () => {
    const cast = {
      header: { version: 2 as const, width: 80, height: 24 },
      events: [[0.5, 'o', 'hello\r\n'] as [number, 'o', string]],
    };

    const result = serializeAsciicast(cast);
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ version: 2, width: 80, height: 24 });
    expect(JSON.parse(lines[1])).toEqual([0.5, 'o', 'hello\r\n']);
  });

  it('roundtrips with parseAsciicast', () => {
    const original = {
      header: { version: 2 as const, width: 120, height: 40, title: 'test' },
      events: [
        [0, 'o', '$ echo hello\r\n'] as [number, 'o', string],
        [0.5, 'o', 'hello\r\n'] as [number, 'o', string],
      ],
    };

    const serialized = serializeAsciicast(original);
    const parsed = parseAsciicast(serialized);

    expect(parsed.header.version).toBe(2);
    expect(parsed.header.width).toBe(120);
    expect(parsed.header.title).toBe('test');
    expect(parsed.events).toHaveLength(2);
  });
});

describe('reportToAsciicast', () => {
  it('converts report frames to asciicast events', () => {
    const report = {
      project: 'test-project',
      scenario: 'demo',
      timestamp: '2026-04-11T15:00:00Z',
      duration_seconds: 10,
      total_frames_analyzed: 2,
      overall_status: 'ok' as const,
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok' as const, description: 'Start', feature_being_demonstrated: 'Init', bugs_detected: [], visual_quality: 'good' as const, annotation_text: 'Starting up' },
        { index: 1, timestamp: '0:05', status: 'warning' as const, description: 'Running', feature_being_demonstrated: 'Run', bugs_detected: [], visual_quality: 'good' as const, annotation_text: 'Processing' },
      ],
      summary: 'Done.',
      bugs_found: 0,
    };

    const cast = reportToAsciicast(report);
    expect(cast.header.version).toBe(2);
    expect(cast.header.duration).toBe(10);
    expect(cast.header.title).toBe('test-project — demo');
    expect(cast.events).toHaveLength(2);
    expect(cast.events[0][0]).toBe(0); // 0:00 = 0 seconds
    expect(cast.events[0][1]).toBe('o');
    expect(cast.events[0][2]).toContain('Starting up');
    expect(cast.events[1][0]).toBe(5); // 0:05 = 5 seconds
    expect(cast.events[1][2]).toContain('Processing');
  });

  it('uses status icons in output', () => {
    const report = {
      project: 'p', scenario: 's',
      timestamp: '', duration_seconds: 5,
      total_frames_analyzed: 1, overall_status: 'ok' as const,
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok' as const, description: 'OK', feature_being_demonstrated: '', bugs_detected: [], visual_quality: 'good' as const, annotation_text: 'Fine' },
      ],
      summary: '', bugs_found: 0,
    };

    const cast = reportToAsciicast(report);
    expect(cast.events[0][2]).toContain('✓');
  });
});

describe('asciicastToReport', () => {
  it('converts asciicast events to report frames', () => {
    const cast = {
      header: { version: 2 as const, width: 80, height: 24, title: 'my-project — my-scenario', duration: 5 },
      events: [
        [0, 'o', 'Starting\r\n'] as [number, 'o' | 'i', string],
        [2, 'o', 'Running\r\n'] as [number, 'o' | 'i', string],
        [4, 'o', 'Done\r\n'] as [number, 'o' | 'i', string],
      ],
    };

    const report = asciicastToReport(cast);
    expect(report.project).toBe('my-project');
    expect(report.scenario).toBe('my-scenario');
    expect(report.duration_seconds).toBe(5);
    expect(report.frames).toHaveLength(3);
    expect(report.frames[0].description).toContain('Starting');
    expect(report.frames[1].timestamp).toBe('0:02');
  });

  it('deduplicates frames at the same second', () => {
    const cast = {
      header: { version: 2 as const, width: 80, height: 24, duration: 2 },
      events: [
        [0.1, 'o', 'a'] as [number, 'o' | 'i', string],
        [0.5, 'o', 'b'] as [number, 'o' | 'i', string],
        [1.0, 'o', 'c'] as [number, 'o' | 'i', string],
        [1.5, 'o', 'd'] as [number, 'o' | 'i', string],
      ],
    };

    const report = asciicastToReport(cast);
    // Should deduplicate to one frame per second: 0 and 1
    expect(report.frames).toHaveLength(2);
  });

  it('strips ANSI escape sequences', () => {
    const cast = {
      header: { version: 2 as const, width: 80, height: 24, duration: 1 },
      events: [
        [0, 'o', '\x1b[32mgreen text\x1b[0m\r\n'] as [number, 'o' | 'i', string],
      ],
    };

    const report = asciicastToReport(cast);
    expect(report.frames[0].description).toContain('green text');
    expect(report.frames[0].description).not.toContain('\x1b');
  });
});

describe('loadAsciicast / saveAsciicast', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readFile).mockResolvedValue('' as never);
    vi.mocked(writeFile).mockResolvedValue(undefined as never);
  });

  it('loads asciicast from file', async () => {
    const content = '{"version":2,"width":80,"height":24}\n[0,"o","test"]\n';
    vi.mocked(readFile).mockResolvedValueOnce(content as never);

    const cast = await loadAsciicast('/tmp/demo.cast');
    expect(cast.header.width).toBe(80);
    expect(cast.events).toHaveLength(1);
    expect(readFile).toHaveBeenCalledWith('/tmp/demo.cast', 'utf-8');
  });

  it('saves asciicast to file', async () => {
    const cast = {
      header: { version: 2 as const, width: 80, height: 24 },
      events: [[0, 'o', 'test'] as [number, 'o', string]],
    };

    await saveAsciicast('/tmp/output.cast', cast);
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/output.cast',
      expect.stringContaining('"version":2'),
      'utf-8',
    );
  });
});
