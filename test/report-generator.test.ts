import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as any;
  return {
    ...orig,
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

const { generateReport } = await import('../src/pipeline/report-generator.js');
const { readFile, writeFile } = await import('node:fs/promises');

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    project: 'test-project',
    scenario: 'basic-demo',
    timestamp: '2026-04-11T15:00:00Z',
    duration_seconds: 12.5,
    total_frames_analyzed: 3,
    overall_status: 'ok',
    frames: [
      { index: 0, timestamp: '0:00', status: 'ok', description: 'App starts', feature_being_demonstrated: 'Startup', bugs_detected: [], visual_quality: 'good', annotation_text: 'Starting' },
      { index: 1, timestamp: '0:04', status: 'ok', description: 'Menu shows', feature_being_demonstrated: 'Navigation', bugs_detected: [], visual_quality: 'good', annotation_text: 'Menu' },
      { index: 2, timestamp: '0:08', status: 'ok', description: 'Output rendered', feature_being_demonstrated: 'Rendering', bugs_detected: [], visual_quality: 'good', annotation_text: 'Done' },
    ],
    summary: 'A clean recording with no issues.',
    bugs_found: 0,
    ...overrides,
  };
}

describe('generateReport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readFile).mockResolvedValue('' as never);
    vi.mocked(writeFile).mockResolvedValue(undefined as never);
  });

  it('generates HTML report with title and metrics', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    const result = await generateReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/report.html',
      projectName: 'test-project',
      scenarioName: 'basic-demo',
    });

    expect(result).toBe('/tmp/report.html');
    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('test-project');
    expect(html).toContain('basic-demo');
    expect(html).toContain('OK');
    expect(html).toContain('12s');
  });

  it('displays frame analysis table', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    await generateReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/report.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('Frame Analysis');
    expect(html).toContain('Startup');
    expect(html).toContain('Navigation');
    expect(html).toContain('Rendering');
    expect(html).toContain('0:00');
    expect(html).toContain('0:04');
  });

  it('displays bugs when present', async () => {
    const report = makeReport({
      bugs_found: 2,
      overall_status: 'warning',
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'OK', feature_being_demonstrated: 'Start', bugs_detected: [], visual_quality: 'good', annotation_text: 'OK' },
        { index: 1, timestamp: '0:05', status: 'warning', description: 'Bug', feature_being_demonstrated: 'Run', bugs_detected: ['Text overflow', 'Missing border'], visual_quality: 'degraded', annotation_text: 'Issue' },
      ],
    });
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/report.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('Bugs Detected');
    expect(html).toContain('Text overflow');
    expect(html).toContain('Missing border');
  });

  it('omits bug section when no bugs', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    await generateReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/report.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).not.toContain('Bugs Detected');
  });

  it('shows quality metrics', async () => {
    const report = makeReport({
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'OK', feature_being_demonstrated: 'A', bugs_detected: [], visual_quality: 'good', annotation_text: 'OK' },
        { index: 1, timestamp: '0:03', status: 'ok', description: 'OK', feature_being_demonstrated: 'A', bugs_detected: [], visual_quality: 'degraded', annotation_text: 'OK' },
        { index: 2, timestamp: '0:06', status: 'ok', description: 'OK', feature_being_demonstrated: 'B', bugs_detected: [], visual_quality: 'good', annotation_text: 'OK' },
        { index: 3, timestamp: '0:09', status: 'ok', description: 'OK', feature_being_demonstrated: 'C', bugs_detected: [], visual_quality: 'broken', annotation_text: 'OK' },
      ],
    });
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/report.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    // 2/4 good = 50%
    expect(html).toContain('50%');
    // 3 features: A, B, C
    expect(html).toContain('>3<');
  });

  it('handles empty frames gracefully', async () => {
    const report = makeReport({ frames: [], total_frames_analyzed: 0 });
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/report.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('100%'); // 100% quality with no frames
    expect(html).not.toContain('Frame Analysis');
  });

  it('throws when report is missing', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT') as never);

    await expect(
      generateReport({
        reportPath: '/tmp/missing.json',
        outputPath: '/tmp/report.html',
        projectName: 'test',
        scenarioName: 'demo',
      }),
    ).rejects.toThrow('Failed to read report');
  });

  it('escapes HTML in project and scenario names', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    await generateReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/report.html',
      projectName: '<script>alert(1)</script>',
      scenarioName: 'test&more',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('test&amp;more');
  });
});
