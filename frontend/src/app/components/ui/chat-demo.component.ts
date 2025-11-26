import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZardMessageListComponent, ChatMessageAction, AdditionalMessageOptions } from './index';
import { ChatMessage } from '../../models/chat-message';

@Component({
  selector: 'zard-chat-demo',
  standalone: true,
  imports: [CommonModule, ZardMessageListComponent],
  template: `
    <div class="chat-demo p-4 max-w-4xl mx-auto">
      <h2 class="text-2xl font-bold mb-4">Zard UI Chat Components Demo</h2>

      <div class="border rounded-lg overflow-hidden shadow-lg">
        <div class="bg-gray-50 p-4 border-b">
          <h3 class="font-semibold">Demo Chat Interface</h3>
          <p class="text-sm text-gray-600">This demonstrates the Zard UI chat message and message list components</p>
        </div>

        <div class="h-96 bg-white">
          <zard-message-list
            [messages]="messages()"
            [showTimestamps]="true"
            [isTyping]="isTyping()"
            [messageOptions]="messageOptionsFunction"
            [autoScroll]="true"
            [scrollBehavior]="'smooth'">
          </zard-message-list>
        </div>

        <div class="border-t p-4 bg-gray-50">
          <div class="flex gap-2">
            <button
              (click)="addUserMessage()"
              class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              Add User Message
            </button>
            <button
              (click)="addAssistantMessage()"
              class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
              Add Assistant Message
            </button>
            <button
              (click)="toggleTyping()"
              class="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors">
              {{ isTyping() ? 'Stop' : 'Start' }} Typing
            </button>
            <button
              (click)="clearMessages()"
              class="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors">
              Clear Messages
            </button>
          </div>
        </div>
      </div>

      <div class="mt-6 bg-blue-50 p-4 rounded-lg">
        <h4 class="font-semibold mb-2">Features Demonstrated:</h4>
        <ul class="list-disc list-inside space-y-1 text-sm">
          <li>Responsive message layout with proper avatar positioning</li>
          <li>Different message types (user, assistant, system, error)</li>
          <li>Timestamp display</li>
          <li>Typing indicators for streaming responses</li>
          <li>Message actions (copy, edit, delete)</li>
          <li>Markdown content rendering</li>
          <li>Smooth animations</li>
          <li>Auto-scrolling behavior</li>
          <li>Empty state handling</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .chat-demo {
      min-height: 100vh;
    }
  `],
})
export class ZardChatDemoComponent {
  private messagesSignal = signal<ChatMessage[]>([]);
  private isTypingSignal = signal<boolean>(false);
  private messageCounter = 0;

  messages = this.messagesSignal.asReadonly();
  isTyping = this.isTypingSignal.asReadonly();
  messageOptionsFunction = this.getMessageOptions.bind(this);

  constructor() {
    // Add some initial messages
    this.addInitialMessages();
  }

  private addInitialMessages(): void {
    const initialMessages: ChatMessage[] = [
      {
        id: 'msg_system_1',
        type: 'system',
        content: 'Welcome to Zard UI Chat Demo! This is a system message.',
        timestamp: Date.now() - 60000,
        isComplete: true
      },
      {
        id: 'msg_user_1',
        type: 'user',
        content: 'Hello! Can you show me how to use these chat components?',
        timestamp: Date.now() - 45000,
        isComplete: true
      },
      {
        id: 'msg_assistant_1',
        type: 'assistant',
        content: 'Hi there! The Zard UI chat components provide a complete solution for building chat interfaces. Here are the key features:\n\n**Message Types**: Support for user, assistant, system, and error messages\n\n**Customization**: Each message can have custom actions and attachments\n\n**Animations**: Smooth animations for message appearance\n\n**Accessibility**: Full keyboard navigation and screen reader support\n\nTry clicking the buttons above to see more examples!',
        timestamp: Date.now() - 30000,
        isComplete: true
      }
    ];

    this.messagesSignal.set(initialMessages);
    this.messageCounter = 3;
  }

  addUserMessage(): void {
    const userMessage: ChatMessage = {
      id: `msg_user_${++this.messageCounter}`,
      type: 'user',
      content: `This is user message #${Math.floor(this.messageCounter / 2)}. Try copying this message!`,
      timestamp: Date.now(),
      isComplete: true
    };

    this.messagesSignal.update(messages => [...messages, userMessage]);
  }

  addAssistantMessage(): void {
    const assistantMessages = [
      "Here's an example of **bold text** and *italic text* in a message.",
      "You can even include `code snippets` like this: ```console.log('Hello Zard UI!');```",
      "The components support **markdown rendering**, animations, and custom actions!",
      "This demonstrates how the message list component handles different content types."
    ];

    const randomMessage = assistantMessages[Math.floor(Math.random() * assistantMessages.length)];

    const assistantMessage: ChatMessage = {
      id: `msg_assistant_${++this.messageCounter}`,
      type: 'assistant',
      content: randomMessage,
      timestamp: Date.now(),
      isComplete: true
    };

    this.messagesSignal.update(messages => [...messages, assistantMessage]);
  }

  toggleTyping(): void {
    this.isTypingSignal.set(!this.isTypingSignal());

    if (!this.isTypingSignal()) {
      // Add a completion message when stopping typing
      const completionMessage: ChatMessage = {
        id: `msg_assistant_${++this.messageCounter}`,
        type: 'assistant',
        content: 'Typing simulation complete! The typing indicator helps users know when the assistant is generating a response.',
        timestamp: Date.now(),
        isComplete: true
      };

      this.messagesSignal.update(messages => [...messages, completionMessage]);
    }
  }

  clearMessages(): void {
    this.messagesSignal.set([]);
    this.isTypingSignal.set(false);
  }

  getMessageOptions(message: ChatMessage): AdditionalMessageOptions {
    const actions = this.getMessageActions(message);

    return {
      showTimestamp: true,
      actions: actions.length > 0 ? actions : undefined,
      isTyping: message.type === 'assistant' && !message.isComplete
    };
  }

  getMessageActions(message: ChatMessage): ChatMessageAction[] {
    const actions: ChatMessageAction[] = [];

    // Copy action for all messages
    if (message.content && message.content.trim()) {
      actions.push({
        label: 'Copy message',
        icon: 'copy',
        onClick: () => this.copyMessage(message.content),
        disabled: false
      });
    }

    // Additional actions for user messages
    if (message.type === 'user') {
      actions.push({
        label: 'Edit message',
        icon: 'edit',
        onClick: () => this.editMessage(message),
        disabled: false
      });
    }

    // Delete action for user messages (not for system messages)
    if (message.type !== 'system') {
      actions.push({
        label: 'Delete message',
        icon: 'delete',
        onClick: () => this.deleteMessage(message.id),
        disabled: false
      });
    }

    return actions;
  }

  copyMessage(content: string): void {
    navigator.clipboard.writeText(content).then(() => {
      console.log('Message copied to clipboard:', content);
      alert('Message copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy message: ', err);
    });
  }

  editMessage(message: ChatMessage): void {
    const newContent = prompt('Edit message:', message.content);
    if (newContent && newContent !== message.content) {
      this.messagesSignal.update(messages =>
        messages.map(m => m.id === message.id ? { ...m, content: newContent } : m)
      );
    }
  }

  deleteMessage(messageId: string): void {
    this.messagesSignal.update(messages => messages.filter(m => m.id !== messageId));
  }
}