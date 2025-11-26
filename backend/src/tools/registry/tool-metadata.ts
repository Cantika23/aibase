import { ToolMetadata } from '../types';

/**
 * Default tool metadata
 */
export const createDefaultMetadata = (
  name: string,
  category: string,
  description: string,
  options: Partial<ToolMetadata> = {}
): ToolMetadata => ({
  name,
  category,
  description,
  version: '1.0.0',
  author: 'System',
  tags: [],
  dependencies: [],
  permissions: [],
  enabled: true,
  experimental: false,
  ...options
});

/**
 * Tool metadata registry
 */
export class ToolMetadataRegistry {
  private metadata: Map<string, ToolMetadata> = new Map();

  /**
   * Register tool metadata
   */
  register(metadata: ToolMetadata): void {
    this.metadata.set(metadata.name, metadata);
  }

  /**
   * Get metadata for a specific tool
   */
  get(toolName: string): ToolMetadata | undefined {
    return this.metadata.get(toolName);
  }

  /**
   * Get all metadata
   */
  getAll(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Get metadata by category
   */
  getByCategory(category: string): ToolMetadata[] {
    return Array.from(this.metadata.values()).filter(m => m.category === category);
  }

  /**
   * Get enabled tools
   */
  getEnabled(): ToolMetadata[] {
    return Array.from(this.metadata.values()).filter(m => m.enabled);
  }

  /**
   * Search tools by query
   */
  search(query: string): ToolMetadata[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.metadata.values()).filter(m =>
      m.name.toLowerCase().includes(lowerQuery) ||
      m.description.toLowerCase().includes(lowerQuery) ||
      m.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Check if a tool requires specific dependencies
   */
  hasDependencies(toolName: string): boolean {
    const metadata = this.metadata.get(toolName);
    return metadata ? metadata.dependencies.length > 0 : false;
  }

  /**
   * Get tools that depend on a specific tool
   */
  getDependents(dependencyName: string): ToolMetadata[] {
    return Array.from(this.metadata.values()).filter(m =>
      m.dependencies.includes(dependencyName)
    );
  }

  /**
   * Clear all metadata
   */
  clear(): void {
    this.metadata.clear();
  }

  /**
   * Get tool categories
   */
  getCategories(): string[] {
    const categories = new Set(Array.from(this.metadata.values()).map(m => m.category));
    return Array.from(categories).sort();
  }

  /**
   * Get experimental tools
   */
  getExperimental(): ToolMetadata[] {
    return Array.from(this.metadata.values()).filter(m => m.experimental);
  }

  /**
   * Get tools requiring specific permissions
   */
  getToolsWithPermission(permission: string): ToolMetadata[] {
    return Array.from(this.metadata.values()).filter(m =>
      m.permissions.includes(permission)
    );
  }
}

/**
 * Global metadata registry instance
 */
export const toolMetadataRegistry = new ToolMetadataRegistry();