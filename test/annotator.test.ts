import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'ok',
                description: 'TUI showing file list',
                feature_being_demonstrated: 'file navigation',
                bugs_detected: [],
                visual_quality: 'good',
                annotation_text: 'File navigation active',
              }),
            },
          ],
        }),
      },
    })),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...original,
    readFile: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
  };
});

const { annotateFrames } = await import('../src/pipeline/annotator.js');

describe('annotateFrames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-key');
  });

  it('analyzes frames and returns annotation result', async () => {
    const result = await annotateFrames(
      '/tmp/frames',
      2,
      'test-project',
      'A test project',
      'Basic scenario',
      {
        enabled: true,
        model: 'claude-sonnet-4-6',
        extract_fps: 1,
        language: 'en',
        overlay_position: 'bottom',
        overlay_font_size: 14,
      },
    );

    expect(result.frames).toHaveLength(2);
    expect(result.overall_status).toBe('ok');
    expect(result.bugs_found).toBe(0);
    expect(result.frames[0].annotation_text).toBe('File navigation active');
    expect(result.summary).toContain('Analyzed 2 frames');
  });

  it('handles failed JSON parse gracefully', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'not valid json' }],
        }),
      },
    }) as any);

    const result = await annotateFrames(
      '/tmp/frames',
      1,
      'test',
      'desc',
      'scenario',
      {
        enabled: true,
        model: 'claude-sonnet-4-6',
        extract_fps: 1,
        language: 'en',
        overlay_position: 'bottom',
        overlay_font_size: 14,
      },
    );

    expect(result.frames[0].status).toBe('warning');
    expect(result.frames[0].description).toBe('Failed to parse AI response');
  });

  it('throws without ANTHROPIC_API_KEY', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');

    await expect(
      annotateFrames('/tmp/frames', 1, 'test', 'desc', 'scenario', {
        enabled: true,
        model: 'claude-sonnet-4-6',
        extract_fps: 1,
        language: 'en',
        overlay_position: 'bottom',
        overlay_font_size: 14,
      }),
    ).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('calculates timestamp correctly with extract_fps=2', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const createMock = vi.fn().mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'ok',
          description: 'frame',
          feature_being_demonstrated: 'test',
          bugs_detected: [],
          visual_quality: 'good',
          annotation_text: 'test',
        }),
      }],
    });
    vi.mocked(Anthropic).mockImplementation(() => ({
      messages: { create: createMock },
    }) as any);

    const result = await annotateFrames(
      '/tmp/frames',
      3,
      'test',
      'desc',
      'scenario',
      {
        enabled: true,
        model: 'claude-sonnet-4-6',
        extract_fps: 2,
        language: 'en',
        overlay_position: 'bottom',
        overlay_font_size: 14,
      },
    );

    // Frame 1: (1-1)/2 = 0s → "0:00"
    // Frame 2: (2-1)/2 = 0.5s → "0:00"
    // Frame 3: (3-1)/2 = 1s → "0:01"
    expect(result.frames[0].timestamp).toBe('0:00');
    expect(result.frames[2].timestamp).toBe('0:01');
  });
});
