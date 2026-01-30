/**
 * Title Generation Utility
 * Shared helper for generating AI-powered titles for uploaded files
 */

import OpenAI from 'openai';
import { createLogger } from './logger';

const logger = createLogger('TitleGenerator');

export interface TitleGenerationOptions {
  /**
   * System prompt for title generation
   * @default "Generate a concise 3-8 word title for a file based on its content. Return only the title, no quotes."
   */
  systemPrompt?: string;

  /**
   * User prompt content (file-specific context)
   */
  content: string;

  /**
   * Timeout in milliseconds
   * @default 8000
   */
  timeoutMs?: number;

  /**
   * Custom model override
   * @default Uses TITLE_GENERATION_MODEL env var, or OPENAI_MODEL, or "gpt-4o-mini"
   */
  model?: string;

  /**
   * Temperature for generation
   * @default 0.5
   */
  temperature?: number;

  /**
   * Max tokens
   * @default 25
   */
  maxTokens?: number;

  /**
   * Label for logging (e.g., "ExcelDocument", "PdfDocument")
   */
  label?: string;
}

/**
 * Generate an AI-powered title for a file
 *
 * @param options - Title generation options
 * @returns Promise<string | undefined> - Generated title or undefined if failed
 *
 * @example
 * ```typescript
 * const title = await generateTitle({
 *   content: `File: ${fileName}\n\nFirst 500 characters:\n${preview}`,
 *   label: 'MyExtension',
 * });
 * ```
 */
export async function generateTitle(options: TitleGenerationOptions): Promise<string | undefined> {
  console.log('[TitleGenerator] ====================================');
  console.log('[TitleGenerator] generateTitle called with options:', JSON.stringify(options, null, 2));

  const {
    systemPrompt = 'Generate a concise 3-8 word title for a file based on its content. Return only the title, no quotes.',
    content,
    timeoutMs = 8000,
    model,
    temperature = 0.5,
    maxTokens = 25,
    label = 'TitleGenerator',
  } = options;

  console.log('[TitleGenerator] Destructured options:', { label, contentLength: content?.length, timeoutMs, model });

  try {
    // Check if API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    console.log('[TitleGenerator] OPENAI_API_KEY exists:', !!apiKey);

    if (!apiKey) {
      console.warn('[TitleGenerator] OPENAI_API_KEY not configured, skipping title generation');
      return undefined;
    }

    const openai = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Title generation timeout')), timeoutMs);
    });

    const titleModel = model || process.env.TITLE_GENERATION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    console.log('[TitleGenerator] Using model:', titleModel);

    console.log('[TitleGenerator] Calling OpenAI API...');

    const response = await Promise.race([
      openai.chat.completions.create({
        model: titleModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      timeoutPromise,
    ]) as any;

    console.log('[TitleGenerator] API Response received, choices length:', response?.choices?.length);

    const rawTitle = response.choices[0]?.message?.content?.trim();
    console.log('[TitleGenerator] Raw title from API:', rawTitle ? `"${rawTitle}"` : 'empty/undefined', 'length:', rawTitle?.length);

    if (rawTitle && rawTitle.length > 0 && rawTitle.length < 100) {
      // Remove any surrounding quotes
      const title = rawTitle.replace(/^["']|["']$/g, '');
      console.log('[TitleGenerator] Generated title successfully:', title);
      return title;
    } else {
      console.warn('[TitleGenerator] Title validation failed, rawTitle:', rawTitle);
      return undefined;
    }
  } catch (error: any) {
    console.error('[TitleGenerator] Failed to generate title:', error);
    console.error('[TitleGenerator] Error stack:', error?.stack);
    return undefined;
  }
}
