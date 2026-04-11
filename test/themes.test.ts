import { describe, it, expect } from 'vitest';
import { VHS_THEMES, findTheme, getThemeNames, resolveThemeId } from '../src/config/themes.js';

describe('themes', () => {
  it('has at least 10 themes', () => {
    expect(VHS_THEMES.length).toBeGreaterThanOrEqual(10);
  });

  it('includes default theme Catppuccin Mocha', () => {
    const theme = findTheme('Catppuccin Mocha');
    expect(theme).toBeDefined();
    expect(theme!.category).toBe('dark');
    expect(theme!.vhsId).toBe('Catppuccin Mocha');
  });

  it('findTheme is case-insensitive', () => {
    const theme = findTheme('dracula');
    expect(theme).toBeDefined();
    expect(theme!.name).toBe('Dracula');
  });

  it('findTheme matches by VHS ID', () => {
    const theme = findTheme('nord');
    expect(theme).toBeDefined();
    expect(theme!.name).toBe('Nord');
    expect(theme!.vhsId).toBe('nord');
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
      expect(theme.vhsId).toBeTruthy();
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

  it('resolveThemeId maps display names to VHS identifiers', () => {
    expect(resolveThemeId('Nord')).toBe('nord');
    expect(resolveThemeId('One Dark')).toBe('OneDark');
    expect(resolveThemeId('Tokyo Night')).toBe('TokyoNight');
    expect(resolveThemeId('Solarized Dark')).toBe('Builtin Solarized Dark');
    expect(resolveThemeId('Gruvbox Dark')).toBe('GruvboxDark');
    expect(resolveThemeId('Rose Pine Dawn')).toBe('rose-pine-dawn');
  });

  it('resolveThemeId falls back to raw name for unknown themes', () => {
    expect(resolveThemeId('CustomTheme')).toBe('CustomTheme');
  });

  it('resolveThemeId is case-insensitive', () => {
    expect(resolveThemeId('nord')).toBe('nord');
    expect(resolveThemeId('NORD')).toBe('nord');
  });

  it('resolves "Monokai" alias to "Molokai" VHS ID', () => {
    const theme = findTheme('Monokai');
    expect(theme).toBeDefined();
    expect(resolveThemeId('Monokai')).toBe('Molokai');
  });

  it('resolves "Gruvbox" alias to "GruvboxDark" VHS ID', () => {
    const theme = findTheme('Gruvbox');
    expect(theme).toBeDefined();
    expect(resolveThemeId('Gruvbox')).toBe('GruvboxDark');
  });

  it('resolves "Ayu Dark" alias to "ayu" VHS ID', () => {
    const theme = findTheme('Ayu Dark');
    expect(theme).toBeDefined();
    expect(resolveThemeId('Ayu Dark')).toBe('ayu');
  });
});
