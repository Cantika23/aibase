/**
 * Conversation history store
 * Manages conversation list state and operations
 */

import { create } from "zustand";
import {
  fetchConversations,
  fetchConversationMessages,
  deleteConversation,
  type ConversationWithTitle,
  type ConversationMessagesResponse,
} from "@/lib/conversation-api";

interface ConversationStore {
  // State
  conversations: ConversationWithTitle[];
  selectedConversation: ConversationMessagesResponse | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setConversations: (conversations: ConversationWithTitle[]) => void;
  setSelectedConversation: (conversation: ConversationMessagesResponse | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Async actions
  loadConversations: (projectId: string) => Promise<void>;
  loadConversation: (convId: string, projectId: string) => Promise<void>;
  removeConversation: (convId: string, projectId: string) => Promise<boolean>;
  refreshConversations: (projectId: string) => Promise<void>;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  // Initial state
  conversations: [],
  selectedConversation: null,
  isLoading: false,
  error: null,

  // Synchronous actions
  setConversations: (conversations) => set({ conversations }),

  setSelectedConversation: (conversation) => set({ selectedConversation: conversation }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  // Async actions
  loadConversations: async (projectId: string) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const conversations = await fetchConversations(projectId);
      state.setConversations(conversations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load conversations";
      state.setError(errorMessage);
      console.error("Error loading conversations:", error);
    } finally {
      state.setIsLoading(false);
    }
  },

  loadConversation: async (convId: string, projectId: string) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      const conversation = await fetchConversationMessages(convId, projectId);
      state.setSelectedConversation(conversation);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load conversation";
      state.setError(errorMessage);
      console.error("Error loading conversation:", error);
    } finally {
      state.setIsLoading(false);
    }
  },

  removeConversation: async (convId: string, projectId: string) => {
    const state = get();
    state.setIsLoading(true);
    state.setError(null);

    try {
      await deleteConversation(convId, projectId);

      // Remove from local state
      state.setConversations(
        state.conversations.filter((c) => c.convId !== convId)
      );

      // Clear selected conversation if it was the deleted one
      if (state.selectedConversation?.convId === convId) {
        state.setSelectedConversation(null);
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete conversation";
      state.setError(errorMessage);
      console.error("Error deleting conversation:", error);
      return false;
    } finally {
      state.setIsLoading(false);
    }
  },

  refreshConversations: async (projectId: string) => {
    // Same as loadConversations, but doesn't show loading state
    const state = get();
    state.setError(null);

    try {
      const conversations = await fetchConversations(projectId);
      state.setConversations(conversations);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to refresh conversations";
      state.setError(errorMessage);
      console.error("Error refreshing conversations:", error);
    }
  },
}));
