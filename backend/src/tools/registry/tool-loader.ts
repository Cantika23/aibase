import { Tool } from '../../llm/conversation';
import { ToolMetadata } from '../types';
import { createDefaultMetadata } from './tool-metadata';

/**
 * Tool loader interface
 */
export interface IToolLoader {
  loadAllTools(): Promise<Tool[]>;
  loadCategoryTools(category: string): Promise<Tool[]>;
  getToolMetadata(toolName: string): ToolMetadata;
}

/**
 * Static tool loader implementation
 */
export class ToolLoader implements IToolLoader {
  private static instance: ToolLoader;
  private metadataCache: Map<string, ToolMetadata> = new Map();

  private constructor() {
    this.initializeMetadataCache();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ToolLoader {
    if (!ToolLoader.instance) {
      ToolLoader.instance = new ToolLoader();
    }
    return ToolLoader.instance;
  }

  /**
   * Load all tools from all categories
   */
  async loadAllTools(): Promise<Tool[]> {
    const categories = ['data-access', 'utility', 'external-api', 'system'];
    const allTools: Tool[] = [];

    for (const category of categories) {
      try {
        const categoryTools = await this.loadCategoryTools(category);
        allTools.push(...categoryTools);
      } catch (error) {
        console.warn(`Failed to load tools from category "${category}":`, error);
        // Continue loading other categories even if one fails
      }
    }

    return allTools;
  }

  /**
   * Load tools from a specific category
   */
  async loadCategoryTools(category: string): Promise<Tool[]> {
    try {
      // Import the category index
      const categoryModule = await import(`../categories/${category}`);

      if (categoryModule.getTools && typeof categoryModule.getTools === 'function') {
        const tools = await categoryModule.getTools();

        // Cache metadata for each tool
        if (categoryModule.getToolMetadata && typeof categoryModule.getToolMetadata === 'function') {
          for (const tool of tools) {
            const metadata = categoryModule.getToolMetadata(tool.name);
            if (metadata) {
              this.metadataCache.set(tool.name, metadata);
            }
          }
        }

        return tools;
      }

      return [];
    } catch (error) {
      console.warn(`Could not load category "${category}":`, error);
      return [];
    }
  }

  /**
   * Get metadata for a specific tool
   */
  getToolMetadata(toolName: string): ToolMetadata {
    // Check cache first
    const cached = this.metadataCache.get(toolName);
    if (cached) {
      return cached;
    }

    // Try to find the tool by searching all categories
    return this.findToolMetadata(toolName);
  }

  /**
   * Find tool metadata by searching all categories
   */
  private async findToolMetadata(toolName: string): Promise<ToolMetadata> {
    const categories = ['data-access', 'utility', 'external-api', 'system'];

    for (const category of categories) {
      try {
        const categoryModule = await import(`../categories/${category}`);

        if (categoryModule.getToolMetadata && typeof categoryModule.getToolMetadata === 'function') {
          const metadata = categoryModule.getToolMetadata(toolName);
          if (metadata) {
            this.metadataCache.set(toolName, metadata);
            return metadata;
          }
        }
      } catch (error) {
        // Continue searching other categories
      }
    }

    // Return default metadata if not found
    const defaultMetadata = createDefaultMetadata(
      toolName,
      'unknown',
      `Tool ${toolName}`,
      { experimental: true }
    );

    this.metadataCache.set(toolName, defaultMetadata);
    return defaultMetadata;
  }

  /**
   * Initialize metadata cache with known tools
   */
  private initializeMetadataCache(): void {
    // Pre-populate with built-in tools metadata
    const builtinTools = [
      createDefaultMetadata(
        'get_current_time',
        'utility',
        'Get the current date and time',
        { tags: ['time', 'date'] }
      ),
      createDefaultMetadata(
        'calculate',
        'utility',
        'Calculate mathematical expressions',
        { tags: ['math', 'calculator'] }
      )
    ];

    builtinTools.forEach(metadata => {
      this.metadataCache.set(metadata.name, metadata);
    });
  }

  /**
   * Get all cached metadata
   */
  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.metadataCache.values());
  }

  /**
   * Get metadata by category
   */
  getMetadataByCategory(category: string): ToolMetadata[] {
    return Array.from(this.metadataCache.values()).filter(m => m.category === category);
  }

  /**
   * Check if a tool exists
   */
  hasToolMetadata(toolName: string): boolean {
    return this.metadataCache.has(toolName);
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.metadataCache.clear();
    this.initializeMetadataCache();
  }

  /**
   * Add custom metadata
   */
  addToolMetadata(metadata: ToolMetadata): void {
    this.metadataCache.set(metadata.name, metadata);
  }

  /**
   * Get tools that are enabled
   */
  getEnabledTools(): string[] {
    return Array.from(this.metadataCache.values())
      .filter(metadata => metadata.enabled)
      .map(metadata => metadata.name);
  }

  /**
   * Get experimental tools
   */
  getExperimentalTools(): string[] {
    return Array.from(this.metadataCache.values())
      .filter(metadata => metadata.experimental)
      .map(metadata => metadata.name);
  }

  /**
   * Get tools by tag
   */
  getToolsByTag(tag: string): string[] {
    return Array.from(this.metadataCache.values())
      .filter(metadata => metadata.tags.includes(tag))
      .map(metadata => metadata.name);
  }

  /**
   * Get tools that require specific dependencies
   */
  getToolsWithDependency(dependency: string): string[] {
    return Array.from(this.metadataCache.values())
      .filter(metadata => metadata.dependencies.includes(dependency))
      .map(metadata => metadata.name);
  }

  /**
   * Validate tool configuration
   */
  validateToolConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [toolName, metadata] of this.metadataCache.entries()) {
      if (!metadata.name || metadata.name !== toolName) {
        errors.push(`Tool "${toolName}" has invalid name in metadata`);
      }

      if (!metadata.category) {
        errors.push(`Tool "${toolName}" has no category specified`);
      }

      if (!metadata.description) {
        errors.push(`Tool "${toolName}" has no description specified`);
      }

      if (!metadata.version) {
        errors.push(`Tool "${toolName}" has no version specified`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export metadata as JSON
   */
  exportMetadata(): string {
    const metadataObject = Object.fromEntries(this.metadataCache.entries());
    return JSON.stringify(metadataObject, null, 2);
  }

  /**
   * Import metadata from JSON
   */
  importMetadata(jsonString: string): void {
    try {
      const metadataObject = JSON.parse(jsonString);

      for (const [toolName, metadata] of Object.entries(metadataObject)) {
        const toolMetadata = metadata as ToolMetadata;
        this.metadataCache.set(toolName, toolMetadata);
      }
    } catch (error) {
      throw new Error(`Failed to import metadata: ${error}`);
    }
  }
}

/**
 * Export singleton instance for backward compatibility
 */
export const toolLoader = ToolLoader.getInstance();