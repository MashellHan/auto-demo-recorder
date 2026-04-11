import { describe, it, expect } from 'vitest';
import { interpolateConfig, listConfigVariables, formatInterpolationResult } from '../src/config/interpolation.js';

describe('interpolateConfig', () => {
  it('substitutes ${VAR} from env', () => {
    const config = { project: { name: '${APP_NAME}' } };
    const env = { APP_NAME: 'my-app' };
    const result = interpolateConfig(config, env);
    expect((result.config.project as Record<string, unknown>).name).toBe('my-app');
    expect(result.resolved).toContain('APP_NAME');
  });

  it('supports ${VAR:-default} syntax', () => {
    const config = { project: { name: '${APP_NAME:-fallback}' } };
    const result = interpolateConfig(config, {});
    expect((result.config.project as Record<string, unknown>).name).toBe('fallback');
    expect(result.defaults).toContain('APP_NAME');
  });

  it('prefers env over default', () => {
    const config = { project: { name: '${APP_NAME:-fallback}' } };
    const env = { APP_NAME: 'real-value' };
    const result = interpolateConfig(config, env);
    expect((result.config.project as Record<string, unknown>).name).toBe('real-value');
    expect(result.resolved).toContain('APP_NAME');
    expect(result.defaults).not.toContain('APP_NAME');
  });

  it('throws on missing variable in strict mode', () => {
    const config = { project: { name: '${MISSING_VAR}' } };
    expect(() => interpolateConfig(config, {}, true)).toThrow('Missing environment variable: MISSING_VAR');
  });

  it('leaves placeholder intact in non-strict mode', () => {
    const config = { project: { name: '${MISSING_VAR}' } };
    const result = interpolateConfig(config, {}, false);
    expect((result.config.project as Record<string, unknown>).name).toBe('${MISSING_VAR}');
    expect(result.missing).toContain('MISSING_VAR');
  });

  it('interpolates multiple variables in one string', () => {
    const config = { url: '${PROTOCOL}://${HOST}:${PORT:-3000}' };
    const env = { PROTOCOL: 'https', HOST: 'example.com' };
    const result = interpolateConfig(config, env);
    expect(result.config.url).toBe('https://example.com:3000');
  });

  it('recursively interpolates nested objects', () => {
    const config = {
      a: {
        b: {
          c: '${DEEP_VAR}',
        },
      },
    };
    const env = { DEEP_VAR: 'found' };
    const result = interpolateConfig(config, env);
    const a = result.config.a as Record<string, unknown>;
    const b = a.b as Record<string, unknown>;
    expect(b.c).toBe('found');
  });

  it('interpolates arrays', () => {
    const config = { tags: ['${TAG1}', '${TAG2}'] };
    const env = { TAG1: 'smoke', TAG2: 'regression' };
    const result = interpolateConfig(config, env);
    expect(result.config.tags).toEqual(['smoke', 'regression']);
  });

  it('leaves non-string values untouched', () => {
    const config = { count: 42, enabled: true, data: null };
    const result = interpolateConfig(config, {});
    expect(result.config.count).toBe(42);
    expect(result.config.enabled).toBe(true);
    expect(result.config.data).toBeNull();
  });

  it('does not mutate original config', () => {
    const config = { name: '${VAR}' };
    const original = JSON.parse(JSON.stringify(config));
    interpolateConfig(config, { VAR: 'value' });
    expect(config).toEqual(original);
  });

  it('deduplicates resolved variable names', () => {
    const config = { a: '${VAR}', b: '${VAR}' };
    const result = interpolateConfig(config, { VAR: 'x' });
    expect(result.resolved.length).toBe(1);
  });
});

describe('listConfigVariables', () => {
  it('lists all variable references', () => {
    const config = {
      name: '${A}',
      nested: { value: '${B:-default}' },
      tags: ['${C}'],
    };
    const vars = listConfigVariables(config);
    expect(vars).toEqual(['A', 'B', 'C']);
  });

  it('returns empty for no variables', () => {
    const config = { name: 'static', count: 42 };
    expect(listConfigVariables(config)).toEqual([]);
  });

  it('deduplicates variables', () => {
    const config = { a: '${X}', b: '${X}' };
    expect(listConfigVariables(config)).toEqual(['X']);
  });
});

describe('formatInterpolationResult', () => {
  it('formats no variables', () => {
    const result = interpolateConfig({ name: 'static' }, {});
    const text = formatInterpolationResult(result);
    expect(text).toContain('No variables');
  });

  it('formats resolved variables', () => {
    const result = interpolateConfig({ name: '${VAR}' }, { VAR: 'val' });
    const text = formatInterpolationResult(result);
    expect(text).toContain('Resolved');
    expect(text).toContain('VAR');
  });

  it('formats defaults', () => {
    const result = interpolateConfig({ name: '${VAR:-default}' }, {});
    const text = formatInterpolationResult(result);
    expect(text).toContain('Using defaults');
    expect(text).toContain('VAR');
  });

  it('formats missing', () => {
    const result = interpolateConfig({ name: '${VAR}' }, {}, false);
    const text = formatInterpolationResult(result);
    expect(text).toContain('Missing');
    expect(text).toContain('VAR');
  });

  it('shows total count', () => {
    const result = interpolateConfig(
      { a: '${A}', b: '${B:-d}', c: '${C}' },
      { A: 'x' },
      false,
    );
    const text = formatInterpolationResult(result);
    expect(text).toContain('Total: 3 variables');
  });
});
