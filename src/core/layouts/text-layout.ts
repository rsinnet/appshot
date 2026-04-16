import type { DeviceStrategyV2 } from '../../types.js';
import type { LayoutBox } from './math.js';

export interface TextLayoutResult {
  lines: string[];
  truncated: boolean;
  maxWidth: number;
  maxHeight: number;
}

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

// Split text on explicit newlines, then wrap each segment independently
function splitAndWrapWithNewlines(
  text: string,
  maxWidth: number,
  fontSize: number
): string[] {
  if (!text.includes('\n')) {
    return wrapWords(splitWords(text), maxWidth, fontSize);
  }
  const segments = text.split('\n');
  const result: string[] = [];
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (trimmed) {
      result.push(...wrapWords(splitWords(trimmed), maxWidth, fontSize));
    }
  }
  return result;
}

function measureTextWidth(text: string, fontSize: number): number {
  // Heuristic fallback; real measurement will be added in compose layer.
  const averageCharWidth = fontSize * 0.55;
  return text.length * averageCharWidth;
}

function wrapWords(words: string[], maxWidth: number, fontSize: number): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const width = measureTextWidth(next, fontSize);

    if (width <= maxWidth || !current) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function truncateLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length <= 1) return '...';
  return `${trimmed.replace(/\s+$/, '')}...`;
}

export function layoutCaptionText(
  text: string,
  region: LayoutBox,
  fontSize: number,
  strategy: DeviceStrategyV2
): TextLayoutResult {
  const padding = Math.round(region.height * 0.1);
  const maxWidth = Math.max(0, region.width - padding * 2);
  const maxHeight = Math.max(0, region.height - padding * 2);
  const lineHeight = Math.round(fontSize * strategy.captionLineHeight);
  const maxLines = Math.max(1, strategy.captionMaxLines);

  const lines = splitAndWrapWithNewlines(text, maxWidth, fontSize);

  let truncated = false;
  let output = lines;

  if (output.length > maxLines) {
    truncated = true;
    output = output.slice(0, maxLines);
    output[maxLines - 1] = truncateLine(output[maxLines - 1]);
  }

  const maxVisibleLines = Math.min(output.length, Math.floor(maxHeight / Math.max(1, lineHeight)) || 1);
  if (output.length > maxVisibleLines) {
    truncated = true;
    output = output.slice(0, maxVisibleLines);
    output[output.length - 1] = truncateLine(output[output.length - 1]);
  }

  return {
    lines: output,
    truncated,
    maxWidth,
    maxHeight
  };
}
