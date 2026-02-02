/**
 * Extension Hook System
 * Allows extensions to register callbacks for specific events
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('ExtensionHooks');

export type HookType = 'afterFileUpload';

export interface FileUploadContext {
  convId: string;
  projectId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
}

export interface FileUploadResult {
  description?: string;
  title?: string;
  [key: string]: any;
}

export type FileUploadHook = (context: FileUploadContext) => Promise<FileUploadResult | void>;

/**
 * Hook registry for extension callbacks
 */
class ExtensionHookRegistry {
  private hooks: Map<HookType, Set<{ extensionId: string; callback: any }>> = new Map();

  /**
   * Register a hook for an extension
   */
  registerHook(type: HookType, extensionId: string, callback: any): void {
    if (!this.hooks.has(type)) {
      this.hooks.set(type, new Set());
    }

    const hooks = this.hooks.get(type)!;

    // Check if this extension already has a hook registered for this type
    const existing = Array.from(hooks).find(h => h.extensionId === extensionId);
    if (existing) {
      logger.debug({ type, extensionId }, 'Extension hook already registered, skipping');
      return;
    }

    hooks.add({ extensionId, callback });

    logger.info({ type, extensionId }, 'Extension hook registered');
  }

  /**
   * Unregister all hooks for an extension
   */
  unregisterExtensionHooks(extensionId: string): void {
    for (const [type, hooks] of this.hooks.entries()) {
      for (const hook of hooks) {
        if (hook.extensionId === extensionId) {
          hooks.delete(hook);
          logger.info({ type, extensionId }, 'Extension hook unregistered');
        }
      }
    }
  }

  /**
   * Execute all hooks of a specific type
   * Returns the first non-empty result from any hook
   */
  async executeHook(type: HookType, context: any): Promise<FileUploadResult | undefined> {
    const hooks = this.hooks.get(type);
    logger.debug({ type, hookCount: hooks?.size || 0, contextKeys: Object.keys(context) }, 'executeHook called');

    if (!hooks || hooks.size === 0) {
      logger.debug({ type }, 'No hooks registered for type');
      return;
    }

    logger.debug({ type, hookCount: hooks.size }, 'Executing extension hooks');
    logger.debug({ registeredHooks: Array.from(hooks).map(h => h.extensionId) }, 'Registered hooks');

    // Execute all hooks concurrently
    const promises = Array.from(hooks).map(async ({ extensionId, callback }) => {
      try {
        logger.debug({ extensionId }, 'Calling hook');
        logger.debug({ type, extensionId }, 'Executing hook');
        const result = await callback(context);
        logger.debug({ extensionId, result }, 'Hook result');
        if (result) {
          logger.debug({ type, extensionId, result }, 'Hook executed successfully');
          return result;
        }
      } catch (error: any) {
        logger.error({ error, extensionId }, 'Hook error');
        logger.error({ type, extensionId, error }, 'Hook execution failed');
      }
      return null;
    });

    const results = await Promise.all(promises);
    logger.debug({ results }, 'All hook results');
    // Find first result with actual content (not null/undefined/empty object)
    return results.find(r => r && Object.keys(r).length > 0) || undefined;
  }

  /**
   * Clear all hooks (useful for testing)
   */
  clearAll(): void {
    this.hooks.clear();
  }
}

// Singleton instance
export const extensionHookRegistry = new ExtensionHookRegistry();
