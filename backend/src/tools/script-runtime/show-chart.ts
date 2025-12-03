/**
 * Context documentation for showChart functionality
 */
export const context = async () => {
  return `### SHOW CHART

Use showChart() to display interactive charts in the frontend.

**Available:** showChart({ title, description?, chartType, data })

#### PARAMETERS

- title: Chart title (required)
- description: Optional chart description
- chartType: 'bar', 'line', 'pie', 'area', etc. (required)
- data: Chart data with xAxis and series (required)
  - xAxis: Array of x-axis labels
  - series: Array of data series, each with name and data array

#### EXAMPLE

\`\`\`json
{
  "purpose": "Visualize monthly sales",
  "code": "const data = { xAxis: ['Jan', 'Feb', 'Mar'], series: [{ name: 'Sales', data: [150, 230, 224] }] }; return await showChart({ title: 'Monthly Sales', chartType: 'bar', data });"
}
\`\`\``
};

/**
 * Create a showChart function that broadcasts a tool call to the frontend
 */
export function createShowChartFunction(broadcast: (type: "tool_call" | "tool_result", data: any) => void) {
    return async (args: { title: string; description?: string; chartType: string; data: any }) => {
        const toolCallId = `call_${Date.now()}_chart`;

        // Broadcast the tool call so the frontend renders it
        broadcast("tool_call", {
            toolCallId,
            toolName: "show-chart",
            args,
            status: "call"
        });

        // Return a success message for the script
        return {
            status: "success",
            message: "Chart rendered in frontend",
            toolCallId
        };
    };
}
