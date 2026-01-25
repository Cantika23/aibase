/**
 * DuckDB Extension
 * Query CSV, Excel, Parquet, and JSON files using SQL
 */

import { $ } from "bun";

/**
 * DuckDB query options
 */
export interface DuckDBOptions {
  /** SQL query to execute */
  query: string;
  /** Optional database file path (uses in-memory DB if not provided) */
  database?: string;
  /** Return format: 'json' (default), 'csv', 'markdown', 'table' */
  format?: "json" | "csv" | "markdown" | "table";
  /** Read-only mode (default: true) */
  readonly?: boolean;
}

/**
 * DuckDB query result
 */
export interface DuckDBResult {
  /** Query results as array of objects (when format is 'json') */
  data?: any[];
  /** Raw output (when format is not 'json') */
  output?: string;
  /** Number of rows returned */
  rowCount?: number;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * DuckDB extension function
 */
const duckdbExtension = {
  /**
   * Query data files using DuckDB SQL
   *
   * Supports reading various file formats directly in SQL queries:
   * - CSV: SELECT * FROM 'file.csv'
   * - Parquet: SELECT * FROM 'file.parquet'
   * - JSON: SELECT * FROM 'file.json'
   * - Excel: SELECT * FROM read_xlsx('file.xlsx', header=true, all_varchar=true, range='A1:Z1000')
   *
   * IMPORTANT for Excel files:
   * - The 'range' parameter is REQUIRED for multi-column Excel files!
   *   Without it, only the first column will be read.
   * - Use 'all_varchar=true' to read all cells as text and avoid type conversion errors
   * - Cast to numeric types when needed: CAST(column AS DOUBLE) or CAST(column AS INTEGER)
   */
  duckdb: async (options: DuckDBOptions): Promise<DuckDBResult> => {
    if (!options || typeof options !== "object") {
      throw new Error(
        "duckdb requires an options object. Usage: await duckdb({ query: 'SELECT * FROM data.csv' })"
      );
    }

    if (!options.query) {
      throw new Error(
        "duckdb requires 'query' parameter. Usage: await duckdb({ query: 'SELECT * FROM data.csv' })"
      );
    }

    const format = options.format || "json";
    const readonly = options.readonly !== false; // Default to true
    const startTime = Date.now();

    try {
      // Build DuckDB command
      let command: string[];

      if (options.database) {
        // Use database file
        command = [
          "duckdb",
          readonly ? "-readonly" : "",
          options.database,
        ].filter(Boolean);
      } else {
        // Use in-memory database
        command = ["duckdb", ":memory:"];
      }

      // DuckDB CLI flags based on format
      const formatFlags: Record<string, string> = {
        json: "-json",
        csv: "-csv",
        markdown: "-markdown",
        table: "-table",
      };

      const formatFlag = formatFlags[format] || "-json";

      // Execute DuckDB query using Bun.$
      const finalQuery = options.query.trim();
      const result = await $`${command} ${formatFlag} -c ${finalQuery}`.text();

      const executionTime = Date.now() - startTime;

      // Parse result based on format
      if (format === "json") {
        const trimmedResult = result.trim();

        // Handle empty result
        if (!trimmedResult) {
          return {
            data: [],
            rowCount: 0,
            executionTime,
          };
        }

        try {
          // DuckDB -json outputs a JSON array: [{...}, {...}, ...]
          const data = JSON.parse(trimmedResult);

          // Ensure it's an array
          const dataArray = Array.isArray(data) ? data : [data];

          return {
            data: dataArray,
            rowCount: dataArray.length,
            executionTime,
          };
        } catch (parseError: any) {
          // Return raw output for debugging
          throw new Error(
            `Failed to parse JSON result: ${parseError.message}\nRaw output (first 500 chars): ${trimmedResult.substring(0, 500)}`
          );
        }
      } else {
        // Return raw output for non-JSON formats
        return {
          output: result.trim(),
          executionTime,
        };
      }
    } catch (error: any) {
      // Improve error messages
      if (error.stderr) {
        throw new Error(`DuckDB error: ${error.stderr.toString()}`);
      }
      throw new Error(`DuckDB query failed: ${error.message}`);
    }
  },

  /**
   * Helper function to read CSV files
   */
  readCSV: async (filePath: string, options?: { limit?: number }): Promise<DuckDBResult> => {
    const limit = options?.limit ? `LIMIT ${options.limit}` : "";
    return duckdbExtension.duckdb({
      query: `SELECT * FROM '${filePath}' ${limit}`.trim(),
      format: "json",
    });
  },

  /**
   * Helper function to read Excel files
   * Uses DuckDB's excel extension which auto-loads on first use
   *
   * IMPORTANT: For multi-column Excel files, you MUST specify the range parameter!
   * Example: await readExcel('file.xlsx', { range: 'A1:Z1000' })
   */
  readExcel: async (
    filePath: string,
    options?: {
      sheet?: string;
      header?: boolean;
      range?: string;
      limit?: number;
    }
  ): Promise<DuckDBResult> => {
    const limit = options?.limit ? `LIMIT ${options.limit}` : "";

    // Build read_xlsx parameters - always use all_varchar to avoid type errors
    const params: string[] = ["all_varchar=true"];

    if (options?.sheet) {
      params.push(`sheet='${options.sheet}'`);
    }
    if (options?.header !== undefined) {
      params.push(`header=${options.header}`);
    }
    if (options?.range) {
      params.push(`range='${options.range}'`);
    } else {
      // Default to reading a large range
      params.push(`range='A1:ZZ10000'`);
    }

    const paramsStr = `, ${params.join(', ')}`;

    // Excel extension auto-loads, no need to install/load
    const query = `SELECT * FROM read_xlsx('${filePath}'${paramsStr}) ${limit}`.trim();

    return duckdbExtension.duckdb({
      query,
      format: "json",
    });
  },
};

export default duckdbExtension;
