// src/extension.ts
import * as vscode from 'vscode';
import { AiTranslate } from './core/AiTranslate';
import { TranslationService } from './services/TranslationService';
import { ProblemTranslationService } from './services/ProblemTranslationService';
import { ConfigManager } from './core/ConfigManager';

// Extension exports interface
interface ExtensionExports {
    extendTranslate: (registry: (key: string, ctor: new () => any) => void) => void;
}

/**
 * Extension activation entry point
 */
export function activate(context: vscode.ExtensionContext): ExtensionExports {
    // Create main AI translate instance
    const aiTranslate = new AiTranslate();
    
    // Create config manager for problem translation service
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    
    // Create translation service for problem translation
    const translationService = new TranslationService(config);
    
    // Create and start problem translation service
    const problemTranslationService = new ProblemTranslationService(config, translationService);
    
    // Listen for config changes
    const configDisposable = configManager.onConfigChange(() => {
        const newConfig = configManager.getConfig();
        translationService.updateConfig(newConfig);
        problemTranslationService.updateConfig(newConfig);
    });
    
    // Start problem translation service
    problemTranslationService.start();
    
    // Register AI naming command
    const namingCommand = vscode.commands.registerCommand('aiTranslate.aiNaming', async () => {
        await handleAiNaming(aiTranslate);
    });
    
    // Register disposables
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
    
    // Return extension exports for translation source registration
    return {
        extendTranslate: (registry: (key: string, ctor: new () => any) => void) => {
            registry('ai-powered-comment-translate-extension', AiTranslate);
        }
    };
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    // Cleanup is handled by disposables
}

/**
 * Handle AI naming command
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
        
        // Replace selected text with translated name
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
