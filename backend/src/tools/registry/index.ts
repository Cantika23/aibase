import { Tool } from '../../llm/conversation';
import { ToolMetadata, ToolCache } from '../types';
import { ToolMetadataRegistry } from './tool-metadata';

/**
 * Main tool registry for managing tools
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private categories: Map<string, string[]> = new Map();
  private cache: ToolCache;

  constructor(cache?: ToolCache) {
    this.cache = cache || new ToolCache();
    this.initializeCategories();
  }

  /**
   * Initialize default categories
   */
  private initializeCategories(): void {
    const defaultCategories = ['data-access', 'utility', 'external-api', 'system'];
    defaultCategories.forEach(category => {
      this.categories.set(category, []);
    });
  }

  /**
   * Register a tool with metadata
   */
  registerTool(tool: Tool, metadata: ToolMetadata): void {
    // Store the tool
    this.tools.set(tool.name, tool);

    // Register metadata
    const metadataRegistry = new ToolMetadataRegistry();
    metadataRegistry.register(metadata);

    // Add to category
    if (!this.categories.has(metadata.category)) {
      this.categories.set(metadata.category, []);
    }
    const categoryTools = this.categories.get(metadata.category)!;
    if (!categoryTools.includes(tool.name)) {
      categoryTools.push(tool.name);
    }
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): boolean {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return false;
    }

    // Remove from tools map
    this.tools.delete(toolName);

    // Remove from category
    for (const [category, tools] of this.categories.entries()) {
      const index = tools.indexOf(toolName);
      if (index !== -1) {
        tools.splice(index, 1);
        break;
      }
    }

    // Clear cache for this tool
    this.cache.clear();

    return true;
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: string): Tool[] {
    const toolNames = this.categories.get(category) || [];
    return toolNames
      .map(name => this.tools.get(name))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  /**
   * Get all categories
   */
  getAllCategories(): string[] {
    return Array.from(this.categories.keys()).sort();
  }

  /**
   * Search tools by name or description
   */
  searchTools(query: string): Tool[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.tools.values()).filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get enabled tools (based on metadata)
   */
  getEnabledTools(): Tool[] {
    return Array.from(this.tools.values()).filter(tool => {
      // This would need access to metadata registry
      // For now, return all tools as enabled
      return true;
    });
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Get tool count by category
   */
  getToolCountByCategory(category: string): number {
    return this.categories.get(category)?.length || 0;
  }

  /**
   * Get tools that match a predicate
   */
  filterTools(predicate: (tool: Tool) => boolean): Tool[] {
    return Array.from(this.tools.values()).filter(predicate);
  }

  /**
   * Execute a tool with caching
   */
  async executeTool(name: string, args: any): Promise<any> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found`);
    }

    // Generate cache key
    const cacheKey = this.generateCacheKey(name, args);

    // Try to get from cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    // Execute the tool
    const result = await tool.execute(args);

    // Cache the result (if successful)
    if (result && typeof result === 'object') {
      await this.cache.set(cacheKey, result, 300000); // 5 minutes default TTL
    }

    return result;
  }

  /**
   * Generate cache key for tool execution
   */
  private generateCacheKey(toolName: string, args: any): string {
    const argsHash = Buffer.from(JSON.stringify(args)).toString('base64');
    return `${toolName}:${argsHash}`;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get registry statistics
   */
  getStats() {
    return {
      totalTools: this.tools.size,
      totalCategories: this.categories.size,
      toolsByCategory: Object.fromEntries(
        Array.from(this.categories.entries()).map(([category, tools]) => [
          category,
          tools.length
        ])
      ),
      enabledTools: this.getEnabledTools().length
    };
  }

  /**
   * Export registry configuration
   */
  exportRegistry(): {
    tools: Array<{ name: string; description: string }>;
    categories: string[];
    stats: ReturnType<typeof this.getStats>;
  } {
    return {
      tools: Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      categories: this.getAllCategories(),
      stats: this.getStats()
    };
  }

  /**
   * Validate tool before registration
   */
  private validateTool(tool: Tool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a valid name');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Tool must have a valid description');
    }

    if (!tool.parameters || typeof tool.parameters !== 'object') {
      throw new Error('Tool must have valid parameters schema');
    }

    if (typeof tool.execute !== 'function') {
      throw new Error('Tool must have an execute method');
    }

    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
  }

  /**
   * Health check for all tools
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, tool] of this.tools.entries()) {
      try {
        // Try to execute with empty args (most tools should handle this gracefully)
        await tool.execute({});
        results[name] = true;
      } catch (error) {
        console.warn(`Health check failed for tool "${name}":`, error);
        results[name] = false;
      }
    }

    return results;
  }
}