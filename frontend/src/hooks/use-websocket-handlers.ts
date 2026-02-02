import { useEffect } from "react";
import { flushSync } from "react-dom";
import type { Message } from "@/components/ui/chat";
import { activeTabManager } from "@/lib/ws/active-tab-manager";
import type { WSClient } from "@/lib/ws/ws-connection-manager";
import { useChatStore } from "@/stores/chat-store";
import { useConversationStore } from "@/stores/conversation-store";
import { useFileStore } from "@/stores/file-store";
import { useFileContextStore } from "@/stores/file-context-store";
import { useProjectStore } from "@/stores/project-store";
import { useAuthStore } from "@/stores/auth-store";
import { useLogger } from "@/hooks/use-logger";

interface UseWebSocketHandlersProps {
  wsClient: WSClient | null;
  convId: string;
  componentRef: React.MutableRefObject<{}>;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  setIsLoading: (loading: boolean) => void;
  setIsHistoryLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTodos: (todos: any) => void;
  setMaxTokens: (maxTokens: number | null) => void;
  setTokenUsage: (tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number; messageCount: number } | null) => void;
  isLoading: boolean;
  thinkingStartTimeRef: React.MutableRefObject<number | null>;
  currentMessageRef: React.MutableRefObject<string | null>;
  currentMessageIdRef: React.MutableRefObject<string | null>;
  currentToolInvocationsRef: React.MutableRefObject<Map<string, any>>;
  currentPartsRef: React.MutableRefObject<any[]>;
}

export function useWebSocketHandlers({
  wsClient,
  convId,
  componentRef,
  setMessages,
  setIsLoading,
  setIsHistoryLoading,
  setError,
  setTodos,
  setMaxTokens,
  setTokenUsage,
  isLoading,
  thinkingStartTimeRef,
  currentMessageRef,
  currentMessageIdRef,
  currentToolInvocationsRef,
  currentPartsRef,
}: UseWebSocketHandlersProps) {
  const log = useLogger('websocket');
  
  // Get conversation store and project store for title updates
  const { refreshConversations } = useConversationStore();
  const { currentProject } = useProjectStore();

  useEffect(() => {
    if (!wsClient) return;

    log.debug("[Setup] Registering event handlers", { convId });

    // Register this tab as active for this conversation
    activeTabManager.registerTab(componentRef.current, convId);

    // Set up event handlers
    const handleConnected = () => {
      // Only active tab handles connection events
      if (!activeTabManager.isActiveTab(componentRef.current, convId)) return;
      setError(null);
      // Set history loading state to true when requesting history
      setIsHistoryLoading(true);
      // Request message history from server when connected
      wsClient.getHistory();
      // Request file context from server when connected
      wsClient.getFileContext();
    };

    const handleDisconnected = () => {
      setIsLoading(false);
    };

    const handleReconnecting = (data: { attempt: number; maxAttempts: number }) => {
      setError(`Connection lost. Reconnecting (attempt ${data.attempt}/${data.maxAttempts})...`);
    };

    const handleError = (error: Error) => {
      setError(error.message);
      setIsLoading(false);
    };

    const handleLLMChunk = (data: {
      chunk: string;
      messageId?: string;
      sequence?: number;
      isAccumulated?: boolean;
      startTime?: number;
    }) => {
      // Only active tab processes chunks
      if (!activeTabManager.isActiveTab(componentRef.current, convId)) return;
      log.trace("handleLLMChunk called", { messageId: data.messageId, chunkLength: data.chunk?.length });

      // Store start time from server in ref for interval calculation
      if (data.startTime && thinkingStartTimeRef.current === null) {
        thinkingStartTimeRef.current = data.startTime;
        log.debug("[ThinkingTime] Stored startTime from server", { startTime: data.startTime });
      }

      // Don't process null/undefined chunks, but DO process empty string and whitespace chunks
      // Empty accumulated chunks are sent to provide startTime for thinking indicator
      if (data.chunk === null || data.chunk === undefined) {
        log.trace("Skipping null/undefined chunk");
        return;
      }

      const messageId = data.messageId || `msg_${Date.now()}_assistant`;

      // If we have a currentMessageIdRef and this chunk is for a different message, ignore it
      // This prevents processing chunks from aborted requests
      if (
        currentMessageIdRef.current &&
        currentMessageIdRef.current !== messageId &&
        !data.isAccumulated
      ) {
        log.trace("[Chunk] Ignoring chunk from old message", { messageId, current: currentMessageIdRef.current });
        return;
      }

      // Set the current message ID if not set (for first chunk)
      if (!currentMessageIdRef.current && !data.isAccumulated) {
        currentMessageIdRef.current = messageId;
        log.debug("[Chunk] Set current message ID", { messageId });
      }

      // Set loading state when chunks arrive (for thinking indicator)
      if (!isLoading && !data.isAccumulated) {
        setIsLoading(true);
      }

      flushSync(() => {
        setMessages((prevMessages) => {
          // Separate thinking indicator from other messages
          let thinkingMsg = prevMessages.find((m) => m.isThinking);
          const otherMessages = prevMessages.filter((m) => !m.isThinking);

          // If we don't have a thinking indicator yet, create one
          // This happens after page refresh when streaming is still active
          if (!thinkingMsg) {
            log.trace("[Chunk] Creating thinking indicator (no existing one found)");
            thinkingMsg = {
              id: `thinking_${Date.now()}`,
              role: "assistant",
              content: "Thinking...",
              createdAt: new Date(),
              isThinking: true,
            };
          }

          log.trace("[Chunk] Processing", { 
            hasThinkingMsg: !!thinkingMsg, 
            prevCount: prevMessages.length, 
            otherCount: otherMessages.length, 
            isAccumulated: data.isAccumulated 
          });

          const prev = otherMessages;

          if (data.isAccumulated) {
            // Accumulated chunks on reconnect
            log.debug("[Chunk-Accumulated] Received", { 
              chunkLength: data.chunk.length, 
              messageId 
            });

            // First, try to find message by ID
            let existingIndex = prev.findIndex((m) => m.id === messageId);

            // If not found by ID, look for the last empty assistant message (from history)
            if (existingIndex === -1) {
              log.trace("[Chunk-Accumulated] Message ID not found, looking for empty assistant message", { messageId });
              existingIndex = prev.findIndex(
                (m) =>
                  m.role === "assistant" &&
                  (!m.content || m.content.trim() === "")
              );
              if (existingIndex !== -1) {
                log.debug("[Chunk-Accumulated] Found empty assistant message", { 
                  index: existingIndex, 
                  newMessageId: messageId 
                });
              }
            }

            log.trace("[Chunk-Accumulated] Final message index", { existingIndex });

            if (existingIndex !== -1) {
              // Update existing message with accumulated content and correct ID
              log.debug("[Chunk-Accumulated] Updating message", { 
                index: existingIndex, 
                contentLength: data.chunk.length 
              });
              const toolInvocations =
                currentToolInvocationsRef.current.size > 0
                  ? Array.from(currentToolInvocationsRef.current.values())
                  : undefined;
              const updatedMessages = prev.map((msg, idx) =>
                idx === existingIndex
                  ? {
                    ...msg,
                    id: messageId,
                    content: data.chunk,
                    ...(toolInvocations && { toolInvocations }),
                  }
                  : msg
              );

              // Store in refs for completion handler
              currentMessageIdRef.current = messageId;
              currentMessageRef.current = data.chunk;

              log.trace("[Chunk-Accumulated] Returning messages", { count: updatedMessages.length });
              // Don't add thinking indicator when we're actively updating the assistant message
              return updatedMessages;
            } else {
              // Create new message with accumulated content
              log.debug("[Chunk-Accumulated] Creating new message", { 
                messageId, 
                contentLength: data.chunk.length 
              });
              const toolInvocations =
                currentToolInvocationsRef.current.size > 0
                  ? Array.from(currentToolInvocationsRef.current.values())
                  : undefined;
              const newMessage: Message = {
                id: messageId,
                role: "assistant",
                content: data.chunk,
                createdAt: new Date(),
                ...(toolInvocations && { toolInvocations }),
              };

              // Store in refs for completion handler
              currentMessageIdRef.current = messageId;
              currentMessageRef.current = data.chunk;

              log.trace("[Chunk-Accumulated] Returning messages (added new)", { count: prev.length + 1 });
              // Don't add thinking indicator when we're actively creating the assistant message
              return [...prev, newMessage];
            }
          } else {
            // Real-time chunk - check if message already exists in array
            const existingIndex = prev.findIndex((m) => m.id === messageId);
            log.trace("[Chunk] Searching for message", { messageId, existingIndex, prevLength: prev.length });

            if (existingIndex === -1) {
              // Create new message
              log.debug("[Chunk] Creating new message", { 
                messageId, 
                chunkPreview: data.chunk.substring(0, 20) 
              });

              // Add chunk to parts array in arrival order (create new array for React)
              const lastPart = currentPartsRef.current[currentPartsRef.current.length - 1];
              if (lastPart && lastPart.type === "text") {
                // Append to existing text part - create new array with updated part
                currentPartsRef.current = [
                  ...currentPartsRef.current.slice(0, -1),
                  { ...lastPart, text: lastPart.text + data.chunk }
                ];
              } else {
                // Create new text part - create new array
                currentPartsRef.current = [
                  ...currentPartsRef.current,
                  {
                    type: "text",
                    text: data.chunk,
                  }
                ];
              }

              const toolInvocations =
                currentToolInvocationsRef.current.size > 0
                  ? Array.from(currentToolInvocationsRef.current.values())
                  : undefined;

              const parts = currentPartsRef.current.length > 0
                ? [...currentPartsRef.current]
                : undefined;

              const newMessage: Message = {
                id: messageId,
                role: "assistant",
                content: data.chunk,
                createdAt: new Date(),
                ...(toolInvocations && { toolInvocations }),
                ...(parts && { parts }),
              };

              // Store in refs
              currentMessageIdRef.current = messageId;
              currentMessageRef.current = data.chunk;

              const newArray = [...prev, newMessage];
              log.trace("[Chunk] Returning new array", { count: newArray.length });
              // Don't add thinking indicator when we're actively creating/updating the assistant message
              return newArray;
            } else {
              // Append to existing message
              const existingMessage = prev[existingIndex];
              log.trace("[Chunk] Found existing message", { 
                index: existingIndex, 
                currentLength: existingMessage.content.length 
              });
              const newContent = existingMessage.content + data.chunk;

              // Add chunk to parts array in arrival order (create new array for React)
              const lastPart = currentPartsRef.current[currentPartsRef.current.length - 1];
              if (lastPart && lastPart.type === "text") {
                // Append to existing text part - create new array with updated part
                currentPartsRef.current = [
                  ...currentPartsRef.current.slice(0, -1),
                  { ...lastPart, text: lastPart.text + data.chunk }
                ];
              } else {
                // Create new text part - create new array
                currentPartsRef.current = [
                  ...currentPartsRef.current,
                  {
                    type: "text",
                    text: data.chunk,
                  }
                ];
              }

              // Update refs
              currentMessageIdRef.current = messageId;
              currentMessageRef.current = newContent;

              log.trace("[Chunk] Appending", { 
                chunkPreview: data.chunk.substring(0, 20),
                chunkSize: data.chunk.length,
                totalSize: newContent.length
              });

              // Preserve existing toolInvocations or add new ones
              const toolInvocations =
                currentToolInvocationsRef.current.size > 0
                  ? Array.from(currentToolInvocationsRef.current.values())
                  : existingMessage.toolInvocations;

              log.trace("[Chunk] Tool invocations", {
                refSize: currentToolInvocationsRef.current.size,
                existing: existingMessage.toolInvocations,
                final: toolInvocations
              });

              // Use parts array to preserve streaming arrival order
              const parts = currentPartsRef.current.length > 0
                ? [...currentPartsRef.current]
                : existingMessage.parts;

              const updatedArray = prev.map((msg, idx) => {
                if (idx === existingIndex) {
                  const updatedMsg: any = { ...msg, content: newContent };
                  // Always preserve toolInvocations if they exist
                  if (toolInvocations && toolInvocations.length > 0) {
                    updatedMsg.toolInvocations = toolInvocations;
                  }
                  // Add parts to preserve arrival order
                  if (parts) {
                    updatedMsg.parts = parts;
                  }
                  log.trace("[Chunk] Updated message", {
                    toolCount: updatedMsg.toolInvocations?.length || 0,
                    partsCount: updatedMsg.parts?.length || 0
                  });
                  return updatedMsg;
                }
                return msg;
              });
              log.trace("[Chunk] Returning updated array", { count: updatedArray.length });
              // Don't add thinking indicator when we're actively updating the assistant message
              return updatedArray;
            }
          }
        });
      });

      // Add logging to verify state update completed
      log.trace("[State] setMessages completed", { messageId });
    };

    const handleLLMComplete = (data: {
      fullText: string;
      messageId: string;
      isAccumulated?: boolean;
      completionTime?: number;
      thinkingDuration?: number;
      tokenUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        messageCount: number;
      };
      maxTokens?: number;
    }) => {
      // Only active tab processes completion
      if (!activeTabManager.isActiveTab(componentRef.current, convId)) return;
      log.debug("handleLLMComplete called", {
        messageId: data.messageId,
        contentLength: data.fullText.length,
        isAccumulated: data.isAccumulated,
        completionTime: data.completionTime,
        thinkingDuration: data.thinkingDuration,
        tokenUsage: data.tokenUsage,
      });

      // Clear thinking start time to stop interval
      thinkingStartTimeRef.current = null;

      // Store maxTokens and tokenUsage if provided by backend
      if (data.maxTokens !== undefined) {
        setMaxTokens(data.maxTokens);
      }
      if (data.tokenUsage) {
        setTokenUsage(data.tokenUsage);
        log.debug("[Complete] Updated tokenUsage from llm_complete", { tokenUsage: data.tokenUsage });
      }

      // Use completion time from backend
      const completionTimeSeconds = data.completionTime ?? 0;
      log.debug("[Complete] Completion time from backend", { seconds: completionTimeSeconds });

      // Don't process empty completions
      const fullText = data.fullText || "";
      if (!fullText) {
        log.debug("Skipping empty completion");
        currentMessageRef.current = null;
        currentMessageIdRef.current = null;
        setIsLoading(false);
        return;
      }

      // Use flushSync for consistency with handleLLMChunk and to prevent race conditions
      flushSync(() => {
        setMessages((prevMessages) => {
          log.debug("[Complete] Processing completion", { 
            messageId: data.messageId, 
            textLength: fullText.length, 
            isAccumulated: data.isAccumulated 
          });

          // Find message to update in the full array (before removing thinking indicator)
          let messageIndex = prevMessages.findIndex((m) => m.id === data.messageId && !m.isThinking);

          // Fallback: if not found by exact ID, try to find by currentMessageIdRef
          // This handles cases where the completion message ID differs from streaming message ID
          if (messageIndex === -1 && currentMessageIdRef.current) {
            messageIndex = prevMessages.findIndex((m) => m.id === currentMessageIdRef.current && !m.isThinking);
            if (messageIndex !== -1) {
              log.debug("[Complete] Found message by currentMessageIdRef", { 
                refId: currentMessageIdRef.current, 
                completionId: data.messageId 
              });
            }
          }

          if (messageIndex !== -1) {
            // Message already exists from streaming chunks
            const existingMessage = prevMessages[messageIndex];
            log.debug("[Complete] Message exists from streaming", { 
              streamedLength: existingMessage.content.length,
              backendLength: fullText.length
            });

            // Use fullText from backend as authoritative source
            // If lengths don't match, there's a backend bug that needs to be fixed
            if (existingMessage.content.length !== fullText.length) {
              log.warn("[Complete] Streamed content length mismatch", {
                streamed: existingMessage.content.length,
                backend: fullText.length
              });
            }

            // Preserve existing toolInvocations first, then merge with any new ones
            const existingToolInvocations = existingMessage.toolInvocations || [];
            const newToolInvocations = currentToolInvocationsRef.current.size > 0
              ? Array.from(currentToolInvocationsRef.current.values())
              : [];

            // Merge: create a map of existing tools, update/add new ones
            const toolInvocationsMap = new Map();
            existingToolInvocations.forEach((inv: any) => {
              toolInvocationsMap.set(inv.toolCallId, inv);
            });
            newToolInvocations.forEach((inv: any) => {
              toolInvocationsMap.set(inv.toolCallId, inv);
            });

            const mergedToolInvocations = Array.from(toolInvocationsMap.values());

            // SOLUTION: Preserve parts array from streaming to maintain order
            // - If existing message has parts, preserve them and just update completion metadata
            // - Only create new parts if message doesn't have any
            let finalParts: any[] | undefined;

            if (existingMessage.parts && existingMessage.parts.length > 0) {
              // Preserve existing parts array from streaming - it already has the correct order
              finalParts = existingMessage.parts;
              log.debug("[Complete] Preserving existing parts array", { count: finalParts.length });
            } else if (mergedToolInvocations.length > 0) {
              // Message has tool invocations but no parts - this shouldn't happen with proper streaming
              // Fallback: create parts with tool invocations for proper rendering
              log.debug("[Complete] Creating new parts array", { toolCount: mergedToolInvocations.length });
              finalParts = [];
              mergedToolInvocations.forEach((inv: any) => {
                finalParts!.push({
                  type: "tool-invocation",
                  toolInvocation: inv,
                });
              });
            } else {
              // Simple message with no tools - no parts needed
              finalParts = undefined;
              log.debug("[Complete] No parts needed for simple message", { length: fullText.length });
            }

            // Update message AND remove thinking indicator in one atomic render
            return prevMessages.map((msg, idx) => {
              if (idx === messageIndex) {
                const updatedMsg: any = {
                  ...msg,
                  content: fullText,
                  completionTime: completionTimeSeconds,
                  ...(data.thinkingDuration !== undefined && { thinkingDuration: data.thinkingDuration }),
                  ...(data.tokenUsage && { tokenUsage: data.tokenUsage }),
                  // Always keep parts array to ensure consistent rendering (no blink!)
                  parts: finalParts,
                  // Preserve toolInvocations for backward compatibility
                  ...(mergedToolInvocations.length > 0 && { toolInvocations: mergedToolInvocations }),
                  // Preserve attachments field to maintain file UI after completion
                  ...(msg.attachments && {
                    attachments: msg.attachments.map(f => ({
                      ...f,
                      processingStatus: undefined, // Clear processing status on completion
                      timeElapsed: undefined, // Clear time elapsed on completion
                    }))
                  }),
                  ...(msg.experimental_attachments && { experimental_attachments: msg.experimental_attachments }),
                };
                log.debug("[Complete] Updated message", { 
                  contentLength: fullText.length, 
                  partsCount: finalParts?.length || 0, 
                  toolCount: mergedToolInvocations.length,
                  attachmentsCount: msg.attachments?.length || 0
                });
                return updatedMsg;
              }
              // Remove thinking indicator in the same render
              return msg.isThinking ? (undefined as any) : msg;
            }).filter(Boolean);
          }

          // Message not found - create one with fullText
          log.warn("[Complete] Message not found, creating new", { 
            messageId: data.messageId,
            availableIds: prevMessages.map((m) => m.id)
          });
          const toolInvocations =
            currentToolInvocationsRef.current.size > 0
              ? Array.from(currentToolInvocationsRef.current.values())
              : undefined;

          // Preserve parts array from currentPartsRef if it exists (streaming state)
          // Otherwise create simple parts array
          const parts = currentPartsRef.current.length > 0
            ? [...currentPartsRef.current]
            : undefined;

          const newMessage: Message = {
            id: data.messageId,
            role: "assistant",
            content: fullText,
            parts: parts, // Preserve parts from streaming if available
            createdAt: new Date(),
            completionTime: completionTimeSeconds,
            ...(data.thinkingDuration !== undefined && { thinkingDuration: data.thinkingDuration }),
            ...(data.tokenUsage && { tokenUsage: data.tokenUsage }),
            ...(toolInvocations && toolInvocations.length > 0 && { toolInvocations }),
          };
          // Add new message and remove thinking indicator in one atomic render
          return [...prevMessages.filter((m) => !m.isThinking), newMessage];
        });
      });

      // Clear refs after completion
      currentMessageRef.current = null;
      currentMessageIdRef.current = null;
      currentToolInvocationsRef.current.clear(); // Clear tool invocations for next message
      currentPartsRef.current = []; // Clear parts for next message
      setIsLoading(false);

      // Clear analysis state when LLM completes
      const { setAnalysisStartTime, setUploadingMessageId, uploadingMessageId } = useChatStore.getState();
      if (uploadingMessageId) {
        log.debug("[Complete] Clearing analysis state", { uploadingMessageId });
        setAnalysisStartTime(null);
        setUploadingMessageId(null);
      }

      log.debug("Completion handling complete");
    };

    const handleCommunicationError = (data: {
      code: string;
      message: string;
    }) => {
      setError(`Communication error: ${data.message}`);
      setIsLoading(false);

      // Add error message to chat
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: "assistant",
        content: `Error: ${data.message}`,
        createdAt: new Date(),
      };

      setMessages((prev) => {
        // Remove thinking indicator and add error message
        const withoutThinking = prev.filter((m) => !m.isThinking);
        return [...withoutThinking, errorMessage];
      });
    };

    const handleStatus = (data: { status?: string; message?: string }) => {
      log.debug("[handleStatus] Status message received", { status: data.status, message: data.message });

      // Connection-related status
      if (data.status === 'connected' || data.status === 'disconnected' || data.status === 'reconnecting') {
        const { setConnectionStatus } = useChatStore.getState();
        setConnectionStatus(data.status);
      }

      // Processing-related status (file uploads, extension processing, etc.)
      if (data.status === 'processing' || data.status === 'complete') {
        const { setUploadingMessageId, uploadingMessageId } = useChatStore.getState();
        log.debug("[handleStatus] Processing status", { 
          status: data.status, 
          message: data.message, 
          uploadingMessageId 
        });

        // Check if this is an extension analysis status (Analyzing...)
        const isAnalyzing = data.message && (
          data.message.includes('Analyzing') ||
          data.message.includes('analyzing') ||
          data.message.toLowerCase().includes('analyzing')
        );

        if (isAnalyzing && data.status === 'processing') {
          // Update the file attachments in the user message to show analysis status
          if (uploadingMessageId) {
            const { updateMessage, analysisStartTime, setAnalysisStartTime } = useChatStore.getState();

            // Track analysis start time if not already tracking
            if (!analysisStartTime) {
              setAnalysisStartTime(Date.now());
              log.debug("[handleStatus] Analysis started", { startTime: Date.now() });
            }

            // Calculate elapsed time in seconds
            const elapsed = analysisStartTime ? Math.ceil((Date.now() - analysisStartTime) / 1000) : 0;

            updateMessage(uploadingMessageId, {
              attachments: (useChatStore.getState().messages.find(m => m.id === uploadingMessageId)?.attachments || []).map(f => ({
                ...f,
                processingStatus: data.message || 'Processing...',
                timeElapsed: elapsed,
              })),
            });
            log.debug("[handleStatus] Updated file attachment processing status", { 
              status: data.message, 
              timeElapsed: elapsed 
            });
          }
        } else if (data.status === 'complete') {
          // Upload/analysis complete - clear processing status from file attachments
          log.debug("[handleStatus] Complete status received, clearing processing status", { uploadingMessageId });
          if (uploadingMessageId) {
            const { updateMessage, setAnalysisStartTime } = useChatStore.getState();
            updateMessage(uploadingMessageId, {
              attachments: (useChatStore.getState().messages.find(m => m.id === uploadingMessageId)?.attachments || []).map(f => ({
                ...f,
                processingStatus: undefined, // Clear processing status
                timeElapsed: undefined, // Clear time elapsed
              })),
            });
            log.debug("[handleStatus] Cleared processing status for attachments");

            // Clear analysis start time
            setAnalysisStartTime(null);

            // Clear the tracking ID after a short delay
            setTimeout(() => {
              const { uploadingMessageId: currentId } = useChatStore.getState();
              if (uploadingMessageId === currentId) {
                setUploadingMessageId(null);
              }
            }, 500);
          } else {
            log.debug("[handleStatus] Complete status but no uploadingMessageId to update");
          }
        } else {
          // Regular processing status - update file attachments if we have an uploading message
          if (uploadingMessageId && data.message) {
            const { updateMessage } = useChatStore.getState();
            updateMessage(uploadingMessageId, {
              attachments: (useChatStore.getState().messages.find(m => m.id === uploadingMessageId)?.attachments || []).map(f => ({
                ...f,
                processingStatus: data.message,
              })),
            });
            log.debug("[handleStatus] Updated file attachment processing status", { status: data.message });
          }
        }
      }

      // File update status - when an extension finishes processing a file
      if (data.status === 'file_updated') {
        try {
          const update = JSON.parse(data.message || '{}');
          const { setFiles } = useFileStore.getState();
          setFiles((prevFiles) =>
            prevFiles ? prevFiles.map((f) =>
              f.name === update.fileName ? { ...f, description: update.description } : f
            ) : prevFiles
          );
        } catch (e) {
          log.error("[handleStatus] Failed to parse file update", { message: data.message });
        }
      }
    };

    const handleHistoryResponse = (data: { messages?: any[]; hasActiveStream?: boolean; maxTokens?: number; tokenUsage?: any }) => {
      log.debug("handleHistoryResponse called", { 
        hasActiveStream: data.hasActiveStream,
        tokenUsage: data.tokenUsage 
      });

      // Clear history loading state when response is received
      setIsHistoryLoading(false);

      // Set maxTokens if provided
      if (data.maxTokens !== undefined) {
        setMaxTokens(data.maxTokens);
        log.debug("[History] Set maxTokens from history response", { maxTokens: data.maxTokens });
      }

      // Set tokenUsage if provided (from OpenAI API via info.json)
      if (data.tokenUsage) {
        setTokenUsage(data.tokenUsage);
        log.debug("[History] Set tokenUsage from history response", { tokenUsage: data.tokenUsage });
      }

      if (data.messages && Array.isArray(data.messages)) {
        log.debug("[History] Converting messages", { count: data.messages.length });

        // Convert and merge messages
        const serverMessages: Message[] = [];
        let i = 0;

        while (i < data.messages.length) {
          const msg = data.messages[i];

          // Skip tool messages (they're internal)
          if (msg.role === "tool") {
            log.trace("[History] Skipping tool message", { index: i });
            i++;
            continue;
          }

          // For user messages, just add them
          if (msg.role === "user") {
            const messageId = msg.id || `history_${Date.now()}_${i}`;
            serverMessages.push({
              id: messageId,
              role: "user",
              content: msg.content || "",
              createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
              // Convert _attachments from backend to attachments for frontend
              ...((msg as any)._attachments && { attachments: (msg as any)._attachments }),
              // Preserve attachments if present (for backward compatibility)
              ...(msg.attachments && { attachments: msg.attachments }),
              ...(msg.experimental_attachments && { experimental_attachments: msg.experimental_attachments }),
            });
            log.trace("[History] Added user message", { index: i, attachments: (msg as any)._attachments?.length || msg.attachments?.length || 0 });
            i++;
            continue;
          }

          // For assistant messages, look ahead to merge content and tool_calls
          if (msg.role === "assistant") {
            let mergedContent = msg.content || "";
            let toolInvocations: any[] = [];
            const messageId = msg.id || `history_${Date.now()}_${i}`;

            // Create a map of tool results by looking ahead (for all tool_calls in this message)
            const toolResultsMap = new Map<string, any>();
            for (let j = i + 1; j < data.messages.length; j++) {
              const futureMsg = data.messages[j];
              if (futureMsg.role === "tool" && futureMsg.tool_call_id) {
                try {
                  const resultContent = typeof futureMsg.content === "string"
                    ? JSON.parse(futureMsg.content)
                    : futureMsg.content;
                  log.trace("[History] Found tool result", { toolCallId: futureMsg.tool_call_id, result: resultContent });
                  toolResultsMap.set(futureMsg.tool_call_id, resultContent);
                } catch (e) {
                  // If not JSON, use as-is
                  log.trace("[History] Found tool result (non-JSON)", { toolCallId: futureMsg.tool_call_id, content: futureMsg.content });
                  toolResultsMap.set(futureMsg.tool_call_id, futureMsg.content);
                }
              } else if (futureMsg.role === "assistant" && !futureMsg.tool_calls) {
                // Stop when we hit the next assistant message WITHOUT tool_calls
                // (assistant messages with tool_calls are part of the same logical group)
                break;
              }
            }
            log.trace("[History] Tool results map", { size: toolResultsMap.size, entries: Array.from(toolResultsMap.entries()) });

            // Check if this message has tool_calls
            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
              log.debug("[History] Message has tool_calls", { index: i, count: msg.tool_calls.length });

              toolInvocations = msg.tool_calls.map((tc: any) => {
                let args = {};
                try {
                  const argStr = tc.function?.arguments || tc.arguments;
                  args =
                    typeof argStr === "string"
                      ? JSON.parse(argStr)
                      : argStr || {};
                } catch (e) {
                  log.warn("[History] Failed to parse tool arguments", { error: e instanceof Error ? e.message : String(e) });
                }

                const toolResult = toolResultsMap.get(tc.id);
                const hasError = toolResult && toolResult.error;

                log.trace("[History] Tool", { 
                  id: tc.id, 
                  name: tc.function?.name || tc.name,
                  hasResult: !!toolResult,
                  hasError
                });

                return {
                  state: hasError ? "error" : "result",
                  toolCallId: tc.id,
                  toolName: tc.function?.name || tc.name,
                  args,
                  result: hasError ? undefined : toolResult,
                  error: hasError ? toolResult.error : undefined,
                };
              });
            }

            // Look ahead - if next message is assistant with tool_calls, merge it
            if (i + 1 < data.messages.length) {
              const nextMsg = data.messages[i + 1];
              if (
                nextMsg.role === "assistant" &&
                nextMsg.tool_calls &&
                (!nextMsg.content || nextMsg.content.trim() === "")
              ) {
                log.debug("[History] Merging tool_calls from next message", { nextIndex: i + 1 });
                const nextToolInvocations = nextMsg.tool_calls.map(
                  (tc: any) => {
                    let args = {};
                    try {
                      const argStr = tc.function?.arguments || tc.arguments;
                      args =
                        typeof argStr === "string"
                          ? JSON.parse(argStr)
                          : argStr || {};
                    } catch (e) {
                      log.warn("[History] Failed to parse tool arguments", { error: e instanceof Error ? e.message : String(e) });
                    }

                    const toolResult = toolResultsMap.get(tc.id);
                    const hasError = toolResult && toolResult.error;

                    log.trace("[History] Merged tool", { 
                      id: tc.id, 
                      name: tc.function?.name || tc.name,
                      hasResult: !!toolResult,
                      hasError
                    });

                    return {
                      state: hasError ? "error" : "result",
                      toolCallId: tc.id,
                      toolName: tc.function?.name || tc.name,
                      args,
                      result: hasError ? undefined : toolResult,
                      error: hasError ? toolResult.error : undefined,
                    };
                  }
                );
                toolInvocations = [...toolInvocations, ...nextToolInvocations];
                i++; // Skip the next message since we merged it
              }
            }

            // Skip tool result message if it follows
            if (
              i + 1 < data.messages.length &&
              data.messages[i + 1].role === "tool"
            ) {
              i++; // Skip tool message
            }

            // Build parts array to preserve order of text and tool invocations
            const parts: any[] = [];

            // Add initial content as text part if present
            if (mergedContent.trim()) {
              parts.push({
                type: "text",
                text: mergedContent,
              });
            }

            // Add tool invocations as parts
            if (toolInvocations.length > 0) {
              toolInvocations.forEach((inv) => {
                parts.push({
                  type: "tool-invocation",
                  toolInvocation: inv,
                });
              });
            }

            // Look ahead - if next message is assistant with content, add as another text part
            let finalCompletionTime = msg.completionTime;
            if (i + 1 < data.messages.length) {
              const nextMsg = data.messages[i + 1];
              if (
                nextMsg.role === "assistant" &&
                nextMsg.content &&
                !nextMsg.tool_calls
              ) {
                log.debug("[History] Adding content from next message as text part", { nextIndex: i + 1 });
                parts.push({
                  type: "text",
                  text: nextMsg.content,
                });
                // Use completion time from the merged message if available
                if (nextMsg.completionTime !== undefined) {
                  finalCompletionTime = nextMsg.completionTime;
                }
                i++; // Skip the next message since we included it
              }
            }

            // Only add if there are parts
            if (parts.length > 0) {
              const message: Message = {
                id: messageId,
                role: "assistant",
                content: mergedContent, // Keep for backwards compatibility
                parts: parts, // Use parts for proper ordering
                createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
                ...(finalCompletionTime !== undefined && {
                  completionTime: finalCompletionTime,
                }),
                ...(msg.thinkingDuration !== undefined && { thinkingDuration: msg.thinkingDuration }),
                ...(msg.aborted && { aborted: true }),
                ...(msg.tokenUsage && { tokenUsage: msg.tokenUsage }),
              };

              // Also keep toolInvocations for backwards compatibility
              if (toolInvocations.length > 0) {
                message.toolInvocations = toolInvocations;
                log.debug("[History] Added assistant message with tools", { 
                  partsCount: parts.length, 
                  toolCount: toolInvocations.length,
                  tokenUsage: msg.tokenUsage
                });
              } else {
                log.debug("[History] Added assistant message (content only)", { 
                  partsCount: parts.length,
                  tokenUsage: msg.tokenUsage
                });
              }

              log.trace("[History] Final message object", { message });
              serverMessages.push(message);
            }

            i++;
            continue;
          }

          // Default: skip unknown message types
          i++;
        }

        log.debug("[History] Setting messages", { 
          count: serverMessages.length,
          firstMessage: serverMessages[0]
        });

        // Check if the last message is an incomplete assistant message (still streaming)
        const lastMessage = serverMessages[serverMessages.length - 1];
        const isLastMessageIncomplete =
          lastMessage &&
          lastMessage.role === "assistant" &&
          !lastMessage.completionTime &&
          !lastMessage.aborted;

        // Backend tells us if there's an active stream (more reliable than checking last message)
        const shouldShowThinking = data.hasActiveStream || isLastMessageIncomplete;

        log.debug("[History] Last message status", { 
          isIncomplete: isLastMessageIncomplete,
          shouldShowThinking,
          hasActiveStream: data.hasActiveStream
        });

        // IMPORTANT: Merge with current state instead of replacing it
        // This prevents history from overwriting streamed content
        setMessages((prev) => {
          // Check if there's an existing thinking indicator
          const existingThinkingIndicator = prev.find((m) => m.isThinking);
          log.trace("[History] Merging", { 
            prevCount: prev.length, 
            hasExistingThinking: !!existingThinkingIndicator 
          });

          // If we have no current messages, just use server messages
          if (prev.length === 0) {
            log.debug("[History] No existing messages, using server messages");

            // Add thinking indicator if streaming is active
            if (shouldShowThinking) {
              log.debug("[History] Adding thinking indicator for incomplete message");
              const thinkingMessage: Message = {
                id: `thinking_${Date.now()}`,
                role: "assistant",
                content: "Thinking...",
                createdAt: new Date(),
                isThinking: true,
              };
              return [...serverMessages, thinkingMessage];
            }

            return serverMessages;
          }

          // If we have messages, merge smartly
          log.debug("[History] Merging with existing messages", { existingCount: prev.length });
          const merged = [...serverMessages];

          // For each existing message, check if it has MORE content than the server version
          // This handles the case where streaming accumulated more content than what's in history
          prev.forEach((existingMsg) => {
            // Skip thinking indicators - we'll handle them separately
            if (existingMsg.isThinking) {
              log.trace("[History] Preserving thinking indicator from existing messages");
              return;
            }

            const serverMsgIndex = merged.findIndex(
              (m) => m.id === existingMsg.id
            );

            if (serverMsgIndex !== -1) {
              const serverMsg = merged[serverMsgIndex];
              // Keep the version with more content (streaming version beats history)
              if (existingMsg.content.length > serverMsg.content.length) {
                log.debug("[History] Keeping streamed version", { 
                  id: existingMsg.id,
                  streamedLength: existingMsg.content.length,
                  historyLength: serverMsg.content.length
                });
                // Merge tokenUsage from server message into streamed message
                merged[serverMsgIndex] = {
                  ...existingMsg,
                  ...(serverMsg.tokenUsage && { tokenUsage: serverMsg.tokenUsage }),
                  ...(serverMsg.completionTime && !existingMsg.completionTime && { completionTime: serverMsg.completionTime }),
                };
                log.trace("[History] Merged tokenUsage from server", { tokenUsage: serverMsg.tokenUsage });
              } else {
                log.trace("[History] Using history version", { 
                  id: existingMsg.id,
                  historyLength: serverMsg.content.length,
                  streamedLength: existingMsg.content.length
                });
              }
            } else {
              // Message exists locally but not in history - this is stale data from previous session
              // Don't keep it, server history is the source of truth
              log.trace("[History] Discarding stale message", { id: existingMsg.id });
            }
          });

          // Add thinking indicator if:
          // 1. Backend says there's an active stream, OR
          // 2. Last message is incomplete (still streaming), OR
          // 3. We had a thinking indicator before history loaded (chunks arrived before history)
          if (shouldShowThinking || existingThinkingIndicator) {
            log.debug("[History] Adding thinking indicator after merge", { 
              shouldShowThinking, 
              hasExisting: !!existingThinkingIndicator 
            });
            const thinkingMessage: Message = {
              id: `thinking_${Date.now()}`,
              role: "assistant",
              content: "Thinking...",
              createdAt: new Date(),
              isThinking: true,
            };
            const finalMessages = [...merged, thinkingMessage];
            log.debug("[History] Returning messages with thinking indicator", { count: finalMessages.length });
            return finalMessages;
          }

          log.debug("[History] Returning messages without thinking indicator", { count: merged.length });
          return merged;
        });

        // Set loading state if streaming is active
        if (shouldShowThinking) {
          log.debug("[History] Setting loading state for active stream");
          setIsLoading(true);
          // Don't set thinkingStartTimeRef here - wait for the next chunk with startTime from server
          thinkingStartTimeRef.current = null;
          // Set the current message ID ref so new chunks can be appended (if we have an assistant message)
          if (lastMessage && lastMessage.role === "assistant") {
            currentMessageIdRef.current = lastMessage.id;
            log.debug("[History] Set currentMessageIdRef", { id: lastMessage.id });
          } else {
            log.debug("[History] No assistant message to set as current (will be set when first chunk arrives)");
          }
        }
      } else {
        log.debug("No messages to process or messages is not an array");
      }
    };

    const handleControl = (data: any) => {
      log.debug("handleControl called", { status: data.status, type: data.type });
      if (data.status === "history" || data.type === "history_response") {
        log.debug("Processing history data", { 
          historyCount: data.history?.length,
          hasTodos: !!data.todos,
          hasActiveStream: data.hasActiveStream,
          maxTokens: data.maxTokens,
          tokenUsage: data.tokenUsage
        });
        handleHistoryResponse({
          messages: data.history || [],
          hasActiveStream: data.hasActiveStream,
          maxTokens: data.maxTokens,
          tokenUsage: data.tokenUsage
        });

        // Update todos state if provided
        if (data.todos) {
          setTodos(data.todos);
        }
      } else if (data.status === "file_context" || data.type === "get_file_context") {
        log.debug("Processing file context data", { fileContext: data.fileContext });
        // Update file context store with the mapping from server
        if (data.fileContext) {
          const { setFileContext } = useFileContextStore.getState();
          setFileContext(data.fileContext);
        }
      }
    };

    const handleToolCall = (data: {
      toolCallId: string;
      toolName: string;
      args: any;
      status: string;
      result?: any;
      error?: string;
      assistantMessageId?: string;
    }) => {
      // Only active tab processes tool calls
      if (!activeTabManager.isActiveTab(componentRef.current, convId)) return;
      log.debug("[Tool Call] Received", { 
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        status: data.status,
        assistantMessageId: data.assistantMessageId
      });

      // Map backend status to UI state
      let state: "call" | "executing" | "progress" | "result" | "error" = "call";
      if (data.status === "executing") {
        state = "executing";
      } else if (data.status === "progress") {
        state = "progress";
      } else if (data.status === "complete") {
        state = "result";
      } else if (data.status === "error") {
        state = "error";
      }

      // Store tool invocation with appropriate state
      // Merge with existing invocation to preserve args (like code) across state changes
      const existingInvocation = currentToolInvocationsRef.current.get(data.toolCallId);

      // Track timing: store timestamp on first call, calculate duration on completion
      let timestamp = existingInvocation?.timestamp;
      let duration = existingInvocation?.duration;

      if (!timestamp) {
        // First time seeing this tool - record start time
        timestamp = Date.now();
      }

      if (state === "result" || state === "error") {
        // Tool completed - calculate duration
        duration = timestamp ? Math.round((Date.now() - timestamp) / 1000) : undefined;
      }

      // Extract error from data.error or from data.result.error (for script tool errors)
      const extractedError = data.error || (data.result?.__error && data.result.error);

      const toolInvocation = {
        state,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        args: { ...existingInvocation?.args, ...data.args }, // Preserve existing args
        result: data.result?.__error ? undefined : data.result, // Don't include error wrapper in result
        error: extractedError,
        timestamp,
        duration,
        inspectionData: existingInvocation?.inspectionData,
      };
      currentToolInvocationsRef.current.set(data.toolCallId, toolInvocation);

      // Check if any tools are currently executing
      const hasExecutingTools = Array.from(currentToolInvocationsRef.current.values())
        .some(inv => inv.state === "executing" || inv.state === "call");

      // If tools are executing, ensure there's a thinking indicator with tool status
      if (hasExecutingTools && !thinkingStartTimeRef.current) {
        thinkingStartTimeRef.current = Date.now();
      }

      log.trace("[Tool Call] Current state", {
        invocationsSize: currentToolInvocationsRef.current.size,
        hasExecutingTools
      });

      // Add tool to parts array in arrival order (or update existing) - create new array for React
      const existingPartIndex = currentPartsRef.current.findIndex(
        p => p.type === "tool-invocation" && p.toolInvocation?.toolCallId === data.toolCallId
      );

      if (existingPartIndex !== -1) {
        // Update existing tool part - create new array with updated part
        currentPartsRef.current = currentPartsRef.current.map((part, idx) =>
          idx === existingPartIndex
            ? { ...part, toolInvocation: toolInvocation }
            : part
        );
      } else if (data.status === "executing" || data.status === "call") {
        // Add new tool part on first appearance - create new array
        currentPartsRef.current = [
          ...currentPartsRef.current,
          {
            type: "tool-invocation",
            toolInvocation: toolInvocation,
          }
        ];
      }

      log.trace("[Tool Call] Current parts array", {
        parts: currentPartsRef.current.map(p => ({ 
          type: p.type, 
          ...(p.type === "text" ? { textLength: p.text.length } : { toolName: p.toolInvocation.toolName }) 
        }))
      });

      // Handle inspection data from extensions
      if (data.result?.__inspectionData) {
        const { extensionId, data: inspectionData } = data.result.__inspectionData;
        log.debug("[Tool Call] Received inspection data", { extensionId, toolCallId: data.toolCallId });

        // Store inspection data for use in dialog
        // We'll attach this to the tool invocation
        toolInvocation.inspectionData = {
          ...toolInvocation.inspectionData,
          [extensionId]: inspectionData,
        };
        currentToolInvocationsRef.current.set(data.toolCallId, toolInvocation);

        log.trace("[Tool Call] Updated inspection data", {
          inspectionKeys: Object.keys(toolInvocation.inspectionData || {})
        });
      }

      // Update or create assistant message to include tool invocations
      // Use flushSync to ensure immediate rendering, especially for errors
      flushSync(() => {
        setMessages((prev) => {
          const toolInvocations = Array.from(
            currentToolInvocationsRef.current.values()
          );
          const parts = currentPartsRef.current.length > 0
            ? [...currentPartsRef.current]
            : undefined;

          // Check if any tools are currently executing
          const hasExecutingTools = toolInvocations.some(
            inv => inv.state === "executing" || inv.state === "call"
          );

          log.trace("[Tool Call] Processing update", {
            toolCount: toolInvocations.length,
            partsCount: parts?.length,
            hasExecutingTools
          });

          // Separate thinking indicator from other messages
          const thinkingMsg = prev.find((m) => m.isThinking);
          const otherMessages = prev.filter((m) => !m.isThinking);

          // If tools are executing, ensure we have a thinking indicator with updated text
          let thinkingIndicator = thinkingMsg;
          if (hasExecutingTools) {
            // Get the first executing tool name for display
            const executingTool = toolInvocations.find(
              inv => inv.state === "executing" || inv.state === "call"
            );
            const toolName = executingTool?.toolName || "tool";

            // Create or update thinking indicator for tool execution
            thinkingIndicator = {
              id: `thinking_${Date.now()}`,
              role: "assistant",
              content: `Running ${toolName}...`,
              createdAt: new Date(),
              isThinking: true,
            };

            log.debug("[Tool Call] Creating tool thinking indicator", { content: thinkingIndicator.content });
          }

          // Look for message with matching ID if provided
          if (data.assistantMessageId) {
            const existingIndex = otherMessages.findIndex(
              (m) => m.id === data.assistantMessageId
            );
            log.trace("[Tool Call] Looking for message", { 
              id: data.assistantMessageId, 
              foundAt: existingIndex 
            });

            if (existingIndex !== -1) {
              // Update existing message
              log.debug("[Tool Call] Updating existing message", { index: existingIndex });
              const updated = otherMessages.map((msg, idx) =>
                idx === existingIndex
                  ? { ...msg, toolInvocations, ...(parts && { parts }) }
                  : msg
              );
              // FIX: Only add thinking indicator if one doesn't already exist in the result
              const hasThinkingIndicator = updated.some((m) => "isThinking" in m && m.isThinking);
              return !hasThinkingIndicator && thinkingIndicator
                ? [...updated, thinkingIndicator]
                : updated;
            }
          }

          // Try to find message by currentMessageIdRef (from streaming chunks)
          const currentMsgIndex = otherMessages.findIndex(
            (m) => m.id === currentMessageIdRef.current
          );
          if (currentMsgIndex !== -1) {
            log.debug("[Tool Call] Found message by currentMessageIdRef", { id: currentMessageIdRef.current });
            const updated = otherMessages.map((msg, idx) =>
              idx === currentMsgIndex
                ? { ...msg, toolInvocations, ...(parts && { parts }) }
                : msg
            );
            // FIX: Only add thinking indicator if one doesn't already exist in the result
            const hasThinkingIndicator = updated.some((m) => "isThinking" in m && m.isThinking);
            return !hasThinkingIndicator && thinkingIndicator
              ? [...updated, thinkingIndicator]
              : updated;
          }

          // Check if last non-thinking message is assistant
          const lastMsg = otherMessages[otherMessages.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            log.debug("[Tool Call] Updating last assistant message", { id: lastMsg.id });
            const updated = otherMessages.map((msg, idx) =>
              idx === otherMessages.length - 1
                ? { ...msg, toolInvocations, ...(parts && { parts }) }
                : msg
            );
            // FIX: Only add thinking indicator if one doesn't already exist in the result
            const hasThinkingIndicator = updated.some((m) => "isThinking" in m && m.isThinking);
            return !hasThinkingIndicator && thinkingIndicator
              ? [...updated, thinkingIndicator]
              : updated;
          }

          // Otherwise, create a placeholder assistant message using the ID from backend
          const messageId =
            data.assistantMessageId ||
            currentMessageIdRef.current ||
            `msg_${Date.now()}_assistant`;
          currentMessageIdRef.current = messageId;
          log.debug("[Tool Call] Creating new message", { id: messageId });
          const newMessage = {
            id: messageId,
            role: "assistant" as const,
            content: "",
            createdAt: new Date(),
            toolInvocations,
          };
          const updated = [...otherMessages, newMessage];
          // FIX: Only add thinking indicator if one doesn't already exist in the result
          const hasThinkingIndicator = updated.some((m) => "isThinking" in m && m.isThinking);
          return !hasThinkingIndicator && thinkingIndicator
            ? [...updated, thinkingIndicator]
            : updated;
        });
      });
    };

    const handleToolResult = (data: {
      toolCallId: string;
      toolName: string;
      result: any;
    }) => {
      // Only active tab processes tool results
      if (!activeTabManager.isActiveTab(componentRef.current, convId)) return;
      log.debug("[Tool Result] Received", { 
        toolCallId: data.toolCallId,
        toolName: data.toolName 
      });

      // Update tool invocation to "result" or "error" state based on result content
      const existingInvocation = currentToolInvocationsRef.current.get(
        data.toolCallId
      );
      if (existingInvocation) {
        // Check if result contains an error
        const hasError = data.result && data.result.error;

        if (hasError) {
          log.debug("[Tool Result] Error detected", { 
            toolName: data.toolName, 
            error: data.result.error 
          });
        }

        const updatedInvocation = {
          ...existingInvocation,
          state: hasError ? ("error" as const) : ("result" as const),
          result: hasError ? undefined : data.result,
          error: hasError ? data.result.error : undefined,
        };
        currentToolInvocationsRef.current.set(data.toolCallId, updatedInvocation);

        // Update parts array to reflect the new state
        const existingPartIndex = currentPartsRef.current.findIndex(
          p => p.type === "tool-invocation" && p.toolInvocation?.toolCallId === data.toolCallId
        );

        if (existingPartIndex !== -1) {
          // Update existing tool part with result - create new array
          currentPartsRef.current = currentPartsRef.current.map((part, idx) =>
            idx === existingPartIndex
              ? { ...part, toolInvocation: updatedInvocation }
              : part
          );
        }

        // Update the current assistant message
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            const toolInvocations = Array.from(
              currentToolInvocationsRef.current.values()
            );

            // IMPORTANT: Preserve existing parts array if it exists, otherwise use currentPartsRef
            // This prevents losing the parts array that was built during streaming
            const parts = lastMsg.parts && lastMsg.parts.length > 0
              ? lastMsg.parts
              : (currentPartsRef.current.length > 0
                  ? [...currentPartsRef.current]
                  : undefined);

            // Check if any tools are still executing
            const hasExecutingTools = toolInvocations.some(
              inv => inv.state === "executing" || inv.state === "call"
            );

            log.trace("[Tool Result] Processing", {
              hasExecutingTools,
              hasParts: !!(lastMsg.parts && lastMsg.parts.length > 0),
              partsLength: lastMsg.parts?.length || 0
            });

            // If no tools are executing, remove thinking indicator. If tools are still executing, update it.
            if (hasExecutingTools) {
              // Get the first executing tool name for display
              const executingTool = toolInvocations.find(
                inv => inv.state === "executing" || inv.state === "call"
              );
              const toolName = executingTool?.toolName || "tool";

              const thinkingIndicator = {
                id: `thinking_${Date.now()}`,
                role: "assistant",
                content: `Running ${toolName}...`,
                createdAt: new Date(),
                isThinking: true,
              };

              // Update message and keep thinking indicator
              const updated = prev.map((msg, idx) =>
                idx === prev.length - 1
                  ? { ...msg, toolInvocations, ...(parts && { parts }) }
                  : msg
              );
              const hasThinking = updated.some((m) => m.isThinking);
              return !hasThinking ? [...updated, thinkingIndicator] : updated;
            } else {
              // All tools done - remove thinking indicator and update message
              return prev.map((msg, idx) => {
                if (idx === prev.length - 1) {
                  return { ...msg, toolInvocations, ...(parts && { parts }) };
                }
                // Remove thinking indicator
                return msg.isThinking ? (undefined as any) : msg;
              }).filter(Boolean);
            }
          }
          return prev;
        });
      }
    };

    const handleTodoUpdate = (data: { todos: any }) => {
      // Only active tab processes todo updates
      if (!activeTabManager.isActiveTab(componentRef.current, convId)) return;
      log.debug("[Todo Update] Received", { todos: data.todos });
      setTodos(data.todos);
    };

    const handleConversationTitleUpdate = (data: { title: string }) => {
      // Only active tab processes title updates
      if (!activeTabManager.isActiveTab(componentRef.current, convId)) return;
      log.debug("[Title Update] Received new title", { title: data.title });

      // Refresh conversation list to show updated title
      if (currentProject?.id) {
        refreshConversations(currentProject.id);
      }
    };

    const handleAuthFailed = (data: { code: number; reason: string }) => {
      // Authentication failure - logout the user
      log.error("[Auth Failed] WebSocket authentication failed", { code: data.code, reason: data.reason });
      const { logout } = useAuthStore.getState();
      logout();
    };

    const handleFileContextUpdate = (data: { fileId: string; included: boolean }) => {
      // Update file context store when another client changes it
      log.debug("[File Context] Received update", { fileId: data.fileId, included: data.included });
      const { setFileInContext } = useFileContextStore.getState();
      setFileInContext(data.fileId, data.included);
    };

    // Register event listeners
    wsClient.on("connected", handleConnected);
    wsClient.on("disconnected", handleDisconnected);
    wsClient.on("reconnecting", handleReconnecting);
    wsClient.on("error", handleError);
    wsClient.on("llm_chunk", handleLLMChunk);
    wsClient.on("llm_complete", handleLLMComplete);
    wsClient.on("communication_error", handleCommunicationError);
    wsClient.on("status", handleStatus);
    wsClient.on("control", handleControl);
    wsClient.on("tool_call", handleToolCall);
    wsClient.on("tool_result", handleToolResult);
    wsClient.on("todo_update", handleTodoUpdate);
    wsClient.on("file_context_update", handleFileContextUpdate);
    wsClient.on("conversation_title_update", handleConversationTitleUpdate);
    wsClient.on("auth_failed", handleAuthFailed);

    // Connect to WebSocket (connection manager handles multiple calls gracefully)
    wsClient.connect().catch(handleError);

    // Set up interval to update elapsed time during analysis
    const timeUpdateInterval = setInterval(() => {
      const { uploadingMessageId, analysisStartTime } = useChatStore.getState();
      if (uploadingMessageId && analysisStartTime) {
        const { updateMessage } = useChatStore.getState();
        const message = useChatStore.getState().messages.find(m => m.id === uploadingMessageId);
        const attachment = message?.attachments?.[0];

        // Only update if attachment has processing status (still analyzing)
        if (attachment?.processingStatus && message) {
          const elapsed = Math.ceil((Date.now() - analysisStartTime) / 1000);

          updateMessage(uploadingMessageId, {
            attachments: message.attachments?.map(f => ({
              ...f,
              timeElapsed: elapsed,
            })),
          });
        }
      }
    }, 1000); // Update every second

    // Cleanup function - just remove event listeners, connection manager handles disconnection
    return () => {
      log.debug("[Setup] Cleaning up event handlers", { convId });

      // Clear the time update interval
      clearInterval(timeUpdateInterval);

      // Unregister this tab
      activeTabManager.unregisterTab(componentRef.current, convId);

      wsClient.off("connected", handleConnected);
      wsClient.off("disconnected", handleDisconnected);
      wsClient.off("reconnecting", handleReconnecting);
      wsClient.off("error", handleError);
      wsClient.off("llm_chunk", handleLLMChunk);
      wsClient.off("llm_complete", handleLLMComplete);
      wsClient.off("communication_error", handleCommunicationError);
      wsClient.off("status", handleStatus);
      wsClient.off("control", handleControl);
      wsClient.off("tool_call", handleToolCall);
      wsClient.off("tool_result", handleToolResult);
      wsClient.off("todo_update", handleTodoUpdate);
      wsClient.off("file_context_update", handleFileContextUpdate);
      wsClient.off("conversation_title_update", handleConversationTitleUpdate);
      wsClient.off("auth_failed", handleAuthFailed);
    };
  }, [wsClient, convId, componentRef, setMessages, setIsLoading, setIsHistoryLoading, setError, setTodos, isLoading, thinkingStartTimeRef, currentMessageRef, currentMessageIdRef, currentToolInvocationsRef, currentPartsRef, refreshConversations, currentProject, log]);
}
