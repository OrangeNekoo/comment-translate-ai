# Comment Translate AI 重构设计文档

**日期**: 2026-03-07  
**方案**: 分层架构重构（方案A）  
**目标**: 在完美实现所有已有功能的基础上，重构代码并优化性能和健壮性

---

## 1. 现状分析

### 1.1 现有代码结构问题

| 问题类别 | 具体表现 |
|---------|---------|
| 架构问题 | `extension.ts` 职责过重；API 客户端实现不一致；缺少清晰的抽象层 |
| 性能问题 | 翻译缓存无大小限制；问题面板翻译无防抖；缺少请求去重机制 |
| 健壮性问题 | 无重试策略；配置验证不充分；流式处理只在 OpenAI 实现 |
| 代码质量 | 类型定义不严格（多处使用 `as any`）；提示词模板分散；重复代码多 |

### 1.2 需要保留的功能

1. **核心翻译功能** - 实现 `ITranslate` 接口
2. **AI 命名功能** - 智能变量/函数/类命名
3. **问题面板翻译** - 将诊断信息翻译为指定语言
4. **配置项** - 所有现有配置保持兼容
5. **多模型支持** - OpenAI 和 Gemini
6. **自定义提示词** - 支持用户自定义翻译和命名提示词

---

## 2. 架构设计

### 2.1 分层架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     extension.ts                           │
│  - 激活入口                                                │
│  - 注册命令和翻译源                                        │
│  - 初始化核心服务                                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                     AiTranslate                            │
│  implements ITranslate                                     │
│  - translate(): 主翻译方法                                  │
│  - link(): 返回链接                                        │
│  - detectLanguage(): 语言检测                              │
│  - aiNaming(): AI命名入口                                  │
└──────────┬────────────────────────────┬─────────────────────┘
           │                            │
┌──────────▼──────────────┐   ┌─────────▼────────────────────┐
│   TranslationService    │   │      NamingService           │
│   - 协调翻译流程        │   │   - 构建命名提示词           │
│   - 管理缓存            │   │   - 调用翻译服务             │
│   - 结果后处理          │   │   - 结果验证                 │
└──────────┬──────────────┘   └──────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                  BaseClient (抽象类)                       │
│  - request(): 带重试的请求方法                             │
│  - validateConfig(): 配置验证                              │
│  - parseResponse(): 响应解析（抽象）                       │
└──────────┬────────────────────────────┬─────────────────────┘
           │                            │
┌──────────▼──────────────┐   ┌─────────▼────────────────────┐
│     OpenAIClient        │   │       GeminiClient           │
│  - 流式/非流式支持      │   │  - Gemini SDK集成            │
│  - URL规范化            │   │  - 流式支持（后续扩展）      │
└─────────────────────────┘   └──────────────────────────────┘
```

### 2.2 辅助服务

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   ConfigManager     │  │    CacheService     │  │ ProblemTranslation  │
│  - 配置读取/验证    │  │  - LRU缓存实现      │  │  - 防抖处理         │
│  - 变更监听         │  │  - 过期清理         │  │  - 诊断信息监听     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
```

---

## 3. 核心模块设计

### 3.1 类型定义 (types/index.ts)

```typescript
// 模型类型
export type ModelType = 'OpenAI' | 'Gemini';

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
    namingRules: 'default' | 'camelCase' | 'kr' | 'snakeCase' | 'hungarian';
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

// 错误代码
export enum ErrorCode {
    CONFIG_MISSING_API_KEY = 'CONFIG_MISSING_API_KEY',
    CONFIG_INVALID_ENDPOINT = 'CONFIG_INVALID_ENDPOINT',
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    NETWORK_OFFLINE = 'NETWORK_OFFLINE',
    API_RATE_LIMIT = 'API_RATE_LIMIT',
    API_INVALID_RESPONSE = 'API_INVALID_RESPONSE',
    API_AUTHENTICATION = 'API_AUTHENTICATION',
}
```

### 3.2 错误处理 (errors/TranslationError.ts)

```typescript
export class TranslationError extends Error {
    constructor(
        message: string,
        public readonly code: ErrorCode,
        public readonly retryable: boolean = false,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'TranslationError';
    }
}
```

### 3.3 缓存服务 (services/CacheService.ts)

```typescript
export class CacheService {
    private cache: Map<string, CacheEntry>;
    private maxSize: number = 1000;  // 最大缓存条目
    private ttl: number = 30 * 60 * 1000;  // 30分钟过期
    
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    clear(): void;
    private evictLRU(): void;  // 淘汰最少使用
    private isExpired(entry: CacheEntry): boolean;
}
```

### 3.4 API客户端抽象 (api/BaseClient.ts)

```typescript
export interface ClientConfig {
    apiKey: string;
    modelName: string;
}

export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
}

export abstract class BaseClient {
    protected config: ClientConfig;
    protected retryConfig: RetryConfig;
    
    // 模板方法
    async translate(prompt: string): Promise<string> {
        this.validateConfig();
        const response = await this.executeWithRetry(() => this.doRequest(prompt));
        return this.postProcess(this.parseResponse(response));
    }
    
    protected abstract doRequest(prompt: string): Promise<unknown>;
    protected abstract parseResponse(response: unknown): string;
    protected abstract validateConfig(): void;
    
    // 通用功能
    protected filterThinkingContent(text: string): string;
    private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T>;
    private calculateBackoff(attempt: number): number;  // 指数退避
}
```

### 3.5 提示词构建器 (core/PromptBuilder.ts)

```typescript
export enum PromptType {
    TRANSLATE = 'translate',
    NAMING = 'naming',
    LANGUAGE_DETECTION = 'language_detection'
}

export class PromptBuilder {
    // 默认提示词模板
    private static readonly DEFAULT_TEMPLATES: Record<PromptType, string> = {
        [PromptType.TRANSLATE]: 'Translate the following text to ${targetLang}. Only return the translated content, without any explanations or extra text.\n\nInput: "${content}"',
        [PromptType.NAMING]: 'Based on the programming language "${languageId}" and the code context "${paragraph}", determine if "${variableName}" is a class, method, function, or variable. Then, translate "${variableName}" into English following the standard naming conventions for "${languageId}". Return only the translated variable name, with no other text or explanation.',
        [PromptType.LANGUAGE_DETECTION]: 'Your task is to identify the language of the given text. You must respond with ONLY the BCP 47 language code and nothing else. For example, for "你好", respond "zh-CN". For "Hello", respond "en". Do not add any explanation or surrounding text. The text to analyze is: """${text}"""'
    };
    
    buildTranslatePrompt(
        content: string, 
        targetLang: string, 
        customPrompt?: string
    ): string;
    
    buildNamingPrompt(
        variableName: string, 
        context: string, 
        languageId: string, 
        namingRules?: string,
        customPrompt?: string
    ): string;
    
    buildLanguageDetectionPrompt(text: string): string;
    
    // 验证自定义提示词格式
    validateCustomPrompt(type: PromptType, prompt: string): boolean;
}
```

### 3.6 配置管理器 (core/ConfigManager.ts)

```typescript
export class ConfigManager {
    private static readonly PREFIX = 'aiTranslate';
    private config: AiTranslateConfig;
    private changeListeners: Set<() => void>;
    
    constructor();
    
    // 获取配置
    getConfig(): Readonly<AiTranslateConfig>;
    
    // 验证配置有效性
    validateConfig(): ValidationResult;
    
    // 监听配置变化
    onConfigChange(listener: () => void): Disposable;
    
    // 刷新配置
    refresh(): void;
    
    private loadConfig(): AiTranslateConfig;
    private handleConfigChange(event: ConfigurationChangeEvent): void;
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
}
```

### 3.7 主翻译类 (core/AiTranslate.ts)

```typescript
export class AiTranslate implements ITranslate {
    readonly id = 'ai-powered-comment-translate-extension';
    readonly name = 'AI translate';
    
    private configManager: ConfigManager;
    private cacheService: CacheService;
    private translationService: TranslationService;
    private namingService: NamingService;
    
    constructor();
    
    // ITranslate 接口实现
    get maxLen(): number { return 3000; }
    
    link(content: string, options: ITranslateOptions): string {
        return content;
    }
    
    async translate(
        content: string, 
        options: ITranslateOptions
    ): Promise<string>;
    
    // 扩展功能
    async aiNaming(
        variableName: string, 
        languageId: string
    ): Promise<string>;
    
    async detectLanguage(text: string): Promise<string>;
    
    // 获取当前配置
    getConfig(): Readonly<AiTranslateConfig>;
}
```

### 3.8 扩展入口 (extension.ts)

```typescript
export function activate(context: ExtensionContext): ExtensionExports {
    // 初始化核心服务
    const aiTranslate = new AiTranslate();
    const problemTranslationService = new ProblemTranslationService(aiTranslate);
    
    // 注册AI命名命令
    const namingCommand = commands.registerCommand(
        'aiTranslate.aiNaming', 
        () => handleAiNaming(aiTranslate)
    );
    
    // 启动问题面板翻译监听
    problemTranslationService.start();
    
    // 注册资源释放
    context.subscriptions.push(
        namingCommand,
        problemTranslationService
    );
    
    // 返回翻译源注册接口
    return {
        extendTranslate(registry: TranslateRegistry) {
            registry('ai-powered-comment-translate-extension', AiTranslate);
        }
    };
}

export function deactivate() {
    // 清理资源
}
```

---

## 4. 性能优化策略

### 4.1 缓存策略

| 特性 | 实现方式 |
|-----|---------|
| LRU淘汰 | 基于访问计数和时间的淘汰策略 |
| 大小限制 | 最大1000条缓存 |
| 过期时间 | 30分钟自动过期 |
| 缓存Key | `content_hash + target_lang + model_type` |

### 4.2 请求优化

| 特性 | 实现方式 |
|-----|---------|
| 请求去重 | 相同内容的并发请求合并为单个请求 |
| 防抖 | 问题面板翻译防抖500ms |
| 流式传输 | OpenAI支持流式，Gemini后续扩展 |
| 连接复用 | axios keep-alive配置 |

### 4.3 重试策略

```
网络超时:    1s -> 2s -> 4s (指数退避)
API限流:     2s -> 4s -> 8s (带jitter)
认证错误:    不重试
配置错误:    不重试
```

---

## 5. 健壮性设计

### 5.1 错误分类与处理

| 错误类型 | 错误码 | 是否可重试 | 用户提示 |
|---------|-------|-----------|---------|
| API Key缺失 | CONFIG_MISSING_API_KEY | 否 | "请配置API Key" |
| 网络超时 | NETWORK_TIMEOUT | 是 | "网络超时，正在重试..." |
| API限流 | API_RATE_LIMIT | 是 | "请求过于频繁，稍后再试" |
| 认证失败 | API_AUTHENTICATION | 否 | "API Key无效，请检查配置" |
| 响应解析失败 | API_INVALID_RESPONSE | 否 | "API返回格式异常" |

### 5.2 熔断机制

- 连续失败5次触发熔断
- 熔断持续60秒后进入半开状态
- 半开状态下成功一次则关闭熔断
- 熔断期间直接返回错误，不发起请求

---

## 6. 目录结构

```
src/
├── core/
│   ├── AiTranslate.ts              # 主翻译类
│   ├── ConfigManager.ts            # 配置管理
│   └── PromptBuilder.ts            # 提示词构建器
├── api/
│   ├── BaseClient.ts               # API客户端抽象基类
│   ├── OpenAIClient.ts             # OpenAI实现
│   └── GeminiClient.ts             # Gemini实现
├── services/
│   ├── TranslationService.ts       # 翻译服务
│   ├── NamingService.ts            # AI命名服务
│   ├── ProblemTranslationService.ts # 问题面板翻译服务
│   └── CacheService.ts             # LRU缓存服务
├── types/
│   └── index.ts                    # 类型定义
├── errors/
│   └── TranslationError.ts         # 错误类定义
├── utils/
│   ├── retry.ts                    # 重试工具
│   ├── debounce.ts                 # 防抖工具
│   └── url.ts                      # URL处理工具
├── extension.ts                    # 扩展入口
└── test/
    ├── unit/                       # 单元测试
    └── integration/                # 集成测试
```

---

## 7. 与 vscode-comment-translate 的交互

### 7.1 ITranslate 接口实现

```typescript
interface ITranslate {
    id: string;
    name: string;
    maxLen: number;
    translate(content: string, options: ITranslateOptions): Promise<string>;
    link(content: string, options: ITranslateOptions): string;
    isSupported?(src: string): boolean;
}
```

### 7.2 翻译源注册

```typescript
// extension.ts
return {
    extendTranslate(registry: (key: string, ctor: new () => ITranslate) => void) {
        registry('ai-powered-comment-translate-extension', AiTranslate);
    }
};
```

### 7.3 依赖声明

```json
{
    "extensionDependencies": [
        "intellsmi.comment-translate"
    ]
}
```

---

## 8. 向后兼容性

### 8.1 配置兼容

所有现有配置项保持不变：

| 配置项 | 类型 | 默认值 | 说明 |
|-------|------|-------|------|
| aiTranslate.modelType | string | "OpenAI" | 模型类型 |
| aiTranslate.largeModelApi | string | "https://api.openai.com/v1" | API端点 |
| aiTranslate.largeModelKey | string | "" | API密钥 |
| aiTranslate.largeModelName | string | "gpt-3.5-turbo" | 模型名称 |
| aiTranslate.largeModelMaxTokens | number | 4096 | 最大token数 |
| aiTranslate.largeModelTemperature | number | 0.5 | 温度参数 |
| aiTranslate.namingRules | string | "default" | 命名规则 |
| aiTranslate.customTranslatePrompt | string | "" | 自定义翻译提示词 |
| aiTranslate.customNamingPrompt | string | "" | 自定义命名提示词 |
| aiTranslate.streaming | boolean | false | 启用流式传输 |
| aiTranslate.filterThinkingContent | boolean | false | 过滤思考内容 |
| aiTranslate.problemTranslateLang | string | "none" | 问题面板翻译语言 |

### 8.2 功能行为一致

- 翻译功能：完全保持一致
- AI命名：完全保持一致
- 问题面板翻译：完全保持一致
- 自定义提示词：完全保持一致

---

## 9. 测试策略

### 9.1 单元测试覆盖

| 模块 | 测试内容 |
|-----|---------|
| CacheService | LRU淘汰、过期清理、并发访问 |
| PromptBuilder | 模板渲染、参数替换、验证逻辑 |
| ConfigManager | 配置读取、变更监听、验证逻辑 |
| BaseClient | 重试逻辑、错误分类 |

### 9.2 集成测试

| 场景 | 测试内容 |
|-----|---------|
| OpenAIClient | 请求构造、响应解析、错误处理 |
| GeminiClient | SDK调用、响应处理 |
| TranslationService | 端到端翻译流程 |
| ProblemTranslationService | 诊断监听、防抖处理 |

### 9.3 Mock策略

- 使用 nock 模拟 HTTP 请求
- 使用 jest.mock 模拟 Gemini SDK
- 使用 VS Code Test API 模拟编辑器环境

---

## 10. 实施计划概要

### Phase 1: 基础设施
1. 创建目录结构
2. 定义类型和错误类
3. 实现工具函数（retry, debounce）

### Phase 2: 核心服务
1. 实现 CacheService
2. 实现 ConfigManager
3. 实现 PromptBuilder

### Phase 3: API客户端
1. 实现 BaseClient
2. 实现 OpenAIClient
3. 实现 GeminiClient

### Phase 4: 业务服务
1. 实现 TranslationService
2. 实现 NamingService
3. 实现 ProblemTranslationService

### Phase 5: 主类和入口
1. 实现 AiTranslate 类
2. 重构 extension.ts
3. 整合所有模块

### Phase 6: 测试和优化
1. 编写单元测试
2. 性能测试和调优
3. 集成测试验证

---

**设计批准**: 待用户确认  
**下一步**: 创建详细实施计划
