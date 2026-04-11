import { describe, it, expect, vi } from 'vitest';
import { evaluateCleanupPolicy, formatCleanupEvaluation, type SessionInfo, type CleanupPolicy } from '../src/config/cleanup-policy.js';

const makeSessions = (): SessionInfo[] => [
  { id: '2026-04-01_08-00', timestamp: new Date('2026-04-01T08:00:00'), sizeBytes: 1024 * 1024, hasBugs: false, hasErrors: false },
  { id: '2026-04-05_08-00', timestamp: new Date('2026-04-05T08:00:00'), sizeBytes: 2 * 1024 * 1024, hasBugs: true, hasErrors: false },
  { id: '2026-04-08_08-00', timestamp: new Date('2026-04-08T08:00:00'), sizeBytes: 1024 * 1024, hasBugs: false, hasErrors: false },
  { id: '2026-04-10_08-00', timestamp: new Date('2026-04-10T08:00:00'), sizeBytes: 1024 * 1024, hasBugs: false, hasErrors: false },
  { id: '2026-04-11_08-00', timestamp: new Date('2026-04-11T08:00:00'), sizeBytes: 1024 * 1024, hasBugs: false, hasErrors: false },
];

describe('evaluateCleanupPolicy', () => {
  it('returns empty when no policy', () => {
    const result = evaluateCleanupPolicy(undefined, makeSessions());
    expect(result.sessionsToRemove).toEqual([]);
    expect(result.sessionsToKeep).toHaveLength(5);
  });

  it('applies keep_last_n policy', () => {
    const policy: CleanupPolicy = { keep_last_n: 3, keep_failures: false };
    const result = evaluateCleanupPolicy(policy, makeSessions());
    expect(result.sessionsToRemove).toHaveLength(2);
    expect(result.sessionsToKeep).toHaveLength(3);
  });

  it('applies keep_last_n with keep_failures', () => {
    const policy: CleanupPolicy = { keep_last_n: 2, keep_failures: true };
    const result = evaluateCleanupPolicy(policy, makeSessions());
    // Should keep newest 2 + the buggy session
    expect(result.sessionsToRemove).not.toContain('2026-04-05_08-00');
  });

  it('applies max_age_days policy', () => {
    // Set "now" to 2026-04-11, sessions from April 1 and 5 are >5 days old
    const sessions = makeSessions();
    const policy: CleanupPolicy = { max_age_days: 5, keep_failures: false };

    // Mock current date for testing
    const origDate = Date;
    const mockDate = new Date('2026-04-11T12:00:00');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);

    const result = evaluateCleanupPolicy(policy, sessions);
    expect(result.sessionsToRemove.length).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  it('applies max_disk_mb policy', () => {
    const policy: CleanupPolicy = { max_disk_mb: 3, keep_failures: false };
    const result = evaluateCleanupPolicy(policy, makeSessions());
    // Total is ~6MB, need to get under 3MB
    expect(result.sessionsToRemove.length).toBeGreaterThan(0);
    expect(result.estimatedFreedBytes).toBeGreaterThan(0);
  });

  it('handles empty sessions', () => {
    const policy: CleanupPolicy = { keep_last_n: 3, keep_failures: false };
    const result = evaluateCleanupPolicy(policy, []);
    expect(result.sessionsToRemove).toEqual([]);
  });
});

describe('formatCleanupEvaluation', () => {
  it('shows no removal message when clean', () => {
    const output = formatCleanupEvaluation({
      sessionsToRemove: [],
      sessionsToKeep: ['session1'],
      reasons: new Map(),
      estimatedFreedBytes: 0,
    });
    expect(output).toContain('No sessions need to be removed');
  });

  it('shows removals with reasons', () => {
    const output = formatCleanupEvaluation({
      sessionsToRemove: ['old-session'],
      sessionsToKeep: ['new-session'],
      reasons: new Map([['old-session', 'Exceeds keep_last_n (2)']]),
      estimatedFreedBytes: 1024 * 1024,
    });
    expect(output).toContain('old-session');
    expect(output).toContain('keep_last_n');
    expect(output).toContain('1.0 MB');
  });
});
