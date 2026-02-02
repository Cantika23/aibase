/**
 * Database Abstraction Layer
 * 
 * Provides a unified interface for different database backends (SQLite, PostgreSQL).
 * This allows seamless migration from single-node SQLite to enterprise PostgreSQL.
 */

// ============================================================================
// Types
// ============================================================================

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  lastInsertId?: number | string;
}

export interface Transaction {
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql';
  // SQLite options
  sqlite?: {
    path: string;
  };
  // PostgreSQL options
  postgresql?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
    poolSize?: number;
  };
}

export type MigrationDirection = 'up' | 'down';

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

// ============================================================================
// Abstract Database Interface
// ============================================================================

export abstract class AbstractDatabase {
  protected config: DatabaseConfig;
  protected connected: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Connect to the database
   */
  abstract connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<void>;

  /**
   * Execute a single query
   */
  abstract query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /**
   * Execute a single query and return first row or null
   */
  async queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.query<T>(sql, params);
    return result.rows[0] ?? null;
  }

  /**
   * Execute a query that doesn't return rows (INSERT, UPDATE, DELETE)
   */
  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    return this.query(sql, params);
  }

  /**
   * Begin a transaction
   */
  abstract beginTransaction(): Promise<Transaction>;

  /**
   * Execute a callback within a transaction
   */
  async transaction<T>(callback: (trx: Transaction) => Promise<T>): Promise<T> {
    const trx = await this.beginTransaction();
    try {
      const result = await callback(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Run migrations
   */
  abstract runMigrations(migrations: Migration[], direction?: MigrationDirection): Promise<void>;

  /**
   * Get current migration version
   */
  abstract getMigrationVersion(): Promise<number>;

  /**
   * Check if table exists
   */
  abstract tableExists(tableName: string): Promise<boolean>;

  /**
   * Get table schema info
   */
  abstract getTableInfo(tableName: string): Promise<{ column: string; type: string }[]>;
}

// ============================================================================
// Factory
// ============================================================================

let globalDatabase: AbstractDatabase | null = null;

export function createDatabase(config: DatabaseConfig): AbstractDatabase {
  // Dynamic imports to avoid loading unused drivers
  if (config.type === 'sqlite') {
    const { SQLiteDatabase } = require('../adapters/sqlite');
    return new SQLiteDatabase(config);
  }
  
  if (config.type === 'postgresql') {
    const { PostgreSQLDatabase } = require('../adapters/postgresql');
    return new PostgreSQLDatabase(config);
  }

  throw new Error(`Unknown database type: ${config.type}`);
}

export function setGlobalDatabase(db: AbstractDatabase): void {
  globalDatabase = db;
}

export function getGlobalDatabase(): AbstractDatabase {
  if (!globalDatabase) {
    throw new Error('Global database not initialized. Call setGlobalDatabase() first.');
  }
  return globalDatabase;
}

export function clearGlobalDatabase(): void {
  globalDatabase = null;
}
