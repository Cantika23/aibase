/**
 * Cache and Session Storage Abstraction Layer
 * 
 * Provides a unified interface for different cache backends:
 * - In-memory (default, single-node)
 * - Redis (enterprise, distributed)
 * - Valkey (AWS ElastiCache compatible)
 */

// ============================================================================
// Types
// ============================================================================

export interface CacheConfig {
  type: 'memory' | 'redis' | 'valkey';
  
  // In-memory options
  memory?: {
    maxSize?: number;        // Max entries before eviction (default: 10000)
    ttlSeconds?: number;     // Default TTL (default: 3600)
    checkPeriod?: number;    // Cleanup interval in seconds (default: 600)
  };
  
  // Redis options
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;             // Redis database number (0-15)
    keyPrefix?: string;      // Prefix for all keys
    tls?: boolean;           // Enable TLS
    
    // Connection pool options
    maxRetriesPerRequest?: number;
    retryDelayOnFailover?: number;
    
    // Cluster mode
    cluster?: {
      enabled: boolean;
      nodes: { host: string; port: number }[];
    };
  };
  
  // Valkey options (same as Redis)
  valkey?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    tls?: boolean;
  };
}

export interface SessionData {
  id: string;
  userId: number;
  token: string;
  createdAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  metadata?: Record<string, unknown>;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  expiresAt?: number;
}

// ============================================================================
// Abstract Cache Interface
// ============================================================================

export abstract class AbstractCache {
  protected config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Initialize the cache connection
   */
  abstract initialize(): Promise<void>;

  /**
   * Close the cache connection
   */
  abstract close(): Promise<void>;

  // -------------------------------------------------------------------------
  // Basic Cache Operations
  // -------------------------------------------------------------------------

  /**
   * Get a value from cache
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  abstract get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds Time to live in seconds (0 = no expiry)
   */
  abstract set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a value from cache
   * @param key Cache key
   */
  abstract delete(key: string): Promise<void>;

  /**
   * Check if a key exists in cache
   * @param key Cache key
   */
  abstract exists(key: string): Promise<boolean>;

  /**
   * Increment a numeric value
   * @param key Cache key
   * @param amount Amount to increment (default: 1)
   */
  abstract increment(key: string, amount?: number): Promise<number>;

  /**
   * Decrement a numeric value
   * @param key Cache key
   * @param amount Amount to decrement (default: 1)
   */
  abstract decrement(key: string, amount?: number): Promise<number>;

  /**
   * Set a value only if the key doesn't exist
   * @param key Cache key
   * @param value Value to cache
   * @param ttlSeconds Time to live in seconds
   * @returns true if set, false if key already exists
   */
  abstract setNX<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;

  /**
   * Get and set atomically
   * @param key Cache key
   * @param value New value
   * @param ttlSeconds Time to live in seconds
   * @returns Previous value or null
   */
  abstract getSet<T>(key: string, value: T, ttlSeconds?: number): Promise<T | null>;

  /**
   * Delete multiple keys
   * @param keys Array of cache keys
   */
  abstract deleteMany(keys: string[]): Promise<void>;

  /**
   * Get multiple values
   * @param keys Array of cache keys
   * @returns Array of values (null for missing keys)
   */
  abstract getMany<T>(keys: string[]): Promise<(T | null)[]>;

  /**
   * Set multiple values
   * @param entries Array of key-value pairs
   * @param ttlSeconds Time to live in seconds
   */
  abstract setMany<T>(entries: { key: string; value: T }[], ttlSeconds?: number): Promise<void>;

  /**
   * Clear all cache entries (use with caution!)
   */
  abstract clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  abstract getStats(): Promise<{
    hits: number;
    misses: number;
    keys: number;
    memoryUsage?: number;
  }>;

  // -------------------------------------------------------------------------
  // Session Operations (built on top of basic operations)
  // -------------------------------------------------------------------------

  private getSessionKey(token: string): string {
    const prefix = this.config.redis?.keyPrefix || this.config.valkey?.keyPrefix || '';
    return `${prefix}session:${token}`;
  }

  private getUserSessionsKey(userId: number): string {
    const prefix = this.config.redis?.keyPrefix || this.config.valkey?.keyPrefix || '';
    return `${prefix}user_sessions:${userId}`;
  }

  /**
   * Store a session
   */
  async setSession(session: SessionData): Promise<void> {
    const sessionKey = this.getSessionKey(session.token);
    const userSessionsKey = this.getUserSessionsKey(session.userId);
    
    // Calculate TTL based on expiration
    const ttlSeconds = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
    
    // Store session data
    await this.set(sessionKey, session, ttlSeconds);
    
    // Add to user's session set (for lookup and cleanup)
    await this.addToSet(userSessionsKey, session.token, ttlSeconds);
  }

  /**
   * Get a session by token
   */
  async getSession(token: string): Promise<SessionData | null> {
    const sessionKey = this.getSessionKey(token);
    return this.get<SessionData>(sessionKey);
  }

  /**
   * Delete a session
   */
  async deleteSession(token: string, userId?: number): Promise<void> {
    const sessionKey = this.getSessionKey(token);
    await this.delete(sessionKey);
    
    if (userId) {
      const userSessionsKey = this.getUserSessionsKey(userId);
      await this.removeFromSet(userSessionsKey, token);
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: number): Promise<SessionData[]> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const tokens = await this.getSetMembers(userSessionsKey);
    
    if (tokens.length === 0) {
      return [];
    }
    
    const sessionKeys = tokens.map(token => this.getSessionKey(token));
    const sessions = await this.getMany<SessionData>(sessionKeys);
    
    // Filter out expired/null sessions and clean up the set
    const validSessions = sessions.filter((s): s is SessionData => s !== null);
    
    // Clean up expired tokens from user's set
    const expiredTokens = tokens.filter((_, i) => sessions[i] === null);
    if (expiredTokens.length > 0) {
      for (const token of expiredTokens) {
        await this.removeFromSet(userSessionsKey, token);
      }
    }
    
    return validSessions;
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: number): Promise<number> {
    const userSessionsKey = this.getUserSessionsKey(userId);
    const tokens = await this.getSetMembers(userSessionsKey);
    
    if (tokens.length === 0) {
      return 0;
    }
    
    // Delete all session keys
    const sessionKeys = tokens.map(token => this.getSessionKey(token));
    await this.deleteMany(sessionKeys);
    
    // Delete the user's session set
    await this.delete(userSessionsKey);
    
    return tokens.length;
  }

  /**
   * Update session last accessed time
   */
  async touchSession(token: string): Promise<void> {
    const session = await this.getSession(token);
    if (session) {
      session.lastAccessedAt = Date.now();
      await this.setSession(session);
    }
  }

  /**
   * Extend session expiration
   */
  async extendSession(token: string, newExpiresAt: number): Promise<void> {
    const session = await this.getSession(token);
    if (session) {
      session.expiresAt = newExpiresAt;
      session.lastAccessedAt = Date.now();
      await this.setSession(session);
    }
  }

  // -------------------------------------------------------------------------
  // Set Operations (for session tracking)
  // -------------------------------------------------------------------------

  /**
   * Add member to a set
   */
  protected abstract addToSet(key: string, member: string, ttlSeconds?: number): Promise<void>;

  /**
   * Remove member from a set
   */
  protected abstract removeFromSet(key: string, member: string): Promise<void>;

  /**
   * Get all members of a set
   */
  protected abstract getSetMembers(key: string): Promise<string[]>;
}

// ============================================================================
// Factory
// ============================================================================

let globalCache: AbstractCache | null = null;

export async function createCache(config: CacheConfig): Promise<AbstractCache> {
  let cache: AbstractCache;

  switch (config.type) {
    case 'memory':
      const { MemoryCache } = require('../adapters/memory-cache');
      cache = new MemoryCache(config);
      break;
    
    case 'redis':
      const { RedisCache } = require('../adapters/redis-cache');
      cache = new RedisCache(config);
      break;
    
    case 'valkey':
      const { ValkeyCache } = require('../adapters/valkey-cache');
      cache = new ValkeyCache(config);
      break;
    
    default:
      throw new Error(`Unknown cache type: ${(config as any).type}`);
  }

  await cache.initialize();
  return cache;
}

export function setGlobalCache(cache: AbstractCache): void {
  globalCache = cache;
}

export function getGlobalCache(): AbstractCache {
  if (!globalCache) {
    throw new Error('Global cache not initialized. Call setGlobalCache() first.');
  }
  return globalCache;
}

export function clearGlobalCache(): void {
  globalCache = null;
}
