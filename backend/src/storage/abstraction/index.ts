/**
 * Storage Abstraction Layer - Main Entry Point
 * 
 * This module provides unified interfaces for:
 * - Database (SQLite → PostgreSQL)
 * - File Storage (Local → S3/Azure/GCS)
 * - Cache/Session (In-memory → Redis/Valkey)
 * 
 * Usage:
 * ```typescript
 * import { 
 *   createDatabase, createFileStorage, createCache,
 *   setGlobalDatabase, setGlobalFileStorage, setGlobalCache 
 * } from './storage/abstraction';
 * 
 * // Initialize with SQLite (development)
 * const db = createDatabase({ type: 'sqlite', sqlite: { path: './data.db' } });
 * 
 * // Initialize with PostgreSQL (enterprise)
 * const db = createDatabase({ 
 *   type: 'postgresql', 
 *   postgresql: { host: '...', port: 5432, ... } 
 * });
 * ```
 */

// Database
export {
  AbstractDatabase,
  createDatabase,
  setGlobalDatabase,
  getGlobalDatabase,
  clearGlobalDatabase,
  type DatabaseConfig,
  type QueryResult,
  type Transaction,
  type Migration,
  type MigrationDirection,
} from './database';

// File Storage
export {
  AbstractFileStorage,
  createFileStorage,
  setGlobalFileStorage,
  getGlobalFileStorage,
  clearGlobalFileStorage,
  type FileStorageConfig,
  type FileMetadata,
  type StoredFile,
  type ListOptions,
  type ListResult,
} from './file-storage';

// Cache & Session
export {
  AbstractCache,
  createCache,
  setGlobalCache,
  getGlobalCache,
  clearGlobalCache,
  type CacheConfig,
  type SessionData,
  type CacheEntry,
} from './cache';
