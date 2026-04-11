import { describe, it, expect } from 'vitest';
import { computeTagStats, formatTagStats } from '../src/analytics/tag-stats.js';

describe('computeTagStats (no reports)', () => {
  it('returns empty analytics when no tags', async () => {
    const result = await computeTagStats('/nonexistent', []);
    expect(result.tags).toEqual([]);
    expect(result.bestTag).toBeNull();
  });

  it('returns tag stats with zero recordings when no output dir', async () => {
    const result = await computeTagStats('/nonexistent', [
      { name: 'basic', tags: ['smoke'] },
    ]);
    expect(result.tags).toHaveLength(1);
    expect(result.tags[0].tag).toBe('smoke');
    expect(result.tags[0].recordingCount).toBe(0);
    expect(result.tags[0].passRate).toBe(1); // Default when no recordings
  });

  it('groups scenarios by tag', async () => {
    const result = await computeTagStats('/nonexistent', [
      { name: 'basic', tags: ['smoke', 'regression'] },
      { name: 'advanced', tags: ['smoke'] },
    ]);
    const smoke = result.tags.find((t) => t.tag === 'smoke');
    expect(smoke).toBeDefined();
    expect(smoke!.scenarioCount).toBe(2);
  });
});

describe('formatTagStats', () => {
  it('formats empty analytics', () => {
    const output = formatTagStats({ tags: [], bestTag: null, worstTag: null, buggiestTag: null });
    expect(output).toContain('No tagged scenarios');
  });

  it('formats tag stats with data', () => {
    const output = formatTagStats({
      tags: [
        { tag: 'smoke', scenarioCount: 3, recordingCount: 10, totalBugs: 2, avgBugs: 0.2, avgDuration: 10, passRate: 0.9 },
        { tag: 'regression', scenarioCount: 2, recordingCount: 8, totalBugs: 5, avgBugs: 0.63, avgDuration: 15, passRate: 0.5 },
      ],
      bestTag: { tag: 'smoke', scenarioCount: 3, recordingCount: 10, totalBugs: 2, avgBugs: 0.2, avgDuration: 10, passRate: 0.9 },
      worstTag: { tag: 'regression', scenarioCount: 2, recordingCount: 8, totalBugs: 5, avgBugs: 0.63, avgDuration: 15, passRate: 0.5 },
      buggiestTag: { tag: 'regression', scenarioCount: 2, recordingCount: 8, totalBugs: 5, avgBugs: 0.63, avgDuration: 15, passRate: 0.5 },
    });
    expect(output).toContain('smoke');
    expect(output).toContain('regression');
    expect(output).toContain('Best');
    expect(output).toContain('Worst');
    expect(output).toContain('Buggiest');
  });
});
