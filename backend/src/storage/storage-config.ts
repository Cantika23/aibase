/**
 * Storage Configuration
 * 
 * Centralized configuration for all storage backends.
 * Reads from environment variables and creates the appropriate storage instances.
 * 
 * Environment Variables:
 * 
 * Database:
 * - DB_TYPE: 'sqlite' | 'postgresql' (default: 'sqlite')
 * - DB_SQLITE_PATH: Path to SQLite file (default: 'data/app/databases/app.db')
 * - DB_PG_HOST: PostgreSQL host
 * - DB_PG_PORT: PostgreSQL port (default: 5432)
 * - DB_PG_DATABASE: PostgreSQL database name
 * - DB_PG_USERNAME: PostgreSQL username
 * - DB_PG_PASSWORD: PostgreSQL password
 * - DB_PG_SSL: Enable SSL (default: 'false')
 * - DB_PG_POOL_SIZE: Connection pool size (default: 10)
 * 
 * File Storage:
 * - FILE_STORAGE_TYPE: 'local' | 's3' | 'azure' | 'gcs' (default: 'local')
 * - FILE_STORAGE_LOCAL_PATH: Base path for local storage (default: 'data/files')
 * - FILE_STORAGE_S3_ENDPOINT: S3 endpoint (optional, for MinIO)
 * - FILE_STORAGE_S3_REGION: S3 region
 * - FILE_STORAGE_S3_BUCKET: S3 bucket name
 * - FILE_STORAGE_S3_ACCESS_KEY: S3 access key
 * - FILE_STORAGE_S3_SECRET_KEY: S3 secret key
 * - FILE_STORAGE_S3_FORCE_PATH_STYLE: Use path-style URLs (default: 'false', set 'true' for MinIO)
 * 
 * Cache/Session:
 * - CACHE_TYPE: 'memory' | 'redis' | 'valkey' (default: 'memory')
 * - CACHE_MEMORY_MAX_SIZE: Max cache entries (default: 10000)
 * - CACHE_MEMORY_TTL: Default TTL in seconds (default: 3600)
 * - CACHE_REDIS_HOST: Redis host
 * - CACHE_REDIS_PORT: Redis port (default: 6379)
 * - CACHE_REDIS_PASSWORD: Redis password (optional)
 * - CACHE_REDIS_DB: Redis database number (default: 0)
 * - CACHE_REDIS_PREFIX: Key prefix (default: 'aibase:')
 * - CACHE_REDIS_TLS: Enable TLS (default: 'false')
 * 
 * Migration Mode:
 * - STORAGE_MIGRATION_MODE: Set to 'true' to enable read-only migration mode
 */

import type { DatabaseConfig } from './abstraction/database';
import type { FileStorageConfig } from './abstraction/file-storage';
import type { CacheConfig } from './abstraction/cache';
import { createLogger } from '../utils/logger';

const logger = createLogger('StorageConfig');

// ============================================================================
// Configuration Parsers
// ============================================================================

function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Database Configuration
// ============================================================================

export function getDatabaseConfig(): DatabaseConfig {
  const type = (getEnv('DB_TYPE', 'sqlite') as 'sqlite' | 'postgresql');
  
  if (type === 'postgresql') {
    return {
      type: 'postgresql',
      postgresql: {
        host: getEnv('DB_PG_HOST', 'localhost')!,
        port: getEnvInt('DB_PG_PORT', 5432),
        database: getEnv('DB_PG_DATABASE', 'aibase')!,
        username: getEnv('DB_PG_USERNAME', 'aibase')!,
        password: getEnv('DB_PG_PASSWORD', '')!,
        ssl: getEnvBool('DB_PG_SSL', false),
        poolSize: getEnvInt('DB_PG_POOL_SIZE', 10),
      },
    };
  }
  
  // Default to SQLite
  return {
    type: 'sqlite',
    sqlite: {
      path: getEnv('DB_SQLITE_PATH', 'data/app/databases/app.db')!,
    },
  };
}

// ============================================================================
// File Storage Configuration
// ============================================================================

export function getFileStorageConfig(): FileStorageConfig {
  const type = (getEnv('FILE_STORAGE_TYPE', 'local') as 'local' | 's3' | 'azure' | 'gcs');
  
  switch (type) {
    case 's3':
      return {
        type: 's3',
        s3: {
          endpoint: getEnv('FILE_STORAGE_S3_ENDPOINT'), // Optional, for MinIO
          region: getEnv('FILE_STORAGE_S3_REGION', 'us-east-1')!,
          bucket: getEnv('FILE_STORAGE_S3_BUCKET', 'aibase')!,
          accessKeyId: getEnv('FILE_STORAGE_S3_ACCESS_KEY', '')!,
          secretAccessKey: getEnv('FILE_STORAGE_S3_SECRET_KEY', '')!,
          forcePathStyle: getEnvBool('FILE_STORAGE_S3_FORCE_PATH_STYLE', false),
          presignedUrlExpiry: getEnvInt('FILE_STORAGE_S3_PRESIGNED_EXPIRY', 3600),
          publicUrlPrefix: getEnv('FILE_STORAGE_S3_PUBLIC_URL_PREFIX'),
        },
      };
      
    case 'azure':
      return {
        type: 'azure',
        azure: {
          connectionString: getEnv('FILE_STORAGE_AZURE_CONNECTION_STRING', '')!,
          container: getEnv('FILE_STORAGE_AZURE_CONTAINER', 'aibase')!,
        },
      };
      
    case 'gcs':
      return {
        type: 'gcs',
        gcs: {
          projectId: getEnv('FILE_STORAGE_GCS_PROJECT_ID', '')!,
          bucket: getEnv('FILE_STORAGE_GCS_BUCKET', 'aibase')!,
          keyFilename: getEnv('FILE_STORAGE_GCS_KEY_FILE'),
        },
      };
      
    case 'local':
    default:
      return {
        type: 'local',
        local: {
          basePath: getEnv('FILE_STORAGE_LOCAL_PATH', 'data/files')!,
        },
      };
  }
}

// ============================================================================
// Cache Configuration
// ============================================================================

export function getCacheConfig(): CacheConfig {
  const type = (getEnv('CACHE_TYPE', 'memory') as 'memory' | 'redis' | 'valkey');
  
  switch (type) {
    case 'redis':
      return {
        type: 'redis',
        redis: {
          host: getEnv('CACHE_REDIS_HOST', 'localhost')!,
          port: getEnvInt('CACHE_REDIS_PORT', 6379),
          password: getEnv('CACHE_REDIS_PASSWORD'),
          db: getEnvInt('CACHE_REDIS_DB', 0),
          keyPrefix: getEnv('CACHE_REDIS_PREFIX', 'aibase:'),
          tls: getEnvBool('CACHE_REDIS_TLS', false),
          maxRetriesPerRequest: getEnvInt('CACHE_REDIS_MAX_RETRIES', 3),
          retryDelayOnFailover: getEnvInt('CACHE_REDIS_RETRY_DELAY', 100),
        },
      };
      
    case 'valkey':
      return {
        type: 'valkey',
        valkey: {
          host: getEnv('CACHE_VALKEY_HOST', 'localhost')!,
          port: getEnvInt('CACHE_VALKEY_PORT', 6379),
          password: getEnv('CACHE_VALKEY_PASSWORD'),
          db: getEnvInt('CACHE_VALKEY_DB', 0),
          keyPrefix: getEnv('CACHE_VALKEY_PREFIX', 'aibase:'),
          tls: getEnvBool('CACHE_VALKEY_TLS', false),
        },
      };
      
    case 'memory':
    default:
      return {
        type: 'memory',
        memory: {
          maxSize: getEnvInt('CACHE_MEMORY_MAX_SIZE', 10000),
          ttlSeconds: getEnvInt('CACHE_MEMORY_TTL', 3600),
          checkPeriod: getEnvInt('CACHE_MEMORY_CHECK_PERIOD', 600),
        },
      };
  }
}

// ============================================================================
// Migration Mode
// ============================================================================

/**
 * Check if storage is in migration mode
 * In migration mode, the storage is read-only to prevent data inconsistency
 */
export function isMigrationMode(): boolean {
  return getEnvBool('STORAGE_MIGRATION_MODE', false);
}

// ============================================================================
// Configuration Summary
// ============================================================================

export interface StorageConfig {
  database: DatabaseConfig;
  fileStorage: FileStorageConfig;
  cache: CacheConfig;
  migrationMode: boolean;
}

export function getStorageConfig(): StorageConfig {
  return {
    database: getDatabaseConfig(),
    fileStorage: getFileStorageConfig(),
    cache: getCacheConfig(),
    migrationMode: isMigrationMode(),
  };
}

export function printStorageConfig(): void {
  const config = getStorageConfig();
  
  logger.info('📦 Storage Configuration');
  logger.info('========================');
  
  // Database
  logger.info(`Database: ${config.database.type}`);
  if (config.database.type === 'sqlite') {
    logger.info(`  Path: ${config.database.sqlite?.path}`);
  } else {
    logger.info(`  Host: ${config.database.postgresql?.host}`);
    logger.info(`  Port: ${config.database.postgresql?.port}`);
    logger.info(`  Database: ${config.database.postgresql?.database}`);
  }
  
  // File Storage
  logger.info(`File Storage: ${config.fileStorage.type}`);
  if (config.fileStorage.type === 'local') {
    logger.info(`  Path: ${config.fileStorage.local?.basePath}`);
  } else if (config.fileStorage.type === 's3') {
    logger.info(`  Bucket: ${config.fileStorage.s3?.bucket}`);
    logger.info(`  Region: ${config.fileStorage.s3?.region}`);
    if (config.fileStorage.s3?.endpoint) {
      logger.info(`  Endpoint: ${config.fileStorage.s3.endpoint}`);
    }
  }
  
  // Cache
  logger.info(`Cache: ${config.cache.type}`);
  if (config.cache.type === 'memory') {
    logger.info(`  Max Size: ${config.cache.memory?.maxSize} entries`);
    logger.info(`  Default TTL: ${config.cache.memory?.ttlSeconds}s`);
  } else {
    logger.info(`  Host: ${config.cache.redis?.host || config.cache.valkey?.host}`);
    logger.info(`  Port: ${config.cache.redis?.port || config.cache.valkey?.port}`);
  }
  
  if (config.migrationMode) {
    logger.info('⚠️  MIGRATION MODE ENABLED - Storage is READ-ONLY');
  }
}
