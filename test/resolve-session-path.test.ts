import { describe, it, expect } from 'vitest';
import { resolveSessionPath } from '../src/cli-utils.js';

describe('resolveSessionPath', () => {
  const outputDir = '/project/.demo-recordings';

  it('returns path as-is when no prefix matches', () => {
    expect(resolveSessionPath(outputDir, '2026-04-11_08-00')).toBe('2026-04-11_08-00');
  });

  it('returns nested path as-is when no prefix matches', () => {
    expect(resolveSessionPath(outputDir, '2026-04-11_08-00/basic-navigation')).toBe('2026-04-11_08-00/basic-navigation');
  });

  it('strips relative output dir prefix', () => {
    expect(resolveSessionPath(outputDir, '.demo-recordings/2026-04-11_08-00/basic')).toBe('2026-04-11_08-00/basic');
  });

  it('strips ./ prefixed output dir', () => {
    expect(resolveSessionPath(outputDir, './.demo-recordings/2026-04-11_08-00/basic')).toBe('2026-04-11_08-00/basic');
  });

  it('strips absolute path containing output dir', () => {
    expect(resolveSessionPath(outputDir, '/project/.demo-recordings/2026-04-11_08-00')).toBe('2026-04-11_08-00');
  });

  it('handles trailing slashes in user path', () => {
    expect(resolveSessionPath(outputDir, '.demo-recordings/2026-04-11_08-00/')).toBe('2026-04-11_08-00');
  });

  it('does not strip partial directory name matches', () => {
    // e.g., ".demo-recordings-old/..." should NOT be stripped
    expect(resolveSessionPath(outputDir, '.demo-recordings-old/2026-04-11_08-00')).toBe('.demo-recordings-old/2026-04-11_08-00');
  });

  it('handles session-only timestamps (no scenario suffix)', () => {
    expect(resolveSessionPath(outputDir, '.demo-recordings/2026-04-11_08-00')).toBe('2026-04-11_08-00');
  });

  it('works with custom output dir names', () => {
    const customDir = '/project/recordings';
    expect(resolveSessionPath(customDir, 'recordings/2026-04-11_08-00/basic')).toBe('2026-04-11_08-00/basic');
  });

  it('handles deeply nested absolute paths', () => {
    expect(resolveSessionPath(outputDir, '/home/user/project/.demo-recordings/2026-04-11_08-00/basic')).toBe('2026-04-11_08-00/basic');
  });
});
