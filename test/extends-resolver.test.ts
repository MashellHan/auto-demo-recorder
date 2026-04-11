import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveExtendsChain, formatExtendsChain, validateExtends } from '../src/config/extends-resolver.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.includes('base.yaml')) {
      return 'project:\n  name: base\nscenarios: []';
    }
    if (path.includes('child.yaml')) {
      return 'extends: base.yaml\nproject:\n  name: child';
    }
    if (path.includes('circular-a.yaml')) {
      return 'extends: circular-b.yaml\nproject:\n  name: a';
    }
    if (path.includes('circular-b.yaml')) {
      return 'extends: circular-a.yaml\nproject:\n  name: b';
    }
    if (path.includes('standalone.yaml')) {
      return 'project:\n  name: standalone\nscenarios: []';
    }
    throw new Error(`Not found: ${path}`);
  }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (typeof path !== 'string') return false;
    if (path.includes('base.yaml')) return true;
    if (path.includes('child.yaml')) return true;
    if (path.includes('circular-a.yaml')) return true;
    if (path.includes('circular-b.yaml')) return true;
    if (path.includes('standalone.yaml')) return true;
    if (path.includes('missing.yaml')) return false;
    return false;
  }),
}));

describe('resolveExtendsChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves standalone config with no extends', async () => {
    const result = await resolveExtendsChain('/config/standalone.yaml');
    expect(result.valid).toBe(true);
    expect(result.chain).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('resolves a simple parent-child chain', async () => {
    const result = await resolveExtendsChain('/config/child.yaml');
    expect(result.valid).toBe(true);
    expect(result.chain).toHaveLength(2);
  });

  it('detects circular extends', async () => {
    const result = await resolveExtendsChain('/config/circular-a.yaml');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Circular');
  });

  it('detects missing config file', async () => {
    const result = await resolveExtendsChain('/config/missing.yaml');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });
});

describe('validateExtends', () => {
  it('returns empty errors for valid chain', async () => {
    const errors = await validateExtends('/config/standalone.yaml');
    expect(errors).toHaveLength(0);
  });

  it('returns errors for circular chain', async () => {
    const errors = await validateExtends('/config/circular-a.yaml');
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('formatExtendsChain', () => {
  it('shows standalone config message', () => {
    const output = formatExtendsChain({
      chain: ['/config/standalone.yaml'],
      errors: [],
      valid: true,
    });
    expect(output).toContain('No extends chain');
    expect(output).toContain('valid');
  });

  it('shows chain with tree format', () => {
    const output = formatExtendsChain({
      chain: ['/config/base.yaml', '/config/child.yaml'],
      errors: [],
      valid: true,
    });
    expect(output).toContain('base.yaml');
    expect(output).toContain('child.yaml');
  });

  it('shows errors', () => {
    const output = formatExtendsChain({
      chain: [],
      errors: ['File not found: missing.yaml'],
      valid: false,
    });
    expect(output).toContain('File not found');
    expect(output).toContain('✗');
  });
});
