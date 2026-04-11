import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureEnvironmentSnapshot,
  formatEnvironmentSnapshot,
  type EnvironmentSnapshot,
} from '../src/pipeline/environment.js';

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
        cb(new Error(`Command not found: ${command}`), { stdout: '', stderr: '' });
      }
    }
  }),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async (path: string) => {
    if (path.includes('package.json') && !path.includes('node_modules')) {
      return JSON.stringify({
        dependencies: { commander: '^12.0.0', zod: '^3.22.0' },
        devDependencies: { vitest: '^1.0.0' },
      });
    }
    return '{}';
  }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => {
    if (path.includes('package-lock.json')) return true;
    if (path.includes('package.json')) return true;
    return false;
  }),
}));

describe('captureEnvironmentSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures system information', async () => {
    const snapshot = await captureEnvironmentSnapshot('/tmp/project', 'my-app');

    expect(snapshot.system.platform).toBe(process.platform);
    expect(snapshot.system.arch).toBe(process.arch);
    expect(snapshot.system.nodeVersion).toBe(process.version);
  });

  it('captures npm version', async () => {
    const snapshot = await captureEnvironmentSnapshot('/tmp/project', 'my-app');
    expect(snapshot.system.npmVersion).toBe('10.5.0');
  });

  it('captures tool versions', async () => {
    const snapshot = await captureEnvironmentSnapshot('/tmp/project', 'my-app');
    expect(snapshot.tools.vhsVersion).toBe('vhs 0.7.1');
  });

  it('captures project metadata', async () => {
    const snapshot = await captureEnvironmentSnapshot('/tmp/project', 'my-app');
    expect(snapshot.project.name).toBe('my-app');
    expect(snapshot.project.directory).toBe('/tmp/project');
    expect(snapshot.project.packageManager).toBe('npm');
  });

  it('reads project dependencies', async () => {
    const snapshot = await captureEnvironmentSnapshot('/tmp/project', 'my-app');
    expect(snapshot.project.dependencies).toHaveProperty('commander');
    expect(snapshot.project.dependencies).toHaveProperty('vitest');
  });

  it('includes timestamp', async () => {
    const snapshot = await captureEnvironmentSnapshot('/tmp/project', 'my-app');
    expect(snapshot.timestamp).toBeTruthy();
    // Should be valid ISO date
    expect(() => new Date(snapshot.timestamp)).not.toThrow();
  });
});

describe('formatEnvironmentSnapshot', () => {
  const snapshot: EnvironmentSnapshot = {
    timestamp: '2026-04-11T09:00:00.000Z',
    system: {
      platform: 'darwin',
      arch: 'arm64',
      nodeVersion: 'v22.0.0',
      npmVersion: '10.5.0',
    },
    tools: {
      vhsVersion: 'vhs 0.7.1',
      ffmpegVersion: '6.1.1',
      playwrightVersion: null,
    },
    project: {
      name: 'my-app',
      directory: '/Users/dev/my-app',
      packageManager: 'npm',
      dependencies: { commander: '^12.0.0', zod: '^3.22.0' },
    },
  };

  it('includes system section', () => {
    const output = formatEnvironmentSnapshot(snapshot);
    expect(output).toContain('Platform: darwin');
    expect(output).toContain('Arch: arm64');
    expect(output).toContain('Node.js: v22.0.0');
    expect(output).toContain('npm: 10.5.0');
  });

  it('includes tools section', () => {
    const output = formatEnvironmentSnapshot(snapshot);
    expect(output).toContain('VHS: vhs 0.7.1');
    expect(output).toContain('FFmpeg: 6.1.1');
    expect(output).toContain('Playwright: not installed');
  });

  it('includes project section', () => {
    const output = formatEnvironmentSnapshot(snapshot);
    expect(output).toContain('Name: my-app');
    expect(output).toContain('Package Manager: npm');
    expect(output).toContain('Dependencies: 2');
  });

  it('shows "not found" for missing tools', () => {
    const withoutTools: EnvironmentSnapshot = {
      ...snapshot,
      tools: { vhsVersion: null, ffmpegVersion: null, playwrightVersion: null },
      system: { ...snapshot.system, npmVersion: null },
    };
    const output = formatEnvironmentSnapshot(withoutTools);
    expect(output).toContain('VHS: not installed');
    expect(output).toContain('npm: not found');
  });
});
