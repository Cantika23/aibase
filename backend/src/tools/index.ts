import { Tool } from '../llm/conversation';
import { ToolRegistry } from './registry';
import { toolLoader } from './registry/tool-loader';
import { validateToolConfig } from './config';

/**
 * Initialize and return the tool registry with all available tools
 */
export async function initializeToolRegistry(): Promise<ToolRegistry> {
  // Validate tool configuration
  const configValidation = validateToolConfig();
  if (!configValidation.valid) {
    console.warn('Tool configuration validation failed:', configValidation.errors);
  }

  // Create registry
  const registry = new ToolRegistry();

  try {
    // Load all tools
    const tools = await toolLoader.loadAllTools();

    // Register each tool with metadata
    for (const tool of tools) {
      try {
        const metadata = toolLoader.getToolMetadata(tool.name);
        registry.registerTool(tool, metadata);
        console.log(`Registered tool: ${tool.name} (${metadata.category})`);
      } catch (error) {
        console.error(`Failed to register tool ${tool.name}:`, error);
      }
    }

    console.log(`Tool registry initialized with ${registry.getToolCount()} tools`);
    console.log('Available categories:', registry.getAllCategories());

  } catch (error) {
    console.error('Failed to load tools:', error);
  }

  return registry;
}

/**
 * Get all tools directly (backward compatibility)
 */
export async function getAllTools(): Promise<Tool[]> {
  return await toolLoader.loadAllTools();
}

/**
 * Get tools by category
 */
export async function getToolsByCategory(category: string): Promise<Tool[]> {
  try {
    return await toolLoader.loadCategoryTools(category);
  } catch (error) {
    console.error(`Failed to load tools for category "${category}":`, error);
    return [];
  }
}

/**
 * Get tool metadata
 */
export function getToolMetadata(toolName: string) {
  return toolLoader.getToolMetadata(toolName);
}

/**
 * Export tool loader for direct access
 */
export { toolLoader };

/**
 * Export ToolRegistry class
 */
export { ToolRegistry };

/**
 * Export configuration utilities
 */
export * from './config';

/**
 * Export types and utilities
 */
export * from './types';
export * from './registry/tool-metadata';