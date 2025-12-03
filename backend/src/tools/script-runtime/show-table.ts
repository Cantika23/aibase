/**
 * Context documentation for showTable functionality
 */
export const context = async () => {
  return `### SHOW TABLE

Use showTable() to display interactive tables in the frontend.

**Available:** showTable({ title, description?, columns, data })

#### PARAMETERS

- title: Table title (required)
- description: Optional table description
- columns: Array of column definitions (required)
  - Each column has: key (string), label (string)
- data: Array of data objects (required)
  - Each object's keys should match column keys

#### EXAMPLE

\`\`\`json
{
  "purpose": "Display user list",
  "code": "const columns = [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }]; const data = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]; return await showTable({ title: 'Users', columns, data });"
}
\`\`\``
};

/**
 * Create a showTable function that broadcasts a tool call to the frontend
 */
export function createShowTableFunction(broadcast: (type: "tool_call" | "tool_result", data: any) => void) {
    return async (args: { title: string; description?: string; columns: any[]; data: any[] }) => {
        const toolCallId = `call_${Date.now()}_table`;

        // Broadcast the tool call so the frontend renders it
        broadcast("tool_call", {
            toolCallId,
            toolName: "show-table",
            args,
            status: "call"
        });

        // Return a success message for the script
        return {
            status: "success",
            message: "Table rendered in frontend",
            toolCallId
        };
    };
}
