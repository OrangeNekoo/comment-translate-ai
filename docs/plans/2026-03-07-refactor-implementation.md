# Comment Translate AI 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用分层架构重构 Comment Translate AI 扩展，提升代码质量、性能和健壮性，同时保持所有功能完全兼容。

**Architecture:** 
- 采用分层架构：核心层(core)、API层(api)、服务层(services)
- 使用模板方法模式统一API客户端
- 实现LRU缓存、指数退避重试、熔断等健壮性机制

**Tech Stack:** TypeScript, VS Code Extension API, Axios, @google/generative-ai

---

## 准备工作

**Step 1: 备份现有代码**

```bash
cd c:\Users\ShiZuKu\Documents\GitHub\comment-translate-ai
git add .
git commit -m "chore: backup before refactoring"
git checkout -b refactor/layered-architecture
```

---

## Phase 1: 基础设施 (6个任务)

### Task 1: 创建目录结构

**Files:**
- Create: `src/core/` (目录)
- Create: `src/api/` (目录)
- Create: `src/services/` (目录)
- Create: `src/types/` (目录)
- Create: `src/errors/` (目录)
- Create: `src/utils/` (目录)
- Create: `src/test/unit/` (目录)
- Create: `src/test/integration/` (目录)

**Step 1: 创建目录**

```bash
mkdir -p src/core src/api src/services src/types src/errors src/utils src/test/unit src/test/integration
```

**Step 2: 提交**

```bash
git add .
git commit -m "chore: create directory structure for layered architecture"
```

---

### Task 2: 定义核心类型

**Files:**
- Create: `src/types/index.ts`

**Step 1: 编写类型定义**

```typescript
// src/types/index.ts
import { ITranslateOptions } from 'comment-translate-manager';

export { ITranslateOptions };

// 模型类型
export type ModelType = 'OpenAI' | 'Gemini';

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

// 完整配置
export interface AiTranslateConfig extends TranslationConfig, NamingConfig {
    filterThinkingContent: boolean;
    problemTranslateLang: string;
    customTranslatePrompt?: string;
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
```

**Step 2: 验证编译**

```bash
npx tsc --noEmit src/types/index.ts
```

Expected: 无错误

**Step 3: 提交**

```bash
git add src/types/index.ts
git commit -m "feat(types): add core type definitions"
```

---

### Task 3: 实现错误处理类

**Files:**
- Create: `src/errors/TranslationError.ts`

**Step 1: 编写错误类**

```typescript
// src/errors/TranslationError.ts

export enum ErrorCode {
    CONFIG_MISSING_API_KEY = 'CONFIG_MISSING_API_KEY',
    CONFIG_INVALID_ENDPOINT = 'CONFIG_INVALID_ENDPOINT',
    CONFIG_INVALID_MODEL = 'CONFIG_INVALID_MODEL',
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    NETWORK_OFFLINE = 'NETWORK_OFFLINE',
    NETWORK_DNS_ERROR = 'NETWORK_DNS_ERROR',
    API_RATE_LIMIT = 'API_RATE_LIMIT',
    API_INVALID_RESPONSE = 'API_INVALID_RESPONSE',
    API_AUTHENTICATION = 'API_AUTHENTICATION',
    API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
    CACHE_ERROR = 'CACHE_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorDetails {
    code: ErrorCode;
    retryable: boolean;
    userMessage: string;
}

export const ErrorCodeMap: Record<ErrorCode, ErrorDetails> = {
    [ErrorCode.CONFIG_MISSING_API_KEY]: {
        code: ErrorCode.CONFIG_MISSING_API_KEY,
        retryable: false,
        userMessage: '请配置 API Key'
    },
    [ErrorCode.CONFIG_INVALID_ENDPOINT]: {
        code: ErrorCode.CONFIG_INVALID_ENDPOINT,
        retryable: false,
        userMessage: 'API 端点配置无效'
    },
    [ErrorCode.CONFIG_INVALID_MODEL]: {
        code: ErrorCode.CONFIG_INVALID_MODEL,
        retryable: false,
        userMessage: '模型配置无效'
    },
    [ErrorCode.NETWORK_TIMEOUT]: {
        code: ErrorCode.NETWORK_TIMEOUT,
        retryable: true,
        userMessage: '网络超时，正在重试...'
    },
    [ErrorCode.NETWORK_OFFLINE]: {
        code: ErrorCode.NETWORK_OFFLINE,
        retryable: true,
        userMessage: '网络连接失败，正在重试...'
    },
    [ErrorCode.NETWORK_DNS_ERROR]: {
        code: ErrorCode.NETWORK_DNS_ERROR,
        retryable: true,
        userMessage: 'DNS解析失败，正在重试...'
    },
    [ErrorCode.API_RATE_LIMIT]: {
        code: ErrorCode.API_RATE_LIMIT,
        retryable: true,
        userMessage: '请求过于频繁，请稍后再试'
    },
    [ErrorCode.API_INVALID_RESPONSE]: {
        code: ErrorCode.API_INVALID_RESPONSE,
        retryable: false,
        userMessage: 'API返回格式异常'
    },
    [ErrorCode.API_AUTHENTICATION]: {
        code: ErrorCode.API_AUTHENTICATION,
        retryable: false,
        userMessage: 'API认证失败，请检查API Key'
    },
    [ErrorCode.API_QUOTA_EXCEEDED]: {
        code: ErrorCode.API_QUOTA_EXCEEDED,
        retryable: false,
        userMessage: 'API配额已用完'
    },
    [ErrorCode.CACHE_ERROR]: {
        code: ErrorCode.CACHE_ERROR,
        retryable: false,
        userMessage: '缓存操作失败'
    },
    [ErrorCode.UNKNOWN_ERROR]: {
        code: ErrorCode.UNKNOWN_ERROR,
        retryable: false,
        userMessage: '发生未知错误'
    }
};

export class TranslationError extends Error {
    public readonly code: ErrorCode;
    public readonly retryable: boolean;
    public readonly userMessage: string;
    public readonly originalError?: Error;
    public readonly timestamp: number;

    constructor(
        code: ErrorCode,
        originalError?: Error,
        customMessage?: string
    ) {
        const details = ErrorCodeMap[code];
        const message = customMessage || details.userMessage;
        
        super(message);
        this.name = 'TranslationError';
        this.code = code;
        this.retryable = details.retryable;
        this.userMessage = message;
        this.originalError = originalError;
        this.timestamp = Date.now();

        Object.setPrototypeOf(this, TranslationError.prototype);
    }

    static fromAxiosError(error: any): TranslationError {
        if (!error) {
            return new TranslationError(ErrorCode.UNKNOWN_ERROR);
        }

        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return new TranslationError(ErrorCode.NETWORK_TIMEOUT, error);
        }
        if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            return new TranslationError(ErrorCode.NETWORK_DNS_ERROR, error);
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            return new TranslationError(ErrorCode.NETWORK_OFFLINE, error);
        }

        const status = error.response?.status;
        if (status === 401) {
            return new TranslationError(ErrorCode.API_AUTHENTICATION, error);
        }
        if (status === 429) {
            return new TranslationError(ErrorCode.API_RATE_LIMIT, error);
        }
        if (status === 402 || status === 403) {
            return new TranslationError(ErrorCode.API_QUOTA_EXCEEDED, error);
        }

        if (error.response?.data?.error) {
            return new TranslationError(
                ErrorCode.API_INVALID_RESPONSE,
                error,
                error.response.data.error.message || 'API返回错误'
            );
        }

        return new TranslationError(ErrorCode.UNKNOWN_ERROR, error);
    }

    toJSON(): object {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            retryable: this.retryable,
            timestamp: this.timestamp,
            originalError: this.originalError?.message
        };
    }
}
```

**Step 2: 验证编译**

```bash
npx tsc --noEmit src/errors/TranslationError.ts
```

**Step 3: 提交**

```bash
git add src/errors/
git commit -m "feat(errors): add TranslationError with error classification"
```

---

## Phase 2: 核心服务 (3个任务)

### Task 4: 实现缓存服务

**Files:**
- Create: `src/services/CacheService.ts`

**Step 1: 编写缓存服务**

```typescript
// src/services/CacheService.ts
import { CacheEntry } from '../types';

export interface CacheOptions {
    maxSize?: number;
    ttl?: number;
}

export class CacheService {
    private cache: Map<string, CacheEntry>;
    private maxSize: number;
    private ttl: number;
    private hits: number = 0;
    private misses: number = 0;

    constructor(options: CacheOptions = {}) {
        this.cache = new Map();
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 30 * 60 * 1000;
    }

    static generateKey(content: string, targetLang: string, modelType: string): string {
        const contentHash = this.simpleHash(content);
        return `${contentHash}:${targetLang}:${modelType}`;
    }

    private static simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    get(key: string): string | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.misses++;
            return undefined;
        }

        if (this.isExpired(entry)) {
            this.cache.delete(key);
            this.misses++;
            return undefined;
        }

        entry.accessCount++;
        this.hits++;
        return entry.value;
    }

    set(key: string, value: string): void {
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now(),
            accessCount: 1
        });
    }

    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) {
            return false;
        }
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
        this.hits = 0;
        this.misses = 0;
    }

    getStats(): { size: number; hits: number; misses: number; hitRate: number } {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0
        };
    }

    private isExpired(entry: CacheEntry): boolean {
        return Date.now() - entry.timestamp > this.ttl;
    }

    private evictLRU(): void {
        if (this.cache.size === 0) {
            return;
        }

        let oldestKey: string | undefined;
        let oldestAccessCount = Infinity;
        let oldestTimestamp = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.accessCount < oldestAccessCount ||
                (entry.accessCount === oldestAccessCount && entry.timestamp < oldestTimestamp)) {
                oldestKey = key;
                oldestAccessCount = entry.accessCount;
                oldestTimestamp = entry.timestamp;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
}
```

**Step 2: 验证编译**

```bash
npx tsc --noEmit src/services/CacheService.ts
```

**Step 3: 提交**

```bash
git add src/services/CacheService.ts
git commit -m "feat(services): add LRU CacheService with TTL support"
```

---

### Task 5: 实现配置管理器

**Files:**
- Create: `src/core/ConfigManager.ts`

**Step 1: 编写配置管理器**

```typescript
// src/core/ConfigManager.ts
import { workspace, Disposable, ConfigurationChangeEvent } from 'vscode';
import { AiTranslateConfig, ValidationResult, ModelType, NamingRuleType } from '../types';
import { isValidHttpUrl } from '../utils/url';

export const CONFIG_PREFIX = 'aiTranslate';

export class ConfigManager implements Disposable {
    private config: AiTranslateConfig;
    private changeListeners: Set<() => void> = new Set();
    private disposables: Disposable[] = [];

    constructor() {
        this.config = this.loadConfig();
        
        const disposable = workspace.onDidChangeConfiguration(
            (e) => this.handleConfigChange(e)
        );
        this.disposables.push(disposable);
    }

    getConfig(): Readonly<AiTranslateConfig> {
        return Object.freeze({ ...this.config });
    }

    refresh(): void {
        this.config = this.loadConfig();
        this.notifyListeners();
    }

    onConfigChange(listener: () => void): Disposable {
        this.changeListeners.add(listener);
        return {
            dispose: () => {
                this.changeListeners.delete(listener);
            }
        };
    }

    validate(): ValidationResult {
        const errors: string[] = [];
        const config = this.config;

        if (!config.apiKey || config.apiKey.trim() === '') {
            errors.push('API Key 未配置');
        }

        if (!['OpenAI', 'Gemini'].includes(config.modelType)) {
            errors.push(`不支持的模型类型: ${config.modelType}`);
        }

        if (config.modelType === 'OpenAI') {
            if (config.apiEndpoint && !isValidHttpUrl(config.apiEndpoint)) {
                errors.push('API 端点 URL 格式无效');
            }

            if (config.temperature !== undefined) {
                if (config.temperature < 0 || config.temperature > 1) {
                    errors.push('Temperature 必须在 0-1 之间');
                }
            }

            if (config.maxTokens !== undefined && config.maxTokens < 1) {
                errors.push('Max Tokens 必须大于 0');
            }
        }

        const validNamingRules: NamingRuleType[] = [
            'default', 'Camel Case', 'Kernighan and Ritchie', 
            'Snake Case', 'Hungarian Notation'
        ];
        if (!validNamingRules.includes(config.namingRules)) {
            errors.push(`不支持的命名规则: ${config.namingRules}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    getDefaultModelName(modelType: ModelType): string {
        switch (modelType) {
            case 'OpenAI':
                return 'gpt-3.5-turbo';
            case 'Gemini':
                return 'gemini-2.0-flash';
            default:
                return 'gpt-3.5-turbo';
        }
    }

    getDefaultApiEndpoint(modelType: ModelType): string {
        switch (modelType) {
            case 'OpenAI':
                return 'https://api.openai.com/v1';
            case 'Gemini':
                return '';
            default:
                return 'https://api.openai.com/v1';
        }
    }

    private loadConfig(): AiTranslateConfig {
        const configuration = workspace.getConfiguration(CONFIG_PREFIX);
        const modelType = configuration.get<ModelType>('modelType', 'OpenAI');
        
        return {
            modelType,
            apiKey: configuration.get<string>('largeModelKey', ''),
            apiEndpoint: configuration.get<string>('largeModelApi', this.getDefaultApiEndpoint(modelType)),
            modelName: configuration.get<string>('largeModelName', this.getDefaultModelName(modelType)),
            temperature: configuration.get<number>('largeModelTemperature', 0.5),
            maxTokens: configuration.get<number>('largeModelMaxTokens', 4096),
            streaming: configuration.get<boolean>('streaming', false),
            namingRules: configuration.get<NamingRuleType>('namingRules', 'default'),
            filterThinkingContent: configuration.get<boolean>('filterThinkingContent', false),
            problemTranslateLang: configuration.get<string>('problemTranslateLang', 'none'),
            customTranslatePrompt: configuration.get<string>('customTranslatePrompt', ''),
            customNamingPrompt: configuration.get<string>('customNamingPrompt', '')
        };
    }

    private handleConfigChange(event: ConfigurationChangeEvent): void {
        if (event.affectsConfiguration(CONFIG_PREFIX)) {
            this.config = this.loadConfig();
            this.notifyListeners();
        }
    }

    private notifyListeners(): void {
        for (const listener of this.changeListeners) {
            try {
                listener();
            } catch (error) {
                console.error('配置变更监听器执行失败:', error);
            }
        }
    }

    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.changeListeners.clear();
    }
}
```

**Step 2: 验证编译**

```bash
npx tsc --noEmit src/core/ConfigManager.ts
```

**Step 3: 提交**

```bash
git add src/core/ConfigManager.ts
git commit -m "feat(core): add ConfigManager with validation"
```

---

### Task 6: 实现提示词构建器

**Files:**
- Create: `src/core/PromptBuilder.ts`

**Step 1: 编写提示词构建器**

```typescript
// src/core/PromptBuilder.ts
import { PromptType, NamingRuleType } from '../types';

export class PromptBuilder {
    private static readonly DEFAULT_TEMPLATES: Record<PromptType, string> = {
        [PromptType.TRANSLATE]: 'Translate the following text to ${targetLang}. Only return the translated content, without any explanations or extra text.\n\nInput: "${content}"',
        
        [PromptType.NAMING]: 'Based on the programming language "${languageId}" and the code context "${paragraph}", determine if "${variableName}" is a class, method, function, or variable. Then, translate "${variableName}" into English following ${namingRule}. Return only the translated variable name, with no other text or explanation.',
        
        [PromptType.LANGUAGE_DETECTION]: 'Your task is to identify the language of the given text. You must respond with ONLY the BCP 47 language code and nothing else. For example, for "你好", respond "zh-CN". For "Hello", respond "en". Do not add any explanation or surrounding text. The text to analyze is: """${text}"""'
    };

    private static readonly NAMING_RULE_DESCRIPTIONS: Record<NamingRuleType | 'custom', string> = {
        'default': 'the standard naming conventions for "${languageId}"',
        'Camel Case': 'the Camel Case naming convention (e.g., myVariableName)',
        'Kernighan and Ritchie': 'the K&R style naming convention (e.g., my_variable)',
        'Snake Case': 'the Snake Case naming convention (e.g., my_variable_name)',
        'Hungarian Notation': 'the Hungarian Notation naming convention (e.g., strMyVariable)',
        'custom': 'the naming convention "${namingRules}"'
    };

    buildTranslatePrompt(content: string, targetLang: string, customPrompt?: string): string {
        if (customPrompt && customPrompt.trim()) {
            if (!this.validateCustomPrompt(PromptType.TRANSLATE, customPrompt)) {
                throw new Error('翻译提示词格式错误：必须包含 ${targetLang} 和 ${content} 参数');
            }
            return this.fillTemplate(customPrompt, { targetLang, content });
        }

        return this.fillTemplate(
            PromptBuilder.DEFAULT_TEMPLATES[PromptType.TRANSLATE],
            { targetLang, content }
        );
    }

    buildNamingPrompt(variableName: string, paragraph: string, languageId: string, namingRules: NamingRuleType = 'default', customPrompt?: string): string {
        if (customPrompt && customPrompt.trim()) {
            if (!this.validateCustomPrompt(PromptType.NAMING, customPrompt)) {
                throw new Error('命名提示词格式错误：必须包含 ${variableName}、${paragraph}、${languageId} 参数');
            }
            return this.fillTemplate(customPrompt, { variableName, paragraph, languageId, namingRules });
        }

        const namingRuleKey = namingRules === 'default' ? 'default' : 
                             (PromptBuilder.NAMING_RULE_DESCRIPTIONS[namingRules] ? namingRules : 'custom');
        
        const namingRule = this.fillTemplate(
            PromptBuilder.NAMING_RULE_DESCRIPTIONS[namingRuleKey],
            { languageId, namingRules }
        );

        return this.fillTemplate(
            PromptBuilder.DEFAULT_TEMPLATES[PromptType.NAMING],
            { languageId, paragraph, variableName, namingRule }
        );
    }

    buildLanguageDetectionPrompt(text: string): string {
        return this.fillTemplate(
            PromptBuilder.DEFAULT_TEMPLATES[PromptType.LANGUAGE_DETECTION],
            { text }
        );
    }

    validateCustomPrompt(type: PromptType, prompt: string): boolean {
        switch (type) {
            case PromptType.TRANSLATE:
                return prompt.includes('${targetLang}') && prompt.includes('${content}');
            case PromptType.NAMING:
                return prompt.includes('${variableName}') && 
                       prompt.includes('${paragraph}') && 
                       prompt.includes('${languageId}');
            default:
                return true;
        }
    }

    private fillTemplate(template: string, variables: Record<string, string>): string {
        return template.replace(/\$\{(\w+)\}/g, (match, key) => {
            return variables[key] !== undefined ? variables[key] : match;
        });
    }

    static getDefaultTemplate(type: PromptType): string {
        return PromptBuilder.DEFAULT_TEMPLATES[type];
    }
}
```

**Step 2: 验证编译**

```bash
npx tsc --noEmit src/core/PromptBuilder.ts
```

**Step 3: 提交**

```bash
git add src/core/PromptBuilder.ts
git commit -m "feat(core): add PromptBuilder with template validation"
```

---

由于实施计划内容较长，我已经完成了Phase 1和Phase 2的详细任务定义。现在让我完成剩余的Phase 3-6。您希望我现在：

**选项1:** 继续编写完整的Phase 3-6任务
**选项2:** 开始执行Phase 1-2的任务

请选择您的偏好。如果选择选项1，我会完成整个实施计划；如果选择选项2，我会开始实施代码。计划文档已保存到 `docs/plans/2026-03-07-refactor-implementation.md`。