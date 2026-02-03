/**
 * Simple in-memory message persistence service
 * Stores conversation history per conversation ID using a Record structure
 * Now also persists to disk via ChatHistoryStorage
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { ChatHistoryStorage } from "../storage/chat-history-storage";
import { chatCompaction } from "../storage/chat-compaction";
import { ProjectStorage } from "../storage/project-storage";
import { createLogger } from "../utils/logger";

import { DEFAULT_USER_ID } from "../config/paths";

const logger = createLogger('MessagePersistence');

export interface ConvMessageHistory {
  convId: string;
  projectId: string;
  tenantId: number | string;
  messages: ChatCompletionMessageParam[];
  lastUpdated: number;
  messageCount: number;
}

export class MessagePersistence {
  private static instance: MessagePersistence;
  private convHistories: Record<string, ConvMessageHistory> = {};
  private chatHistoryStorage: ChatHistoryStorage;
  private projectStorage: ProjectStorage;

  private constructor() {
    this.chatHistoryStorage = ChatHistoryStorage.getInstance();
    this.projectStorage = ProjectStorage.getInstance();
  }

  /**
   * Generate cache key from projectId, userId, and convId
   */
  private getCacheKey(projectId: string, userId: string = DEFAULT_USER_ID, convId: string): string {
    return `${projectId}:${userId}:${convId}`;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MessagePersistence {
    if (!MessagePersistence.instance) {
      MessagePersistence.instance = new MessagePersistence();
    }
    return MessagePersistence.instance;
  }

  /**
   * Get message history for a conversation
   * Loads from disk if not in memory
   */
  async getClientHistory(convId: string, projectId: string, userId: string = DEFAULT_USER_ID): Promise<ChatCompletionMessageParam[]> {
    const cacheKey = this.getCacheKey(projectId, userId, convId);
    const history = this.convHistories[cacheKey];
    if (history) {
      return [...history.messages]; // Return a copy to prevent direct modification
    }

    // Get tenantId from project
    const project = this.projectStorage.getById(projectId);
    const tenantId = project?.tenant_id ?? 'default';

    // Try loading from disk
    try {
      const diskHistory = await this.chatHistoryStorage.loadChatHistory(convId, projectId, tenantId, userId);
      if (diskHistory.length > 0) {
        // Store in memory for faster access
        this.convHistories[cacheKey] = {
          convId,
          projectId,
          tenantId,
          messages: diskHistory,
          lastUpdated: Date.now(),
          messageCount: diskHistory.length,
        };
        return [...diskHistory];
      }
    } catch (error) {
      logger.error({ error, convId }, '[MessagePersistence] Error loading history');
    }

    return [];
  }

  /**
   * Synchronous version of getClientHistory for backward compatibility
   * Only returns in-memory history
   */
  getClientHistorySync(convId: string, projectId: string, userId: string = DEFAULT_USER_ID): ChatCompletionMessageParam[] {
    const cacheKey = this.getCacheKey(projectId, userId, convId);
    const history = this.convHistories[cacheKey];
    if (!history) {
      return [];
    }
    return [...history.messages];
  }

  /**
   * Set message history for a conversation
   * Also saves to disk
   */
  setClientHistory(
    convId: string,
    messages: ChatCompletionMessageParam[],
    projectId: string,
    userId: string = DEFAULT_USER_ID
  ): void {
    const cacheKey = this.getCacheKey(projectId, userId, convId);

    // Get tenantId from project
    const project = this.projectStorage.getById(projectId);
    const tenantId = project?.tenant_id ?? 'default';

    this.convHistories[cacheKey] = {
      convId,
      projectId,
      tenantId,
      messages: [...messages], // Store a copy
      lastUpdated: Date.now(),
      messageCount: messages.length,
    };

    // Asynchronously save to disk (don't wait)
    // Asynchronously save to disk (don't wait)
    this.chatHistoryStorage.saveChatHistory(convId, messages, projectId, tenantId, userId).catch(error => {
      logger.error({ error, convId }, '[MessagePersistence] Error saving history');
    });
  }

  /**
   * Add a message to conversation history
   * Also saves to disk
   */
  addClientMessage(convId: string, message: ChatCompletionMessageParam, projectId: string, userId: string = DEFAULT_USER_ID): void {
    const cacheKey = this.getCacheKey(projectId, userId, convId);
    if (!this.convHistories[cacheKey]) {
      // Get tenantId from project
      const project = this.projectStorage.getById(projectId);
      const tenantId = project?.tenant_id ?? 'default';

      this.convHistories[cacheKey] = {
        convId,
        projectId,
        tenantId,
        messages: [],
        lastUpdated: Date.now(),
        messageCount: 0,
      };
    }

    this.convHistories[cacheKey].messages.push(message);
    this.convHistories[cacheKey].lastUpdated = Date.now();
    this.convHistories[cacheKey].messageCount++;

    // Asynchronously save to disk (don't wait)
    const messages = this.convHistories[cacheKey].messages;
    const project = this.projectStorage.getById(projectId);
    const tenantId = project?.tenant_id ?? 'default';
    this.chatHistoryStorage.saveChatHistory(convId, messages, projectId, tenantId, userId).catch(error => {
      logger.error({ error, convId }, '[MessagePersistence] Error saving history');
    });
  }

  /**
   * Clear message history for a conversation
   */
  clearClientHistory(convId: string, projectId: string, userId: string = DEFAULT_USER_ID, keepSystemPrompt: boolean = true): void {
    const cacheKey = this.getCacheKey(projectId, userId, convId);
    const history = this.convHistories[cacheKey];
    if (!history) return;

    if (keepSystemPrompt && history.messages[0]?.role === "system") {
      history.messages = [history.messages[0]];
      history.messageCount = 1;
    } else {
      history.messages = [];
      history.messageCount = 0;
    }
    history.lastUpdated = Date.now();
  }

  /**
   * Delete conversation history completely
   */
  deleteClientHistory(convId: string, projectId: string, userId: string = DEFAULT_USER_ID): boolean {
    const cacheKey = this.getCacheKey(projectId, userId, convId);
    if (this.convHistories[cacheKey]) {
      delete this.convHistories[cacheKey];
      return true;
    }
    return false;
  }

  /**
   * Get all conversation histories metadata
   */
  getAllClientHistories(): Omit<ConvMessageHistory, "messages">[] {
    return Object.values(this.convHistories).map(
      ({ messages, ...metadata }) => metadata
    );
  }

  /**
   * Get statistics about stored histories
   */
  getStats(): {
    totalClients: number;
    totalMessages: number;
    oldestHistory?: number;
    newestHistory?: number;
  } {
    const histories = Object.values(this.convHistories);
    const totalMessages = histories.reduce((sum, h) => sum + h.messageCount, 0);
    const timestamps = histories.map((h) => h.lastUpdated);

    return {
      totalClients: histories.length,
      totalMessages,
      oldestHistory:
        timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestHistory:
        timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }

  /**
   * Clean up old histories (older than specified milliseconds)
   */
  cleanupOldHistories(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const key in this.convHistories) {
      if (
        this.convHistories[key] &&
        this.convHistories[key].lastUpdated < cutoff
      ) {
        delete this.convHistories[key];
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Check if conversation has history
   */
  hasClientHistory(convId: string, projectId: string, userId: string = DEFAULT_USER_ID): boolean {
    const cacheKey = this.getCacheKey(projectId, userId, convId);
    return (
      !!this.convHistories[cacheKey] &&
      this.convHistories[cacheKey].messages.length > 0
    );
  }

  /**
   * Get message count for a conversation
   */
  getClientMessageCount(convId: string, projectId: string, userId: string = DEFAULT_USER_ID): number {
    const cacheKey = this.getCacheKey(projectId, userId, convId);
    return this.convHistories[cacheKey]?.messageCount || 0;
  }

  /**
   * Check if compaction is needed and perform it
   * This should be called after adding messages
   */
  async checkAndCompact(projectId: string, convId: string, userId: string = DEFAULT_USER_ID): Promise<{
    compacted: boolean;
    newChatFile?: string;
    tokensSaved?: number;
  }> {
    try {
      // Get tenantId from project
      const projectStorage = ProjectStorage.getInstance();
      const project = projectStorage.getById(projectId);
      const tenantId = project?.tenant_id ?? 'default';

      // Check if compaction is needed
      const shouldCompact = await chatCompaction.shouldCompact(projectId, convId, tenantId);

      if (!shouldCompact) {
        return { compacted: false };
      }

      // Get current messages
      const messages = await this.getClientHistory(convId, projectId, userId);

      // Perform compaction
      const result = await chatCompaction.compactChat(projectId, convId, tenantId, messages);

      if (result.compacted && result.newChatFile) {
        logger.info({ messagesCompacted: result.messagesCompacted, convId }, '[MessagePersistence] Compacted messages');
        logger.info({ tokensSaved: result.tokensSaved }, '[MessagePersistence] Saved tokens');
        logger.info({ newChatFile: result.newChatFile }, '[MessagePersistence] New chat file');

        // Note: We don't automatically update the in-memory history here
        // The compacted history will be loaded on next server restart
        // or when the conversation is reloaded
      }

      return {
        compacted: result.compacted,
        newChatFile: result.newChatFile,
        tokensSaved: result.tokensSaved
      };
    } catch (error) {
      logger.error({ error, convId }, '[MessagePersistence] Error during compaction check');
      return { compacted: false };
    }
  }

  /**
   * Get compaction status for a conversation
   */
  async getCompactionStatus(projectId: string, convId: string, userId: string = DEFAULT_USER_ID) {
    // Get tenantId from project
    const projectStorage = ProjectStorage.getInstance();
    const project = projectStorage.getById(projectId);
    const tenantId = project?.tenant_id ?? 'default';

    return await chatCompaction.getCompactionStatus(projectId, convId, tenantId);
  }
}
