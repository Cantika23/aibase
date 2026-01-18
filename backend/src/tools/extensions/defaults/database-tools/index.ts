/**
 * Database Tools Extension
 * Provides additional database query utilities
 */

/**
 * Extension exports - functions defined here will be available in scripts
 *
 * This extension provides helper utilities for working with databases.
 * The core database functions (duckdb, postgresql, clickhouse, trino) are
 * already available in the script runtime.
 */
export default {
  /**
   * Helper to query and aggregate CSV data
   */
  async queryCSV(options: {
    file: string;
    groupBy?: string;
    aggregation?: string;
    orderBy?: string;
  }) {
    const { file, groupBy, aggregation, orderBy } = options;

    let query = `SELECT ${groupBy || '*'}`;
    if (aggregation) {
      query += `, ${aggregation}`;
    }
    query += ` FROM '${file}'`;

    if (groupBy) {
      query += ` GROUP BY ${groupBy}`;
    }

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    // @ts-ignore - duckdb is injected by script runtime
    return await duckdb({ query });
  },

  /**
   * Helper to join two CSV files
   */
  async joinCSV(options: {
    leftFile: string;
    rightFile: string;
    leftKey: string;
    rightKey: string;
    joinType?: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  }) {
    const { leftFile, rightFile, leftKey, rightKey, joinType = 'INNER' } = options;

    const query = `
      SELECT *
      FROM '${leftFile}' l
      ${joinType} JOIN '${rightFile}' r
      ON l.${leftKey} = r.${rightKey}
    `;

    // @ts-ignore - duckdb is injected by script runtime
    return await duckdb({ query });
  },

  /**
   * Helper to read Excel with common options
   */
  async readExcel(options: {
    file: string;
    sheet?: string;
    range?: string;
    limit?: number;
  }) {
    const { file, sheet, range = 'A1:ZZ10000', limit } = options;

    let query = `
      SELECT * FROM read_xlsx(
        '${file}',
        header=true,
        all_varchar=true,
        range='${range}'
        ${sheet ? `, sheet='${sheet}'` : ''}
      )
    `;

    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    // @ts-ignore - duckdb is injected by script runtime
    return await duckdb({ query });
  },
};
