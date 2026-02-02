/**
 * Title Generation Utility
 * Shared helper for generating AI-powered titles for uploaded files
 */

import OpenAI from "openai";
import { createLogger } from "./logger";

const logger = createLogger("TitleGeneratorUtil");

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
export async function generateTitle(
  options: TitleGenerationOptions,
): Promise<string | undefined> {
  logger.debug("generateTitle called");

  const model = "GLM-4.5-Air";
  const {
    systemPrompt = "Generate a concise 3-8 word title for a file based on its content. Return only the title, no quotes.",
    content,
    temperature = 0.5,
    label = "TitleGenerator",
  } = options;

  logger.debug({ label, contentLength: content?.length, model }, "Destructured options");

  try {
    // Check if API key is configured
    const apiKey = process.env.OPENAI_API_KEY;
    logger.debug({ hasApiKey: !!apiKey }, "Checking OPENAI_API_KEY");

    if (!apiKey) {
      logger.warn("OPENAI_API_KEY not configured, skipping title generation");
      return undefined;
    }

    const openai = new OpenAI({
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey,
    });

    const titleModel =
      model ||
      process.env.TITLE_GENERATION_MODEL ||
      process.env.OPENAI_MODEL ||
      "gpt-4o-mini";
    logger.debug({ titleModel }, "Using model");

    logger.debug("Calling OpenAI API");

    const response = (await Promise.race([
      openai.chat.completions.create({
        model: titleModel,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content,
          },
        ],
        temperature,
        // Disable or minimize reasoning effort for title generation
        reasoning_effort: "low",
      }),
    ])) as any;

    logger.debug({ choicesLength: response?.choices?.length }, "API Response received");

    // Extract title from response
    const rawTitle = response.choices[0]?.message?.content?.trim() || "";

    logger.debug({ rawTitle, length: rawTitle?.length }, "Raw title from API");

    if (rawTitle && rawTitle.length > 0 && rawTitle.length < 100) {
      // Remove any surrounding quotes
      const title = rawTitle.replace(/^["']|["']$/g, "");
      logger.debug({ title }, "Generated title successfully");
      return title;
    } else {
      logger.warn({ rawTitle }, "Title validation failed");
      return undefined;
    }
  } catch (error: any) {
    logger.error({ error }, "Failed to generate title");
    return undefined;
  }
}
