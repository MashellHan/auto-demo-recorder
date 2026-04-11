import { readFile, writeFile } from 'node:fs/promises';
import type { Report, ReportFrame } from './regression.js';

export interface ReportDashboardOptions {
  /** Path to the JSON report file. */
  reportPath: string;
  /** Output path for the HTML report. */
  outputPath: string;
  /** Project name for the title. */
  projectName: string;
  /** Scenario name for the subtitle. */
  scenarioName: string;
}

/**
 * Generate a comprehensive HTML report dashboard from a recording report.
 * Includes metrics summary, frame analysis table, bug list, and quality chart.
 */
export async function generateReport(options: ReportDashboardOptions): Promise<string> {
  const { reportPath, outputPath, projectName, scenarioName } = options;

  let report: Report;
  try {
    const content = await readFile(reportPath, 'utf-8');
    report = JSON.parse(content) as Report;
  } catch {
    throw new Error(`Failed to read report: ${reportPath}`);
  }

  const html = buildReportHtml({ projectName, scenarioName, report });
  await writeFile(outputPath, html, 'utf-8');
  return outputPath;
}

interface ReportHtmlOptions {
  projectName: string;
  scenarioName: string;
  report: Report;
}

function buildReportHtml(opts: ReportHtmlOptions): string {
  const { projectName, scenarioName, report } = opts;

  const metrics = computeMetrics(report);
  const frameRows = report.frames.map(buildFrameRow).join('\n');
  const bugItems = buildBugList(report.frames);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(projectName)} Report — ${escapeHtml(scenarioName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .header { margin-bottom: 2rem; }
  .header h1 { font-size: 1.75rem; font-weight: 600; }
  .header p { color: #8b949e; margin-top: 0.25rem; }
  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .metric-card {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.25rem;
  }
  .metric-card .label { color: #8b949e; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .metric-card .value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
  .metric-card .value.ok { color: #3fb950; }
  .metric-card .value.warning { color: #d29922; }
  .metric-card .value.error { color: #f85149; }
  .section { margin-bottom: 2rem; }
  .section h2 { font-size: 1.25rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #30363d; }
  table {
    width: 100%;
    border-collapse: collapse;
    background: #161b22;
    border-radius: 8px;
    overflow: hidden;
  }
  th {
    text-align: left;
    padding: 0.75rem 1rem;
    background: #21262d;
    color: #8b949e;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  td {
    padding: 0.75rem 1rem;
    border-top: 1px solid #30363d;
    font-size: 0.9rem;
  }
  .status-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .status-ok { background: #238636; color: #fff; }
  .status-warning { background: #9e6a03; color: #fff; }
  .status-error { background: #da3633; color: #fff; }
  .bug-list { list-style: none; }
  .bug-list li {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 0.5rem;
  }
  .bug-list .bug-time { color: #8b949e; font-size: 0.8rem; }
  .bug-list .bug-text { margin-top: 0.25rem; }
  .summary-box {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 1.25rem;
    line-height: 1.6;
  }
  .quality-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 0.5rem;
  }
  .quality-bar .good { background: #3fb950; }
  .quality-bar .degraded { background: #d29922; }
  .quality-bar .broken { background: #f85149; }
  .footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid #30363d;
    color: #8b949e;
    font-size: 0.8rem;
  }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(projectName)}</h1>
  <p>${escapeHtml(scenarioName)} — ${escapeHtml(report.timestamp)}</p>
</div>

<div class="metrics">
  <div class="metric-card">
    <div class="label">Status</div>
    <div class="value ${report.overall_status}">${report.overall_status.toUpperCase()}</div>
  </div>
  <div class="metric-card">
    <div class="label">Duration</div>
    <div class="value">${formatDuration(report.duration_seconds)}</div>
  </div>
  <div class="metric-card">
    <div class="label">Frames Analyzed</div>
    <div class="value">${report.total_frames_analyzed}</div>
  </div>
  <div class="metric-card">
    <div class="label">Bugs Found</div>
    <div class="value ${report.bugs_found > 0 ? 'error' : 'ok'}">${report.bugs_found}</div>
  </div>
  <div class="metric-card">
    <div class="label">Quality</div>
    <div class="value">${metrics.qualityPercent}%</div>
    <div class="quality-bar">
      <div class="good" style="width:${metrics.goodPercent}%"></div>
      <div class="degraded" style="width:${metrics.degradedPercent}%"></div>
      <div class="broken" style="width:${metrics.brokenPercent}%"></div>
    </div>
  </div>
  <div class="metric-card">
    <div class="label">Features</div>
    <div class="value">${metrics.featureCount}</div>
  </div>
</div>

<div class="section">
  <h2>Summary</h2>
  <div class="summary-box">${escapeHtml(report.summary)}</div>
</div>

${bugItems.length > 0 ? `<div class="section">
  <h2>Bugs Detected (${report.bugs_found})</h2>
  <ul class="bug-list">
${bugItems}
  </ul>
</div>` : ''}

${report.frames.length > 0 ? `<div class="section">
  <h2>Frame Analysis</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Time</th>
        <th>Status</th>
        <th>Feature</th>
        <th>Description</th>
        <th>Quality</th>
      </tr>
    </thead>
    <tbody>
${frameRows}
    </tbody>
  </table>
</div>` : ''}

<div class="footer">
  Generated by auto-demo-recorder
</div>
</body>
</html>`;
}

function buildFrameRow(frame: ReportFrame): string {
  const statusClass = `status-${frame.status}`;
  return `      <tr>
        <td>${frame.index}</td>
        <td>${escapeHtml(frame.timestamp)}</td>
        <td><span class="status-badge ${statusClass}">${frame.status}</span></td>
        <td>${escapeHtml(frame.feature_being_demonstrated || '—')}</td>
        <td>${escapeHtml(frame.annotation_text || frame.description)}</td>
        <td>${escapeHtml(frame.visual_quality)}</td>
      </tr>`;
}

function buildBugList(frames: ReportFrame[]): string {
  const items: string[] = [];
  for (const frame of frames) {
    for (const bug of frame.bugs_detected) {
      items.push(`    <li>
      <div class="bug-time">${escapeHtml(frame.timestamp)} — Frame ${frame.index}</div>
      <div class="bug-text">${escapeHtml(bug)}</div>
    </li>`);
    }
  }
  return items.join('\n');
}

interface Metrics {
  qualityPercent: number;
  goodPercent: number;
  degradedPercent: number;
  brokenPercent: number;
  featureCount: number;
}

function computeMetrics(report: Report): Metrics {
  const frames = report.frames;
  if (frames.length === 0) {
    return { qualityPercent: 100, goodPercent: 100, degradedPercent: 0, brokenPercent: 0, featureCount: 0 };
  }

  const good = frames.filter((f) => f.visual_quality === 'good').length;
  const degraded = frames.filter((f) => f.visual_quality === 'degraded').length;
  const broken = frames.filter((f) => f.visual_quality === 'broken').length;
  const total = frames.length;

  const features = new Set(frames.map((f) => f.feature_being_demonstrated).filter(Boolean));

  return {
    qualityPercent: Math.round((good / total) * 100),
    goodPercent: Math.round((good / total) * 100),
    degradedPercent: Math.round((degraded / total) * 100),
    brokenPercent: Math.round((broken / total) * 100),
    featureCount: features.size,
  };
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
