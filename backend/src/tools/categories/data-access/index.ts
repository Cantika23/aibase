import { Tool } from '../../../llm/conversation';
import { ToolMetadata } from '../../types';
import { createDefaultMetadata } from '../../registry/tool-metadata';
import { getToolConfig } from '../../config';

// Import tools
import { FileReaderTool } from './file-reader';
import { FileWriterTool } from './file-writer';
import { JsonProcessorTool } from './json-processor';
import { CsvProcessorTool } from './csv-processor';

/**
 * Get all data access tools
 */
export async function getTools(): Promise<Tool[]> {
  const config = getToolConfig();
  const tools: Tool[] = [];

  // Add file reader if file access is enabled
  if (config.fileAccess.allowedPaths.length > 0) {
    tools.push(new FileReaderTool());
    tools.push(new FileWriterTool());
  }

  // Add data processing tools
  tools.push(new JsonProcessorTool());
  tools.push(new CsvProcessorTool());

  return tools;
}

/**
 * Get metadata for all data access tools
 */
export function getToolMetadata(toolName: string): ToolMetadata | null {
  const metadataMap: Record<string, ToolMetadata> = {
    'file_reader': createDefaultMetadata(
      'file_reader',
      'data-access',
      'Read the contents of a text file',
      {
        tags: ['file', 'read', 'text'],
        permissions: ['file_read'],
        dependencies: []
      }
    ),
    'file_writer': createDefaultMetadata(
      'file_writer',
      'data-access',
      'Write content to a text file',
      {
        tags: ['file', 'write', 'text'],
        permissions: ['file_write'],
        dependencies: []
      }
    ),
    'json_processor': createDefaultMetadata(
      'json_processor',
      'data-access',
      'Process and transform JSON data',
      {
        tags: ['json', 'process', 'transform'],
        permissions: [],
        dependencies: []
      }
    ),
    'csv_processor': createDefaultMetadata(
      'csv_processor',
      'data-access',
      'Process and transform CSV data',
      {
        tags: ['csv', 'process', 'transform'],
        permissions: [],
        dependencies: []
      }
    )
  };

  return metadataMap[toolName] || null;
}