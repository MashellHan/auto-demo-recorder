import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as any;
  return {
    ...orig,
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

const { generatePlayer } = await import('../src/pipeline/player-generator.js');
const { readFile, writeFile } = await import('node:fs/promises');

describe('generatePlayer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset default: readFile returns empty string, writeFile succeeds
    vi.mocked(readFile).mockResolvedValue('' as never);
    vi.mocked(writeFile).mockResolvedValue(undefined as never);
  });

  it('generates an HTML file with video and controls', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(Buffer.from('fakevideo') as never);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
      project: 'test',
      scenario: 'demo',
      frames: [],
    }) as never);

    const result = await generatePlayer({
      videoPath: '/tmp/recording/raw.mp4',
      reportPath: '/tmp/recording/report.json',
      outputPath: '/tmp/recording/player.html',
      projectName: 'test-project',
      scenarioName: 'demo-scenario',
    });

    expect(result).toBe('/tmp/recording/player.html');
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/recording/player.html',
      expect.stringContaining('<!DOCTYPE html>'),
      'utf-8',
    );

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('test-project');
    expect(html).toContain('demo-scenario');
    expect(html).toContain('<video');
    expect(html).toContain('playBtn');
    expect(html).toContain('speedBtn');
  });

  it('embeds video as base64 when embedVideo is true', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(Buffer.from('fakevideo') as never);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ frames: [] }) as never);

    await generatePlayer({
      videoPath: '/tmp/raw.mp4',
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/player.html',
      projectName: 'test',
      scenarioName: 'demo',
      embedVideo: true,
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('data:video/mp4;base64,');
  });

  it('uses relative path when embedVideo is false', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ frames: [] }) as never);

    await generatePlayer({
      videoPath: '/tmp/recording/raw.mp4',
      reportPath: '/tmp/recording/report.json',
      outputPath: '/tmp/recording/player.html',
      projectName: 'test',
      scenarioName: 'demo',
      embedVideo: false,
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('raw.mp4');
    expect(html).not.toContain('data:video');
  });

  it('includes annotation data in player', async () => {
    const frames = [
      { index: 0, timestamp: '0:00', status: 'ok', annotation_text: 'Starting up' },
      { index: 1, timestamp: '0:05', status: 'ok', annotation_text: 'Navigation' },
    ];
    const reportJson = JSON.stringify({ project: 'test', scenario: 'demo', frames });
    // embedVideo defaults to false, so only readFile call is for the report
    vi.mocked(readFile).mockResolvedValueOnce(reportJson as never);

    await generatePlayer({
      videoPath: '/tmp/raw.mp4',
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/player.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('Starting up');
    expect(html).toContain('Navigation');
  });

  it('handles missing report gracefully', async () => {
    vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'));

    await generatePlayer({
      videoPath: '/tmp/raw.mp4',
      reportPath: '/tmp/nonexistent.json',
      outputPath: '/tmp/player.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('<!DOCTYPE html>');
    // Should still generate HTML, just without annotations
    expect(html).toMatch(/annotations\s*=\s*\[\]/);
  });

  it('escapes HTML in project and scenario names', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ frames: [] }) as never);

    await generatePlayer({
      videoPath: '/tmp/raw.mp4',
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/player.html',
      projectName: 'test<script>alert(1)</script>',
      scenarioName: 'demo&more',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('demo&amp;more');
  });

  it('handles webm video format', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({ frames: [] }) as never);

    await generatePlayer({
      videoPath: '/tmp/raw.webm',
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/player.html',
      projectName: 'test',
      scenarioName: 'demo',
    });

    const html = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(html).toContain('video/webm');
  });
});
