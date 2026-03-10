# Comment Translate AI

A VSCode code comment translation plugin that supports large language model integration, serving as a translation source extension for [Comment Translate](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate). Compatible with all OpenAI API format services, including OpenAI, DeepSeek, OpenRouter, and more.

⚠️*This plugin does not provide an API key. Please prepare your own key.*

[简体中文](README.md)|[**English**]

## ✨ Features

- 🤖 Supports OpenAI compatible mode, suitable for various services like DeepSeek, OpenRouter, and more
- 🎯 Intelligent naming of functions, classes, variables, and other parameters according to naming conventions
- 🔄 Translate information in the problem panel
- ⌨️ Custom prompt templates
- ⚡ Fast translation response (supports streaming)
- 🛡️ Filter deep thinking content from models (e.g., DeepSeek-R1)
- 💾 Smart LRU caching to avoid duplicate translations
- 🛠️ Flexible configuration options

## 📦 Installation

1. Install [Comment Translate](https://marketplace.visualstudio.com/items?itemName=intellsmi.comment-translate)
2. Install this plugin [Comment Translate for AI](https://marketplace.visualstudio.com/items?itemName=Cheng-MaoMao.ai-powered-comment-translate-extension&ssr=false#overview)
3. Open the command palette in VS Code (Ctrl+Shift+P)
4. Type "Comment Translate: Change translation source"
5. Select "AI Translate" as the translation source

## ⚙️ Configuration

Configure the following options in VS Code settings:

| Option | Description | Default |
| :--- | :--- | :--- |
| `aiTranslate.largeModelApi` | OpenAI compatible API endpoint, supports DeepSeek, OpenRouter, etc. | `https://api.openai.com/v1` |
| `aiTranslate.largeModelKey` | API key | - |
| `aiTranslate.largeModelName` | Model name, e.g., gpt-3.5-turbo, deepseek-chat | `gpt-3.5-turbo` |
| `aiTranslate.largeModelMaxTokens` | Maximum number of tokens | `4096` |
| `aiTranslate.largeModelTemperature` | Temperature (0-1), lower for deterministic, higher for diverse | `0.5` |
| `aiTranslate.namingRules` | Naming rules | `default` |
| `aiTranslate.streaming` | Enable streaming | `false` |
| `aiTranslate.filterThinkingContent` | Filter deep thinking content | `false` |
| `aiTranslate.problemTranslateLang` | Problem panel translation target language | `none` |
| `aiTranslate.customTranslatePrompt` | Custom translation prompt | - |
| `aiTranslate.customNamingPrompt` | Custom naming prompt | - |

## 🚀 Quick Start

1. Configure API-related information. Please ensure that your large model service provider is compatible with OpenAI's API calling format.
   - [OpenAI Official Documentation](https://platform.openai.com/docs/api-reference/chat)
   - *For users in mainland China, [DeepSeek](https://platform.deepseek.com/) is recommended*
   
   ![Configuration](./image/setting.png)

2. After configuration, call the "Comment Translate: Change translate source" command from "Comment Translate"
   ![Change source](./image/change.png)

3. Select "AI translate" as the translation source
   ![Select](./image/select.png)

### How to Use "AI Naming"

* Right-click → Select "Comment Translation" from the list → Click "AI naming"
* Translates names to English according to the selected naming format
* Optimizes naming according to the naming format

![AI naming](./image/AI%20Naming.gif)

### Custom AI Prompts

*Prompts must include the following parameters, which will be automatically retrieved by the plugin*

**Custom Naming Prompts**

| Parameter | Description | Required |
| :--- | :--- | :--- |
| `${variableName}` | The variable name currently being processed | Yes |
| `${paragraph}` | The paragraph where the variable is located | Yes |
| `${languageId}` | The language identifier of the current file | Yes |
| `${namingRule}` | Naming rule description | No |

```
Example: Please determine whether "${variableName}" in "${paragraph}" is a class name, method name, 
function name, or other type based on ${languageId}. Then, according to the standard specifications 
and ${namingRule} for ${languageId}, translate "${variableName}" into English using professional 
terminology, and directly return the translation result for "${variableName}" without any explanation 
or special symbols.
```

**Custom Translation Prompts**

| Parameter | Description | Required |
| :--- | :--- | :--- |
| `${targetLang}` | The target language for translation | Yes |
| `${content}` | Content to be translated | Yes |

```
Example: Please act as a translator, check if sentences or phrases are accurate, translate naturally, 
fluently and idiomatically, use professional computer terminology to ensure accurate translation of 
comments or functions, with no unnecessary additions. Translate the following text to ${targetLang}:
${content}
```

### Problem Panel Information Translation

*Translates warning, error and other information in the problem panel into the selected language*

*⚠️ Language support depends on the model you are using*

![Problem panel translation](./image/problemTranslateLang.gif)

## 🏗️ Architecture

This project adopts a layered architecture design:

```
src/
├── api/           # API client layer (OpenAIClient)
├── core/          # Core business logic (AiTranslate, ConfigManager, PromptBuilder)
├── errors/        # Error handling (TranslationError)
├── services/      # Business service layer (TranslationService, NamingService, ProblemTranslationService, CacheService)
├── types/         # Type definitions
├── utils/         # Utility functions (retry, debounce, url)
└── extension.ts   # Extension entry
```

### Performance Optimization

- **LRU Cache**: Caches up to 1000 translation results, expires in 30 minutes
- **Request Deduplication**: Concurrent requests for the same content are automatically merged
- **Debouncing**: Problem panel translation is debounced by 500ms
- **Exponential Backoff Retry**: Network errors are automatically retried 3 times (1s → 2s → 4s)
- **Error Classification**: Distinguishes between retryable errors and configuration errors

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📝 Changelog

### 2.0.1

- 🔧 Fixing the problemTranslateLang function will cause repeated translation issues

### 2.0.0 (Refactored Version)

- 🏗️ **Architecture Refactor**: Adopted layered architecture, improved code quality and maintainability
- 🗑️ Removed Gemini support
- 🌍 Improve settings interface multi-language support (Simplified Chinese, English)
- 🛡️ Enhanced error handling and retry mechanisms
- 💾 Added LRU caching and request deduplication
- 📊 Optimized problem panel translation performance

### 1.0.4

- 🔧 Optimized code structure

### 1.0.3

- 🔧 Fixed bugs [#5](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/5)
  The previous version wasn't fixed properly. 😭

### 1.0.2

- 🔧 Fixed bugs [#5](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/5)

### 1.0.1

- 🔄 Added problem panel information translation function

### 1.0.0

- 🧹 Added function to filter deep thinking content from models

### 0.0.9

- 🔄 Optimized large model calling method
- ➕ Added Google Gemini large model calling method

### 0.0.8

- 🔧 Optimized settings interface
- 📤 Added streaming support

### 0.0.7

- ✨ Added custom AI prompts feature [#1](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/1)

### 0.0.4

- 🤖 Added AI naming feature, allowing AI to intelligently name variables, functions, classes, and other parameters
- 🌐 Added configuration files for multilingual environments

## 🙏 Acknowledgments

This project is developed based on the following excellent open-source projects:

- [vscode-comment-translate](https://github.com/intellism/vscode-comment-translate) - VSCode comment translation plugin
- [deepl-translate](https://github.com/intellism/deepl-translate) - DeepL translation extension, the source of our base code

Special thanks to:

- [@intellism](https://github.com/intellism) for providing the excellent plugin framework and reference implementation

## 📄 License

This project is licensed under the [MIT License](LICENSE).

Some code is modified from [deepl-translate](https://github.com/intellism/deepl-translate), following its MIT license.
