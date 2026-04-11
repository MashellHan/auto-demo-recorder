import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as any;
  return {
    ...orig,
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

const { generateDocs } = await import('../src/pipeline/doc-generator.js');
const { readFile, writeFile } = await import('node:fs/promises');

describe('generateDocs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readFile).mockResolvedValue('' as never);
    vi.mocked(writeFile).mockResolvedValue(undefined as never);
  });

  it('generates markdown with title and summary', async () => {
    const report = {
      project: 'test-project',
      scenario: 'basic-demo',
      timestamp: '2026-04-11T15:00:00Z',
      duration_seconds: 12.5,
      total_frames_analyzed: 3,
      overall_status: 'ok',
      frames: [],
      summary: 'A clean recording of the basic demo.',
      bugs_found: 0,
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    const result = await generateDocs({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/DEMO.md',
      projectName: 'test-project',
      scenarioName: 'basic-demo',
    });

    expect(result).toBe('/tmp/DEMO.md');
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/DEMO.md',
      expect.stringContaining('# test-project'),
      'utf-8',
    );

    const md = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(md).toContain('basic-demo');
    expect(md).toContain('A clean recording of the basic demo.');
    expect(md).toContain('12s');
  });

  it('includes scenario description when provided', async () => {
    const report = {
      project: 'test', scenario: 'demo',
      timestamp: '2026-04-11T15:00:00Z', duration_seconds: 5,
      total_frames_analyzed: 0, overall_status: 'ok',
      frames: [], summary: 'Done.', bugs_found: 0,
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateDocs({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/DEMO.md',
      projectName: 'test',
      scenarioName: 'demo',
      scenarioDescription: 'This scenario demonstrates the login flow.',
    });

    const md = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(md).toContain('This scenario demonstrates the login flow.');
  });

  it('groups frames by feature', async () => {
    const report = {
      project: 'test', scenario: 'demo',
      timestamp: '2026-04-11T15:00:00Z', duration_seconds: 10,
      total_frames_analyzed: 3, overall_status: 'ok',
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'App starts', feature_being_demonstrated: 'Startup', bugs_detected: [], visual_quality: 'good', annotation_text: 'Starting' },
        { index: 1, timestamp: '0:03', status: 'ok', description: 'Menu visible', feature_being_demonstrated: 'Navigation', bugs_detected: [], visual_quality: 'good', annotation_text: 'Navigating' },
        { index: 2, timestamp: '0:06', status: 'ok', description: 'Settings open', feature_being_demonstrated: 'Navigation', bugs_detected: [], visual_quality: 'good', annotation_text: 'Settings' },
      ],
      summary: 'Done.', bugs_found: 0,
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateDocs({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/DEMO.md',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const md = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(md).toContain('### Startup');
    expect(md).toContain('### Navigation');
    expect(md).toContain('App starts');
    expect(md).toContain('Menu visible');
  });

  it('includes bug report section when bugs exist', async () => {
    const report = {
      project: 'test', scenario: 'demo',
      timestamp: '2026-04-11T15:00:00Z', duration_seconds: 5,
      total_frames_analyzed: 2, overall_status: 'warning',
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'Normal', feature_being_demonstrated: 'Start', bugs_detected: [], visual_quality: 'good', annotation_text: 'OK' },
        { index: 1, timestamp: '0:03', status: 'warning', description: 'Error visible', feature_being_demonstrated: 'Start', bugs_detected: ['Button overlaps text', 'Missing icon'], visual_quality: 'degraded', annotation_text: 'Bug found' },
      ],
      summary: 'Bugs found.', bugs_found: 2,
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateDocs({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/DEMO.md',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const md = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(md).toContain('## Bugs Detected');
    expect(md).toContain('Button overlaps text');
    expect(md).toContain('Missing icon');
    expect(md).toContain('**2** bug(s)');
  });

  it('includes timeline table', async () => {
    const report = {
      project: 'test', scenario: 'demo',
      timestamp: '2026-04-11T15:00:00Z', duration_seconds: 5,
      total_frames_analyzed: 2, overall_status: 'ok',
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'Start', feature_being_demonstrated: 'Init', bugs_detected: [], visual_quality: 'good', annotation_text: 'Starting up' },
        { index: 1, timestamp: '0:03', status: 'warning', description: 'Warning', feature_being_demonstrated: 'Run', bugs_detected: [], visual_quality: 'good', annotation_text: 'Caution' },
      ],
      summary: 'Done.', bugs_found: 0,
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateDocs({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/DEMO.md',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const md = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(md).toContain('## Timeline');
    expect(md).toContain('| 0:00 | ✅ | Starting up |');
    expect(md).toContain('| 0:03 | ⚠️ | Caution |');
  });

  it('throws when report file is missing', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT') as never);

    await expect(
      generateDocs({
        reportPath: '/tmp/missing.json',
        outputPath: '/tmp/DEMO.md',
        projectName: 'test',
        scenarioName: 'demo',
      }),
    ).rejects.toThrow('Failed to read report');
  });

  it('includes screenshot references when enabled', async () => {
    const report = {
      project: 'test', scenario: 'demo',
      timestamp: '2026-04-11T15:00:00Z', duration_seconds: 5,
      total_frames_analyzed: 1, overall_status: 'ok',
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'Start', feature_being_demonstrated: 'Init', bugs_detected: [], visual_quality: 'good', annotation_text: 'Starting' },
      ],
      summary: 'Done.', bugs_found: 0,
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateDocs({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/DEMO.md',
      projectName: 'test',
      scenarioName: 'demo',
      includeScreenshots: true,
      framesDir: 'frames',
    });

    const md = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(md).toContain('![Frame 0](frames/frame-000.png)');
  });

  it('formats duration with minutes and seconds', async () => {
    const report = {
      project: 'test', scenario: 'demo',
      timestamp: '2026-04-11T15:00:00Z', duration_seconds: 125,
      total_frames_analyzed: 0, overall_status: 'ok',
      frames: [], summary: 'Done.', bugs_found: 0,
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateDocs({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/DEMO.md',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const md = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(md).toContain('2m 5s');
  });
});
