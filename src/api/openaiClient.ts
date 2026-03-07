// src/api/OpenAIClient.ts
import axios, { AxiosResponse } from 'axios';
import { BaseClient } from './BaseClient';
import { TranslationResult, ClientConfig, RetryConfig } from '../types';
import { TranslationError, ErrorCode } from '../errors/TranslationError';
import { normalizeApiUrl } from '../utils/url';

interface OpenAIResponse {
    choices: Array<{
        message?: {
            content: string;
        };
        delta?: {
            content?: string;
        };
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class OpenAIClient extends BaseClient {
    private apiUrl: string;

    constructor(config: ClientConfig, retryConfig?: Partial<RetryConfig>) {
        super(config, retryConfig);
        this.apiUrl = normalizeApiUrl(config.apiEndpoint || 'https://api.openai.com/v1');
    }

    /**
     * Execute translation request
     */
    protected async doTranslate(prompt: string): Promise<TranslationResult> {
        const url = this.apiUrl;
        
        const data = {
            model: this.config.modelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            temperature: this.config.temperature ?? 0.5,
            max_tokens: this.config.maxTokens,
            stream: false
        };

        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };

        try {
            const response: AxiosResponse<OpenAIResponse> = await axios.post(url, data, {
                headers,
                timeout: 50000
            });

            if (!response.data?.choices?.[0]?.message?.content) {
                throw new TranslationError(
                    ErrorCode.API_INVALID_RESPONSE,
                    undefined,
                    'API响应格式不符合标准'
                );
            }

            return {
                text: response.data.choices[0].message.content,
                usage: response.data.usage ? {
                    promptTokens: response.data.usage.prompt_tokens,
                    completionTokens: response.data.usage.completion_tokens,
                    totalTokens: response.data.usage.total_tokens
                } : undefined
            };
        } catch (error) {
            if (error instanceof TranslationError) {
                throw error;
            }
            throw TranslationError.fromAxiosError(error);
        }
    }

    /**
     * Stream translation
     */
    async *translateStream(prompt: string): AsyncGenerator<string, void, unknown> {
        if (!this.supportsStreaming()) {
            throw new TranslationError(
                ErrorCode.UNKNOWN_ERROR,
                undefined,
                '流式传输未启用'
            );
        }

        this.validateConfig();

        const url = this.apiUrl;
        
        const data = {
            model: this.config.modelName,
            messages: [{
                role: 'user',
                content: prompt
            }],
            temperature: this.config.temperature ?? 0.5,
            max_tokens: this.config.maxTokens,
            stream: true
        };

        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };

        try {
            const response = await axios.post(url, data, {
                headers,
                responseType: 'stream',
                timeout: 50000
            });

            let buffer = '';
            
            for await (const chunk of response.data) {
                const chunkStr = chunk.toString();
                buffer += chunkStr;
                
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer
                
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') {
                        continue;
                    }
                    
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const jsonStr = trimmed.slice(6);
                            const json: OpenAIResponse = JSON.parse(jsonStr);
                            
                            if (json.choices?.[0]?.delta?.content) {
                                yield json.choices[0].delta.content;
                            }
                        } catch (e) {
                            // Ignore parse errors for incomplete chunks
                            console.debug('Stream parse error:', e);
                        }
                    }
                }
            }
        } catch (error) {
            if (error instanceof TranslationError) {
                throw error;
            }
            throw TranslationError.fromAxiosError(error);
        }
    }

    /**
     * Validate OpenAI configuration
     */
    protected validateConfig(): void {
        super.validateConfig();

        if (!this.apiUrl) {
            throw new TranslationError(ErrorCode.CONFIG_INVALID_ENDPOINT);
        }
    }

    /**
     * Get client type
     */
    protected getClientType(): string {
        return 'openai';
    }

    /**
     * Check if streaming is supported
     */
    supportsStreaming(): boolean {
        return this.config.streaming === true;
    }
}
