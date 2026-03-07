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
            ttl: 30 * 60 * 1000 // 30 minutes
        });
        this.promptBuilder = new PromptBuilder();
        this.updateClient();
    }

    /**
     * Update configuration
     */
    updateConfig(config: AiTranslateConfig): void {
        const oldModelType = this.config.modelType;
        this.config = config;
        
        // Recreate client if model type changed
        if (oldModelType !== config.modelType) {
            this.updateClient();
        } else {
            // Update existing client config
            this.updateClient();
        }
    }

    /**
     * Translate content
     */
    async translate(content: string, options: TranslationOptions = {}): Promise<string> {
        const { to = 'auto', suppressError = false } = options;
        const targetLang = to === 'auto' ? 'zh-CN' : to;

        // Check cache
        const cacheKey = CacheService.generateKey(content, targetLang, this.config.modelType);
        const cached = this.cacheService.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Check for pending request (deduplication)
        const pendingKey = `${content}:${targetLang}:${this.config.modelType}`;
        if (this.pendingRequests.has(pendingKey)) {
            return this.pendingRequests.get(pendingKey)!;
        }

        // Create translation promise
        const translationPromise = this.doTranslate(content, targetLang, suppressError);
        this.pendingRequests.set(pendingKey, translationPromise);

        try {
            const result = await translationPromise;
            
            // Cache the result
            this.cacheService.set(cacheKey, result);
            
            return result;
        } finally {
            // Clean up pending request
            this.pendingRequests.delete(pendingKey);
        }
    }

    /**
     * Perform actual translation
     */
    private async doTranslate(content: string, targetLang: string, suppressError: boolean): Promise<string> {
        try {
            // Build prompt
            const prompt = this.promptBuilder.buildTranslatePrompt(
                content,
                targetLang,
                this.config.customTranslatePrompt
            );

            // Get client
            const client = this.getClient();

            // Execute translation
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
     * Detect language
     */
    async detectLanguage(text: string): Promise<string> {
        try {
            const prompt = this.promptBuilder.buildLanguageDetectionPrompt(text);
            const client = this.getClient();
            
            // Use lower temperature for consistent language detection
            const originalTemp = this.config.temperature;
            this.config.temperature = 0;
            
            const result = await client.translate(prompt);
            
            // Restore temperature
            this.config.temperature = originalTemp;

            // Extract BCP 47 code from result
            const bcp47Match = result.match(/[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*/);
            if (bcp47Match) {
                return bcp47Match[0];
            }

            return result.trim().replace(/["'.]/g, '');
        } catch (error) {
            console.error('Language detection failed:', error);
            return 'unknown';
        }
    }

    /**
     * Get or create API client
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
     * Update/create API client based on config
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

        // Only OpenAI is supported
        this.client = new OpenAIClient(clientConfig);
    }

    /**
     * Handle error
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
     * Get cache statistics
     */
    getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
        return this.cacheService.getStats();
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cacheService.clear();
    }
}
