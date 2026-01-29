/**
 * Search Extension
 * Web and image search using Brave Search API
 */

// Type definitions
interface WebSearchOptions {
  search_query: string;
  count?: number;
  country?: string;
  search_lang?: string;
  safesearch?: "off" | "moderate" | "strict";
  freshness?: "pd" | "pw" | "pm" | "py" | "pn";
  text_decorrelation?: boolean;
}

interface ImageSearchOptions {
  search_query: string;
  count?: number;
  country?: string;
  safesearch?: "off" | "moderate" | "strict";
  spellcheck?: boolean;
}

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  page_age?: string;
  language?: string;
  meta_url?: {
    favicon?: string;
  };
}

interface BraveWebSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

interface BraveImageResult {
  title?: string;
  properties?: {
    url?: string;
    width?: number;
    height?: number;
  };
  url?: string;
  thumbnail?: {
    src?: string;
  };
  source?: string;
}

interface BraveImageSearchResponse {
  results?: BraveImageResult[];
}

interface TransformedWebResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  language?: string;
  favicon?: string;
}

interface TransformedImageResult {
  title: string;
  url: string;
  thumbnail: string;
  source: string;
  width?: number;
  height?: number;
}

interface WebSearchResult {
  results: TransformedWebResult[];
  total: number;
}

interface ImageSearchResult {
  results: TransformedImageResult[];
  total: number;
}

/**
 * Context documentation for the search extension
 */
const context = () =>
  '' +
  '### Search Extension\n\n' +
  'Search the web and find images using Brave Search API.\n\n' +
  '**Available Functions:**\n\n' +
  '#### web(options)\n' +
  'Search the web for information.\n\n' +
  '`' + '`' + '`' + 'typescript\n' +
  'await search.web({\n' +
  '  search_query: "latest AI developments 2024",\n' +
  '  count: 10,                   // Optional: number of results (default: 10)\n' +
  '  country: "US",               // Optional: country code\n' +
  '  search_lang: "en",           // Optional: language code\n' +
  '  safesearch: "moderate",      // Optional: "off", "moderate", "strict"\n' +
  '  freshness: "py",             // Optional: time filter - "pd", "pw", "pm", "py", "pn"\n' +
  '  text_decorrelation: true      // Optional: deduplicate results\n' +
  '});\n' +
  '`' + '`' + '`' + '\n\n' +
  '**Parameters:**\n' +
  '- `search_query` (required): Search query string\n' +
  '- `count` (optional): Number of results to return (default: 10)\n' +
  '- `country` (optional): Country code (e.g., "US", "UK", "ID")\n' +
  '- `search_lang` (optional): Language code (e.g., "en", "id", "es")\n' +
  '- `safesearch` (optional): Safe search level - "off", "moderate", "strict"\n' +
  '- `freshness` (optional): Time filter\n' +
  '  - `pd`: past day\n' +
  '  - `pw`: past week\n' +
  '  - `pm`: past month\n' +
  '  - `py`: past year\n' +
  '  - `pn`: no limit\n' +
  '- `text_decorrelation` (optional): Remove similar results (default: false)\n\n' +
  '**Returns:**\n' +
  '`' + '`' + '`' + 'typescript\n' +
  '{\n' +
  '  results: Array<{\n' +
  '    title: string,\n' +
  '    url: string,\n' +
  '    description: string,\n' +
  '    published?: string\n' +
  '  }>,\n' +
  '  total: number\n' +
  '}\n' +
  '`' + '`' + '`' + '\n\n' +
  '#### image(options)\n' +
  'Search for images.\n\n' +
  '`' + '`' + '`' + 'typescript\n' +
  'await search.image({\n' +
  '  search_query: "cute cats",\n' +
  '  count: 10,                    // Optional: number of results (default: 20)\n' +
  '  country: "US",                // Optional: country code\n' +
  '  safesearch: "moderate",        // Optional: "off", "moderate", "strict"\n' +
  '  spellcheck: true               // Optional: enable spell checking\n' +
  '});\n' +
  '`' + '`' + '`' + '\n\n' +
  '**Parameters:**\n' +
  '- `search_query` (required): Search query string\n' +
  '- `count` (optional): Number of results to return (default: 20)\n' +
  '- `country` (optional): Country code (e.g., "US", "UK", "ID")\n' +
  '- `safesearch` (optional): Safe search level - "off", "moderate", "strict"\n' +
  '- `spellcheck` (optional): Enable spell checking (default: false)\n\n' +
  '**Returns:**\n' +
  '`' + '`' + '`' + 'typescript\n' +
  '{\n' +
  '  results: Array<{\n' +
  '    title: string,\n' +
  '    url: string,\n' +
  '    thumbnail: string,\n' +
  '    source: string,\n' +
  '    width?: number,\n' +
  '    height?: number\n' +
  '  }>,\n' +
  '  total: number\n' +
  '}\n' +
  '`' + '`' + '`' + '\n\n' +
  '**Examples:**\n\n' +
  '1. **Basic web search:**\n' +
  '`' + '`' + '`' + 'typescript\n' +
  'const results = await search.web({\n' +
  '  search_query: "TypeScript vs JavaScript 2024",\n' +
  '  count: 5\n' +
  '});\n' +
  'return { count: results.total, results: results.results };\n' +
  '`' + '`' + '`' + '\n\n' +
  '2. **Recent news with freshness filter:**\n' +
  '`' + '`' + '`' + 'typescript\n' +
  'const news = await search.web({\n' +
  '  search_query: "AI news",\n' +
  '  count: 10,\n' +
  '  freshness: "pw"  // Past week\n' +
  '});\n' +
  'return news.results;\n' +
  '`' + '`' + '`' + '\n\n' +
  '3. **Basic image search:**\n' +
  '`' + '`' + '`' + 'typescript\n' +
  'const images = await search.image({\n' +
  '  search_query: "sunset over mountains",\n' +
  '  count: 5\n' +
  '});\n' +
  'return { count: images.total, images: images.results };\n' +
  '`' + '`' + '`' + '\n\n' +
  '4. **Safe image search:**\n' +
  '`' + '`' + '`' + 'typescript\n' +
  'const images = await search.image({\n' +
  '  search_query: "nature photography",\n' +
  '  count: 10,\n' +
  '  safesearch: "strict"\n' +
  '});\n' +
  'return images.results;\n' +
  '`' + '`' + '`' + '\n\n' +
  '**Important Notes:**\n' +
  '- Requires BRAVE_API_KEY environment variable\n' +
  '- Get API key from https://brave.com/search/api/\n' +
  '- Provides access to current web information\n' +
  '- Use freshness parameter to get recent results';

/**
 * Get API key from environment
 */
function getBraveApiKey(): string {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BRAVE_API_KEY environment variable is not set. Get your API key from https://brave.com/search/api/"
    );
  }
  return apiKey;
}

/**
 * Search extension - combines web and image search
 */
const searchExtension = {
  /**
   * Search the web for information
   *
   * Usage:
   * const results = await search.web({ search_query: 'latest AI news', count: 5 });
   */
  web: async (options: WebSearchOptions): Promise<WebSearchResult> => {
    if (!options || typeof options !== "object") {
      throw new Error(
        "search.web requires an options object. Usage: await search.web({ search_query: 'your query' })"
      );
    }

    if (!options.search_query) {
      throw new Error(
        "search.web requires 'search_query' parameter"
      );
    }

    try {
      const params = new URLSearchParams({
        q: options.search_query,
        count: String(options.count ?? 10),
      });

      if (options.country) {
        params.append("country", options.country);
      }

      if (options.search_lang) {
        params.append("search_lang", options.search_lang);
      }

      params.append("safesearch", options.safesearch || "strict");

      if (options.freshness) {
        params.append("freshness", options.freshness);
      }

      if (options.text_decorrelation !== undefined) {
        params.append("text_decorrelation", String(options.text_decorrelation));
      }

      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": getBraveApiKey(),
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Brave web search failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as BraveWebSearchResponse;

      const webResults = data.web?.results || [];
      const transformedResults = webResults.map((item: BraveWebResult): TransformedWebResult => ({
        title: item.title || "",
        url: item.url || "",
        description: item.description || "",
        age: item.age || item.page_age,
        language: item.language,
        favicon: item.meta_url?.favicon,
      }));

      return {
        results: transformedResults,
        total: transformedResults.length,
      };
    } catch (error: unknown) {
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  /**
   * Search for images
   *
   * Usage:
   * const images = await search.image({ search_query: 'cute cats', count: 10 });
   */
  image: async (options: ImageSearchOptions): Promise<ImageSearchResult> => {
    if (!options || typeof options !== "object") {
      throw new Error(
        "search.image requires an options object. Usage: await search.image({ search_query: 'your query' })"
      );
    }

    if (!options.search_query) {
      throw new Error(
        "search.image requires 'search_query' parameter"
      );
    }

    try {
      const params = new URLSearchParams({
        q: options.search_query,
        count: String(options.count ?? 20),
      });

      if (options.country) {
        params.append("country", options.country);
      }

      if (options.safesearch) {
        params.append("safesearch", options.safesearch);
      }

      if (options.spellcheck !== undefined) {
        params.append("spellcheck", String(options.spellcheck));
      }

      const response = await fetch(
        `https://api.search.brave.com/res/v1/images/search?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": getBraveApiKey(),
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Brave image search failed: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json() as BraveImageSearchResponse;

      const imageResults = data.results || [];
      const transformedResults = imageResults.map((item: BraveImageResult): TransformedImageResult => ({
        title: item.title || "",
        url: item.properties?.url || item.url || "",
        thumbnail: item.thumbnail?.src || "",
        source: item.source || "",
        width: item.properties?.width,
        height: item.properties?.height,
      }));

      return {
        results: transformedResults,
        total: transformedResults.length,
      };
    } catch (error: unknown) {
      throw new Error(`Image search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

// Return the extension object (extension loader wraps this in an async function)
// @ts-expect-error - Extension loader wraps this code in an async function
return searchExtension;
