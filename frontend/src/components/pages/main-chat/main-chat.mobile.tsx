"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Chat } from "@/components/ui/chat/containers/chat";
import { TodoPanel } from "@/components/status/todo-panel";
import { CompactionStatus } from "@/components/status/compaction-status";
import { TokenStatus } from "@/components/status/token-status";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { 
  AlertCircle, 
  ListTodo, 
  ChevronDown,
  MessageSquarePlus
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MainChatProps } from "./types";
import { useMainChat } from "./use-main-chat";

/**
 * Mobile-specific implementation of MainChat
 * Features:
 * - Bottom navigation bar
 * - Sheet-based todo panel (slides up from bottom)
 * - Full-screen error alerts
 * - Touch-optimized button sizes (min 44px)
 * - Swipe-friendly message area
 * - Mobile-specific input styling
 */
export function MainChatMobile(props: MainChatProps) {
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
  const [todoSheetOpen, setTodoSheetOpen] = useState(false);


  return (
    <div className={cn("flex flex-col h-screen-mobile", className)}>
      {/* Mobile Header - compact with action buttons */}
      <div className="h-[60px] flex items-center justify-between px-4 border-b flex-shrink-0 bg-background">
        <div className="flex items-center gap-2">
          {!isEmbedMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10" // Touch-optimized size
              onClick={handleNewConversation}
              title="New chat"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
          )}
        </div>
        
        {/* Mobile Title - centered */}
        <span className="font-medium text-sm truncate max-w-[150px]">
          {messages.length === 0 ? "New Chat" : "Chat"}
        </span>

        <div className="flex items-center gap-1">
          {/* Todo Button - shows badge when active */}
          {(hasTodos || isLoading) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 relative"
              onClick={() => setTodoSheetOpen(true)}
            >
              <ListTodo className="h-5 w-5" />
              {isLoading && (
                <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full animate-pulse" />
              )}
            </Button>
          )}
          
          {/* Token Status - compact for mobile */}
          <div className={isEmbedMode ? "hidden" : ""}>
            <TokenStatus convId={convId} compact />
          </div>
        </div>
      </div>

      {/* Mobile Error Alert - full width */}
      {error && (
        <Alert className="mx-0 border-red-200 bg-red-50 flex-shrink-0 rounded-none">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <AlertDescription className="text-red-800 text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Mobile Compaction Status */}
      {messages.length > 0 && (
        <div className="px-4 mt-2 flex-shrink-0">
          <CompactionStatus wsClient={wsClient} />
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 min-h-0 relative">
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

      {/* Mobile Todo Sheet - slides up from bottom */}
      <Sheet open={todoSheetOpen} onOpenChange={setTodoSheetOpen}>
        <SheetContent side="bottom" className="h-[70vh] sm:max-w-none">
          <SheetHeader className="flex flex-row items-center justify-between border-b pb-4">
            <SheetTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Tasks & Status
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setTodoSheetOpen(false)}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto h-[calc(70vh-80px)]">
            <TodoPanel 
              todos={todos} 
              isVisible={true}
              variant="mobile"
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
