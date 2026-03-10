// src/services/TranslationService.ts
import { ITranslateOptions } from '../types';
import { AiTranslateConfig } from '../types';
import { CacheService } from './CacheService';
import { PromptBuilder } from '../core/PromptBuilder';
import { OpenAIClient } from '../api/OpenAIClient';
import { BaseClient } from '../api/BaseClient';
import { TranslationError, ErrorCode } from '../errors/TranslationError';
import { window } from 'vscode';
import { LoggingService } from './LoggingService';

export interface TranslationOptions extends ITranslateOptions {
    suppressError?: boolean;
}

export class TranslationService {
    private config: AiTranslateConfig;
    private cacheService: CacheService;
    private promptBuilder: PromptBuilder;
    private client: BaseClient | null = null;
    private pendingRequests: Map<string, Promise<string>> = new Map();
    private logger: LoggingService;

    constructor(config: AiTranslateConfig, logger?: LoggingService) {
        this.config = config;
        this.logger = logger ?? new LoggingService();
        this.cacheService = new CacheService({
            maxSize: 1000,
            ttl: 30 * 60 * 1000 // 30 分钟
        });
        this.promptBuilder = new PromptBuilder();
        this.updateClient();
    }

    /**
     * 更新配置
     */
    updateConfig(config: AiTranslateConfig): void {
        const oldModelType = this.config.modelType;
        this.config = config;

        // 如果模型类型改变，重新创建客户端
        if (oldModelType !== config.modelType) {
            this.updateClient();
        } else {
            // 更新现有客户端配置
            this.updateClient();
        }
    }

    /**
     * 翻译内容
     */
    async translate(content: string, options: TranslationOptions = {}): Promise<string> {
        const { to = 'auto', suppressError = false } = options;
        const targetLang = to === 'auto' ? 'zh-CN' : to;

        this.logger.debug('翻译请求：内容="%s...", 目标语言=%s',
            content.substring(0, 50), targetLang);

        // 检查缓存
        const cacheKey = CacheService.generateKey(content, targetLang, this.config.modelType);
        const cached = this.cacheService.get(cacheKey);
        if (cached) {
            this.logger.info('缓存命中：key=%s', cacheKey.substring(0, 20));
            return cached;
        }

        this.logger.debug('缓存未命中：key=%s', cacheKey.substring(0, 20));

        // 检查待处理的请求（去重）
        const pendingKey = `${content}:${targetLang}:${this.config.modelType}`;
        if (this.pendingRequests.has(pendingKey)) {
            this.logger.debug('使用待处理请求：key=%s', pendingKey);
            return this.pendingRequests.get(pendingKey)!;
        }

        // 创建翻译 Promise
        const translationPromise = this.doTranslate(content, targetLang, suppressError);
        this.pendingRequests.set(pendingKey, translationPromise);

        try {
            const result = await translationPromise;

            // 缓存结果
            this.cacheService.set(cacheKey, result);
            this.logger.info('翻译完成：内容长度=%d', result.length);

            return result;
        } catch (error) {
            this.logger.error('翻译失败：%s', error instanceof Error ? error.message : '未知错误');
            throw error;
        } finally {
            // 清理待处理请求
            this.pendingRequests.delete(pendingKey);
        }
    }

    /**
     * 执行实际翻译
     */
    private async doTranslate(content: string, targetLang: string, suppressError: boolean): Promise<string> {
        try {
            // 构建提示词
            const prompt = this.promptBuilder.buildTranslatePrompt(
                content,
                targetLang,
                this.config.customTranslatePrompt
            );

            this.logger.debug('构建提示词：长度=%d', prompt.length);

            // 获取客户端
            const client = this.getClient();

            // 执行翻译
            const result = await client.translate(prompt);

            return result;
        } catch (error) {
            if (!suppressError) {
                this.handleError(error);
            }
            throw error;
        }
    }

    /**
     * 检测语言
     */
    async detectLanguage(text: string): Promise<string> {
        try {
            this.logger.debug('语言检测：内容长度=%d', text.length);

            const prompt = this.promptBuilder.buildLanguageDetectionPrompt(text);

            // 为语言检测创建专门的客户端，使用温度 0 以获得一致的结果
            const detectionClient = new OpenAIClient({
                apiKey: this.config.apiKey,
                modelName: this.config.modelName,
                apiEndpoint: this.config.apiEndpoint,
                temperature: 0, // 使用较低的温度以获得一致的语言检测结果
                maxTokens: this.config.maxTokens,
                streaming: false,
                filterThinkingContent: this.config.filterThinkingContent
            }, undefined, this.logger);

            const result = await detectionClient.translate(prompt);

            // 从结果中提取 BCP 47 代码
            const bcp47Match = result.match(/[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*/);
            if (bcp47Match) {
                this.logger.debug('语言检测结果：%s', bcp47Match[0]);
                return bcp47Match[0];
            }

            const detected = result.trim().replace(/["'.]/g, '');
            this.logger.debug('语言检测结果：%s', detected);
            return detected;
        } catch (error) {
            this.logger.error('语言检测失败：%s', error instanceof Error ? error.message : '未知错误');
            return 'unknown';
        }
    }

    /**
     * 获取或创建 API 客户端
     */
    private getClient(): BaseClient {
        if (!this.client) {
            this.updateClient();
        }

        if (!this.client) {
            throw new TranslationError(ErrorCode.CONFIG_INVALID_MODEL);
        }

        return this.client;
    }

    /**
     * 根据配置更新/创建 API 客户端
     */
    private updateClient(): void {
        const clientConfig = {
            apiKey: this.config.apiKey,
            modelName: this.config.modelName,
            apiEndpoint: this.config.apiEndpoint,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            streaming: this.config.streaming,
            filterThinkingContent: this.config.filterThinkingContent
        };

        // 仅支持 OpenAI
        this.client = new OpenAIClient(clientConfig, undefined, this.logger);
    }

    /**
     * 处理错误
     */
    private handleError(error: unknown): void {
        if (error instanceof TranslationError) {
            window.showErrorMessage(`翻译失败：${error.userMessage}`);
        } else if (error instanceof Error) {
            window.showErrorMessage(`翻译失败：${error.message}`);
        } else {
            window.showErrorMessage('翻译失败：发生未知错误');
        }
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
        return this.cacheService.getStats();
    }

    /**
     * 清除缓存
     */
    clearCache(): void {
        this.cacheService.clear();
    }
}
