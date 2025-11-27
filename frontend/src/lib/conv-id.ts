/**
 * Conversation ID management utility
 * Provides consistent conversation ID storage and retrieval across the application
 */

import { useCallback, useEffect, useState } from 'react';

export class ConvIdManager {
  private static readonly CONV_ID_KEY = 'ws_conv_id';
  private static readonly CONV_ID_PREFIX = 'conv_';

  /**
   * Get the current conversation ID, generating one if it doesn't exist
   */
  static getConvId(): string {
    if (typeof window === 'undefined') {
      // Server-side environment - generate a temporary ID
      return `${this.CONV_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    // Browser environment - check localStorage first
    let convId = localStorage.getItem(this.CONV_ID_KEY);

    if (!convId) {
      // Only generate a new ID if there isn't already one
      // This prevents race conditions with React Strict Mode
      convId = this.generateConvId();
      // Double-check that another instance didn't already set one
      const existingId = localStorage.getItem(this.CONV_ID_KEY);
      if (!existingId) {
        this.setConvId(convId);
      } else {
        // Use the existing ID that was set by another instance
        convId = existingId;
      }
    }

    return convId;
  }

  /**
   * Set the conversation ID (both in localStorage and update the WSClient if needed)
   */
  static setConvId(convId: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.CONV_ID_KEY, convId);
    }
  }

  /**
   * Generate a new conversation ID
   */
  static generateConvId(): string {
    return `${this.CONV_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Check if a conversation ID exists
   */
  static hasConvId(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return !!localStorage.getItem(this.CONV_ID_KEY);
  }

  /**
   * Clear the stored conversation ID
   */
  static clearConvId(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.CONV_ID_KEY);
    }
  }

  /**
   * Get conversation ID metadata (useful for debugging/analytics)
   */
  static getConvMetadata(): {
    convId: string;
    hasStoredId: boolean;
    isBrowserEnvironment: boolean;
  } {
    return {
      convId: this.getConvId(),
      hasStoredId: this.hasConvId(),
      isBrowserEnvironment: typeof window !== 'undefined',
    };
  }
}

/**
 * React hook for easy access to conversation ID in components
 */
export function useConvId(): {
  convId: string;
  setConvId: (convId: string) => void;
  generateNewConvId: () => string;
  clearConvId: () => void;
  hasConvId: boolean;
  metadata: ReturnType<typeof ConvIdManager.getConvMetadata>;
} {
  const [convId, setConvIdState] = useState(() => ConvIdManager.getConvId());
  const [hasConvId, setHasConvId] = useState(() => ConvIdManager.hasConvId());

  // Update state when localStorage changes (cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ConvIdManager['CONV_ID_KEY']) {
        const newConvId = ConvIdManager.getConvId();
        setConvIdState(newConvId);
        setHasConvId(ConvIdManager.hasConvId());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setConvId = useCallback((newConvId: string) => {
    ConvIdManager.setConvId(newConvId);
    setConvIdState(newConvId);
    setHasConvId(true);
  }, []);

  const generateNewConvId = useCallback(() => {
    const newConvId = ConvIdManager.generateConvId();
    ConvIdManager.setConvId(newConvId);
    setConvIdState(newConvId);
    setHasConvId(true);
    return newConvId;
  }, []);

  const clearConvId = useCallback(() => {
    ConvIdManager.clearConvId();
    const newConvId = ConvIdManager.getConvId(); // Will generate a new one
    setConvIdState(newConvId);
    setHasConvId(false);
  }, []);

  return {
    convId,
    setConvId,
    generateNewConvId,
    clearConvId,
    hasConvId,
    metadata: ConvIdManager.getConvMetadata(),
  };
}