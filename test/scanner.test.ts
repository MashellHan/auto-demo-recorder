import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scanProject, generateConfig, type ProjectInfo } from '../src/config/scanner.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

const { readFile } = await import('node:fs/promises');
const { existsSync } = await import('node:fs');

describe('scanProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('detects node project from package.json', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('package.json'),
    );
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        name: 'my-cli',
        description: 'A CLI tool',
        bin: './dist/cli.js',
        scripts: { build: 'tsc' },
      }),
    );

    const info = await scanProject('/tmp/my-cli');
    expect(info).toEqual({
      name: 'my-cli',
      description: 'A CLI tool',
      binary: './dist/cli.js',
      buildCommand: 'npm run build',
      type: 'node',
    });
  });

  it('handles node project with bin as object', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('package.json'),
    );
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        name: 'multi-bin',
        bin: { main: './dist/main.js', helper: './dist/helper.js' },
      }),
    );

    const info = await scanProject('/tmp/multi-bin');
    expect(info.binary).toBe('./dist/main.js');
    expect(info.buildCommand).toBeUndefined();
  });

  it('detects rust project from Cargo.toml', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('Cargo.toml'),
    );
    vi.mocked(readFile).mockResolvedValue(
      `[package]\nname = "my-tui"\ndescription = "A terminal UI"\nversion = "0.1.0"\n`,
    );

    const info = await scanProject('/tmp/my-tui');
    expect(info).toEqual({
      name: 'my-tui',
      description: 'A terminal UI',
      buildCommand: 'cargo build --release',
      binary: './target/release/my-tui',
      type: 'rust',
    });
  });

  it('detects go project from go.mod', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('go.mod'),
    );
    vi.mocked(readFile).mockResolvedValue(
      `module github.com/user/goapp\n\ngo 1.21\n`,
    );

    const info = await scanProject('/tmp/goapp');
    expect(info).toEqual({
      name: 'goapp',
      description: '',
      buildCommand: 'go build -o ./goapp',
      binary: './goapp',
      type: 'go',
    });
  });

  it('detects python project from pyproject.toml', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('pyproject.toml'),
    );
    vi.mocked(readFile).mockResolvedValue(
      `[project]\nname = "pyapp"\ndescription = "A Python app"\n`,
    );

    const info = await scanProject('/tmp/pyapp');
    expect(info).toEqual({
      name: 'pyapp',
      description: 'A Python app',
      type: 'python',
    });
  });

  it('detects python project from setup.py fallback', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('setup.py'),
    );

    const info = await scanProject('/tmp/old-py');
    expect(info.type).toBe('python');
    expect(info.name).toBe('old-py');
  });

  it('detects make project from Makefile', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('Makefile'),
    );
    vi.mocked(readFile).mockResolvedValue(
      `build:\n\tgcc -o main main.c\n\nclean:\n\trm -f main\n`,
    );

    const info = await scanProject('/tmp/c-project');
    expect(info).toEqual({
      name: 'c-project',
      description: '',
      buildCommand: 'make build',
      type: 'make',
    });
  });

  it('detects make project without build target', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('Makefile'),
    );
    vi.mocked(readFile).mockResolvedValue(`all:\n\techo hello\n`);

    const info = await scanProject('/tmp/simple-make');
    expect(info.buildCommand).toBe('make');
  });

  it('returns unknown for unrecognized project', async () => {
    const info = await scanProject('/tmp/mystery');
    expect(info).toEqual({
      name: 'mystery',
      description: '',
      type: 'unknown',
    });
  });

  it('uses directory name as fallback for node project without name', async () => {
    vi.mocked(existsSync).mockImplementation((p) =>
      String(p).endsWith('package.json'),
    );
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({}));

    const info = await scanProject('/tmp/unnamed-pkg');
    expect(info.name).toBe('unnamed-pkg');
  });
});

describe('generateConfig', () => {
  it('generates config with build command and binary', () => {
    const info: ProjectInfo = {
      name: 'my-app',
      description: 'Test app',
      buildCommand: 'cargo build --release',
      binary: './target/release/my-app',
      type: 'rust',
    };

    const config = generateConfig(info);
    expect(config).toContain('name: "my-app"');
    expect(config).toContain('description: "Test app"');
    expect(config).toContain('build_command: "cargo build --release"');
    expect(config).toContain('binary: "./target/release/my-app"');
    expect(config).toContain('./target/release/my-app');
    expect(config).toContain('scenarios:');
  });

  it('generates config with commented-out build/binary for unknown', () => {
    const info: ProjectInfo = {
      name: 'mystery',
      description: '',
      type: 'unknown',
    };

    const config = generateConfig(info);
    expect(config).toContain('# build_command: "make build"');
    expect(config).toContain('# binary: "./my-project"');
    expect(config).toContain('./mystery');
  });

  it('uses binary as step command when available', () => {
    const info: ProjectInfo = {
      name: 'go-tool',
      description: '',
      binary: './go-tool',
      buildCommand: 'go build -o ./go-tool',
      type: 'go',
    };

    const config = generateConfig(info);
    expect(config).toContain('value: "./go-tool"');
  });

  it('falls back to ./name when no binary', () => {
    const info: ProjectInfo = {
      name: 'simple',
      description: '',
      type: 'python',
    };

    const config = generateConfig(info);
    expect(config).toContain('value: "./simple"');
  });
});
