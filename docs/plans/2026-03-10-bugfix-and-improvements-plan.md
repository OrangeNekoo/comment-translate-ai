# Bug 修复与改进实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复 Problem Translate Lang 功能中翻译诊断不随原始诊断消失的 Bug，添加日志输出功能方便调试，并检查代码兼容性。

**Architecture:** 采用分层架构，在现有服务层添加 URI 追踪机制修复 Bug，新增 LoggingService 服务类统一日志管理，在各模块中集成日志记录。

**Tech Stack:** TypeScript, VSCode Extension API, OpenAI API

---

## 前置准备

### 任务 0：确认当前分支

**说明：** 本计划在 `refactor/layered-architecture` 分支上直接开发，不创建新分支。

**Step 1: 检查当前分支状态**

```bash
git status
```

期望：当前分支为 `refactor/layered-architecture`

**Step 2: 确保分支是最新的**

```bash
git pull origin refactor/layered-architecture
```

---

## 第一部分：修复 Problem Translate Lang Bug

### 任务 1：修复 ProblemTranslationService URI 追踪

**Files:**
- Modify: `src/services/ProblemTranslationService.ts`

**Step 1: 添加 URI 追踪集合**

在 `ProblemTranslationService` 类中添加：

```typescript
private translatedUris: Set<string> = new Set();
```

**Step 2: 修改 performTranslation 方法**

修改 `performTranslation` 方法，添加 URI 追踪和清理逻辑：

```typescript
private async performTranslation(): Promise<void> {
    const lang = this.config.problemTranslateLang;

    // 如果翻译被禁用，清空集合
    if (!lang || lang === 'none') {
        this.diagnosticCollection.clear();
        this.translatedUris.clear();
        return;
    }

    const allDiagnostics = languages.getDiagnostics();
    const diagnosticsToUpdate = new Map<string, Diagnostic[]>();
    const currentUriSet = new Set<string>(); // 当前存在的 URI 集合

    for (const [uri, diagnostics] of allDiagnostics) {
        const uriStr = uri.toString();
        currentUriSet.add(uriStr);

        // 过滤掉来自我们自己集合的诊断信息，避免循环处理
        const originalDiagnostics = diagnostics.filter(d => d.source !== 'ai-translator');

        if (originalDiagnostics.length === 0) {
            continue;
        }

        const translatedDiagnostics: Diagnostic[] = [];
        for (const diag of originalDiagnostics) {
            const translatedDiag = await this.translateDiagnostic(diag, lang);
            translatedDiagnostics.push(translatedDiag);
        }

        diagnosticsToUpdate.set(uriStr, translatedDiagnostics);
    }

    // 更新诊断信息：先清空所有，然后重新设置
    this.diagnosticCollection.clear();

    for (const [uriStr, diags] of Array.from(diagnosticsToUpdate)) {
        const uri = Uri.parse(uriStr);
        this.diagnosticCollection.set(uri, diags);
    }

    // 清理不再有原始诊断的 URI 的翻译
    for (const uriStr of this.translatedUris) {
        if (!currentUriSet.has(uriStr)) {
            const uri = Uri.parse(uriStr);
            this.diagnosticCollection.delete(uri);
        }
    }

    // 更新已翻译 URI 集合
    this.translatedUris = currentUriSet;
}
```

**Step 3: 修改 clear 方法**

```typescript
clear(): void {
    this.diagnosticCollection.clear();
    this.messageCache.clear();
    this.translatedUris.clear();
}
```

**Step 4: 编译验证**

```bash
npm run compile
```

期望：编译成功，无错误

**Step 5: 提交**

```bash
git add src/services/ProblemTranslationService.ts
git commit -m "fix: 修复问题面板翻译诊断不随原始诊断消失的 Bug"
```

---

## 第二部分：实现日志输出功能

### 任务 2：创建 LoggingService 服务

**Files:**
- Create: `src/services/LoggingService.ts`

**Step 1: 创建日志级别枚举**

```typescript
// src/services/LoggingService.ts
export enum LogLevel {
    Error = 0,
    Warn = 1,
    Info = 2,
    Debug = 3
}
```

**Step 2: 创建 LoggingService 类**

```typescript
import { window, OutputChannel, Disposable } from 'vscode';
import { LogLevel } from './LoggingService';

export class LoggingService implements Disposable {
    private outputChannel: OutputChannel;
    private logLevel: LogLevel;

    constructor(logLevel: LogLevel = LogLevel.Info) {
        this.logLevel = logLevel;
        this.outputChannel = window.createOutputChannel('Comment Translate AI');
    }

    error(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.Error) {
            this.log('ERROR', message, args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.Warn) {
            this.log('WARN', message, args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.Info) {
            this.log('INFO', message, args);
        }
    }

    debug(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.Debug) {
            this.log('DEBUG', message, args);
        }
    }

    private log(level: string, message: string, args: unknown[]): void {
        const timestamp = new Date().toISOString();
        const argsStr = args.length > 0 ? args.map(a => JSON.stringify(a)).join(' ') : '';
        const fullMessage = `[${timestamp}] [${level}] ${message} ${argsStr}`.trim();
        this.outputChannel.appendLine(fullMessage);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
```

**Step 3: 编译验证**

```bash
npm run compile
```

期望：编译成功，无错误

**Step 4: 提交**

```bash
git add src/services/LoggingService.ts
git commit -m "feat: 创建 LoggingService 日志服务"
```

---

### 任务 3：在 ConfigManager 中添加日志级别配置

**Files:**
- Modify: `src/core/ConfigManager.ts`
- Modify: `src/types/index.ts`

**Step 1: 添加日志级别类型到 types**

```typescript
// src/types/index.ts
export type LogLevelType = 'error' | 'warn' | 'info' | 'debug';
```

**Step 2: 在 AiTranslateConfig 中添加日志级别字段**

```typescript
// src/types/index.ts
export interface AiTranslateConfig {
    // ... 现有字段
    logLevel?: LogLevelType;
}
```

**Step 3: 在 ConfigManager 中加载日志级别配置**

```typescript
// src/core/ConfigManager.ts
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
        customNamingPrompt: configuration.get<string>('customNamingPrompt', ''),
        logLevel: configuration.get<LogLevelType>('logLevel', 'info')
    };
}
```

**Step 4: 编译验证**

```bash
npm run compile
```

期望：编译成功，无错误

**Step 5: 提交**

```bash
git add src/types/index.ts src/core/ConfigManager.ts
git commit -m "feat: 添加日志级别配置支持"
```

---

### 任务 4：在 OpenAIClient 中集成日志

**Files:**
- Modify: `src/api/OpenAIClient.ts`
- Modify: `src/api/BaseClient.ts`

**Step 1: 读取 OpenAIClient 代码**

先查看当前实现：

```bash
cat src/api/OpenAIClient.ts
```

**Step 2: 修改 OpenAIClient 添加日志**

在构造函数中接收 LoggingService 实例，在 translate 方法中添加日志：

```typescript
// src/api/OpenAIClient.ts
import { LoggingService } from '../services/LoggingService';

export class OpenAIClient extends BaseClient {
    private logger: LoggingService;

    constructor(config: ClientConfig, logger?: LoggingService) {
        super(config);
        this.logger = logger ?? new LoggingService();
    }

    async translate(prompt: string): Promise<string> {
        this.logger.info('翻译请求：内容长度=%d', prompt.length);
        this.logger.debug('API 请求：POST %s', this.apiEndpoint);
        this.logger.debug('请求参数：model=%s, temperature=%d, maxTokens=%d', 
            this.modelName, this.temperature, this.maxTokens);

        const startTime = Date.now();

        try {
            const response = await axios.post(
                `${this.apiEndpoint}/chat/completions`,
                {
                    model: this.modelName,
                    messages: [
                        { role: 'system', content: 'You are a professional translator.' },
                        { role: 'user', content: prompt }
                    ],
                    max_tokens: this.maxTokens,
                    temperature: this.temperature,
                    stream: this.streaming
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    }
                }
            );

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            const result = response.data.choices[0].message.content;
            const usage = response.data.usage;

            this.logger.info('API 响应：tokens=%d, 耗时=%ss', 
                usage?.total_tokens || 0, duration);
            this.logger.debug('响应内容：%s', result.substring(0, 200));

            return result || '';
        } catch (error) {
            const axiosError = error as AxiosError;
            this.logger.error('请求失败：%s', axiosError.message);
            
            if (axiosError.response) {
                this.logger.error('响应状态：%d', axiosError.response.status);
                this.logger.error('响应数据：%s', JSON.stringify(axiosError.response.data));
            }

            throw this.handleApiError(axiosError);
        }
    }
}
```

**Step 3: 编译验证**

```bash
npm run compile
```

期望：编译成功，无错误

**Step 4: 提交**

```bash
git add src/api/OpenAIClient.ts src/api/BaseClient.ts
git commit -m "feat: 在 OpenAIClient 中集成日志记录"
```

---

### 任务 5：在 TranslationService 中集成日志

**Files:**
- Modify: `src/services/TranslationService.ts`

**Step 1: 导入并初始化 LoggingService**

```typescript
import { LoggingService } from './LoggingService';

export class TranslationService {
    private config: AiTranslateConfig;
    private cacheService: CacheService;
    private promptBuilder: PromptBuilder;
    private client: BaseClient | null = null;
    private pendingRequests: Map<string, Promise<string>> = new Map();
    private logger: LoggingService;

    constructor(config: AiTranslateConfig, logger?: LoggingService) {
        this.config = config;
        this.logger = logger ?? new LoggingService();
        this.cacheService = new CacheService({
            maxSize: 1000,
            ttl: 30 * 60 * 1000
        });
        this.promptBuilder = new PromptBuilder();
        this.updateClient();
    }
}
```

**Step 2: 在 translate 方法中添加日志**

```typescript
async translate(content: string, options: TranslationOptions = {}): Promise<string> {
    const { to = 'auto', suppressError = false } = options;
    const targetLang = to === 'auto' ? 'zh-CN' : to;

    this.logger.debug('翻译请求：内容="%s...", 目标语言=%s', 
        content.substring(0, 50), targetLang);

    // 检查缓存
    const cacheKey = CacheService.generateKey(content, targetLang, this.config.modelType);
    const cached = this.cacheService.get(cacheKey);
    if (cached) {
        this.logger.info('缓存命中：key=%s', cacheKey.substring(0, 20));
        return cached;
    }

    this.logger.debug('缓存未命中：key=%s', cacheKey.substring(0, 20));

    // 检查待处理的请求（去重）
    const pendingKey = `${content}:${targetLang}:${this.config.modelType}`;
    if (this.pendingRequests.has(pendingKey)) {
        this.logger.debug('使用待处理请求：key=%s', pendingKey);
        return this.pendingRequests.get(pendingKey)!;
    }

    // 创建翻译 Promise
    const translationPromise = this.doTranslate(content, targetLang, suppressError);
    this.pendingRequests.set(pendingKey, translationPromise);

    try {
        const result = await translationPromise;

        // 缓存结果
        this.cacheService.set(cacheKey, result);
        this.logger.info('翻译完成：内容长度=%d', result.length);

        return result;
    } catch (error) {
        this.logger.error('翻译失败：%s', error instanceof Error ? error.message : '未知错误');
        throw error;
    } finally {
        // 清理待处理请求
        this.pendingRequests.delete(pendingKey);
    }
}
```

**Step 3: 编译验证**

```bash
npm run compile
```

期望：编译成功，无错误

**Step 4: 提交**

```bash
git add src/services/TranslationService.ts
git commit -m "feat: 在 TranslationService 中集成日志记录"
```

---

### 任务 6：在 extension.ts 中集成日志

**Files:**
- Modify: `src/extension.ts`

**Step 1: 导入 LoggingService**

```typescript
import { LoggingService } from './services/LoggingService';
import { LogLevel } from './services/LoggingService';
```

**Step 2: 在 activate 函数中初始化日志**

```typescript
export function activate(context: vscode.ExtensionContext): ExtensionExports {
    // 创建日志服务
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const logLevel = LogLevel[config.logLevel as keyof typeof LogLevel] ?? LogLevel.Info;
    const logger = new LoggingService(logLevel);

    logger.info('Comment Translate AI 扩展已激活');
    logger.debug('配置：modelType=%s, modelName=%s', config.modelType, config.modelName);

    // 创建主 AI 翻译实例
    const aiTranslate = new AiTranslate();

    // 创建用于问题翻译的翻译服务
    const translationService = new TranslationService(config, logger);

    // 创建并启动问题翻译服务
    const problemTranslationService = new ProblemTranslationService(config, translationService);

    // ... 其余代码
}
```

**Step 3: 编译验证**

```bash
npm run compile
```

期望：编译成功，无错误

**Step 4: 提交**

```bash
git add src/extension.ts
git commit -m "feat: 在扩展激活时初始化日志服务"
```

---

## 第三部分：代码兼容性检查

### 任务 7：检查代码兼容性

**Files:**
- 检查所有 `src/**/*.ts` 文件

**Step 1: 检查 package.json 依赖**

```bash
cat package.json
```

确认：
- `axios` 在 `dependencies` 中 ✅
- 没有浏览器专用 API 依赖

**Step 2: 检查所有源文件**

```bash
grep -r "fetch(" src/
grep -r "localStorage" src/
grep -r "require(" src/
```

期望：无结果（不使用这些 API）

**Step 3: 运行 lint 检查**

```bash
npm run lint
```

期望：无严重错误

**Step 4: 提交检查结果**

```bash
git add .
git commit -m "chore: 验证代码兼容性，无 VSCode 不支持的 API"
```

---

## 第四部分：测试验证

### 任务 8：测试 Problem Translate Lang Bug 修复

**Step 1: 打开一个有错误的文件**

创建一个有 TypeScript 错误的文件，例如：
```typescript
const x: number = "string"; // 类型错误
```

**Step 2: 等待翻译出现**

观察问题面板，确认翻译出现

**Step 3: 修复错误**

```typescript
const x: number = 42; // 修复
```

**Step 4: 验证翻译消失**

确认问题面板中翻译的诊断也消失了

**Step 5: 记录测试结果**

```bash
echo "Problem Translate Lang Bug 修复测试：通过/失败"
```

---

### 任务 9：测试日志功能

**Step 1: 打开 VSCode 输出面板**

在 VSCode 中：`Ctrl+Shift+U`

**Step 2: 选择 "Comment Translate AI" 通道**

**Step 3: 执行翻译操作**

翻译一段注释

**Step 4: 验证日志输出**

确认看到类似日志：
```
[2026-03-10T10:00:00.000Z] [INFO] Comment Translate AI 扩展已激活
[2026-03-10T10:00:01.000Z] [INFO] 翻译请求：内容长度=50, 目标语言=zh-CN
[2026-03-10T10:00:02.000Z] [INFO] API 响应：tokens=120, 耗时=1.2s
```

**Step 5: 记录测试结果**

```bash
echo "日志功能测试：通过/失败"
```

---

### 任务 10：最终验证

**Step 1: 运行完整编译**

```bash
npm run compile
```

期望：编译成功

**Step 2: 运行 lint**

```bash
npm run lint
```

期望：无错误

**Step 3: 查看 git 状态**

```bash
git status
```

**Step 4: 推送分支（可选）**

```bash
git push origin refactor/layered-architecture
```

---

## 验收清单

- [ ] Problem Translate Lang Bug 已修复
- [ ] 日志输出功能正常工作
- [ ] 代码通过编译和 lint 检查
- [ ] 所有现有功能正常工作
- [ ] 提交历史清晰，每个功能独立提交

---

## 参考文件

- 设计文档：`docs/plans/2026-03-10-bugfix-and-improvements-design.md`
- [VSCode OutputChannel API](https://code.visualstudio.com/api/references/vscode-api#OutputChannel)
- [VSCode Diagnostic API](https://code.visualstudio.com/api/references/vscode-api#DiagnosticCollection)
