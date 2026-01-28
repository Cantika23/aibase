/**
 * Extension Worker
 *
 * Isolated worker thread for executing extension code.
 * Runs in a separate process with resource limits.
 *
 * Security model:
 * - No direct file system access (unless explicitly allowed)
 * - No global state pollution
 * - CPU and memory limits enforced
 * - Message-based communication only
 */

import type { DependencyRequest } from './dependency-bundler';

// Type declarations for worker context
declare const self: Worker & {
  onmessage: (e: MessageEvent) => void;
  postMessage: (message: any) => void;
};

interface WorkerMessage {
  id: string;
  type: 'evaluate' | 'dependencies';
  extensionId: string;
  code?: string;
  dependencies?: Record<string, string>;
  metadata?: any;
}

interface WorkerResponse {
  id: string;
  type: 'result' | 'error';
  result?: any;
  error?: string;
}

// In-memory cache for loaded dependencies
const dependencyCache = new Map<string, any>();

/**
 * Load backend dependencies
 */
async function loadDependencies(dependencies: Record<string, string>): Promise<Record<string, any>> {
  const loaded: Record<string, any> = {};

  for (const [name, version] of Object.entries(dependencies)) {
    const cacheKey = `${name}@${version}`;

    if (dependencyCache.has(cacheKey)) {
      loaded[name] = dependencyCache.get(cacheKey);
      continue;
    }

    try {
      // Create temp entry point
      const tempPath = `/tmp/ext-deps-${name}-${Date.now()}.mjs`;
      await Bun.write(tempPath, `export * from '${name}'; export { default } from '${name}';`);

      // Import the module
      const moduleUrl = `file://${tempPath}`;
      const module = await import(moduleUrl);

      // Clean up
      await Bun.remove(tempPath).catch(() => {});

      loaded[name] = module;
      dependencyCache.set(cacheKey, module);
    } catch (error) {
      throw new Error(`Failed to load dependency ${name}@${version}: ${error}`);
    }
  }

  return loaded;
}

/**
 * Evaluate extension code in isolation (code is already transpiled to JavaScript)
 */
function evaluateExtension(code: string, dependencies: Record<string, any>, metadata: { id?: string }): any {
  // Create dependency object string
  const depsObjectString = Object.keys(dependencies).length > 0
    ? `const deps = ${JSON.stringify(Object.keys(dependencies).reduce((acc, key) => {
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
        ${code}
      };

      extensionResult = getExtensionExports();
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
    }

    // Send debug info via console
    if (errorMsg) {
      console.log('[ExtensionWorker] ERROR:', errorMsg);
    }
    console.log('[ExtensionWorker] extensionResult:', JSON.stringify(extensionResult));
    console.log('[ExtensionWorker] extensionResult keys:', Object.keys(extensionResult || {}));

    // Check for module.exports pattern
    const moduleExportsKeys = Object.keys(module.exports);
    console.log('[ExtensionWorker] module.exports keys:', moduleExportsKeys);
    if (moduleExportsKeys.length > 0) {
      console.log('[ExtensionWorker] Returning module.exports');
      return module.exports;
    }

    console.log('[ExtensionWorker] Returning extensionResult');
    return extensionResult || {};
  `;

  // Execute in controlled environment
  // Note: We still use AsyncFunction but within worker process isolation
  const AsyncFunction = (async function () {}).constructor as any;
  const fn = new AsyncFunction(wrappedCode);

  // Mock hook registry
  const hookRegistry = {
    registerHook: () => {},
    unregisterHook: () => {},
  };

  return fn(hookRegistry, dependencies);
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;
  const response: WorkerResponse = {
    id: message.id,
    type: 'result'
  };

  try {
    if (message.type === 'evaluate') {
      const { code, dependencies, metadata } = message;

      if (!code) {
        throw new Error('No code provided for evaluation');
      }

      console.log('[ExtensionWorker] Starting evaluation for:', metadata?.id);

      // Load dependencies if provided
      const loadedDeps = dependencies && Object.keys(dependencies).length > 0
        ? await loadDependencies(dependencies)
        : {};

      // Evaluate extension with timeout
      const metadataId = metadata?.id ?? 'unknown';
      const enhancedMetadata: { id: string; [key: string]: any } = {
        id: metadataId,
        ...(metadata || {})
      };

      console.log('[ExtensionWorker] Calling evaluateExtension, code length:', code.length);
      const result = await withTimeout(
        () => evaluateExtension(code, loadedDeps, enhancedMetadata),
        30000 // 30 second timeout
      );

      console.log('[ExtensionWorker] Evaluation result:', JSON.stringify(result));
      console.log('[ExtensionWorker] Evaluation result keys:', Object.keys(result || {}));

      response.result = result;

    } else {
      throw new Error(`Unknown message type: ${message.type}`);
    }

  } catch (error) {
    console.log('[ExtensionWorker] ERROR:', error instanceof Error ? error.message : String(error));
    console.log('[ExtensionWorker] ERROR stack:', error instanceof Error ? error.stack : 'N/A');
    response.type = 'error';
    response.error = error instanceof Error ? error.message : String(error);
  }

  console.log('[ExtensionWorker] Posting response:', response.type);
  self.postMessage(response);
};

/**
 * Execute function with timeout
 */
async function withTimeout<T>(fn: () => T | Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([Promise.resolve(fn()), timeoutPromise]);
}
