import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runHealthCheck, formatHealthCheck } from '../src/pipeline/health-check.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn((...args: any[]) => {
    const cb = args[args.length - 1];
    if (typeof cb === 'function') {
      const command = args[0] as string;
      if (command === 'npm') {
        cb(null, { stdout: '10.5.0\n', stderr: '' });
      } else if (command === 'vhs') {
        cb(null, { stdout: 'vhs 0.7.1\n', stderr: '' });
      } else if (command === 'ffmpeg') {
        cb(null, { stdout: 'ffmpeg version 6.1.1\n', stderr: '' });
      } else {
        cb(new Error(`Command not found: ${command}`));
      }
    }
  }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (path.includes('demo-recorder.yaml')) return true;
    if (path.includes('.demo-recordings')) return false;
    return false;
  }),
}));

describe('runHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks Node.js availability', async () => {
    const result = await runHealthCheck('/tmp/project', 'vhs');
    const nodeCheck = result.items.find((i) => i.name === 'Node.js');
    expect(nodeCheck).toBeDefined();
    expect(nodeCheck!.status).toBe('ok');
    expect(nodeCheck!.version).toBe(process.version);
  });

  it('checks npm availability', async () => {
    const result = await runHealthCheck('/tmp/project', 'vhs');
    const npmCheck = result.items.find((i) => i.name === 'npm');
    expect(npmCheck).toBeDefined();
    expect(npmCheck!.status).toBe('ok');
  });

  it('checks VHS for vhs backend', async () => {
    const result = await runHealthCheck('/tmp/project', 'vhs');
    const vhsCheck = result.items.find((i) => i.name === 'vhs');
    expect(vhsCheck).toBeDefined();
    expect(vhsCheck!.status).toBe('ok');
  });

  it('checks config file existence', async () => {
    const result = await runHealthCheck('/tmp/project', 'vhs');
    const configCheck = result.items.find((i) => i.name === 'Config file');
    expect(configCheck).toBeDefined();
    expect(configCheck!.status).toBe('ok');
  });

  it('warns about missing ANTHROPIC_API_KEY', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await runHealthCheck('/tmp/project', 'vhs');
    const apiKeyCheck = result.items.find((i) => i.name === 'ANTHROPIC_API_KEY');
    expect(apiKeyCheck).toBeDefined();
    expect(apiKeyCheck!.status).toBe('warning');

    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('computes allPassed correctly', async () => {
    const result = await runHealthCheck('/tmp/project', 'vhs');
    // No errors expected with our mocks
    expect(result.allPassed).toBe(true);
  });

  it('counts warnings and errors', async () => {
    const result = await runHealthCheck('/tmp/project', 'vhs');
    expect(typeof result.warnings).toBe('number');
    expect(typeof result.errors).toBe('number');
    expect(result.errors).toBe(0);
  });
});

describe('formatHealthCheck', () => {
  it('shows all-passed message when no errors', () => {
    const report = formatHealthCheck({
      items: [{ name: 'Node.js', status: 'ok', message: 'detected' }],
      allPassed: true,
      warnings: 0,
      errors: 0,
    });
    expect(report).toContain('All checks passed');
    expect(report).toContain('✓');
  });

  it('shows error count when errors exist', () => {
    const report = formatHealthCheck({
      items: [{ name: 'vhs', status: 'error', message: 'not found' }],
      allPassed: false,
      warnings: 0,
      errors: 1,
    });
    expect(report).toContain('1 error');
    expect(report).toContain('✗');
  });

  it('shows warning count', () => {
    const report = formatHealthCheck({
      items: [{ name: 'API Key', status: 'warning', message: 'not set' }],
      allPassed: true,
      warnings: 1,
      errors: 0,
    });
    expect(report).toContain('1 warning');
    expect(report).toContain('⚠');
  });
});
