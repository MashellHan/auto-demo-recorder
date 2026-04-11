/** Named recording profile with preset configuration overrides. */
export interface RecordingProfile {
  /** Profile name (e.g., 'ci', 'demo', 'quick'). */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Recording configuration overrides. */
  recording: Record<string, unknown>;
  /** Annotation configuration overrides. */
  annotation?: Record<string, unknown>;
  /** Output configuration overrides. */
  output?: Record<string, unknown>;
}

/** Built-in recording profiles. */
export const BUILT_IN_PROFILES: ReadonlyArray<RecordingProfile> = [
  {
    name: 'ci',
    description: 'Minimal settings optimized for CI/CD pipelines',
    recording: {
      width: 800,
      height: 600,
      font_size: 14,
      fps: 10,
      max_duration: 30,
      format: 'mp4',
    },
    annotation: {
      enabled: true,
      extract_fps: 0.5,
    },
    output: {
      keep_raw: false,
      keep_frames: false,
    },
  },
  {
    name: 'demo',
    description: 'High-quality settings for demo videos and presentations',
    recording: {
      width: 1400,
      height: 900,
      font_size: 18,
      theme: 'Catppuccin Mocha',
      fps: 30,
      max_duration: 120,
      format: 'mp4',
    },
    annotation: {
      enabled: true,
      extract_fps: 2,
      overlay_font_size: 16,
    },
    output: {
      keep_raw: true,
      player: true,
      docs: true,
    },
  },
  {
    name: 'quick',
    description: 'Fast recording with minimal processing for development',
    recording: {
      width: 800,
      height: 600,
      font_size: 14,
      fps: 15,
      max_duration: 15,
      format: 'gif',
    },
    annotation: {
      enabled: false,
    },
    output: {
      keep_raw: false,
      keep_frames: false,
    },
  },
  {
    name: 'presentation',
    description: 'Extra-large format for slides and conference talks',
    recording: {
      width: 1920,
      height: 1080,
      font_size: 22,
      theme: 'Dracula',
      fps: 30,
      max_duration: 180,
      format: 'mp4',
      frame: { style: 'colorful', title: 'Demo' },
    },
    annotation: {
      enabled: true,
      extract_fps: 2,
      overlay_font_size: 18,
    },
    output: {
      keep_raw: true,
      player: true,
      docs: true,
    },
  },
];

/**
 * Get a profile by name (case-insensitive).
 * Searches custom profiles first, then built-in profiles.
 */
export function getProfile(name: string, customProfiles?: RecordingProfile[]): RecordingProfile | undefined {
  const lower = name.toLowerCase();
  // Custom profiles take precedence over built-in
  const custom = customProfiles?.find((p) => p.name.toLowerCase() === lower);
  if (custom) return custom;
  return BUILT_IN_PROFILES.find((p) => p.name.toLowerCase() === lower);
}

/**
 * Get all available profile names (built-in + custom).
 */
export function getProfileNames(customProfiles?: RecordingProfile[]): string[] {
  const builtIn = BUILT_IN_PROFILES.map((p) => p.name);
  const custom = (customProfiles ?? []).map((p) => p.name);
  // Deduplicate (custom overrides built-in by name)
  return [...new Set([...custom, ...builtIn])];
}

/**
 * Get all available profiles (built-in + custom, custom takes precedence).
 */
export function getAllProfiles(customProfiles?: RecordingProfile[]): RecordingProfile[] {
  const custom = customProfiles ?? [];
  const customNames = new Set(custom.map((p) => p.name.toLowerCase()));
  const builtIn = BUILT_IN_PROFILES.filter((p) => !customNames.has(p.name.toLowerCase()));
  return [...custom, ...builtIn];
}

/**
 * Parse custom profiles from a config object's profiles section.
 */
export function parseCustomProfiles(profilesConfig: Record<string, unknown>[] | undefined): RecordingProfile[] {
  if (!profilesConfig || !Array.isArray(profilesConfig)) return [];

  return profilesConfig
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => ({
      name: String(p.name ?? 'custom'),
      description: String(p.description ?? ''),
      recording: (p.recording ?? {}) as Record<string, unknown>,
      annotation: p.annotation as Record<string, unknown> | undefined,
      output: p.output as Record<string, unknown> | undefined,
    }));
}

/**
 * Apply a profile's overrides to a configuration object.
 * Returns a new object — does not mutate the original.
 */
export function applyProfile<T extends Record<string, unknown>>(
  config: T,
  profile: RecordingProfile,
): T {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(config)) {
    const configVal = config[key];
    const profileVal =
      key === 'recording' ? profile.recording :
      key === 'annotation' ? profile.annotation :
      key === 'output' ? profile.output :
      undefined;

    if (
      profileVal !== undefined &&
      configVal !== null &&
      typeof configVal === 'object' &&
      !Array.isArray(configVal)
    ) {
      result[key] = { ...(configVal as Record<string, unknown>), ...profileVal };
    } else {
      result[key] = configVal;
    }
  }

  return result as T;
}
