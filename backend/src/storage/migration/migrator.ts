/**
 * Storage Migration Tool
 * 
 * Provides functionality to migrate data between storage backends:
 * - SQLite → PostgreSQL
 * - Local Files → S3/Azure/GCS
 * - In-Memory Cache → Redis/Valkey
 * 
 * Usage:
 * ```bash
 * # Migrate database
 * bun run backend/src/scripts/migrate-storage.ts --database --from sqlite --to postgresql
 * 
 * # Migrate files
 * bun run backend/src/scripts/migrate-storage.ts --files --from local --to s3
 * 
 * # Migrate everything
 * bun run backend/src/scripts/migrate-storage.ts --all
 * ```
 */

import {
  AbstractDatabase,
  AbstractFileStorage,
  AbstractCache,
  createDatabase,
  createFileStorage,
  createCache,
} from '../abstraction';
import type { DatabaseConfig, FileStorageConfig, CacheConfig } from '../abstraction';
import { createLogger } from '../utils/logger';

const logger = createLogger('Migrator');

// ============================================================================
// Migration Options
// ============================================================================

export interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  parallel?: boolean;
  maxConcurrency?: number;
  onProgress?: (progress: MigrationProgress) => void;
}

export interface MigrationProgress {
  stage: string;
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export interface MigrationResult {
  success: boolean;
  durationMs: number;
  recordsMigrated: number;
  recordsSkipped: number;
  recordsFailed: number;
  errors: string[];
}

// ============================================================================
// Database Migration
// ============================================================================

interface TableMigration {
  name: string;
  dependencies?: string[];
}

const DEFAULT_TABLES: TableMigration[] = [
  { name: 'tenants' },
  { name: 'users', dependencies: ['tenants'] },
  { name: 'sessions', dependencies: ['users'] },
  { name: 'projects', dependencies: ['users', 'tenants'] },
  { name: 'categories', dependencies: ['projects'] },
  { name: 'extensions', dependencies: ['projects'] },
];

export async function migrateDatabase(
  sourceConfig: DatabaseConfig,
  targetConfig: DatabaseConfig,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    durationMs: 0,
    recordsMigrated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    errors: [],
  };

  const startTime = Date.now();
  
  logger.info(`Database: ${sourceConfig.type} → ${targetConfig.type}`);
  
  if (options.dryRun) {
    logger.info('DRY RUN MODE - No changes will be made');
  }

  const sourceDb = createDatabase(sourceConfig);
  const targetDb = createDatabase(targetConfig);

  try {
    await sourceDb.connect();
    await targetDb.connect();

    // Get list of tables to migrate
    const tables = await getTablesToMigrate(sourceDb);
    
    for (const table of tables) {
      logger.info(`Table: ${table.name}`);
      
      try {
        // Check if table exists in source
        if (!await sourceDb.tableExists(table.name)) {
          logger.info(`Table ${table.name} does not exist in source, skipping`);
          continue;
        }

        // Get table schema
        const schema = await sourceDb.getTableInfo(table.name);
        logger.info(`Columns: ${schema.map(c => c.column).join(', ')}`);

        // Read all data from source
        const sourceData = await sourceDb.query(`SELECT * FROM ${table.name}`);
        logger.info(`Found ${sourceData.rowCount} rows`);

        if (sourceData.rowCount === 0) {
          continue;
        }

        // Create table in target if not exists
        if (!options.dryRun) {
          if (!await targetDb.tableExists(table.name)) {
            await createTableInTarget(targetDb, table.name, schema);
          }

          // Migrate data in batches
          const batchSize = options.batchSize || 1000;
          let migrated = 0;
          
          for (let i = 0; i < sourceData.rows.length; i += batchSize) {
            const batch = sourceData.rows.slice(i, i + batchSize);
            
            await targetDb.transaction(async (trx) => {
              for (const row of batch) {
                const rowData = row as Record<string, unknown>;
                const columns = Object.keys(rowData);
                const placeholders = columns.map(() => '?').join(',');
                const sql = `INSERT INTO ${table.name} (${columns.join(',')}) VALUES (${placeholders})`;
                
                try {
                  await trx.query(sql, Object.values(rowData));
                  migrated++;
                } catch (error) {
                  result.recordsFailed++;
                  result.errors.push(`Table ${table.name}: ${(error as Error).message}`);
                  
                  // Log first few errors
                  if (result.errors.length <= 5) {
                    logger.error({ error }, 'Error inserting row');
                  }
                }
              }
            });

            // Report progress
            if (options.onProgress) {
              options.onProgress({
                stage: `Migrating ${table.name}`,
                current: Math.min(i + batchSize, sourceData.rows.length),
                total: sourceData.rows.length,
                percentage: Math.round(((i + batchSize) / sourceData.rows.length) * 100),
                message: `Migrated ${migrated} rows`,
              });
            }
          }

          result.recordsMigrated += migrated;
          logger.info(`Migrated ${migrated} rows to ${table.name}`);
        } else {
          result.recordsMigrated += sourceData.rowCount;
          logger.info(`Would migrate ${sourceData.rowCount} rows (dry run)`);
        }
      } catch (error) {
        result.success = false;
        result.errors.push(`Table ${table.name}: ${(error as Error).message}`);
        logger.error({ error }, `Failed to migrate table ${table.name}`);
      }
    }

  } catch (error) {
    result.success = false;
    result.errors.push((error as Error).message);
    logger.error({ error }, 'Database migration failed');
  } finally {
    await sourceDb.disconnect();
    await targetDb.disconnect();
  }

  result.durationMs = Date.now() - startTime;
  
  logger.info(`Database migration completed in ${result.durationMs}ms`);
  logger.info(`Records migrated: ${result.recordsMigrated}`);
  logger.info(`Records failed: ${result.recordsFailed}`);
  
  return result;
}

async function getTablesToMigrate(db: AbstractDatabase): Promise<TableMigration[]> {
  // In a real implementation, you'd query sqlite_master or information_schema
  // For now, return the default tables
  return DEFAULT_TABLES;
}

async function createTableInTarget(
  db: AbstractDatabase,
  tableName: string,
  schema: { column: string; type: string }[]
): Promise<void> {
  // Generate CREATE TABLE statement
  // This is simplified - real implementation would need to handle constraints, indexes, etc.
  const columnDefs = schema.map(col => `${col.column} ${col.type}`).join(', ');
  const sql = `CREATE TABLE ${tableName} (${columnDefs})`;
  
  await db.execute(sql);
  logger.info(`Created table ${tableName} in target`);
}

// ============================================================================
// File Storage Migration
// ============================================================================

export async function migrateFileStorage(
  sourceConfig: FileStorageConfig,
  targetConfig: FileStorageConfig,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    durationMs: 0,
    recordsMigrated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    errors: [],
  };

  const startTime = Date.now();
  
  logger.info(`File Storage: ${sourceConfig.type} → ${targetConfig.type}`);
  
  if (options.dryRun) {
    logger.info('DRY RUN MODE - No changes will be made');
  }

  const sourceStorage = await createFileStorage(sourceConfig);
  const targetStorage = await createFileStorage(targetConfig);

  try {
    // List all files from source
    logger.info('Listing files from source...');
    let continuationToken: string | undefined;
    let totalFiles = 0;
    
    do {
      const listResult = await sourceStorage.list({
        maxResults: 1000,
        continuationToken,
      });
      
      totalFiles += listResult.files.length;
      
      logger.info(`Processing batch of ${listResult.files.length} files...`);
      
      for (const file of listResult.files) {
        try {
          // Check if file already exists in target
          if (await targetStorage.exists(file.key)) {
            result.recordsSkipped++;
            continue;
          }
          
          if (!options.dryRun) {
            // Download from source
            const content = await sourceStorage.get(file.key);
            
            // Upload to target
            await targetStorage.put(file.key, content, file.metadata);
          }
          
          result.recordsMigrated++;
          
          if (options.onProgress && result.recordsMigrated % 100 === 0) {
            options.onProgress({
              stage: 'Migrating files',
              current: result.recordsMigrated,
              total: totalFiles,
              percentage: Math.round((result.recordsMigrated / totalFiles) * 100),
              message: `Migrated ${file.key}`,
            });
          }
        } catch (error) {
          result.recordsFailed++;
          result.errors.push(`File ${file.key}: ${(error as Error).message}`);
        }
      }
      
      continuationToken = listResult.continuationToken;
    } while (continuationToken);

  } catch (error) {
    result.success = false;
    result.errors.push((error as Error).message);
    logger.error({ error }, 'File storage migration failed');
  } finally {
    await sourceStorage.close();
    await targetStorage.close();
  }

  result.durationMs = Date.now() - startTime;
  
  logger.info(`File storage migration completed in ${result.durationMs}ms`);
  logger.info(`Files migrated: ${result.recordsMigrated}`);
  logger.info(`Files skipped: ${result.recordsSkipped}`);
  logger.info(`Files failed: ${result.recordsFailed}`);
  
  return result;
}

// ============================================================================
// Cache Migration (Session Data)
// ============================================================================

export async function migrateCache(
  sourceConfig: CacheConfig,
  targetConfig: CacheConfig,
  options: MigrationOptions = {}
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    durationMs: 0,
    recordsMigrated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    errors: [],
  };

  const startTime = Date.now();
  
  logger.info(`Cache: ${sourceConfig.type} → ${targetConfig.type}`);
  logger.info('Note: Cache migration typically only migrates session data');
  
  if (options.dryRun) {
    logger.info('DRY RUN MODE - No changes will be made');
  }

  // For cache, we typically only migrate sessions, not all cached data
  // This is because cached data is ephemeral and can be regenerated
  
  logger.info('Cache migration not yet implemented');
  result.errors.push('Cache migration not yet implemented');
  
  result.durationMs = Date.now() - startTime;
  return result;
}

// ============================================================================
// Full Migration
// ============================================================================

export interface FullMigrationOptions extends MigrationOptions {
  migrateDatabase?: boolean;
  migrateFiles?: boolean;
  migrateCache?: boolean;
}

export interface FullMigrationResult {
  database?: MigrationResult;
  files?: MigrationResult;
  cache?: MigrationResult;
  overallSuccess: boolean;
}

export async function migrateAll(
  options: FullMigrationOptions = {}
): Promise<FullMigrationResult> {
  const result: FullMigrationResult = {
    overallSuccess: true,
  };

  logger.info('╔════════════════════════════════════════════════════════════╗');
  logger.info('║              AIBase Storage Migration Tool                 ║');
  logger.info('╚════════════════════════════════════════════════════════════╝');

  // Database migration
  if (options.migrateDatabase !== false) {
    logger.info('📊 Database Migration');
    logger.info('═════════════════════');
    
    // Read configs from environment or use defaults
    const sourceConfig: DatabaseConfig = { type: 'sqlite', sqlite: { path: 'data/app/databases/app.db' } };
    const targetConfig: DatabaseConfig = { 
      type: 'postgresql', 
      postgresql: { 
        host: process.env.DB_PG_HOST || 'localhost',
        port: parseInt(process.env.DB_PG_PORT || '5432'),
        database: process.env.DB_PG_DATABASE || 'aibase',
        username: process.env.DB_PG_USERNAME || 'aibase',
        password: process.env.DB_PG_PASSWORD || '',
        ssl: false,
      }
    };
    
    result.database = await migrateDatabase(sourceConfig, targetConfig, options);
    if (!result.database.success) {
      result.overallSuccess = false;
    }
  }

  // File storage migration
  if (options.migrateFiles !== false) {
    logger.info('📁 File Storage Migration');
    logger.info('═════════════════════════');
    
    const sourceConfig: FileStorageConfig = { type: 'local', local: { basePath: 'data/files' } };
    const targetConfig: FileStorageConfig = {
      type: 's3',
      s3: {
        region: process.env.FILE_STORAGE_S3_REGION || 'us-east-1',
        bucket: process.env.FILE_STORAGE_S3_BUCKET || 'aibase',
        accessKeyId: process.env.FILE_STORAGE_S3_ACCESS_KEY || '',
        secretAccessKey: process.env.FILE_STORAGE_S3_SECRET_KEY || '',
      }
    };
    
    result.files = await migrateFileStorage(sourceConfig, targetConfig, options);
    if (!result.files.success) {
      result.overallSuccess = false;
    }
  }

  // Cache migration (sessions only)
  if (options.migrateCache) {
    logger.info('💾 Cache Migration');
    logger.info('══════════════════');
    
    const sourceConfig: CacheConfig = { type: 'memory' };
    const targetConfig: CacheConfig = {
      type: 'redis',
      redis: {
        host: process.env.CACHE_REDIS_HOST || 'localhost',
        port: parseInt(process.env.CACHE_REDIS_PORT || '6379'),
      }
    };
    
    result.cache = await migrateCache(sourceConfig, targetConfig, options);
    if (!result.cache.success) {
      result.overallSuccess = false;
    }
  }

  logger.info('╔════════════════════════════════════════════════════════════╗');
  logger.info(`║  Migration ${result.overallSuccess ? '✅ Completed' : '❌ Failed'}                          ║`);
  logger.info('╚════════════════════════════════════════════════════════════╝');

  return result;
}
