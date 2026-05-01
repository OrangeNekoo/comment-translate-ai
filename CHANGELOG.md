# Change Log

All notable changes to the "comment-translate-ai" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Initial release

## [2.0.3] - 2026-05-01

### Changed

- ✨ 新增 `aiTranslate.extraRequestParams` 配置项，支持向 OpenAI 兼容接口传递厂商扩展参数（如 DashScope 的 enable_thinking、enable_search 等）
- 🛡️ 内置请求字段保持优先级，避免自定义参数覆盖核心字段

## [2.0.2] - 2026-04-26

### Changed

- 🔧 修复problemTranslateLang功能会重复翻译问题

## [2.0.1] - 2026-03-10

- 🏗️ **架构重构**：采用分层架构，提升代码质量和可维护性
- 🗑️ 移除 Gemini 支持
- 🌍 完善设置界面多语言支持（简体中文、英语）
- 🛡️ 增强错误处理和重试机制
- 💾 添加 LRU 缓存和请求去重
- 📊 优化问题面板翻译性能

## [2.0.0] - 2026-03-07

### Changed

- 🔧 优化代码结构

## [1.0.4] - 2025-05-12

### Changed

- 🔧 修复BUG [#5](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/5)
上个版本没修好😭

## [1.0.3] - 2025-05-12

### Changed

- 🔧 修复BUG [#5](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/5)

## [1.0.2] - 2025-05-12

### Changed

- 🔄 添加问题面板信息翻译功能

## [1.0.1] - 2025-04-30

### Changed

- 🧹 添加去除深度思考模型思考内容功能

## [1.0.0] - 2025-04-29

### Changed

- ✨ 优化大模型调用方式
- ➕ 添加谷歌Gemini大模型调用方式

## [0.0.9] - 2025-04-28

### Changed

- 🔧 优化设置界面
- 📤 添加流式传输支持

## [0.0.8] - 2025-01-20

### Changed

- ✨ 添加了自定义AI提示词功能 [#1](https://github.com/Cheng-MaoMao/comment-translate-ai/issues/1)

## [0.0.7] - 2025-01-19

### Changed

- 🤖 优化了AI提示词

## [0.0.6] - 2025-01-02

### Changed

- 🔍 在插件设置里面添加了"调试功能"

## [0.0.5] - 2024-12-31

### Changed

- 🤖 添加AI命名功能，AI可以根据你的设定或者自行判断，对变量、函数、类等参数智能命名
- 🌐 添加了多语言环境的配置文件

## [0.0.4] - 2024-12-29

### Changed

- 🔧 添加Model Temperature设置

## [0.0.3] - 2024-12-28

### Changed

- 🔧 修改设置名称

## [0.0.2] - 2024-12-28

### Changed

- 🎉 初始化项目
- ✨ 实现基本翻译功能
- 🔧 添加配置选项

## [0.0.1] - 2024-12-28
