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

export async function annotateFrames(
  framesDir: string,
  frameCount: number,
  projectName: string,
  projectDescription: string,
  scenarioDescription: string,
  config: AnnotationConfig,
): Promise<AnnotationResult> {
  const client = new Anthropic();
  const frames: FrameAnalysis[] = [];

  for (let i = 1; i <= frameCount; i++) {
    const framePath = resolve(framesDir, `frame-${String(i).padStart(3, '0')}.png`);
    const imageData = await readFile(framePath);
    const base64 = imageData.toString('base64');
    const timestamp = `${Math.floor((i - 1) / 60)}:${String((i - 1) % 60).padStart(2, '0')}`;

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
}`;

    const response = await client.messages.create({
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
    });

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

    console.log(`  Frame ${i}/${frameCount}: ${frames[frames.length - 1].annotation_text}`);
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
