import { describe, it, expect, vi } from 'vitest';
import { runPreflightChecks, formatPreflightReport } from '../src/config/preflight.js';
import { ConfigSchema } from '../src/config/schema.js';

vi.mock('../src/pipeline/health-check.js', () => ({
  runHealthCheck: vi.fn().mockResolvedValue({
    allPassed: true,
    items: [
      { name: 'vhs', status: 'ok', message: 'installed' },
      { name: 'ffmpeg', status: 'ok', message: 'installed' },
    ],
    warnings: 0,
    errors: 0,
  }),
}));

function makeConfig(overrides: Record<string, unknown> = {}): any {
  const base = ConfigSchema.parse({
    project: { name: 'test-project', description: 'test' },
    scenarios: [
      {
        name: 'basic',
        description: 'Basic scenario',
        steps: [{ action: 'type', value: 'echo hello' }],
      },
    ],
  });
  return { ...base, ...overrides };
}

describe('runPreflightChecks', () => {
  it('passes for a clean config', async () => {
    const config = makeConfig();
    const result = await runPreflightChecks(config, '/tmp');
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(3);
    expect(result.checks[0].name).toBe('Config Validation');
    expect(result.checks[1].name).toBe('Config Lint');
    expect(result.checks[2].name).toBe('Health Check');
  });

  it('reports validation failure for empty scenarios', async () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = await runPreflightChecks(config, '/tmp');
    expect(result.passed).toBe(false);
    // Validation should fail
    const validation = result.checks.find((c) => c.name === 'Config Validation');
    expect(validation!.passed).toBe(false);
    // Lint should also fail (no-scenarios rule)
    const lint = result.checks.find((c) => c.name === 'Config Lint');
    expect(lint!.passed).toBe(false);
  });

  it('reports lint warnings for high fps', async () => {
    const config = makeConfig();
    config.annotation = { ...config.annotation, extract_fps: 60 };
    const result = await runPreflightChecks(config, '/tmp');
    const lint = result.checks.find((c) => c.name === 'Config Lint');
    expect(lint!.details.some((d) => d.includes('high-fps'))).toBe(true);
  });

  it('tracks duration', async () => {
    const config = makeConfig();
    const result = await runPreflightChecks(config, '/tmp');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('counts total issues', async () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = await runPreflightChecks(config, '/tmp');
    expect(result.totalIssues).toBeGreaterThanOrEqual(1);
  });

  it('health check uses correct backend', async () => {
    const { runHealthCheck } = await import('../src/pipeline/health-check.js');
    const config = makeConfig();
    await runPreflightChecks(config, '/tmp', 'browser');
    expect(vi.mocked(runHealthCheck)).toHaveBeenCalledWith('/tmp', 'browser');
  });
});

describe('formatPreflightReport', () => {
  it('formats a passing report', async () => {
    const config = makeConfig();
    const result = await runPreflightChecks(config, '/tmp');
    const text = formatPreflightReport(result);
    expect(text).toContain('Pre-flight Check');
    expect(text).toContain('ALL CHECKS PASSED');
    expect(text).toContain('✓');
  });

  it('formats a failing report', async () => {
    const config = makeConfig({ scenarios: [], browser_scenarios: [] });
    const result = await runPreflightChecks(config, '/tmp');
    const text = formatPreflightReport(result);
    expect(text).toContain('FAILED');
    expect(text).toContain('✗');
  });

  it('includes duration', async () => {
    const config = makeConfig();
    const result = await runPreflightChecks(config, '/tmp');
    const text = formatPreflightReport(result);
    expect(text).toContain('Duration:');
  });
});
