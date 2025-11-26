import { Tool } from '../../../llm/conversation';
import { ToolMetadata } from '../../types';
import { createDefaultMetadata } from '../../registry/tool-metadata';
import { hasAPIKey } from '../../config';

// Import tools
import { WeatherTool } from './weather';
import { NewsFetcherTool } from './news-fetcher';

/**
 * Get all external API tools
 */
export async function getTools(): Promise<Tool[]> {
  const tools: Tool[] = [];

  // Add weather tool if API key is available
  if (hasAPIKey('openweathermap')) {
    tools.push(new WeatherTool());
  }

  // Add news fetcher tool if API key is available
  if (hasAPIKey('newsapi')) {
    tools.push(new NewsFetcherTool());
  }

  return tools;
}

/**
 * Get metadata for all external API tools
 */
export function getToolMetadata(toolName: string): ToolMetadata | null {
  const metadataMap: Record<string, ToolMetadata> = {
    'weather': createDefaultMetadata(
      'weather',
      'external-api',
      'Get current weather information for a location',
      {
        tags: ['weather', 'api', 'openweathermap'],
        permissions: ['api_call'],
        dependencies: ['openweathermap_api_key']
      }
    ),
    'news_fetcher': createDefaultMetadata(
      'news_fetcher',
      'external-api',
      'Fetch recent news articles',
      {
        tags: ['news', 'api', 'articles'],
        permissions: ['api_call'],
        dependencies: ['newsapi_key']
      }
    )
  };

  return metadataMap[toolName] || null;
}