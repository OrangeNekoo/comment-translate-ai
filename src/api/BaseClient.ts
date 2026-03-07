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
     * 执行翻译（模板方法模式）
     */
    async translate(prompt: string): Promise<string> {
        // 验证配置
        this.validateConfig();

        // 使用重试机制执行请求
        const result = await withRetry(
            () => this.doTranslate(prompt),
            this.retryConfig,
            '翻译请求'
        );

        // 后处理
        return this.postProcess(result.text);
    }

    /**
     * 执行实际翻译请求（由子类实现）
     */
    protected abstract doTranslate(prompt: string): Promise<TranslationResult>;

    /**
     * 验证配置（可由子类扩展）
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
     * 后处理翻译结果
     */
    protected postProcess(text: string): string {
        // 移除首尾空白
        text = text.trim();
        
        // 如果配置为过滤思考内容
        if (this.config.filterThinkingContent) {
            text = this.filterThinkingContent(text);
        }
        
        return text;
    }

    /**
     * 从响应中过滤思考内容
     */
    protected filterThinkingContent(text: string): string {
        // 移除<thinking>...</thinking>标签及其内容
        text = text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

        // 移除"> Reasoning"块，以"Reasoned for xx seconds"结尾
        text = text.replace(/> Reasoning[\s\S]*?Reasoned for\s*\d+\s*seconds/gi, '');

        // 移除多余的空行
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
    }

    /**
     * 创建缓存键
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
     * 获取客户端类型（用于缓存键）
     */
    protected abstract getClientType(): string;

    /**
     * 检查是否支持流式传输
     */
    abstract supportsStreaming(): boolean;

    /**
     * 流式翻译（可选实现）
     */
    async *translateStream(prompt: string): AsyncGenerator<string, void, unknown> {
        throw new TranslationError(
            ErrorCode.UNKNOWN_ERROR,
            undefined,
            '当前客户端不支持流式传输'
        );
    }
}
