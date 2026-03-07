// src/services/TranslationService.ts
import { ITranslateOptions } from '../types';
import { AiTranslateConfig } from '../types';
import { CacheService } from './CacheService';
import { PromptBuilder } from '../core/PromptBuilder';
import { OpenAIClient } from '../api/OpenAIClient';
import { BaseClient } from '../api/BaseClient';
import { TranslationError, ErrorCode } from '../errors/TranslationError';
import { window } from 'vscode';

export interface TranslationOptions extends ITranslateOptions {
    suppressError?: boolean;
}

export class TranslationService {
    private config: AiTranslateConfig;
    private cacheService: CacheService;
    private promptBuilder: PromptBuilder;
    private client: BaseClient | null = null;
    private pendingRequests: Map<string, Promise<string>> = new Map();

    constructor(config: AiTranslateConfig) {
        this.config = config;
        this.cacheService = new CacheService({
            maxSize: 1000,
            ttl: 30 * 60 * 1000 // 30分钟
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

        // 检查缓存
        const cacheKey = CacheService.generateKey(content, targetLang, this.config.modelType);
        const cached = this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // 检查待处理的请求（去重）
        const pendingKey = `${content}:${targetLang}:${this.config.modelType}`;
        if (this.pendingRequests.has(pendingKey)) {
            return this.pendingRequests.get(pendingKey)!;
        }

        // 创建翻译Promise
        const translationPromise = this.doTranslate(content, targetLang, suppressError);
        this.pendingRequests.set(pendingKey, translationPromise);

        try {
            const result = await translationPromise;
            
            // 缓存结果
            this.cacheService.set(cacheKey, result);
            
            return result;
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
            const prompt = this.promptBuilder.buildLanguageDetectionPrompt(text);
            
            // 为语言检测创建专门的客户端，使用温度0以获得一致的结果
            const detectionClient = new OpenAIClient({
                apiKey: this.config.apiKey,
                modelName: this.config.modelName,
                apiEndpoint: this.config.apiEndpoint,
                temperature: 0, // 使用较低的温度以获得一致的语言检测结果
                maxTokens: this.config.maxTokens,
                streaming: false,
                filterThinkingContent: this.config.filterThinkingContent
            });
            
            const result = await detectionClient.translate(prompt);

            // 从结果中提取BCP 47代码
            const bcp47Match = result.match(/[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*/);
            if (bcp47Match) {
                return bcp47Match[0];
            }

            return result.trim().replace(/["'.]/g, '');
        } catch (error) {
            console.error('语言检测失败：', error);
            return 'unknown';
        }
    }

    /**
     * 获取或创建API客户端
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
     * 根据配置更新/创建API客户端
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

        // 仅支持OpenAI
        this.client = new OpenAIClient(clientConfig);
    }

    /**
     * 处理错误
     */
    private handleError(error: unknown): void {
        if (error instanceof TranslationError) {
            window.showErrorMessage(`翻译失败: ${error.userMessage}`);
        } else if (error instanceof Error) {
            window.showErrorMessage(`翻译失败: ${error.message}`);
        } else {
            window.showErrorMessage('翻译失败: 发生未知错误');
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
