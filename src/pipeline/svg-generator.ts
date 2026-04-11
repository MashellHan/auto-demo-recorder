import { writeFile } from 'node:fs/promises';

export interface SvgGeneratorOptions {
  /** Path to write the SVG file. */
  outputPath: string;
  /** Terminal width in characters. */
  width: number;
  /** Terminal height in characters. */
  height: number;
  /** Lines of text to render in the SVG terminal. */
  lines: string[];
  /** Window title text. */
  title?: string;
  /** Theme colors. */
  theme?: SvgTheme;
  /** Font size in pixels. */
  fontSize?: number;
}

export interface SvgTheme {
  background: string;
  foreground: string;
  titleBar: string;
  titleText: string;
}

const DEFAULT_THEME: SvgTheme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  titleBar: '#313244',
  titleText: '#a6adc8',
};

/**
 * Generate a static SVG terminal rendering from text lines.
 * Produces a crisp, infinitely scalable terminal image suitable for
 * GitHub READMEs and documentation.
 */
export async function generateSvg(options: SvgGeneratorOptions): Promise<string> {
  const {
    outputPath,
    width,
    height,
    lines,
    title,
    theme = DEFAULT_THEME,
    fontSize = 14,
  } = options;

  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.4;
  const padding = 16;
  const titleBarHeight = title ? 36 : 0;

  const svgWidth = Math.max(width * charWidth + padding * 2, 400);
  const contentHeight = Math.max(height * lineHeight, lines.length * lineHeight) + padding * 2;
  const svgHeight = contentHeight + titleBarHeight;

  const escapedLines = lines.map((line) => escapeXml(line));

  const textElements = escapedLines.map((line, i) => {
    const y = titleBarHeight + padding + (i + 1) * lineHeight;
    return `    <text x="${padding}" y="${y}" fill="${theme.foreground}" font-family="'SF Mono', 'Cascadia Code', 'Fira Code', 'Menlo', monospace" font-size="${fontSize}">${line}</text>`;
  }).join('\n');

  const titleElement = title
    ? `  <rect x="0" y="0" width="${svgWidth}" height="${titleBarHeight}" fill="${theme.titleBar}" rx="8" ry="8"/>
  <rect x="0" y="16" width="${svgWidth}" height="${titleBarHeight - 16}" fill="${theme.titleBar}"/>
  <circle cx="20" cy="${titleBarHeight / 2}" r="6" fill="#ff5f57"/>
  <circle cx="40" cy="${titleBarHeight / 2}" r="6" fill="#febc2e"/>
  <circle cx="60" cy="${titleBarHeight / 2}" r="6" fill="#28c840"/>
  <text x="${svgWidth / 2}" y="${titleBarHeight / 2 + 4}" fill="${theme.titleText}" font-family="-apple-system, 'Segoe UI', sans-serif" font-size="12" text-anchor="middle">${escapeXml(title)}</text>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <rect width="100%" height="100%" rx="8" ry="8" fill="${theme.background}"/>
${titleElement}
  <g>
${textElements}
  </g>
</svg>`;

  await writeFile(outputPath, svg, 'utf-8');
  return outputPath;
}

/**
 * Generate SVG from a recording report's annotation text.
 * Creates a terminal-style SVG showing the command output and annotations.
 */
export async function generateSvgFromReport(options: {
  reportPath: string;
  outputPath: string;
  width?: number;
  height?: number;
  title?: string;
  fontSize?: number;
}): Promise<string> {
  const { readFile } = await import('node:fs/promises');

  const content = await readFile(options.reportPath, 'utf-8');
  const report = JSON.parse(content);

  const lines: string[] = [];

  // Build terminal-like output from frames
  for (const frame of report.frames ?? []) {
    const statusIcon = frame.status === 'ok' ? '✓' : frame.status === 'warning' ? '!' : '✗';
    const line = `[${frame.timestamp}] ${statusIcon} ${frame.annotation_text || frame.description || ''}`;
    lines.push(line);
  }

  if (lines.length === 0) {
    lines.push(`$ ${report.scenario || 'recording'}`);
    lines.push(report.summary || 'Recording complete.');
  }

  return generateSvg({
    outputPath: options.outputPath,
    width: options.width ?? 80,
    height: options.height ?? 24,
    lines,
    title: options.title ?? `${report.project} — ${report.scenario}`,
    fontSize: options.fontSize,
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
