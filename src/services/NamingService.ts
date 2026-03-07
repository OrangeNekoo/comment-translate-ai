// src/services/NamingService.ts
import { window, TextEditor, TextDocument } from 'vscode';
import { AiTranslateConfig } from '../types';
import { PromptBuilder } from '../core/PromptBuilder';
import { OpenAIClient } from '../api/OpenAIClient';
import { GeminiClient } from '../api/GeminiClient';
import { BaseClient } from '../api/BaseClient';
import { TranslationError, ErrorCode } from '../errors/TranslationError';

export interface NamingContext {
    variableName: string;
    paragraph: string;
    languageId: string;
}

export class NamingService {
    private config: AiTranslateConfig;
    private promptBuilder: PromptBuilder;
    private client: BaseClient | null = null;

    constructor(config: AiTranslateConfig) {
        this.config = config;
        this.promptBuilder = new PromptBuilder();
        this.updateClient();
    }

    /**
     * Update configuration
     */
    updateConfig(config: AiTranslateConfig): void {
        this.config = config;
        this.updateClient();
    }

    /**
     * Perform AI naming
     */
    async aiNaming(variableName: string, languageId: string): Promise<string> {
        // Get context from active editor
        const context = await this.getNamingContext(variableName, languageId);
        
        try {
            // Build prompt
            const prompt = this.promptBuilder.buildNamingPrompt(
                context.variableName,
                context.paragraph,
                context.languageId,
                this.config.namingRules,
                this.config.customNamingPrompt
            );

            // Get client
            const client = this.getClient();

            // Execute naming
            const result = await client.translate(prompt);

            // Validate result (should be a valid identifier)
            return this.validateNamingResult(result.trim());
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    /**
     * Get naming context from editor
     */
    private async getNamingContext(variableName: string, languageId: string): Promise<NamingContext> {
        const editor = window.activeTextEditor;
        
        if (!editor) {
            throw new TranslationError(
                ErrorCode.UNKNOWN_ERROR,
                undefined,
                '未找到活动编辑器'
            );
        }

        const paragraph = await this.getVariableParagraph(editor.document, editor.selection.start.line);

        return {
            variableName,
            paragraph,
            languageId
        };
    }

    /**
     * Get variable's paragraph context
     */
    private async getVariableParagraph(document: TextDocument, lineNumber: number): Promise<string> {
        const currentLine = document.lineAt(lineNumber);
        return currentLine.text.trim();
    }

    /**
     * Validate and clean naming result
     */
    private validateNamingResult(result: string): string {
        // Remove quotes if present
        result = result.replace(/^["'`]+|["'`]+$/g, '');
        
        // Remove any explanatory text (take only first line or first word)
        const lines = result.split(/\r?\n/);
        const firstLine = lines[0].trim();
        
        // If result contains spaces, take only the first word
        const words = firstLine.split(/\s+/);
        if (words.length > 1) {
            // Try to find a camelCase or snake_case identifier
            const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
            for (const word of words) {
                const cleanWord = word.replace(/[^a-zA-Z0-9_]/g, '');
                if (identifierPattern.test(cleanWord)) {
                    return cleanWord;
                }
            }
        }
        
        // Remove any non-identifier characters
        result = firstLine.replace(/[^a-zA-Z0-9_]/g, '');
        
        // Ensure it starts with a letter or underscore
        if (!/^[a-zA-Z_]/.test(result)) {
            result = '_' + result;
        }
        
        return result;
    }

    /**
     * Get or create API client
     */
    private getClient(): BaseClient {
        if (!this.client) {
            this.updateClient();
        }
        
        if (!this.client) {
            throw new TranslationError(ErrorCode.CONFIG_INVALID_MODEL);
        }
        
        return this.client;
    }

    /**
     * Update/create API client based on config
     */
    private updateClient(): void {
        const clientConfig = {
            apiKey: this.config.apiKey,
            modelName: this.config.modelName,
            apiEndpoint: this.config.apiEndpoint,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            streaming: false, // Naming doesn't need streaming
            filterThinkingContent: this.config.filterThinkingContent
        };

        switch (this.config.modelType) {
            case 'OpenAI':
                this.client = new OpenAIClient(clientConfig);
                break;
            case 'Gemini':
                this.client = new GeminiClient(clientConfig);
                break;
            default:
                throw new TranslationError(
                    ErrorCode.CONFIG_INVALID_MODEL,
                    undefined,
                    `不支持的模型类型: ${this.config.modelType}`
                );
        }
    }

    /**
     * Handle error
     */
    private handleError(error: unknown): void {
        if (error instanceof TranslationError) {
            window.showErrorMessage(`变量名翻译失败: ${error.userMessage}`);
        } else if (error instanceof Error) {
            window.showErrorMessage(`变量名翻译失败: ${error.message}`);
        } else {
            window.showErrorMessage('变量名翻译失败: 发生未知错误');
        }
    }
}
