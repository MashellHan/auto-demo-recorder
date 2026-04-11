/**
 * Shell completion script generators for bash, zsh, and fish shells.
 * Generates completion scripts for all CLI commands and their options.
 */

/** All CLI commands with descriptions for completion. */
const COMMANDS: Array<{ name: string; description: string; options?: string[] }> = [
  { name: 'record', description: 'Record demo scenarios', options: ['--config', '--scenario', '--format', '--backend', '--no-annotate', '--quiet', '--adhoc', '--width', '--height', '--url', '--theme', '--tag', '--dry-run', '--parallel', '--workers', '--profile', '--retry'] },
  { name: 'validate', description: 'Validate config file', options: ['--config'] },
  { name: 'list', description: 'List available scenarios', options: ['--config', '--tag'] },
  { name: 'show', description: 'Show scenario details', options: ['--config'] },
  { name: 'last', description: 'Show last recording info', options: ['--config'] },
  { name: 'stats', description: 'Show recording statistics', options: ['--config'] },
  { name: 'diff', description: 'Compare recording sessions', options: ['--config'] },
  { name: 'changelog', description: 'Generate changelog', options: ['--config'] },
  { name: 'analyze', description: 'Analyze step timing', options: ['--config'] },
  { name: 'baseline', description: 'Manage recording baselines' },
  { name: 'metrics', description: 'Show quality metrics', options: ['--config'] },
  { name: 'visual-diff', description: 'Compare frame descriptions', options: ['--config'] },
  { name: 'summary', description: 'Show session summary', options: ['--config', '--session'] },
  { name: 'matrix', description: 'Show comparison matrix', options: ['--config'] },
  { name: 'tag-stats', description: 'Show tag analytics', options: ['--config'] },
  { name: 'compare', description: 'Compare two sessions', options: ['--config'] },
  { name: 'history', description: 'Show recording history', options: ['--config', '--since', '--scenario', '--status', '--limit'] },
  { name: 'export', description: 'Export recordings', options: ['--config', '--format'] },
  { name: 'replay', description: 'Replay recording steps', options: ['--config'] },
  { name: 'init', description: 'Initialize config file' },
  { name: 'themes', description: 'List available themes' },
  { name: 'profiles', description: 'List recording profiles', options: ['--config'] },
  { name: 'languages', description: 'List annotation languages' },
  { name: 'schema', description: 'Export JSON schema', options: ['--output'] },
  { name: 'templates', description: 'List scenario templates', options: ['--category'] },
  { name: 'extends', description: 'Show extends chain', options: ['--config'] },
  { name: 'migrate', description: 'Migrate config file', options: ['--config', '--dry-run'] },
  { name: 'env', description: 'Show environment info', options: ['--config', '--json'] },
  { name: 'ci', description: 'Generate CI config', options: ['--provider', '--branch', '--no-annotate', '--backend', '--node-version'] },
  { name: 'doctor', description: 'Check system health', options: ['--backend'] },
  { name: 'prune', description: 'Remove old recordings', options: ['--config', '--keep', '--max-age', '--dry-run'] },
  { name: 'watch', description: 'Watch for changes', options: ['--config'] },
  { name: 'serve', description: 'Start MCP server' },
  { name: 'completion', description: 'Generate shell completion', options: ['--shell'] },
  { name: 'plugins', description: 'List registered plugins' },
  { name: 'snapshot', description: 'Manage recording snapshots' },
  { name: 'config-diff', description: 'Compare two config files' },
  { name: 'estimate', description: 'Estimate annotation cost', options: ['--config', '--model', '--fps'] },
  { name: 'lint', description: 'Run config best-practice checks', options: ['--config'] },
  { name: 'check', description: 'Run pre-flight checks', options: ['--config', '--backend'] },
  { name: 'config-merge', description: 'Merge two config files', options: ['--output', '--json'] },
];

/**
 * Generate a bash completion script.
 */
export function generateBashCompletion(): string {
  const commandNames = COMMANDS.map((c) => c.name).join(' ');

  const lines: string[] = [
    '#!/usr/bin/env bash',
    '# Bash completion for demo-recorder',
    '# Install: demo-recorder completion --shell bash >> ~/.bashrc',
    '',
    '_demo_recorder_completion() {',
    '  local cur prev commands',
    '  COMPREPLY=()',
    '  cur="${COMP_WORDS[COMP_CWORD]}"',
    '  prev="${COMP_WORDS[COMP_CWORD-1]}"',
    '',
    `  commands="${commandNames}"`,
    '',
    '  if [[ ${COMP_CWORD} -eq 1 ]]; then',
    '    COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))',
    '    return 0',
    '  fi',
    '',
    '  case "${COMP_WORDS[1]}" in',
  ];

  for (const cmd of COMMANDS) {
    if (cmd.options && cmd.options.length > 0) {
      lines.push(`    ${cmd.name})`);
      lines.push(`      COMPREPLY=($(compgen -W "${cmd.options.join(' ')}" -- "\${cur}"))`);
      lines.push('      ;;');
    }
  }

  lines.push('  esac');
  lines.push('}');
  lines.push('');
  lines.push('complete -F _demo_recorder_completion demo-recorder');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a zsh completion script.
 */
export function generateZshCompletion(): string {
  const lines: string[] = [
    '#compdef demo-recorder',
    '# Zsh completion for demo-recorder',
    '# Install: demo-recorder completion --shell zsh >> ~/.zshrc',
    '',
    '_demo_recorder() {',
    '  local -a commands',
    '  commands=(',
  ];

  for (const cmd of COMMANDS) {
    lines.push(`    '${cmd.name}:${cmd.description}'`);
  }

  lines.push('  )');
  lines.push('');
  lines.push('  _arguments -C \\');
  lines.push("    '1:command:->command' \\");
  lines.push("    '*::arg:->args'");
  lines.push('');
  lines.push('  case $state in');
  lines.push('    command)');
  lines.push("      _describe -t commands 'demo-recorder commands' commands");
  lines.push('      ;;');
  lines.push('    args)');
  lines.push('      case $words[1] in');

  for (const cmd of COMMANDS) {
    if (cmd.options && cmd.options.length > 0) {
      lines.push(`        ${cmd.name})`);
      const optStr = cmd.options.map((o) => `'${o}'`).join(' ');
      lines.push(`          _arguments ${optStr}`);
      lines.push('          ;;');
    }
  }

  lines.push('      esac');
  lines.push('      ;;');
  lines.push('  esac');
  lines.push('}');
  lines.push('');
  lines.push('_demo_recorder');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a fish completion script.
 */
export function generateFishCompletion(): string {
  const lines: string[] = [
    '# Fish completion for demo-recorder',
    '# Install: demo-recorder completion --shell fish > ~/.config/fish/completions/demo-recorder.fish',
    '',
  ];

  for (const cmd of COMMANDS) {
    lines.push(
      `complete -c demo-recorder -n '__fish_use_subcommand' -a '${cmd.name}' -d '${cmd.description}'`,
    );
  }

  lines.push('');

  for (const cmd of COMMANDS) {
    if (cmd.options) {
      for (const opt of cmd.options) {
        const flagName = opt.replace(/^--/, '');
        lines.push(
          `complete -c demo-recorder -n '__fish_seen_subcommand_from ${cmd.name}' -l '${flagName}'`,
        );
      }
    }
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Detect the current shell from environment.
 */
export function detectShell(): 'bash' | 'zsh' | 'fish' | 'unknown' {
  const shell = process.env.SHELL ?? '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  return 'unknown';
}

/**
 * Generate completion script for the specified shell.
 */
export function generateCompletion(shell: 'bash' | 'zsh' | 'fish'): string {
  switch (shell) {
    case 'bash': return generateBashCompletion();
    case 'zsh': return generateZshCompletion();
    case 'fish': return generateFishCompletion();
  }
}
