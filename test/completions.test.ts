import { describe, it, expect } from 'vitest';
import {
  generateBashCompletion,
  generateZshCompletion,
  generateFishCompletion,
  generateCompletion,
  detectShell,
} from '../src/config/completions.js';

describe('generateBashCompletion', () => {
  it('generates valid bash script', () => {
    const script = generateBashCompletion();
    expect(script).toContain('#!/usr/bin/env bash');
    expect(script).toContain('_demo_recorder_completion');
    expect(script).toContain('complete -F');
  });

  it('includes all major command names', () => {
    const script = generateBashCompletion();
    expect(script).toContain('record');
    expect(script).toContain('validate');
    expect(script).toContain('analyze');
    expect(script).toContain('metrics');
    expect(script).toContain('matrix');
    expect(script).toContain('history');
    expect(script).toContain('compare');
    expect(script).toContain('doctor');
    expect(script).toContain('prune');
    expect(script).toContain('plugins');
    expect(script).toContain('snapshot');
    expect(script).toContain('config-diff');
  });

  it('does not include phantom commands', () => {
    const script = generateBashCompletion();
    expect(script).not.toContain('bundle');
    expect(script).not.toContain('init-browser');
    expect(script).not.toContain('mcp-server');
  });

  it('includes options for commands', () => {
    const script = generateBashCompletion();
    expect(script).toContain('--config');
    expect(script).toContain('--dry-run');
    expect(script).toContain('--profile');
  });
});

describe('generateZshCompletion', () => {
  it('generates valid zsh script', () => {
    const script = generateZshCompletion();
    expect(script).toContain('#compdef');
    expect(script).toContain('_demo_recorder');
    expect(script).toContain('commands=(');
  });

  it('includes command descriptions', () => {
    const script = generateZshCompletion();
    expect(script).toContain('Record demo scenarios');
    expect(script).toContain('Validate config file');
    expect(script).toContain('Show quality metrics');
  });
});

describe('generateFishCompletion', () => {
  it('generates valid fish script', () => {
    const script = generateFishCompletion();
    expect(script).toContain('complete -c demo-recorder');
    expect(script).toContain('__fish_use_subcommand');
  });

  it('includes subcommand completions', () => {
    const script = generateFishCompletion();
    expect(script).toContain('__fish_seen_subcommand_from record');
    expect(script).toContain("'config'");
  });
});

describe('generateCompletion', () => {
  it('generates bash completion', () => {
    const script = generateCompletion('bash');
    expect(script).toContain('#!/usr/bin/env bash');
  });

  it('generates zsh completion', () => {
    const script = generateCompletion('zsh');
    expect(script).toContain('#compdef');
  });

  it('generates fish completion', () => {
    const script = generateCompletion('fish');
    expect(script).toContain('complete -c demo-recorder');
  });
});

describe('detectShell', () => {
  it('returns a shell type', () => {
    const shell = detectShell();
    expect(['bash', 'zsh', 'fish', 'unknown']).toContain(shell);
  });
});
