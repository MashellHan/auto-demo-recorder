import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_PROFILES,
  getProfile,
  getProfileNames,
  applyProfile,
  type RecordingProfile,
} from '../src/config/profiles.js';

describe('profiles', () => {
  it('has built-in profiles', () => {
    expect(BUILT_IN_PROFILES.length).toBeGreaterThanOrEqual(3);
  });

  it('includes ci profile', () => {
    const profile = getProfile('ci');
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('ci');
    expect(profile!.recording.format).toBe('mp4');
  });

  it('includes demo profile', () => {
    const profile = getProfile('demo');
    expect(profile).toBeDefined();
    expect(profile!.recording.theme).toBe('Catppuccin Mocha');
  });

  it('includes quick profile', () => {
    const profile = getProfile('quick');
    expect(profile).toBeDefined();
    expect(profile!.recording.max_duration).toBeLessThan(30);
  });

  it('getProfile is case-insensitive', () => {
    const profile = getProfile('CI');
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('ci');
  });

  it('getProfile returns undefined for unknown profile', () => {
    expect(getProfile('nonexistent')).toBeUndefined();
  });

  it('getProfileNames returns all names', () => {
    const names = getProfileNames();
    expect(names.length).toBe(BUILT_IN_PROFILES.length);
    expect(names).toContain('ci');
    expect(names).toContain('demo');
    expect(names).toContain('quick');
  });

  it('applyProfile merges recording settings', () => {
    const baseConfig = {
      recording: {
        width: 1200,
        height: 800,
        font_size: 16,
        theme: 'Nord',
        fps: 25,
        max_duration: 60,
        format: 'mp4' as const,
      },
      annotation: {
        enabled: true,
        model: 'claude-sonnet-4-6',
      },
    };

    const profile: RecordingProfile = {
      name: 'test',
      description: 'Test profile',
      recording: { width: 800, height: 600, format: 'gif' as const },
      annotation: { enabled: false },
    };

    const result = applyProfile(baseConfig, profile);

    expect(result.recording.width).toBe(800);
    expect(result.recording.height).toBe(600);
    expect(result.recording.format).toBe('gif');
    // Non-overridden values preserved
    expect(result.recording.theme).toBe('Nord');
    expect(result.recording.fps).toBe(25);
    // Annotation merged
    expect(result.annotation.enabled).toBe(false);
    expect(result.annotation.model).toBe('claude-sonnet-4-6');
  });

  it('applyProfile does not mutate original config', () => {
    const baseConfig = {
      recording: { width: 1200, height: 800, theme: 'Nord' },
      annotation: { enabled: true },
    };

    const profile: RecordingProfile = {
      name: 'test',
      description: 'Test',
      recording: { width: 800 },
    };

    const result = applyProfile(baseConfig, profile);

    expect(result).not.toBe(baseConfig);
    expect(baseConfig.recording.width).toBe(1200);
    expect(result.recording.width).toBe(800);
  });

  it('all profiles have required fields', () => {
    for (const profile of BUILT_IN_PROFILES) {
      expect(profile.name).toBeTruthy();
      expect(profile.description).toBeTruthy();
      expect(profile.recording).toBeDefined();
    }
  });
});
