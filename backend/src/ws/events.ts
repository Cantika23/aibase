/**
 * Event system for WebSocket communication
 */

import type { EventHandler, ErrorEventHandler } from './types';

export class EventEmitter {
  private listeners = new Map<string, Set<EventHandler>>();
  private maxListeners: number = 10;

  /**
   * Add event listener
   */
  on<T = any>(event: string, handler: EventHandler<T>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const eventListeners = this.listeners.get(event)!;
    if (eventListeners.size >= this.maxListeners) {
      console.warn(`Maximum listeners (${this.maxListeners}) exceeded for event: ${event}`);
    }

    eventListeners.add(handler);
    return this;
  }

  /**
   * Add one-time event listener
   */
  once<T = any>(event: string, handler: EventHandler<T>): this {
    const onceHandler = (data: T) => {
      handler(data);
      this.off(event, onceHandler);
    };
    return this.on(event, onceHandler);
  }

  /**
   * Remove event listener
   */
  off<T = any>(event: string, handler?: EventHandler<T>): this {
    if (!this.listeners.has(event)) {
      return this;
    }

    if (handler) {
      this.listeners.get(event)!.delete(handler);
    } else {
      this.listeners.get(event)!.clear();
    }

    return this;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  /**
   * Emit event to all listeners
   */
  async emit<T = any>(event: string, data?: T): Promise<void> {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      return;
    }

    const promises = Array.from(eventListeners).map(async (handler) => {
      try {
        await handler(data);
      } catch (error) {
        console.error(`Error in event handler for '${event}':`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get listener count for event
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * Get all event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Set maximum listeners per event
   */
  setMaxListeners(max: number): this {
    this.maxListeners = max;
    return this;
  }
}

/**
 * Typed event emitter for WebSocket events
 */
export class WSEventEmitter extends EventEmitter {
  // Connection events
  onConnected(handler: EventHandler): this {
    return this.on('connected', handler);
  }

  onDisconnected(handler: EventHandler): this {
    return this.on('disconnected', handler);
  }

  onError(handler: ErrorEventHandler): this {
    return this.on('error', handler);
  }

  onReconnecting(handler: EventHandler<{ attempt: number; maxAttempts: number }>): this {
    return this.on('reconnecting', handler);
  }

  // Message events
  onMessage(handler: EventHandler<any>): this {
    return this.on('message', handler);
  }

  onLLMChunk(handler: EventHandler<{ chunk: string; sequence?: number }>): this {
    return this.on('llm_chunk', handler);
  }

  onLLMComplete(handler: EventHandler<{ fullText: string; messageId: string }>): this {
    return this.on('llm_complete', handler);
  }

  onToolCall(handler: EventHandler<{ toolCallId: string; toolName: string; args: any; status: string }>): this {
    return this.on('tool_call', handler);
  }

  onToolResult(handler: EventHandler<{ toolCallId: string; result: any }>): this {
    return this.on('tool_result', handler);
  }

  // Status events
  onStatusChange(handler: EventHandler<{ status: string; message?: string }>): this {
    return this.on('status', handler);
  }

  // Control events
  onControl(handler: EventHandler<any>): this {
    return this.on('control', handler);
  }

  // Error events
  onCommunicationError(handler: EventHandler<{ code: string; message: string }>): this {
    return this.on('communication_error', handler);
  }

  onRateLimit(handler: EventHandler<{ retryAfter?: number }>): this {
    return this.on('rate_limit', handler);
  }
}