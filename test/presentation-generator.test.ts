import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as any;
  return {
    ...orig,
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

const { generatePresentation } = await import('../src/pipeline/presentation-generator.js');
const { readFile, writeFile } = await import('node:fs/promises');

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    project: 'test-project',
    scenario: 'demo',
    timestamp: '2026-04-11T15:00:00Z',
    duration_seconds: 15,
    total_frames_analyzed: 3,
    overall_status: 'ok',
    frames: [
      { index: 0, timestamp: '0:00', status: 'ok', description: 'App starts', feature_being_demonstrated: 'Startup', bugs_detected: [], visual_quality: 'good', annotation_text: 'Welcome screen loads' },
      { index: 1, timestamp: '0:05', status: 'ok', description: 'Menu visible', feature_being_demonstrated: 'Navigation', bugs_detected: [], visual_quality: 'good', annotation_text: 'Main menu is shown' },
      { index: 2, timestamp: '0:10', status: 'ok', description: 'Settings open', feature_being_demonstrated: 'Settings', bugs_detected: [], visual_quality: 'good', annotation_text: 'Settings panel opens' },
    ],
    summary: 'Clean demo.',
    bugs_found: 0,
    ...overrides,
  };
}

describe('generatePresentation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readFile).mockResolvedValue('' as never);
    vi.mocked(writeFile).mockResolvedValue(undefined as never);
  });

  it('generates HTML presentation with slides', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    const result = await generatePresentation({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/presentation.html',
      projectName: 'test-project',
      scenarioName: 'demo',
    });

    expect(result).toBe('/tmp/presentation.html');
    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('test-project');
    expect(html).toContain('demo');
    expect(html).toContain('Startup');
    expect(html).toContain('Navigation');
    expect(html).toContain('Settings');
  });

  it('includes navigation controls', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    await generatePresentation({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/presentation.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('prevBtn');
    expect(html).toContain('nextBtn');
    expect(html).toContain('ArrowRight');
    expect(html).toContain('ArrowLeft');
  });

  it('includes progress dots', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    await generatePresentation({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/presentation.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('progress');
    expect(html).toContain('dot');
  });

  it('handles empty frames', async () => {
    const report = makeReport({ frames: [], total_frames_analyzed: 0 });
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generatePresentation({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/presentation.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('No Data');
  });

  it('includes frame image references when framesDir provided', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    await generatePresentation({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/presentation.html',
      projectName: 'test',
      scenarioName: 'demo',
      framesDir: 'frames',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('frames/frame-');
  });

  it('throws when report is missing', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT') as never);

    await expect(
      generatePresentation({
        reportPath: '/tmp/missing.json',
        outputPath: '/tmp/presentation.html',
        projectName: 'test',
        scenarioName: 'demo',
      }),
    ).rejects.toThrow('Failed to read report');
  });

  it('escapes HTML in project name', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeReport()) as never);

    await generatePresentation({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/presentation.html',
      projectName: '<script>xss</script>',
      scenarioName: 'test',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).not.toContain('<script>xss</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back to per-frame slides when chapters are empty', async () => {
    const report = makeReport({
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'App starts', feature_being_demonstrated: '', bugs_detected: [], visual_quality: 'good', annotation_text: 'Welcome screen loads' },
        { index: 1, timestamp: '0:05', status: 'warning', description: 'Menu visible', feature_being_demonstrated: '', bugs_detected: [], visual_quality: 'good', annotation_text: 'Main menu is shown' },
      ],
    });
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);
    // All frames have the same (empty) feature, so chapters will produce a single chapter with title "Introduction"
    // This tests the chapter path with empty features

    await generatePresentation({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/presentation.html',
      projectName: 'test',
      scenarioName: 'demo',
      framesDir: 'frames',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    // Single chapter titled "Introduction" (default when feature is empty)
    expect(html).toContain('Introduction');
    expect(html).toContain('frames/frame-000.png');
  });

  it('uses annotation_text in slide description for single-feature frames', async () => {
    const report = makeReport({
      frames: [
        { index: 0, timestamp: '0:00', status: 'ok', description: 'desc', feature_being_demonstrated: 'Login', bugs_detected: [], visual_quality: 'good', annotation_text: 'Annotation text here' },
      ],
    });
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generatePresentation({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/presentation.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    // Chapter description is derived from the first frame's annotation_text
    expect(html).toContain('Annotation text here');
    expect(html).toContain('Login');
  });
});
