import { describe, it, expect } from 'vitest';
import { VHS_THEMES, findTheme, getThemeNames } from '../src/config/themes.js';

describe('themes', () => {
  it('has at least 10 themes', () => {
    expect(VHS_THEMES.length).toBeGreaterThanOrEqual(10);
  });

  it('includes default theme Catppuccin Mocha', () => {
    const theme = findTheme('Catppuccin Mocha');
    expect(theme).toBeDefined();
    expect(theme!.category).toBe('dark');
  });

  it('findTheme is case-insensitive', () => {
    const theme = findTheme('dracula');
    expect(theme).toBeDefined();
    expect(theme!.name).toBe('Dracula');
  });

  it('findTheme returns undefined for unknown theme', () => {
    expect(findTheme('NonExistent Theme')).toBeUndefined();
  });

  it('getThemeNames returns all names', () => {
    const names = getThemeNames();
    expect(names.length).toBe(VHS_THEMES.length);
    expect(names).toContain('Dracula');
    expect(names).toContain('Nord');
  });

  it('all themes have required fields', () => {
    for (const theme of VHS_THEMES) {
      expect(theme.name).toBeTruthy();
      expect(theme.description).toBeTruthy();
      expect(['dark', 'light']).toContain(theme.category);
    }
  });

  it('has both dark and light themes', () => {
    const dark = VHS_THEMES.filter((t) => t.category === 'dark');
    const light = VHS_THEMES.filter((t) => t.category === 'light');
    expect(dark.length).toBeGreaterThan(0);
    expect(light.length).toBeGreaterThan(0);
  });
});
