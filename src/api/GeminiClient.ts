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

    protected async doTranslate(prompt: string): Promise<TranslationResult> {
        try {
            const result = await this.model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            const response = await result.response;
            const text = response.text();
            if (!text) {
                throw new TranslationError(ErrorCode.API_INVALID_RESPONSE, undefined, 'Gemini API 返回内容为空');
            }
            return { text: text, usage: undefined };
        } catch (error) {
            if (error instanceof TranslationError) { throw error; }
            if (error instanceof Error) {
                if (error.message.includes('API key')) throw new TranslationError(ErrorCode.API_AUTHENTICATION, error);
                if (error.message.includes('quota')) throw new TranslationError(ErrorCode.API_QUOTA_EXCEEDED, error);
                if (error.message.includes('rate limit')) throw new TranslationError(ErrorCode.API_RATE_LIMIT, error);
                throw new TranslationError(ErrorCode.API_INVALID_RESPONSE, error, error.message);
            }
            throw TranslationError.fromAxiosError(error);
        }
    }

    protected validateConfig(): void {
        if (!this.config.apiKey?.trim()) throw new TranslationError(ErrorCode.CONFIG_MISSING_API_KEY);
        if (!this.config.modelName?.trim()) this.config.modelName = 'gemini-2.0-flash';
    }

    protected getClientType(): string { return 'gemini'; }
    supportsStreaming(): boolean { return false; }
}
