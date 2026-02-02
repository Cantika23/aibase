/**
 * Storage Adapters
 * 
 * Concrete implementations of the storage abstraction layer.
 * 
 * Database Adapters:
 * - SQLiteDatabase: Single-node, file-based (default)
 * - PostgreSQLDatabase: Enterprise, distributed (requires 'pg' driver)
 * 
 * File Storage Adapters:
 * - LocalFileStorage: Local filesystem (default)
 * - S3FileStorage: S3-compatible storage (requires 'aws-sdk' or '@aws-sdk/client-s3')
 * - AzureFileStorage: Azure Blob Storage (requires '@azure/storage-blob')
 * - GCSFileStorage: Google Cloud Storage (requires '@google-cloud/storage')
 * 
 * Cache Adapters:
 * - MemoryCache: In-process memory (default)
 * - RedisCache: Redis server (requires 'ioredis')
 * - ValkeyCache: AWS ElastiCache Valkey (requires 'ioredis')
 */

// Note: These are dynamically imported to avoid loading unused dependencies
// Only the adapter matching your config.type is loaded at runtime

export { SQLiteDatabase } from './sqlite';
export { LocalFileStorage } from './local-file-storage';
export { MemoryCache } from './memory-cache';

// Enterprise adapters are dynamically imported to avoid bundling unused dependencies
// export { PostgreSQLDatabase } from './postgresql';
// export { S3FileStorage } from './s3-file-storage';
// export { AzureFileStorage } from './azure-file-storage';
// export { GCSFileStorage } from './gcs-file-storage';
// export { RedisCache } from './redis-cache';
// export { ValkeyCache } from './valkey-cache';
