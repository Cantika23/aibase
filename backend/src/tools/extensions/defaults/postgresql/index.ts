/**
 * PostgreSQL Extension
 * Query PostgreSQL databases with secure connection management
 */

import { SQL } from "bun";

/**
 * PostgreSQL query options
 */
export interface PostgreSQLOptions {
  /** SQL query to execute */
  query: string;
  /** PostgreSQL connection URL */
  connectionUrl: string;
  /** Return format: 'json' (default), 'raw' */
  format?: "json" | "raw";
  /** Query timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * PostgreSQL query result
 */
export interface PostgreSQLResult {
  /** Query results as array of objects */
  data?: any[];
  /** Raw result (when format is 'raw') */
  raw?: any;
  /** Number of rows returned */
  rowCount?: number;
  /** Execution time in milliseconds */
  executionTime?: number;
  /** Query executed */
  query?: string;
}

/**
 * PostgreSQL extension
 */
const postgresqlExtension = {
  /**
   * Query PostgreSQL database
   *
   * Usage:
   * const result = await postgresql({
   *   query: 'SELECT * FROM users WHERE active = true LIMIT 10',
   *   connectionUrl: memory.read('database', 'postgresql_url')
   * });
   */
  postgresql: async (options: PostgreSQLOptions): Promise<PostgreSQLResult> => {
    if (!options || typeof options !== "object") {
      throw new Error(
        "postgresql requires an options object. Usage: await postgresql({ query: 'SELECT * FROM users', connectionUrl: '...' })"
      );
    }

    if (!options.query) {
      throw new Error(
        "postgresql requires 'query' parameter. Usage: await postgresql({ query: 'SELECT * FROM users', connectionUrl: '...' })"
      );
    }

    if (!options.connectionUrl) {
      throw new Error(
        "postgresql requires 'connectionUrl' parameter"
      );
    }

    const format = options.format || "json";
    const timeout = options.timeout || 30000;
    const startTime = Date.now();

    try {
      // Create PostgreSQL connection using Bun's SQL
      const db = new SQL(options.connectionUrl);

      // Execute query with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout)
      );

      // Execute the query using Bun's SQL API
      const queryPromise = (async () => {
        return await db.unsafe(options.query);
      })();

      const result = await Promise.race([
        queryPromise,
        timeoutPromise,
      ]);

      const executionTime = Date.now() - startTime;

      // Return results based on format
      if (format === "json") {
        // Bun's SQL returns arrays of objects
        const dataArray = Array.isArray(result) ? result : [result];

        return {
          data: dataArray,
          rowCount: dataArray.length,
          executionTime,
          query: options.query,
        };
      } else {
        // Return raw result
        return {
          raw: result,
          rowCount: Array.isArray(result) ? result.length : undefined,
          executionTime,
          query: options.query,
        };
      }
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Check for common errors
      if (error.message?.includes("ENOTFOUND") || error.message?.includes("ECONNREFUSED")) {
        throw new Error(
          `PostgreSQL connection failed: Unable to connect to database. Check your connection URL and ensure the database is running. ${error.message}`
        );
      }

      if (error.message?.includes("password authentication failed")) {
        throw new Error(
          `PostgreSQL authentication failed: Invalid credentials in connection URL. ${error.message}`
        );
      }

      if (error.message?.includes("does not exist")) {
        throw new Error(
          `PostgreSQL query error: ${error.message}. Check that tables/columns exist.`
        );
      }

      if (error.message?.includes("syntax error")) {
        throw new Error(
          `PostgreSQL syntax error: ${error.message}. Check your SQL query syntax.`
        );
      }

      throw new Error(`PostgreSQL query failed (${executionTime}ms): ${error.message}`);
    }
  },

  /**
   * Test PostgreSQL connection
   */
  testConnection: async (connectionUrl: string): Promise<{ connected: boolean; version?: string; error?: string }> => {
    try {
      const result = await postgresqlExtension.postgresql({
        query: "SELECT version()",
        connectionUrl,
      });

      return {
        connected: true,
        version: result.data?.[0]?.version,
      };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message,
      };
    }
  },

  /**
   * Quick SELECT query helper
   */
  query: async (
    table: string,
    connectionUrl: string,
    options?: {
      where?: string;
      limit?: number;
      orderBy?: string;
    }
  ): Promise<PostgreSQLResult> => {
    const where = options?.where ? `WHERE ${options.where}` : "";
    const orderBy = options?.orderBy ? `ORDER BY ${options.orderBy}` : "";
    const limit = options?.limit ? `LIMIT ${options.limit}` : "";

    const query = `SELECT * FROM ${table} ${where} ${orderBy} ${limit}`.trim();

    return postgresqlExtension.postgresql({
      query,
      connectionUrl,
    });
  },
};

export default postgresqlExtension;
