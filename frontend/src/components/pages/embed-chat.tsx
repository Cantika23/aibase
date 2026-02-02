/**
 * Public Embed Chat Page
 * Displays the chat interface for public embedding
 * No authentication required
 */

import { MainChat } from "./main-chat";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getEmbedInfo } from "@/lib/embed-api";
import { buildWsUrl } from "@/lib/base-path";
import { useEmbedConvId } from "@/lib/embed-conv-id";
import { useChatStore } from "@/stores/chat-store";
import { EmbedConversationList } from "@/components/ui/embed-conversation-list";
import { useLogger } from "@/hooks/use-logger";

export function EmbedChatPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const embedToken = searchParams.get("embedToken");
  const uid = searchParams.get("uid") || undefined;
  const log = useLogger('chat');

  const [embedInfo, setEmbedInfo] = useState<{
    customCss: string | null;
    welcomeMessage: string | null;
    useClientUid: boolean;
    showHistory: boolean;
  }>({ customCss: null, welcomeMessage: null, useClientUid: false, showHistory: true });
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Use embed-specific conversation ID management (URL hash based)
  const { convId, generateNewConvId, ensureHashUpdated } = useEmbedConvId();

  // Get messages from chat store to detect when first message is sent
  const messages = useChatStore((state) => state.messages);

  // Update URL hash with conversation ID after first message
  useEffect(() => {
    // Only update hash after the first user message is sent
    if (messages.length > 0) {
      ensureHashUpdated();
    }
  }, [messages.length, ensureHashUpdated]);

  // Validate embed parameters and fetch custom CSS
  useEffect(() => {
    const validate = async () => {
      if (!projectId || !embedToken) {
        setError(
          "Invalid embed configuration: missing projectId or embedToken"
        );
        setIsValidating(false);
        return;
      }

      try {
        // Validate embed token and get embed info (including custom CSS and welcome message)
        const info = await getEmbedInfo(projectId, embedToken);
        setEmbedInfo({
          customCss: info.customCss,
          welcomeMessage: info.welcomeMessage,
          useClientUid: info.useClientUid,
          showHistory: info.showHistory,
        });
        setIsValidating(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to validate embed configuration"
        );
        setIsValidating(false);
      }
    };

    validate();
  }, [projectId, embedToken]);

  // Inject custom CSS
  useEffect(() => {
    if (!embedInfo.customCss) return;

    try {
      // Basic sanitization: remove script tags and javascript: URLs
      const sanitizedCss = embedInfo.customCss
        .replace(/<script[^>]*>.*?<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "");

      // Limit CSS size to 10KB
      if (sanitizedCss.length > 10240) {
        log.warn("Custom CSS exceeds 10KB limit, truncating");
        return;
      }

      const style = document.createElement("style");
      style.textContent = sanitizedCss;
      style.setAttribute("data-embed-custom-css", "true");
      document.head.appendChild(style);

      return () => {
        // Clean up on unmount
        const styles = document.querySelectorAll(
          '[data-embed-custom-css="true"]'
        );
        styles.forEach((s) => s.remove());
      };
    } catch (error) {
      log.error("Failed to inject custom CSS", { error: String(error) });
    }
  }, [embedInfo.customCss, log]);

  // Build public WebSocket URL
  // Include uid parameter if present so backend can use it as CURRENT_UID
  // Also include ALL other URL parameters for context replacement (e.g., ?hewan=burung)
  const uidParam = uid ? `&uid=${encodeURIComponent(uid)}` : "";

  // Extract custom URL parameters (excluding system params) for context replacement
  const systemParams = ["projectId", "embedToken", "uid"];
  const customParams = Array.from(searchParams.entries())
    .filter(([key]) => !systemParams.includes(key))
    .map(
      ([key, value]) =>
        `&${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("");

  const wsUrl =
    typeof window !== "undefined" && projectId && embedToken
      ? buildWsUrl(
          `/api/embed/ws?projectId=${encodeURIComponent(projectId)}&embedToken=${encodeURIComponent(embedToken)}${uidParam}${customParams}`
        )
      : "";

  if (isValidating) {
    return (
      <div className="flex h-screen-mobile w-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen-mobile w-screen items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="rounded-lg bg-red-50 p-4 mb-4">
            <h2 className="text-lg font-semibold text-red-900 mb-2">
              Embed Configuration Error
            </h2>
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Please check your embed code and try again. If the problem persists,
            contact the website administrator.
          </p>
        </div>
      </div>
    );
  }

  // If uid is present AND enabled in config, use it for user identification
  // BUT always use the hash-based convId for conversation tracking
  // This allows users to have multiple conversations (each with its own hash)
  const effectiveUid = embedInfo.useClientUid ? uid : undefined;
  // ALWAYS use hash-based convId - never override it!
  // The convId from hash represents the specific conversation

  return (
    <div className="h-screen-mobile w-screen embed-mode">
      {/* Conversation list - only show for authenticated users AND if showHistory is enabled */}
      {effectiveUid && embedInfo.showHistory && (
        <EmbedConversationList
          projectId={projectId!}
          userId={effectiveUid}
          currentConvId={convId}
          isCollapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
          onConversationSelect={(newConvId) => {
            // Update URL hash to trigger conversation switch
            window.location.hash = newConvId;
            // Force reload to load new conversation
            window.location.reload();
          }}
          onNewChat={() => {
            generateNewConvId();
          }}
        />
      )}

      {/* Main Chat Area - Add margin for sidebar only if it's visible */}
      <div className={effectiveUid && embedInfo.showHistory ? (isSidebarCollapsed ? "ml-16" : "ml-80") : ""}>
        <MainChat
          wsUrl={wsUrl}
          className="embed-chat"
          isTodoPanelVisible={false}
          isEmbedMode={true}
        welcomeMessage={embedInfo.welcomeMessage}
        // Always pass the hash-based convId for conversation tracking
        embedConvId={convId}
        embedGenerateNewConvId={generateNewConvId}
        uid={effectiveUid}
        embedToken={embedToken || undefined}
        projectId={projectId || undefined}
      />
      </div>
    </div>
  );
}
