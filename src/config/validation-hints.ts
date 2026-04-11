import { z } from 'zod';
import { ConfigSchema } from './schema.js';

/** A single validation hint with suggested fix. */
export interface ValidationHint {
  /** Path to the problematic field (e.g., "recording.format"). */
  path: string;
  /** Human-readable error message. */
  message: string;
  /** Suggested fix, if available. */
  suggestion?: string;
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/** Known field names at each schema level for typo detection. */
const KNOWN_FIELDS: Record<string, string[]> = {
  '': ['project', 'recording', 'output', 'annotation', 'watch', 'scenarios', 'browser_scenarios', 'profiles'],
  project: ['name', 'description', 'build_command', 'binary'],
  recording: ['width', 'height', 'font_size', 'theme', 'fps', 'max_duration', 'format', 'backend', 'browser', 'idle_time_limit', 'formats', 'frame', 'parallel', 'max_workers'],
  output: ['dir', 'keep_raw', 'keep_frames', 'record_mode', 'player', 'docs'],
  annotation: ['enabled', 'model', 'extract_fps', 'language', 'overlay_position', 'overlay_font_size'],
  watch: ['include', 'exclude', 'debounce_ms'],
};

/** Known enum values for specific fields. */
const KNOWN_ENUMS: Record<string, string[]> = {
  'recording.format': ['mp4', 'gif', 'svg'],
  'recording.backend': ['vhs', 'browser'],
  'annotation.overlay_position': ['top', 'bottom'],
  'output.record_mode': ['always', 'retain-on-failure'],
  'recording.browser.browser': ['chromium', 'firefox', 'webkit'],
  'recording.frame.style': ['none', 'colorful', 'rings'],
};

/**
 * Find the closest match for a misspelled field name.
 * Returns the closest match if edit distance ≤ 3, else undefined.
 */
function findClosestField(field: string, validFields: string[]): string | undefined {
  let best: string | undefined;
  let bestDist = 4; // max distance threshold

  for (const valid of validFields) {
    const dist = levenshtein(field.toLowerCase(), valid.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = valid;
    }
  }

  return best;
}

/**
 * Generate actionable validation hints from Zod parse errors.
 * Analyzes error paths, detects typos, and suggests fixes.
 */
export function generateValidationHints(errors: z.ZodError): ValidationHint[] {
  const hints: ValidationHint[] = [];

  for (const issue of errors.issues) {
    const path = issue.path.map(String).join('.');
    const hint: ValidationHint = {
      path: path || '(root)',
      message: issue.message,
    };

    // Unrecognized key errors — detect typos
    if (issue.code === 'unrecognized_keys' && 'keys' in issue) {
      const keys = (issue as any).keys as string[];
      const parentPath = issue.path.map(String).join('.');
      const knownParent = KNOWN_FIELDS[parentPath] ?? KNOWN_FIELDS[''];

      for (const key of keys) {
        const closest = findClosestField(key, knownParent);
        if (closest) {
          hints.push({
            path: parentPath ? `${parentPath}.${key}` : key,
            message: `Unrecognized field "${key}"`,
            suggestion: `Did you mean "${closest}"? Try: ${closest}`,
          });
        } else {
          hints.push({
            path: parentPath ? `${parentPath}.${key}` : key,
            message: `Unrecognized field "${key}"`,
            suggestion: `Valid fields: ${knownParent.join(', ')}`,
          });
        }
      }
      continue;
    }

    // Invalid enum value — list valid options
    if (issue.code === 'invalid_enum_value') {
      const enumPath = path;
      const validValues = KNOWN_ENUMS[enumPath];
      if (validValues) {
        hint.suggestion = `Valid values: ${validValues.join(', ')}`;
      } else if ('options' in issue) {
        hint.suggestion = `Valid values: ${(issue as any).options.join(', ')}`;
      }
    }

    // Invalid type — suggest correct type
    if (issue.code === 'invalid_type') {
      const expected = (issue as any).expected;
      const received = (issue as any).received;
      hint.suggestion = `Expected ${expected}, got ${received}`;
    }

    // Missing required field
    if (issue.code === 'invalid_type' && (issue as any).received === 'undefined') {
      hint.suggestion = `Required field "${issue.path[issue.path.length - 1]}" is missing`;
    }

    // Too small / too large
    if (issue.code === 'too_small') {
      const min = (issue as any).minimum;
      hint.suggestion = `Minimum value: ${min}`;
    }
    if (issue.code === 'too_big') {
      const max = (issue as any).maximum;
      hint.suggestion = `Maximum value: ${max}`;
    }

    hints.push(hint);
  }

  return hints;
}

/**
 * Format validation hints as human-readable text.
 */
export function formatValidationHints(hints: ValidationHint[]): string {
  if (hints.length === 0) {
    return '  ✓ No validation issues found.';
  }

  const lines: string[] = [];
  lines.push('  Validation Hints:');
  lines.push('  ─────────────────────────────────────────────────');

  for (const hint of hints) {
    lines.push(`  ✗ ${hint.path}: ${hint.message}`);
    if (hint.suggestion) {
      lines.push(`    → ${hint.suggestion}`);
    }
  }

  return lines.join('\n');
}
