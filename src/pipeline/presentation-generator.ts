import { readFile, writeFile } from 'node:fs/promises';
import type { Report, ReportFrame } from './regression.js';
import { generateChapters, type Chapter } from './chapter-generator.js';

export interface PresentationOptions {
  /** Path to the JSON report file. */
  reportPath: string;
  /** Output path for the HTML presentation. */
  outputPath: string;
  /** Project name. */
  projectName: string;
  /** Scenario name. */
  scenarioName: string;
  /** Directory for frame image references (relative to outputPath). */
  framesDir?: string;
}

/**
 * Generate an HTML presentation from recording frames.
 * Each chapter becomes a slide with frame details, navigation controls,
 * and keyboard shortcuts (arrow keys, Escape).
 */
export async function generatePresentation(options: PresentationOptions): Promise<string> {
  const { reportPath, outputPath, projectName, scenarioName, framesDir } = options;

  let report: Report;
  try {
    const content = await readFile(reportPath, 'utf-8');
    report = JSON.parse(content) as Report;
  } catch {
    throw new Error(`Failed to read report: ${reportPath}`);
  }

  const chapters = generateChapters(report.frames);
  const html = buildPresentationHtml({
    projectName,
    scenarioName,
    report,
    chapters,
    framesDir,
  });

  await writeFile(outputPath, html, 'utf-8');
  return outputPath;
}

interface PresentationHtmlOptions {
  projectName: string;
  scenarioName: string;
  report: Report;
  chapters: Chapter[];
  framesDir?: string;
}

function buildPresentationHtml(opts: PresentationHtmlOptions): string {
  const { projectName, scenarioName, report, chapters, framesDir } = opts;
  const slides = buildSlides(report.frames, chapters, framesDir);
  const slidesJson = JSON.stringify(slides);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(projectName)} — Presentation</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .topbar {
    padding: 0.75rem 1.5rem;
    background: #161b22;
    border-bottom: 1px solid #30363d;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .topbar h1 { font-size: 1rem; font-weight: 600; }
  .topbar .counter { color: #8b949e; font-size: 0.85rem; }
  .slide-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  .slide {
    max-width: 900px;
    width: 100%;
    text-align: center;
  }
  .slide-title {
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }
  .slide-time {
    color: #58a6ff;
    font-size: 1rem;
    margin-bottom: 1.5rem;
  }
  .slide-description {
    font-size: 1.25rem;
    line-height: 1.6;
    color: #c9d1d9;
    margin-bottom: 1.5rem;
  }
  .slide-image {
    max-width: 100%;
    max-height: 400px;
    border-radius: 8px;
    margin-bottom: 1rem;
  }
  .slide-status {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 16px;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .status-ok { background: #238636; color: #fff; }
  .status-warning { background: #9e6a03; color: #fff; }
  .status-error { background: #da3633; color: #fff; }
  .slide-meta {
    margin-top: 1rem;
    color: #8b949e;
    font-size: 0.85rem;
  }
  .controls {
    padding: 0.75rem 1.5rem;
    background: #161b22;
    border-top: 1px solid #30363d;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
  }
  .controls button {
    background: #21262d;
    border: 1px solid #30363d;
    color: #e6edf3;
    padding: 0.5rem 1.25rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .controls button:hover { background: #30363d; }
  .controls button:disabled { opacity: 0.4; cursor: default; }
  .progress {
    display: flex;
    gap: 4px;
    margin: 0 1rem;
  }
  .progress .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #30363d;
  }
  .progress .dot.active { background: #58a6ff; }
  .progress .dot.visited { background: #484f58; }
</style>
</head>
<body>
<div class="topbar">
  <h1>${escapeHtml(projectName)} — ${escapeHtml(scenarioName)}</h1>
  <span class="counter" id="counter">1 / ${slides.length}</span>
</div>
<div class="slide-container">
  <div class="slide" id="slide"></div>
</div>
<div class="controls">
  <button id="prevBtn" title="Previous (←)">← Previous</button>
  <div class="progress" id="progress"></div>
  <button id="nextBtn" title="Next (→)">Next →</button>
</div>
<script>
(function() {
  const slides = ${slidesJson};
  let current = 0;
  const slideEl = document.getElementById('slide');
  const counter = document.getElementById('counter');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progressEl = document.getElementById('progress');

  // Build progress dots
  for (let i = 0; i < slides.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    progressEl.appendChild(dot);
  }

  function render() {
    const s = slides[current];
    let html = '<div class="slide-title">' + s.title + '</div>';
    html += '<div class="slide-time">' + s.time + '</div>';
    if (s.image) {
      html += '<img class="slide-image" src="' + s.image + '" alt="Frame">';
    }
    html += '<div class="slide-description">' + s.description + '</div>';
    html += '<span class="slide-status status-' + s.status + '">' + s.status.toUpperCase() + '</span>';
    if (s.feature) {
      html += '<div class="slide-meta">Feature: ' + s.feature + '</div>';
    }
    slideEl.innerHTML = html;
    counter.textContent = (current + 1) + ' / ' + slides.length;
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === slides.length - 1;

    const dots = progressEl.children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].className = 'dot' + (i === current ? ' active' : i < current ? ' visited' : '');
    }
  }

  prevBtn.onclick = function() { if (current > 0) { current--; render(); } };
  nextBtn.onclick = function() { if (current < slides.length - 1) { current++; render(); } };

  document.addEventListener('keydown', function(e) {
    if (e.code === 'ArrowRight' || e.code === 'Space') { nextBtn.click(); }
    if (e.code === 'ArrowLeft') { prevBtn.click(); }
    if (e.code === 'Home') { current = 0; render(); }
    if (e.code === 'End') { current = slides.length - 1; render(); }
  });

  render();
})();
</script>
</body>
</html>`;
}

interface Slide {
  title: string;
  time: string;
  description: string;
  status: string;
  feature: string;
  image?: string;
}

function buildSlides(frames: ReportFrame[], chapters: Chapter[], framesDir?: string): Slide[] {
  if (chapters.length === 0 && frames.length === 0) {
    return [{ title: 'No Data', time: '', description: 'No frames were analyzed.', status: 'ok', feature: '' }];
  }

  // Create one slide per chapter
  if (chapters.length > 0) {
    return chapters.map((ch, i) => ({
      title: ch.title,
      time: `${ch.startTime} – ${ch.endTime}`,
      description: ch.description,
      status: ch.status,
      feature: ch.title,
      image: framesDir ? `${framesDir}/frame-${String(i).padStart(3, '0')}.png` : undefined,
    }));
  }

  // Fallback: one slide per frame
  return frames.map((f) => ({
    title: f.feature_being_demonstrated || `Frame ${f.index}`,
    time: f.timestamp,
    description: f.annotation_text || f.description,
    status: f.status,
    feature: f.feature_being_demonstrated || '',
    image: framesDir ? `${framesDir}/frame-${String(f.index).padStart(3, '0')}.png` : undefined,
  }));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
