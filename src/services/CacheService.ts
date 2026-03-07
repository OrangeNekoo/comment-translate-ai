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
        this.ttl = options.ttl || 30 * 60 * 1000; // 30分钟
    }

    /**
     * 生成缓存键
     */
    static generateKey(content: string, targetLang: string, modelType: string): string {
        const contentHash = this.simpleHash(content);
        return `${contentHash}:${targetLang}:${modelType}`;
    }

    /**
     * 简单字符串哈希
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
     * 获取缓存值
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
     * 设置缓存值
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
     * 检查键是否存在
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
     * 删除缓存条目
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * 清除所有缓存
     */
    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    /**
     * 获取缓存统计信息
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
     * 检查条目是否过期
     */
    private isExpired(entry: CacheEntry): boolean {
        return Date.now() - entry.timestamp > this.ttl;
    }

    /**
     * LRU淘汰策略
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
     * 清理过期条目
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
