// src/services/CacheService.ts
import { CacheEntry, CacheOptions } from '../types';

export class CacheService {
    private cache: Map<string, CacheEntry>;
    private maxSize: number;
    private ttl: number;
    private hits: number = 0;
    private misses: number = 0;

    constructor(options: CacheOptions = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 30 * 60 * 1000; // 30 minutes
    }

    /**
     * Generate cache key
     */
    static generateKey(content: string, targetLang: string, modelType: string): string {
        const contentHash = this.simpleHash(content);
        return `${contentHash}:${targetLang}:${modelType}`;
    }

    /**
     * Simple string hash
     */
    private static simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * Get cached value
     */
    get(key: string): string | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.misses++;
            return undefined;
        }

        if (this.isExpired(entry)) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }

        entry.accessCount++;
        this.hits++;
        return entry.value;
    }

    /**
     * Set cache value
     */
    set(key: string, value: string): void {
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            accessCount: 1
        });
    }

    /**
     * Check if key exists
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Delete cache entry
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * Get cache statistics
     */
    getStats(): { size: number; hits: number; misses: number; hitRate: number } {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0
        };
    }

    /**
     * Check if entry is expired
     */
    private isExpired(entry: CacheEntry): boolean {
        return Date.now() - entry.timestamp > this.ttl;
    }

    /**
     * LRU eviction strategy
     */
    private evictLRU(): void {
        if (this.cache.size === 0) {
            return;
        }

        let oldestKey: string | undefined;
        let oldestAccessCount = Infinity;
        let oldestTimestamp = Infinity;

        for (const [key, entry] of Array.from(this.cache.entries())) {
            if (entry.accessCount < oldestAccessCount ||
                (entry.accessCount === oldestAccessCount && entry.timestamp < oldestTimestamp)) {
                oldestKey = key;
                oldestAccessCount = entry.accessCount;
                oldestTimestamp = entry.timestamp;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Clean up expired entries
     */
    cleanup(): number {
        let cleaned = 0;
        for (const [key, entry] of Array.from(this.cache.entries())) {
            if (this.isExpired(entry)) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        return cleaned;
    }
}
