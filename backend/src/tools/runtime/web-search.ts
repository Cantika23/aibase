import { DDGS } from "@phukon/duckduckgo-search";

/**
 * Web search options using DuckDuckGo
 */
export interface WebSearchOptions {
  /** Search query/keywords (required) */
  query?: string;
  /** Region code (default: 'wt-wt' for worldwide) */
  region?: string;
  /** SafeSearch level: 'off', 'moderate', 'strict' (default: 'moderate') */
  safesearch?: "off" | "moderate" | "strict";
  /** Time restriction: 'd' (day), 'w' (week), 'm' (month), 'y' (year) */
  timelimit?: "d" | "w" | "m" | "y";
  /** Maximum number of results to return (default: 10) */
  maxResults?: number;

  // Legacy parameter support (deprecated)
  /** @deprecated Use 'query' instead */
  search_query?: string;
  /** @deprecated Use 'maxResults' instead */
  count?: number;
  /** @deprecated Use 'timelimit' instead */
  search_recency_filter?: "oneDay" | "oneWeek" | "oneMonth" | "oneYear" | "noLimit";
}

/**
 * Web search result from DuckDuckGo
 */
export interface WebSearchResult {
  title: string;
  href: string;
  body: string;
}

/**
 * Map legacy time filter to new format
 */
function mapTimelimit(legacy?: string): "d" | "w" | "m" | "y" | null {
  if (!legacy) return null;
  const map: Record<string, "d" | "w" | "m" | "y"> = {
    oneDay: "d",
    oneWeek: "w",
    oneMonth: "m",
    oneYear: "y",
  };
  return map[legacy] || null;
}

/**
 * Create a web search function that uses DuckDuckGo
 * Supports both new and legacy parameter names for backward compatibility
 */
export function createWebSearchFunction() {
  return async (options: WebSearchOptions): Promise<WebSearchResult[]> => {
    if (!options || typeof options !== 'object') {
      throw new Error("webSearch requires an options object. Usage: webSearch({ query: 'search terms', maxResults: 10 })");
    }

    // Support legacy parameter names for backward compatibility
    const query = options.query || options.search_query;
    const maxResults = options.maxResults || options.count || 10;
    const timelimit = options.timelimit || mapTimelimit(options.search_recency_filter);

    if (!query) {
      throw new Error("webSearch requires 'query' parameter. Usage: webSearch({ query: 'search terms', maxResults: 10 })");
    }

    try {
      const ddgs = new DDGS({
        timeout: 15000,
        verify: true,
      });

      const results = await ddgs.text({
        keywords: query,
        region: options.region || "wt-wt",
        safesearch: options.safesearch || "moderate",
        timelimit: timelimit || null,
        maxResults: maxResults,
      });

      return results as WebSearchResult[];
    } catch (error: any) {
      throw new Error(`Web search failed: ${error.message}`);
    }
  };
}
