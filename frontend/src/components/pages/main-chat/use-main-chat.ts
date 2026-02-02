"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";

import { useConvId } from "@/lib/conv-id";
import { useWSConnection } from "@/lib/ws/ws-connection-manager";
import { useChatStore } from "@/stores/chat-store";
import { useProjectStore } from "@/stores/project-store";
import { useFileStore } from "@/stores/file-store";
import { useWebSocketHandlers } from "@/hooks/use-websocket-handlers";
import { useMessageSubmission } from "@/hooks/use-message-submission";
import type { MainChatProps, StreamingRefs } from "./types";

/**
 * Shared hook for main chat functionality
 * Used by both desktop and mobile implementations
 */
export function useMainChat(props: MainChatProps) {
  const {
    wsUrl,
    isEmbedMode = false,
    embedConvId,
    embedGenerateNewConvId,
    uid,
    embedToken,
    projectId: projectIdOverride,
  } = props;

  // Chat store state
  const {
    messages,
    input,
    isLoading,
    isHistoryLoading,
    error,
    todos,
    setMessages,
    setInput,
    setIsLoading,
    setIsHistoryLoading,
    setError,
    setTodos,
    setMaxTokens,
    setTokenUsage,
    updateMessage,
  } = useChatStore(
    useShallow((state) => ({
      messages: state.messages,
      input: state.input,
      isLoading: state.isLoading,
      isHistoryLoading: state.isHistoryLoading,
      error: state.error,
      todos: state.todos,
      setMessages: state.setMessages,
      setInput: state.setInput,
      setIsLoading: state.setIsLoading,
      setIsHistoryLoading: state.setIsHistoryLoading,
      setError: state.setError,
      setTodos: state.setTodos,
      setMaxTokens: state.setMaxTokens,
      setTokenUsage: state.setTokenUsage,
      updateMessage: state.updateMessage,
    }))
  );

  const { setUploadProgress } = useFileStore(
    useShallow((state) => ({ setUploadProgress: state.setUploadProgress }))
  );

  const { currentProject } = useProjectStore();
  const defaultConvIdHook = useConvId();
  const convId = embedConvId ?? defaultConvIdHook.convId;
  const generateNewConvId = embedGenerateNewConvId ?? defaultConvIdHook.generateNewConvId;

  // WebSocket connection
  const wsClient = useWSConnection({
    url: wsUrl,
    projectId: projectIdOverride ?? currentProject?.id,
    uid,
    embedToken,
    convId: embedConvId,
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    heartbeatInterval: 30000,
    timeout: 10000,
  });

  // Streaming refs
  const currentMessageRef = useRef<string | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  const currentToolInvocationsRef = useRef<Map<string, any>>(new Map());
  const currentPartsRef = useRef<any[]>([]);
  const componentRef = useRef({});
  const thinkingStartTimeRef = useRef<number | null>(null);

  const streamingRefs: StreamingRefs = {
    currentMessageRef,
    currentMessageIdRef,
    currentToolInvocationsRef,
    currentPartsRef,
    thinkingStartTimeRef,
    componentRef,
  };

  // Check if there's a thinking message for interval updates
  const hasThinkingMessage = useMemo(
    () => messages.some((m) => m.isThinking),
    [messages]
  );

  // Thinking time updater
  useEffect(() => {
    if (!hasThinkingMessage) return;

    const intervalId = setInterval(() => {
      if (thinkingStartTimeRef.current === null) return;
      const elapsedSeconds = Math.floor(
        (Date.now() - thinkingStartTimeRef.current) / 1000
      );

      setMessages((prev) => {
        const thinkingIndex = prev.findIndex((m) => m.isThinking);
        if (thinkingIndex === -1) return prev;
        const updated = [...prev];
        updated[thinkingIndex] = {
          ...updated[thinkingIndex],
          content: `Thinking... ${elapsedSeconds}s`,
        };
        return updated;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [hasThinkingMessage, setMessages]);

  // WebSocket handlers
  useWebSocketHandlers({
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
  });

  // Message submission handlers
  const { handleSubmit, abort, handleNewConversation } = useMessageSubmission({
    wsClient,
    projectId: currentProject?.id,
    convId,
    input,
    setInput,
    setMessages,
    setIsLoading,
    setError,
    setTodos,
    setUploadProgress,
    isLoading,
    thinkingStartTimeRef,
    currentMessageRef,
    currentMessageIdRef,
    currentToolInvocationsRef,
    currentPartsRef,
    generateNewConvId,
    isEmbedMode,
    updateMessage,
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [setInput]
  );

  return {
    // State
    messages,
    input,
    isLoading,
    isHistoryLoading,
    error,
    todos,
    convId,
    currentProject,
    wsClient,
    
    // Handlers
    handleInputChange,
    handleSubmit,
    abort,
    handleNewConversation,
    setMessages,
    
    // Refs
    streamingRefs,
    
    // Flags
    isEmbedMode,
    hasTodos: todos?.items?.length > 0,
  };
}

export type UseMainChatReturn = ReturnType<typeof useMainChat>;
