// src/api/OpenAIClient.ts
import axios, { AxiosResponse } from 'axios';
import { BaseClient } from './BaseClient';
import { TranslationResult, ClientConfig, RetryConfig, ApiFormat } from '../types';
import { TranslationError, ErrorCode } from '../errors/TranslationError';
import { normalizeApiUrl } from '../utils/url';
import { LoggingService } from '../services/LoggingService';

// OpenAI Chat Completions 响应接口
interface OpenAIChatResponse {
    choices: Array<{
        message?: { content: string; };
        delta?: { content?: string; };
        finish_reason: string | null;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

// OpenAI Responses API 输出项接口
interface OpenAIResponsesOutput {
    id: string;
    type: string;
    role?: string;
    content?: Array<{
        type: string;
        text: string;
    }>;
}

// OpenAI Responses API 响应接口
interface OpenAIResponsesApiResponse {
    output: OpenAIResponsesOutput[];
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
}

export class OpenAIClient extends BaseClient {
    private apiUrl: string;
    private apiFormat: ApiFormat;
    private logger: LoggingService;

    constructor(config: ClientConfig, retryConfig?: Partial<RetryConfig>, logger?: LoggingService) {
        super(config, retryConfig);
        this.apiFormat = config.apiFormat ?? 'chat-completions';
        const path = this.apiFormat === 'responses' ? '/responses' : '/chat/completions';
        this.apiUrl = normalizeApiUrl(config.apiEndpoint || 'https://api.openai.com/v1', path);
        this.logger = logger ?? new LoggingService();
    }

    protected async doTranslate(prompt: string): Promise<TranslationResult> {
        if (this.apiFormat === 'responses') {
            return this.doTranslateResponses(prompt);
        }
        return this.doTranslateChatCompletions(prompt);
    }

    private async doTranslateChatCompletions(prompt: string): Promise<TranslationResult> {
        const url = this.apiUrl;
        const data: Record<string, unknown> = {
            ...(this.config.extraRequestParams ?? {}),
            model: this.config.modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: this.config.temperature ?? 0.5,
            max_tokens: this.config.maxTokens,
            stream: false
        };
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };

        this.logger.debug('翻译请求（Chat Completions）：内容长度=%d', prompt.length);
        this.logger.debug('API 请求：POST %s', url);
        this.logger.debug('请求参数：model=%s, temperature=%d, maxTokens=%d',
            this.config.modelName, this.config.temperature ?? 0.5, this.config.maxTokens);

        const startTime = Date.now();

        try {
            const response: AxiosResponse<OpenAIChatResponse> = await axios.post(url, data, {
                headers, timeout: 50000
            });

            if (!response.data?.choices?.[0]?.message?.content) {
                throw new TranslationError(ErrorCode.API_INVALID_RESPONSE, undefined, 'API 响应格式不符合标准');
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const usage = response.data.usage;

            this.logger.info('API 响应：tokens=%d, 耗时=%ss',
                usage?.total_tokens || 0, duration);
            this.logger.debug('响应内容：%s', response.data.choices[0].message.content.substring(0, 200));

            return {
                text: response.data.choices[0].message.content,
                usage: response.data.usage ? {
                    promptTokens: response.data.usage.prompt_tokens,
                    completionTokens: response.data.usage.completion_tokens,
                    totalTokens: response.data.usage.total_tokens
                } : undefined
            };
        } catch (error) {
            this.logger.error('请求失败：%s', error instanceof Error ? error.message : '未知错误');

            if (error instanceof TranslationError) {
                throw error;
            }
            throw TranslationError.fromAxiosError(error);
        }
    }

    private async doTranslateResponses(prompt: string): Promise<TranslationResult> {
        const url = this.apiUrl;
        const data: Record<string, unknown> = {
            ...(this.config.extraRequestParams ?? {}),
            model: this.config.modelName,
            input: prompt,
            temperature: this.config.temperature ?? 0.5
        };
        if (this.config.maxTokens) {
            data.max_output_tokens = this.config.maxTokens;
        }

        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };

        this.logger.debug('翻译请求（Responses API）：内容长度=%d', prompt.length);
        this.logger.debug('API 请求：POST %s', url);
        this.logger.debug('请求参数：model=%s, temperature=%d, maxTokens=%d',
            this.config.modelName, this.config.temperature ?? 0.5, this.config.maxTokens);

        const startTime = Date.now();

        try {
            const response: AxiosResponse<OpenAIResponsesApiResponse> = await axios.post(url, data, {
                headers, timeout: 50000
            });

            const text = this.extractResponsesText(response.data);

            if (!text) {
                throw new TranslationError(ErrorCode.API_INVALID_RESPONSE, undefined, 'API 响应格式不符合标准');
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const usage = response.data.usage;

            this.logger.info('API 响应：tokens=%d, 耗时=%ss',
                usage?.total_tokens || 0, duration);
            this.logger.debug('响应内容：%s', text.substring(0, 200));

            return {
                text,
                usage: response.data.usage ? {
                    promptTokens: response.data.usage.input_tokens,
                    completionTokens: response.data.usage.output_tokens,
                    totalTokens: response.data.usage.total_tokens
                } : undefined
            };
        } catch (error) {
            this.logger.error('请求失败：%s', error instanceof Error ? error.message : '未知错误');

            if (error instanceof TranslationError) {
                throw error;
            }
            throw TranslationError.fromAxiosError(error);
        }
    }

    /**
     * 从 Responses API 响应中提取文本
     */
    private extractResponsesText(data: OpenAIResponsesApiResponse): string | null {
        if (!data.output || !Array.isArray(data.output)) {
            return null;
        }

        for (const item of data.output) {
            if (item.type === 'message' && item.content) {
                for (const content of item.content) {
                    if (content.type === 'output_text' && content.text) {
                        return content.text;
                    }
                }
            }
        }

        return null;
    }

    async *translateStream(prompt: string): AsyncGenerator<string, void, unknown> {
        if (!this.supportsStreaming()) {
            throw new TranslationError(ErrorCode.UNKNOWN_ERROR, undefined, '流式传输未启用');
        }

        // Responses API 暂不支持流式传输，降级为非流式
        if (this.apiFormat === 'responses') {
            this.logger.warn('Responses API 暂不支持流式传输，将使用非流式请求');
            const result = await this.doTranslateResponses(prompt);
            yield result.text;
            return;
        }

        this.validateConfig();
        const url = this.apiUrl;
        const data: Record<string, unknown> = {
            ...(this.config.extraRequestParams ?? {}),
            model: this.config.modelName,
            messages: [{ role: 'user', content: prompt }],
            temperature: this.config.temperature ?? 0.5,
            max_tokens: this.config.maxTokens,
            stream: true
        };
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
        };

        this.logger.debug('流式翻译请求：内容长度=%d', prompt.length);

        try {
            const response = await axios.post(url, data, {
                headers, responseType: 'stream', timeout: 50000
            });
            let buffer = '';
            for await (const chunk of response.data) {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed === 'data: [DONE]') {
                        continue;
                    }
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const json: OpenAIChatResponse = JSON.parse(trimmed.slice(6));
                            if (json.choices?.[0]?.delta?.content) {
                                yield json.choices[0].delta.content;
                            }
                        } catch (e) { console.debug('流式解析错误：', e); }
                    }
                }
            }
        } catch (error) {
            this.logger.error('流式请求失败：%s', error instanceof Error ? error.message : '未知错误');
            if (error instanceof TranslationError) {
                throw error;
            }
            throw TranslationError.fromAxiosError(error);
        }
    }

    protected validateConfig(): void {
        super.validateConfig();
        if (!this.apiUrl) { throw new TranslationError(ErrorCode.CONFIG_INVALID_ENDPOINT); }
    }

    protected getClientType(): string { return 'openai'; }
    supportsStreaming(): boolean { return this.config.streaming === true; }
}
