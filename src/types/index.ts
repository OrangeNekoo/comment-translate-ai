// src/types/index.ts
import { ITranslateOptions } from 'comment-translate-manager';

export { ITranslateOptions };

// 模型类型
export type ModelType = 'OpenAI';

// 命名规则类型
export type NamingRuleType = 'default' | 'Camel Case' | 'Kernighan and Ritchie' | 'Snake Case' | 'Hungarian Notation';

// 翻译配置
export interface TranslationConfig {
    modelType: ModelType;
    apiKey: string;
    apiEndpoint?: string;
    modelName: string;
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
}

// 命名配置
export interface NamingConfig {
    namingRules: NamingRuleType;
    customNamingPrompt?: string;
}

// 日志级别类型
export type LogLevelType = 'error' | 'warn' | 'info' | 'debug';

// 完整配置
export interface AiTranslateConfig extends TranslationConfig, NamingConfig {
    filterThinkingContent: boolean;
    problemTranslateLang: string;
    customTranslatePrompt?: string;
    logLevel?: LogLevelType;
}

// 缓存条目
export interface CacheEntry {
    value: string;
    timestamp: number;
    accessCount: number;
}

// 重试配置
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    jitter?: boolean;
}

// API客户端配置
export interface ClientConfig {
    apiKey: string;
    modelName: string;
    apiEndpoint?: string;
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
    filterThinkingContent?: boolean;
}

// 验证结果
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// 提示词类型
export enum PromptType {
    TRANSLATE = 'translate',
    NAMING = 'naming',
    LANGUAGE_DETECTION = 'language_detection'
}

// 问题翻译条目
export interface ProblemTranslationEntry {
    originalMessage: string;
    translatedMessage: string;
    language: string;
    timestamp: number;
}

// 翻译结果
export interface TranslationResult {
    text: string;
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
}

// 防抖选项
export interface DebounceOptions {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
}

// 缓存选项
export interface CacheOptions {
    maxSize?: number;
    ttl?: number;
}
