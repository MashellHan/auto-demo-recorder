import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', async (importOriginal) => {
  const orig = await importOriginal() as any;
  return {
    ...orig,
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

const { generateSvg, generateSvgFromReport } = await import('../src/pipeline/svg-generator.js');
const { writeFile, readFile } = await import('node:fs/promises');

describe('generateSvg', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(writeFile).mockResolvedValue(undefined as never);
    vi.mocked(readFile).mockResolvedValue('' as never);
  });

  it('generates valid SVG with terminal content', async () => {
    const result = await generateSvg({
      outputPath: '/tmp/test.svg',
      width: 80,
      height: 24,
      lines: ['$ echo hello', 'hello'],
    });

    expect(result).toBe('/tmp/test.svg');
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/test.svg',
      expect.stringContaining('<svg'),
      'utf-8',
    );

    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('echo hello');
    expect(svg).toContain('</svg>');
  });

  it('includes title bar when title is provided', async () => {
    await generateSvg({
      outputPath: '/tmp/test.svg',
      width: 80,
      height: 24,
      lines: ['content'],
      title: 'My Terminal',
    });

    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).toContain('My Terminal');
    // macOS-style traffic light dots
    expect(svg).toContain('#ff5f57');
    expect(svg).toContain('#febc2e');
    expect(svg).toContain('#28c840');
  });

  it('omits title bar when no title', async () => {
    await generateSvg({
      outputPath: '/tmp/test.svg',
      width: 80,
      height: 24,
      lines: ['content'],
    });

    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).not.toContain('#ff5f57');
  });

  it('escapes XML special characters', async () => {
    await generateSvg({
      outputPath: '/tmp/test.svg',
      width: 80,
      height: 24,
      lines: ['<script>alert("xss")</script>', 'a & b > c'],
      title: 'Test <& >',
    });

    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('a &amp; b &gt; c');
    expect(svg).toContain('Test &lt;&amp; &gt;');
  });

  it('applies custom theme colors', async () => {
    await generateSvg({
      outputPath: '/tmp/test.svg',
      width: 80,
      height: 24,
      lines: ['test'],
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        titleBar: '#333333',
        titleText: '#cccccc',
      },
    });

    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).toContain('#000000');
    expect(svg).toContain('#ffffff');
  });

  it('uses monospace font family', async () => {
    await generateSvg({
      outputPath: '/tmp/test.svg',
      width: 80,
      height: 24,
      lines: ['test'],
    });

    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).toContain('monospace');
  });
});

describe('generateSvgFromReport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(writeFile).mockResolvedValue(undefined as never);
    vi.mocked(readFile).mockResolvedValue('' as never);
  });

  it('generates SVG from report frames', async () => {
    const report = {
      project: 'test-project',
      scenario: 'demo',
      frames: [
        { timestamp: '0:00', status: 'ok', annotation_text: 'Starting up' },
        { timestamp: '0:05', status: 'warning', annotation_text: 'Processing' },
      ],
      summary: 'Done.',
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    const result = await generateSvgFromReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/recording.svg',
    });

    expect(result).toBe('/tmp/recording.svg');
    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).toContain('Starting up');
    expect(svg).toContain('Processing');
    expect(svg).toContain('test-project');
  });

  it('generates fallback SVG for empty report', async () => {
    const report = {
      project: 'test',
      scenario: 'demo',
      frames: [],
      summary: 'Recording complete.',
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateSvgFromReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/recording.svg',
    });

    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).toContain('Recording complete.');
  });

  it('uses custom title when provided', async () => {
    const report = {
      project: 'test', scenario: 'demo',
      frames: [], summary: 'Done.',
    };
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(report) as never);

    await generateSvgFromReport({
      reportPath: '/tmp/report.json',
      outputPath: '/tmp/recording.svg',
      title: 'Custom Title',
    });

    const svg = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(svg).toContain('Custom Title');
  });
});
