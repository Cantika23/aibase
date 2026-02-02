#!/usr/bin/env bun
/**
 * Storage Migration CLI
 * 
 * Usage:
 * ```bash
 * # Show help
 * bun run backend/src/scripts/migrate-storage.ts --help
 * 
 * # Dry run (validate without making changes)
 * bun run backend/src/scripts/migrate-storage.ts --dry-run
 * 
 * # Migrate everything
 * bun run backend/src/scripts/migrate-storage.ts
 * 
 * # Migrate only database
 * bun run backend/src/scripts/migrate-storage.ts --database-only
 * 
 * # Migrate only files
 * bun run backend/src/scripts/migrate-storage.ts --files-only
 * 
 * # Custom batch size
 * bun run backend/src/scripts/migrate-storage.ts --batch-size 500
 * ```
 */

import { migrateAll, migrateDatabase, migrateFileStorage, type MigrationOptions } from '../storage/migration/migrator';
import type { DatabaseConfig, FileStorageConfig } from '../storage/abstraction';

// ============================================================================
// CLI Argument Parsing
// ============================================================================

interface CLIOptions {
  help: boolean;
  dryRun: boolean;
  databaseOnly: boolean;
  filesOnly: boolean;
  cacheOnly: boolean;
  batchSize: number;
  parallel: boolean;
  sourceDbType: 'sqlite' | 'postgresql';
  targetDbType: 'sqlite' | 'postgresql';
  sourceFileType: 'local' | 's3' | 'azure' | 'gcs';
  targetFileType: 'local' | 's3' | 'azure' | 'gcs';
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  
  return {
    help: args.includes('--help') || args.includes('-h'),
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    databaseOnly: args.includes('--database-only'),
    filesOnly: args.includes('--files-only'),
    cacheOnly: args.includes('--cache-only'),
    parallel: args.includes('--parallel') || args.includes('-p'),
    batchSize: parseInt(getArgValue(args, '--batch-size') || '1000', 10),
    sourceDbType: (getArgValue(args, '--source-db') as 'sqlite' | 'postgresql') || 'sqlite',
    targetDbType: (getArgValue(args, '--target-db') as 'sqlite' | 'postgresql') || 'postgresql',
    sourceFileType: (getArgValue(args, '--source-files') as 'local' | 's3') || 'local',
    targetFileType: (getArgValue(args, '--target-files') as 'local' | 's3') || 's3',
  };
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return undefined;
}

// ============================================================================
// Help Message
// ============================================================================

function showHelp(): void {
  console.log(`
AIBase Storage Migration Tool
==============================

Migrate data between storage backends for enterprise scaling.

USAGE:
  bun run backend/src/scripts/migrate-storage.ts [OPTIONS]

OPTIONS:
  -h, --help              Show this help message
  -d, --dry-run           Validate migration without making changes
  --database-only         Migrate only database
  --files-only            Migrate only file storage
  --cache-only            Migrate only cache (sessions)
  --batch-size <n>        Number of records per batch (default: 1000)
  -p, --parallel          Enable parallel processing where safe
  
  --source-db <type>      Source database type: sqlite | postgresql (default: sqlite)
  --target-db <type>      Target database type: sqlite | postgresql (default: postgresql)
  --source-files <type>   Source file storage: local | s3 | azure | gcs (default: local)
  --target-files <type>   Target file storage: local | s3 | azure | gcs (default: s3)

ENVIRONMENT VARIABLES:
  Database (PostgreSQL target):
    DB_PG_HOST, DB_PG_PORT, DB_PG_DATABASE
    DB_PG_USERNAME, DB_PG_PASSWORD, DB_PG_SSL
  
  File Storage (S3 target):
    FILE_STORAGE_S3_REGION, FILE_STORAGE_S3_BUCKET
    FILE_STORAGE_S3_ACCESS_KEY, FILE_STORAGE_S3_SECRET_KEY
    FILE_STORAGE_S3_ENDPOINT (for MinIO)
  
  Cache (Redis target):
    CACHE_REDIS_HOST, CACHE_REDIS_PORT
    CACHE_REDIS_PASSWORD

EXAMPLES:
  # Dry run to validate
  bun run backend/src/scripts/migrate-storage.ts --dry-run

  # Migrate database only
  bun run backend/src/scripts/migrate-storage.ts --database-only

  # Migrate with custom batch size
  bun run backend/src/scripts/migrate-storage.ts --batch-size 500

  # SQLite to SQLite (backup)
  bun run backend/src/scripts/migrate-storage.ts \
    --source-db sqlite --target-db sqlite

  # Local files to MinIO S3
  bun run backend/src/scripts/migrate-storage.ts --files-only \
    --source-files local --target-files s3
`);
}

// ============================================================================
// Progress Bar
// ============================================================================

function createProgressBar(total: number, label: string): (current: number) => void {
  const width = 40;
  
  return (current: number) => {
    const percentage = Math.min(100, Math.round((current / total) * 100));
    const filled = Math.round((width * percentage) / 100);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r${label} [${bar}] ${percentage}% (${current}/${total})`);
    
    if (current >= total) {
      process.stdout.write('\n');
    }
  };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Validate options
  if (options.databaseOnly && options.filesOnly) {
    console.error('Error: --database-only and --files-only are mutually exclusive');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              AIBase Storage Migration Tool                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }

  const migrationOptions: MigrationOptions = {
    dryRun: options.dryRun,
    batchSize: options.batchSize,
    parallel: options.parallel,
    onProgress: (progress) => {
      // Simple progress logging
      if (progress.current % Math.max(1, Math.floor(progress.total / 10)) === 0) {
        console.log(`  ${progress.stage}: ${progress.percentage}% (${progress.current}/${progress.total})`);
      }
    },
  };

  try {
    let success = true;

    // Database migration
    if (!options.filesOnly && !options.cacheOnly) {
      console.log('\n📊 Database Migration');
      console.log('═════════════════════\n');

      const sourceConfig: DatabaseConfig = options.sourceDbType === 'postgresql' ? {
        type: 'postgresql',
        postgresql: {
          host: process.env.DB_PG_HOST || 'localhost',
          port: parseInt(process.env.DB_PG_PORT || '5432'),
          database: process.env.DB_PG_DATABASE || 'aibase',
          username: process.env.DB_PG_USERNAME || 'aibase',
          password: process.env.DB_PG_PASSWORD || '',
          ssl: ['true', '1'].includes(process.env.DB_PG_SSL || ''),
        }
      } : {
        type: 'sqlite',
        sqlite: { path: 'data/app/databases/users.db' }
      };

      const targetConfig: DatabaseConfig = options.targetDbType === 'sqlite' ? {
        type: 'sqlite',
        sqlite: { path: 'data/app/databases/users_new.db' }
      } : {
        type: 'postgresql',
        postgresql: {
          host: process.env.DB_PG_HOST || 'localhost',
          port: parseInt(process.env.DB_PG_PORT || '5432'),
          database: process.env.DB_PG_DATABASE || 'aibase',
          username: process.env.DB_PG_USERNAME || 'aibase',
          password: process.env.DB_PG_PASSWORD || '',
          ssl: ['true', '1'].includes(process.env.DB_PG_SSL || ''),
        }
      };

      console.log(`Source: ${sourceConfig.type}`);
      console.log(`Target: ${targetConfig.type}\n`);

      const result = await migrateDatabase(sourceConfig, targetConfig, migrationOptions);
      
      if (!result.success) {
        success = false;
        console.error('\n❌ Database migration failed');
        result.errors.forEach(err => console.error(`  - ${err}`));
      } else {
        console.log(`\n✅ Database migration completed`);
        console.log(`   Records migrated: ${result.recordsMigrated}`);
        console.log(`   Duration: ${result.durationMs}ms`);
      }
    }

    // File storage migration
    if (!options.databaseOnly && !options.cacheOnly) {
      console.log('\n📁 File Storage Migration');
      console.log('═════════════════════════\n');

      const sourceConfig: FileStorageConfig = options.sourceFileType === 's3' ? {
        type: 's3',
        s3: {
          region: process.env.FILE_STORAGE_S3_REGION || 'us-east-1',
          bucket: process.env.FILE_STORAGE_S3_BUCKET || 'aibase-source',
          accessKeyId: process.env.FILE_STORAGE_S3_ACCESS_KEY || '',
          secretAccessKey: process.env.FILE_STORAGE_S3_SECRET_KEY || '',
        }
      } : {
        type: 'local',
        local: { basePath: 'data/projects' }
      };

      const targetConfig: FileStorageConfig = options.targetFileType === 'local' ? {
        type: 'local',
        local: { basePath: 'data/files_new' }
      } : {
        type: 's3',
        s3: {
          region: process.env.FILE_STORAGE_S3_REGION || 'us-east-1',
          bucket: process.env.FILE_STORAGE_S3_BUCKET || 'aibase',
          accessKeyId: process.env.FILE_STORAGE_S3_ACCESS_KEY || '',
          secretAccessKey: process.env.FILE_STORAGE_S3_SECRET_KEY || '',
          endpoint: process.env.FILE_STORAGE_S3_ENDPOINT,
          forcePathStyle: ['true', '1'].includes(process.env.FILE_STORAGE_S3_FORCE_PATH_STYLE || ''),
        }
      };

      console.log(`Source: ${sourceConfig.type}`);
      console.log(`Target: ${targetConfig.type}\n`);

      const result = await migrateFileStorage(sourceConfig, targetConfig, migrationOptions);
      
      if (!result.success) {
        success = false;
        console.error('\n❌ File storage migration failed');
        result.errors.forEach(err => console.error(`  - ${err}`));
      } else {
        console.log(`\n✅ File storage migration completed`);
        console.log(`   Files migrated: ${result.recordsMigrated}`);
        console.log(`   Files skipped: ${result.recordsSkipped}`);
        console.log(`   Duration: ${result.durationMs}ms`);
      }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  Migration ${success ? '✅ Completed Successfully' : '❌ Completed with Errors'}        ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Migration failed with error:', error);
    process.exit(1);
  }
}

// Run main
main();
