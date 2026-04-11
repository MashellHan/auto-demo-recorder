/** Available VHS terminal themes and their descriptions. */
export interface ThemeInfo {
  /** Theme name (exactly as used in VHS tape). */
  name: string;
  /** Short description of the theme's color palette. */
  description: string;
  /** Category for grouping (dark, light). */
  category: 'dark' | 'light';
}

/** All VHS built-in themes. */
export const VHS_THEMES: ReadonlyArray<ThemeInfo> = [
  // Catppuccin family
  { name: 'Catppuccin Mocha', description: 'Warm dark tones with pastel accents', category: 'dark' },
  { name: 'Catppuccin Frappe', description: 'Medium dark with muted pastels', category: 'dark' },
  { name: 'Catppuccin Macchiato', description: 'Deep dark with soft pastels', category: 'dark' },
  { name: 'Catppuccin Latte', description: 'Light background with warm pastels', category: 'light' },

  // Popular dark themes
  { name: 'Dracula', description: 'Dark purple background with vivid colors', category: 'dark' },
  { name: 'Monokai', description: 'Classic dark with vibrant syntax colors', category: 'dark' },
  { name: 'Nord', description: 'Arctic-inspired cool blue palette', category: 'dark' },
  { name: 'One Dark', description: 'Atom-inspired warm dark theme', category: 'dark' },
  { name: 'Tokyo Night', description: 'Dark theme inspired by Tokyo city lights', category: 'dark' },
  { name: 'Solarized Dark', description: 'Precision dark with warm accents', category: 'dark' },
  { name: 'GitHub Dark', description: 'GitHub dark mode color scheme', category: 'dark' },
  { name: 'Gruvbox', description: 'Retro groove warm dark palette', category: 'dark' },
  { name: 'Ayu Dark', description: 'Minimal dark with accent colors', category: 'dark' },
  { name: 'Kanagawa', description: 'Dark theme inspired by Japanese art', category: 'dark' },

  // Light themes
  { name: 'Solarized Light', description: 'Precision light with cool accents', category: 'light' },
  { name: 'GitHub Light', description: 'GitHub light mode color scheme', category: 'light' },
  { name: 'Ayu Light', description: 'Minimal light with soft colors', category: 'light' },
  { name: 'Rose Pine Dawn', description: 'Warm light theme with muted tones', category: 'light' },
];

/** Get a theme by name (case-insensitive). */
export function findTheme(name: string): ThemeInfo | undefined {
  const lower = name.toLowerCase();
  return VHS_THEMES.find((t) => t.name.toLowerCase() === lower);
}

/** Get all theme names. */
export function getThemeNames(): string[] {
  return VHS_THEMES.map((t) => t.name);
}
