"use client";

import { usePlatform } from "@/lib/platform/platform-detector";
import { MainChatDesktop } from "./main-chat.desktop";
import { MainChatMobile } from "./main-chat.mobile";
import type { MainChatProps } from "./types";

/**
 * MainChat component with platform-specific rendering
 * 
 * Automatically detects mobile vs desktop and renders
 * the appropriate implementation:
 * - Desktop: Sidebar layout, floating panels, hover interactions
 * - Mobile: Bottom sheets, touch-optimized buttons, full-screen layouts
 * 
 * @example
 * ```tsx
 * <MainChat wsUrl="wss://api.example.com/ws" />
 * ```
 */
export function MainChat(props: MainChatProps) {
  const { isMobile } = usePlatform();
  
  return isMobile 
    ? <MainChatMobile {...props} /> 
    : <MainChatDesktop {...props} />;
}

// Re-export types for consumers
export type { MainChatProps };
export type { TodoItem, TodoList, ChatState } from "./types";
