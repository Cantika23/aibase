/**
 * WebSocket server for bidirectional LLM communication
 */

import type {
  WSServerOptions,
  WSMessage,
  SessionInfo,
  ControlMessage,
  UserMessageData,
} from "./types";
import { Conversation, Tool } from "../llm/conversation";
import { getBuiltinTools } from "../tools/builtin-tools";
import { getAllAvailableTools } from "../tools/conversation-tools";
import { WSEventEmitter } from "./events";
import { MessagePersistence } from "./message-persistence";

// Use Bun's built-in WebSocket type for compatibility
// This matches Bun's ServerWebSocket interface
type ServerWebSocket = any; // Bun's ServerWebSocket type

// WebSocket ready states
const WebSocketReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

// Streaming chunk accumulator for broadcasting to new connections
interface StreamingState {
  convId: string;
  messageId: string;
  chunks: string[];
  fullResponse: string;
  isComplete: boolean;
  startTime: number;
  lastChunkTime: number;
}

class StreamingManager {
  private activeStreams = new Map<string, StreamingState>(); // key: convId_messageId

  startStream(convId: string, messageId: string): void {
    const key = `${convId}_${messageId}`;
    this.activeStreams.set(key, {
      convId,
      messageId,
      chunks: [],
      fullResponse: '',
      isComplete: false,
      startTime: Date.now(),
      lastChunkTime: Date.now(),
    });
  }

  addChunk(convId: string, messageId: string, chunk: string): void {
    const key = `${convId}_${messageId}`;
    const stream = this.activeStreams.get(key);
    if (!stream) return;

    stream.chunks.push(chunk);
    stream.fullResponse += chunk;
    stream.lastChunkTime = Date.now();
  }

  completeStream(convId: string, messageId: string): void {
    const key = `${convId}_${messageId}`;
    const stream = this.activeStreams.get(key);
    if (stream) {
      stream.isComplete = true;
    }
  }

  getStream(convId: string, messageId: string): StreamingState | undefined {
    const key = `${convId}_${messageId}`;
    return this.activeStreams.get(key);
  }

  getActiveStreamsForConv(convId: string): StreamingState[] {
    return Array.from(this.activeStreams.values()).filter(stream =>
      stream.convId === convId && !stream.isComplete
    );
  }

  getAllStreamsForConv(convId: string): StreamingState[] {
    return Array.from(this.activeStreams.values()).filter(stream =>
      stream.convId === convId
    );
  }

  // Clean up old completed streams (older than 5 minutes)
  cleanup(): void {
    const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes
    for (const [key, stream] of this.activeStreams) {
      if (stream.isComplete && stream.lastChunkTime < cutoff) {
        this.activeStreams.delete(key);
      }
    }
  }
}

export class WSServer extends WSEventEmitter {
  private options: WSServerOptions;
  private connections = new Map<ServerWebSocket, ConnectionInfo>();
  private sessions = new Map<string, SessionInfo>();
  private heartbeats = new Map<ServerWebSocket, NodeJS.Timeout>();
  private messagePersistence: MessagePersistence;
  private streamingManager: StreamingManager;
  private cleanupInterval: NodeJS.Timeout;

  constructor(options: WSServerOptions = {}) {
    super();
    this.options = {
      maxConnections: 100,
      heartbeatInterval: 30000,
      enableCompression: true,
      conversationOptions: {},
      ...options,
    };
    this.messagePersistence = MessagePersistence.getInstance();
    this.streamingManager = new StreamingManager();

    // Start cleanup interval for old streams
    this.cleanupInterval = setInterval(() => {
      this.streamingManager.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Initialize the WebSocket server handlers
   */
  getWebSocketHandlers() {
    return {
      open: this.handleConnectionOpen.bind(this),
      message: this.handleMessage.bind(this),
      close: this.handleConnectionClose.bind(this),
    };
  }

  /**
   * Handle HTTP upgrade requests for WebSocket
   * Note: This method is kept for compatibility but the actual upgrade logic
   * should be handled in the main server where URL parameters are extracted
   */
  handleHttpUpgrade(req: Request, server: any): Response | undefined {
    const url = new URL(req.url);

    // Check if this is a WebSocket upgrade request
    if (url.pathname.startsWith("/api/ws")) {
      // Check connection limit
      if (
        this.options.maxConnections &&
        this.connections.size >= this.options.maxConnections
      ) {
        return new Response("Server at capacity", { status: 503 });
      }

      // For direct usage without the main server, extract convId here
      const convId = url.searchParams.get("convId");
      const upgraded = server.upgrade(req, { data: { convId } });
      if (upgraded) {
        return undefined; // WebSocket connection established
      }
    }

    return new Response("Not found", { status: 404 });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    // Clear all heartbeats
    for (const timer of this.heartbeats.values()) {
      clearInterval(timer);
    }
    this.heartbeats.clear();

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Clear all connections
    this.connections.clear();
    this.sessions.clear();

    this.emit("stopped");
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get connection count for a specific conversation
   */
  getConnectionCountForConv(convId: string): number {
    return this.getConnectionsForConv(convId).length;
  }

  /**
   * Get all conversation IDs with active connections
   */
  getActiveConvIds(): string[] {
    const convIds = new Set<string>();
    for (const connInfo of this.connections.values()) {
      convIds.add(connInfo.convId);
    }
    return Array.from(convIds);
  }

  /**
   * Get connection information for debugging
   */
  getConnectionInfo(): { [convId: string]: { connectionCount: number; sessionIds: string[] } } {
    const info: { [convId: string]: { connectionCount: number; sessionIds: string[] } } = {};

    for (const connInfo of this.connections.values()) {
      if (!info[connInfo.convId]) {
        info[connInfo.convId] = {
          connectionCount: 0,
          sessionIds: []
        };
      }
      info[connInfo.convId].connectionCount++;
      info[connInfo.convId].sessionIds.push(connInfo.sessionId);
    }

    return info;
  }

  /**
   * Send message to specific client
   */
  sendToClient(convId: string, message: WSMessage): boolean {
    for (const [ws, connInfo] of this.connections) {
      if (connInfo.convId === convId) {
        return this.sendToWebSocket(ws, message);
      }
    }
    return false;
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WSMessage, excludeClientId?: string): number {
    let sent = 0;
    for (const [ws, connInfo] of this.connections) {
      if (connInfo.convId !== excludeClientId) {
        if (this.sendToWebSocket(ws, message)) {
          sent++;
        }
      }
    }
    return sent;
  }

  /**
   * Get all WebSocket connections for a specific conversation ID
   */
  getConnectionsForConv(convId: string): ServerWebSocket[] {
    const connections: ServerWebSocket[] = [];
    for (const [ws, connInfo] of this.connections) {
      if (connInfo.convId === convId) {
        connections.push(ws);
      }
    }
    return connections;
  }

  /**
   * Send accumulated chunks to a newly connected WebSocket
   */
  private sendAccumulatedChunks(ws: ServerWebSocket, convId: string): void {
    const allStreams = this.streamingManager.getAllStreamsForConv(convId);

    for (const stream of allStreams) {
      // Send all accumulated chunks for this stream
      for (const chunk of stream.chunks) {
        this.sendToWebSocket(ws, {
          type: "llm_chunk",
          id: stream.messageId,
          data: { chunk, isComplete: false },
          metadata: {
            timestamp: stream.lastChunkTime,
            convId: stream.convId,
          },
        });
      }

      // If stream is complete, send completion message
      if (stream.isComplete) {
        this.sendToWebSocket(ws, {
          type: "llm_complete",
          id: stream.messageId,
          data: { fullText: stream.fullResponse },
          metadata: {
            timestamp: stream.lastChunkTime,
            convId: stream.convId,
          },
        });
      }
    }
  }

  private async handleConnectionOpen(ws: ServerWebSocket): Promise<void> {
    // Extract client ID from URL parameters if provided
    let urlClientId: string | null = null;

    try {
      // Extract client ID from the data passed during upgrade
      urlClientId = ws.data?.convId || null;
    } catch (error) {
      console.warn("Failed to extract client ID from WebSocket data:", error);
    }

    // Use provided client ID or generate a new one
    const convId = urlClientId || this.generateClientId();
    const sessionId = this.generateSessionId();

    const connectionInfo: ConnectionInfo = {
      convId,
      sessionId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      isAlive: true,
    };

    this.connections.set(ws, connectionInfo);

    // Create session
    const sessionInfo: SessionInfo = {
      id: sessionId,
      convId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
    };
    this.sessions.set(sessionId, sessionInfo);

    // Create conversation for this session with existing history
    const existingHistory = this.messagePersistence.getClientHistory(convId);
    const conversation = await this.createConversation(existingHistory);
    connectionInfo.conversation = conversation;

    // Hook into conversation to persist changes to MessagePersistence
    const originalAddMessage = conversation.addMessage.bind(conversation);
    conversation.addMessage = (message: any) => {
      originalAddMessage(message);
      // Immediately persist the updated conversation history
      const history = (conversation as any)._history || [];
      this.messagePersistence.setClientHistory(convId, history);
    };

    // Start heartbeat for this connection
    this.startHeartbeat(ws);

    // Send accumulated chunks from active streams for this conversation
    this.sendAccumulatedChunks(ws, convId);

    // Send welcome message
    this.sendToWebSocket(ws, {
      type: "status",
      id: this.generateMessageId(),
      data: {
        status: "connected",
        message: "Connected to chat server",
        convId,
        sessionId,
      },
      metadata: {
        timestamp: Date.now(),
        convId,
        sessionId,
      },
    });

    this.emit("client_connected", { convId, sessionId, ws });
  }

  private async handleMessage(
    ws: ServerWebSocket,
    message: string | Buffer
  ): Promise<void> {
    const connectionInfo = this.connections.get(ws);
    if (!connectionInfo) return;

    try {
      const wsMessage: WSMessage = JSON.parse(message.toString());
      connectionInfo.lastActivity = Date.now();
      connectionInfo.messageCount++;

      // Update session
      const session = this.sessions.get(connectionInfo.sessionId);
      if (session) {
        session.lastActivity = Date.now();
        session.messageCount++;
      }

      await this.processMessage(ws, connectionInfo, wsMessage);
    } catch (error) {
      console.error("Failed to process message:", error);
      this.sendError(ws, "INVALID_MESSAGE", "Failed to parse message");
    }
  }

  private async processMessage(
    ws: ServerWebSocket,
    connectionInfo: ConnectionInfo,
    message: WSMessage
  ): Promise<void> {
    switch (message.type) {
      case "user_message":
        await this.handleUserMessage(ws, connectionInfo, message);
        break;

      case "control":
        await this.handleControlMessage(ws, connectionInfo, message);
        break;

      case "ping":
        this.sendToWebSocket(ws, {
          type: "pong",
          id: message.id,
          metadata: { timestamp: Date.now() },
        });
        break;

      default:
        this.sendError(
          ws,
          "UNKNOWN_MESSAGE_TYPE",
          `Unknown message type: ${message.type}`
        );
    }
  }

  private async handleUserMessage(
    ws: ServerWebSocket,
    connectionInfo: ConnectionInfo,
    message: WSMessage
  ): Promise<void> {
    const conversation = connectionInfo.conversation;
    if (!conversation) {
      this.sendError(ws, "NO_CONVERSATION", "No active conversation");
      return;
    }

    const userData = message.data as UserMessageData;

    // Process message asynchronously without blocking
    this.processUserMessageAsync(ws, connectionInfo, message, userData).catch(
      (error) => {
        console.error("Error processing user message:", error);
        this.sendError(ws, "PROCESSING_ERROR", error.message);
      }
    );
  }

  private async processUserMessageAsync(
    ws: ServerWebSocket,
    connectionInfo: ConnectionInfo,
    originalMessage: WSMessage,
    userData: UserMessageData
  ): Promise<void> {
    const conversation = connectionInfo.conversation;
    if (!conversation) return;

    try {
      // Start tracking this stream in the streaming manager
      this.streamingManager.startStream(connectionInfo.convId, originalMessage.id);

      // Send processing status to all connections for this conversation
      const statusMessage = {
        type: "status" as const,
        id: this.generateMessageId(),
        data: { status: "processing", message: "Processing your message..." },
        metadata: { timestamp: Date.now() },
      };
      this.broadcastToConv(connectionInfo.convId, statusMessage);

      let fullResponse = "";

      // Process message with streaming - no timeouts
      for await (const chunk of conversation.sendMessage(userData.text)) {
        fullResponse += chunk;

        // Add chunk to streaming manager
        this.streamingManager.addChunk(connectionInfo.convId, originalMessage.id, chunk);

        // Create chunk message
        const chunkMessage = {
          type: "llm_chunk" as const,
          id: originalMessage.id,
          data: { chunk, isComplete: false },
          metadata: {
            timestamp: Date.now(),
            convId: connectionInfo.convId,
          },
        };

        // Broadcast chunk to ALL connections for this conversation
        this.broadcastToConv(connectionInfo.convId, chunkMessage);
      }

      // Mark stream as complete in streaming manager
      this.streamingManager.completeStream(connectionInfo.convId, originalMessage.id);

      // Send completion message to all connections for this conversation
      const completionMessage = {
        type: "llm_complete" as const,
        id: originalMessage.id,
        data: { fullText: fullResponse },
        metadata: {
          timestamp: Date.now(),
          convId: connectionInfo.convId,
        },
      };
      this.broadcastToConv(connectionInfo.convId, completionMessage);

      // Save updated conversation history to persistent storage
      const currentHistory = conversation.history;
      this.messagePersistence.setClientHistory(connectionInfo.convId, currentHistory);
    } catch (error: any) {
      console.error("LLM Processing Error:", error);

      // Mark stream as complete even on error
      this.streamingManager.completeStream(connectionInfo.convId, originalMessage.id);

      const errorMessage = "I apologize, but I encountered an error processing your request. Please try again.";

      // Send error response to all connections
      const errorChunkMessage = {
        type: "llm_chunk" as const,
        id: originalMessage.id,
        data: { chunk: errorMessage, isComplete: false },
        metadata: { timestamp: Date.now() },
      };
      this.broadcastToConv(connectionInfo.convId, errorChunkMessage);

      const errorCompletionMessage = {
        type: "llm_complete" as const,
        id: originalMessage.id,
        data: { fullText: errorMessage },
        metadata: { timestamp: Date.now() },
      };
      this.broadcastToConv(connectionInfo.convId, errorCompletionMessage);
    }
  }

  /**
   * Broadcast message to all connections for a specific conversation
   */
  private broadcastToConv(convId: string, message: WSMessage): number {
    let sent = 0;
    for (const [ws, connInfo] of this.connections) {
      if (connInfo.convId === convId) {
        if (this.sendToWebSocket(ws, message)) {
          sent++;
        }
      }
    }
    return sent;
  }

  private async handleControlMessage(
    ws: ServerWebSocket,
    connectionInfo: ConnectionInfo,
    message: WSMessage
  ): Promise<void> {
    const conversation = connectionInfo.conversation;
    const control = message.data as ControlMessage;

    try {
      switch (control.type) {
        case "abort":
          if (conversation) {
            conversation.abort();
            this.sendToWebSocket(ws, {
              type: "control_response",
              id: message.id,
              data: { status: "aborted", type: control.type },
              metadata: { timestamp: Date.now() },
            });
          }
          break;

        case "clear_history":
          if (conversation) {
            conversation.clearHistory();
            // Also clear from persistent storage
            this.messagePersistence.clearClientHistory(connectionInfo.convId);
            this.sendToWebSocket(ws, {
              type: "control_response",
              id: message.id,
              data: { status: "cleared", type: control.type },
              metadata: { timestamp: Date.now() },
            });
          }
          break;

        case "get_history":
          // Get history from persistent storage (which should match conversation history)
          console.log(`Backend: Getting history for convId: ${connectionInfo.convId}`);
          const history = this.messagePersistence.getClientHistory(connectionInfo.convId);
          console.log(`Backend: Retrieved history:`, {
            hasHistory: !!history,
            messageCount: history?.messageCount || 0,
            messages: history?.messages?.length || 0,
            messagesContent: history?.messages || 'No messages'
          });

          // Also check conversation object directly
          if (connectionInfo.conversation) {
            // Access the private _history array through any available method or property
            const convHistory = (connectionInfo.conversation as any)._history || [];
            console.log(`Backend: Conversation history:`, {
              messageCount: convHistory.length,
              messages: convHistory
            });
          }

          this.sendToWebSocket(ws, {
            type: "control_response",
            id: message.id,
            data: { status: "history", history, type: control.type },
            metadata: { timestamp: Date.now() },
          });
          console.log(`Backend: Sent history response`);
          break;

        case "get_status":
          this.sendToWebSocket(ws, {
            type: "control_response",
            id: message.id,
            data: {
              status: "status_info",
              type: control.type,
              connectedAt: connectionInfo.connectedAt,
              messageCount: connectionInfo.messageCount,
              lastActivity: connectionInfo.lastActivity,
            },
            metadata: { timestamp: Date.now() },
          });
          break;

        default:
          this.sendError(
            ws,
            "UNKNOWN_CONTROL",
            `Unknown control type: ${control.type}`
          );
      }
    } catch (error: any) {
      this.sendError(ws, "CONTROL_ERROR", error.message);
    }
  }

  private handleConnectionClose(
    ws: ServerWebSocket,
    code: number,
    reason: string
  ): void {
    const connectionInfo = this.connections.get(ws);
    if (connectionInfo) {
      // Stop heartbeat
      this.stopHeartbeat(ws);

      // Clean up session
      this.sessions.delete(connectionInfo.sessionId);

      // Remove connection
      this.connections.delete(ws);

      this.emit("client_disconnected", {
        convId: connectionInfo.convId,
        sessionId: connectionInfo.sessionId,
        code,
        reason,
      });
    }
  }

  private async createConversation(initialHistory: any[] = []): Promise<Conversation> {
    const tools = await this.getDefaultTools();
    return new Conversation({
      systemPrompt: `You are a helpful AI assistant connected via WebSocket.
You have access to tools that can help you provide better responses.
Always be helpful and conversational.`,
      initialHistory,
      tools,
      hooks: {},
      ...this.options.conversationOptions,
    });
  }

  private async getDefaultTools(): Promise<Tool[]> {
    try {
      // Try to get advanced tools first
      const advancedTools = await getAllAvailableTools();
      if (advancedTools.length > getBuiltinTools().length) {
        console.log(`Using advanced tool system with ${advancedTools.length} tools`);
        return advancedTools;
      }
    } catch (error) {
      console.warn('Failed to load advanced tools, falling back to basic tools:', error);
    }

    // Fallback to basic tools
    const basicTools = getBuiltinTools();
    return basicTools;
  }

  private sendToWebSocket(ws: ServerWebSocket, message: WSMessage): boolean {
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Failed to send message:", error);
      return false;
    }
  }

  private sendError(ws: ServerWebSocket, code: string, message: string): void {
    this.sendToWebSocket(ws, {
      type: "error",
      id: this.generateMessageId(),
      data: {
        code,
        message,
        recoverable: true,
      },
      metadata: { timestamp: Date.now() },
    });
  }

  private startHeartbeat(ws: ServerWebSocket): void {
    const timer = setInterval(() => {
      const connectionInfo = this.connections.get(ws);
      if (connectionInfo && !connectionInfo.isAlive) {
        // Connection is dead, close it
        ws.terminate();
        return;
      }

      connectionInfo!.isAlive = false;

      // Send ping
      this.sendToWebSocket(ws, {
        type: "ping",
        id: this.generateMessageId(),
        metadata: { timestamp: Date.now() },
      });
    }, this.options.heartbeatInterval);

    this.heartbeats.set(ws, timer);
  }

  private stopHeartbeat(ws: ServerWebSocket): void {
    const timer = this.heartbeats.get(ws);
    if (timer) {
      clearInterval(timer);
      this.heartbeats.delete(ws);
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

interface ConnectionInfo {
  convId: string;
  sessionId: string;
  connectedAt: number;
  lastActivity: number;
  messageCount: number;
  isAlive: boolean;
  conversation?: Conversation;
}
