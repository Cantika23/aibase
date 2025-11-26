import { TypedTool, ToolParameterSchema } from '../../types';
import { getAPIKey } from '../../config';

/**
 * News Fetcher Tool - Get recent news articles using News API
 */
export class NewsFetcherTool extends TypedTool {
  name = 'news_fetcher';
  description = 'Fetch recent news articles from various sources using News API';

  parameterSchema: Record<string, ToolParameterSchema> = {
    query: {
      type: 'string',
      description: 'Search query for news articles (optional - if not provided, gets top headlines)',
      required: false
    },
    category: {
      type: 'string',
      description: 'News category (business, entertainment, general, health, science, sports, technology)',
      enum: ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology'],
      required: false
    },
    country: {
      type: 'string',
      description: 'Country code (e.g., "us", "gb", "de")',
      required: false
    },
    language: {
      type: 'string',
      description: 'Language code (e.g., "en", "es", "fr")',
      required: false
    },
    page_size: {
      type: 'number',
      description: 'Number of articles to return (max 100)',
      minimum: 1,
      maximum: 100,
      required: false
    }
  };

  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query for news articles (optional - if not provided, gets top headlines)'
      },
      category: {
        type: 'string',
        description: 'News category (business, entertainment, general, health, science, sports, technology)',
        enum: ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']
      },
      country: {
        type: 'string',
        description: 'Country code (e.g., "us", "gb", "de")'
      },
      language: {
        type: 'string',
        description: 'Language code (e.g., "en", "es", "fr")'
      },
      page_size: {
        type: 'number',
        description: 'Number of articles to return (max 100)',
        minimum: 1,
        maximum: 100
      }
    }
  };

  protected async executeTyped(args: {
    query?: string;
    category?: string;
    country?: string;
    language?: string;
    page_size?: number;
  }): Promise<any> {
    const { query, category, country = 'us', language = 'en', page_size = 10 } = args;
    const apiKey = getAPIKey('newsapi');

    if (!apiKey) {
      throw new Error('News API key is not configured. Please set NEWS_API_KEY environment variable.');
    }

    try {
      let url: string;
      let params: URLSearchParams;

      if (query) {
        // Search for articles
        url = 'https://newsapi.org/v2/everything';
        params = new URLSearchParams({
          q: query,
          apiKey,
          language,
          pageSize: page_size.toString(),
          sortBy: 'publishedAt'
        });
      } else {
        // Get top headlines
        url = 'https://newsapi.org/v2/top-headlines';
        params = new URLSearchParams({
          apiKey,
          country,
          pageSize: page_size.toString()
        });

        if (category) {
          params.append('category', category);
        }
      }

      const fullUrl = `${url}?${params}`;

      // Make API request
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`News API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();

      // Process and format the response
      const articles = data.articles.map((article: any, index: number) => ({
        id: index + 1,
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        image_url: article.urlToImage,
        source: {
          name: article.source.name,
          id: article.source.id
        },
        author: article.author,
        published_at: article.publishedAt,
        summary: article.description ? article.description.substring(0, 200) + '...' : null
      }));

      return {
        query: query || null,
        category: category || 'top-headlines',
        country,
        language,
        total_results: data.totalResults,
        articles,
        articles_returned: articles.length,
        timestamp: new Date().toISOString(),
        data_source: 'News API'
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`News fetch failed: ${error.message}`);
      }
      throw new Error('News fetch failed: Unknown error');
    }
  }
}