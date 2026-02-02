/**
 * SQLite Database Adapter
 * 
 * Wraps Bun's SQLite implementation with the AbstractDatabase interface.
 * This is the default database backend for single-node deployments.
 */

import { Database } from 'bun:sqlite';
import {
  AbstractDatabase,
  type DatabaseConfig,
  type QueryResult,
  type Transaction,
  type Migration,
  type MigrationDirection,
} from '../abstraction/database';
import { createLogger } from '../utils/logger';

const logger = createLogger('SQLiteAdapter');

interface SQLiteTransaction extends Transaction {
  db: Database;
}

export class SQLiteDatabase extends AbstractDatabase {
  private db: Database | null = null;

  constructor(config: DatabaseConfig) {
    super(config);
    if (config.type !== 'sqlite') {
      throw new Error('SQLiteDatabase requires config.type to be "sqlite"');
    }
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const path = this.config.sqlite!.path;
    this.db = new Database(path);
    
    // Enable WAL mode for better concurrency
    this.db.exec('PRAGMA journal_mode = WAL');
    
    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON');
    
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.connected = false;
  }

  private getDb(): Database {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  async query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    const queryParams = (params || []) as (string | number | null | boolean | Uint8Array)[];
    
    try {
      // Check if this is a SELECT query
      const isSelect = sql.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        const rows = stmt.all(...queryParams) as T[];
        return {
          rows,
          rowCount: rows.length,
        };
      } else {
        // For INSERT/UPDATE/DELETE
        const result = stmt.run(...queryParams);
        return {
          rows: [],
          rowCount: result.changes,
          lastInsertId: Number(result.lastInsertRowid),
        };
      }
    } finally {
      stmt.finalize();
    }
  }

  async beginTransaction(): Promise<Transaction> {
    const db = this.getDb();
    db.exec('BEGIN TRANSACTION');
    
    const trx: SQLiteTransaction = {
      db,
      query: async <T>(sql: string, params?: unknown[]): Promise<QueryResult<T>> => {
        const stmt = db.prepare(sql);
        const queryParams = (params || []) as (string | number | null | boolean | Uint8Array)[];
        try {
          const isSelect = sql.trim().toLowerCase().startsWith('select');
          
          if (isSelect) {
            const rows = stmt.all(...queryParams) as T[];
            return { rows, rowCount: rows.length };
          } else {
            const result = stmt.run(...queryParams);
            return {
              rows: [],
              rowCount: result.changes,
              lastInsertId: Number(result.lastInsertRowid),
            };
          }
        } finally {
          // Don't finalize in transaction - let it be reused
        }
      },
      commit: async (): Promise<void> => {
        db.exec('COMMIT');
      },
      rollback: async (): Promise<void> => {
        db.exec('ROLLBACK');
      },
    };
    
    return trx;
  }

  async runMigrations(migrations: Migration[], direction: MigrationDirection = 'up'): Promise<void> {
    const db = this.getDb();
    
    // Create migrations table if not exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `);

    if (direction === 'up') {
      // Apply pending migrations in order
      for (const migration of migrations.sort((a, b) => a.version - b.version)) {
        const existing = db.prepare('SELECT version FROM _migrations WHERE version = ?').get(migration.version);
        
        if (!existing) {
          // Run migration in transaction
          db.exec('BEGIN TRANSACTION');
          try {
            db.exec(migration.up);
            db.prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)')
              .run(migration.version, migration.name, Date.now());
            db.exec('COMMIT');
            logger.info(`Applied migration ${migration.version}: ${migration.name}`);
          } catch (error) {
            db.exec('ROLLBACK');
            throw error;
          }
        }
      }
    } else {
      // Rollback migrations in reverse order
      for (const migration of migrations.sort((a, b) => b.version - a.version)) {
        const existing = db.prepare('SELECT version FROM _migrations WHERE version = ?').get(migration.version);
        
        if (existing) {
          db.exec('BEGIN TRANSACTION');
          try {
            db.exec(migration.down);
            db.prepare('DELETE FROM _migrations WHERE version = ?').run(migration.version);
            db.exec('COMMIT');
            logger.info(`Rolled back migration ${migration.version}: ${migration.name}`);
          } catch (error) {
            db.exec('ROLLBACK');
            throw error;
          }
        }
      }
    }
  }

  async getMigrationVersion(): Promise<number> {
    const db = this.getDb();
    
    // Check if migrations table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'
    `).get();
    
    if (!tableExists) {
      return 0;
    }
    
    const result = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as { version: number | null };
    return result.version ?? 0;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const db = this.getDb();
    const result = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name = ?
    `).get(tableName);
    return !!result;
  }

  async getTableInfo(tableName: string): Promise<{ column: string; type: string }[]> {
    const db = this.getDb();
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return rows.map(row => ({
      column: row.name,
      type: row.type,
    }));
  }

  /**
   * Get raw SQLite Database instance for advanced operations
   * Use with caution - prefer the abstract interface
   */
  getRawDatabase(): Database {
    return this.getDb();
  }
}
