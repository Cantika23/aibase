import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject, Observable, fromEvent, of } from 'rxjs';
import { takeUntil, filter, map, tap, catchError } from 'rxjs/operators';
import {
  WSMessage,
  MessageType,
  UserMessageData,
  ChatMessage,
  ConnectionState,
  StatusData,
  WSClientOptions,
  ToolCallData,
  ToolResultData,
  FileUploadData,
  FileListData,
  FileRequestData,
  FileUploadResponseData,
  FileListResponseData,
  FileContentData,
} from '../models/chat-message';
import { WSClient } from '../lib/ws-client';

@Injectable({
  providedIn: 'root',
})
export class WebsocketService implements OnDestroy {
  private static instanceCount = 0;
  private instanceId: number;
  private wsClient: WSClient | null = null;
  private destroy$ = new Subject<void>();
  private processedMessageIds = new Set<string>(); // Track processed message IDs
  private lastProcessedContent = ''; // Track last content to prevent duplicates
  private currentStreamingId: string | null = null; // Track current streaming message ID

  constructor() {
    this.instanceId = ++WebsocketService.instanceCount;
    this.initializeClient();
  }

  private connectionState$ = new BehaviorSubject<ConnectionState>({
    status: 'disconnected',
    messageCount: 0
  });

  private messages$ = new Subject<ChatMessage>();
  private status$ = new Subject<StatusData>();
  private errors$ = new Subject<Error>();
  private toolCalls$ = new Subject<ToolCallData>();
  private toolResults$ = new Subject<ToolResultData>();
  private reconnecting$ = new Subject<{ attempt: number; maxAttempts: number }>();

  // Enhanced events for better integration with the robust client
  private llmChunks$ = new Subject<{ chunk: string; sequence?: number }>();
  private llmComplete$ = new Subject<{ fullText: string; messageId: string }>();

  // File-related events
  private fileUploadResponses$ = new Subject<FileUploadResponseData>();
  private fileListResponses$ = new Subject<FileListResponseData>();
  private fileContents$ = new Subject<FileContentData>();

  private get wsUrl(): string {
    // Use the proxied path on the same domain
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/api/ws`;
    }
    return 'ws://localhost:4200/api/ws'; // Default Angular dev server port
  }

  
  ngOnDestroy(): void {
    this.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Observable getters for Angular components
  get connectionState(): Observable<ConnectionState> {
    return this.connectionState$.asObservable();
  }

  get messages(): Observable<ChatMessage> {
    return this.messages$.asObservable();
  }

  get status(): Observable<StatusData> {
    return this.status$.asObservable();
  }

  get errors(): Observable<Error> {
    return this.errors$.asObservable();
  }

  get toolCalls(): Observable<ToolCallData> {
    return this.toolCalls$.asObservable();
  }

  get toolResults(): Observable<ToolResultData> {
    return this.toolResults$.asObservable();
  }

  get reconnecting(): Observable<{ attempt: number; maxAttempts: number }> {
    return this.reconnecting$.asObservable();
  }

  get llmChunks(): Observable<{ chunk: string; sequence?: number }> {
    return this.llmChunks$.asObservable();
  }

  get llmComplete(): Observable<{ fullText: string; messageId: string }> {
    return this.llmComplete$.asObservable();
  }

  // File-related observable getters
  get fileUploadResponses(): Observable<FileUploadResponseData> {
    return this.fileUploadResponses$.asObservable();
  }

  get fileListResponses(): Observable<FileListResponseData> {
    return this.fileListResponses$.asObservable();
  }

  get fileContents(): Observable<FileContentData> {
    return this.fileContents$.asObservable();
  }

  // Enhanced connection methods
  async connect(): Promise<void> {
    try {
      console.log('WebSocketService: Attempting to connect...');
      if (!this.wsClient) {
        this.handlersSetup = false; // Reset flag for new client
        this.initializeClient();
      }
      console.log('WebSocketService: Connecting client to:', this.wsUrl);
      await this.wsClient!.connect();
      console.log('WebSocketService: Connected successfully');
    } catch (error) {
      console.error('WebSocketService: Connection failed:', error);
      this.errors$.next(error as Error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  }

  isConnected(): boolean {
    return this.wsClient?.isConnected() ?? false;
  }

  getConnectionState(): ConnectionState {
    return this.wsClient?.getConnectionState() ?? { status: 'disconnected', messageCount: 0 };
  }

  getStats() {
    return this.wsClient?.getStats() ?? {
      messagesSent: 0,
      messagesReceived: 0,
      reconnectCount: 0,
    };
  }

  // Enhanced messaging methods
  async sendMessage(text: string, options?: UserMessageData['options']): Promise<any> {
    console.log('WebSocketService: Attempting to send message:', text);
    if (!this.wsClient) {
      console.error('WebSocketService: WebSocket client not initialized');
      throw new Error('WebSocket client not initialized');
    }
    console.log('WebSocketService: Sending message via client...');
    return this.wsClient.sendMessage(text, options);
  }

  sendControl(type: 'abort' | 'clear_history' | 'get_history' | 'get_status'): void {
    if (!this.wsClient) {
      console.warn('WebSocket client not initialized, cannot send control message');
      return;
    }
    this.wsClient.sendControl({ type });
  }

  // Enhanced control methods
  abort(): void {
    this.sendControl('abort');
  }

  clearHistory(): void {
    this.sendControl('clear_history');
  }

  getHistory(): void {
    this.sendControl('get_history');
  }

  getStatus(): void {
    this.sendControl('get_status');
  }

  // File operation methods
  uploadFiles(files: Array<{ name: string; size: number; type: string; data?: string }>): void {
    if (!this.wsClient) {
      console.warn('WebSocket client not initialized, cannot upload files');
      return;
    }

    const message: WSMessage = {
      type: 'file_upload',
      id: this.generateMessageId(),
      data: { files } as FileUploadData,
      metadata: { timestamp: Date.now() }
    };

    this.wsClient.send(message);
  }

  listFiles(): void {
    if (!this.wsClient) {
      console.warn('WebSocket client not initialized, cannot list files');
      return;
    }

    const message: WSMessage = {
      type: 'file_list',
      id: this.generateMessageId(),
      data: {} as FileListData,
      metadata: { timestamp: Date.now() }
    };

    this.wsClient.send(message);
  }

  requestFile(fileName: string, asBase64: boolean = false): void {
    if (!this.wsClient) {
      console.warn('WebSocket client not initialized, cannot request file');
      return;
    }

    const message: WSMessage = {
      type: 'file_request',
      id: this.generateMessageId(),
      data: { fileName, asBase64 } as FileRequestData,
      metadata: { timestamp: Date.now() }
    };

    this.wsClient.send(message);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private initializeClient(): void {
    const options: WSClientOptions = {
      url: this.wsUrl,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      timeout: 30000, // Increased timeout to 30 seconds
    };

    this.wsClient = new WSClient(options);
    this.setupClientEventHandlers();
  }

  private handlersSetup = false;

  private setupClientEventHandlers(): void {
    if (!this.wsClient || this.handlersSetup) {
      return;
    }

    this.handlersSetup = true;

    // Connection events - Use only the status event for authoritative state updates
    this.wsClient.on('disconnected', () => {
      this.updateConnectionState('disconnected');
      // Clear deduplication caches on disconnect
      this.processedMessageIds.clear();
      this.lastProcessedContent = '';
      this.currentStreamingId = null;
    });

    this.wsClient.on('reconnecting', (data: { attempt: number; maxAttempts: number }) => {
      this.updateConnectionState('reconnecting');
      this.reconnecting$.next(data);
    });

    this.wsClient.on('error', (error: Error) => {
      this.updateConnectionState('error');
      this.errors$.next(error);
    });

    // Note: 'connected' and 'status_change' events are handled by the 'status' event below
    // This prevents duplicate state emissions

    // Message events
    this.wsClient.on('llm_chunk', (data: { chunk: string; sequence?: number }) => {
      console.log('WebSocketService: Received llm_chunk:', {
        chunk: data.chunk?.substring(0, 50) + '...',
        sequence: data.sequence,
        currentStreamingId: this.currentStreamingId
      });

      // Prevent duplicate chunks
      if (data.chunk === this.lastProcessedContent) {
        console.log('WebSocketService: Skipping duplicate chunk');
        return; // Skip duplicate content
      }
      this.lastProcessedContent = data.chunk;

      // Initialize streaming ID if this is the first chunk
      if (!this.currentStreamingId) {
        this.currentStreamingId = `stream_${Date.now()}`;
        console.log('WebSocketService: Initialized new streaming ID:', this.currentStreamingId);
      }

      this.llmChunks$.next(data);

      // Also emit as chat message for backward compatibility
      const chatMessage: ChatMessage = {
        id: this.currentStreamingId, // Use consistent ID for all chunks of same message
        type: 'assistant',
        content: data.chunk,
        timestamp: Date.now(),
        isComplete: false,
        metadata: { sequence: data.sequence }
      };
      console.log('WebSocketService: Emitting chat message with ID:', chatMessage.id, 'content length:', chatMessage.content.length);
      this.messages$.next(chatMessage);
    });

    this.wsClient.on('llm_complete', (data: { fullText: string; messageId: string }) => {
      console.log('WebSocketService: Received llm_complete:', {
        messageId: data.messageId,
        fullTextLength: data.fullText?.length || 0,
        currentStreamingId: this.currentStreamingId,
        isDuplicate: this.processedMessageIds.has(data.messageId)
      });

      // Prevent duplicate complete messages
      if (this.processedMessageIds.has(data.messageId)) {
        console.log('WebSocketService: Skipping duplicate complete message');
        return; // Skip duplicate message
      }
      this.processedMessageIds.add(data.messageId);

      this.llmComplete$.next(data);

      // Use the current streaming ID if available, otherwise use messageId
      const finalMessageId = this.currentStreamingId || data.messageId;
      console.log('WebSocketService: Using final message ID:', finalMessageId);

      // Also emit as chat message for backward compatibility
      const chatMessage: ChatMessage = {
        id: finalMessageId,
        type: 'assistant',
        content: data.fullText,
        timestamp: Date.now(),
        isComplete: true
      };
      console.log('WebSocketService: Emitting complete chat message with ID:', chatMessage.id, 'content length:', chatMessage.content.length);
      this.messages$.next(chatMessage);

      // Reset streaming ID for next message
      this.currentStreamingId = null;
      console.log('WebSocketService: Reset streaming ID to null');
      this.incrementMessageCount();
    });

    this.wsClient.on('tool_call', (data: ToolCallData) => {
      this.toolCalls$.next(data);
    });

    this.wsClient.on('tool_result', (data: ToolResultData) => {
      this.toolResults$.next(data);
    });

    this.wsClient.on('communication_error', (data: { code: string; message: string }) => {
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        type: 'error',
        content: data.message,
        timestamp: Date.now(),
        isComplete: true
      };
      this.messages$.next(errorMessage);
    });

    this.wsClient.on('control', (data: any) => {
      // Emit control responses (including history responses)
      this.status$.next(data as StatusData);
    });

    this.wsClient.on('status', (data: any) => {
      // Handle connection states
      if (data.status === 'connected') {
        this.updateConnectionStateWithInfo('connected', data);
      } else if (data.status === 'connecting') {
        this.updateConnectionState('connecting');
      } else if (data.status === 'processing') {
        // 'processing' is a temporary state, keep current connection state
      }

      // Emit all status events (connection states + control responses)
      this.status$.next(data as StatusData);
    });

    // File-related event handlers
    this.wsClient.on('file_upload_response', (data: FileUploadResponseData) => {
      this.fileUploadResponses$.next(data);
    });

    this.wsClient.on('file_list_response', (data: FileListResponseData) => {
      this.fileListResponses$.next(data);
    });

    this.wsClient.on('file_content', (data: FileContentData) => {
      this.fileContents$.next(data);
    });
  }

  private updateConnectionState(status: ConnectionState['status']): void {
    const currentState = this.connectionState$.value;
    const stats = this.getStats();
    this.connectionState$.next({
      ...currentState,
      status,
      connectedAt: stats.connectedAt,
      clientId: this.wsClient?.getConnectionState().clientId,
      sessionId: this.wsClient?.getConnectionState().sessionId,
    });
  }

  private updateConnectionStateWithInfo(status: ConnectionState['status'], info: any): void {
    const currentState = this.connectionState$.value;
    const stats = this.getStats();
    this.connectionState$.next({
      ...currentState,
      status,
      connectedAt: stats.connectedAt || Date.now(),
      clientId: info.clientId || this.wsClient?.getConnectionState().clientId,
      sessionId: info.sessionId || this.wsClient?.getConnectionState().sessionId,
    });
  }

  private incrementMessageCount(): void {
    const currentState = this.connectionState$.value;
    this.connectionState$.next({
      ...currentState,
      messageCount: currentState.messageCount + 1,
    });
  }
}
