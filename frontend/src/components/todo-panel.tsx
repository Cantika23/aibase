"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface TodoPanelProps {
  todos: TodoList | null;
  isLoading?: boolean;
}

export function TodoPanel({ todos, isLoading = false }: TodoPanelProps) {
  if (isLoading) {
    return (
      <div className="w-80 h-full">
        <div>
          <h2 className="text-lg font-semibold">Tasks</h2>
        </div>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!todos || todos.items.length === 0) {
    return (
      <div className="w-80 h-full">
        <div>
          <h2 className="text-lg font-semibold">Tasks</h2>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">No tasks yet</p>
        </div>
      </div>
    );
  }

  const total = todos.items.length;
  const completed = todos.items.filter((item) => item.checked).length;
  const pending = total - completed;

  return (
    <div className="w-80 h-full flex flex-col">
      <div className="pb-3">
        <h2 className="text-lg font-semibold">Tasks</h2>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{pending} pending</span>
          <span>{completed} completed</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full px-6 pb-6">
          <ul className="space-y-2">
            {todos.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 py-2 border-b last:border-0"
              >
                {item.checked ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                )}
                <span
                  className={`text-sm flex-1 ${
                    item.checked
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>
    </div>
  );
}
