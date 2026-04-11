import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { loadConfig } from './config/loader.js';
import { captureEnvironmentSnapshot, formatEnvironmentSnapshot } from './pipeline/environment.js';
import { migrateConfig, formatMigrationReport } from './config/migration.js';
import { exportJsonSchema } from './config/schema-export.js';
import { listLanguages } from './config/languages.js';
import { listTemplates, getTemplateCategories } from './config/templates.js';
import { resolveExtendsChain, formatExtendsChain } from './config/extends-resolver.js';
import { generateCompletion, detectShell } from './config/completions.js';
import { diffConfigs, formatConfigDiff } from './config/config-diff.js';
import { registerConfigToolCommands } from './cli-config-tools-commands.js';

/**
 * Register config-related CLI commands onto the given program.
 *
 * Commands: env, migrate, schema, languages, templates, extends, show,
 * completion, config-diff. Advanced tools delegated to cli-config-tools-commands.ts.
 */
export function registerConfigCommands(program: Command): void {
  registerEnvCommand(program);
  registerMigrateCommand(program);
  registerSchemaCommand(program);
  registerLanguagesCommand(program);
  registerTemplatesCommand(program);
  registerExtendsCommand(program);
  registerShowCommand(program);
  registerCompletionCommand(program);
  registerDiffCommand(program);
  registerConfigToolCommands(program);
}

function registerEnvCommand(program: Command): void {
  program
    .command('env')
    .description('Show environment snapshot (system, tools, project info)')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--json', 'Output as JSON')
    .action(async (opts: { config?: string; json?: boolean }) => {
      try {
        const config = await loadConfig(opts.config);
        const projectDir = process.cwd();
        const snapshot = await captureEnvironmentSnapshot(projectDir, config.project.name);

        if (opts.json) {
          console.log(JSON.stringify(snapshot, null, 2));
        } else {
          console.log(formatEnvironmentSnapshot(snapshot));
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerMigrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Migrate a demo-recorder.yaml to the latest schema version')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('--dry-run', 'Show what would change without modifying the file')
    .action(async (opts: { config?: string; dryRun?: boolean }) => {
      try {
        const configPath = resolve(process.cwd(), opts.config ?? 'demo-recorder.yaml');
        if (!existsSync(configPath)) {
          throw new Error(`Config file not found: ${configPath}`);
        }

        const yaml = await import('yaml');
        const raw = yaml.parse(await readFile(configPath, 'utf-8'));
        const result = migrateConfig(raw);

        console.log(formatMigrationReport(result));

        if (result.changed && !opts.dryRun) {
          const migrated = yaml.stringify(result.config);
          await writeFile(configPath, migrated, 'utf-8');
          console.log(`\n✓ Config file updated: ${configPath}`);
        } else if (result.changed && opts.dryRun) {
          console.log('\n[DRY RUN] No changes written to disk.');
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerSchemaCommand(program: Command): void {
  program
    .command('schema')
    .description('Export JSON Schema for config file (IDE autocomplete)')
    .option('-o, --output <path>', 'Write schema to file instead of stdout')
    .action(async (opts: { output?: string }) => {
      try {
        const schema = exportJsonSchema();
        const json = JSON.stringify(schema, null, 2);

        if (opts.output) {
          const outputPath = resolve(process.cwd(), opts.output);
          await writeFile(outputPath, json, 'utf-8');
          console.log(`✓ JSON Schema written to ${outputPath}`);
          console.log('  Add to your YAML file: # yaml-language-server: $schema=./schema.json');
        } else {
          console.log(json);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerLanguagesCommand(program: Command): void {
  program
    .command('languages')
    .description('List supported annotation languages')
    .action(() => {
      const languages = listLanguages();
      console.log('Supported Annotation Languages:\n');
      for (const lang of languages) {
        console.log(`  ${lang.code.padEnd(6)} ${lang.name.padEnd(16)} ${lang.nativeName}`);
      }
      console.log('');
      console.log(`Total: ${languages.length} languages`);
      console.log('Usage: Set annotation.language in demo-recorder.yaml');
    });
}

function registerTemplatesCommand(program: Command): void {
  program
    .command('templates')
    .description('List available scenario templates')
    .option('--category <cat>', 'Filter by category')
    .action((opts: { category?: string }) => {
      const templates = listTemplates();
      const categories = getTemplateCategories();

      if (opts.category) {
        const cat = opts.category;
        const filtered = templates.filter((t) => t.category === cat.toLowerCase());
        if (filtered.length === 0) {
          console.log(`No templates found for category: ${cat}`);
          console.log(`Available categories: ${categories.join(', ')}`);
          return;
        }
        console.log(`Templates (${cat}):\n`);
        for (const t of filtered) {
          console.log(`  ${t.id.padEnd(24)} ${t.description}`);
        }
      } else {
        console.log('Available Scenario Templates:\n');
        for (const cat of categories) {
          const catTemplates = templates.filter((t) => t.category === cat);
          console.log(`  ${cat}:`);
          for (const t of catTemplates) {
            console.log(`    ${t.id.padEnd(24)} ${t.description}`);
          }
          console.log('');
        }
      }

      console.log(`Total: ${templates.length} templates`);
      console.log('Usage: Reference template steps in your demo-recorder.yaml');
    });
}

function registerExtendsCommand(program: Command): void {
  program
    .command('extends')
    .description('Show config extends chain resolution')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts: { config?: string }) => {
      try {
        const configPath = resolve(process.cwd(), opts.config ?? 'demo-recorder.yaml');
        const resolution = await resolveExtendsChain(configPath);
        console.log(formatExtendsChain(resolution));
        if (!resolution.valid) process.exit(1);
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerShowCommand(program: Command): void {
  program
    .command('show <scenario>')
    .description('Show detailed information about a scenario')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (scenarioName: string, opts: { config?: string }) => {
      try {
        const config = await loadConfig(opts.config);

        const terminalScenario = config.scenarios.find((s) => s.name === scenarioName);
        const browserScenario = config.browser_scenarios.find((s) => s.name === scenarioName);
        const scenario = terminalScenario ?? browserScenario;

        if (!scenario) {
          throw new Error(`Scenario "${scenarioName}" not found. Use "demo-recorder list" to see available scenarios.`);
        }

        const lines: string[] = [];
        const isBrowser = !!browserScenario;

        lines.push(`Scenario: ${scenario.name}`);
        lines.push('═'.repeat(50));
        lines.push(`  Description: ${scenario.description}`);
        lines.push(`  Backend:     ${isBrowser ? 'browser' : 'vhs'}`);
        if (isBrowser && browserScenario) {
          lines.push(`  URL:         ${browserScenario.url}`);
        }
        lines.push(`  Tags:        ${(scenario.tags ?? []).length > 0 ? scenario.tags!.join(', ') : '(none)'}`);
        lines.push(`  Depends On:  ${(scenario.depends_on ?? []).length > 0 ? scenario.depends_on!.join(', ') : '(none)'}`);

        if (scenario.setup && scenario.setup.length > 0) {
          lines.push('');
          lines.push('Setup Commands:');
          for (const cmd of scenario.setup) {
            lines.push(`  $ ${cmd}`);
          }
        }

        if (scenario.hooks) {
          lines.push('');
          lines.push('Hooks:');
          if (scenario.hooks.before) lines.push(`  Before: ${scenario.hooks.before}`);
          if (scenario.hooks.after) lines.push(`  After:  ${scenario.hooks.after}`);
        }

        lines.push('');
        lines.push(`Steps (${scenario.steps.length}):`);
        for (let i = 0; i < scenario.steps.length; i++) {
          const step = scenario.steps[i];
          const comment = step.comment ? ` — ${step.comment}` : '';
          const repeat = step.repeat && step.repeat > 1 ? ` (×${step.repeat})` : '';
          lines.push(`  ${(i + 1).toString().padStart(2)}. [${step.action}] ${step.value}${repeat}${comment}`);
        }

        console.log(lines.join('\n'));
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}

function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Generate shell completion script')
    .option('--shell <shell>', 'Shell type: bash, zsh, or fish')
    .action((opts: { shell?: string }) => {
      const shell = (opts.shell ?? detectShell()) as 'bash' | 'zsh' | 'fish';
      if (!['bash', 'zsh', 'fish'].includes(shell)) {
        console.error(`Unsupported shell: ${shell}. Use --shell bash|zsh|fish`);
        process.exit(1);
      }
      console.log(generateCompletion(shell));
    });
}

function registerDiffCommand(program: Command): void {
  program
    .command('config-diff')
    .description('Compare two config files and show differences')
    .argument('<fileA>', 'Path to first config file')
    .argument('<fileB>', 'Path to second config file')
    .option('--json', 'Output as JSON')
    .action(async (fileA: string, fileB: string, opts: { json?: boolean }) => {
      try {
        const yaml = await import('yaml');
        const pathA = resolve(process.cwd(), fileA);
        const pathB = resolve(process.cwd(), fileB);

        if (!existsSync(pathA)) {
          throw new Error(`Config file not found: ${pathA}`);
        }
        if (!existsSync(pathB)) {
          throw new Error(`Config file not found: ${pathB}`);
        }

        const contentA = yaml.parse(await readFile(pathA, 'utf-8')) as Record<string, unknown>;
        const contentB = yaml.parse(await readFile(pathB, 'utf-8')) as Record<string, unknown>;
        const result = diffConfigs(contentA, contentB);

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatConfigDiff(result));
        }

        if (!result.identical) {
          process.exit(1);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
