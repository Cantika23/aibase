/**
 * Extension Generator Service
 * AI-powered extension creation using OpenAI API
 */

import OpenAI from "openai";
import { createLogger } from "../utils/logger";

const logger = createLogger("ExtensionGeneratorService");

export interface GenerateExtensionOptions {
  projectId: string;
  category: string;
}

export interface GeneratedExtension {
  metadata: {
    id: string;
    name: string;
    description: string;
    version: string;
    category: string;
    author?: string;
  };
  code: string;
}

/**
 * Generate extension from user prompt using AI
 */
export async function generateExtension(
  userPrompt: string,
  options: GenerateExtensionOptions
): Promise<GeneratedExtension> {
  const { projectId, category } = options;

  // Construct system prompt for extension generation
  const systemPrompt = `You are an expert TypeScript developer specializing in creating AIBase extensions.

AIBase is a platform where users can write and execute TypeScript code with access to various tools.

## Extension Structure

Every extension must follow this structure:

\`\`\`typescript
const extensionName = {
  // Main function - MUST match the extension ID
  functionId: async (params: { /* parameters */ }) => {
    // Implementation here
    return result;
  },

  // Optional helper functions
  helperFunction: async (/* params */) => {
    // Helper implementation
  }
};

export default extensionName;
\`\`\`

## Extension Metadata

Each extension MUST have:
- id: Unique identifier (kebab-case, e.g., 'my-extension')
- name: Display name (e.g., 'My Extension')
- description: Clear description of what it does
- version: Semantic version (e.g., '1.0.0')
- category: Category for grouping (e.g., 'Data Tools', 'Database Tools', 'Web Tools', 'Utility Tools')
  - IMPORTANT: If no specific category is needed, use empty string '' NOT the word "Uncategorized"

## Important Rules

1. **Function Naming**: The main function name MUST match the extension ID
   - Extension ID: 'data-processor' → Function: 'dataProcessor'
   - Extension ID: 'csv-exporter' → Function: 'csvExporter'

2. **Async Functions**: All functions MUST be async
   - Use async/await for any async operations

3. **Error Handling**: Always wrap code in try-catch
   - Return meaningful error messages

4. **No Side Effects**: Don't modify global state
   - Extensions should be pure functions

5. **Type Safety**: Use TypeScript interfaces for parameters
   - Define clear input/output types

6. **Security**:
   - NEVER hardcode credentials
   - Validate user inputs
   - Don't use eval() or similar dangerous functions

7. **Available Context**:
   - Extensions run in a script context with access to:
     - fetch (for HTTP requests)
     - console (for debugging)
     - progress(message) (for status updates)
     - memory.read(category, key) (for stored credentials)

8. **File Processing Extensions (example: PDF, Excel, Image, etc.)**:
   - If the extension processes files (e.g., PDF, Excel, Image), it MUST register an \`afterFileUpload\` hook
   - The hook should return both \`description\` AND \`title\`:
     - \`description\`: Detailed analysis of the file content
     - \`title\`: A concise 3-8 word title generated using AI (OpenAI)
   - Title generation MUST have an 8-second timeout to avoid hanging uploads
   - Use the TITLE_GENERATION_MODEL env var if set, otherwise fall back to OPENAI_MODEL
   - Example hook registration for file processors:
     \`\`\`typescript
     if (hookRegistry) {
       hookRegistry.registerHook('afterFileUpload', 'extension-id', async (context) => {
         // Process file and extract content
         const content = await extractContent(context.filePath);

         // Generate title with timeout
         let title: string | undefined;
         try {
           const openai = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY });
           const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000);
           const response = await Promise.race([
             openai.chat.completions.create({
               model: process.env.TITLE_GENERATION_MODEL || process.env.OPENAI_MODEL,
               messages: [
                 { role: 'system', content: 'Generate a concise 3-8 word title. Return only the title, no quotes.' },
                 { role: 'user', content: \`File: \${context.fileName}\\nContent preview: \${content.substring(0, 200)}\` }
               ],
               temperature: 0.5,
               max_tokens: 25
             }),
             timeoutPromise
           ]);
           title = response.choices[0]?.message?.content?.trim()?.replace(/^["']|["']$/g, '');
         } catch (e) {
           // Continue without title on timeout/error
         }

         return { description: content, title };
       });
     }
     \`\`\`

## Response Format

Return ONLY valid JSON in this exact format (no markdown, no explanation):

\`\`\`json
{
  "id": "extension-id",
  "name": "Extension Name",
  "description": "Clear description of what this extension does",
  "version": "1.0.0",
  "category": "${category}",
  "code": "const extensionId = { /* complete extension code */ };\\nexport default extensionId;"
}
\`\`\`

## Examples

User: "I want an extension that can calculate the distance between two zip codes"
Assistant:
{
  "id": "zip-distance",
  "name": "Zip Code Distance Calculator",
  "description": "Calculate distance between two US zip codes using Haversine formula",
  "version": "1.0.0",
  "category": "Data Tools",
  "code": "const zipDistance = { async calculate(zip1: string, zip2: string): Promise<{ miles: number; kilometers: number }> { /* implementation */ } }; export default zipDistance;"
}

Now generate an extension based on the user's requirements.`;

  // User prompt
  const userMessage = `Generate a TypeScript extension for: ${userPrompt}

Requirements:
- Category: ${category}
- Project ID: ${projectId}

Generate the complete extension code following the structure specified above.`;

  logger.info('Calling OpenAI API for extension generation');
  logger.debug({ model: process.env.OPENAI_MODEL, baseURL: process.env.OPENAI_BASE_URL }, 'OpenAI configuration');

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  // Parse max_tokens from env, but cap at reasonable limit
  // Z.AI and other providers may have limits on max_tokens
  const configuredMaxTokens = parseInt(process.env.OPENAI_MAX_TOKEN || '4000', 10);
  const maxTokens = Math.min(configuredMaxTokens, 8000); // Cap at 8000 for compatibility
  logger.debug({ maxTokens, configuredMaxTokens }, 'Using max_tokens');

  // Call OpenAI API
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  });

  // Parse response
  logger.debug({
    choicesCount: response.choices?.length,
    hasContent: !!response.choices?.[0]?.message?.content,
    contentLength: response.choices?.[0]?.message?.content?.length || 0,
  }, 'OpenAI response received');

  const content = response.choices[0]?.message?.content;

  if (!content) {
    logger.error({ response }, 'Empty response from OpenAI');
    throw new Error('No content generated from OpenAI. The AI returned an empty response. This could be due to API quota limits, model restrictions, or invalid configuration.');
  }

  logger.info('Received response from OpenAI');
  logger.debug({ preview: content.substring(0, 500) }, 'Response preview');

  // Try to extract JSON from response - multiple strategies
  let jsonStr: string | null = null;
  let parsed: any = null;

  // Strategy 1: Try to parse the entire content as JSON FIRST
  // This is most reliable and handles nested braces correctly
  try {
    parsed = JSON.parse(content);
    jsonStr = content;
    logger.debug('Parsed entire content as JSON');
  } catch {
    // Not valid JSON as-is, continue to extraction strategies
  }

  // Strategy 2: Try to extract JSON from markdown code blocks with json tag
  if (!jsonStr) {
    // Match from ```json to closing ``` or end
    let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
      logger.debug({ length: jsonStr.length }, 'Found JSON in ```json block with closing ```');
    } else {
      logger.debug('Strategy 2a (```json block with closing ```): No match');
    }
  }

  // Strategy 2b: Try without closing ``` (match to end of content)
  if (!jsonStr) {
    let jsonMatch = content.match(/```json\s*([\s\S]*)$/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
      // Remove trailing ``` if present
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3).trim();
      }
      logger.debug({ length: jsonStr.length }, 'Found JSON in ```json block (no closing ```)');
    } else {
      logger.debug('Strategy 2b (```json block without closing ```): No match');
    }
  }

  // Strategy 3: Try to extract JSON from markdown code blocks without json tag (with closing ```)
  if (!jsonStr) {
    let jsonMatch = content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
      logger.debug({ length: jsonStr.length }, 'Found JSON in ``` block with closing ```');
    } else {
      logger.debug('Strategy 3a (``` block with closing ```): No match');
    }
  }

  // Strategy 3b: Try without closing ``` (match to end of content)
  if (!jsonStr) {
    let jsonMatch = content.match(/```\s*([\s\S]*)$/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
      // Remove trailing ``` if present
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3).trim();
      }
      logger.debug({ length: jsonStr.length }, 'Found JSON in ``` block (no closing ```)');
    } else {
      logger.debug('Strategy 3b (``` block without closing ```): No match');
    }
  }

  // Strategy 4: Try to find JSON object directly (starts with {, ends with })
  // NOTE: This is unreliable for JSON with nested braces in strings, use as last resort
  if (!jsonStr) {
    let jsonMatch = content.match(/\\{[\\s\\S]*\\}/);
    if (jsonMatch && jsonMatch[0]) {
      jsonStr = jsonMatch[0].trim(); // Trim whitespace
      logger.debug({ length: jsonStr.length }, 'Found JSON object directly');
    } else {
      logger.debug('Strategy 4 (direct JSON): No match');
    }
  }

  logger.debug({ jsonPreview: jsonStr ? jsonStr.substring(0, 100) + '...' : null }, 'Final JSON after all strategies');

  if (!jsonStr) {
    logger.error({ content }, 'Failed to extract JSON from response');
    throw new Error('Failed to extract JSON from AI response. AI did not return valid JSON format.');
  }

  // Try to parse the JSON string
  try {
    if (!parsed) {
      parsed = JSON.parse(jsonStr);
    }
  } catch (error: any) {
    logger.error({ error: error.message, jsonPreview: jsonStr.substring(0, 500) }, 'JSON parse error');
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }

  // Validate response structure
  if (!parsed.id || !parsed.name || !parsed.description || !parsed.code) {
    logger.error({ parsed }, 'Invalid AI response structure');
    throw new Error('Invalid AI response: missing required fields (id, name, description, or code)');
  }

  // Normalize category: convert 'Uncategorized' string to empty string
  let normalizedCategory = parsed.category || category || '';
  if (normalizedCategory === 'Uncategorized') {
    normalizedCategory = '';
    logger.debug('Normalized category from "Uncategorized" to empty string');
  }

  // Construct extension
  const extension: GeneratedExtension = {
    metadata: {
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      version: parsed.version || '1.0.0',
      category: normalizedCategory,
      author: 'AI Generated',
    },
    code: parsed.code,
  };

  logger.info({ extensionId: extension.metadata.id }, 'Generated extension');

  return extension;
}

/**
 * Validate generated extension code
 */
export async function validateExtensionCode(code: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Basic validation
  if (!code.includes('export default')) {
    errors.push('Extension must have a default export');
  }

  if (!code.includes('async')) {
    errors.push('Extension should use async functions');
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /require\s*\(/,
    /import\s*\(/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      errors.push(`Contains potentially dangerous code: ${pattern}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
