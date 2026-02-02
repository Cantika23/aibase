/**
 * Simple EventEmitter implementation for WebSocket events
 * Compatible with both browser and Node.js environments
 */

import { logger } from "@/lib/logger";

export class WSEventEmitter extends EventTarget {
  private listeners: Map<string, Set<Function>> = new Map();

  on(event: string, listener: (data?: any) => void): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return this;
  }

  off(event: string, listener: (data?: any) => void): this {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }

    return this;
  }

  once(event: string, listener: (data?: any) => void): this {
    const onceListener = (data?: any) => {
      listener(data);
      this.off(event, onceListener);
    };
    return this.on(event, onceListener);
  }

  emit(event: string, data?: any): this {
    // Emit to our internal listeners only
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      if (event === "llm_chunk") {
        logger.websocket.trace(`[Emitter] Emitting event`, { event, listenerCount: eventListeners.size });
      }
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          logger.websocket.error(`Error in event listener`, { event, error: String(error) });
        }
      });
    }

    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }

  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}
