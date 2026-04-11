import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';

export interface ProjectInfo {
  name: string;
  description: string;
  buildCommand?: string;
  binary?: string;
  type: 'node' | 'go' | 'rust' | 'python' | 'make' | 'unknown';
}

export async function scanProject(projectDir: string): Promise<ProjectInfo> {
  const dirName = basename(projectDir);

  // Try each detector in priority order
  const detectors = [
    () => detectNode(projectDir),
    () => detectRust(projectDir),
    () => detectGo(projectDir),
    () => detectPython(projectDir),
    () => detectMake(projectDir),
  ];

  for (const detect of detectors) {
    const result = await detect();
    if (result) return result;
  }

  return { name: dirName, description: '', type: 'unknown' };
}

async function detectNode(dir: string): Promise<ProjectInfo | null> {
  const pkgPath = join(dir, 'package.json');
  if (!existsSync(pkgPath)) return null;

  const content = await readFile(pkgPath, 'utf-8');
  const pkg = JSON.parse(content);

  const name = pkg.name ?? basename(dir);
  const description = pkg.description ?? '';

  // Detect binary
  let binary: string | undefined;
  if (pkg.bin) {
    binary = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0] as string;
  }

  // Detect build command
  let buildCommand: string | undefined;
  if (pkg.scripts?.build) {
    buildCommand = 'npm run build';
  }

  return { name, description, buildCommand, binary, type: 'node' };
}

async function detectRust(dir: string): Promise<ProjectInfo | null> {
  const cargoPath = join(dir, 'Cargo.toml');
  if (!existsSync(cargoPath)) return null;

  const content = await readFile(cargoPath, 'utf-8');
  const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
  const name = nameMatch?.[1] ?? basename(dir);

  const descMatch = content.match(/^description\s*=\s*"([^"]+)"/m);
  const description = descMatch?.[1] ?? '';

  return {
    name,
    description,
    buildCommand: 'cargo build --release',
    binary: `./target/release/${name}`,
    type: 'rust',
  };
}

async function detectGo(dir: string): Promise<ProjectInfo | null> {
  const modPath = join(dir, 'go.mod');
  if (!existsSync(modPath)) return null;

  const content = await readFile(modPath, 'utf-8');
  const moduleMatch = content.match(/^module\s+(\S+)/m);
  const moduleName = moduleMatch?.[1] ?? '';
  const name = moduleName.split('/').pop() ?? basename(dir);

  return {
    name,
    description: '',
    buildCommand: 'go build -o ./' + name,
    binary: './' + name,
    type: 'go',
  };
}

async function detectPython(dir: string): Promise<ProjectInfo | null> {
  const pyprojectPath = join(dir, 'pyproject.toml');
  const setupPath = join(dir, 'setup.py');

  if (!existsSync(pyprojectPath) && !existsSync(setupPath)) return null;

  const name = basename(dir);
  let description = '';

  if (existsSync(pyprojectPath)) {
    const content = await readFile(pyprojectPath, 'utf-8');
    const nameMatch = content.match(/^name\s*=\s*"([^"]+)"/m);
    const descMatch = content.match(/^description\s*=\s*"([^"]+)"/m);
    if (nameMatch) return { name: nameMatch[1], description: descMatch?.[1] ?? '', type: 'python' };
  }

  return { name, description, type: 'python' };
}

async function detectMake(dir: string): Promise<ProjectInfo | null> {
  const makePath = join(dir, 'Makefile');
  if (!existsSync(makePath)) return null;

  const name = basename(dir);
  const content = await readFile(makePath, 'utf-8');

  // Check for build target
  const hasBuild = /^build\s*:/m.test(content);
  const buildCommand = hasBuild ? 'make build' : 'make';

  return {
    name,
    description: '',
    buildCommand,
    type: 'make',
  };
}

export function generateConfig(info: ProjectInfo): string {
  const buildLine = info.buildCommand ? `  build_command: "${info.buildCommand}"` : '  # build_command: "make build"';
  const binaryLine = info.binary ? `  binary: "${info.binary}"` : '  # binary: "./my-project"';
  const command = info.binary ?? `./${info.name}`;

  return `project:
  name: "${info.name}"
  description: "${info.description}"
${buildLine}
${binaryLine}

recording:
  width: 1200
  height: 800
  font_size: 16
  theme: "Catppuccin Mocha"
  fps: 25
  max_duration: 60

output:
  dir: ".demo-recordings"
  keep_raw: true
  keep_frames: false

annotation:
  enabled: true
  model: "claude-sonnet-4-6"
  extract_fps: 1
  language: "en"
  overlay_position: "bottom"
  overlay_font_size: 14

scenarios:
  - name: "basic"
    description: "Basic ${info.name} interaction"
    setup: []
    steps:
      - { action: "type", value: "${command}", pause: "2s" }
      - { action: "key", value: "q", pause: "500ms" }
`;
}
