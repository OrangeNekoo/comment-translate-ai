// src/api/BaseClient.ts
import { ClientConfig, RetryConfig, TranslationResult } from '../types';
import { TranslationError, ErrorCode } from '../errors/TranslationError';
import { withRetry } from '../utils/retry';

export abstract class BaseClient {
    protected config: ClientConfig;
    protected retryConfig: RetryConfig;

    constructor(config: ClientConfig, retryConfig?: Partial<RetryConfig>) {
        this.config = config;
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000,
            jitter: true,
            ...retryConfig
        };
    }

    /**
     * Execute translation (Template Method)
     */
    async translate(prompt: string): Promise<string> {
        // Validate configuration
        this.validateConfig();

        // Execute request with retry
        const result = await withRetry(
            () => this.doTranslate(prompt),
            this.retryConfig,
            '翻译请求'
        );

        // Post-process
        return this.postProcess(result.text);
    }

    /**
     * Execute actual translation request (implemented by subclasses)
     */
    protected abstract doTranslate(prompt: string): Promise<TranslationResult>;

    /**
     * Validate configuration (can be extended by subclasses)
     */
    protected validateConfig(): void {
        if (!this.config.apiKey || this.config.apiKey.trim() === '') {
            throw new TranslationError(ErrorCode.CONFIG_MISSING_API_KEY);
        }

        if (!this.config.modelName || this.config.modelName.trim() === '') {
            throw new TranslationError(ErrorCode.CONFIG_INVALID_MODEL);
        }
    }

    /**
     * Post-process translation result
     */
    protected postProcess(text: string): string {
        // Remove leading/trailing whitespace
        text = text.trim();
        
        // Filter thinking content if configured
        if (this.config.filterThinkingContent) {
            text = this.filterThinkingContent(text);
        }
        
        return text;
    }

    /**
     * Filter thinking content from response
     */
    protected filterThinkingContent(text: string): string {
        // Remove <thinking>...</thinking> tags and content
        text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

        // Remove "> Reasoning" blocks ending with "Reasoned for xx seconds"
        text = text.replace(/> Reasoning[\s\S]*?Reasoned for\s*\d+\s*seconds/gi, '');

        // Remove excessive newlines
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
    }

    /**
     * Create cache key
     */
    protected createCacheKey(prompt: string): string {
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            const char = prompt.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `${this.getClientType()}_${Math.abs(hash).toString(16)}`;
    }

    /**
     * Get client type (for cache key)
     */
    protected abstract getClientType(): string;

    /**
     * Check if streaming is supported
     */
    abstract supportsStreaming(): boolean;

    /**
     * Stream translation (optional implementation)
     */
    async *translateStream(prompt: string): AsyncGenerator<string, void, unknown> {
        throw new TranslationError(
            ErrorCode.UNKNOWN_ERROR,
            undefined,
            '当前客户端不支持流式传输'
        );
    }
}
