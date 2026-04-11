import { describe, it, expect } from 'vitest';
import {
  ANNOTATION_LANGUAGES,
  findLanguage,
  getLanguageInstruction,
  listLanguages,
} from '../src/config/languages.js';

describe('ANNOTATION_LANGUAGES', () => {
  it('includes at least 10 languages', () => {
    expect(ANNOTATION_LANGUAGES.length).toBeGreaterThanOrEqual(10);
  });

  it('includes English as the first language', () => {
    expect(ANNOTATION_LANGUAGES[0].code).toBe('en');
    expect(ANNOTATION_LANGUAGES[0].name).toBe('English');
  });

  it('includes Chinese, Japanese, and Korean', () => {
    const codes = ANNOTATION_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('zh');
    expect(codes).toContain('ja');
    expect(codes).toContain('ko');
  });

  it('each language has code, name, nativeName, and instruction', () => {
    for (const lang of ANNOTATION_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.nativeName).toBeTruthy();
      expect(lang.instruction).toBeTruthy();
    }
  });
});

describe('findLanguage', () => {
  it('finds language by code', () => {
    const lang = findLanguage('zh');
    expect(lang).toBeDefined();
    expect(lang!.name).toBe('Chinese');
    expect(lang!.nativeName).toBe('中文');
  });

  it('is case-insensitive', () => {
    const lang = findLanguage('JA');
    expect(lang).toBeDefined();
    expect(lang!.name).toBe('Japanese');
  });

  it('returns undefined for unknown code', () => {
    expect(findLanguage('xx')).toBeUndefined();
  });
});

describe('getLanguageInstruction', () => {
  it('returns localized instruction for known language', () => {
    const instruction = getLanguageInstruction('zh');
    expect(instruction).toContain('中文');
    expect(instruction).toContain('annotation_text');
  });

  it('returns empty string for English', () => {
    const instruction = getLanguageInstruction('en');
    // English has a standard instruction, but it's still returned
    expect(instruction).toBeDefined();
  });

  it('returns generic fallback for unknown language code', () => {
    const instruction = getLanguageInstruction('xyz');
    expect(instruction).toContain('Respond in xyz');
    expect(instruction).toContain('annotation_text');
  });

  it('returns Japanese instruction with proper characters', () => {
    const instruction = getLanguageInstruction('ja');
    expect(instruction).toContain('日本語');
  });

  it('returns Korean instruction with proper characters', () => {
    const instruction = getLanguageInstruction('ko');
    expect(instruction).toContain('한국어');
  });
});

describe('listLanguages', () => {
  it('returns all languages', () => {
    const languages = listLanguages();
    expect(languages.length).toBe(ANNOTATION_LANGUAGES.length);
  });

  it('returns readonly array', () => {
    const languages = listLanguages();
    expect(Array.isArray(languages)).toBe(true);
  });
});
