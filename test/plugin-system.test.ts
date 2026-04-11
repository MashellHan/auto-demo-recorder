import { describe, it, expect } from 'vitest';
import {
  PluginRegistry,
  formatPluginList,
  type Plugin,
  type StepAction,
  type OutputFormat,
} from '../src/pipeline/plugin-system.js';

describe('PluginRegistry', () => {
  it('registers and retrieves a plugin', () => {
    const registry = new PluginRegistry();
    const plugin: Plugin = { name: 'test-plugin', version: '1.0.0', description: 'Test' };
    const result = registry.register(plugin);
    expect(result.success).toBe(true);
    expect(registry.getPlugin('test-plugin')).toBeDefined();
    expect(registry.getPlugins()).toHaveLength(1);
  });

  it('rejects duplicate plugin name', () => {
    const registry = new PluginRegistry();
    registry.register({ name: 'dup', version: '1.0.0' });
    const result = registry.register({ name: 'dup', version: '2.0.0' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('already registered');
  });

  it('registers plugin with custom step action', () => {
    const registry = new PluginRegistry();
    const action: StepAction = {
      name: 'custom-wait',
      description: 'Custom wait',
      execute: async () => {},
    };
    const result = registry.register({
      name: 'step-plugin',
      version: '1.0.0',
      stepActions: [action],
    });
    expect(result.success).toBe(true);
    expect(registry.getStepActions()).toHaveLength(1);
    expect(registry.getStepAction('custom-wait')).toBeDefined();
  });

  it('registers plugin with custom output format', () => {
    const registry = new PluginRegistry();
    const format: OutputFormat = {
      name: 'webm',
      extension: '.webm',
      description: 'WebM video format',
    };
    const result = registry.register({
      name: 'format-plugin',
      version: '1.0.0',
      outputFormats: [format],
    });
    expect(result.success).toBe(true);
    expect(registry.getOutputFormats()).toHaveLength(1);
    expect(registry.getOutputFormat('webm')).toBeDefined();
  });

  it('rejects duplicate step action name', () => {
    const registry = new PluginRegistry();
    const action: StepAction = {
      name: 'shared-action',
      description: 'Action',
      execute: async () => {},
    };
    registry.register({ name: 'plugin-a', version: '1.0.0', stepActions: [action] });
    const result = registry.register({
      name: 'plugin-b',
      version: '1.0.0',
      stepActions: [{ ...action }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('shared-action');
  });

  it('checks plugin existence', () => {
    const registry = new PluginRegistry();
    registry.register({ name: 'exists', version: '1.0.0' });
    expect(registry.hasPlugin('exists')).toBe(true);
    expect(registry.hasPlugin('missing')).toBe(false);
  });

  it('case-insensitive plugin lookup', () => {
    const registry = new PluginRegistry();
    registry.register({ name: 'MyPlugin', version: '1.0.0' });
    expect(registry.hasPlugin('myplugin')).toBe(true);
    expect(registry.getPlugin('MYPLUGIN')).toBeDefined();
  });

  it('unregisters plugin and its contributions', () => {
    const registry = new PluginRegistry();
    registry.register({
      name: 'removable',
      version: '1.0.0',
      stepActions: [{ name: 'temp-action', description: 'Temp', execute: async () => {} }],
      outputFormats: [{ name: 'temp-fmt', extension: '.tmp', description: 'Temp' }],
    });
    expect(registry.hasPlugin('removable')).toBe(true);
    expect(registry.getStepAction('temp-action')).toBeDefined();

    const removed = registry.unregister('removable');
    expect(removed).toBe(true);
    expect(registry.hasPlugin('removable')).toBe(false);
    expect(registry.getStepAction('temp-action')).toBeUndefined();
    expect(registry.getOutputFormat('temp-fmt')).toBeUndefined();
  });

  it('returns false for unregistering non-existent plugin', () => {
    const registry = new PluginRegistry();
    expect(registry.unregister('ghost')).toBe(false);
  });
});

describe('formatPluginList', () => {
  it('shows no plugins message for empty list', () => {
    const output = formatPluginList([]);
    expect(output).toContain('No plugins registered');
  });

  it('formats plugin with details', () => {
    const output = formatPluginList([
      {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        stepActions: [{ name: 'custom-action', description: 'Custom', execute: async () => {} }],
        outputFormats: [{ name: 'webm', extension: '.webm', description: 'WebM' }],
      },
    ]);
    expect(output).toContain('test-plugin');
    expect(output).toContain('v1.0.0');
    expect(output).toContain('A test plugin');
    expect(output).toContain('custom-action');
    expect(output).toContain('webm');
  });
});
