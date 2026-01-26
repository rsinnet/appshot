import OpenAI from 'openai';
import type { OpenAIModel } from '../types/ai.js';
import { MODEL_CONFIGS } from '../types/ai.js';

export interface CaptionEnhancementOptions {
  text: string;
  language: string;
  model: OpenAIModel;
  maxLines: number;
  maxChars: number;
  deviceType: string;
  layout: string;
  attempt?: number;
}

export interface CaptionEnhancementBatchOptions {
  captions: Record<string, string>;
  language: string;
  model: OpenAIModel;
  maxLines: number;
  maxChars: number;
  deviceType: string;
  layout: string;
  attempt?: number;
}

export class CaptionEnhancementService {
  private client: OpenAI | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey, timeout: 180000 });
    }
  }

  public hasApiKey(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  public async enhance(options: CaptionEnhancementOptions): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable.');
    }

    const modelConfig = MODEL_CONFIGS[options.model];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${options.model}`);
    }

    const systemPrompt =
      'You are a product marketing editor. Rewrite the caption to be concise, clear, and compelling ' +
      'for App Store screenshots. Preserve proper nouns and key terms. Do NOT translate; keep the same language. ' +
      'Return only the rewritten caption with no quotes.';

    const userPrompt = [
      `Language: ${options.language}`,
      `Device: ${options.deviceType}`,
      `Layout: ${options.layout}`,
      `Constraints: max ${options.maxLines} lines, approx ${options.maxChars} characters total.`,
      options.attempt && options.attempt > 1 ? 'Make it shorter than your previous try.' : '',
      `Original: "${options.text}"`
    ].filter(Boolean).join('\n');

    try {
      const output = await this.requestCaption({
        model: modelConfig.model,
        instructions: systemPrompt,
        input: [{ role: 'user', content: userPrompt }],
        maxOutputTokens: Math.min(256, modelConfig.maxTokens)
      });

      if (!output) {
        throw new Error('No response from OpenAI');
      }

      return normalizeCaption(output);
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        if (error.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (error.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (error.status === 404) {
          throw new Error(`Model ${options.model} not found. You may not have access to this model.`);
        }
      }
      throw error;
    }
  }

  public async enhanceBatch(options: CaptionEnhancementBatchOptions): Promise<Record<string, string>> {
    if (!this.client) {
      throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable.');
    }

    const modelConfig = MODEL_CONFIGS[options.model];
    if (!modelConfig) {
      throw new Error(`Unknown model: ${options.model}`);
    }

    const systemPrompt =
      'You are a product marketing editor. Rewrite each caption to be concise, clear, and compelling ' +
      'for App Store screenshots. Preserve proper nouns and key terms. Do NOT translate; keep the same language. ' +
      'Return only JSON.';

    const userPrompt = [
      `Language: ${options.language}`,
      `Device: ${options.deviceType}`,
      `Layout: ${options.layout}`,
      `Constraints: max ${options.maxLines} lines, approx ${options.maxChars} characters total.`,
      options.attempt && options.attempt > 1 ? 'Make each caption shorter than your previous try.' : '',
      'Return a JSON object mapping each filename to its rewritten caption.',
      'Input JSON:',
      JSON.stringify(options.captions)
    ].filter(Boolean).join('\n');

    const maxOutputTokens = Math.min(
      modelConfig.maxTokens,
      Math.max(512, 80 * Object.keys(options.captions).length)
    );

    const output = await this.requestCaption({
      model: modelConfig.model,
      instructions: systemPrompt,
      input: [{ role: 'user', content: userPrompt }],
      maxOutputTokens
    });

    const parsed = parseJsonMap(output);
    const result: Record<string, string> = {};

    for (const [file, original] of Object.entries(options.captions)) {
      const updated = parsed[file];
      result[file] = typeof updated === 'string' && updated.trim().length > 0 ? updated.trim() : original;
    }

    return result;
  }

  private async requestCaption(options: {
    model: OpenAIModel;
    instructions: string;
    input: Array<{ role: 'user'; content: string }>;
    maxOutputTokens: number;
  }): Promise<string> {
    const response = await this.client!.responses.create({
      model: options.model,
      instructions: options.instructions,
      input: options.input,
      max_output_tokens: options.maxOutputTokens,
      reasoning: { effort: 'low' },
      text: { verbosity: 'low', format: { type: 'text' } }
    });

    const directText = response.output_text?.trim();
    if (directText) {
      return directText;
    }

    const message = response.output?.find(item => item.type === 'message') as
      | { content?: Array<{ type?: string; text?: string }> }
      | undefined;
    const fallbackText = message?.content?.find(
      (content) => content.type === 'output_text' && content.text
    )?.text;

    if (fallbackText && fallbackText.trim()) {
      return fallbackText.trim();
    }

    if (options.maxOutputTokens < 512) {
      return this.requestCaption({
        ...options,
        maxOutputTokens: Math.min(512, MODEL_CONFIGS[options.model].maxTokens)
      });
    }

    return '';
  }
}

function normalizeCaption(text: string): string {
  const trimmed = text.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('“') && trimmed.endsWith('”'))) {
    return trimmed.slice(1, -1).trim();
  }
  if (trimmed.startsWith('Caption:')) {
    return trimmed.slice('Caption:'.length).trim();
  }
  return trimmed;
}

function parseJsonMap(text: string): Record<string, string> {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

export const captionEnhancementService = new CaptionEnhancementService();
