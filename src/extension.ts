// src/extension.ts
import * as vscode from 'vscode';
import { AiTranslate } from './core/AiTranslate';
import { TranslationService } from './services/TranslationService';
import { ProblemTranslationService } from './services/ProblemTranslationService';
import { ConfigManager } from './core/ConfigManager';

// 扩展导出接口
interface ExtensionExports {
    extendTranslate: (registry: (key: string, ctor: new () => any) => void) => void;
}

/**
 * 扩展激活入口函数
 */
export function activate(context: vscode.ExtensionContext): ExtensionExports {
    // 创建主AI翻译实例
    const aiTranslate = new AiTranslate();
    
    // 创建问题翻译服务所需的配置管理器
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    
    // 创建用于问题翻译的翻译服务
    const translationService = new TranslationService(config);
    
    // 创建并启动问题翻译服务
    const problemTranslationService = new ProblemTranslationService(config, translationService);
    
    // 监听配置变化
    const configDisposable = configManager.onConfigChange(() => {
        const newConfig = configManager.getConfig();
        translationService.updateConfig(newConfig);
        problemTranslationService.updateConfig(newConfig);
    });
    
    // 启动问题翻译服务
    problemTranslationService.start();
    
    // 注册AI命名命令
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
    // 资源清理由disposables处理
}

/**
 * 处理AI命名命令
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
        
        vscode.window.showInformationMessage(`已重命名为: ${translatedName}`);
    } catch (error) {
        if (error instanceof Error) {
            vscode.window.showErrorMessage(`命名失败: ${error.message}`);
        }
    }
}
