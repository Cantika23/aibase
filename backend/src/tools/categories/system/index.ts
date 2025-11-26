import { Tool } from '../../../llm/conversation';
import { ToolMetadata } from '../../types';
import { createDefaultMetadata } from '../../registry/tool-metadata';
import { isToolEnabled } from '../../config';

// Import tools
import { MemoryStatsTool } from './memory-stats';
import { DiskUsageTool } from './disk-usage';
import { ProcessManagerTool } from './process-manager';

/**
 * Get all system tools
 */
export async function getTools(): Promise<Tool[]> {
  const tools: Tool[] = [];

  // Only add system tools if they're enabled
  if (isToolEnabled('system_tools')) {
    tools.push(new MemoryStatsTool());
    tools.push(new DiskUsageTool());
    tools.push(new ProcessManagerTool());
  }

  return tools;
}

/**
 * Get metadata for all system tools
 */
export function getToolMetadata(toolName: string): ToolMetadata | null {
  const metadataMap: Record<string, ToolMetadata> = {
    'memory_stats': createDefaultMetadata(
      'memory_stats',
      'system',
      'Get system memory usage statistics',
      {
        tags: ['system', 'memory', 'monitoring'],
        permissions: ['system_read'],
        dependencies: []
      }
    ),
    'disk_usage': createDefaultMetadata(
      'disk_usage',
      'system',
      'Get disk usage statistics',
      {
        tags: ['system', 'disk', 'storage', 'monitoring'],
        permissions: ['system_read'],
        dependencies: []
      }
    ),
    'process_manager': createDefaultMetadata(
      'process_manager',
      'system',
      'Get system process information (read-only)',
      {
        tags: ['system', 'process', 'monitoring'],
        permissions: ['system_read'],
        dependencies: []
      }
    )
  };

  return metadataMap[toolName] || null;
}