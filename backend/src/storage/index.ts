/**
 * Storage Module
 * 
 * Centralized storage management for AIBase.
 * 
 * This module provides:
 * 1. Abstraction interfaces for Database, File Storage, and Cache
 * 2. Multiple backend implementations (SQLite, PostgreSQL, S3, Redis, etc.)
 * 3. Configuration via environment variables
 * 4. Migration tools for transitioning between backends
 * 
 * Quick Start:
 * ```typescript
 * import { initializeStorage, getDatabase, getFileStorage, getCache } from './storage';
 * 
 * // Initialize (call once at startup)
 * await initializeStorage();
 * 
 * // Use storage
 * const db = getDatabase();
 * await db.query('SELECT * FROM users');
 * ```
 */

// ============================================================================
// Abstractions (Interfaces)
// ============================================================================

export {
  // Database
  AbstractDatabase,
  type DatabaseConfig,
  type QueryResult,
  type Transaction,
  type Migration,
  type MigrationDirection,
  
  // File Storage
  AbstractFileStorage,
  type FileStorageConfig,
  type FileMetadata,
  type StoredFile,
  type ListOptions,
  type ListResult,
  
  // Cache
  AbstractCache,
  type CacheConfig,
  type SessionData,
  type CacheEntry,
} from './abstraction';

// ============================================================================
// Factory Functions
// ============================================================================

export {
  createDatabase,
  createFileStorage,
  createCache,
  setGlobalDatabase,
  getGlobalDatabase,
  clearGlobalDatabase,
  setGlobalFileStorage,
  getGlobalFileStorage,
  clearGlobalFileStorage,
  setGlobalCache,
  getGlobalCache,
  clearGlobalCache,
} from './abstraction';

// ============================================================================
// Built-in Adapters
// ============================================================================

export {
  SQLiteDatabase,
  LocalFileStorage,
  MemoryCache,
} from './adapters';

// ============================================================================
// Configuration
// ============================================================================

export {
  getDatabaseConfig,
  getFileStorageConfig,
  getCacheConfig,
  getStorageConfig,
  printStorageConfig,
  isMigrationMode,
  type StorageConfig,
} from './storage-config';

// ============================================================================
// Factory & Management
// ============================================================================

export {
  initializeStorage,
  cleanupStorage,
  getDatabase,
  getFileStorage,
  getCache,
  getStorageStatus,
  isStorageInitialized,
  checkStorageHealth,
  type InitializeOptions,
  type StorageStatus,
  type HealthCheckResult,
} from './storage-factory';

// ============================================================================
// Legacy Storage Classes (for backward compatibility)
// These will be refactored to use the abstraction layer
// ============================================================================

// Original implementations - these will be gradually migrated
export { UserStorage, type User, type UserRole, type CreateUserData, type UpdateUserData } from './user-storage';
export { SessionStorage, type Session } from './session-storage';
export { TenantStorage, type Tenant, type CreateTenantData, type UpdateTenantData } from './tenant-storage';
export { ProjectStorage, type Project, type CreateProjectData, type UpdateProjectData } from './project-storage';
export { ChatHistoryStorage, type ChatHistoryMetadata, type ChatHistoryFile } from './chat-history-storage';
export { FileStorage, type StoredFile as LegacyStoredFile, type FileScope } from './file-storage';
export { ExtensionStorage } from './extension-storage';
export { CategoryStorage } from './category-storage';
export { FileContextStorage } from './file-context-storage';
export { MessagePersistence, type ConvMessageHistory } from '../ws/msg-persistance';
