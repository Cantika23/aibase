import * as fs from "fs/promises";
import * as path from "path";

interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TodoList {
  items: TodoItem[];
  updatedAt: string;
}

/**
 * Get the path to the todos file
 */
function getTodosFilePath(convId: string, projectId: string): string {
  return path.join(
    process.cwd(),
    "data",
    projectId,
    convId,
    "todos.json"
  );
}

/**
 * Load todos from file
 */
async function loadTodos(convId: string, projectId: string): Promise<TodoList | null> {
  const todosPath = getTodosFilePath(convId, projectId);

  try {
    const content = await fs.readFile(todosPath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    // File doesn't exist or is invalid
    return null;
  }
}

/**
 * Format todos for context
 */
function formatTodosForContext(todoList: TodoList): string {
  const total = todoList.items.length;
  const completed = todoList.items.filter((item) => item.checked).length;
  const pending = total - completed;

  let context = `\n\nCurrent TODO list (${pending} pending, ${completed} completed):`;

  if (todoList.items.length === 0) {
    context += "\n- No todos yet";
  } else {
    context += "\n" + todoList.items.map((item) =>
      `- [${item.checked ? 'x' : ' '}] ${item.text} (id: ${item.id})`
    ).join("\n");
  }

  return context;
}

/**
 * Get default context with existing todos appended
 */
export const defaultContext = async (convId: string = "default", projectId: string = "default"): Promise<string> => {
  let context = `use todo tool to track step/phases/stages/parts etc.`;

  // Try to load existing todos
  const todoList = await loadTodos(convId, projectId);

  if (todoList && todoList.items.length > 0) {
    context += formatTodosForContext(todoList);
  }

  return context;
};
