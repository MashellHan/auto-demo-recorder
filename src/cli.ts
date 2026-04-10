import { Command } from 'commander';
import { loadConfig, findScenario } from './config/loader.js';
import { record } from './index.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('demo-recorder')
    .description('On-demand terminal demo recording + AI annotation CLI tool')
    .version('0.1.0');

  program
    .command('record')
    .description('Record a demo video')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .option('-s, --scenario <name>', 'Scenario name to record')
    .option('--no-annotate', 'Skip AI annotation')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);

        if (opts.annotate === false) {
          config.annotation.enabled = false;
        }

        const projectDir = process.cwd();
        const scenarios = opts.scenario
          ? [findScenario(config, opts.scenario)]
          : config.scenarios;

        for (const scenario of scenarios) {
          await record({ config, scenario, projectDir });
          console.log('');
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('list')
    .description('List available scenarios')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        console.log(`Project: ${config.project.name}`);
        console.log(`Scenarios:`);
        for (const s of config.scenarios) {
          console.log(`  - ${s.name}: ${s.description}`);
          console.log(`    Steps: ${s.steps.length}, Setup: ${s.setup.length} commands`);
        }
      } catch (error) {
        console.error(`Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  program
    .command('validate')
    .description('Validate config file')
    .option('-c, --config <path>', 'Path to demo-recorder.yaml')
    .action(async (opts) => {
      try {
        const config = await loadConfig(opts.config);
        console.log(`\u2713 Config valid`);
        console.log(`  Project: ${config.project.name}`);
        console.log(`  Scenarios: ${config.scenarios.length}`);
        console.log(`  Recording: ${config.recording.width}x${config.recording.height}`);
        console.log(`  Annotation: ${config.annotation.enabled ? 'enabled' : 'disabled'}`);
      } catch (error) {
        console.error(`\u2717 Config invalid: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  return program;
}
