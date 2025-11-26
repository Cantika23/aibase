import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../models/chat-message';
import { cn } from '../../shared/utils/cn';

export type ChatMessageAnimation = 'none' | 'slide' | 'scale' | 'fade';

export interface ChatMessageAction {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ChatMessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
}

export interface ChatMessageProps {
  message: ChatMessage;
  showTimestamp?: boolean;
  animation?: ChatMessageAnimation;
  actions?: ChatMessageAction[];
  attachments?: ChatMessageAttachment[];
  isTyping?: boolean;
}

@Component({
  selector: 'zard-chat-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      [class]="messageContainerClass"
      [attr.data-message-id]="message.id"
      [attr.data-message-type]="message.type"
    >
      <!-- Avatar -->
      <div [class]="avatarClass">
        <svg
          [class]="iconClass"
          [attr.viewBox]="isUserAvatar ? '0 0 24 24' : '0 0 24 24'"
          fill="currentColor"
        >
          <path [attr.d]="avatarPath" />
        </svg>
      </div>

      <!-- Message Content -->
      <div [class]="contentWrapperClass">
        <!-- Message Header -->

        <!-- Message Body -->
        <div [class]="bodyClass" [attr.aria-label]="message.type + ' message'">
          @if (isTyping && !message.isComplete) {
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
          } @else {
          <div [innerHTML]="formattedContent" class="message-text"></div>
          } @if (attachments && attachments.length > 0) {
          <div class="attachments-container">
            @for (attachment of attachments; track attachment.id) {
            <div [class]="attachmentClass">
              <div class="attachment-info">
                <span class="attachment-name">{{ attachment.name }}</span>
                <span class="attachment-size">{{ formatFileSize(attachment.size) }}</span>
              </div>
              @if (attachment.url) {
              <a
                [href]="attachment.url"
                [download]="attachment.name"
                class="attachment-download"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg class="download-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 15l-5-5h3V2h4v8h3l-5 5zM2 17h20v2H2v-2z" />
                </svg>
              </a>
              }
            </div>
            }
          </div>
          }
        </div>

        @if (showTimestamp && message.timestamp) {
        <span [class]="timestampClass">{{ formatTimestamp(message.timestamp) }}</span>
        }

        <!-- Message Actions -->
        @if (actions && actions.length > 0) {
        <div [class]="actionsClass">
          @for (action of actions; track action.label) {
          <button
            [class]="actionButtonClass"
            [disabled]="action.disabled"
            (click)="action.onClick()"
            [attr.aria-label]="action.label"
            [attr.title]="action.label"
          >
            @if (action.icon) {
            <svg class="action-icon" viewBox="0 0 24 24" fill="currentColor">
              <path [attr.d]="getIconPath(action.icon)" />
            </svg>
            }
            <span class="action-label">{{ action.label }}</span>
          </button>
          }
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .message-container {
        display: flex;
        gap: 0.75rem;
        padding: 1rem 0;
        transition: all 0.2s;
      }

      .message-container.user {
        flex-direction: row-reverse;
      }

      .avatar {
        flex-shrink: 0;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .avatar.user {
        background-color: rgb(37 99 235);
        color: white;
      }

      .avatar.assistant {
        background-color: rgb(229 231 235);
        color: rgb(55 65 81);
      }

      .avatar.system {
        background-color: rgb(254 252 232);
        color: rgb(161 98 7);
      }

      .avatar.error {
        background-color: rgb(254 242 242);
        color: rgb(185 28 28);
      }

      .icon {
        width: 1rem;
        height: 1rem;
      }

      .content-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        max-width: 80%;
      }

      .user .content-wrapper {
        align-items: flex-end;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
      }

      .user .header {
        flex-direction: row-reverse;
      }

      .sender {
        font-size: 0.875rem;
        font-weight: 500;
      }

      .user .sender {
        color: rgb(37 99 235);
      }

      .assistant .sender {
        color: rgb(55 65 81);
      }

      .system .sender {
        color: rgb(161 98 7);
      }

      .error .sender {
        color: rgb(185 28 28);
      }

      .timestamp {
        margin: 3px 5px;
        font-size: 0.75rem;
        color: rgb(107 114 128);
      }

      .body {
        border-radius: 0.5rem;
        padding: 0.75rem;
      }

      .user .body {
        background-color: rgb(37 99 235);
        color: white;
      }

      .assistant .body {
        background-color: rgb(243 244 246);
        color: rgb(17 24 39);
      }

      .system .body {
        background-color: rgb(254 252 232);
        color: rgb(161 98 7);
        border: 1px solid rgb(252 211 77);
      }

      .error .body {
        background-color: rgb(254 242 242);
        color: rgb(185 28 28);
        border: 1px solid rgb(252 165 165);
      }

      .message-text {
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .message-text ::ng-deep code {
        background-color: rgb(243 244 246);
        color: rgb(31 41 55);
        padding: 0.125rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
      }

      .message-text ::ng-deep pre {
        background-color: rgb(243 244 246);
        color: rgb(31 41 55);
        padding: 0.75rem;
        border-radius: 0.5rem;
        overflow-x: auto;
      }

      .message-text ::ng-deep strong {
        font-weight: 600;
      }

      .message-text ::ng-deep em {
        font-style: italic;
      }

      .typing-indicator {
        display: flex;
        gap: 0.25rem;
        align-items: center;
      }

      .typing-dot {
        width: 0.5rem;
        height: 0.5rem;
        background-color: currentColor;
        border-radius: 50%;
        animation: pulse 1.5s infinite;
      }

      .typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }

      .attachments-container {
        margin-top: 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .attachment {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem;
        background-color: rgb(249 250 251);
        border-radius: 0.5rem;
      }

      .attachment-info {
        flex: 1;
        min-width: 0;
      }

      .attachment-name {
        font-size: 0.875rem;
        font-weight: 500;
        color: rgb(17 24 39);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .attachment-size {
        font-size: 0.75rem;
        color: rgb(156 163 175);
      }

      .attachment-download {
        padding: 0.25rem;
        color: rgb(156 163 175);
        transition: color 0.2s;
      }

      .attachment-download:hover {
        color: rgb(75 85 99);
      }

      .download-icon {
        width: 1rem;
        height: 1rem;
      }

      .actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }

      .action-button {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
        border-radius: 0.25rem;
        transition: background-color 0.2s;
        border: none;
        background: transparent;
        cursor: pointer;
      }

      .action-button:not(:disabled):hover {
        background-color: rgb(243 244 246);
      }

      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .action-icon {
        width: 0.75rem;
        height: 0.75rem;
      }

      .action-label {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZardChatMessageComponent {
  @Input({ required: true }) message!: ChatMessage;
  @Input() showTimestamp: boolean = false;
  @Input() actions?: ChatMessageAction[];
  @Input() attachments?: ChatMessageAttachment[];
  @Input() isTyping: boolean = false;

  get messageContainerClass(): string {
    return cn('message-container', this.message.type);
  }

  get avatarClass(): string {
    return cn('avatar', this.message.type);
  }

  get iconClass(): string {
    return 'icon';
  }

  get isUserAvatar(): boolean {
    return this.message.type === 'user';
  }

  get avatarPath(): string {
    switch (this.message.type) {
      case 'user':
        return 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z';
      case 'assistant':
        return 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
      case 'system':
        return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
      case 'error':
        return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      default:
        return 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  }

  get contentWrapperClass(): string {
    return 'content-wrapper';
  }

  get headerClass(): string {
    return 'header';
  }

  get senderClass(): string {
    return 'sender';
  }

  get timestampClass(): string {
    return 'timestamp';
  }

  get bodyClass(): string {
    return 'body';
  }

  get attachmentClass(): string {
    return 'attachment';
  }

  get actionsClass(): string {
    return 'actions';
  }

  get actionButtonClass(): string {
    return 'action-button';
  }

  get senderLabel(): string {
    switch (this.message.type) {
      case 'user':
        return 'You';
      case 'assistant':
        return 'AI Assistant';
      case 'system':
        return 'System';
      case 'error':
        return 'Error';
      default:
        return this.message.type;
    }
  }

  get formattedContent(): string {
    return this.formatMessageContent(this.message.content);
  }

  formatMessageContent(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .trim()
      .replace(/\n/g, '<br>');
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getIconPath(iconName: string): string {
    const iconPaths: Record<string, string> = {
      copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
      share:
        'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z',
      heart:
        'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
      reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z',
      edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
      delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
    };
    return iconPaths[iconName] || '';
  }
}
