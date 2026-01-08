import { SQL } from "bun";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Context documentation for PostgreSQL functionality
 */
export const context = async () => {
  return `### POSTGRESQL QUERIES

Use postgresql() for direct PostgreSQL database queries.

**IMPORTANT:** Use postgresql(), NOT DuckDB for PostgreSQL databases!

**Available:** postgresql({ query, connectionUrl?, format?, timeout? })

**IMPORTANT:** Store credentials in memory for security! Use: \`await memory({ action: 'set', category: 'database', key: 'postgresql_url', value: 'postgresql://user:pass@localhost:5432/mydb' })\`

#### EXAMPLES

\`\`\`typescript
// RECOMMENDED: Store credentials in memory first (do this once):
await memory({
  action: 'set',
  category: 'database',
  key: 'postgresql_url',
  value: 'postgresql://user:pass@localhost:5432/mydb'
});

// Then query without exposing credentials in code:
progress('Querying PostgreSQL...');
const result = await postgresql({
  query: 'SELECT * FROM users WHERE active = true LIMIT 10'
});
progress(\`Found \${result.rowCount} users\`);
return { count: result.rowCount, users: result.data };

// Query with aggregation (credentials from memory)
progress('Analyzing orders...');
const stats = await postgresql({
  query: 'SELECT status, COUNT(*) as count, SUM(total) as revenue FROM orders GROUP BY status ORDER BY revenue DESC'
});
return { breakdown: stats.data, totalStatuses: stats.rowCount };

// Query with custom timeout (credentials from memory)
progress('Querying large table...');
const products = await postgresql({
  query: 'SELECT * FROM products WHERE price > 100 ORDER BY price DESC',
  timeout: 60000
});
return { products: products.rowCount, data: products.data };

// Legacy: Direct connection URL (NOT RECOMMENDED - credentials visible in code)
const legacy = await postgresql({
  query: 'SELECT * FROM items',
  connectionUrl: 'postgresql://user:pass@localhost:5432/shop'
});
\`\`\``
};

/**
 * PostgreSQL query options
 */
export interface PostgreSQLOptions {
  /** SQL query to execute */
  query: string;
  /** PostgreSQL connection URL (optional if stored in memory) */
  connectionUrl?: string;
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
 * Load memory from file to retrieve stored credentials
 */
async function loadMemory(projectId: string): Promise<Record<string, any>> {
  const memoryPath = path.join(
    process.cwd(),
    "data",
    projectId,
    "memory.json"
  );

  try {
    const content = await fs.readFile(memoryPath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
}

/**
 * Create a PostgreSQL query function with memory support for secure credential storage
 *
 * Uses Bun's native SQL API for PostgreSQL database queries.
 *
 * Credentials can be stored securely in memory:
 * await memory({ action: 'set', category: 'database', key: 'postgresql_url', value: 'postgresql://...' });
 *
 * Usage in script tool:
 *
 * // RECOMMENDED: Query using credentials from memory:
 * const users = await postgresql({
 *   query: 'SELECT * FROM users WHERE active = true LIMIT 10'
 * });
 * console.log(`Found ${users.rowCount} users`);
 * console.log(users.data); // Array of user objects
 *
 * // Query with aggregation:
 * const stats = await postgresql({
 *   query: 'SELECT status, COUNT(*) as count FROM orders GROUP BY status'
 * });
 *
 * // Query with custom timeout:
 * const large = await postgresql({
 *   query: 'SELECT * FROM large_table',
 *   timeout: 60000 // 60 seconds
 * });
 *
 * @param projectId - Project ID for loading memory
 */
export function createPostgreSQLFunction(projectId?: string) {
  return async (options: PostgreSQLOptions): Promise<PostgreSQLResult> => {
    if (!options || typeof options !== "object") {
      throw new Error(
        "postgresql requires an options object. Usage: postgresql({ query: 'SELECT * FROM users' })"
      );
    }

    if (!options.query) {
      throw new Error(
        "postgresql requires 'query' parameter. Usage: postgresql({ query: 'SELECT * FROM users' })"
      );
    }

    // Try to get connection URL from memory first, then fall back to provided parameter
    let connectionUrl = options.connectionUrl;

    if (!connectionUrl && projectId) {
      try {
        // Try to read from memory
        const memory = await loadMemory(projectId);
        if (memory.database && memory.database.postgresql_url) {
          connectionUrl = memory.database.postgresql_url;
        }
      } catch (error) {
        // Silently ignore memory errors and require explicit connectionUrl
      }
    }

    if (!connectionUrl) {
      throw new Error(
        "postgresql requires 'connectionUrl' parameter or credentials stored in memory. " +
        "Store credentials securely: await memory({ action: 'set', category: 'database', key: 'postgresql_url', value: 'postgresql://user:pass@host:5432/db' })"
      );
    }

    const format = options.format || "json";
    const timeout = options.timeout || 30000;
    const startTime = Date.now();

    try {
      const connectionUrl = options.connectionUrl;

      // Create PostgreSQL connection using Bun's SQL
      const db = new SQL(connectionUrl);

      // Execute query with timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout after ${timeout}ms`)), timeout)
      );

      // Execute the query using Bun's SQL API
      // We need to use the unsafe method for dynamic query strings
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
      // Improve error messages
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
  };
}

/**
 * Helper function to test PostgreSQL connection
 */
export async function testPostgreSQLConnection(
  connectionUrl: string
): Promise<{ connected: boolean; version?: string; error?: string }> {
  try {
    const pgQuery = createPostgreSQLFunction();
    const result = await pgQuery({
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
}

/**
 * Helper function to execute a simple SELECT query
 */
export function queryPostgreSQL(
  table: string,
  connectionUrl: string,
  options?: {
    where?: string;
    limit?: number;
    orderBy?: string;
  }
) {
  const where = options?.where ? `WHERE ${options.where}` : "";
  const orderBy = options?.orderBy ? `ORDER BY ${options.orderBy}` : "";
  const limit = options?.limit ? `LIMIT ${options.limit}` : "";

  const query = `SELECT * FROM ${table} ${where} ${orderBy} ${limit}`.trim();

  return createPostgreSQLFunction()({
    query,
    connectionUrl,
  });
}
