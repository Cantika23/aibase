/**
 * Chat history storage service
 * Persists conversation history to disk at:
 * /data/projects/{tenantId}/{projectId}/conversations/{userId}/{convId}/chats/{timestamp}.json
 *
 * For anonymous users (no userId), uses "anonymous" as the user path.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { 
  getConversationChatsDir, 
  getConversationDir,
  getProjectConversationsDir,
  getUserConversationsDir,
  DEFAULT_USER_ID 
} from '../config/paths';
import { createLogger } from '../utils/logger';

const logger = createLogger('ChatHistoryStorage');

export interface ChatHistoryMetadata {
  convId: string;
  projectId: string;
  createdAt: number;
  lastUpdatedAt: number;
  messageCount: number;
  userId?: string; // Track which user owns this conversation
}

export interface ChatHistoryFile {
  metadata: ChatHistoryMetadata;
  messages: ChatCompletionMessageParam[];
}

export class ChatHistoryStorage {
  private static instance: ChatHistoryStorage;
  private convStartTimes = new Map<string, number>(); // Track conversation start times

  private constructor() {
    // No longer needed - using paths.ts functions
  }

  static getInstance(): ChatHistoryStorage {
    if (!ChatHistoryStorage.instance) {
      ChatHistoryStorage.instance = new ChatHistoryStorage();
    }
    return ChatHistoryStorage.instance;
  }

  /**
   * Generate a unique cache key for convStartTimes map
   */
  private getConvKey(projectId: string, convId: string, userId: string = DEFAULT_USER_ID): string {
    return `${projectId}:${userId}:${convId}`;
  }

  /**
   * Get the chat file path for a conversation
   */
  private getChatFilePath(convId: string, projectId: string, tenantId: number | string, userId: string = DEFAULT_USER_ID): string {
    const chatDir = getConversationChatsDir(projectId, convId, tenantId, userId);
    const convKey = this.getConvKey(projectId, convId, userId);
    const timestamp = this.convStartTimes.get(convKey) || Date.now();

    // Store the timestamp for this conversation if not already set
    if (!this.convStartTimes.has(convKey)) {
      this.convStartTimes.set(convKey, timestamp);
    }

    return path.join(chatDir, `${timestamp}.json`);
  }

  /**
   * Ensure chat directory exists
   */
  private async ensureChatDir(convId: string, projectId: string, tenantId: number | string, userId: string = DEFAULT_USER_ID): Promise<void> {
    const chatDir = getConversationChatsDir(projectId, convId, tenantId, userId);
    await fs.mkdir(chatDir, { recursive: true });
  }

  /**
   * Load chat history from disk
   * Returns empty array if file doesn't exist
   */
  async loadChatHistory(
    convId: string,
    projectId: string,
    tenantId: number | string,
    userId: string = DEFAULT_USER_ID
  ): Promise<ChatCompletionMessageParam[]> {
    const chatDir = getConversationChatsDir(projectId, convId, tenantId, userId);
    const convKey = this.getConvKey(projectId, convId, userId);

    try {
      // Check if chat directory exists
      const dirExists = await fs.access(chatDir).then(() => true).catch(() => false);
      if (!dirExists) {
        return [];
      }

      // List all chat history files
      const files = await fs.readdir(chatDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        return [];
      }

      // Get the most recent chat file (highest timestamp)
      const latestFile = jsonFiles.sort().reverse()[0];
      if (!latestFile) {
        return [];
      }

      // Extract timestamp from filename and store it
      const timestamp = parseInt(latestFile.replace('.json', ''));
      if (!isNaN(timestamp)) {
        this.convStartTimes.set(convId, timestamp);
      }

      const filePath = path.join(chatDir, latestFile);
      const content = await fs.readFile(filePath, 'utf-8');
      const data: ChatHistoryFile = JSON.parse(content);

      logger.info({ messageCount: data.messages.length, file: latestFile }, 'Loaded messages from file');
      return data.messages;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet
        return [];
      }
      logger.error({ error }, 'Error loading chat history');
      throw error;
    }
  }

  /**
   * Save chat history to disk
   */
  async saveChatHistory(
    convId: string,
    messages: ChatCompletionMessageParam[],
    projectId: string,
    tenantId: number | string,
    userId?: string
  ): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureChatDir(convId, projectId, tenantId, userId);

      const filePath = this.getChatFilePath(convId, projectId, tenantId, userId);
      const convKey = this.getConvKey(projectId, convId, userId);
      const timestamp = this.convStartTimes.get(convKey) || Date.now();

      const chatHistory: ChatHistoryFile = {
        metadata: {
          convId,
          projectId,
          createdAt: timestamp,
          lastUpdatedAt: Date.now(),
          messageCount: messages.length,
        },
        messages,
      };

      // Write to file with pretty formatting
      await fs.writeFile(
        filePath,
        JSON.stringify(chatHistory, null, 2),
        'utf-8'
      );

      logger.info({ messageCount: messages.length, file: path.basename(filePath) }, 'Saved messages to file');
    } catch (error) {
      logger.error({ error }, 'Error saving chat history');
      throw error;
    }
  }

  /**
   * Get all chat history files for a conversation
   */
  async listChatHistoryFiles(
    convId: string,
    projectId: string,
    tenantId: number | string,
    userId: string = DEFAULT_USER_ID
  ): Promise<string[]> {
    const chatDir = getConversationChatsDir(projectId, convId, tenantId, userId);
    
    // Check legacy paths if new path doesn't exist (backward compatibility)
    try {
      await fs.access(chatDir);
    } catch {
       // Only if user is anonymous (legacy default)
       if (userId === DEFAULT_USER_ID || userId === 'anonymous') {
         // Create possible legacy paths
         const { getProjectDir } = await import('../config/paths');
         const projectDir = getProjectDir(projectId, tenantId);
         
         // 1. Direct project/conversations/convId (very old)
         const legacyDir1 = path.join(projectDir, 'conversations', convId, 'chats');
         try {
           const files = await fs.readdir(legacyDir1);
           if (files.length > 0) return files.filter(f => f.endsWith('.json')).sort().reverse();
         } catch {}
         
         // 2. userId in middle but older structure: project/conversations/userId/convId
         const legacyDir2 = path.join(projectDir, 'conversations', userId, convId, 'chats');
         try {
           const files = await fs.readdir(legacyDir2);
           if (files.length > 0) return files.filter(f => f.endsWith('.json')).sort().reverse();
         } catch {}
       }
    }

    try {
      const files = await fs.readdir(chatDir);
      return files.filter(f => f.endsWith('.json')).sort().reverse();
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Delete all chat history files for a conversation
   */
  async deleteChatHistory(
    convId: string,
    projectId: string,
    tenantId: number | string,
    userId: string = DEFAULT_USER_ID
  ): Promise<void> {
    const chatDir = getConversationChatsDir(projectId, convId, tenantId, userId);
    const convKey = this.getConvKey(projectId, convId, userId);

    try {
      // 1. Delete main chat directory
      await fs.rm(chatDir, { recursive: true, force: true });
      this.convStartTimes.delete(convKey);
      
      // 2. Also delete from legacy paths to be sure
      if (userId === DEFAULT_USER_ID || userId === 'anonymous') {
         const { getProjectDir } = await import('../config/paths');
         const projectDir = getProjectDir(projectId, tenantId);
         const legacyDir1 = path.join(projectDir, 'conversations', convId, 'chats');
         await fs.rm(legacyDir1, { recursive: true, force: true }).catch(() => {});
      }
      
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get chat history metadata without loading all messages
   */
  async getChatHistoryMetadata(
    convId: string,
    projectId: string,
    tenantId: number | string,
    userId: string = DEFAULT_USER_ID
  ): Promise<ChatHistoryMetadata | null> {
    const chatDir = getConversationChatsDir(projectId, convId, tenantId, userId);

    try {
      const files = await fs.readdir(chatDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        return null;
      }

      const latestFile = jsonFiles.sort().reverse()[0];
      if (!latestFile) {
        return null;
      }

      const filePath = path.join(chatDir, latestFile);
      const content = await fs.readFile(filePath, 'utf-8');
      const data: ChatHistoryFile = JSON.parse(content);

      return data.metadata;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all conversations for a project
   * Returns metadata for each conversation sorted by lastUpdatedAt (descending)
   */
  async listAllConversations(
    projectId: string,
    tenantId: number | string
  ): Promise<ChatHistoryMetadata[]> {
    const { getProjectConversationsDir } = await import('../config/paths');
    const projectConvDir = getProjectConversationsDir(projectId, tenantId);

    try {
      // Check if project conversations directory exists
      const dirExists = await fs.access(projectConvDir).then(() => true).catch(() => false);
      if (!dirExists) {
        return [];
      }

      // Read all USER directories in the conversations folder
      // Structure: conversations/{userId}/{convId}
      const entries = await fs.readdir(projectConvDir, { withFileTypes: true });
      const userDirs = entries.filter(entry => entry.isDirectory());
      
      const conversations: ChatHistoryMetadata[] = [];
      
      // Iterate through each user directory
      for (const userDir of userDirs) {
        const userId = userDir.name;
        const userPath = path.join(projectConvDir, userId);
        
        try {
          // Read conversation directories for this user
          const convEntries = await fs.readdir(userPath, { withFileTypes: true });
          const convDirs = convEntries.filter(e => e.isDirectory());
          
          for (const convDir of convDirs) {
            const convId = convDir.name;
            const metadata = await this.getChatHistoryMetadata(convId, projectId, tenantId, userId);
            if (metadata) {
              metadata.userId = userId; // Ensure userId is attached
              conversations.push(metadata);
            }
          }
        } catch (error) {
           // Skip if can't read user dir
        }
      }

      // Sort by lastUpdatedAt descending (most recent first)
      conversations.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);

      return conversations;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      logger.error({ error }, 'Error listing conversations');
      throw error;
    }
  }

  /**
   * List all conversations for a specific user within a project
   * Returns metadata for each conversation sorted by lastUpdatedAt (descending)
   */
  async listUserConversations(
    projectId: string,
    tenantId: number | string,
    userId: string
  ): Promise<ChatHistoryMetadata[]> {
    const { getUserConversationsDir } = await import('../config/paths');
    const userDir = getUserConversationsDir(projectId, tenantId, userId);

    try {
      // Check if user directory exists
      const dirExists = await fs.access(userDir).then(() => true).catch(() => false);
      if (!dirExists) {
        return [];
      }

      // Read all conversation directories for this user
      const entries = await fs.readdir(userDir, { withFileTypes: true });
      const convDirs = entries.filter(entry => entry.isDirectory());

      // Get metadata for each conversation in parallel
      const metadataPromises = convDirs.map(async (convDir) => {
        const convId = convDir.name;
        return await this.getChatHistoryMetadata(convId, projectId, tenantId, userId);
      });

      const metadataResults = await Promise.all(metadataPromises);
      const conversations = metadataResults.filter((m): m is ChatHistoryMetadata => m !== null);

      // Sort by lastUpdatedAt descending (most recent first)
      conversations.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);

      return conversations;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      logger.error({ error }, 'Error listing user conversations');
      throw error;
    }
  }
}
