/** Available VHS terminal themes and their descriptions. */
export interface ThemeInfo {
  /** Display name for human-readable listing. */
  name: string;
  /** Exact VHS theme identifier (used in Set Theme directive). */
  vhsId: string;
  /** Short description of the theme's color palette. */
  description: string;
  /** Category for grouping (dark, light). */
  category: 'dark' | 'light';
}

/** All VHS built-in themes. */
export const VHS_THEMES: ReadonlyArray<ThemeInfo> = [
  // Catppuccin family
  { name: 'Catppuccin Mocha', vhsId: 'Catppuccin Mocha', description: 'Warm dark tones with pastel accents', category: 'dark' },
  { name: 'Catppuccin Frappe', vhsId: 'Catppuccin Frappe', description: 'Medium dark with muted pastels', category: 'dark' },
  { name: 'Catppuccin Macchiato', vhsId: 'Catppuccin Macchiato', description: 'Deep dark with soft pastels', category: 'dark' },
  { name: 'Catppuccin Latte', vhsId: 'Catppuccin Latte', description: 'Light background with warm pastels', category: 'light' },

  // Popular dark themes
  { name: 'Dracula', vhsId: 'Dracula', description: 'Dark purple background with vivid colors', category: 'dark' },
  { name: 'Monokai Remastered', vhsId: 'Monokai Remastered', description: 'Classic dark with vibrant syntax colors', category: 'dark' },
  { name: 'Nord', vhsId: 'nord', description: 'Arctic-inspired cool blue palette', category: 'dark' },
  { name: 'One Dark', vhsId: 'OneDark', description: 'Atom-inspired warm dark theme', category: 'dark' },
  { name: 'Tokyo Night', vhsId: 'TokyoNight', description: 'Dark theme inspired by Tokyo city lights', category: 'dark' },
  { name: 'Solarized Dark', vhsId: 'Builtin Solarized Dark', description: 'Precision dark with warm accents', category: 'dark' },
  { name: 'GitHub Dark', vhsId: 'GitHub Dark', description: 'GitHub dark mode color scheme', category: 'dark' },
  { name: 'Gruvbox Dark', vhsId: 'GruvboxDark', description: 'Retro groove warm dark palette', category: 'dark' },
  { name: 'Ayu Mirage', vhsId: 'Ayu Mirage', description: 'Minimal dark with accent colors', category: 'dark' },
  { name: 'Kanagawa', vhsId: 'Kanagawa', description: 'Dark theme inspired by Japanese art', category: 'dark' },

  // Light themes
  { name: 'Solarized Light', vhsId: 'Builtin Solarized Light', description: 'Precision light with cool accents', category: 'light' },
  { name: 'GitHub Light', vhsId: 'Github', description: 'GitHub light mode color scheme', category: 'light' },
  { name: 'Ayu Light', vhsId: 'ayu_light', description: 'Minimal light with soft colors', category: 'light' },
  { name: 'Rose Pine Dawn', vhsId: 'rose-pine-dawn', description: 'Warm light theme with muted tones', category: 'light' },
];

/**
 * Get a theme by name (case-insensitive). Matches against both display name and VHS ID.
 */
export function findTheme(name: string): ThemeInfo | undefined {
  const lower = name.toLowerCase();
  return VHS_THEMES.find((t) => t.name.toLowerCase() === lower || t.vhsId.toLowerCase() === lower);
}

/**
 * Resolve a theme name to the VHS identifier.
 * Checks the curated theme list first, then falls back to the raw name
 * (allowing users to pass any VHS theme ID directly).
 */
export function resolveThemeId(name: string): string {
  const theme = findTheme(name);
  return theme?.vhsId ?? name;
}

/** Get all theme display names. */
export function getThemeNames(): string[] {
  return VHS_THEMES.map((t) => t.name);
}
