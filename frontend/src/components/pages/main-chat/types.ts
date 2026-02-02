import type { Message } from "@/components/ui/chat";

/**
 * Props for the MainChat component
 * Shared between desktop and mobile implementations
 */
export interface MainChatProps {
  /** WebSocket URL for connection */
  wsUrl: string;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show the todo panel */
  isTodoPanelVisible?: boolean;
  /** Whether running in embed mode */
  isEmbedMode?: boolean;
  /** Custom welcome message */
  welcomeMessage?: string | null;
  /** Conversation ID for embed mode */
  embedConvId?: string;
  /** Function to generate new conversation ID in embed mode */
  embedGenerateNewConvId?: () => string;
  /** User ID for embed mode */
  uid?: string;
  /** Embed token for authentication */
  embedToken?: string;
  /** Project ID override */
  projectId?: string;
}

/**
 * Todo item structure
 */
export interface TodoItem {
  id: string;
  content: string;
  completed: boolean;
  createdAt: number;
}

/**
 * Todo list structure
 */
export interface TodoList {
  items: TodoItem[];
}

/**
 * Chat state used by both implementations
 */
export interface ChatState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  isHistoryLoading: boolean;
  error: string | null;
  todos: TodoList | null;
}

/**
 * Refs used for message streaming
 */
export interface StreamingRefs {
  currentMessageRef: React.MutableRefObject<string | null>;
  currentMessageIdRef: React.MutableRefObject<string | null>;
  currentToolInvocationsRef: React.MutableRefObject<Map<string, any>>;
  currentPartsRef: React.MutableRefObject<any[]>;
  thinkingStartTimeRef: React.MutableRefObject<number | null>;
  componentRef: React.MutableRefObject<{}>;
}
