import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AnnotationConfig } from '../config/schema.js';

export interface FrameAnalysis {
  index: number;
  timestamp: string;
  status: 'ok' | 'warning' | 'error';
  description: string;
  feature_being_demonstrated: string;
  bugs_detected: string[];
  visual_quality: 'good' | 'degraded' | 'broken';
  annotation_text: string;
}

export interface AnnotationResult {
  frames: FrameAnalysis[];
  overall_status: 'ok' | 'warning' | 'error';
  bugs_found: number;
  summary: string;
}

export interface Logger {
  log: (message: string) => void;
  warn: (message: string) => void;
}

const defaultLogger: Logger = {
  log: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
};

export async function annotateFrames(
  framesDir: string,
  frameCount: number,
  projectName: string,
  projectDescription: string,
  scenarioDescription: string,
  config: AnnotationConfig,
  logger: Logger = defaultLogger,
): Promise<AnnotationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required for AI annotation. ' +
      'Set it with: export ANTHROPIC_API_KEY=sk-...',
    );
  }
  const client = new Anthropic();
  const frames: FrameAnalysis[] = [];

  for (let i = 1; i <= frameCount; i++) {
    const framePath = resolve(framesDir, `frame-${String(i).padStart(3, '0')}.png`);
    const imageData = await readFile(framePath);
    const base64 = imageData.toString('base64');
    const seconds = (i - 1) / config.extract_fps;
    const timestamp = `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;

    const languageInstruction = config.language !== 'en'
      ? `\nRespond in ${config.language}. All text fields including description and annotation_text should be in ${config.language}.`
      : '';

    const prompt = `You are analyzing a screenshot from a terminal TUI application called "${projectName}".
This is frame ${i} of ${frameCount} (timestamp: ${timestamp}).

Project description: ${projectDescription}
Scenario being recorded: ${scenarioDescription}

Analyze the screenshot and provide a JSON response (no markdown fences, just raw JSON):

{
  "status": "ok" | "warning" | "error",
  "description": "Brief description of what is shown",
  "feature_being_demonstrated": "e.g., file navigation",
  "bugs_detected": [],
  "visual_quality": "good" | "degraded" | "broken",
  "annotation_text": "Short text (< 50 chars) to overlay on this frame"
}${languageInstruction}`;

    const response = await retryWithBackoff(() =>
      client.messages.create({
        model: config.model,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: base64 },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
      3,
      1000,
      logger,
    );

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    try {
      const parsed = JSON.parse(text);
      frames.push({
        index: i - 1,
        timestamp,
        status: parsed.status ?? 'ok',
        description: parsed.description ?? '',
        feature_being_demonstrated: parsed.feature_being_demonstrated ?? '',
        bugs_detected: parsed.bugs_detected ?? [],
        visual_quality: parsed.visual_quality ?? 'good',
        annotation_text: parsed.annotation_text ?? '',
      });
    } catch {
      frames.push({
        index: i - 1,
        timestamp,
        status: 'warning',
        description: 'Failed to parse AI response',
        feature_being_demonstrated: '',
        bugs_detected: [],
        visual_quality: 'good',
        annotation_text: `Frame ${i}`,
      });
    }

    logger.log(`  Frame ${i}/${frameCount}: ${frames[frames.length - 1].annotation_text}`);
  }

  const bugsFound = frames.reduce((sum, f) => sum + f.bugs_detected.length, 0);
  const hasError = frames.some((f) => f.status === 'error');
  const hasWarning = frames.some((f) => f.status === 'warning');

  return {
    frames,
    overall_status: hasError ? 'error' : hasWarning ? 'warning' : 'ok',
    bugs_found: bugsFound,
    summary: buildSummary(frames),
  };
}

function buildSummary(frames: FrameAnalysis[]): string {
  const features = [...new Set(frames.map((f) => f.feature_being_demonstrated).filter(Boolean))];
  const bugs = frames.flatMap((f) => f.bugs_detected);

  let summary = `Analyzed ${frames.length} frames.`;
  if (features.length > 0) {
    summary += ` Features demonstrated: ${features.join(', ')}.`;
  }
  if (bugs.length > 0) {
    summary += ` Bugs found: ${bugs.join('; ')}.`;
  } else {
    summary += ' No bugs detected.';
  }
  return summary;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  logger: Logger = defaultLogger,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt);
      logger.warn(`  Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Unreachable');
}
