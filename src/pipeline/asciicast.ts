import { readFile, writeFile } from 'node:fs/promises';
import type { Report, ReportFrame } from './regression.js';

/**
 * Asciicast v2 header.
 * @see https://docs.asciinema.org/manual/asciicast/v2/
 */
export interface AsciicastHeader {
  version: 2;
  width: number;
  height: number;
  timestamp?: number;
  duration?: number;
  title?: string;
  env?: Record<string, string>;
}

/** A single asciicast event: [time, type, data]. */
export type AsciicastEvent = [number, 'o' | 'i', string];

/** Parsed asciicast v2 file. */
export interface Asciicast {
  header: AsciicastHeader;
  events: AsciicastEvent[];
}

/**
 * Parse an asciicast v2 file (newline-delimited JSON).
 * First line is the header object, subsequent lines are event arrays.
 */
export function parseAsciicast(content: string): Asciicast {
  const lines = content.trim().split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) {
    throw new Error('Empty asciicast file');
  }

  const header = JSON.parse(lines[0]) as AsciicastHeader;
  if (header.version !== 2) {
    throw new Error(`Unsupported asciicast version: ${header.version}`);
  }

  const events: AsciicastEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const event = JSON.parse(lines[i]) as AsciicastEvent;
    events.push(event);
  }

  return { header, events };
}

/**
 * Read and parse an asciicast v2 file from disk.
 */
export async function loadAsciicast(filePath: string): Promise<Asciicast> {
  const content = await readFile(filePath, 'utf-8');
  return parseAsciicast(content);
}

/**
 * Serialize an asciicast to the v2 newline-delimited JSON format.
 */
export function serializeAsciicast(cast: Asciicast): string {
  const lines: string[] = [];
  lines.push(JSON.stringify(cast.header));
  for (const event of cast.events) {
    lines.push(JSON.stringify(event));
  }
  return lines.join('\n') + '\n';
}

/**
 * Write an asciicast v2 file to disk.
 */
export async function saveAsciicast(filePath: string, cast: Asciicast): Promise<void> {
  await writeFile(filePath, serializeAsciicast(cast), 'utf-8');
}

/**
 * Convert a demo-recorder Report to an asciicast v2 file.
 * Each frame annotation becomes a terminal output event.
 */
export function reportToAsciicast(report: Report, width = 80, height = 24): Asciicast {
  const header: AsciicastHeader = {
    version: 2,
    width,
    height,
    duration: report.duration_seconds,
    title: `${report.project} — ${report.scenario}`,
  };

  const events: AsciicastEvent[] = [];

  for (const frame of report.frames) {
    const seconds = parseTimestamp(frame.timestamp);
    const statusIcon = frame.status === 'ok' ? '✓' : frame.status === 'warning' ? '!' : '✗';
    const text = `[${frame.timestamp}] ${statusIcon} ${frame.annotation_text || frame.description}\r\n`;
    events.push([seconds, 'o', text]);
  }

  return { header, events };
}

/**
 * Convert an asciicast to a minimal demo-recorder Report.
 * Extracts text content from output events as frame descriptions.
 */
export function asciicastToReport(cast: Asciicast): Report {
  const frames: ReportFrame[] = [];

  // Sample output events at ~1 second intervals
  const outputEvents = cast.events.filter(([, type]) => type === 'o');
  const seenTimes = new Set<number>();

  for (const [time, , data] of outputEvents) {
    const roundedTime = Math.floor(time);
    if (seenTimes.has(roundedTime)) continue;
    seenTimes.add(roundedTime);

    const minutes = Math.floor(roundedTime / 60);
    const seconds = roundedTime % 60;
    const timestamp = `${minutes}:${String(seconds).padStart(2, '0')}`;

    // Clean up terminal control sequences for the description
    const cleanText = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r?\n/g, ' ').trim();

    frames.push({
      index: frames.length,
      timestamp,
      status: 'ok',
      description: cleanText.substring(0, 200) || 'Terminal output',
      feature_being_demonstrated: '',
      bugs_detected: [],
      visual_quality: 'good',
      annotation_text: cleanText.substring(0, 100) || 'Terminal output',
    });
  }

  const duration = cast.header.duration ?? (outputEvents.length > 0 ? outputEvents[outputEvents.length - 1][0] : 0);

  return {
    project: cast.header.title?.split(' — ')[0] ?? 'imported',
    scenario: cast.header.title?.split(' — ')[1] ?? 'asciicast',
    timestamp: new Date().toISOString(),
    duration_seconds: duration,
    total_frames_analyzed: frames.length,
    overall_status: 'ok',
    frames,
    summary: `Imported from asciicast: ${frames.length} frames over ${Math.round(duration)}s.`,
    bugs_found: 0,
  };
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(':');
  const minutes = parseInt(parts[0], 10) || 0;
  const seconds = parseInt(parts[1], 10) || 0;
  return minutes * 60 + seconds;
}
