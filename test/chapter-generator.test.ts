import { describe, it, expect } from 'vitest';
import { generateChapters, generateTableOfContents, renderTocMarkdown, renderChaptersHtml } from '../src/pipeline/chapter-generator.js';
import type { ReportFrame } from '../src/pipeline/regression.js';

function makeFrame(overrides: Partial<ReportFrame> & { index: number; timestamp: string }): ReportFrame {
  return {
    status: 'ok',
    description: `Frame ${overrides.index}`,
    feature_being_demonstrated: 'General',
    bugs_detected: [],
    visual_quality: 'good',
    annotation_text: `Caption ${overrides.index}`,
    ...overrides,
  };
}

describe('generateChapters', () => {
  it('returns empty array for empty frames', () => {
    expect(generateChapters([])).toEqual([]);
  });

  it('creates a single chapter when all frames share a feature', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'Startup' }),
      makeFrame({ index: 1, timestamp: '0:03', feature_being_demonstrated: 'Startup' }),
      makeFrame({ index: 2, timestamp: '0:06', feature_being_demonstrated: 'Startup' }),
    ];

    const chapters = generateChapters(frames);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Startup');
    expect(chapters[0].frameCount).toBe(3);
    expect(chapters[0].startTime).toBe('0:00');
  });

  it('creates multiple chapters on feature transitions', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'Startup' }),
      makeFrame({ index: 1, timestamp: '0:03', feature_being_demonstrated: 'Startup' }),
      makeFrame({ index: 2, timestamp: '0:06', feature_being_demonstrated: 'Navigation' }),
      makeFrame({ index: 3, timestamp: '0:09', feature_being_demonstrated: 'Navigation' }),
      makeFrame({ index: 4, timestamp: '0:12', feature_being_demonstrated: 'Settings' }),
    ];

    const chapters = generateChapters(frames);
    expect(chapters).toHaveLength(3);
    expect(chapters[0].title).toBe('Startup');
    expect(chapters[0].frameCount).toBe(2);
    expect(chapters[1].title).toBe('Navigation');
    expect(chapters[1].frameCount).toBe(2);
    expect(chapters[1].startTime).toBe('0:06');
    expect(chapters[2].title).toBe('Settings');
    expect(chapters[2].frameCount).toBe(1);
  });

  it('uses worst status within a chapter', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'Feature', status: 'ok' }),
      makeFrame({ index: 1, timestamp: '0:03', feature_being_demonstrated: 'Feature', status: 'warning' }),
      makeFrame({ index: 2, timestamp: '0:06', feature_being_demonstrated: 'Feature', status: 'ok' }),
    ];

    const chapters = generateChapters(frames);
    expect(chapters[0].status).toBe('warning');
  });

  it('handles single frame as a chapter', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'Only' }),
    ];

    const chapters = generateChapters(frames);
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe('Only');
    expect(chapters[0].frameCount).toBe(1);
  });

  it('uses "Introduction" for empty feature name in first frame', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: '' }),
      makeFrame({ index: 1, timestamp: '0:03', feature_being_demonstrated: 'Feature A' }),
    ];

    const chapters = generateChapters(frames);
    expect(chapters[0].title).toBe('Introduction');
    expect(chapters[1].title).toBe('Feature A');
  });
});

describe('generateTableOfContents', () => {
  it('creates TOC with correct end times', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'Intro' }),
      makeFrame({ index: 1, timestamp: '0:10', feature_being_demonstrated: 'Main' }),
      makeFrame({ index: 2, timestamp: '0:20', feature_being_demonstrated: 'Conclusion' }),
    ];

    const toc = generateTableOfContents('Project', 'Demo', frames, 30);
    expect(toc.projectName).toBe('Project');
    expect(toc.chapters).toHaveLength(3);
    expect(toc.chapters[0].endTime).toBe('0:10');
    expect(toc.chapters[1].endTime).toBe('0:20');
    expect(toc.chapters[2].endTime).toBe('0:30');
    expect(toc.chapters[2].endSeconds).toBe(30);
  });

  it('handles single chapter', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'All' }),
    ];

    const toc = generateTableOfContents('P', 'S', frames, 15);
    expect(toc.chapters).toHaveLength(1);
    expect(toc.chapters[0].endSeconds).toBe(15);
  });
});

describe('renderTocMarkdown', () => {
  it('renders markdown table of contents', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'Intro', annotation_text: 'Welcome' }),
      makeFrame({ index: 1, timestamp: '0:15', feature_being_demonstrated: 'Demo', annotation_text: 'Showing features' }),
    ];

    const toc = generateTableOfContents('MyProject', 'Basic', frames, 30);
    const md = renderTocMarkdown(toc);

    expect(md).toContain('## Table of Contents');
    expect(md).toContain('**MyProject**');
    expect(md).toContain('**Intro**');
    expect(md).toContain('**Demo**');
    expect(md).toContain('Welcome');
    expect(md).toContain('0:30');
  });

  it('includes status icons', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'OK', status: 'ok' }),
      makeFrame({ index: 1, timestamp: '0:10', feature_being_demonstrated: 'Warn', status: 'warning' }),
      makeFrame({ index: 2, timestamp: '0:20', feature_being_demonstrated: 'Err', status: 'error' }),
    ];

    const toc = generateTableOfContents('P', 'S', frames, 30);
    const md = renderTocMarkdown(toc);

    expect(md).toContain('✅');
    expect(md).toContain('⚠️');
    expect(md).toContain('❌');
  });
});

describe('renderChaptersHtml', () => {
  it('returns empty string for no chapters', () => {
    expect(renderChaptersHtml([])).toBe('');
  });

  it('renders HTML chapter elements', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: 'Startup' }),
      makeFrame({ index: 1, timestamp: '0:10', feature_being_demonstrated: 'Usage' }),
    ];

    const chapters = generateChapters(frames);
    const html = renderChaptersHtml(chapters);

    expect(html).toContain('chapters-list');
    expect(html).toContain('Startup');
    expect(html).toContain('Usage');
    expect(html).toContain('data-start="0"');
    expect(html).toContain('data-start="10"');
  });

  it('escapes HTML in chapter titles', () => {
    const frames = [
      makeFrame({ index: 0, timestamp: '0:00', feature_being_demonstrated: '<script>alert(1)</script>' }),
    ];

    const chapters = generateChapters(frames);
    const html = renderChaptersHtml(chapters);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
