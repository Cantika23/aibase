/**
 * Simple in-memory message persistence service
 * Stores conversation history per conversation ID using a Record structure
 */

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface ConvMessageHistory {
  convId: string;
  messages: ChatCompletionMessageParam[];
  lastUpdated: number;
  messageCount: number;
}

export class MessagePersistence {
  private static instance: MessagePersistence;
  private convHistories: Record<string, ConvMessageHistory> = {};

  private constructor() {}

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
   */
  getClientHistory(convId: string): ChatCompletionMessageParam[] {
    const history = this.convHistories[convId];
    if (!history) {
      return [];
    }
    return [...history.messages]; // Return a copy to prevent direct modification
  }

  /**
   * Set message history for a conversation
   */
  setClientHistory(convId: string, messages: ChatCompletionMessageParam[]): void {
    this.convHistories[convId] = {
      convId,
      messages: [...messages], // Store a copy
      lastUpdated: Date.now(),
      messageCount: messages.length,
    };
  }

  /**
   * Add a message to conversation history
   */
  addClientMessage(convId: string, message: ChatCompletionMessageParam): void {
    if (!this.convHistories[convId]) {
      this.convHistories[convId] = {
        convId,
        messages: [],
        lastUpdated: Date.now(),
        messageCount: 0,
      };
    }

    this.convHistories[convId].messages.push(message);
    this.convHistories[convId].lastUpdated = Date.now();
    this.convHistories[convId].messageCount++;
  }

  /**
   * Clear message history for a conversation
   */
  clearClientHistory(convId: string, keepSystemPrompt: boolean = true): void {
    const history = this.convHistories[convId];
    if (!history) return;

    if (keepSystemPrompt && history.messages[0]?.role === "system") {
      this.convHistories[convId].messages = [history.messages[0]];
      this.convHistories[convId].messageCount = 1;
    } else {
      this.convHistories[convId].messages = [];
      this.convHistories[convId].messageCount = 0;
    }
    this.convHistories[convId].lastUpdated = Date.now();
  }

  /**
   * Delete conversation history completely
   */
  deleteClientHistory(convId: string): boolean {
    if (this.convHistories[convId]) {
      delete this.convHistories[convId];
      return true;
    }
    return false;
  }

  /**
   * Get all conversation histories metadata
   */
  getAllClientHistories(): Omit<ConvMessageHistory, "messages">[] {
    return Object.values(this.convHistories).map(({ messages, ...metadata }) => metadata);
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
    const timestamps = histories.map(h => h.lastUpdated);

    return {
      totalClients: histories.length,
      totalMessages,
      oldestHistory: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestHistory: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }

  /**
   * Clean up old histories (older than specified milliseconds)
   */
  cleanupOldHistories(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const convId in this.convHistories) {
      if (this.convHistories[convId].lastUpdated < cutoff) {
        delete this.convHistories[convId];
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Check if conversation has history
   */
  hasClientHistory(convId: string): boolean {
    return !!this.convHistories[convId] && this.convHistories[convId].messages.length > 0;
  }

  /**
   * Get message count for a conversation
   */
  getClientMessageCount(convId: string): number {
    return this.convHistories[convId]?.messageCount || 0;
  }
}