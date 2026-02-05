"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { ConversationWithTitle } from "@/lib/conversation-api";

import {
  Card,
  // CardDescription, // Unused in new layout but keep if needed
  // CardHeader,      // Unused in new layout
  // CardTitle,       // Unused in new layout
} from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  PageActionButton,
  // PageActionGroup,
} from "@/components/ui/page-action-button";
import { Button } from "@/components/ui/button";
import { useConvId } from "@/lib/conv-id";
import { formatRelativeTime } from "@/lib/time-utils";
import { useChatStore } from "@/stores/chat-store";
import { useConversationStore } from "@/stores/conversation-store";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  fetchConversationFiles,
  formatFileSize,
  getFileIcon,
  type FileInfo,
} from "@/lib/files-api";
import { regenerateConversationTitle } from "@/lib/conversation-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw } from "lucide-react";
import { useLogger } from "@/hooks/use-logger";

// Helper to check dates
const isToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
};

const isYesterday = (date: Date) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
};

export function ConversationHistoryPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { conversations, isLoading, loadConversations, removeConversation } =
    useConversationStore();
  const log = useLogger('chat');

  const { clearMessages } = useChatStore();
  const { setConvId, clearConvId } = useConvId();
  const [deletingConversation, setDeletingConversation] = useState<{
    convId: string;
    title: string;
    files: FileInfo[];
  } | null>(null);
  const [regeneratingTitleId, setRegeneratingTitleId] = useState<string | null>(null);

  useEffect(() => {
    // Load conversations when component mounts
    if (projectId) {
      loadConversations(projectId);
    }
  }, [projectId, loadConversations]);

  const handleSelectConversation = async (convId: string) => {
    if (!projectId) return;
    setConvId(convId);
    clearMessages();
    navigate(`/projects/${projectId}/chat`);
  };

  const handleNewConversation = () => {
    if (!projectId) return;
    clearConvId();
    clearMessages();
    navigate(`/projects/${projectId}/chat`);
  };

  const handleDeleteConversation = async (
    e: React.MouseEvent,
    convId: string,
    title: string
  ) => {
    e.stopPropagation();
    if (!projectId) return;

    try {
      const files = await fetchConversationFiles(convId, projectId);
      setDeletingConversation({ convId, title, files });
    } catch (error) {
      log.error("Error loading files", { error: String(error) });
      setDeletingConversation({ convId, title, files: [] });
    }
  };

  const confirmDelete = async () => {
    if (!deletingConversation || !projectId) return;
    const success = await removeConversation(deletingConversation.convId, projectId);
    if (success) {
      toast.success("Conversation deleted successfully");
      setDeletingConversation(null);
    }
  };

  const handleRegenerateTitle = async (
    e: React.MouseEvent,
    convId: string,
    _currentTitle: string
  ) => {
    e.stopPropagation();
    if (!projectId) return;
    setRegeneratingTitleId(convId);
    try {
      await regenerateConversationTitle(convId, projectId);
      toast.success("Title regenerated successfully");
      await loadConversations(projectId);
    } catch (error) {
      log.error("Error regenerating title", { error: String(error) });
      toast.error(error instanceof Error ? error.message : "Failed to regenerate title");
    } finally {
      setRegeneratingTitleId(null);
    }
  };

  // Group conversations by time period
  const groupedConversations = (() => {
    const groups: Record<string, ConversationWithTitle[]> = {
      "Today": [],
      "Yesterday": [],
      "Previous 7 Days": [],
      "Older": []
    };

    conversations.forEach(conv => {
      const date = new Date(conv.lastUpdatedAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      if (isToday(date)) {
        groups["Today"].push(conv);
      } else if (isYesterday(date)) {
        groups["Yesterday"].push(conv);
      } else if (diffDays <= 7) {
        groups["Previous 7 Days"].push(conv);
      } else {
        groups["Older"].push(conv);
      }
    });

    return groups;
  })();

  const renderConversationCard = (conversation: ConversationWithTitle) => (
    <Card
      key={conversation.convId}
      className="cursor-pointer transition-all hover:bg-accent/50 hover:shadow-sm border-transparent hover:border-border group pt-3 pb-3 bg-card/50"
      onClick={() => handleSelectConversation(conversation.convId)}
    >
      <div className="px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex size-9 rounded-full bg-primary/10 items-center justify-center shrink-0">
            <MessageSquare className="size-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-none truncate mb-1">
              {conversation.title}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {formatRelativeTime(conversation.lastUpdatedAt)}
              </span>
              <span>•</span>
              <span>{conversation.messageCount} msgs</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={(e) =>
              handleRegenerateTitle(
                e,
                conversation.convId,
                conversation.title
              )
            }
            disabled={regeneratingTitleId === conversation.convId}
            title="Regenerate title"
          >
            <RefreshCw className={`size-3.5 text-muted-foreground ${regeneratingTitleId === conversation.convId ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) =>
              handleDeleteConversation(
                e,
                conversation.convId,
                conversation.title
              )
            }
            title="Delete conversation"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingConversation} onOpenChange={(open) => !open && setDeletingConversation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription className="space-y-3 text-left">
              <p>
                Are you sure you want to delete "{deletingConversation?.title}"?
              </p>
              <p className="text-sm">
                This will permanently delete all messages
                {deletingConversation?.files && deletingConversation.files.length > 0 && (
                  <> and {deletingConversation.files.length} {deletingConversation.files.length === 1 ? "file" : "files"}</>
                )}.
              </p>
              {deletingConversation?.files && deletingConversation.files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-foreground">Files to be deleted:</p>
                  <div className="max-h-40 overflow-auto space-y-1 border rounded-md p-2 bg-muted/30">
                    {deletingConversation.files.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <span className="text-lg">{getFileIcon(file.name)}</span>
                        <span className="flex-1 truncate text-foreground">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingConversation(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticky Header */}
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between px-6 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">History</h1>
          </div>
        </div>
        <PageActionButton
          icon={Plus}
          label="New Chat"
          onClick={handleNewConversation}
          variant="default"
          size="sm"
          className="shadow-sm"
        />
      </div>

      <div className="w-full max-w-4xl mx-auto px-6 py-8 flex-1">
        {isLoading && conversations.length === 0 ? (
           <div className="space-y-8">
             <div className="space-y-4">
               <Skeleton className="h-5 w-32" />
               <div className="space-y-3">
                 {[1, 2, 3].map((i) => (
                   <div key={i} className="flex items-center gap-4 p-4 border rounded-lg bg-card/50">
                     <Skeleton className="size-10 rounded-full" />
                     <div className="space-y-2 flex-1">
                       <Skeleton className="h-4 w-3/4" />
                       <Skeleton className="h-3 w-1/4" />
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </div>
        ) : conversations.length > 0 ? (
          <div className="space-y-8 pb-10">
            {Object.entries(groupedConversations).map(([groupName, groupConvs]) => {
              if (groupConvs.length === 0) return null;
              return (
                <div key={groupName} className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground sticky top-22 bg-background/95 backdrop-blur py-2 z-10 w-fit px-2 rounded-md">
                    {groupName}
                  </h3>
                  <div className="grid gap-2">
                    {groupConvs.map(renderConversationCard)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in-50">
            <div className="size-20 rounded-full bg-muted/50 flex items-center justify-center">
              <MessageSquare className="size-10 text-muted-foreground/50" />
            </div>
            <div className="space-y-2 max-w-sm">
              <h3 className="text-lg font-semibold">No conversations</h3>
              <p className="text-muted-foreground">
                Your chat history will appear here. Start a new conversation to get begun.
              </p>
              <Button onClick={handleNewConversation} className="mt-4">
                Start Chatting
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
