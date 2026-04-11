import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { basename, dirname, relative } from 'node:path';
import type { Report } from './regression.js';

export interface PlayerOptions {
  /** Path to the video file (MP4 or WebM). */
  videoPath: string;
  /** Path to the JSON report (for annotations). */
  reportPath: string;
  /** Output path for the HTML player file. */
  outputPath: string;
  /** Project name for the title. */
  projectName: string;
  /** Scenario name for the subtitle. */
  scenarioName: string;
  /** Embed video as base64 (larger file, fully portable). */
  embedVideo?: boolean;
}

/**
 * Generate a self-contained HTML player for a recording.
 * The player includes play/pause, speed control, timeline scrubber,
 * and AI annotation captions.
 */
export async function generatePlayer(options: PlayerOptions): Promise<string> {
  const { videoPath, reportPath, outputPath, projectName, scenarioName, embedVideo = false } = options;

  let videoSrc: string;
  let videoType: string;

  if (embedVideo) {
    const videoData = await readFile(videoPath);
    const ext = videoPath.endsWith('.webm') ? 'webm' : 'mp4';
    videoType = `video/${ext}`;
    videoSrc = `data:${videoType};base64,${videoData.toString('base64')}`;
  } else {
    const outputDir = dirname(outputPath);
    videoSrc = relative(outputDir, videoPath);
    videoType = videoPath.endsWith('.webm') ? 'video/webm' : 'video/mp4';
  }

  let annotations: Report['frames'] = [];
  try {
    const reportContent = await readFile(reportPath, 'utf-8');
    const report = JSON.parse(reportContent) as Report;
    annotations = report.frames ?? [];
  } catch {
    // No annotations available
  }

  const html = buildPlayerHtml({
    videoSrc,
    videoType,
    projectName,
    scenarioName,
    annotations,
  });

  await writeFile(outputPath, html, 'utf-8');
  return outputPath;
}

interface PlayerHtmlOptions {
  videoSrc: string;
  videoType: string;
  projectName: string;
  scenarioName: string;
  annotations: Report['frames'];
}

function buildPlayerHtml(opts: PlayerHtmlOptions): string {
  const { videoSrc, videoType, projectName, scenarioName, annotations } = opts;
  const annotationsJson = JSON.stringify(annotations);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(projectName)} — ${escapeHtml(scenarioName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    padding: 2rem;
  }
  .header { text-align: center; margin-bottom: 1.5rem; }
  .header h1 { font-size: 1.5rem; font-weight: 600; }
  .header p { color: #8b949e; margin-top: 0.25rem; }
  .player-container {
    max-width: 960px;
    width: 100%;
    background: #161b22;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  video {
    width: 100%;
    display: block;
    background: #000;
  }
  .controls {
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    border-top: 1px solid #30363d;
  }
  .controls button {
    background: none;
    border: none;
    color: #e6edf3;
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }
  .controls button:hover { background: #30363d; }
  .timeline {
    flex: 1;
    height: 6px;
    background: #30363d;
    border-radius: 3px;
    cursor: pointer;
    position: relative;
  }
  .timeline-progress {
    height: 100%;
    background: #58a6ff;
    border-radius: 3px;
    width: 0%;
    transition: width 0.1s linear;
  }
  .time-display {
    font-size: 0.8rem;
    color: #8b949e;
    font-variant-numeric: tabular-nums;
    min-width: 5rem;
    text-align: right;
  }
  .speed-btn {
    font-size: 0.75rem !important;
    min-width: 2.5rem;
    text-align: center;
  }
  .caption {
    padding: 0.75rem 1rem;
    min-height: 2.5rem;
    border-top: 1px solid #30363d;
    font-size: 0.85rem;
    color: #8b949e;
  }
  .caption .status { display: inline-block; margin-right: 0.5rem; }
  .caption .status.ok { color: #3fb950; }
  .caption .status.warning { color: #d29922; }
  .caption .status.bug_detected { color: #f85149; }
</style>
</head>
<body>
<div class="header">
  <h1>${escapeHtml(projectName)}</h1>
  <p>${escapeHtml(scenarioName)}</p>
</div>
<div class="player-container">
  <video id="video" preload="metadata">
    <source src="${videoSrc}" type="${videoType}">
    Your browser does not support video playback.
  </video>
  <div class="controls">
    <button id="playBtn" title="Play/Pause">▶</button>
    <div class="timeline" id="timeline">
      <div class="timeline-progress" id="progress"></div>
    </div>
    <span class="time-display" id="time">0:00 / 0:00</span>
    <button class="speed-btn" id="speedBtn" title="Playback speed">1x</button>
  </div>
  <div class="caption" id="caption"></div>
</div>
<script>
(function() {
  const video = document.getElementById('video');
  const playBtn = document.getElementById('playBtn');
  const timeline = document.getElementById('timeline');
  const progress = document.getElementById('progress');
  const timeDisplay = document.getElementById('time');
  const speedBtn = document.getElementById('speedBtn');
  const caption = document.getElementById('caption');
  const annotations = ${annotationsJson};
  const speeds = [0.5, 1, 1.5, 2, 4];
  let speedIdx = 1;

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }

  playBtn.onclick = function() {
    if (video.paused) { video.play(); playBtn.textContent = '⏸'; }
    else { video.pause(); playBtn.textContent = '▶'; }
  };

  video.onended = function() { playBtn.textContent = '▶'; };

  video.ontimeupdate = function() {
    const pct = (video.currentTime / video.duration) * 100;
    progress.style.width = pct + '%';
    timeDisplay.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    updateCaption(video.currentTime);
  };

  timeline.onclick = function(e) {
    const rect = timeline.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * video.duration;
  };

  speedBtn.onclick = function() {
    speedIdx = (speedIdx + 1) % speeds.length;
    video.playbackRate = speeds[speedIdx];
    speedBtn.textContent = speeds[speedIdx] + 'x';
  };

  function updateCaption(time) {
    if (!annotations.length) { caption.textContent = ''; return; }
    let best = null;
    for (const a of annotations) {
      const parts = a.timestamp.split(':');
      const t = parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
      if (t <= time) best = a;
    }
    if (best) {
      const statusClass = best.status || 'ok';
      caption.innerHTML = '<span class="status ' + statusClass + '">[' + best.status + ']</span> ' +
        best.annotation_text;
    } else {
      caption.textContent = '';
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
    if (e.code === 'ArrowRight') { video.currentTime += 5; }
    if (e.code === 'ArrowLeft') { video.currentTime -= 5; }
  });
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
