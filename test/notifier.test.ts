import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildNotification, formatNotificationSummary, type NotificationPayload } from '../src/pipeline/notifier.js';

describe('buildNotification', () => {
  it('creates a notification from recording results', () => {
    const results = [
      { success: true, summary: { status: 'ok', bugsFound: 0, durationSeconds: 12, framesAnalyzed: 10, featuresDemo: [], description: 'Demo complete' } },
      { success: true, summary: { status: 'warning', bugsFound: 2, durationSeconds: 15, framesAnalyzed: 8, featuresDemo: [], description: 'Issues found' } },
    ];

    const notification = buildNotification('my-project', results as any);

    expect(notification.project).toBe('my-project');
    expect(notification.totalScenarios).toBe(2);
    expect(notification.successful).toBe(2);
    expect(notification.failed).toBe(0);
    expect(notification.totalBugs).toBe(2);
    expect(notification.totalDuration).toBe(27);
    expect(notification.status).toBe('warning');
  });

  it('detects failed scenarios', () => {
    const results = [
      { success: true, summary: { status: 'ok', bugsFound: 0, durationSeconds: 10, framesAnalyzed: 5, featuresDemo: [], description: '' } },
      { success: false, summary: { status: 'error', bugsFound: 1, durationSeconds: 5, framesAnalyzed: 3, featuresDemo: [], description: '' } },
    ];

    const notification = buildNotification('test', results as any);

    expect(notification.failed).toBe(1);
    expect(notification.status).toBe('error');
  });

  it('handles all-success with ok status', () => {
    const results = [
      { success: true, summary: { status: 'ok', bugsFound: 0, durationSeconds: 10, framesAnalyzed: 5, featuresDemo: [], description: '' } },
    ];

    const notification = buildNotification('test', results as any);

    expect(notification.status).toBe('ok');
  });

  it('handles empty results', () => {
    const notification = buildNotification('test', []);

    expect(notification.totalScenarios).toBe(0);
    expect(notification.status).toBe('ok');
  });
});

describe('formatNotificationSummary', () => {
  it('formats a successful notification', () => {
    const payload: NotificationPayload = {
      project: 'my-project',
      timestamp: '2026-04-11T08:00:00Z',
      totalScenarios: 3,
      successful: 3,
      failed: 0,
      totalBugs: 0,
      totalDuration: 30,
      status: 'ok',
    };

    const summary = formatNotificationSummary(payload);

    expect(summary).toContain('my-project');
    expect(summary).toContain('3/3 scenarios passed');
    expect(summary).toContain('0 bugs');
    expect(summary).toContain('30.0s');
  });

  it('formats a notification with failures', () => {
    const payload: NotificationPayload = {
      project: 'test',
      timestamp: '2026-04-11T08:00:00Z',
      totalScenarios: 3,
      successful: 2,
      failed: 1,
      totalBugs: 5,
      totalDuration: 45,
      status: 'error',
    };

    const summary = formatNotificationSummary(payload);

    expect(summary).toContain('2/3 scenarios passed');
    expect(summary).toContain('1 failed');
    expect(summary).toContain('5 bugs');
  });

  it('formats zero-scenario notification', () => {
    const payload: NotificationPayload = {
      project: 'empty',
      timestamp: '2026-04-11T08:00:00Z',
      totalScenarios: 0,
      successful: 0,
      failed: 0,
      totalBugs: 0,
      totalDuration: 0,
      status: 'ok',
    };

    const summary = formatNotificationSummary(payload);

    expect(summary).toContain('0/0 scenarios passed');
  });
});
