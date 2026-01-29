/**
 * Show Table Extension
 * Display tabular data in the frontend
 */

// Type definitions
interface TableColumn {
  key: string;
  label: string;
}

interface ShowTableOptions {
  title: string;
  columns: TableColumn[];
  data: Record<string, unknown>[];
}

interface ShowTableResult {
  __visualization: {
    type: string;
    toolCallId: string;
    args: ShowTableOptions;
  };
}

/**
 * Context documentation for the table extension
 */
const context = () =>
  '' +
  '### Table Extension' +
  '' +
  'Display tabular data in an interactive table format.' +
  '' +
  '**Available Functions:**' +
  '' +
  '#### show(options)' +
  'Display an interactive table.' +
  '`' + '`' + '`' + 'typescript' +
  'await table.show({' +
  '  title: "Users",' +
  '  columns: [' +
  '    { key: "id", label: "ID" },' +
  '    { key: "name", label: "Name" },' +
  '    { key: "email", label: "Email" }' +
  '  ],' +
  '  data: [' +
  '    { id: 1, name: "Alice", email: "alice@example.com" },' +
  '    { id: 2, name: "Bob", email: "bob@example.com" }' +
  '  ]' +
  '});' +
  '`' + '`' + '`' +
  '' +
  '**Parameters:**' +
  '- \\`title\\` (required): Table title' +
  '- \\`columns\\` (required): Array of column definitions with \\`key\\` and \\`label\\`' +
  '- \\`data\\` (required): Array of row objects' +
  '' +
  '**Examples:**' +
  '' +
  '1. **Simple table:**' +
  '`' + '`' + '`' + 'typescript' +
  'const users = await postgresql({' +
  '  query: "SELECT * FROM users LIMIT 10",' +
  '  connectionUrl: memory.read(\'database\', \'postgresql_url\')' +
  '});' +
  '' +
  'await table.show({' +
  '  title: "User List",' +
  '  columns: [' +
  '    { key: "id", label: "ID" },' +
  '    { key: "name", label: "Name" },' +
  '    { key: "email", label: "Email" }' +
  '  ],' +
  '  data: users.data' +
  '});' +
  '`' + '`' + '`' +
  '' +
  '2. **Table from DuckDB query:**' +
  '`' + '`' + '`' + 'typescript' +
  'const sales = await duckdb({' +
  '  query: "SELECT * FROM \'sales.csv\' LIMIT 20"' +
  '});' +
  '' +
  'await table.show({' +
  '  title: "Sales Data",' +
  '  columns: Object.keys(sales.data[0]).map(key => ({ key, label: key.toUpperCase() })),' +
  '  data: sales.data' +
  '});' +
  '`' + '`' + '`' +
  '' +
  '3. **Formatted table:**' +
  '`' + '`' + '`' + 'typescript' +
  'await table.show({' +
  '  title: "Financial Summary",' +
  '  columns: [' +
  '    { key: "category", label: "Category" },' +
  '    { key: "amount", label: "Amount ($)" },' +
  '    { key: "date", label: "Date" }' +
  '  ],' +
  '  data: [' +
  '    { category: "Revenue", amount: 15000, date: "2024-01-15" },' +
  '    { category: "Expense", amount: 8500, date: "2024-01-16" }' +
  '  ]' +
  '});' +
  '`' + '`' + '`' +
  '' +
  '**Important Notes:**' +
  '- Tables render interactively in the chat interface' +
  '- Supports sorting and filtering (in the UI)' +
  '- Use after querying data with SQL tools' +
  '- Return the result directly to display the table' +
  '- Each row object must have keys matching the column keys';

/**
 * Table extension
 */
const tableExtension = {
  /**
   * Display tabular data
   *
   * Usage:
   * await table.show({
   *   title: 'Users',
   *   columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }],
   *   data: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
   * });
   */
  show: async (args: ShowTableOptions): Promise<ShowTableResult> => {
    // Return visualization metadata directly
    // ScriptRuntime will collect this into __visualizations array
    const toolCallId = `viz_table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      __visualization: {
        type: "show-table",
        toolCallId,
        args
      }
    };
  },
};

// @ts-expect-error - Extension loader wraps this code in an async function
return tableExtension.show;
