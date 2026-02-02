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
  
  console.log(`[Migration] Database: ${sourceConfig.type} → ${targetConfig.type}`);
  
  if (options.dryRun) {
    console.log('[Migration] DRY RUN MODE - No changes will be made');
  }

  const sourceDb = createDatabase(sourceConfig);
  const targetDb = createDatabase(targetConfig);

  try {
    await sourceDb.connect();
    await targetDb.connect();

    // Get list of tables to migrate
    const tables = await getTablesToMigrate(sourceDb);
    
    for (const table of tables) {
      console.log(`\n[Migration] Table: ${table.name}`);
      
      try {
        // Check if table exists in source
        if (!await sourceDb.tableExists(table.name)) {
          console.log(`[Migration] Table ${table.name} does not exist in source, skipping`);
          continue;
        }

        // Get table schema
        const schema = await sourceDb.getTableInfo(table.name);
        console.log(`[Migration] Columns: ${schema.map(c => c.column).join(', ')}`);

        // Read all data from source
        const sourceData = await sourceDb.query(`SELECT * FROM ${table.name}`);
        console.log(`[Migration] Found ${sourceData.rowCount} rows`);

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
                    console.error(`[Migration] Error inserting row:`, error);
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
          console.log(`[Migration] Migrated ${migrated} rows to ${table.name}`);
        } else {
          result.recordsMigrated += sourceData.rowCount;
          console.log(`[Migration] Would migrate ${sourceData.rowCount} rows (dry run)`);
        }
      } catch (error) {
        result.success = false;
        result.errors.push(`Table ${table.name}: ${(error as Error).message}`);
        console.error(`[Migration] Failed to migrate table ${table.name}:`, error);
      }
    }

  } catch (error) {
    result.success = false;
    result.errors.push((error as Error).message);
    console.error('[Migration] Database migration failed:', error);
  } finally {
    await sourceDb.disconnect();
    await targetDb.disconnect();
  }

  result.durationMs = Date.now() - startTime;
  
  console.log(`\n[Migration] Database migration completed in ${result.durationMs}ms`);
  console.log(`[Migration] Records migrated: ${result.recordsMigrated}`);
  console.log(`[Migration] Records failed: ${result.recordsFailed}`);
  
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
  console.log(`[Migration] Created table ${tableName} in target`);
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
  
  console.log(`[Migration] File Storage: ${sourceConfig.type} → ${targetConfig.type}`);
  
  if (options.dryRun) {
    console.log('[Migration] DRY RUN MODE - No changes will be made');
  }

  const sourceStorage = await createFileStorage(sourceConfig);
  const targetStorage = await createFileStorage(targetConfig);

  try {
    // List all files from source
    console.log('[Migration] Listing files from source...');
    let continuationToken: string | undefined;
    let totalFiles = 0;
    
    do {
      const listResult = await sourceStorage.list({
        maxResults: 1000,
        continuationToken,
      });
      
      totalFiles += listResult.files.length;
      
      console.log(`[Migration] Processing batch of ${listResult.files.length} files...`);
      
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
    console.error('[Migration] File storage migration failed:', error);
  } finally {
    await sourceStorage.close();
    await targetStorage.close();
  }

  result.durationMs = Date.now() - startTime;
  
  console.log(`\n[Migration] File storage migration completed in ${result.durationMs}ms`);
  console.log(`[Migration] Files migrated: ${result.recordsMigrated}`);
  console.log(`[Migration] Files skipped: ${result.recordsSkipped}`);
  console.log(`[Migration] Files failed: ${result.recordsFailed}`);
  
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
  
  console.log(`[Migration] Cache: ${sourceConfig.type} → ${targetConfig.type}`);
  console.log('[Migration] Note: Cache migration typically only migrates session data');
  
  if (options.dryRun) {
    console.log('[Migration] DRY RUN MODE - No changes will be made');
  }

  // For cache, we typically only migrate sessions, not all cached data
  // This is because cached data is ephemeral and can be regenerated
  
  console.log('[Migration] Cache migration not yet implemented');
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

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              AIBase Storage Migration Tool                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Database migration
  if (options.migrateDatabase !== false) {
    console.log('\n📊 Database Migration');
    console.log('═════════════════════\n');
    
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
    console.log('\n📁 File Storage Migration');
    console.log('═════════════════════════\n');
    
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
    console.log('\n💾 Cache Migration');
    console.log('══════════════════\n');
    
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

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log(`║  Migration ${result.overallSuccess ? '✅ Completed' : '❌ Failed'}                          ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  return result;
}
