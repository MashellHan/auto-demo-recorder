/**
 * Extensible plugin system for custom step actions, output formats, and hooks.
 */

/** Hook points where plugins can intercept. */
export interface PluginHooks {
  /** Called before recording starts. */
  beforeRecord?: (scenario: string) => Promise<void>;
  /** Called after recording completes. */
  afterRecord?: (scenario: string, success: boolean) => Promise<void>;
  /** Called before annotation. */
  beforeAnnotate?: (scenario: string) => Promise<void>;
  /** Called after annotation completes. */
  afterAnnotate?: (scenario: string) => Promise<void>;
}

/** Custom step action definition. */
export interface StepAction {
  /** Action name (e.g., 'custom-wait'). */
  name: string;
  /** Description of what the action does. */
  description: string;
  /** Execute the action with the given value. */
  execute: (value: string) => Promise<void>;
}

/** Custom output format definition. */
export interface OutputFormat {
  /** Format name (e.g., 'webm'). */
  name: string;
  /** File extension. */
  extension: string;
  /** Description. */
  description: string;
}

/** Plugin interface — all fields optional except name and version. */
export interface Plugin {
  /** Unique plugin name. */
  name: string;
  /** Semantic version (e.g., '1.0.0'). */
  version: string;
  /** Plugin description. */
  description?: string;
  /** Custom step actions to register. */
  stepActions?: StepAction[];
  /** Custom output formats to register. */
  outputFormats?: OutputFormat[];
  /** Lifecycle hooks. */
  hooks?: PluginHooks;
}

/** Plugin registration result. */
export interface PluginRegistration {
  /** Plugin name. */
  name: string;
  /** Whether registration succeeded. */
  success: boolean;
  /** Error message if registration failed. */
  error?: string;
}

/**
 * Plugin registry for managing loaded plugins.
 * Plugins register custom actions, formats, and hooks.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, Plugin>();
  private readonly stepActions = new Map<string, StepAction>();
  private readonly outputFormats = new Map<string, OutputFormat>();

  /**
   * Register a plugin. Returns registration result.
   * Fails if a plugin with the same name is already registered.
   */
  register(plugin: Plugin): PluginRegistration {
    const lower = plugin.name.toLowerCase();

    if (this.plugins.has(lower)) {
      return {
        name: plugin.name,
        success: false,
        error: `Plugin "${plugin.name}" is already registered`,
      };
    }

    // Register step actions
    if (plugin.stepActions) {
      for (const action of plugin.stepActions) {
        if (this.stepActions.has(action.name)) {
          return {
            name: plugin.name,
            success: false,
            error: `Step action "${action.name}" is already registered by another plugin`,
          };
        }
        this.stepActions.set(action.name, action);
      }
    }

    // Register output formats
    if (plugin.outputFormats) {
      for (const format of plugin.outputFormats) {
        if (this.outputFormats.has(format.name)) {
          return {
            name: plugin.name,
            success: false,
            error: `Output format "${format.name}" is already registered by another plugin`,
          };
        }
        this.outputFormats.set(format.name, format);
      }
    }

    this.plugins.set(lower, plugin);
    return { name: plugin.name, success: true };
  }

  /** Get all registered plugins. */
  getPlugins(): Plugin[] {
    return [...this.plugins.values()];
  }

  /** Get a plugin by name. */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name.toLowerCase());
  }

  /** Get all registered step actions. */
  getStepActions(): StepAction[] {
    return [...this.stepActions.values()];
  }

  /** Get a step action by name. */
  getStepAction(name: string): StepAction | undefined {
    return this.stepActions.get(name);
  }

  /** Get all registered output formats. */
  getOutputFormats(): OutputFormat[] {
    return [...this.outputFormats.values()];
  }

  /** Get a specific output format by name. */
  getOutputFormat(name: string): OutputFormat | undefined {
    return this.outputFormats.get(name);
  }

  /** Check if a plugin is registered. */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name.toLowerCase());
  }

  /** Unregister a plugin and its contributions. */
  unregister(name: string): boolean {
    const lower = name.toLowerCase();
    const plugin = this.plugins.get(lower);
    if (!plugin) return false;

    // Remove step actions
    if (plugin.stepActions) {
      for (const action of plugin.stepActions) {
        this.stepActions.delete(action.name);
      }
    }

    // Remove output formats
    if (plugin.outputFormats) {
      for (const format of plugin.outputFormats) {
        this.outputFormats.delete(format.name);
      }
    }

    this.plugins.delete(lower);
    return true;
  }
}

/**
 * Format plugin list as human-readable text.
 */
export function formatPluginList(plugins: Plugin[]): string {
  const lines: string[] = [];

  if (plugins.length === 0) {
    lines.push('  No plugins registered.');
    return lines.join('\n');
  }

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  Registered Plugins');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  for (const plugin of plugins) {
    lines.push(`  ${plugin.name} v${plugin.version}`);
    if (plugin.description) {
      lines.push(`    ${plugin.description}`);
    }
    if (plugin.stepActions && plugin.stepActions.length > 0) {
      lines.push(`    Step actions: ${plugin.stepActions.map((a) => a.name).join(', ')}`);
    }
    if (plugin.outputFormats && plugin.outputFormats.length > 0) {
      lines.push(`    Output formats: ${plugin.outputFormats.map((f) => f.name).join(', ')}`);
    }
    if (plugin.hooks) {
      const hookNames = Object.keys(plugin.hooks).filter(
        (k) => (plugin.hooks as Record<string, unknown>)[k] !== undefined,
      );
      if (hookNames.length > 0) {
        lines.push(`    Hooks: ${hookNames.join(', ')}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
