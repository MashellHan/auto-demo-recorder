/**
 * Config scaffold generator — create starter demo-recorder configs
 * for common project types and frameworks.
 *
 * Each scaffold includes pre-configured scenarios, recommended settings,
 * and inline comments explaining the purpose of each section.
 */

/** A scaffold definition. */
export interface Scaffold {
  /** Scaffold identifier. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Short description. */
  readonly description: string;
  /** Category (e.g., "web", "cli", "api"). */
  readonly category: string;
  /** Generated YAML content. */
  readonly yaml: string;
}

/** Available scaffolds. */
const SCAFFOLDS: readonly Scaffold[] = [
  {
    id: 'cli-basic',
    name: 'CLI Basic',
    description: 'Basic terminal recording for CLI tools',
    category: 'cli',
    yaml: `# demo-recorder.yaml — CLI Tool Recording
project:
  name: my-cli-tool
  description: Recording demos for a CLI tool

scenarios:
  - name: quickstart
    description: Show basic usage and help output
    steps:
      - action: type
        value: my-tool --help
      - action: key
        value: Enter
      - action: sleep
        value: 2s
      - action: type
        value: my-tool init
      - action: key
        value: Enter
      - action: sleep
        value: 3s

recording:
  width: 120
  height: 36
  fps: 10

output:
  dir: recordings
  format: mp4
`,
  },
  {
    id: 'cli-advanced',
    name: 'CLI Advanced',
    description: 'Multi-scenario CLI recording with profiles and tags',
    category: 'cli',
    yaml: `# demo-recorder.yaml — Advanced CLI Recording
project:
  name: my-cli-tool
  description: Comprehensive demos for a CLI tool

scenarios:
  - name: install
    description: Installation and setup
    tags: [getting-started]
    steps:
      - action: type
        value: npm install -g my-tool
      - action: key
        value: Enter
      - action: sleep
        value: 3s
      - action: type
        value: my-tool --version
      - action: key
        value: Enter
      - action: sleep
        value: 1s

  - name: basic-usage
    description: Core workflow demonstration
    tags: [getting-started, core]
    depends_on: [install]
    steps:
      - action: type
        value: my-tool init my-project
      - action: key
        value: Enter
      - action: sleep
        value: 2s
      - action: type
        value: cd my-project && ls
      - action: key
        value: Enter
      - action: sleep
        value: 2s

  - name: advanced-features
    description: Advanced feature showcase
    tags: [advanced]
    depends_on: [basic-usage]
    steps:
      - action: type
        value: my-tool config set verbose true
      - action: key
        value: Enter
      - action: sleep
        value: 1s
      - action: type
        value: my-tool run --watch
      - action: key
        value: Enter
      - action: sleep
        value: 5s
      - action: key
        value: ctrl+c

recording:
  width: 120
  height: 36
  fps: 10
  theme: Dracula
  parallel: true
  workers: 2

annotation:
  enabled: true

output:
  dir: recordings
  format: mp4
`,
  },
  {
    id: 'web-app',
    name: 'Web Application',
    description: 'Browser recording for web applications',
    category: 'web',
    yaml: `# demo-recorder.yaml — Web Application Recording
project:
  name: my-web-app
  description: Recording demos for a web application

browser_scenarios:
  - name: login-flow
    description: User login workflow
    tags: [auth, core]
    url: http://localhost:3000
    steps:
      - action: navigate
        value: http://localhost:3000/login
      - action: sleep
        value: 1s
      - action: click
        value: "#email"
      - action: type
        value: user@example.com
      - action: click
        value: "#password"
      - action: type
        value: password123
      - action: click
        value: button[type="submit"]
      - action: sleep
        value: 2s
      - action: screenshot
        value: dashboard

  - name: feature-demo
    description: Key feature walkthrough
    tags: [features]
    url: http://localhost:3000
    setup:
      - npm run dev &
    steps:
      - action: navigate
        value: http://localhost:3000/features
      - action: sleep
        value: 2s
      - action: click
        value: ".feature-card:first-child"
      - action: sleep
        value: 1s
      - action: screenshot
        value: feature-detail

recording:
  width: 1280
  height: 720
  fps: 15

output:
  dir: recordings
  format: mp4
`,
  },
  {
    id: 'api-demo',
    name: 'API Demo',
    description: 'Terminal recording for API demonstrations',
    category: 'api',
    yaml: `# demo-recorder.yaml — API Demo Recording
project:
  name: my-api
  description: Recording API usage demos

scenarios:
  - name: api-overview
    description: API endpoint overview with curl
    tags: [api, getting-started]
    steps:
      - action: type
        value: "curl -s http://localhost:8080/api/health | jq ."
      - action: key
        value: Enter
      - action: sleep
        value: 2s
      - action: type
        value: "curl -s http://localhost:8080/api/users | jq '.data[:3]'"
      - action: key
        value: Enter
      - action: sleep
        value: 3s

  - name: crud-operations
    description: Create, read, update, delete flow
    tags: [api, crud]
    depends_on: [api-overview]
    steps:
      - action: type
        value: "curl -s -X POST http://localhost:8080/api/users -H 'Content-Type: application/json' -d '{\"name\":\"Alice\"}' | jq ."
      - action: key
        value: Enter
      - action: sleep
        value: 2s
      - action: type
        value: "curl -s http://localhost:8080/api/users/1 | jq ."
      - action: key
        value: Enter
      - action: sleep
        value: 2s

recording:
  width: 140
  height: 40
  fps: 10

output:
  dir: recordings
  format: mp4
`,
  },
  {
    id: 'monorepo',
    name: 'Monorepo',
    description: 'Multi-package monorepo recording setup',
    category: 'cli',
    yaml: `# demo-recorder.yaml — Monorepo Recording
project:
  name: my-monorepo
  description: Recording demos for a monorepo project

scenarios:
  - name: workspace-overview
    description: Show workspace structure
    tags: [overview]
    steps:
      - action: type
        value: tree -L 2 packages/
      - action: key
        value: Enter
      - action: sleep
        value: 2s

  - name: build-all
    description: Build all packages
    tags: [build]
    depends_on: [workspace-overview]
    setup:
      - npm install
    steps:
      - action: type
        value: npm run build --workspaces
      - action: key
        value: Enter
      - action: sleep
        value: 10s

  - name: test-all
    description: Run all tests
    tags: [test]
    depends_on: [build-all]
    steps:
      - action: type
        value: npm test --workspaces
      - action: key
        value: Enter
      - action: sleep
        value: 8s

recording:
  width: 120
  height: 36
  fps: 10
  parallel: true
  workers: 3

output:
  dir: recordings
  format: mp4
`,
  },
];

/**
 * List all available scaffolds.
 */
export function listScaffolds(): readonly Scaffold[] {
  return SCAFFOLDS;
}

/**
 * List scaffold categories.
 */
export function getScaffoldCategories(): readonly string[] {
  const cats = new Set(SCAFFOLDS.map((s) => s.category));
  return Array.from(cats).sort();
}

/**
 * List scaffolds filtered by category.
 */
export function listScaffoldsByCategory(category: string): readonly Scaffold[] {
  return SCAFFOLDS.filter((s) => s.category.toLowerCase() === category.toLowerCase());
}

/**
 * Find a scaffold by ID.
 */
export function findScaffold(id: string): Scaffold | undefined {
  return SCAFFOLDS.find((s) => s.id.toLowerCase() === id.toLowerCase());
}

/**
 * Format scaffold list for display.
 */
export function formatScaffoldList(scaffolds: readonly Scaffold[]): string {
  const lines: string[] = [];
  lines.push('Config Scaffolds');
  lines.push('═'.repeat(60));
  lines.push('');

  if (scaffolds.length === 0) {
    lines.push('  No scaffolds found.');
    return lines.join('\n');
  }

  // Group by category
  const byCategory = new Map<string, Scaffold[]>();
  for (const s of scaffolds) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }

  for (const [category, items] of byCategory) {
    lines.push(`  ${category.toUpperCase()}`);
    for (const item of items) {
      lines.push(`    ${item.id.padEnd(20)} ${item.description}`);
    }
    lines.push('');
  }

  lines.push(`Total: ${scaffolds.length} scaffolds in ${byCategory.size} categories`);
  lines.push('');
  lines.push('Use "demo-recorder scaffold <id>" to generate a config file.');

  return lines.join('\n');
}
