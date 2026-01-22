/**
 * Show Chart Extension
 * Display interactive charts in the frontend
 */

/**
 * Show chart extension
 */
export default {
  /**
   * Display interactive chart
   *
   * Usage:
   * await showChart({
   *   title: 'Monthly Sales',
   *   chartType: 'bar',
   *   data: {
   *     xAxis: ['Jan', 'Feb', 'Mar'],
   *     series: [{ name: 'Sales', data: [150, 230, 224] }]
   *   }
   * });
   */
  showChart: async (args: {
    title: string;
    description?: string;
    chartType: string;
    data: { xAxis: string[]; series: Array<{ name: string; data: number[] }> };
    saveTo?: string;
  }) {
    const toolCallId = `call_${Date.now()}_chart`;

    return {
      __visualization: {
        type: "show-chart",
        toolCallId,
        args
      }
    };
  },
};
