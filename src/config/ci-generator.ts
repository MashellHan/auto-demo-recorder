/**
 * CI/CD configuration generators for automated demo recording.
 *
 * Generates workflow files for GitHub Actions, GitLab CI, and CircleCI.
 */

/** Supported CI providers. */
export type CIProvider = 'github' | 'gitlab' | 'circleci';

/** Options for generating CI configuration. */
export interface CIConfigOptions {
  /** CI provider to generate config for. */
  provider: CIProvider;
  /** Branch(es) to trigger on (default: ['main']). */
  branches?: string[];
  /** Whether to include annotation step. */
  annotate?: boolean;
  /** Recording backend. */
  backend?: 'vhs' | 'browser';
  /** Node.js version to use. */
  nodeVersion?: string;
}

/** Result of generating a CI config. */
export interface CIConfigResult {
  /** The file path where the config should be written. */
  filePath: string;
  /** The generated config content. */
  content: string;
  /** Human-readable description. */
  description: string;
}

/**
 * Generate CI configuration for the specified provider.
 */
export function generateCIConfig(options: CIConfigOptions): CIConfigResult {
  switch (options.provider) {
    case 'github':
      return generateGitHubActions(options);
    case 'gitlab':
      return generateGitLabCI(options);
    case 'circleci':
      return generateCircleCI(options);
    default:
      throw new Error(`Unsupported CI provider: ${options.provider}. Supported: github, gitlab, circleci`);
  }
}

function generateGitHubActions(options: CIConfigOptions): CIConfigResult {
  const branches = options.branches ?? ['main'];
  const nodeVersion = options.nodeVersion ?? '22';
  const annotateFlag = options.annotate === false ? ' --no-annotate' : '';
  const backendFlag = options.backend === 'browser' ? ' --backend browser' : '';

  const content = `name: Demo Recording
on:
  push:
    branches: [${branches.map((b) => `"${b}"`).join(', ')}]
  workflow_dispatch:

jobs:
  record:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "${nodeVersion}"
          cache: "npm"

      - run: npm ci
${options.backend === 'browser' ? `
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
` : `
      - name: Install VHS
        run: |
          curl -fsSL https://charm.sh/install.sh | bash -s -- vhs
`}
      - name: Record demos
        run: npx demo-recorder record${annotateFlag}${backendFlag}
${options.annotate !== false ? `        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
` : ''}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: demo-recordings
          path: .demo-recordings/
          retention-days: 30
`;

  return {
    filePath: '.github/workflows/demo-recording.yml',
    content,
    description: 'GitHub Actions workflow for automated demo recording',
  };
}

function generateGitLabCI(options: CIConfigOptions): CIConfigResult {
  const annotateFlag = options.annotate === false ? ' --no-annotate' : '';
  const backendFlag = options.backend === 'browser' ? ' --backend browser' : '';
  const nodeVersion = options.nodeVersion ?? '22';

  const content = `demo-recording:
  image: node:${nodeVersion}
  stage: test
  only:
    - ${(options.branches ?? ['main']).join('\n    - ')}
  before_script:
    - npm ci
${options.backend === 'browser'
    ? '    - npx playwright install --with-deps chromium'
    : '    - curl -fsSL https://charm.sh/install.sh | bash -s -- vhs'}
  script:
    - npx demo-recorder record${annotateFlag}${backendFlag}
  artifacts:
    paths:
      - .demo-recordings/
    expire_in: 30 days
    when: always
`;

  return {
    filePath: '.gitlab-ci.yml',
    content,
    description: 'GitLab CI job for automated demo recording',
  };
}

function generateCircleCI(options: CIConfigOptions): CIConfigResult {
  const annotateFlag = options.annotate === false ? ' --no-annotate' : '';
  const backendFlag = options.backend === 'browser' ? ' --backend browser' : '';
  const nodeVersion = options.nodeVersion ?? '22';

  const content = `version: 2.1

jobs:
  demo-recording:
    docker:
      - image: cimg/node:${nodeVersion}.0
    steps:
      - checkout
      - restore_cache:
          keys:
            - npm-deps-{{ checksum "package-lock.json" }}
      - run: npm ci
      - save_cache:
          key: npm-deps-{{ checksum "package-lock.json" }}
          paths:
            - node_modules
${options.backend === 'browser'
    ? '      - run: npx playwright install --with-deps chromium'
    : '      - run: curl -fsSL https://charm.sh/install.sh | bash -s -- vhs'}
      - run: npx demo-recorder record${annotateFlag}${backendFlag}
      - store_artifacts:
          path: .demo-recordings
          destination: demo-recordings

workflows:
  demo:
    jobs:
      - demo-recording:
          filters:
            branches:
              only:
                - ${(options.branches ?? ['main']).join('\n                - ')}
`;

  return {
    filePath: '.circleci/config.yml',
    content,
    description: 'CircleCI job for automated demo recording',
  };
}

/**
 * Get the list of supported CI providers.
 */
export function getSupportedProviders(): CIProvider[] {
  return ['github', 'gitlab', 'circleci'];
}
