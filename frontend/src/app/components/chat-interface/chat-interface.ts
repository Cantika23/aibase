import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { WebsocketService } from '../../services/websocket';
import { FileUploadService } from '../../services/file-upload';
import { ChatMessage, ConnectionState } from '../../models/chat-message';
import {
  ZardMessageListComponent,
  ZardMessageInputComponent,
  ChatMessageAction,
  AdditionalMessageOptions,
  MessageInputFile,
} from '../ui';

@Component({
  selector: 'app-chat-interface',
  imports: [CommonModule, FormsModule, ZardMessageListComponent, ZardMessageInputComponent],
  templateUrl: './chat-interface.html',
  styleUrl: './chat-interface.scss',
})
export class ChatInterface implements OnInit, OnDestroy {
  @ViewChild('messageForm') messageForm!: NgForm;
  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  messages: ChatMessage[] = [];
  messageText: string = '';
  attachedFiles: MessageInputFile[] = [];
  isTyping = false;
  isGenerating = false;
  isLoadingHistory = false;
  connectionState: ConnectionState = {
    status: 'disconnected',
    messageCount: 0,
  };

  // Simple properties for template binding
  statusText = 'Disconnected';
  statusClass = 'status-disconnected';

  private destroy$ = new Subject<void>();
  private currentAssistantMessage: ChatMessage | null = null;
  private historyRequested = false;
  messageOptionsFunction = this.getMessageOptions.bind(this);

  // Message input options
  messageInputOptions = {
    submitOnEnter: true,
    enableInterrupt: true,
    allowAttachments: true,
    allowVoiceInput: false, // Can be enabled if you implement transcription
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    placeholder: 'Type your message...',
    rows: 1,
    maxRows: 5,
  };

  constructor(
    private wsService: WebsocketService,
    private fileUploadService: FileUploadService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.wsService.connectionState.pipe(takeUntil(this.destroy$)).subscribe((state) => {
      this.connectionState = state;

      // Manually update display properties
      switch (state.status) {
        case 'connected':
          this.statusText = 'Connected';
          this.statusClass = 'status-connected';
          break;
        case 'connecting':
          this.statusText = 'Connecting...';
          this.statusClass = 'status-connecting';
          break;
        case 'disconnected':
          this.statusText = 'Disconnected';
          this.statusClass = 'status-disconnected';
          break;
        case 'reconnecting':
          this.statusText = 'Reconnecting...';
          this.statusClass = 'status-reconnecting';
          break;
        case 'error':
          this.statusText = 'Connection Error';
          this.statusClass = 'status-error';
          break;
        default:
          this.statusText = 'Unknown';
          this.statusClass = 'status-unknown';
      }

      // Force change detection
      this.cdr.detectChanges();

      // Request chat history when connected (only once)
      if (state.status === 'connected' && !this.historyRequested) {
        this.historyRequested = true;

        // Show loading immediately, not after delay
        this.isLoadingHistory = true;
        this.cdr.detectChanges();

        // Request history after a short delay to ensure connection is stable
        setTimeout(() => {
          this.wsService.getHistory();

          // Add timeout to hide loading state if no response is received
          setTimeout(() => {
            if (this.isLoadingHistory) {
              this.isLoadingHistory = false;
              this.cdr.detectChanges();
            }
          }, 3000); // 3 second timeout
        }, 100); // Reduced delay
      }
    });

    this.wsService.messages.pipe(takeUntil(this.destroy$)).subscribe((message) => {
      this.handleMessage(message);
    });

    // Listen for control responses (including chat history)
    this.wsService.status.pipe(takeUntil(this.destroy$)).subscribe((statusData) => {
      if (statusData.status === 'history' && statusData.history) {
        this.handleHistoryResponse(statusData.history);
      } else if (statusData.status === 'history') {
        // Handle empty history response
        this.handleHistoryResponse([]);
      }
    });

    // Listen for file upload responses
    this.wsService.fileUploadResponses.pipe(takeUntil(this.destroy$)).subscribe((response) => {
      this.handleFileUploadResponse(response);
    });

    // Listen for file list responses
    this.wsService.fileListResponses.pipe(takeUntil(this.destroy$)).subscribe((response) => {
      this.handleFileListResponse(response);
    });

    // Listen for file content responses
    this.wsService.fileContents.pipe(takeUntil(this.destroy$)).subscribe((response) => {
      this.handleFileContentResponse(response);
    });

    // Auto-connect
    this.wsService.connect();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
  }

  sendMessage(): void {
    console.log('ChatInterface: sendMessage called');
    console.log('ChatInterface: messageText:', this.messageText);
    console.log('ChatInterface: connectionState:', this.connectionState);

    if (!this.messageText.trim()) {
      console.log('ChatInterface: No message text, returning');
      return;
    }

    if (this.connectionState.status !== 'connected') {
      console.log('ChatInterface: Not connected, status:', this.connectionState.status);
      return;
    }

    console.log('ChatInterface: Sending message...');

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateMessageId(),
      type: 'user',
      content: this.messageText.trim(),
      timestamp: Date.now(),
      isComplete: true,
    };

    this.messages.push(userMessage);

    // Send to WebSocket
    this.wsService.sendMessage(this.messageText.trim());

    // Clear input
    this.messageText = '';
    this.messageForm.resetForm();

    // Scroll to bottom
    this.scrollToBottom();
  }

  clearHistory(): void {
    this.wsService.sendControl('clear_history');
    this.messages = [];
    this.currentAssistantMessage = null;
  }

  reconnect(): void {
    this.wsService.connect();
  }

  disconnect(): void {
    this.wsService.disconnect();
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private handleMessage(message: ChatMessage): void {
    console.log('ChatInterface: handleMessage called:', {
      id: message.id,
      type: message.type,
      content: message.content?.substring(0, 50) + '...',
      isComplete: message.isComplete,
      currentAssistantMessageId: this.currentAssistantMessage?.id,
      totalMessages: this.messages.length
    });

    if (message.type === 'assistant') {
      if (!message.isComplete) {
        // Streaming response - update existing message or create new one
        if (!this.currentAssistantMessage) {
          console.log('ChatInterface: Creating new assistant message with ID:', message.id);
          this.currentAssistantMessage = {
            ...message,
            content: message.content,
          };
          this.messages.push(this.currentAssistantMessage);
          console.log('ChatInterface: Added new message. Total:', this.messages.length);
        } else {
          console.log('ChatInterface: Appending to existing assistant message ID:', this.currentAssistantMessage.id);
          console.log('ChatInterface: Before append - content length:', this.currentAssistantMessage.content.length);
          console.log('ChatInterface: Appending chunk:', message.content?.substring(0, 30) + '...');

          // Create new content string
          const newContent = this.currentAssistantMessage.content + message.content;
          console.log('ChatInterface: New content length:', newContent.length);

          // Update the content by replacing the message object entirely to trigger change detection
          const messageIndex = this.messages.findIndex(m => m.id === this.currentAssistantMessage!.id);
          if (messageIndex !== -1) {
            this.currentAssistantMessage = {
              ...this.currentAssistantMessage,
              content: newContent
            };
            // Replace the message in the array to trigger Angular change detection
            this.messages[messageIndex] = this.currentAssistantMessage;
          }
        }
      } else {
        // Complete message - find and update the streaming message or create new one
        if (this.currentAssistantMessage) {
          console.log('ChatInterface: Updating existing message to complete');
          console.log('ChatInterface: Current accumulated content length:', this.currentAssistantMessage.content.length);
          console.log('ChatInterface: Complete message content length:', message.content?.length || 0);

          // Determine final content
          const finalContent = (message.content && message.content.length > this.currentAssistantMessage.content.length)
            ? message.content
            : this.currentAssistantMessage.content;

          console.log('ChatInterface: Final content length:', finalContent.length);

          // Create completed message object to trigger change detection
          const messageIndex = this.messages.findIndex(m => m.id === this.currentAssistantMessage!.id);
          if (messageIndex !== -1) {
            const completedMessage = {
              ...this.currentAssistantMessage,
              content: finalContent,
              isComplete: true
            };
            // Replace the message in the array to trigger Angular change detection
            this.messages[messageIndex] = completedMessage;
          }

          this.currentAssistantMessage = null;
          console.log('ChatInterface: Marked message as complete and cleared currentAssistantMessage');
        } else {
          console.log('ChatInterface: Creating new complete message (no existing streaming message)');
          // No streaming message existed, create new complete message
          this.messages.push(message);
          console.log('ChatInterface: Added new complete message. Total:', this.messages.length);
        }
      }
    } else if (message.type === 'error' || message.type === 'system') {
      console.log('ChatInterface: Adding system/error message');
      this.messages.push(message);
      this.currentAssistantMessage = null;
    }

    console.log('ChatInterface: Final state - Messages:', this.messages.length, 'CurrentAssistantMessage:', this.currentAssistantMessage?.id || null);

    // Force change detection and scroll
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 10);
  }

  handleEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }

  getMessageTypeLabel(type: string): string {
    switch (type) {
      case 'user':
        return 'You';
      case 'assistant':
        return 'AI Assistant';
      case 'system':
        return 'System';
      case 'error':
        return 'Error';
      default:
        return type;
    }
  }

  formatMessageContent(content: string): string {
    // Basic markdown-style formatting
    return content
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  private handleHistoryResponse(history: any[]): void {
    // Clear current messages first
    this.messages = [];

    // Convert history entries to ChatMessage format
    if (Array.isArray(history) && history.length > 0) {
      history.forEach((item) => {
        const message: ChatMessage = {
          id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          type: item.role === 'user' ? 'user' : 'assistant',
          content: item.content || '',
          timestamp: item.timestamp || Date.now(),
          isComplete: true,
          metadata: {
            clientId: this.connectionState.clientId,
            sessionId: this.connectionState.sessionId,
          },
        };
        this.messages.push(message);
      });

      // We have history, so hide loading immediately and show messages
      this.isLoadingHistory = false;
      this.cdr.detectChanges();
      this.scrollToBottom();
    } else {
      // Ensure minimum loading time even for empty history
      setTimeout(() => {
        this.isLoadingHistory = false;
        this.cdr.detectChanges();
      }, 800); // Slightly longer minimum loading for better UX
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  // Zard UI Message Configuration
  getMessageOptions(message: ChatMessage): AdditionalMessageOptions {
    const actions = this.getMessageActions(message);

    return {
      showTimestamp: true,
      actions: actions.length > 0 ? actions : undefined,
      isTyping: message.type === 'assistant' && !message.isComplete,
    };
  }

  getMessageActions(message: ChatMessage): ChatMessageAction[] {
    const actions: ChatMessageAction[] = [];

    // // Copy action for all messages
    // if (message.content && message.content.trim()) {
    //   actions.push({
    //     label: 'Copy message',
    //     icon: 'copy',
    //     onClick: () => this.copyMessage(message.content),
    //     disabled: false
    //   });
    // }

    // // Additional actions for user messages
    // if (message.type === 'user') {
    //   actions.push({
    //     label: 'Edit message',
    //     icon: 'edit',
    //     onClick: () => this.editMessage(message),
    //     disabled: true // TODO: Implement edit functionality
    //   });
    // }

    // // Delete action for user messages (not for system messages)
    // if (message.type !== 'system') {
    //   actions.push({
    //     label: 'Delete message',
    //     icon: 'delete',
    //     onClick: () => this.deleteMessage(message.id),
    //     disabled: true // TODO: Implement delete functionality
    //   });
    // }

    return actions;
  }

  copyMessage(content: string): void {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        // You could add a toast notification here
        console.log('Message copied to clipboard');
      })
      .catch((err) => {
        console.error('Failed to copy message: ', err);
      });
  }

  editMessage(message: ChatMessage): void {
    // TODO: Implement message editing
    console.log('Edit message:', message.id);
  }

  deleteMessage(messageId: string): void {
    // TODO: Implement message deletion
    console.log('Delete message:', messageId);
  }

  // New message input event handlers
  onMessageSubmit(event: { message: string; files: MessageInputFile[] }): void {
    if (!event.message.trim() || this.connectionState.status !== 'connected') {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateMessageId(),
      type: 'user',
      content: event.message.trim(),
      timestamp: Date.now(),
      isComplete: true,
    };

    this.messages.push(userMessage);

    // Handle files by uploading them via WebSocket
    if (event.files && event.files.length > 0) {
      this.uploadFiles(event.files);
    }

    // Send message text to WebSocket (files will be uploaded separately)
    this.wsService.sendMessage(event.message.trim());

    // Clear form and attachments
    this.messageText = '';
    this.attachedFiles = [];

    // Scroll to bottom
    this.scrollToBottom();
  }

  onStopGeneration(): void {
    // Send stop signal to WebSocket
    this.wsService.sendControl('abort');
    this.isGenerating = false;
    this.cdr.detectChanges();
  }

  onFilesChange(files: MessageInputFile[]): void {
    this.attachedFiles = files;
    this.cdr.detectChanges();
  }

  onFileSelect(files: File[]): void {
    console.log('Files selected:', files);
    // Handle file selection if needed
  }

  onTranscribeAudio(audioBlob: Blob): void {
    console.log('Audio transcription requested:', audioBlob);
    // Here you would typically send the audio to a transcription service
    // For now, we'll just create a placeholder message
    const transcriptionMessage: ChatMessage = {
      id: this.generateMessageId(),
      type: 'system',
      content: '🎤 Voice message received. Transcription feature not implemented yet.',
      timestamp: Date.now(),
      isComplete: true,
    };
    this.messages.push(transcriptionMessage);
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // File upload methods
  private uploadFiles(files: MessageInputFile[]): void {
    const uploadPromises = files.map(file => this.convertFileForUpload(file));

    Promise.all(uploadPromises).then(uploadFiles => {
      this.wsService.uploadFiles(uploadFiles);
    }).catch(error => {
      console.error('Error converting files for upload:', error);
      const errorMessage: ChatMessage = {
        id: this.generateMessageId(),
        type: 'error',
        content: `Error uploading files: ${error.message}`,
        timestamp: Date.now(),
        isComplete: true,
      };
      this.messages.push(errorMessage);
      this.cdr.detectChanges();
      this.scrollToBottom();
    });
  }

  private async convertFileForUpload(messageInputFile: MessageInputFile): Promise<{ name: string; size: number; type: string; data?: string }> {
    if (messageInputFile.data) {
      // File is already in base64 format
      return {
        name: messageInputFile.name,
        size: messageInputFile.size,
        type: messageInputFile.type,
        data: messageInputFile.data
      };
    }

    // Convert file to base64 (for WebSocket upload)
    const file = messageInputFile.file;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1] || result;
        resolve({
          name: messageInputFile.name,
          size: messageInputFile.size,
          type: messageInputFile.type,
          data: base64Data
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // File response handlers
  private handleFileUploadResponse(response: any): void {
    if (response.success && response.uploaded && response.uploaded.length > 0) {
      response.uploaded.forEach((file: any) => {
        const fileMessage: ChatMessage = {
          id: this.generateMessageId(),
          type: 'system',
          content: `✅ Uploaded: ${file.name} (${this.formatFileSize(file.size)})`,
          timestamp: Date.now(),
          isComplete: true,
        };
        this.messages.push(fileMessage);
      });
    } else if (!response.success) {
      const errorMessage: ChatMessage = {
        id: this.generateMessageId(),
        type: 'error',
        content: `❌ File upload failed: ${response.error}`,
        timestamp: Date.now(),
        isComplete: true,
      };
      this.messages.push(errorMessage);
    }
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private handleFileListResponse(response: any): void {
    if (response.success && response.files) {
      const fileListMessage: ChatMessage = {
        id: this.generateMessageId(),
        type: 'system',
        content: `📁 Your files (${response.files.length}):\n${response.files.map((f: any) => `• ${f.name} (${this.formatFileSize(f.size)})`).join('\n')}`,
        timestamp: Date.now(),
        isComplete: true,
      };
      this.messages.push(fileListMessage);
    } else if (!response.success) {
      const errorMessage: ChatMessage = {
        id: this.generateMessageId(),
        type: 'error',
        content: `❌ Failed to list files: ${response.error}`,
        timestamp: Date.now(),
        isComplete: true,
      };
      this.messages.push(errorMessage);
    }
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private handleFileContentResponse(response: any): void {
    if (response.success) {
      const contentMessage: ChatMessage = {
        id: this.generateMessageId(),
        type: 'system',
        content: `📄 Content of ${response.fileName} (${response.type}):\n\n${response.content}`,
        timestamp: Date.now(),
        isComplete: true,
      };
      this.messages.push(contentMessage);
    } else {
      const errorMessage: ChatMessage = {
        id: this.generateMessageId(),
        type: 'error',
        content: `❌ Failed to read file: ${response.error}`,
        timestamp: Date.now(),
        isComplete: true,
      };
      this.messages.push(errorMessage);
    }
    this.cdr.detectChanges();
    this.scrollToBottom();
  }
}
