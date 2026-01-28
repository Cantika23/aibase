/**
 * Extension Loader Service
 * Handles loading, compiling, and executing project extensions
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as esbuild from 'esbuild';
import { ExtensionStorage, type Extension, type ExtensionMetadata } from '../../storage/extension-storage';
import { ProjectStorage } from '../../storage/project-storage';
import { CategoryStorage } from '../../storage/category-storage';
import { extensionHookRegistry } from './extension-hooks';
import { dependencyBundler } from './dependency-bundler';
import type { DependencyRequest } from './dependency-bundler';
import * as os from 'os';

export class ExtensionLoader {
  private extensionStorage: ExtensionStorage;
  private categoryStorage: CategoryStorage;
  private projectStorage: ProjectStorage;
  private defaultsPath: string;

  constructor() {
    this.extensionStorage = new ExtensionStorage();
    this.categoryStorage = new CategoryStorage();
    this.projectStorage = ProjectStorage.getInstance();
    this.defaultsPath = path.join(__dirname, 'defaults');
  }

  /**
   * Get tenant_id for a project
   */
  private getTenantId(projectId: string): number | string {
    const project = this.projectStorage.getById(projectId);
    return project?.tenant_id ?? 'default';
  }

  /**
   * Initialize extensions for a project by copying defaults if needed
   *
   * This copies extensions from backend/src/tools/extensions/defaults/ to data/{projectId}/extensions/
   * Only runs if the project doesn't have extensions yet
   */
  async initializeProject(projectId: string): Promise<void> {
    const tenantId = this.getTenantId(projectId);

    // Check if USE_DEFAULT_EXTENSIONS is enabled
    // If true, we don't need to copy - extensions load directly from backend folder
    const useDefaults = process.env.USE_DEFAULT_EXTENSIONS === 'true';

    if (useDefaults) {
      console.log(`[ExtensionLoader] USE_DEFAULT_EXTENSIONS=true, skipping copy to project folder`);
      return;
    }

    // Ensure project extensions directory exists
    await this.extensionStorage.ensureExtensionsDir(projectId, tenantId);

    // Check if defaults have already been copied
    const existingExtensions = await this.extensionStorage.getAll(projectId, tenantId);

    // If project already has extensions, don't overwrite
    if (existingExtensions.length > 0) {
      console.log(`[ExtensionLoader] Project ${projectId} already has ${existingExtensions.length} extensions`);
      return;
    }

    // Copy default extensions to project folder
    await this.copyDefaultExtensions(projectId);
  }

  /**
   * Copy default extensions to a project
   */
  private async copyDefaultExtensions(projectId: string): Promise<void> {
    const tenantId = this.getTenantId(projectId);
    try {
      // Read default extensions directory
      const entries = await fs.readdir(this.defaultsPath, { withFileTypes: true });
      const extensionDirs = entries.filter(entry => entry.isDirectory());

      console.log(`[ExtensionLoader] Copying ${extensionDirs.length} default extensions to project ${projectId}`);

      for (const dir of extensionDirs) {
        try {
          const extensionId = dir.name;
          const metadataPath = path.join(this.defaultsPath, extensionId, 'metadata.json');
          const codePath = path.join(this.defaultsPath, extensionId, 'index.ts');

          // Read metadata and code
          const [metadataContent, code] = await Promise.all([
            fs.readFile(metadataPath, 'utf-8'),
            fs.readFile(codePath, 'utf-8'),
          ]);

          const metadata = JSON.parse(metadataContent) as ExtensionMetadata;

          // Create extension in project
          await this.extensionStorage.create(projectId, tenantId, {
            id: metadata.id,
            name: metadata.name,
            description: metadata.description,
            author: metadata.author,
            version: metadata.version,
            category: metadata.category,
            code,
            enabled: metadata.enabled,
            isDefault: true,
          });

          console.log(`[ExtensionLoader] Copied default extension: ${metadata.name}`);
        } catch (error) {
          console.warn(`[ExtensionLoader] Failed to copy extension ${dir.name}:`, error);
        }
      }
    } catch (error) {
      console.error('[ExtensionLoader] Failed to copy default extensions:', error);
      throw error;
    }
  }

  /**
   * Load all enabled extensions for a project and return their exports
   *
   * Behavior controlled by USE_DEFAULT_EXTENSIONS environment variable:
   * - true: Load from backend/src/tools/extensions/defaults/ with project overrides (development mode)
   * - false: Load from data/{projectId}/extensions/ (production mode, per-project customization)
   *
   * @param projectId - Project ID
   */
  async loadExtensions(projectId: string): Promise<Record<string, any>> {
    const tenantId = this.getTenantId(projectId);
    const useDefaults = process.env.USE_DEFAULT_EXTENSIONS === 'true';

    // Get all enabled extensions
    let extensions: Extension[];

    if (useDefaults) {
      // Development mode: Load from defaults directory with project overrides
      // Project extensions override defaults with the same ID
      console.log(`[ExtensionLoader] USE_DEFAULT_EXTENSIONS=true, loading from defaults + project override`);

      const [defaultExts, projectExts] = await Promise.all([
        this.loadDefaults(),
        this.extensionStorage.getAll(projectId, tenantId)
      ]);

      // Create map of project extensions for fast lookup
      const projectMap = new Map(projectExts.map(p => [p.metadata.id, p]));

      // Start with defaults, override with project versions
      extensions = defaultExts.map(d => {
        const override = projectMap.get(d.metadata.id);
        if (override) {
          console.log(`[ExtensionLoader] Using project version for ${d.metadata.id}`);
          return override;
        }
        return d;
      });

      // Add project-only extensions (not in defaults)
      const defaultIds = new Set(defaultExts.map(d => d.metadata.id));
      const projectOnly = projectExts.filter(p => !defaultIds.has(p.metadata.id));
      extensions.push(...projectOnly);

      console.log(`[ExtensionLoader] Loaded ${extensions.length} extensions (${projectMap.size} overridden by project, ${projectOnly.length} project-only)`);
    } else {
      // Production mode: Load from project's extensions folder
      // Each project can have different extension versions
      console.log(`[ExtensionLoader] USE_DEFAULT_EXTENSIONS=false, loading from data/${projectId}/extensions/`);
      extensions = await this.extensionStorage.getEnabled(projectId, tenantId);
    }

    if (extensions.length === 0) {
      console.log(`[ExtensionLoader] No enabled extensions for project ${projectId}`);
      return {};
    }

    console.log(`[ExtensionLoader] Loading ${extensions.length} extensions for project ${projectId}`);

    const scope: Record<string, any> = {};

    for (const extension of extensions) {
      try {
        const exports = await this.evaluateExtension(extension);

        // Clear error status on successful load
        const tenantId = this.getTenantId(projectId);
        await this.extensionStorage.clearError(projectId, extension.metadata.id, tenantId);

        // Create a namespace for the extension using its metadata.id
        // Convert kebab-case ID to camelCase for valid JavaScript identifier
        const namespace = extension.metadata.id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        const functionNames = Object.keys(exports);

        // Flatten single-function extensions to top level for easier calling
        // e.g., postgresql = { postgresql: func } → scope.postgresql = func (not scope.postgresql.postgresql = func)
        if (functionNames.length === 1) {
          // Single function - add directly to scope
          Object.assign(scope, exports);
          console.log(`[ExtensionLoader] Loaded extension '${extension.metadata.name}' with ${functionNames.length} function (flattened to scope): ${functionNames.join(', ')}`);
          console.log(`[ExtensionLoader] Scope keys:`, Object.keys(scope));
          const funcName = functionNames[0];
          if (funcName) {
            console.log(`[ExtensionLoader] Export type for '${funcName}':`, typeof exports[funcName]);
          }
        } else {
          // Multiple functions - use namespace to avoid conflicts
          scope[namespace] = exports;
          console.log(`[ExtensionLoader] Loaded extension '${extension.metadata.name}' as namespace '${namespace}' with ${functionNames.length} functions: ${functionNames.join(', ')}`);
        }
      } catch (error: any) {
        console.error(`[ExtensionLoader] Failed to load extension '${extension.metadata.name}':`, error);

        // Record error in metadata
        const tenantId = this.getTenantId(projectId);
        await this.extensionStorage.recordError(projectId, extension.metadata.id, tenantId, error);

        // Add debug log if debug mode is enabled
        if (extension.metadata.debug) {
          await this.extensionStorage.addDebugLog(
            projectId,
            extension.metadata.id,
            tenantId,
            'error',
            `Failed to load extension: ${error instanceof Error ? error.message : String(error)}`,
            { stack: error instanceof Error ? error.stack : undefined }
          );
        }

        // Continue loading other extensions even if one fails
      }
    }

    return scope;
  }

  /**
   * Load extensions directly from defaults directory
   */
  private async loadDefaults(): Promise<Extension[]> {
    try {
      const entries = await fs.readdir(this.defaultsPath, { withFileTypes: true });
      const extensionDirs = entries.filter(entry => entry.isDirectory());

      const extensions: Extension[] = [];

      for (const dir of extensionDirs) {
        try {
          const extensionId = dir.name;
          const metadataPath = path.join(this.defaultsPath, extensionId, 'metadata.json');
          const codePath = path.join(this.defaultsPath, extensionId, 'index.ts');

          // Read metadata and code
          const [metadataContent, code] = await Promise.all([
            fs.readFile(metadataPath, 'utf-8'),
            fs.readFile(codePath, 'utf-8'),
          ]);

          const metadata = JSON.parse(metadataContent) as ExtensionMetadata;

          // Only load enabled extensions
          if (!metadata.enabled) {
            continue;
          }

          extensions.push({
            metadata,
            code,
          });
        } catch (error) {
          console.warn(`[ExtensionLoader] Failed to load default extension ${dir.name}:`, error);
        }
      }

      return extensions;
    } catch (error) {
      console.error('[ExtensionLoader] Failed to load defaults:', error);
      return [];
    }
  }

  /**
   * Transpile TypeScript to JavaScript using esbuild
   */
  private async transpileExtension(code: string, extensionId: string): Promise<string> {
    console.log(`[ExtensionLoader] BEFORE transpile '${extensionId}', length: ${code.length}`);
    console.log(`[ExtensionLoader] First 100 chars:`, code.substring(0, 100));

    try {
      const result = await esbuild.transform(code, {
        loader: 'ts',
        target: 'esnext',
        format: 'cjs',
        minify: false,
        supported: {
          // Allow top-level await
          'top-level-await': true,
          // Allow dynamic import
          'dynamic-import': true,
        },
      });

      console.log(`[ExtensionLoader] AFTER transpile '${extensionId}', original: ${code.length}, transpiled: ${result.code.length}`);
      console.log(`[ExtensionLoader] Transpiled first 100 chars:`, result.code.substring(0, 100));

      // Check if transpilation actually changed anything
      if (result.code === code) {
        console.error(`[ExtensionLoader] WARNING: Transpiled code is IDENTICAL to original! esbuild didn't transpile.`);
      }

      return result.code;
    } catch (error) {
      console.error(`[ExtensionLoader] Transpilation FAILED for '${extensionId}':`, error);
      console.error(`[ExtensionLoader] Error details:`, error);
      // Throw error instead of returning original code - we can't evaluate raw TypeScript
      throw new Error(`Failed to transpile extension '${extensionId}': ${error}`);
    }
  }

  /**
   * Evaluate an extension's TypeScript code directly in the main thread
   *
   * Note: We don't use worker threads because postMessage cannot clone functions.
   * Extensions export functions that need to be callable from the main thread.
   */
  private async evaluateExtension(extension: Extension): Promise<Record<string, any>> {
    try {
      console.log(`[ExtensionLoader] Evaluating '${extension.metadata.name}' in main thread`);

      // Transpile TypeScript to JavaScript
      const jsCode = await this.transpileExtension(extension.code, extension.metadata.id);

      // Load backend dependencies if declared
      const backendDeps = extension.metadata.dependencies?.backend || {};

      if (Object.keys(backendDeps).length > 0) {
        console.log(`[ExtensionLoader] Loading ${Object.keys(backendDeps).length} backend dependencies for '${extension.metadata.name}'`);
      }

      // Load dependencies
      const loadedDeps: Record<string, any> = {};
      for (const [name, version] of Object.entries(backendDeps)) {
        try {
          loadedDeps[name] = await import(name);
        } catch (error) {
          console.error(`[ExtensionLoader] Failed to load dependency ${name}:`, error);
          throw new Error(`Failed to load dependency ${name}: ${error}`);
        }
      }

      // Create dependency object string
      const depsObjectString = Object.keys(loadedDeps).length > 0
        ? `const deps = ${JSON.stringify(Object.keys(loadedDeps).reduce((acc, key) => {
            const safeKey = key.includes('-') ? `"${key}"` : key;
            acc[safeKey] = `__deps[${JSON.stringify(key)}]`;
            return acc;
          }, {} as Record<string, string>))};`
        : 'const deps = {};';

      // Wrap code to capture exports
      const wrappedCode = `
        "use strict";
        const module = { exports: {} };

        // Inject dependencies
        const __deps = arguments[1] || {};
        ${depsObjectString}

        // Extension hook registry placeholder
        globalThis.extensionHookRegistry = arguments[0];

        // Execute extension code (already transpiled to JavaScript)
        let extensionResult;
        let errorMsg;
        try {
          const getExtensionExports = () => {
            ${jsCode}
          };

          extensionResult = getExtensionExports();
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : String(e);
          throw e;
        }

        // Check for module.exports pattern
        const moduleExportsKeys = Object.keys(module.exports);
        if (moduleExportsKeys.length > 0) {
          return module.exports;
        }

        return extensionResult || {};
      `;

      // Execute in controlled environment
      const AsyncFunction = (async function () {}).constructor as any;
      const fn = new AsyncFunction(wrappedCode);

      // Mock hook registry
      const hookRegistry = {
        registerHook: () => {},
        unregisterHook: () => {},
      };

      // Evaluate the extension
      const result = await fn(hookRegistry, loadedDeps);

      console.log(`[ExtensionLoader] Result from extension '${extension.metadata.name}':`, Object.keys(result || {}));

      return result || {};
    } catch (error: any) {
      console.error(`[ExtensionLoader] Failed to evaluate extension '${extension.metadata.name}':`, error);
      throw new Error(`Extension evaluation failed: ${error.message}`);
    }
  }

  /**
   * Reset extensions for a project (copy defaults again)
   */
  async resetToDefaults(projectId: string): Promise<void> {
    const tenantId = this.getTenantId(projectId);
    // Get all existing extensions
    const existingExtensions = await this.extensionStorage.getAll(projectId, tenantId);

    // Delete all extensions
    for (const ext of existingExtensions) {
      await this.extensionStorage.delete(projectId, ext.metadata.id, tenantId);
    }

    // Reset categories to defaults (recreate categories.json)
    await this.categoryStorage.resetToDefaults(projectId, tenantId);

    // Copy defaults
    await this.copyDefaultExtensions(projectId);
    console.log(`[ExtensionLoader] Reset extensions to defaults for project ${projectId}`);
  }

  /**
   * Get extension storage instance (for API endpoints)
   */
  getStorage(): ExtensionStorage {
    return this.extensionStorage;
  }

  /**
   * Get extension source status
   * Returns information about which extensions have project versions
   */
  async getExtensionSourceStatus(projectId: string): Promise<Map<string, { hasDefault: boolean; hasProject: boolean; currentSource: 'default' | 'project' }>> {
    const tenantId = this.getTenantId(projectId);
    const useDefaults = process.env.USE_DEFAULT_EXTENSIONS === 'true';

    const status = new Map<string, { hasDefault: boolean; hasProject: boolean; currentSource: 'default' | 'project' }>();

    if (useDefaults) {
      // In dev mode, check both sources
      const [defaultExts, projectExts] = await Promise.all([
        this.loadDefaults(),
        this.extensionStorage.getAll(projectId, tenantId)
      ]);

      const projectMap = new Map(projectExts.map(p => [p.metadata.id, p]));

      // Add all defaults
      for (const def of defaultExts) {
        const hasProject = projectMap.has(def.metadata.id);
        status.set(def.metadata.id, {
          hasDefault: true,
          hasProject: hasProject,
          currentSource: hasProject ? 'project' : 'default'
        });
      }

      // Add project-only extensions
      const defaultIds = new Set(defaultExts.map(d => d.metadata.id));
      for (const proj of projectExts) {
        if (!defaultIds.has(proj.metadata.id)) {
          status.set(proj.metadata.id, {
            hasDefault: false,
            hasProject: true,
            currentSource: 'project'
          });
        }
      }
    } else {
      // In prod mode, only project extensions exist
      const projectExts = await this.extensionStorage.getAll(projectId, tenantId);
      for (const proj of projectExts) {
        status.set(proj.metadata.id, {
          hasDefault: false,
          hasProject: true,
          currentSource: 'project'
        });
      }
    }

    return status;
  }
}
