import { describe, it, expect } from 'vitest';
import {
  listScaffolds,
  findScaffold,
  getScaffoldCategories,
  listScaffoldsByCategory,
  formatScaffoldList,
} from '../src/config/scaffold.js';

describe('listScaffolds', () => {
  it('returns all scaffolds', () => {
    const scaffolds = listScaffolds();
    expect(scaffolds.length).toBeGreaterThanOrEqual(5);
  });

  it('each scaffold has required fields', () => {
    for (const s of listScaffolds()) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.yaml).toBeTruthy();
      expect(s.yaml).toContain('project:');
      expect(s.yaml).toContain('recording:');
    }
  });
});

describe('findScaffold', () => {
  it('finds by exact ID', () => {
    const s = findScaffold('cli-basic');
    expect(s).toBeDefined();
    expect(s!.name).toBe('CLI Basic');
  });

  it('finds case-insensitively', () => {
    const s = findScaffold('CLI-BASIC');
    expect(s).toBeDefined();
  });

  it('returns undefined for unknown ID', () => {
    const s = findScaffold('nonexistent');
    expect(s).toBeUndefined();
  });
});

describe('getScaffoldCategories', () => {
  it('returns sorted unique categories', () => {
    const cats = getScaffoldCategories();
    expect(cats.length).toBeGreaterThanOrEqual(2);
    // Check sorted
    for (let i = 1; i < cats.length; i++) {
      expect(cats[i] >= cats[i - 1]).toBe(true);
    }
  });

  it('includes cli and web', () => {
    const cats = getScaffoldCategories();
    expect(cats).toContain('cli');
    expect(cats).toContain('web');
  });
});

describe('listScaffoldsByCategory', () => {
  it('filters by category', () => {
    const cliScaffolds = listScaffoldsByCategory('cli');
    expect(cliScaffolds.length).toBeGreaterThanOrEqual(2);
    for (const s of cliScaffolds) {
      expect(s.category).toBe('cli');
    }
  });

  it('returns empty for unknown category', () => {
    const result = listScaffoldsByCategory('unknown-category');
    expect(result.length).toBe(0);
  });

  it('is case-insensitive', () => {
    const result = listScaffoldsByCategory('CLI');
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});

describe('formatScaffoldList', () => {
  it('formats all scaffolds', () => {
    const text = formatScaffoldList(listScaffolds());
    expect(text).toContain('Config Scaffolds');
    expect(text).toContain('cli-basic');
    expect(text).toContain('web-app');
    expect(text).toContain('Total:');
  });

  it('groups by category', () => {
    const text = formatScaffoldList(listScaffolds());
    expect(text).toContain('CLI');
    expect(text).toContain('WEB');
  });

  it('shows empty message for no scaffolds', () => {
    const text = formatScaffoldList([]);
    expect(text).toContain('No scaffolds found');
  });

  it('shows usage hint', () => {
    const text = formatScaffoldList(listScaffolds());
    expect(text).toContain('scaffold');
  });
});
