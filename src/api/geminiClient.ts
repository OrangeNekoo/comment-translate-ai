// src/api/GeminiClient.ts
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { BaseClient } from './BaseClient';
import { TranslationResult, ClientConfig, RetryConfig } from '../types';
import { TranslationError, ErrorCode } from '../errors/TranslationError';

export class GeminiClient extends BaseClient {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(config: ClientConfig, retryConfig?: Partial<RetryConfig>) {
        super(config, retryConfig);
        this.genAI = new GoogleGenerativeAI(config.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: config.modelName || 'gemini-2.0-flash'
        });
    }

    /**
     * Execute translation request
     */
    protected async doTranslate(prompt: string): Promise<TranslationResult> {
        try {
            const result = await this.model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [{ text: prompt }]
                }]
            });

            const response = await result.response;
            const text = response.text();

            if (!text) {
                throw new TranslationError(
                    ErrorCode.API_INVALID_RESPONSE,
                    undefined,
                    'Gemini API 返回内容为空'
                );
            }

            return {
                text: text,
                usage: undefined // Gemini SDK doesn't provide usage info in this version
            };
        } catch (error) {
            if (error instanceof TranslationError) {
                throw error;
            }
            
            // Handle Gemini SDK specific errors
            if (error instanceof Error) {
                if (error.message.includes('API key')) {
                    throw new TranslationError(ErrorCode.API_AUTHENTICATION, error);
                }
                if (error.message.includes('quota')) {
                    throw new TranslationError(ErrorCode.API_QUOTA_EXCEEDED, error);
                }
                if (error.message.includes('rate limit')) {
                    throw new TranslationError(ErrorCode.API_RATE_LIMIT, error);
                }
                throw new TranslationError(ErrorCode.API_INVALID_RESPONSE, error, error.message);
            }
            
            throw TranslationError.fromAxiosError(error);
        }
    }

    /**
     * Validate Gemini configuration
     */
    protected validateConfig(): void {
        // Only check API key for Gemini
        if (!this.config.apiKey || this.config.apiKey.trim() === '') {
            throw new TranslationError(ErrorCode.CONFIG_MISSING_API_KEY);
        }

        if (!this.config.modelName || this.config.modelName.trim() === '') {
            // Use default model
            this.config.modelName = 'gemini-2.0-flash';
        }
    }

    /**
     * Get client type
     */
    protected getClientType(): string {
        return 'gemini';
    }

    /**
     * Check if streaming is supported
     */
    supportsStreaming(): boolean {
        // Gemini streaming can be implemented in future
        return false;
    }
}
