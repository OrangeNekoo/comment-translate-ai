# Responses API 支持实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 OpenAIClient 添加 OpenAI Responses API (`/v1/responses`) 格式支持，通过新增 `apiFormat` 配置项让用户选择 API 格式，修复 issue #3。

**Architecture:** 在现有 `OpenAIClient` 中根据 `apiFormat` 配置分支处理请求构造和响应解析。新增 `ApiFormat` 类型到 `ClientConfig`，`ConfigManager` 读取新配置，`TranslationService`/`NamingService` 传递配置。不修改 `BaseClient` 接口。

**Tech Stack:** TypeScript, VS Code Extension API, Axios

**Spec:** `docs/superpowers/specs/2026-04-26-responses-api-support-design.md`

---

## 文件清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/types/index.ts` | 修改 | 新增 `ApiFormat` 类型，扩展 `ClientConfig` 和 `AiTranslateConfig` |
| `package.json` | 修改 | 新增 `aiTranslate.apiFormat` 配置定义 |
| `package.nls.json` | 修改 | 新增英文国际化描述 |
| `package.nls.zh-cn.json` | 修改 | 新增中文国际化描述 |
| `src/core/ConfigManager.ts` | 修改 | 读取 `apiFormat` 配置项 |
| `src/api/OpenAIClient.ts` | 修改 | 双格式请求构造和响应解析 |
| `src/services/TranslationService.ts` | 修改 | 传递 `apiFormat` 到 ClientConfig |
| `src/services/NamingService.ts` | 修改 | 传递 `apiFormat` 到 ClientConfig |

---

### Task 1: 新增 `ApiFormat` 类型并扩展配置接口

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 添加 `ApiFormat` 类型和更新接口**

在 `src/types/index.ts` 中，在 `NamingRuleType` 之后添加 `ApiFormat` 类型，并在 `ClientConfig` 和 `AiTranslateConfig` 中添加 `apiFormat` 字段：

```typescript
// src/types/index.ts
import { ITranslateOptions } from 'comment-translate-manager';

export { ITranslateOptions };

// 模型类型
export type ModelType = 'OpenAI';

// 命名规则类型
export type NamingRuleType = 'default' | 'Camel Case' | 'Kernighan and Ritchie' | 'Snake Case' | 'Hungarian Notation';

// API 格式类型
export type ApiFormat = 'chat-completions' | 'responses';

// 翻译配置
export interface TranslationConfig {
    modelType: ModelType;
    apiKey: string;
    apiEndpoint?: string;
    apiFormat?: ApiFormat;
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
    apiFormat?: ApiFormat;
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
```

- [ ] **Step 2: 编译验证**

Run: `npm run compile`
Expected: 编译成功，无错误

---

### Task 2: 更新 `package.json` 配置定义

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 在 `aiTranslate.streaming` 之后添加 `apiFormat` 配置**

在 `package.json` 的 `contributes.configuration.properties` 中，在 `"aiTranslate.streaming"` 块之后添加：

```json
        "aiTranslate.apiFormat": {
          "type": "string",
          "enum": [
            "chat-completions",
            "responses"
          ],
          "enumDescriptions": [
            "%config.apiFormat.chatCompletions%",
            "%config.apiFormat.responses%"
          ],
          "default": "chat-completions",
          "markdownDescription": "%config.apiFormat.desc%"
        },
```

完整位置：在 `"aiTranslate.streaming"` 的 `}` 之后、`"aiTranslate.filterThinkingContent"` 之前插入。

- [ ] **Step 2: 编译验证**

Run: `npm run compile`
Expected: 编译成功

---

### Task 3: 更新国际化文件

**Files:**
- Modify: `package.nls.json`
- Modify: `package.nls.zh-cn.json`

- [ ] **Step 1: 更新 `package.nls.json`**

在 `package.nls.json` 的 `"config.aiTranslate.streaming"` 之后添加：

```json
    "config.apiFormat.desc": "API format. Use 'chat-completions' for /v1/chat/completions endpoint, or 'responses' for /v1/responses endpoint.",
    "config.apiFormat.chatCompletions": "Chat Completions API: Standard /v1/chat/completions endpoint",
    "config.apiFormat.responses": "Responses API: New /v1/responses endpoint (GPT-5, o-series, etc.)",
```

- [ ] **Step 2: 更新 `package.nls.zh-cn.json`**

在 `package.nls.zh-cn.json` 的 `"config.aiTranslate.streaming"` 之后添加：

```json
    "config.apiFormat.desc": "API 格式。使用 'chat-completions' 对应 /v1/chat/completions 端点，或 'responses' 对应 /v1/responses 端点。",
    "config.apiFormat.chatCompletions": "Chat Completions API：标准 /v1/chat/completions 端点",
    "config.apiFormat.responses": "Responses API：新版 /v1/responses 端点（GPT-5、o 系列等）",
```

- [ ] **Step 3: 编译验证**

Run: `npm run compile`
Expected: 编译成功

---

### Task 4: 更新 `ConfigManager` 读取新配置

**Files:**
- Modify: `src/core/ConfigManager.ts`

- [ ] **Step 1: 在 import 中添加 `ApiFormat`**

将 import 行修改为：

```typescript
import { AiTranslateConfig, ValidationResult, ModelType, NamingRuleType, LogLevelType, ApiFormat } from '../types';
```

- [ ] **Step 2: 在 `loadConfig()` 中添加 `apiFormat` 读取**

在 `loadConfig()` 方法的 return 对象中，在 `streaming` 之后添加：

```typescript
            apiFormat: configuration.get<ApiFormat>('apiFormat', 'chat-completions'),
```

完整的 return 对象（仅显示修改部分上下文）：

```typescript
        return {
            modelType,
            apiKey: configuration.get<string>('largeModelKey', ''),
            apiEndpoint: configuration.get<string>('largeModelApi', this.getDefaultApiEndpoint(modelType)),
            modelName: configuration.get<string>('largeModelName', this.getDefaultModelName(modelType)),
            temperature: configuration.get<number>('largeModelTemperature', 0.5),
            maxTokens: configuration.get<number>('largeModelMaxTokens', 4096),
            streaming: configuration.get<boolean>('streaming', false),
            apiFormat: configuration.get<ApiFormat>('apiFormat', 'chat-completions'),
            namingRules: configuration.get<NamingRuleType>('namingRules', 'default'),
            filterThinkingContent: configuration.get<boolean>('filterThinkingContent', false),
            problemTranslateLang: configuration.get<string>('problemTranslateLang', 'none'),
            customTranslatePrompt: configuration.get<string>('customTranslatePrompt', ''),
            customNamingPrompt: configuration.get<string>('customNamingPrompt', ''),
            logLevel: configuration.get<LogLevelType>('logLevel', 'info')
        };
```

- [ ] **Step 3: 编译验证**

Run: `npm run compile`
Expected: 编译成功

---

### Task 5: 改造 `OpenAIClient` 支持双格式

**Files:**
- Modify: `src/api/OpenAIClient.ts`

- [ ] **Step 1: 更新 import 和接口定义**

将 `OpenAIClient.ts` 的 import 和接口部分替换为：

```typescript
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
```

- [ ] **Step 2: 更新构造函数**

替换构造函数，根据 `apiFormat` 选择不同的 URL path：

```typescript
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
```

- [ ] **Step 3: 替换 `doTranslate` 方法**

将整个 `doTranslate` 方法替换为支持双格式的版本：

```typescript
    protected async doTranslate(prompt: string): Promise<TranslationResult> {
        if (this.apiFormat === 'responses') {
            return this.doTranslateResponses(prompt);
        }
        return this.doTranslateChatCompletions(prompt);
    }

    private async doTranslateChatCompletions(prompt: string): Promise<TranslationResult> {
        const url = this.apiUrl;
        const data = {
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

            // 从 output 数组中提取文本
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
```

- [ ] **Step 4: 更新 `translateStream` 方法**

在 `translateStream` 方法开头添加 Responses API 的降级处理：

```typescript
    async *translateStream(prompt: string): AsyncGenerator<string, void, unknown> {
        if (!this.supportsStreaming()) {
            throw new TranslationError(ErrorCode.UNKNOWN_ERROR, undefined, '流式传输未启用');
        }

        if (this.apiFormat === 'responses') {
            this.logger.warn('Responses API 暂不支持流式传输，将使用非流式请求');
            const result = await this.doTranslateResponses(prompt);
            yield result.text;
            return;
        }

        this.validateConfig();
        // ... 以下保持原有 Chat Completions 流式逻辑不变
```

- [ ] **Step 5: 编译验证**

Run: `npm run compile`
Expected: 编译成功

---

### Task 6: 更新 `TranslationService` 传递 `apiFormat`

**Files:**
- Modify: `src/services/TranslationService.ts`

- [ ] **Step 1: 在 `updateClient()` 中添加 `apiFormat`**

在 `src/services/TranslationService.ts` 的 `updateClient()` 方法中，在 `clientConfig` 对象里添加 `apiFormat`：

```typescript
    private updateClient(): void {
        const clientConfig = {
            apiKey: this.config.apiKey,
            modelName: this.config.modelName,
            apiEndpoint: this.config.apiEndpoint,
            apiFormat: this.config.apiFormat,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            streaming: this.config.streaming,
            filterThinkingContent: this.config.filterThinkingContent
        };

        // 仅支持 OpenAI
        this.client = new OpenAIClient(clientConfig, undefined, this.logger);
    }
```

- [ ] **Step 2: 在 `detectLanguage()` 的 `detectionClient` 中添加 `apiFormat`**

在 `detectLanguage()` 方法中创建 `detectionClient` 的地方，添加 `apiFormat`：

```typescript
            const detectionClient = new OpenAIClient({
                apiKey: this.config.apiKey,
                modelName: this.config.modelName,
                apiEndpoint: this.config.apiEndpoint,
                apiFormat: this.config.apiFormat,
                temperature: 0,
                maxTokens: this.config.maxTokens,
                streaming: false,
                filterThinkingContent: this.config.filterThinkingContent
            }, undefined, this.logger);
```

- [ ] **Step 3: 编译验证**

Run: `npm run compile`
Expected: 编译成功

---

### Task 7: 更新 `NamingService` 传递 `apiFormat`

**Files:**
- Modify: `src/services/NamingService.ts`

- [ ] **Step 1: 在 `updateClient()` 中添加 `apiFormat`**

在 `src/services/NamingService.ts` 的 `updateClient()` 方法中，在 `clientConfig` 对象里添加 `apiFormat`：

```typescript
    private updateClient(): void {
        const clientConfig = {
            apiKey: this.config.apiKey,
            modelName: this.config.modelName,
            apiEndpoint: this.config.apiEndpoint,
            apiFormat: this.config.apiFormat,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            streaming: false, // 命名不需要流式传输
            filterThinkingContent: this.config.filterThinkingContent
        };

        // 仅支持OpenAI
        this.client = new OpenAIClient(clientConfig);
    }
```

- [ ] **Step 2: 编译验证**

Run: `npm run compile`
Expected: 编译成功

---

### Task 8: 最终构建和代码检查

**Files:**
- 全部已修改文件

- [ ] **Step 1: 运行 ESLint**

Run: `npm run lint`
Expected: 无错误

- [ ] **Step 2: 完整编译**

Run: `npm run compile`
Expected: 编译成功，无 TypeScript 错误

- [ ] **Step 3: 提交所有更改**

```bash
git add src/types/index.ts src/api/OpenAIClient.ts src/core/ConfigManager.ts src/services/TranslationService.ts src/services/NamingService.ts package.json package.nls.json package.nls.zh-cn.json
git commit -m "feat: add OpenAI Responses API support via apiFormat config (fix #3)"
```
