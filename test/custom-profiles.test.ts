import { describe, it, expect } from 'vitest';
import {
  getProfile,
  getProfileNames,
  getAllProfiles,
  parseCustomProfiles,
  BUILT_IN_PROFILES,
} from '../src/config/profiles.js';
import { ConfigSchema } from '../src/config/schema.js';

describe('getProfile with custom profiles', () => {
  it('returns built-in profile when no custom profiles', () => {
    const profile = getProfile('ci');
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('ci');
  });

  it('custom profile overrides built-in with same name', () => {
    const custom = [
      { name: 'ci', description: 'Custom CI', recording: { width: 640 } },
    ];
    const profile = getProfile('ci', custom);
    expect(profile).toBeDefined();
    expect(profile!.description).toBe('Custom CI');
    expect(profile!.recording.width).toBe(640);
  });

  it('finds custom profile by name', () => {
    const custom = [
      { name: 'staging', description: 'Staging env', recording: { width: 1024 } },
    ];
    const profile = getProfile('staging', custom);
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('staging');
  });

  it('returns undefined for unknown name', () => {
    expect(getProfile('nonexistent')).toBeUndefined();
  });
});

describe('getProfileNames with custom profiles', () => {
  it('includes both built-in and custom names', () => {
    const custom = [
      { name: 'staging', description: 'Staging', recording: {} },
    ];
    const names = getProfileNames(custom);
    expect(names).toContain('staging');
    expect(names).toContain('ci');
    expect(names).toContain('demo');
  });

  it('deduplicates when custom overrides built-in', () => {
    const custom = [
      { name: 'ci', description: 'Custom CI', recording: {} },
    ];
    const names = getProfileNames(custom);
    const ciCount = names.filter((n) => n === 'ci').length;
    expect(ciCount).toBe(1);
  });
});

describe('getAllProfiles', () => {
  it('returns all profiles with custom taking precedence', () => {
    const custom = [
      { name: 'ci', description: 'Custom CI', recording: { width: 640 } },
      { name: 'staging', description: 'Staging', recording: {} },
    ];
    const all = getAllProfiles(custom);
    const ciProfile = all.find((p) => p.name === 'ci');
    expect(ciProfile!.description).toBe('Custom CI');
    expect(all.find((p) => p.name === 'staging')).toBeDefined();
    expect(all.find((p) => p.name === 'demo')).toBeDefined();
  });

  it('returns only built-in when no custom', () => {
    const all = getAllProfiles();
    expect(all.length).toBe(BUILT_IN_PROFILES.length);
  });
});

describe('parseCustomProfiles', () => {
  it('parses valid profile configs', () => {
    const input = [
      { name: 'staging', description: 'Staging env', recording: { width: 1024 } },
    ];
    const profiles = parseCustomProfiles(input);
    expect(profiles.length).toBe(1);
    expect(profiles[0].name).toBe('staging');
    expect(profiles[0].recording.width).toBe(1024);
  });

  it('returns empty for undefined input', () => {
    expect(parseCustomProfiles(undefined)).toEqual([]);
  });

  it('returns empty for non-array input', () => {
    expect(parseCustomProfiles({} as any)).toEqual([]);
  });

  it('uses default name for profiles without name', () => {
    const input = [{ description: 'No name', recording: {} }];
    const profiles = parseCustomProfiles(input as any);
    expect(profiles[0].name).toBe('custom');
  });
});

describe('ConfigSchema profiles field', () => {
  const minConfig = {
    project: { name: 'test' },
    scenarios: [{ name: 'demo', description: 'test', steps: [{ action: 'type', value: 'echo hi' }] }],
  };

  it('accepts config with profiles array', () => {
    const config = ConfigSchema.parse({
      ...minConfig,
      profiles: [
        { name: 'ultra-hd', description: '4K preset', recording: { width: 3840, height: 2160 } },
      ],
    });
    expect(config.profiles).toHaveLength(1);
    expect(config.profiles[0].name).toBe('ultra-hd');
  });

  it('defaults profiles to empty array', () => {
    const config = ConfigSchema.parse(minConfig);
    expect(config.profiles).toEqual([]);
  });

  it('custom profiles from schema integrate with getProfile', () => {
    const config = ConfigSchema.parse({
      ...minConfig,
      profiles: [
        { name: 'staging', description: 'Staging env', recording: { width: 1024 } },
      ],
    });
    const custom = parseCustomProfiles(config.profiles as Record<string, unknown>[]);
    const profile = getProfile('staging', custom);
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('staging');
  });
});
