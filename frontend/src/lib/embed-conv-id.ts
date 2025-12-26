/**
 * Embed Conversation ID management utility
 * Uses URL hash to persist conversation ID for embedded chat
 */

import { useCallback, useEffect, useState } from 'react';

export class EmbedConvIdManager {
  private static readonly CONV_ID_PREFIX = 'conv_';

  /**
   * Get conversation ID from URL hash
   */
  static getConvIdFromHash(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const hash = window.location.hash;
    if (hash && hash.startsWith('#')) {
      return hash.substring(1);
    }

    return null;
  }

  /**
   * Set conversation ID in URL hash
   */
  static setConvIdInHash(convId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.hash = convId;
  }

  /**
   * Generate a new conversation ID
   */
  static generateConvId(): string {
    return `${this.CONV_ID_PREFIX}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get or generate conversation ID
   */
  static getOrGenerateConvId(): string {
    const existingId = this.getConvIdFromHash();
    if (existingId) {
      return existingId;
    }

    return this.generateConvId();
  }
}

/**
 * React hook for embed mode conversation ID management
 * Uses URL hash instead of localStorage
 */
export function useEmbedConvId(): {
  convId: string;
  setConvId: (convId: string) => void;
  generateNewConvId: () => string;
  ensureHashUpdated: () => void;
  hasConvId: boolean;
} {
  // Check if there's already a convId in the hash, otherwise generate a new one (but don't set hash yet)
  const [convId, setConvIdState] = useState(() => {
    const existingId = EmbedConvIdManager.getConvIdFromHash();
    if (existingId) {
      return existingId;
    }
    // Generate a new ID but don't set it in hash yet - will be set after first message
    return EmbedConvIdManager.generateConvId();
  });
  const [hasConvId, setHasConvId] = useState(() => !!EmbedConvIdManager.getConvIdFromHash());

  // Listen to hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const newConvId = EmbedConvIdManager.getConvIdFromHash();
      if (newConvId) {
        setConvIdState(newConvId);
        setHasConvId(true);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setConvId = useCallback((newConvId: string) => {
    EmbedConvIdManager.setConvIdInHash(newConvId);
    setConvIdState(newConvId);
    setHasConvId(true);
  }, []);

  const generateNewConvId = useCallback(() => {
    const newConvId = EmbedConvIdManager.generateConvId();
    EmbedConvIdManager.setConvIdInHash(newConvId);
    setConvIdState(newConvId);
    setHasConvId(true);
    return newConvId;
  }, []);

  // Ensure the current convId is in the hash (call this after first message)
  const ensureHashUpdated = useCallback(() => {
    if (!EmbedConvIdManager.getConvIdFromHash()) {
      EmbedConvIdManager.setConvIdInHash(convId);
      setHasConvId(true);
    }
  }, [convId]);

  return {
    convId,
    setConvId,
    generateNewConvId,
    ensureHashUpdated,
    hasConvId,
  };
}
