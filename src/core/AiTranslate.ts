// src/core/AiTranslate.ts
import { ITranslate, ITranslateOptions } from 'comment-translate-manager';
import { window } from 'vscode';
import { ConfigManager } from './ConfigManager';
import { TranslationService } from '../services/TranslationService';
import { NamingService } from '../services/NamingService';
import { AiTranslateConfig } from '../types';
import { TranslationError } from '../errors/TranslationError';

export class AiTranslate implements ITranslate {
    // ITranslate interface properties
    readonly id = 'ai-powered-comment-translate-extension';
    readonly name = 'AI translate';

    private configManager: ConfigManager;
    private translationService: TranslationService;
    private namingService: NamingService;

    constructor() {
        // Initialize config manager
        this.configManager = new ConfigManager();
        
        // Get initial config
        const config = this.configManager.getConfig();
        
        // Initialize services
        this.translationService = new TranslationService(config);
        this.namingService = new NamingService(config);
        
        // Listen for config changes
        this.configManager.onConfigChange(() => {
            const newConfig = this.configManager.getConfig();
            this.translationService.updateConfig(newConfig);
            this.namingService.updateConfig(newConfig);
        });
    }

    /**
     * Maximum translation length
     */
    get maxLen(): number {
        return 3000;
    }

    /**
     * Generate link (not applicable for AI translation, return content as-is)
     */
    link(content: string, _options: ITranslateOptions): string {
        return content;
    }

    /**
     * Main translation method (ITranslate interface)
     */
    async translate(content: string, options: ITranslateOptions): Promise<string> {
        // Validate config before translation
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
     * AI Naming method
     */
    async aiNaming(variableName: string, languageId: string): Promise<string> {
        // Validate config
        const validation = this.configManager.validate();
        if (!validation.valid) {
            const errorMsg = `配置错误: ${validation.errors.join(', ')}`;
            window.showErrorMessage(errorMsg);
            throw new Error(errorMsg);
        }

        // Check if translation source is AI translate
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
     * Detect language
     */
    async detectLanguage(text: string): Promise<string> {
        const validation = this.configManager.validate();
        if (!validation.valid) {
            console.error('Language detection failed: config invalid', validation.errors);
            return 'unknown';
        }

        return this.translationService.detectLanguage(text);
    }

    /**
     * Get current configuration
     */
    getConfig(): Readonly<AiTranslateConfig> {
        return this.configManager.getConfig();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
        return this.translationService.getCacheStats();
    }

    /**
     * Clear translation cache
     */
    clearCache(): void {
        this.translationService.clearCache();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.configManager.dispose();
    }

    /**
     * Validate that current translation source is AI translate
     */
    private async validateTranslationSource(): Promise<boolean> {
        try {
            const vscode = await import('vscode');
            const commentTranslateConfig = vscode.workspace.getConfiguration('commentTranslate');
            const source = commentTranslateConfig.get<string>('source', '');
            
            // Check if source contains our extension ID (handles various formats)
            // Possible formats:
            // - "ai-powered-comment-translate-extension"
            // - "Cheng-MaoMao.ai-powered-comment-translate-extension"
            // - "Cheng-MaoMao.ai-powered-comment-translate-extension-ai-powered-comment-translate-extension"
            // - "AI translate" (display name)
            const validIdentifiers = [
                'ai-powered-comment-translate-extension',
                'AI translate'
            ];
            
            // Check if source includes any valid identifier
            return validIdentifiers.some(id => source.includes(id));
        } catch (error) {
            console.error('Failed to validate translation source:', error);
            // If we can't check, assume it's valid to allow usage
            return true;
        }
    }
}
