import { describe, it, expect } from 'vitest';
import { writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compareReports, detectRegressions, loadReport, writeSessionReport } from '../src/pipeline/regression.js';
import type { Report, ReportFrame } from '../src/pipeline/regression.js';

function makeFrame(overrides: Partial<ReportFrame> = {}): ReportFrame {
  return {
    index: 0,
    timestamp: '0:00',
    status: 'ok',
    description: 'test frame',
    feature_being_demonstrated: 'navigation',
    bugs_detected: [],
    visual_quality: 'good',
    annotation_text: 'test',
    ...overrides,
  };
}

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    project: 'test-project',
    scenario: 'basic',
    timestamp: '2026-04-11T00:00:00.000Z',
    duration_seconds: 10,
    total_frames_analyzed: 2,
    overall_status: 'ok',
    frames: [
      makeFrame({ index: 0, feature_being_demonstrated: 'navigation' }),
      makeFrame({ index: 1, feature_being_demonstrated: 'preview' }),
    ],
    summary: 'Analyzed 2 frames.',
    bugs_found: 0,
    ...overrides,
  };
}

describe('compareReports', () => {
  it('returns empty changes for identical reports', () => {
    const baseline = makeReport();
    const current = makeReport();
    const changes = compareReports(baseline, current);
    expect(changes).toHaveLength(0);
  });

  it('detects status regression (ok → error)', () => {
    const baseline = makeReport({ overall_status: 'ok' });
    const current = makeReport({ overall_status: 'error' });
    const changes = compareReports(baseline, current);

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('status_change');
    expect(changes[0].severity).toBe('critical');
    expect(changes[0].description).toContain('ok');
    expect(changes[0].description).toContain('error');
  });

  it('detects status improvement (error → ok)', () => {
    const baseline = makeReport({ overall_status: 'error' });
    const current = makeReport({ overall_status: 'ok' });
    const changes = compareReports(baseline, current);

    expect(changes).toHaveLength(1);
    expect(changes[0].type).toBe('status_change');
    expect(changes[0].severity).toBe('info');
  });

  it('detects new bugs', () => {
    const baseline = makeReport();
    const current = makeReport({
      frames: [
        makeFrame({ bugs_detected: ['layout overflow'] }),
        makeFrame({ bugs_detected: [] }),
      ],
    });
    const changes = compareReports(baseline, current);

    const newBugs = changes.filter((c) => c.type === 'new_bug');
    expect(newBugs).toHaveLength(1);
    expect(newBugs[0].severity).toBe('critical');
    expect(newBugs[0].description).toContain('layout overflow');
  });

  it('detects resolved bugs', () => {
    const baseline = makeReport({
      frames: [
        makeFrame({ bugs_detected: ['render glitch'] }),
        makeFrame({ bugs_detected: [] }),
      ],
    });
    const current = makeReport();
    const changes = compareReports(baseline, current);

    const resolved = changes.filter((c) => c.type === 'resolved_bug');
    expect(resolved).toHaveLength(1);
    expect(resolved[0].severity).toBe('info');
    expect(resolved[0].description).toContain('render glitch');
  });

  it('detects lost features', () => {
    const baseline = makeReport({
      frames: [
        makeFrame({ feature_being_demonstrated: 'navigation' }),
        makeFrame({ feature_being_demonstrated: 'search' }),
      ],
    });
    const current = makeReport({
      frames: [
        makeFrame({ feature_being_demonstrated: 'navigation' }),
        makeFrame({ feature_being_demonstrated: 'navigation' }),
      ],
    });
    const changes = compareReports(baseline, current);

    const lost = changes.filter((c) => c.type === 'feature_lost');
    expect(lost).toHaveLength(1);
    expect(lost[0].severity).toBe('warning');
    expect(lost[0].description).toContain('search');
  });

  it('detects gained features', () => {
    const baseline = makeReport({
      frames: [
        makeFrame({ feature_being_demonstrated: 'navigation' }),
      ],
    });
    const current = makeReport({
      frames: [
        makeFrame({ feature_being_demonstrated: 'navigation' }),
        makeFrame({ feature_being_demonstrated: 'filtering' }),
      ],
    });
    const changes = compareReports(baseline, current);

    const gained = changes.filter((c) => c.type === 'feature_gained');
    expect(gained).toHaveLength(1);
    expect(gained[0].severity).toBe('info');
    expect(gained[0].description).toContain('filtering');
  });

  it('detects visual quality degradation', () => {
    const baseline = makeReport({
      frames: [
        makeFrame({ visual_quality: 'good' }),
        makeFrame({ visual_quality: 'good' }),
      ],
    });
    const current = makeReport({
      frames: [
        makeFrame({ visual_quality: 'degraded' }),
        makeFrame({ visual_quality: 'good' }),
      ],
    });
    const changes = compareReports(baseline, current);

    const quality = changes.filter((c) => c.type === 'quality_change');
    expect(quality).toHaveLength(1);
    expect(quality[0].severity).toBe('warning');
    expect(quality[0].description).toContain('1 frames with issues');
  });

  it('detects visual quality improvement', () => {
    const baseline = makeReport({
      frames: [
        makeFrame({ visual_quality: 'broken' }),
        makeFrame({ visual_quality: 'degraded' }),
      ],
    });
    const current = makeReport({
      frames: [
        makeFrame({ visual_quality: 'good' }),
        makeFrame({ visual_quality: 'good' }),
      ],
    });
    const changes = compareReports(baseline, current);

    const quality = changes.filter((c) => c.type === 'quality_change');
    expect(quality).toHaveLength(1);
    expect(quality[0].severity).toBe('info');
  });

  it('detects multiple changes at once', () => {
    const baseline = makeReport({
      overall_status: 'ok',
      frames: [
        makeFrame({ feature_being_demonstrated: 'navigation', visual_quality: 'good' }),
      ],
    });
    const current = makeReport({
      overall_status: 'error',
      frames: [
        makeFrame({
          feature_being_demonstrated: 'search',
          bugs_detected: ['crash on input'],
          visual_quality: 'broken',
        }),
      ],
    });
    const changes = compareReports(baseline, current);

    expect(changes.length).toBeGreaterThanOrEqual(3);
    expect(changes.some((c) => c.type === 'status_change')).toBe(true);
    expect(changes.some((c) => c.type === 'new_bug')).toBe(true);
    expect(changes.some((c) => c.type === 'feature_lost')).toBe(true);
    expect(changes.some((c) => c.type === 'feature_gained')).toBe(true);
  });
});

describe('detectRegressions', () => {
  const testDir = join(tmpdir(), 'demo-recorder-regression-test');

  it('loads reports from disk and detects no regressions for identical reports', async () => {
    await mkdir(testDir, { recursive: true });
    const report = makeReport();
    const baselinePath = join(testDir, 'baseline.json');
    const currentPath = join(testDir, 'current.json');
    await writeFile(baselinePath, JSON.stringify(report));
    await writeFile(currentPath, JSON.stringify(report));

    const result = await detectRegressions(baselinePath, currentPath);

    expect(result.has_regressions).toBe(false);
    expect(result.changes).toHaveLength(0);
    expect(result.summary).toContain('No changes');
    expect(result.scenario).toBe('basic');
    expect(result.baseline_timestamp).toBe('2026-04-11T00:00:00.000Z');

    await rm(testDir, { recursive: true, force: true });
  });

  it('detects regressions when status worsens', async () => {
    await mkdir(testDir, { recursive: true });
    const baseline = makeReport({ overall_status: 'ok' });
    const current = makeReport({
      overall_status: 'error',
      timestamp: '2026-04-12T00:00:00.000Z',
    });
    const baselinePath = join(testDir, 'baseline2.json');
    const currentPath = join(testDir, 'current2.json');
    await writeFile(baselinePath, JSON.stringify(baseline));
    await writeFile(currentPath, JSON.stringify(current));

    const result = await detectRegressions(baselinePath, currentPath);

    expect(result.has_regressions).toBe(true);
    expect(result.changes.some((c) => c.type === 'status_change' && c.severity === 'critical')).toBe(true);
    expect(result.summary).toContain('critical');

    await rm(testDir, { recursive: true, force: true });
  });
});

describe('loadReport', () => {
  const testDir = join(tmpdir(), 'demo-recorder-loadreport-test');

  it('loads a valid report', async () => {
    await mkdir(testDir, { recursive: true });
    const report = makeReport();
    const path = join(testDir, 'valid.json');
    await writeFile(path, JSON.stringify(report));

    const loaded = await loadReport(path);
    expect(loaded.project).toBe('test-project');
    expect(loaded.scenario).toBe('basic');
    expect(loaded.frames).toHaveLength(2);

    await rm(testDir, { recursive: true, force: true });
  });

  it('rejects report missing project field', async () => {
    await mkdir(testDir, { recursive: true });
    const path = join(testDir, 'invalid.json');
    await writeFile(path, JSON.stringify({ scenario: 'basic', frames: [] }));

    await expect(loadReport(path)).rejects.toThrow('Invalid report');

    await rm(testDir, { recursive: true, force: true });
  });

  it('rejects report missing frames array', async () => {
    await mkdir(testDir, { recursive: true });
    const path = join(testDir, 'noframes.json');
    await writeFile(path, JSON.stringify({ project: 'test', scenario: 'basic' }));

    await expect(loadReport(path)).rejects.toThrow('Invalid report');

    await rm(testDir, { recursive: true, force: true });
  });
});

describe('writeSessionReport', () => {
  const testDir = join(tmpdir(), 'demo-recorder-session-test');

  it('writes combined session report for multiple scenarios', async () => {
    await mkdir(testDir, { recursive: true });
    const reportA = makeReport({ scenario: 'basic', duration_seconds: 5, bugs_found: 0 });
    const reportB = makeReport({ scenario: 'advanced', duration_seconds: 8, bugs_found: 2, overall_status: 'warning' });

    const sessionPath = join(testDir, 'session-report.json');
    const session = await writeSessionReport(sessionPath, 'test-project', [reportA, reportB]);

    expect(session.project).toBe('test-project');
    expect(session.scenarios_recorded).toBe(2);
    expect(session.overall_status).toBe('warning');
    expect(session.total_bugs).toBe(2);
    expect(session.total_duration_seconds).toBe(13);
    expect(session.scenarios).toHaveLength(2);
    expect(session.scenarios[0].name).toBe('basic');
    expect(session.scenarios[1].name).toBe('advanced');

    const written = JSON.parse(await readFile(sessionPath, 'utf-8'));
    expect(written.project).toBe('test-project');
    expect(written.scenarios_recorded).toBe(2);

    await rm(testDir, { recursive: true, force: true });
  });

  it('resolves worst status across scenarios', async () => {
    await mkdir(testDir, { recursive: true });
    const reports = [
      makeReport({ scenario: 'a', overall_status: 'ok' }),
      makeReport({ scenario: 'b', overall_status: 'error' }),
      makeReport({ scenario: 'c', overall_status: 'warning' }),
    ];

    const sessionPath = join(testDir, 'session2.json');
    const session = await writeSessionReport(sessionPath, 'test', reports);

    expect(session.overall_status).toBe('error');

    await rm(testDir, { recursive: true, force: true });
  });

  it('handles single scenario gracefully', async () => {
    await mkdir(testDir, { recursive: true });
    const report = makeReport({ scenario: 'solo', duration_seconds: 3, bugs_found: 1 });

    const sessionPath = join(testDir, 'session-single.json');
    const session = await writeSessionReport(sessionPath, 'proj', [report]);

    expect(session.scenarios_recorded).toBe(1);
    expect(session.total_bugs).toBe(1);
    expect(session.total_duration_seconds).toBe(3);

    await rm(testDir, { recursive: true, force: true });
  });

  it('returns ok when all scenarios are ok', async () => {
    await mkdir(testDir, { recursive: true });
    const reports = [
      makeReport({ scenario: 'a', overall_status: 'ok' }),
      makeReport({ scenario: 'b', overall_status: 'ok' }),
    ];

    const sessionPath = join(testDir, 'session-ok.json');
    const session = await writeSessionReport(sessionPath, 'proj', reports);

    expect(session.overall_status).toBe('ok');

    await rm(testDir, { recursive: true, force: true });
  });
});
