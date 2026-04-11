import { describe, it, expect } from 'vitest';
import { generateCIConfig, getSupportedProviders, type CIProvider } from '../src/config/ci-generator.js';

describe('generateCIConfig', () => {
  it('generates GitHub Actions workflow', () => {
    const result = generateCIConfig({ provider: 'github' });

    expect(result.filePath).toBe('.github/workflows/demo-recording.yml');
    expect(result.content).toContain('name: Demo Recording');
    expect(result.content).toContain('actions/checkout@v4');
    expect(result.content).toContain('npx demo-recorder record');
    expect(result.content).toContain('actions/upload-artifact@v4');
  });

  it('generates GitLab CI config', () => {
    const result = generateCIConfig({ provider: 'gitlab' });

    expect(result.filePath).toBe('.gitlab-ci.yml');
    expect(result.content).toContain('demo-recording:');
    expect(result.content).toContain('npx demo-recorder record');
    expect(result.content).toContain('artifacts:');
  });

  it('generates CircleCI config', () => {
    const result = generateCIConfig({ provider: 'circleci' });

    expect(result.filePath).toBe('.circleci/config.yml');
    expect(result.content).toContain('version: 2.1');
    expect(result.content).toContain('demo-recording:');
    expect(result.content).toContain('npx demo-recorder record');
  });

  it('includes --no-annotate when annotate is false', () => {
    const result = generateCIConfig({ provider: 'github', annotate: false });
    expect(result.content).toContain('--no-annotate');
    expect(result.content).not.toContain('ANTHROPIC_API_KEY');
  });

  it('includes ANTHROPIC_API_KEY when annotation is enabled', () => {
    const result = generateCIConfig({ provider: 'github', annotate: true });
    expect(result.content).toContain('ANTHROPIC_API_KEY');
  });

  it('includes browser setup when backend is browser', () => {
    const result = generateCIConfig({ provider: 'github', backend: 'browser' });
    expect(result.content).toContain('playwright install');
    expect(result.content).toContain('--backend browser');
  });

  it('includes VHS setup when backend is vhs', () => {
    const result = generateCIConfig({ provider: 'github', backend: 'vhs' });
    expect(result.content).toContain('vhs');
    expect(result.content).not.toContain('playwright');
  });

  it('respects custom branches', () => {
    const result = generateCIConfig({ provider: 'github', branches: ['main', 'develop'] });
    expect(result.content).toContain('"main"');
    expect(result.content).toContain('"develop"');
  });

  it('respects custom node version', () => {
    const result = generateCIConfig({ provider: 'github', nodeVersion: '20' });
    expect(result.content).toContain('node-version: "20"');
  });

  it('throws for unsupported provider', () => {
    expect(() => generateCIConfig({ provider: 'jenkins' as CIProvider }))
      .toThrow('Unsupported CI provider');
  });
});

describe('getSupportedProviders', () => {
  it('returns all supported providers', () => {
    const providers = getSupportedProviders();
    expect(providers).toContain('github');
    expect(providers).toContain('gitlab');
    expect(providers).toContain('circleci');
    expect(providers).toHaveLength(3);
  });
});
