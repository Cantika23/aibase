/**
 * In-Memory Cache Adapter
 * 
 * Stores cache data in process memory.
 * This is the default cache backend for single-node deployments.
 * 
 * Features:
 * - TTL support with automatic expiration
 * - LRU eviction when max size is reached
 * - Stats tracking
 */

import {
  AbstractCache,
  type CacheConfig,
} from '../abstraction/cache';

interface CacheItem<T = unknown> {
  value: T;
  expiresAt: number; // 0 = no expiry
  lastAccessed: number;
}

interface MemoryCacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
}

export class MemoryCache extends AbstractCache {
  private cache: Map<string, CacheItem> = new Map();
  private stats: MemoryCacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
  };
  private cleanupInterval?: Timer;
  
  private maxSize: number;
  private defaultTTL: number;
  private checkPeriod: number;

  constructor(config: CacheConfig) {
    super(config);
    if (config.type !== 'memory') {
      throw new Error('MemoryCache requires config.type to be "memory"');
    }
    
    this.maxSize = config.memory?.maxSize || 10000;
    this.defaultTTL = (config.memory?.ttlSeconds || 3600) * 1000;
    this.checkPeriod = (config.memory?.checkPeriod || 600) * 1000;
  }

  async initialize(): Promise<void> {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.checkPeriod);
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.cache.clear();
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (item.expiresAt > 0 && item.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Update last accessed for LRU
    item.lastAccessed = Date.now();
    this.stats.hits++;
    return item.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTTL;
    
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      expiresAt: ttl > 0 ? Date.now() + ttl : 0,
      lastAccessed: Date.now(),
    });
    
    this.stats.sets++;
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.stats.deletes++;
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    // Check if expired
    if (item.expiresAt > 0 && item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) + amount;
    await this.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  async setNX<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    if (await this.exists(key)) {
      return false;
    }
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async getSet<T>(key: string, value: T, ttlSeconds?: number): Promise<T | null> {
    const previous = await this.get<T>(key);
    await this.set(key, value, ttlSeconds);
    return previous;
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.cache.delete(key);
    }
    this.stats.deletes += keys.length;
  }

  async getMany<T>(keys: string[]): Promise<(T | null)[]> {
    return Promise.all(keys.map(key => this.get<T>(key)));
  }

  async setMany<T>(entries: { key: string; value: T }[], ttlSeconds?: number): Promise<void> {
    await Promise.all(entries.map(entry => this.set(entry.key, entry.value, ttlSeconds)));
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async getStats(): Promise<{ hits: number; misses: number; keys: number; memoryUsage?: number }> {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      keys: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  // -------------------------------------------------------------------------
  // Set Operations
  // -------------------------------------------------------------------------

  protected async addToSet(key: string, member: string, ttlSeconds?: number): Promise<void> {
    const set = await this.get<Set<string>>(key) || new Set<string>();
    set.add(member);
    await this.set(key, set, ttlSeconds);
  }

  protected async removeFromSet(key: string, member: string): Promise<void> {
    const set = await this.get<Set<string>>(key);
    if (set) {
      set.delete(member);
      if (set.size === 0) {
        await this.delete(key);
      } else {
        await this.set(key, set);
      }
    }
  }

  protected async getSetMembers(key: string): Promise<string[]> {
    const set = await this.get<Set<string>>(key);
    return set ? Array.from(set) : [];
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiresAt > 0 && item.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[MemoryCache] Cleaned up ${cleaned} expired entries`);
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`[MemoryCache] Evicted LRU entry: ${oldestKey}`);
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation based on entry count
    // Actual memory usage would require v8 heap statistics
    const entryCount = this.cache.size;
    const estimatedBytesPerEntry = 200; // Average estimate
    return entryCount * estimatedBytesPerEntry;
  }
}
