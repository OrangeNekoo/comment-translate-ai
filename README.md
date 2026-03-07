# Comment Translate AI

支持大模型调用的 VSCode 代码注释翻译插件，作为 [Comment Translate](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate) 的翻译源扩展。兼容所有 OpenAI API 格式的服务，如 OpenAI、DeepSeek、OpenRouter 等。

⚠️*本插件不提供大模型 Key，请自备 Key*

[**简体中文**]|[English](README_en.md)

## ✨ 特性

- 🤖 支持 OpenAI 兼容模式，适用于 DeepSeek、OpenRouter 等多种服务
- 🎯 对函数、类、变量等参数的智能命名，按照命名规则优化命名
- 🔄 对问题面板信息进行翻译
- ⌨️ 自定义提示词模板
- ⚡ 快速的翻译响应（支持流式传输）
- 🛡️ 过滤深度思考模型的思考内容（如 DeepSeek-R1）
- 💾 智能 LRU 缓存，避免重复翻译
- 🛠️ 灵活的配置选项

## 📦 安装

1. 安装 [Comment Translate](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate)
2. 安装本插件 [Comment Translate for AI](https://marketplace.visualstudio.com/items?itemName=Cheng-MaoMao.ai-powered-comment-translate-extension&ssr=false#overview)
3. 在 VS Code 中打开命令面板 (Ctrl+Shift+P)
4. 输入 "Comment Translate: Change translation source"
5. 选择 "AI Translate" 作为翻译源

## ⚙️ 配置

在 VS Code 设置中配置以下选项：

| 配置项 | 说明 | 默认值 |
| :--- | :--- | :--- |
| `aiTranslate.largeModelApi` | OpenAI 兼容 API 端点，支持 DeepSeek、OpenRouter 等服务 | `https://api.openai.com/v1` |
| `aiTranslate.largeModelKey` | API 密钥 | - |
| `aiTranslate.largeModelName` | 模型名称，如 gpt-3.5-turbo、deepseek-chat | `gpt-3.5-turbo` |
| `aiTranslate.largeModelMaxTokens` | 最大 token 数 | `4096` |
| `aiTranslate.largeModelTemperature` | 温度参数 (0-1)，较低值更确定，较高值更多样 | `0.5` |
| `aiTranslate.namingRules` | 命名规则 | `default` |
| `aiTranslate.streaming` | 启用流式传输 | `false` |
| `aiTranslate.filterThinkingContent` | 过滤深度思考内容 | `false` |
| `aiTranslate.problemTranslateLang` | 问题面板翻译目标语言 | `none` |
| `aiTranslate.customTranslatePrompt` | 自定义翻译提示词 | - |
| `aiTranslate.customNamingPrompt` | 自定义命名提示词 | - |

## 🚀 快速开始

1. 配置 API 相关信息，请确保您使用的大模型服务商兼容 OpenAI 的 API 调用格式
   - [OpenAI 官方文档](https://platform.openai.com/docs/api-reference/chat)
   - *中国大陆地区推荐使用 [DeepSeek](https://platform.deepseek.com/)*
   
   ![配置](./image/setting.png)

2. 配置完成后，请调用 "Comment Translate" 中的 "Comment Translate: Change translate source" 命令
   ![换源](./image/change.png)

3. 选择翻译源为 "AI translate"
   ![选择](./image/select.png)

### 怎么使用 "AI 命名"

* 右键鼠标 → 在列表中选择 "注释翻译" → 点击 "AI 命名" 即可使用
* 将命名按照所选的命名格式翻译成英文
* 按照命名格式优化命名

![AI 命名](./image/AI%20Naming.gif)

### 自定义 AI 提示词

*提示词中需要包含以下参数，参数内容由插件自动获取*

**自定义命名提示词**

| 参数 | 说明 | 必填 |
| :--- | :--- | :--- |
| `${variableName}` | 当前正在处理的变量名 | 是 |
| `${paragraph}` | 变量所在的段落 | 是 |
| `${languageId}` | 当前文件的语言标识 | 是 |
| `${namingRule}` | 命名规则描述 | 否 |

```
示例：请根据 ${languageId} 判断 "${paragraph}" 中的 "${variableName}" 是类名、方法名、函数名还是其他类型。
然后，根据 ${languageId} 的标准规范和 ${namingRule}，将 "${variableName}" 翻译为英文，
使用专业术语，并直接返回 "${variableName}" 的翻译结果，无需任何解释或特殊符号。
```

**自定义翻译提示词**

| 参数 | 说明 | 必填 |
| :--- | :--- | :--- |
| `${targetLang}` | 翻译时的目标语言 | 是 |
| `${content}` | 需要翻译的内容 | 是 |

```
示例：请充当翻译员，检查句子或词语是否准确，翻译自然、流畅且符合习惯用法，
使用专业的计算机术语以确保注释或功能的准确翻译，无需添加不必要的内容。
将以下文本翻译成 ${targetLang}：
${content}
```

### 问题面板信息翻译

*将问题面板中的警告、报错等信息翻译成所选的语言*

*⚠️ 对语言的支持能力取决于你使用的模型*

![问题面板翻译](./image/problemTranslateLang.gif)

## 🏗️ 架构

本项目采用分层架构设计：

```
src/
├── api/           # API 客户端层 (OpenAIClient)
├── core/          # 核心业务逻辑 (AiTranslate, ConfigManager, PromptBuilder)
├── errors/        # 错误处理 (TranslationError)
├── services/      # 业务服务层 (TranslationService, NamingService, ProblemTranslationService, CacheService)
├── types/         # 类型定义
├── utils/         # 工具函数 (retry, debounce, url)
└── extension.ts   # 扩展入口
```

### 性能优化

- **LRU 缓存**：最多缓存 1000 条翻译结果，30 分钟过期
- **请求去重**：相同内容的并发请求自动合并
- **防抖处理**：问题面板翻译防抖 500ms
- **指数退避重试**：网络错误自动重试 3 次（1s → 2s → 4s）
- **错误分类**：区分可重试错误和配置错误

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📝 更新日志

### 2.0.0 (重构版本)

- 🏗️ **架构重构**：采用分层架构，提升代码质量和可维护性
- 🗑️ 移除 Gemini 支持
- 🌍 完善设置界面多语言支持（简体中文、英语）
- 🛡️ 增强错误处理和重试机制
- 💾 添加 LRU 缓存和请求去重
- 📊 优化问题面板翻译性能

### 1.0.4

- 🔧 优化代码结构

### 1.0.3

- 🔧 修复 BUG [#5](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/5)
  上个版本没修好 😭

### 1.0.2

- 🔧 修复 BUG [#5](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/5)

### 1.0.1

- 🔄 添加问题面板信息翻译功能

### 1.0.0

- 🧹 添加去除深度思考模型思考内容功能

### 0.0.9

- 🔄 优化大模型调用方式
- ➕ 添加谷歌 Gemini 大模型调用方式

### 0.0.8

- 🔧 优化设置界面
- 📤 添加流式传输支持

### 0.0.7

- ✨ 添加了自定义 AI 提示词功能 [#1](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/1)

### 0.0.4

- 🤖 添加 AI 命名功能，AI 可以根据你的设定或者自行判断，对变量、函数、类等参数智能命名
- 🌐 添加了多语言环境的配置文件

## 🙏 致谢

本项目基于以下优秀的开源项目开发：

- [vscode-comment-translate](https://github.com/intellism/vscode-comment-translate) - VSCode 注释翻译插件
- [deepl-translate](https://github.com/intellism/deepl-translate) - DeepL 翻译扩展，本项目的基础代码来源

特别感谢：

- [@intellism](https://github.com/intellism) 提供的优秀插件框架和参考实现

## 📄 许可证说明

本项目采用 [MIT License](LICENSE) 许可证。

部分代码修改自 [deepl-translate](https://github.com/intellism/deepl-translate)，遵循其 MIT 许可证。
