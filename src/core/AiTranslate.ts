// src/core/AiTranslate.ts
import { ITranslate, ITranslateOptions } from 'comment-translate-manager';
import { window } from 'vscode';
import { ConfigManager } from './ConfigManager';
import { TranslationService } from '../services/TranslationService';
import { NamingService } from '../services/NamingService';
import { AiTranslateConfig } from '../types';
import { TranslationError } from '../errors/TranslationError';

export class AiTranslate implements ITranslate {
    // ITranslate接口属性
    readonly id = 'ai-powered-comment-translate-extension';
    readonly name = 'AI translate';

    private configManager: ConfigManager;
    private translationService: TranslationService;
    private namingService: NamingService;

    constructor() {
        // 初始化配置管理器
        this.configManager = new ConfigManager();
        
        // 获取初始配置
        const config = this.configManager.getConfig();
        
        // 初始化服务
        this.translationService = new TranslationService(config);
        this.namingService = new NamingService(config);
        
        // 监听配置变化
        this.configManager.onConfigChange(() => {
            const newConfig = this.configManager.getConfig();
            this.translationService.updateConfig(newConfig);
            this.namingService.updateConfig(newConfig);
        });
    }

    /**
     * 最大翻译长度
     */
    get maxLen(): number {
        return 3000;
    }

    /**
     * 生成链接（AI翻译不需要此功能，直接返回原内容）
     */
    link(content: string, _options: ITranslateOptions): string {
        return content;
    }

    /**
     * 主翻译方法（ITranslate接口）
     */
    async translate(content: string, options: ITranslateOptions): Promise<string> {
        // 翻译前验证配置
        const validation = this.configManager.validate();
        if (!validation.valid) {
            const errorMsg = `配置错误: ${validation.errors.join(', ')}`;
            window.showErrorMessage(errorMsg);
            throw new Error(errorMsg);
        }

        try {
            return await this.translationService.translate(content, options);
        } catch (error) {
            if (error instanceof TranslationError) {
                throw new Error(error.userMessage);
            }
            throw error;
        }
    }

    /**
     * AI命名方法
     */
    async aiNaming(variableName: string, languageId: string): Promise<string> {
        // 验证配置
        const validation = this.configManager.validate();
        if (!validation.valid) {
            const errorMsg = `配置错误: ${validation.errors.join(', ')}`;
            window.showErrorMessage(errorMsg);
            throw new Error(errorMsg);
        }

        // 检查翻译源是否为AI translate
        const isValidSource = await this.validateTranslationSource();
        if (!isValidSource) {
            window.showInformationMessage('请将翻译源选择为 AI translate');
            throw new Error('翻译源不是 AI translate');
        }

        try {
            return await this.namingService.aiNaming(variableName, languageId);
        } catch (error) {
            if (error instanceof TranslationError) {
                throw new Error(error.userMessage);
            }
            throw error;
        }
    }

    /**
     * 检测语言
     */
    async detectLanguage(text: string): Promise<string> {
        const validation = this.configManager.validate();
        if (!validation.valid) {
            console.error('语言检测失败：配置无效', validation.errors);
            return 'unknown';
        }

        return this.translationService.detectLanguage(text);
    }

    /**
     * 获取当前配置
     */
    getConfig(): Readonly<AiTranslateConfig> {
        return this.configManager.getConfig();
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
        return this.translationService.getCacheStats();
    }

    /**
     * 清除翻译缓存
     */
    clearCache(): void {
        this.translationService.clearCache();
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.configManager.dispose();
    }

    /**
     * 验证当前翻译源是否为AI translate
     */
    private async validateTranslationSource(): Promise<boolean> {
        try {
            const vscode = await import('vscode');
            const commentTranslateConfig = vscode.workspace.getConfiguration('commentTranslate');
            const source = commentTranslateConfig.get<string>('source', '');
            
            // 检查源是否包含我们的扩展ID（处理各种格式）
            // 可能的格式：
            // - "ai-powered-comment-translate-extension"
            // - "Cheng-MaoMao.ai-powered-comment-translate-extension"
            // - "Cheng-MaoMao.ai-powered-comment-translate-extension-ai-powered-comment-translate-extension"
            // - "AI translate"（显示名称）
            const validIdentifiers = [
                'ai-powered-comment-translate-extension',
                'AI translate'
            ];
            
            // 检查源是否包含任何有效的标识符
            return validIdentifiers.some(id => source.includes(id));
        } catch (error) {
            console.error('验证翻译源失败：', error);
            // 如果无法检查，假设它是有效的以允许使用
            return true;
        }
    }
}
