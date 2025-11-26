import { Tool } from '../llm/conversation';
import { initializeToolRegistry, getAllTools } from './index';
import { getBuiltinTools } from './builtin-tools';

/**
 * Global tool registry instance
 */
let toolRegistry: any = null;

/**
 * Initialize the tool registry (call this once at startup)
 */
export async function initializeTools(): Promise<void> {
  try {
    toolRegistry = await initializeToolRegistry();
    console.log('Advanced tool system initialized with', toolRegistry?.getToolCount(), 'tools');
  } catch (error) {
    console.error('Failed to initialize tool registry:', error);
    console.log('Falling back to basic tools only');
    toolRegistry = null;
  }
}

/**
 * Get all available tools (both built-in and advanced)
 */
export async function getAllAvailableTools(): Promise<Tool[]> {
  if (toolRegistry) {
    try {
      return toolRegistry.getAllTools();
    } catch (error) {
      console.error('Failed to get tools from registry:', error);
    }
  }

  // Fallback to basic tools
  return getBuiltinTools();
}

/**
 * Get tools by category
 */
export async function getToolsByCategory(category: string): Promise<Tool[]> {
  if (toolRegistry) {
    try {
      return toolRegistry.getToolsByCategory(category);
    } catch (error) {
      console.error(`Failed to get tools for category "${category}":`, error);
    }
  }

  return [];
}

/**
 * Get tool registry statistics
 */
export function getToolStats(): any {
  if (toolRegistry) {
    try {
      return toolRegistry.getStats();
    } catch (error) {
      console.error('Failed to get tool stats:', error);
    }
  }

  return {
    totalTools: getBuiltinTools().length,
    builtinOnly: true
  };
}

/**
 * Check if advanced tools are available
 */
export function hasAdvancedTools(): boolean {
  return toolRegistry !== null;
}

/**
 * Export the tool registry for advanced usage
 */
export function getToolRegistry(): any {
  return toolRegistry;
}