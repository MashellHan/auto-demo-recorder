import type { Step, BrowserStep } from './schema.js';

/** A reusable scenario template definition. */
export interface ScenarioTemplate {
  /** Unique template identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of what this template records. */
  description: string;
  /** Category for grouping (e.g., "devtools", "cicd", "web"). */
  category: string;
  /** Tags automatically applied to scenarios using this template. */
  tags: string[];
  /** Setup commands. */
  setup: string[];
  /** Recording steps. */
  steps: Step[];
}

/** Built-in scenario templates for common workflows. */
export const SCENARIO_TEMPLATES: readonly ScenarioTemplate[] = [
  {
    id: 'npm-test',
    name: 'NPM Test Run',
    description: 'Record an npm test execution showing test output',
    category: 'devtools',
    tags: ['testing', 'npm'],
    setup: [],
    steps: [
      { action: 'type', value: 'npm test', pause: '500ms', comment: 'Run test suite' },
      { action: 'key', value: 'Enter', pause: '500ms' },
      { action: 'sleep', value: '5s', pause: '0ms', comment: 'Wait for tests to complete' },
    ],
  },
  {
    id: 'npm-build',
    name: 'NPM Build',
    description: 'Record a project build process',
    category: 'devtools',
    tags: ['build', 'npm'],
    setup: [],
    steps: [
      { action: 'type', value: 'npm run build', pause: '500ms', comment: 'Start build' },
      { action: 'key', value: 'Enter', pause: '500ms' },
      { action: 'sleep', value: '10s', pause: '0ms', comment: 'Wait for build to complete' },
    ],
  },
  {
    id: 'git-status',
    name: 'Git Status & Log',
    description: 'Show git status and recent commit log',
    category: 'devtools',
    tags: ['git', 'vcs'],
    setup: [],
    steps: [
      { action: 'type', value: 'git status', pause: '500ms', comment: 'Check working tree' },
      { action: 'key', value: 'Enter', pause: '1000ms' },
      { action: 'type', value: 'git log --oneline -10', pause: '500ms', comment: 'Show recent commits' },
      { action: 'key', value: 'Enter', pause: '1000ms' },
    ],
  },
  {
    id: 'docker-compose',
    name: 'Docker Compose Up',
    description: 'Record docker compose startup sequence',
    category: 'devtools',
    tags: ['docker', 'containers'],
    setup: [],
    steps: [
      { action: 'type', value: 'docker compose up -d', pause: '500ms', comment: 'Start services' },
      { action: 'key', value: 'Enter', pause: '500ms' },
      { action: 'sleep', value: '5s', pause: '0ms', comment: 'Wait for services' },
      { action: 'type', value: 'docker compose ps', pause: '500ms', comment: 'Check status' },
      { action: 'key', value: 'Enter', pause: '1000ms' },
    ],
  },
  {
    id: 'api-health',
    name: 'API Health Check',
    description: 'Demonstrate API endpoint health checks with curl',
    category: 'web',
    tags: ['api', 'http'],
    setup: [],
    steps: [
      { action: 'type', value: 'curl -s http://localhost:3000/health | jq .', pause: '500ms', comment: 'Check health endpoint' },
      { action: 'key', value: 'Enter', pause: '2000ms' },
    ],
  },
  {
    id: 'cli-help',
    name: 'CLI Help Output',
    description: 'Record CLI help message and version info',
    category: 'documentation',
    tags: ['cli', 'help'],
    setup: [],
    steps: [
      { action: 'type', value: '<command> --help', pause: '500ms', comment: 'Show help' },
      { action: 'key', value: 'Enter', pause: '1000ms' },
      { action: 'type', value: '<command> --version', pause: '500ms', comment: 'Show version' },
      { action: 'key', value: 'Enter', pause: '1000ms' },
    ],
  },
  {
    id: 'install-and-run',
    name: 'Install & Run',
    description: 'Install dependencies and run the application',
    category: 'getting-started',
    tags: ['setup', 'quickstart'],
    setup: [],
    steps: [
      { action: 'type', value: 'npm install', pause: '500ms', comment: 'Install dependencies' },
      { action: 'key', value: 'Enter', pause: '500ms' },
      { action: 'sleep', value: '10s', pause: '0ms', comment: 'Wait for installation' },
      { action: 'type', value: 'npm start', pause: '500ms', comment: 'Start application' },
      { action: 'key', value: 'Enter', pause: '500ms' },
      { action: 'sleep', value: '5s', pause: '0ms', comment: 'Wait for startup' },
    ],
  },
  {
    id: 'database-migration',
    name: 'Database Migration',
    description: 'Run database migrations and show status',
    category: 'devtools',
    tags: ['database', 'migration'],
    setup: [],
    steps: [
      { action: 'type', value: 'npx prisma migrate dev', pause: '500ms', comment: 'Run migrations' },
      { action: 'key', value: 'Enter', pause: '500ms' },
      { action: 'sleep', value: '5s', pause: '0ms', comment: 'Wait for migration' },
      { action: 'type', value: 'npx prisma db seed', pause: '500ms', comment: 'Seed database' },
      { action: 'key', value: 'Enter', pause: '500ms' },
      { action: 'sleep', value: '3s', pause: '0ms', comment: 'Wait for seeding' },
    ],
  },
] as const;

/** Map of template ID to template for O(1) lookup. */
const templateMap = new Map<string, ScenarioTemplate>(
  SCENARIO_TEMPLATES.map((t) => [t.id, t]),
);

/** Find a template by ID. */
export function findTemplate(id: string): ScenarioTemplate | undefined {
  return templateMap.get(id.toLowerCase());
}

/** List all available templates. */
export function listTemplates(): readonly ScenarioTemplate[] {
  return SCENARIO_TEMPLATES;
}

/** List templates by category. */
export function listTemplatesByCategory(category: string): ScenarioTemplate[] {
  return SCENARIO_TEMPLATES.filter((t) => t.category === category.toLowerCase());
}

/** Get unique categories from all templates. */
export function getTemplateCategories(): string[] {
  return [...new Set(SCENARIO_TEMPLATES.map((t) => t.category))];
}
