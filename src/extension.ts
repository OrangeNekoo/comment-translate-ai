// src/extension.ts
import * as vscode from 'vscode';
import { AiTranslate } from './core/AiTranslate';
import { TranslationService } from './services/TranslationService';
import { ProblemTranslationService } from './services/ProblemTranslationService';
import { ConfigManager } from './core/ConfigManager';
import { LoggingService, LogLevel } from './services/LoggingService';

// 扩展导出接口
interface ExtensionExports {
    extendTranslate: (registry: (key: string, ctor: new () => any) => void) => void;
}

// 全局日志服务单例
let globalLogger: LoggingService | null = null;

/**
 * 获取或创建全局日志服务单例
 */
function getLogger(logLevel: LogLevel): LoggingService {
    if (!globalLogger) {
        globalLogger = new LoggingService(logLevel);
    }
    return globalLogger;
}

/**
 * 扩展激活入口函数
 */
export function activate(context: vscode.ExtensionContext): ExtensionExports {
    // 创建配置管理器
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    // 创建日志服务（单例）
    const logLevel = LogLevel[config.logLevel as keyof typeof LogLevel] ?? LogLevel.Info;
    const logger = getLogger(logLevel);

    logger.info('Comment Translate AI 扩展已激活');
    logger.debug('配置：modelType=%s, modelName=%s', config.modelType, config.modelName);

    // 创建用于问题翻译的翻译服务
    const translationService = new TranslationService(config, logger);

    // 创建主 AI 翻译实例（传入共享的翻译服务和日志服务）
    const aiTranslate = new AiTranslate(config, translationService);

    // 创建并启动问题翻译服务
    const problemTranslationService = new ProblemTranslationService(config, translationService);

    // 监听配置变化
    const configDisposable = configManager.onConfigChange(() => {
        const newConfig = configManager.getConfig();
        const newLogLevel = LogLevel[newConfig.logLevel as keyof typeof LogLevel] ?? LogLevel.Info;
        // 更新日志服务级别
        if (globalLogger) {
            // 日志级别更新需要通过重新创建 OutputChannel 实现，这里仅记录
            globalLogger.info('配置已更新');
        }
        translationService.updateConfig(newConfig);
        problemTranslationService.updateConfig(newConfig);
    });

    // 启动问题翻译服务
    problemTranslationService.start();

    // 注册 AI 命名命令
    const namingCommand = vscode.commands.registerCommand('aiTranslate.aiNaming', async () => {
        await handleAiNaming(aiTranslate);
    });

    // 注册需要释放的资源
    context.subscriptions.push(
        namingCommand,
        configDisposable,
        problemTranslationService,
        configManager,
        {
            dispose: () => {
                aiTranslate.dispose();
                translationService.clearCache();
                if (globalLogger) {
                    globalLogger.dispose();
                    globalLogger = null;
                }
            }
        }
    );

    // 返回扩展导出，用于注册翻译源
    return {
        extendTranslate: (registry: (key: string, ctor: new () => any) => void) => {
            registry('ai-powered-comment-translate-extension', AiTranslate);
        }
    };
}

/**
 * 扩展停用函数
 */
export function deactivate(): void {
    // 资源清理由 disposables 处理
}

/**
 * 处理 AI 命名命令
 */
async function handleAiNaming(aiTranslate: AiTranslate): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    const languageId = editor.document.languageId;

    if (!text) {
        vscode.window.showWarningMessage('请先选择要命名的文本');
        return;
    }

    try {
        const translatedName = await aiTranslate.aiNaming(text, languageId);

        // 用翻译后的名称替换选中的文本
        await editor.edit(editBuilder => {
            editBuilder.replace(selection, translatedName);
        });

        vscode.window.showInformationMessage(`已重命名为：${translatedName}`);
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`命名失败：${error.message}`);
        }
    }
}
