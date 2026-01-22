/**
 * Show Table Extension
 * Display tabular data in the frontend
 */

/**
 * Show table extension
 */
export default {
  /**
   * Display tabular data
   *
   * Usage:
   * await showTable({
   *   title: 'Users',
   *   columns: [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }],
   *   data: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
   * });
   */
  showTable: async (args: {
    title: string;
    description?: string;
    columns: Array<{ key: string; label: string }>;
    data: any[];
    saveTo?: string;
  }) {
    const toolCallId = `call_${Date.now()}_table`;

    return {
      __visualization: {
        type: "show-table",
        toolCallId,
        args
      }
    };
  },
};
