import { useState, useEffect } from "react";
import { MessageSquare, Plus, Clock, ChevronLeft, ChevronRight, Trash2, Search, MessageCircle } from "lucide-react";
import { getEmbedUserConversations, deleteEmbedConversation, type ChatHistoryMetadata } from "@/lib/embed-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLogger } from "@/hooks/use-logger";

interface EmbedConversationListProps {
  projectId: string;
  userId?: string;
  currentConvId: string;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onConversationSelect: (convId: string) => void;
  onNewChat: () => void;
}

export function EmbedConversationList({
  projectId,
  userId,
  currentConvId,
  isCollapsed,
  onCollapsedChange,
  onConversationSelect,
  onNewChat,
}: EmbedConversationListProps) {
  const log = useLogger('chat');
  const [conversations, setConversations] = useState<ChatHistoryMetadata[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<ChatHistoryMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch conversations when userId changes
  useEffect(() => {
    if (userId) {
      setIsLoading(true);
      getEmbedUserConversations(projectId, userId)
        .then((data) => {
          setConversations(data);
          setFilteredConversations(data);
        })
        .catch((error) => {
          log.error("Failed to load conversations", { error });
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [userId, projectId, log]);

  // Filter conversations based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredConversations(conversations);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredConversations(
        conversations.filter((c) => 
          (c.title || "New Conversation").toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, conversations]);

  const handleDelete = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicking the conversation item

    if (!userId) return;

    // Confirm before deleting
    if (!confirm("Are you sure you want to delete this conversation?")) {
      return;
    }

    setDeletingId(convId);

    try {
      await deleteEmbedConversation(projectId, userId, convId);

      // Remove from local state
      const updatedConversations = conversations.filter((c) => c.convId !== convId);
      setConversations(updatedConversations);
      
      // Update filtered list as well
      if (!searchQuery.trim()) {
        setFilteredConversations(updatedConversations);
      } else {
         const query = searchQuery.toLowerCase();
         setFilteredConversations(
            updatedConversations.filter((c) => 
              (c.title || "New Conversation").toLowerCase().includes(query)
            )
         );
      }

      // If deleted conversation was current, generate new conversation
      if (convId === currentConvId) {
        onNewChat();
      }
    } catch (error) {
      log.error("Failed to delete conversation", { error });
      alert("Failed to delete conversation. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (!userId) {
    return null; // Don't show list for anonymous users
  }

  return (
    <div className="fixed left-0 top-0 h-full z-50 flex font-sans">
      {/* Sidebar */}
      <div
        className={cn(
          "bg-slate-50/95 backdrop-blur-sm border-r border-slate-200 shadow-xl transition-all duration-300 ease-in-out flex flex-col",
          isCollapsed ? "w-16" : "w-80"
        )}
        style={{ height: "100vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200/60 bg-white/50">
          {!isCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="bg-primary/10 p-1.5 rounded-lg">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-base font-bold text-slate-800 truncate">Chat History</h2>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapsedChange(!isCollapsed)}
            className={cn("h-8 w-8 ml-auto text-slate-500 hover:text-slate-800", isCollapsed && "mx-auto")}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* New Chat Button & Search */}
        <div className="p-4 space-y-3">
            <Button
              onClick={() => {
                onNewChat();
                if (window.innerWidth < 768) {
                    onCollapsedChange(true);
                }
              }}
              className={cn(
                "w-full shadow-sm transition-all duration-200", 
                isCollapsed ? "h-10 w-10 p-0 rounded-xl" : "justify-start"
              )}
              title="New Chat"
            >
              <Plus className={cn("w-5 h-5", !isCollapsed && "mr-2")} />
              {!isCollapsed && <span>New Chat</span>}
            </Button>

            {!isCollapsed && (
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search chats..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
                    />
                </div>
            )}
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1 px-3">
          {isCollapsed ? (
             <div className="flex flex-col items-center gap-2 py-2">
                 {conversations.slice(0, 5).map(conv => (
                     <button
                        key={conv.convId}
                        onClick={() => onConversationSelect(conv.convId)}
                        className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 relative group",
                            conv.convId === currentConvId 
                                ? "bg-primary text-primary-foreground shadow-md" 
                                : "hover:bg-white hover:shadow-sm text-slate-500 hover:text-slate-800"
                        )}
                        title={conv.title || "Conversation"}
                     >
                         <MessageSquare className="w-5 h-5" />
                         {/* Online/Active indicator dot if current */}
                         {conv.convId === currentConvId && (
                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full translate-x-1 -translate-y-1"></span>
                         )}
                     </button>
                 ))}
                 <div className="border-t border-slate-200 w-8 my-2"></div>
                 <div className="text-[10px] text-slate-400 font-medium">{conversations.length}</div>
             </div>
          ) : (
            <div className="pb-4 space-y-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2"></div>
                    <span className="text-xs">Loading...</span>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 px-4 text-center">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">No conversations found</p>
                    {searchQuery && <p className="text-xs mt-1">Try a different search term</p>}
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.convId}
                    className={cn(
                      "group relative w-full text-left rounded-lg transition-all duration-200 border border-transparent",
                      conv.convId === currentConvId 
                        ? "bg-white border-slate-200 shadow-sm ring-1 ring-slate-200/50 z-10" 
                        : "hover:bg-white/60 hover:border-slate-100"
                    )}
                  >
                    <button
                      onClick={() => {
                        onConversationSelect(conv.convId);
                        if (window.innerWidth < 768) {
                            onCollapsedChange(true);
                        }
                      }}
                      className="w-full text-left p-3 pr-9"
                    >
                      <div className={cn(
                          "font-medium text-sm truncate mb-1 transition-colors",
                          conv.convId === currentConvId ? "text-primary" : "text-slate-700 group-hover:text-slate-900"
                      )}>
                        {conv.title || "New Conversation"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                            <Clock className="w-3 h-3" />
                            {formatTime(conv.lastUpdatedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                             <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                             {conv.messageCount} msgs
                        </span>
                      </div>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(conv.convId, e)}
                      disabled={deletingId === conv.convId}
                      className={cn(
                          "absolute right-2 top-2 p-1.5 rounded-md transition-all duration-200 opacity-0 group-hover:opacity-100",
                          "text-slate-400 hover:text-red-500 hover:bg-red-50",
                          deletingId === conv.convId && "opacity-100"
                      )}
                      title="Delete conversation"
                    >
                      {deletingId === conv.convId ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                    
                    {/* Active indicator bar */}
                    {conv.convId === currentConvId && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"></div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
        
        {/* Footer (optional info) */}
        {!isCollapsed && conversations.length > 0 && (
            <div className="p-3 border-t border-slate-200/60 bg-slate-50/50 text-center">
                <p className="text-[10px] text-slate-400">
                    {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
                </p>
            </div>
        )}
      </div>
    </div>
  );
}
