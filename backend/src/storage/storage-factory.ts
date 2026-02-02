/**
 * Storage Factory
 * 
 * Centralized initialization and management of all storage backends.
 * Provides a simple API to initialize and access storage instances.
 * 
 * Usage:
 * ```typescript
 * import { initializeStorage, getDatabase, getFileStorage, getCache } from './storage/storage-factory';
 * 
 * // Initialize all storage
 * await initializeStorage();
 * 
 * // Access instances
 * const db = getDatabase();
 * const files = getFileStorage();
 * const cache = getCache();
 * ```
 */

import {
  AbstractDatabase,
  AbstractFileStorage,
  AbstractCache,
  createDatabase,
  createFileStorage,
  createCache,
  setGlobalDatabase,
  setGlobalFileStorage,
  setGlobalCache,
} from './abstraction';

import {
  getStorageConfig,
  printStorageConfig,
  type StorageConfig,
} from './storage-config';
import { createLogger } from './utils/logger';

const logger = createLogger('StorageFactory');

// ============================================================================
// Storage State
// ============================================================================

interface StorageState {
  database: AbstractDatabase | null;
  fileStorage: AbstractFileStorage | null;
  cache: AbstractCache | null;
  initialized: boolean;
  config: StorageConfig | null;
}

const state: StorageState = {
  database: null,
  fileStorage: null,
  cache: null,
  initialized: false,
  config: null,
};

// ============================================================================
// Initialization
// ============================================================================

export interface InitializeOptions {
  silent?: boolean;
  skipMigrations?: boolean;
}

/**
 * Initialize all storage backends
 */
export async function initializeStorage(options: InitializeOptions = {}): Promise<void> {
  if (state.initialized) {
    if (!options.silent) {
      logger.info('Already initialized');
    }
    return;
  }

  const config = getStorageConfig();
  state.config = config;

  if (!options.silent) {
    printStorageConfig();
  }

  try {
    // Initialize database
    if (!options.silent) {
      logger.info(`Initializing ${config.database.type} database...`);
    }
    state.database = createDatabase(config.database);
    await state.database.connect();
    
    if (!options.skipMigrations) {
      // Run migrations will be implemented per-storage
      // For now, we rely on the existing storage classes to handle schema
    }
    
    setGlobalDatabase(state.database);

    // Initialize file storage
    if (!options.silent) {
      logger.info(`Initializing ${config.fileStorage.type} file storage...`);
    }
    state.fileStorage = await createFileStorage(config.fileStorage);
    setGlobalFileStorage(state.fileStorage);

    // Initialize cache
    if (!options.silent) {
      logger.info(`Initializing ${config.cache.type} cache...`);
    }
    state.cache = await createCache(config.cache);
    setGlobalCache(state.cache);

    // Initialize legacy storage classes (for backward compatibility)
    if (!options.silent) {
      logger.info('Initializing legacy storage classes...');
    }
    
    const { UserStorage } = await import('./user-storage');
    const { SessionStorage } = await import('./session-storage');
    const { TenantStorage } = await import('./tenant-storage');
    const { ProjectStorage } = await import('./project-storage');
    
    await UserStorage.getInstance().initialize();
    await SessionStorage.getInstance().initialize();
    await TenantStorage.getInstance().initialize();
    await ProjectStorage.getInstance().initialize();

    state.initialized = true;
    
    if (!options.silent) {
      logger.info('✅ All storage backends initialized successfully');
    }
  } catch (error) {
    logger.error({ error }, '❌ Failed to initialize storage');
    await cleanupStorage();
    throw error;
  }
}

/**
 * Cleanup all storage connections
 */
export async function cleanupStorage(): Promise<void> {
  const errors: Error[] = [];

  // Close legacy storage classes
  try {
    const { UserStorage } = await import('./user-storage');
    UserStorage.getInstance().close();
  } catch (error) {
    // Ignore - may not be initialized
  }

  try {
    const { SessionStorage } = await import('./session-storage');
    SessionStorage.getInstance().close();
  } catch (error) {
    // Ignore - may not be initialized
  }

  try {
    const { TenantStorage } = await import('./tenant-storage');
    TenantStorage.getInstance().close();
  } catch (error) {
    // Ignore - may not be initialized
  }

  try {
    const { ProjectStorage } = await import('./project-storage');
    ProjectStorage.getInstance().close();
  } catch (error) {
    // Ignore - may not be initialized
  }

  // Close cache
  if (state.cache) {
    try {
      await state.cache.close();
    } catch (error) {
      errors.push(error as Error);
    }
    state.cache = null;
  }

  // Close file storage
  if (state.fileStorage) {
    try {
      await state.fileStorage.close();
    } catch (error) {
      errors.push(error as Error);
    }
    state.fileStorage = null;
  }

  // Close database
  if (state.database) {
    try {
      await state.database.disconnect();
    } catch (error) {
      errors.push(error as Error);
    }
    state.database = null;
  }

  state.initialized = false;
  state.config = null;

  if (errors.length > 0) {
    logger.error({ errors }, 'Errors during cleanup');
  }
}

// ============================================================================
// Accessors
// ============================================================================

/**
 * Get the database instance
 * @throws Error if storage is not initialized
 */
export function getDatabase(): AbstractDatabase {
  if (!state.database) {
    throw new Error('Storage not initialized. Call initializeStorage() first.');
  }
  return state.database;
}

/**
 * Get the file storage instance
 * @throws Error if storage is not initialized
 */
export function getFileStorage(): AbstractFileStorage {
  if (!state.fileStorage) {
    throw new Error('Storage not initialized. Call initializeStorage() first.');
  }
  return state.fileStorage;
}

/**
 * Get the cache instance
 * @throws Error if storage is not initialized
 */
export function getCache(): AbstractCache {
  if (!state.cache) {
    throw new Error('Storage not initialized. Call initializeStorage() first.');
  }
  return state.cache;
}

// ============================================================================
// Status
// ============================================================================

export interface StorageStatus {
  initialized: boolean;
  database: {
    type: string;
    connected: boolean;
  } | null;
  fileStorage: {
    type: string;
  } | null;
  cache: {
    type: string;
  } | null;
}

/**
 * Get current storage status
 */
export function getStorageStatus(): StorageStatus {
  return {
    initialized: state.initialized,
    database: state.database ? {
      type: state.config?.database.type || 'unknown',
      connected: state.database.isConnected(),
    } : null,
    fileStorage: state.fileStorage ? {
      type: state.config?.fileStorage.type || 'unknown',
    } : null,
    cache: state.cache ? {
      type: state.config?.cache.type || 'unknown',
    } : null,
  };
}

/**
 * Check if storage is initialized
 */
export function isStorageInitialized(): boolean {
  return state.initialized;
}

// ============================================================================
// Health Check
// ============================================================================

export interface HealthCheckResult {
  healthy: boolean;
  checks: {
    database: boolean;
    fileStorage: boolean;
    cache: boolean;
  };
  errors: string[];
}

/**
 * Perform health check on all storage backends
 */
export async function checkStorageHealth(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    healthy: true,
    checks: {
      database: false,
      fileStorage: false,
      cache: false,
    },
    errors: [],
  };

  if (!state.initialized) {
    result.healthy = false;
    result.errors.push('Storage not initialized');
    return result;
  }

  // Check database
  try {
    if (state.database?.isConnected()) {
      // Try a simple query
      await state.database.query('SELECT 1 as health');
      result.checks.database = true;
    } else {
      throw new Error('Database not connected');
    }
  } catch (error) {
    result.errors.push(`Database: ${(error as Error).message}`);
  }

  // Check file storage
  try {
    const testKey = `_health_check_${Date.now()}.txt`;
    await state.fileStorage!.put(testKey, Buffer.from('health check'), {
      contentType: 'text/plain',
    });
    await state.fileStorage!.delete(testKey);
    result.checks.fileStorage = true;
  } catch (error) {
    result.errors.push(`File Storage: ${(error as Error).message}`);
  }

  // Check cache
  try {
    const testKey = `_health_check_${Date.now()}`;
    await state.cache!.set(testKey, 'health check', 10);
    const value = await state.cache!.get(testKey);
    if (value === 'health check') {
      result.checks.cache = true;
    } else {
      throw new Error('Cache value mismatch');
    }
  } catch (error) {
    result.errors.push(`Cache: ${(error as Error).message}`);
  }

  result.healthy = result.checks.database && result.checks.fileStorage && result.checks.cache;
  return result;
}
