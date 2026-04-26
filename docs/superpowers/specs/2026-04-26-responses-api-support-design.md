# 设计文档：支持 OpenAI Responses API 格式

> **Issue**: [#3 - 出现API 响应格式不符合标准问题](https://github.com/OrangeNekoo/comment-translate-ai/issues/3)
> **日期**: 2026-04-26
> **状态**: 待审阅

## 1. 问题描述

用户配置 API 端点为 `/v1/responses`（OpenAI 新版 Responses API）并使用 `gpt-5.4-mini` 模型时，翻译失败并报错 "API 响应格式不符合标准"。

**根因**：当前 `OpenAIClient` 仅支持 Chat Completions API（`/v1/chat/completions`）格式，无法处理 Responses API（`/v1/responses`）的请求和响应格式。

### 两种 API 格式对比

| 维度 | Chat Completions | Responses API |
|------|-----------------|---------------|
| 端点 | `POST /v1/chat/completions` | `POST /v1/responses` |
| 请求-输入 | `{ model, messages: [{role, content}] }` | `{ model, input: "text" }` 或 `{ model, input: [{role, content}] }` |
| 请求-参数 | `temperature`, `max_tokens` | `temperature`, `max_output_tokens` |
| 响应-文本 | `choices[0].message.content` | `output` 数组中 `type: "message"` 项的 `content[0].text` |
| 响应-Token | `usage.prompt_tokens / completion_tokens` | `usage.input_tokens / output_tokens` |
| 流式格式 | SSE `data: { choices: [{ delta: { content } }] }` | SSE 格式不同（本次不实现） |

## 2. 设计方案

### 2.1 新增配置项

在 VS Code 设置中新增 `aiTranslate.apiFormat`：

```json
{
  "aiTranslate.apiFormat": {
    "type": "string",
    "enum": ["chat-completions", "responses"],
    "enumDescriptions": ["%config.apiFormat.chatCompletions%", "%config.apiFormat.responses%"],
    "default": "chat-completions",
    "markdownDescription": "%config.apiFormat.desc%"
  }
}
```

- `chat-completions`（默认）：使用 `/v1/chat/completions` 端点，保持向后兼容
- `responses`：使用 `/v1/responses` 端点

### 2.2 类型变更

#### `src/types/index.ts`

`ClientConfig` 新增 `apiFormat` 字段：

```typescript
export type ApiFormat = 'chat-completions' | 'responses';

export interface ClientConfig {
    apiKey: string;
    modelName: string;
    apiEndpoint?: string;
    apiFormat?: ApiFormat;  // 新增，默认 'chat-completions'
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
    filterThinkingContent?: boolean;
}
```

`AiTranslateConfig` 也需新增对应字段。

### 2.3 URL 处理

`normalizeApiUrl` 已支持自定义 `path` 参数。调用方根据 `apiFormat` 传入不同路径：

```typescript
// chat-completions 模式
normalizeApiUrl(endpoint, '/chat/completions')

// responses 模式
normalizeApiUrl(endpoint, '/responses')
```

无需修改 `normalizeApiUrl` 函数本身。

### 2.4 OpenAIClient 改造

#### 请求构造

```typescript
// chat-completions 格式
{
    model: this.config.modelName,
    messages: [{ role: 'user', content: prompt }],
    temperature: this.config.temperature ?? 0.5,
    max_tokens: this.config.maxTokens,
    stream: false
}

// responses 格式
{
    model: this.config.modelName,
    input: prompt,
    temperature: this.config.temperature ?? 0.5,
    max_output_tokens: this.config.maxTokens
}
```

#### 响应解析

新增 `OpenAIResponseFormat` 接口用于 Responses API 响应：

```typescript
interface OpenAIResponsesOutput {
    id: string;
    type: string;
    role: string;
    content: Array<{
        type: string;
        text: string;
    }>;
}

interface OpenAIResponsesApiResponse {
    output: OpenAIResponsesOutput[];
    usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
    };
}
```

文本提取逻辑：

```typescript
// chat-completions: response.choices[0].message.content
// responses: 从 response.output 中找到 type === 'message' 的项，取 content[0].text
```

#### 流式传输

- `chat-completions`：保持现有实现不变
- `responses`：当 `apiFormat === 'responses'` 且启用流式时，降级为非流式请求并记录警告（Responses API 流式格式差异较大，后续版本可扩展支持）

### 2.5 配置管理

`ConfigManager.loadConfig()` 新增读取 `apiFormat`：

```typescript
apiFormat: configuration.get<ApiFormat>('apiFormat', 'chat-completions')
```

`TranslationService` 和 `NamingService` 构造 `ClientConfig` 时传递 `apiFormat`。

### 2.6 国际化

`package.nls.json` 新增：
```json
{
    "config.apiFormat.desc": "API format. Use 'chat-completions' for /v1/chat/completions endpoint, or 'responses' for /v1/responses endpoint.",
    "config.apiFormat.chatCompletions": "Chat Completions API: Standard /v1/chat/completions endpoint",
    "config.apiFormat.responses": "Responses API: New /v1/responses endpoint (GPT-5, o-series, etc.)"
}
```

`package.nls.zh-cn.json` 新增：
```json
{
    "config.apiFormat.desc": "API 格式。使用 'chat-completions' 对应 /v1/chat/completions 端点，或 'responses' 对应 /v1/responses 端点。",
    "config.apiFormat.chatCompletions": "Chat Completions API：标准 /v1/chat/completions 端点",
    "config.apiFormat.responses": "Responses API：新版 /v1/responses 端点（GPT-5、o 系列等）"
}
```

## 3. 涉及文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/types/index.ts` | 修改 | 新增 `ApiFormat` 类型，`ClientConfig` 和 `AiTranslateConfig` 新增字段 |
| `src/api/OpenAIClient.ts` | 修改 | 双格式请求构造和响应解析 |
| `src/core/ConfigManager.ts` | 修改 | 读取 `apiFormat` 配置 |
| `src/services/TranslationService.ts` | 修改 | 传递 `apiFormat` 到 ClientConfig |
| `src/services/NamingService.ts` | 修改 | 传递 `apiFormat` 到 ClientConfig |
| `package.json` | 修改 | 新增 `aiTranslate.apiFormat` 配置定义 |
| `package.nls.json` | 修改 | 新增英文描述 |
| `package.nls.zh-cn.json` | 修改 | 新增中文描述 |

## 4. 不做的事

- **不实现 Responses API 流式传输**：格式差异大，优先保证非流式正常工作
- **不自动检测 API 格式**：用户显式配置更可靠，避免误判
- **不修改 BaseClient**：改动限制在 OpenAIClient 内部
- **不处理 Responses API 的有状态特性**（`store`、`previous_response_id`）：本插件是无状态的单次翻译场景

## 5. 测试要点

1. `chat-completions` 模式（默认）行为不变
2. `responses` 模式下非流式翻译正常工作
3. `responses` 模式下启用流式时降级为非流式并记录日志
4. URL 构造正确：`chat-completions` → `/chat/completions`，`responses` → `/responses`
5. 配置切换后热更新生效
