"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Chat } from "@/components/ui/chat/containers/chat";
import { TodoPanel } from "@/components/status/todo-panel";
import { CompactionStatus } from "@/components/status/compaction-status";
import { TokenStatus } from "@/components/status/token-status";
import { AlertCircle, Plus } from "lucide-react";
import { PageActionButton } from "@/components/ui/page-action-button";
import { cn } from "@/lib/utils";
import type { MainChatProps } from "./types";
import { useMainChat } from "./use-main-chat";

/**
 * Desktop-specific implementation of MainChat
 * Features:
 * - Sidebar-compatible layout with proper spacing
 * - Hover interactions
 * - Wider message containers
 * - Desktop-optimized todo panel (floating)
 * - Persistent token status
 */
export function MainChatDesktop(props: MainChatProps) {
  const {
    messages,
    input,
    isLoading,
    isHistoryLoading,
    error,
    todos,
    convId,

    wsClient,
    handleInputChange,
    handleSubmit,
    abort,
    handleNewConversation,
    setMessages,
    isEmbedMode,
    hasTodos,
  } = useMainChat(props);

  const { welcomeMessage, className } = props;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Desktop Top Bar - fixed height with proper spacing for sidebar */}
      <div className="h-14 flex items-center justify-between px-6 border-b flex-shrink-0 bg-background">
        <div className="flex items-center gap-2">
           {!isEmbedMode && (
             <SidebarTrigger />
           )}
          {!isEmbedMode && messages.length > 0 && (
            <PageActionButton
              icon={Plus}
              label="New Chat"
              onClick={handleNewConversation}
              variant="outline"
              size="sm"
              title="Start a new conversation"
            />
          )}
        </div>
        <div className={isEmbedMode ? "hidden md:block" : ""}>
          <TokenStatus convId={convId} />
        </div>
      </div>

      {/* Error Alert - desktop width constraint */}
      {error && (
        <Alert className="mx-6 mt-2 w-[650px] border-red-200 bg-red-50 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Compaction Status */}
      {messages.length > 0 && (
        <div className="mx-6 mt-2 flex-shrink-0">
          <CompactionStatus wsClient={wsClient} />
        </div>
      )}

      {/* Chat Area - fills remaining space */}
      <div className="flex-1 min-h-0 relative">
        {/* Desktop Todo Panel - floating in top-left */}
        {(hasTodos || isLoading) && (
          <div className="absolute left-4 top-4 z-10">
            <TodoPanel todos={todos} isVisible={props.isTodoPanelVisible ?? true} />
          </div>
        )}

        <Chat
          messages={messages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isGenerating={isLoading}
          isHistoryLoading={isHistoryLoading}
          stop={abort}
          setMessages={setMessages}
          className="h-full"
          welcomeMessage={welcomeMessage}
        />
      </div>
    </div>
  );
}
