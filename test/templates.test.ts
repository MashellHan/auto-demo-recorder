import { describe, it, expect } from 'vitest';
import {
  SCENARIO_TEMPLATES,
  findTemplate,
  listTemplates,
  listTemplatesByCategory,
  getTemplateCategories,
} from '../src/config/templates.js';

describe('SCENARIO_TEMPLATES', () => {
  it('has at least 5 templates', () => {
    expect(SCENARIO_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('each template has required fields', () => {
    for (const t of SCENARIO_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(Array.isArray(t.tags)).toBe(true);
      expect(Array.isArray(t.steps)).toBe(true);
      expect(t.steps.length).toBeGreaterThan(0);
    }
  });

  it('has unique IDs', () => {
    const ids = SCENARIO_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('findTemplate', () => {
  it('finds template by ID', () => {
    const t = findTemplate('npm-test');
    expect(t).toBeDefined();
    expect(t!.name).toBe('NPM Test Run');
  });

  it('returns undefined for unknown ID', () => {
    expect(findTemplate('nonexistent')).toBeUndefined();
  });
});

describe('listTemplates', () => {
  it('returns all templates', () => {
    const templates = listTemplates();
    expect(templates.length).toBe(SCENARIO_TEMPLATES.length);
  });
});

describe('listTemplatesByCategory', () => {
  it('filters by category', () => {
    const devtools = listTemplatesByCategory('devtools');
    expect(devtools.length).toBeGreaterThan(0);
    expect(devtools.every((t) => t.category === 'devtools')).toBe(true);
  });

  it('returns empty for unknown category', () => {
    expect(listTemplatesByCategory('nonexistent')).toEqual([]);
  });
});

describe('getTemplateCategories', () => {
  it('returns unique categories', () => {
    const categories = getTemplateCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('includes devtools category', () => {
    expect(getTemplateCategories()).toContain('devtools');
  });
});
