import { Component, Input, ChangeDetectionStrategy, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '../../models/chat-message';
import {
  ZardChatMessageComponent,
  ChatMessageAction,
  ChatMessageAttachment,
} from './chat-message.component';

export interface AdditionalMessageOptions {
  actions?: ChatMessageAction[];
  attachments?: ChatMessageAttachment[];
  isTyping?: boolean;
  showTimestamp?: boolean;
}

export type MessageOptionsFunction = (message: ChatMessage) => AdditionalMessageOptions;

export interface MessageListProps {
  messages: ChatMessage[];
  showTimestamps?: boolean;
  isTyping?: boolean;
  isLoadingHistory?: boolean;
  messageOptions?: AdditionalMessageOptions | MessageOptionsFunction;
  autoScroll?: boolean;
  scrollBehavior?: 'auto' | 'smooth';
}

@Component({
  selector: 'zard-message-list',
  standalone: true,
  imports: [CommonModule, ZardChatMessageComponent],
  template: `
    <div [class]="containerClass" #messageListContainer (scroll)="onScroll()">
      @if (isLoadingHistory) {
      <div [class]="loadingStateClass">
        <div class="loading-spinner">
          <svg
            width="24"
            height="24"
            class="w-[45px] h-[45px]"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <style>
              .spinner_P7sC {
                transform-origin: center;
                animation: spinner_svv2 0.75s infinite linear;
              }
              @keyframes spinner_svv2 {
                40% {
                  transform: rotate(360deg);
                }
              }
            </style>
            <path
              d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
              class="spinner_P7sC"
              fill="#666"
            />
          </svg>
        </div>
        <p class="loading-text">Loading chat history...</p>
        <p class="loading-subtext">Please wait while we retrieve your previous messages</p>
      </div>
      } @else if (messages.length === 0 && !isTyping) {
      <div [class]="emptyStateClass">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
        </svg>
        <p class="empty-text">Start a conversation</p>
        <p class="loading-subtext">Send a message to begin chatting with the AI assistant</p>
      </div>
      } @else { @for (message of messages; track message.id; let i = $index) {
      <zard-chat-message
        [message]="message"
        [showTimestamp]="getMessageShowTimestamp(message)"
        [isTyping]="
          isTyping &&
          i === messages.length - 1 &&
          message.type === 'assistant' &&
          !message.isComplete
        "
        [actions]="getMessageActions(message)"
        [attachments]="getMessageAttachments(message)"
      />
      } @if (isTyping && messages.length > 0) {
      <div class="typing-indicator-container">
        <div class="typing-indicator-message">
          <div class="avatar assistant">
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div class="body assistant">
            <div class="typing-indicator">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </div>
      </div>
      } }

      <!-- Scroll to bottom button -->
      @if (showScrollButton) {
      <button
        [class]="scrollButtonClass"
        (click)="scrollToBottom()"
        [attr.aria-label]="'Scroll to bottom'"
      >
        <svg class="scroll-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
      </button>
      }
    </div>
  `,
  styles: [
    `
      .message-list-container {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        scroll-behavior: smooth;
      }

      .message-list-container-auto {
        position: absolute;
        inset: 0;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgb(107 114 128);
        padding: 3rem 0;
      }

      .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgb(107 114 128);
        padding: 3rem 0;
      }

      .empty-icon {
        width: 4rem;
        height: 4rem;
        margin-bottom: 1rem;
        color: rgb(209 213 219);
      }

      .empty-text {
        font-size: 1.125rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
        color: rgb(17 24 39);
      }

      .empty-subtext {
        font-size: 0.875rem;
        color: rgb(156 163 175);
      }

      .loading-spinner {
        margin-bottom: 1.5rem;
      }

      .spinner-icon {
        width: 2.5rem;
        height: 2.5rem;
        color: rgb(59 130 246);
      }

      .spinner-circle {
        animation: spin 1.5s linear infinite;
      }

      .loading-text {
        font-size: 1.125rem;
        font-weight: 500;
        margin-bottom: 0.5rem;
        color: rgb(17 24 39);
      }

      .loading-subtext {
        font-size: 0.875rem;
        color: rgb(156 163 175);
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .typing-indicator-container {
        display: flex;
        gap: 0.75rem;
        padding: 1rem;
      }

      .typing-indicator-message {
        display: flex;
        gap: 0.75rem;
      }

      .typing-indicator {
        display: flex;
        gap: 0.25rem;
        align-items: center;
      }

      .typing-dot {
        width: 0.5rem;
        height: 0.5rem;
        background-color: rgb(55 65 81);
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

      .scroll-to-bottom {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        z-index: 10;
        background-color: rgb(37 99 235);
        color: white;
        padding: 0.75rem;
        border-radius: 50%;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        transition: background-color 0.2s;
        border: none;
        cursor: pointer;
      }

      .scroll-to-bottom:hover {
        background-color: rgb(29 78 216);
      }

      .scroll-icon {
        width: 1.25rem;
        height: 1.25rem;
      }

      /* Custom scrollbar */
      .message-list-container::-webkit-scrollbar {
        width: 0.5rem;
      }

      .message-list-container::-webkit-scrollbar-track {
        background-color: rgb(243 244 246);
      }

      .message-list-container::-webkit-scrollbar-thumb {
        background-color: rgb(209 213 219);
        border-radius: 9999px;
      }

      .message-list-container::-webkit-scrollbar-thumb:hover {
        background-color: rgb(156 163 175);
      }

      /* Avatar styles for typing indicator */
      .avatar {
        flex-shrink: 0;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .avatar.assistant {
        background-color: rgb(229 231 235);
        color: rgb(55 65 81);
      }

      .icon {
        width: 1rem;
        height: 1rem;
      }

      /* Body styles for typing indicator */
      .body {
        border-radius: 0.5rem;
        padding: 0.75rem;
      }

      .body.assistant {
        background-color: rgb(243 244 246);
        color: rgb(17 24 39);
      }
    `,
  ],
  })
export class ZardMessageListComponent implements OnChanges {
  @Input({ required: true }) messages!: ChatMessage[];
  @Input() showTimestamps: boolean = true;
  @Input() isTyping: boolean = false;
  @Input() isLoadingHistory: boolean = true;
  @Input() messageOptions?: AdditionalMessageOptions | MessageOptionsFunction;
  @Input() autoScroll: boolean = true;
  @Input() scrollBehavior: 'auto' | 'smooth' = 'smooth';

  showScrollButton = false;
  private isScrolledToBottom = true;

  get containerClass(): string {
    return this.autoScroll ? 'message-list-container-auto' : 'message-list-container';
  }

  get emptyStateClass(): string {
    return 'empty-state';
  }

  get loadingStateClass(): string {
    return 'loading-state';
  }

  get scrollButtonClass(): string {
    return 'scroll-to-bottom';
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('ZardMessageList: ngOnChanges called');
    console.log('ZardMessageList: messages.length:', this.messages?.length);
    console.log('ZardMessageList: messages:', this.messages);

    if (changes['messages']) {
      console.log('ZardMessageList: messages changed from', changes['messages'].previousValue?.length, 'to', this.messages?.length);
    }

    if (changes['messages'] && this.autoScroll) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  onScroll(): void {
    // Check if user is scrolled to bottom
    const container = this.getScrollContainer();
    if (container) {
      const threshold = 100; // 100px from bottom
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

      if (isAtBottom !== this.isScrolledToBottom) {
        this.isScrolledToBottom = isAtBottom;
        this.showScrollButton = !isAtBottom;
      }
    }
  }

  scrollToBottom(): void {
    const container = this.getScrollContainer();
    if (container) {
      const scrollOptions: ScrollToOptions = {
        top: container.scrollHeight,
        behavior: this.scrollBehavior,
      };

      container.scrollTo(scrollOptions);
      this.showScrollButton = false;
      this.isScrolledToBottom = true;
    }
  }

  private getScrollContainer(): HTMLElement | null {
    return document.querySelector('.message-list-container, .message-list-container-auto');
  }

  getMessageShowTimestamp(message: ChatMessage): boolean {
    if (typeof this.messageOptions === 'function') {
      return this.messageOptions(message).showTimestamp ?? this.showTimestamps;
    } else if (this.messageOptions) {
      return this.messageOptions.showTimestamp ?? this.showTimestamps;
    }
    return this.showTimestamps;
  }

  getMessageActions(message: ChatMessage): ChatMessageAction[] | undefined {
    if (typeof this.messageOptions === 'function') {
      return this.messageOptions(message).actions;
    } else if (this.messageOptions) {
      return this.messageOptions.actions;
    }
    return undefined;
  }

  getMessageAttachments(message: ChatMessage): ChatMessageAttachment[] | undefined {
    if (typeof this.messageOptions === 'function') {
      return this.messageOptions(message).attachments;
    } else if (this.messageOptions) {
      return this.messageOptions.attachments;
    }
    return undefined;
  }

  getMessageIsTyping(message: ChatMessage): boolean {
    if (typeof this.messageOptions === 'function') {
      return this.messageOptions(message).isTyping ?? false;
    } else if (this.messageOptions) {
      return this.messageOptions.isTyping ?? false;
    }
    return false;
  }
}
