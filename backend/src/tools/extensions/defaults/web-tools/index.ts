/**
 * Web Tools Extension
 * Provides utilities for web operations, API calls, and data fetching
 */

export default {
  /**
   * Fetch JSON from an API endpoint with error handling
   */
  async fetchJSON(url: string, options?: RequestInit) {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Fetch multiple URLs in parallel
   */
  async fetchAll(urls: string[]) {
    const promises = urls.map(url => fetch(url).then(r => r.json()));
    return await Promise.all(promises);
  },

  /**
   * Retry a fetch request with exponential backoff
   */
  async fetchWithRetry(
    url: string,
    options?: RequestInit & { maxRetries?: number; initialDelay?: number }
  ) {
    const maxRetries = options?.maxRetries || 3;
    const initialDelay = options?.initialDelay || 1000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error: any) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          // @ts-ignore - progress is injected by script runtime
          progress(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  },

  /**
   * Parse HTML and extract text content (basic)
   */
  async fetchHTML(url: string) {
    const response = await fetch(url);
    const html = await response.text();

    // Very basic text extraction (remove tags)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return { html, text };
  },

  /**
   * Download file from URL to conversation files
   */
  async downloadFile(url: string, filename: string) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const content = await response.arrayBuffer();
    const base64 = Buffer.from(content).toString('base64');

    // @ts-ignore - file is injected by script runtime
    await file({
      action: 'write',
      path: filename,
      content: base64,
      encoding: 'base64'
    });

    return { filename, size: content.byteLength };
  },

  /**
   * Make a GraphQL request
   */
  async graphql(endpoint: string, query: string, variables?: Record<string, any>) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  },
};
