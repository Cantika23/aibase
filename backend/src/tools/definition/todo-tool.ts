import { Tool } from "../../llm/conversation";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Todo Tool - Built-in todo list management
 * Actions: list, add, check, uncheck, remove, clear, finish
 * Todos are stored per conversation in /data/{proj-id}/{conv-id}/todos.json
 */

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

export class TodoTool extends Tool {
  name = "todo";
  description = "Manage todo items: add new tasks, list all tasks, check/uncheck items, remove items, clear all, or finish (remove completed items). All todos are stored per conversation.";
  parameters = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "add", "check", "uncheck", "remove", "clear", "finish"],
        description: "The action to perform",
      },
      text: {
        type: "string",
        description: "Todo text (required for add action)",
      },
      id: {
        type: "string",
        description: "Todo ID (required for check, uncheck, remove actions)",
      },
    },
    required: ["action"],
  };

  private convId: string = "default";
  private projectId: string = "default";

  /**
   * Set the conversation ID for this tool instance
   */
  setConvId(convId: string): void {
    this.convId = convId;
  }

  /**
   * Set the project ID for this tool instance
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Get the path to the todos file
   */
  private getTodosFilePath(): string {
    return path.join(
      process.cwd(),
      "data",
      this.projectId,
      this.convId,
      "todos.json"
    );
  }

  /**
   * Get the directory containing the todos file
   */
  private getTodosDir(): string {
    return path.join(process.cwd(), "data", this.projectId, this.convId);
  }

  /**
   * Load todos from file
   */
  private async loadTodos(): Promise<TodoList> {
    const todosPath = this.getTodosFilePath();
    const todosDir = this.getTodosDir();

    // Ensure directory exists
    await fs.mkdir(todosDir, { recursive: true });

    try {
      const content = await fs.readFile(todosPath, "utf-8");
      return JSON.parse(content);
    } catch (error: any) {
      // File doesn't exist or is invalid, return empty list
      return {
        items: [],
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Save todos to file
   */
  private async saveTodos(todoList: TodoList): Promise<void> {
    const todosPath = this.getTodosFilePath();
    todoList.updatedAt = new Date().toISOString();
    await fs.writeFile(todosPath, JSON.stringify(todoList, null, 2), "utf-8");
  }

  /**
   * Format the todo list for display
   */
  private formatTodoList(todoList: TodoList): string {
    const total = todoList.items.length;
    const completed = todoList.items.filter((item) => item.checked).length;
    const pending = total - completed;

    return JSON.stringify(
      {
        summary: {
          total,
          completed,
          pending,
        },
        items: todoList.items.map((item) => ({
          id: item.id,
          text: item.text,
          checked: item.checked,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        updatedAt: todoList.updatedAt,
      },
      null,
      2
    );
  }

  /**
   * Generate a unique ID for a todo item
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async execute(args: {
    action: "list" | "add" | "check" | "uncheck" | "remove" | "clear" | "finish";
    text?: string;
    id?: string;
  }): Promise<string> {
    try {
      const todoList = await this.loadTodos();

      switch (args.action) {
        case "list":
          return this.formatTodoList(todoList);

        case "add":
          if (!args.text) {
            throw new Error("text is required for add action");
          }
          const newItem: TodoItem = {
            id: this.generateId(),
            text: args.text,
            checked: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          todoList.items.push(newItem);
          await this.saveTodos(todoList);
          return this.formatTodoList(todoList);

        case "check":
          if (!args.id) {
            throw new Error("id is required for check action");
          }
          const itemToCheck = todoList.items.find((item) => item.id === args.id);
          if (!itemToCheck) {
            throw new Error(`Todo item not found: ${args.id}`);
          }
          itemToCheck.checked = true;
          itemToCheck.updatedAt = new Date().toISOString();
          await this.saveTodos(todoList);
          return this.formatTodoList(todoList);

        case "uncheck":
          if (!args.id) {
            throw new Error("id is required for uncheck action");
          }
          const itemToUncheck = todoList.items.find(
            (item) => item.id === args.id
          );
          if (!itemToUncheck) {
            throw new Error(`Todo item not found: ${args.id}`);
          }
          itemToUncheck.checked = false;
          itemToUncheck.updatedAt = new Date().toISOString();
          await this.saveTodos(todoList);
          return this.formatTodoList(todoList);

        case "remove":
          if (!args.id) {
            throw new Error("id is required for remove action");
          }
          const indexToRemove = todoList.items.findIndex(
            (item) => item.id === args.id
          );
          if (indexToRemove === -1) {
            throw new Error(`Todo item not found: ${args.id}`);
          }
          todoList.items.splice(indexToRemove, 1);
          await this.saveTodos(todoList);
          return this.formatTodoList(todoList);

        case "clear":
          todoList.items = [];
          await this.saveTodos(todoList);
          return this.formatTodoList(todoList);

        case "finish":
          const beforeCount = todoList.items.length;
          todoList.items = todoList.items.filter((item) => !item.checked);
          const removedCount = beforeCount - todoList.items.length;
          await this.saveTodos(todoList);
          const result = JSON.parse(this.formatTodoList(todoList));
          result.finishResult = {
            removedCount,
            message: `Removed ${removedCount} completed item(s)`,
          };
          return JSON.stringify(result, null, 2);

        default:
          throw new Error(`Unknown action: ${args.action}`);
      }
    } catch (error: any) {
      throw new Error(`Todo operation failed: ${error.message}`);
    }
  }
}
