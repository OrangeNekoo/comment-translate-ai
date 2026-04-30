// src/services/NamingService.ts
import { window, TextEditor, TextDocument } from 'vscode';
import { AiTranslateConfig } from '../types';
import { PromptBuilder } from '../core/PromptBuilder';
import { OpenAIClient } from '../api/OpenAIClient';
import { BaseClient } from '../api/BaseClient';
import { TranslationError, ErrorCode } from '../errors/TranslationError';

// 命名上下文接口
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
     * 更新配置
     */
    updateConfig(config: AiTranslateConfig): void {
        this.config = config;
        this.updateClient();
    }

    /**
     * 执行AI命名
     */
    async aiNaming(variableName: string, languageId: string): Promise<string> {
        // 从活动编辑器获取上下文
        const context = await this.getNamingContext(variableName, languageId);
        
        try {
            // 构建提示词
            const prompt = this.promptBuilder.buildNamingPrompt(
                context.variableName,
                context.paragraph,
                context.languageId,
                this.config.namingRules,
                this.config.customNamingPrompt
            );

            // 获取客户端
            const client = this.getClient();

            // 执行命名
            const result = await client.translate(prompt);

            // 验证结果（应该是有效的标识符）
            return this.validateNamingResult(result.trim());
        } catch (error) {
            this.handleError(error);
            throw error;
        }
    }

    /**
     * 从编辑器获取命名上下文
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
     * 获取变量所在段落上下文
     */
    private async getVariableParagraph(document: TextDocument, lineNumber: number): Promise<string> {
        const currentLine = document.lineAt(lineNumber);
        return currentLine.text.trim();
    }

    /**
     * 验证并清理命名结果
     */
    private validateNamingResult(result: string): string {
        // 移除引号（如果存在）
        result = result.replace(/^["'`]+|["'`]+$/g, '');
        
        // 移除任何解释性文本（只取第一行或第一个词）
        const lines = result.split(/\r?\n/);
        const firstLine = lines[0].trim();
        
        // 如果结果包含空格，只取第一个词
        const words = firstLine.split(/\s+/);
        if (words.length > 1) {
            // 尝试查找驼峰命名或下划线命名的标识符
            const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
            for (const word of words) {
                const cleanWord = word.replace(/[^a-zA-Z0-9_]/g, '');
                if (identifierPattern.test(cleanWord)) {
                    return cleanWord;
                }
            }
        }
        
        // 移除任何非标识符字符
        result = firstLine.replace(/[^a-zA-Z0-9_]/g, '');
        
        // 确保以字母或下划线开头
        if (!/^[a-zA-Z_]/.test(result)) {
            result = '_' + result;
        }
        
        return result;
    }

    /**
     * 获取或创建API客户端
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
     * 根据配置更新/创建API客户端
     */
    private updateClient(): void {
        const clientConfig = {
            apiKey: this.config.apiKey,
            modelName: this.config.modelName,
            apiEndpoint: this.config.apiEndpoint,
            apiFormat: this.config.apiFormat,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            streaming: false, // 命名不需要流式传输
            filterThinkingContent: this.config.filterThinkingContent,
            extraRequestParams: this.config.extraRequestParams
        };

        // 仅支持OpenAI
        this.client = new OpenAIClient(clientConfig);
    }

    /**
     * 处理错误
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
