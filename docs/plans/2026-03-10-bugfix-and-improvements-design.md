# Bug 修复与改进设计文档

**日期：** 2026-03-10  
**作者：** AI Assistant  
**状态：** 已批准

---

## 1. 概述

本文档描述三个问题的修复方案：

1. **Problem Translate Lang Bug** - 原始错误消息消失后，翻译消息不会消失
2. **日志输出功能** - 注册 VSCode 输出通道用于查看与大模型的通信情况
3. **代码兼容性检查** - 检查并删除 VSCode 插件不支持的代码

---

## 2. 问题 1：Problem Translate Lang Bug 修复

### 2.1 问题描述

使用 `problemTranslateLang` 功能时，当原始错误消息消失后，翻译的消息不会消失。

### 2.2 根本原因

当前 `ProblemTranslationService` 使用独立的 `DiagnosticCollection` 存储翻译后的诊断信息。当原始诊断信息被清除时，翻译的诊断信息不会自动清除，因为：
- 没有追踪哪些 URI 已经被添加了翻译诊断
- `performTranslation()` 方法只处理当前存在的诊断信息
- 当原始诊断消失后，翻译诊断仍然保留在集合中

### 2.3 解决方案

**实施方案 A：URI 追踪 + 增量清理**

1. 维护一个已翻译 URI 的集合 `translatedUris: Set<string>`
2. 每次翻译时：
   - 获取当前所有诊断信息的 URI 集合 `currentUris`
   - 计算差集 `staleUris = translatedUris - currentUris`
   - 清理 `staleUris` 中的翻译诊断
   - 更新 `translatedUris = currentUris`

3. 在 `performTranslation()` 方法末尾添加清理逻辑：
```typescript
// 清理不再有原始诊断的 URI 的翻译
for (const uriStr of this.translatedUris) {
    if (!currentUriSet.has(uriStr)) {
        this.diagnosticCollection.delete(Uri.parse(uriStr));
    }
}
```

### 2.4 修改文件

- `src/services/ProblemTranslationService.ts`

---

## 3. 问题 2：日志输出功能

### 3.1 需求描述

给插件在 VSCode 的输出中注册一个输出通道，用于查看与大模型的通信连接情况，方便排错。

### 3.2 设计方案

#### 3.2.1 创建 LoggingService 服务

新建 `src/services/LoggingService.ts`，封装日志记录逻辑：

```typescript
export class LoggingService implements Disposable {
    private outputChannel: OutputChannel;
    private logLevel: LogLevel;

    // 日志级别：error, warn, info, debug
    // 日志格式：[TIMESTAMP] [LEVEL] [Module] Message
}
```

#### 3.2.2 日志内容设计

| 级别 | 场景 | 示例 |
|------|------|------|
| INFO | 翻译请求开始 | `翻译请求：内容长度=50, 目标语言=zh-CN` |
| DEBUG | API 请求详情 | `API 请求：POST https://api.xxx.com/v1/chat/completions` |
| DEBUG | 请求参数 | `请求参数：model=gpt-3.5-turbo, temperature=0.5` |
| INFO | 缓存状态 | `缓存命中：key=abc123` |
| INFO | API 响应 | `API 响应：tokens=120, 耗时=1.2s` |
| ERROR | 请求失败 | `请求失败：Network error, 重试中... (1/3)` |
| WARN | 配置问题 | `配置警告：API Key 未配置` |

#### 3.2.3 集成点

1. **OpenAIClient** - 记录请求/响应
2. **TranslationService** - 记录缓存状态
3. **ProblemTranslationService** - 记录翻译诊断数量
4. **extension.ts** - 激活时显示欢迎信息

#### 3.2.4 配置项（可选）

考虑添加配置项控制日志级别：
- `aiTranslate.logLevel`: `error` | `warn` | `info` | `debug` (默认：`info`)

### 3.3 修改/新增文件

- **新增：** `src/services/LoggingService.ts`
- **修改：** `src/api/OpenAIClient.ts`
- **修改：** `src/services/TranslationService.ts`
- **修改：** `src/extension.ts`

---

## 4. 问题 3：代码兼容性检查

### 4.1 检查范围

根据 VSCode API 文档和参考插件代码，检查以下内容：

1. **Node.js 原生模块** - 确保使用允许的模块
2. **浏览器 API** - 不使用 `fetch`, `localStorage` 等
3. **动态 require** - 使用静态导入
4. **文件系统访问** - 使用 `vscode.workspace.fs` 而非 Node.js `fs`
5. **网络请求** - 使用 `axios` 或 Node.js `http/https` 模块

### 4.2 当前代码检查结果

| 检查项 | 状态 | 说明 |
|--------|------|------|
| axios 使用 | ✅ | 允许的网络请求库 |
| Map/Set 使用 | ✅ | 标准 JavaScript API，允许 |
| 文件系统访问 | ✅ | 未使用 Node.js fs 模块 |
| 动态 require | ✅ | 全部使用静态 import |
| 浏览器 API | ✅ | 未使用 |

### 4.3 需要修改的内容

检查 `package.json` 中的依赖：
- 确保 `axios` 在 `dependencies` 中（而非 `devDependencies`）
- 检查是否有其他运行时不需要的依赖

---

## 5. 实施计划

### 5.1 任务分解

| 序号 | 任务 | 文件 | 预计复杂度 |
|------|------|------|------------|
| 1 | 修复 ProblemTranslationService URI 追踪 | `src/services/ProblemTranslationService.ts` | 低 |
| 2 | 创建 LoggingService | `src/services/LoggingService.ts` | 中 |
| 3 | 集成日志到 OpenAIClient | `src/api/OpenAIClient.ts` | 中 |
| 4 | 集成日志到 TranslationService | `src/services/TranslationService.ts` | 低 |
| 5 | 更新 extension.ts 激活日志 | `src/extension.ts` | 低 |
| 6 | 代码兼容性检查 | 全部源文件 | 低 |
| 7 | 测试验证 | - | 中 |

### 5.2 实施顺序

1. 先修复 Bug（问题 1）
2. 实现日志功能（问题 2）
3. 进行兼容性检查（问题 3）

---

## 6. 测试计划

### 6.1 Problem Translate Lang Bug 测试

1. 打开一个有错误的文件
2. 等待翻译出现
3. 修复错误，让原始错误消失
4. 验证翻译诊断是否同时消失

### 6.2 日志功能测试

1. 打开 VSCode 输出面板
2. 选择 "Comment Translate AI" 通道
3. 执行翻译操作
4. 验证日志输出是否正确

### 6.3 兼容性测试

1. 编译项目 `npm run compile`
2. 在 VSCode 扩展主机中测试
3. 验证所有功能正常工作

---

## 7. 验收标准

- [ ] 问题 1 修复：原始诊断消失后，翻译诊断同时消失
- [ ] 问题 2 实现：输出通道正常显示日志信息
- [ ] 问题 3 验证：代码通过编译，无兼容性问题
- [ ] 所有现有功能正常工作
- [ ] 代码通过 lint 检查 `npm run lint`

---

## 8. 参考文档

- [VSCode API 参考](https://code.visualstudio.com/api/references/vscode-api)
- [vscode-comment-translate](https://github.com/intellism/vscode-comment-translate)
- [deepl-translate](https://github.com/intellism/deepl-translate)
