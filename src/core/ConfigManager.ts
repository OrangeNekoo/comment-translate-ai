// src/core/ConfigManager.ts
import { workspace, Disposable, ConfigurationChangeEvent } from 'vscode';
import { AiTranslateConfig, ValidationResult, ModelType, NamingRuleType } from '../types';
import { isValidHttpUrl } from '../utils/url';

export const CONFIG_PREFIX = 'aiTranslate';

export class ConfigManager implements Disposable {
    private config: AiTranslateConfig;
    private changeListeners: Set<() => void> = new Set();
    private disposables: Disposable[] = [];

    constructor() {
        this.config = this.loadConfig();
        
        const disposable = workspace.onDidChangeConfiguration(
            (e) => this.handleConfigChange(e)
        );
        this.disposables.push(disposable);
    }

    /**
     * 获取当前配置
     */
    getConfig(): Readonly<AiTranslateConfig> {
        return Object.freeze({ ...this.config });
    }

    /**
     * 从VS Code设置刷新配置
     */
    refresh(): void {
        this.config = this.loadConfig();
        this.notifyListeners();
    }

    /**
     * 监听配置变化
     */
    onConfigChange(listener: () => void): Disposable {
        this.changeListeners.add(listener);
        return {
            dispose: () => {
                this.changeListeners.delete(listener);
            }
        };
    }

    /**
     * 验证当前配置
     */
    validate(): ValidationResult {
        const errors: string[] = [];
        const config = this.config;

        if (!config.apiKey || config.apiKey.trim() === '') {
            errors.push('API Key 未配置');
        }

        if (config.modelType !== 'OpenAI') {
            errors.push(`不支持的模型类型: ${config.modelType}`);
        }

        if (config.modelType === 'OpenAI') {
            if (config.apiEndpoint && !isValidHttpUrl(config.apiEndpoint)) {
                errors.push('API 端点 URL 格式无效');
            }

            if (config.temperature !== undefined) {
                if (config.temperature < 0 || config.temperature > 1) {
                    errors.push('Temperature 必须在 0-1 之间');
                }
            }

            if (config.maxTokens !== undefined && config.maxTokens < 1) {
                errors.push('Max Tokens 必须大于 0');
            }
        }

        const validNamingRules: NamingRuleType[] = [
            'default', 'Camel Case', 'Kernighan and Ritchie', 
            'Snake Case', 'Hungarian Notation'
        ];
        if (!validNamingRules.includes(config.namingRules)) {
            errors.push(`不支持的命名规则: ${config.namingRules}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 获取模型类型的默认模型名称
     */
    getDefaultModelName(_modelType: ModelType): string {
        return 'gpt-3.5-turbo';
    }

    /**
     * 获取模型类型的默认API端点
     */
    getDefaultApiEndpoint(_modelType: ModelType): string {
        return 'https://api.openai.com/v1';
    }

    /**
     * 从VS Code设置加载配置
     */
    private loadConfig(): AiTranslateConfig {
        const configuration = workspace.getConfiguration(CONFIG_PREFIX);
        const modelType = configuration.get<ModelType>('modelType', 'OpenAI');
        
        return {
            modelType,
            apiKey: configuration.get<string>('largeModelKey', ''),
            apiEndpoint: configuration.get<string>('largeModelApi', this.getDefaultApiEndpoint(modelType)),
            modelName: configuration.get<string>('largeModelName', this.getDefaultModelName(modelType)),
            temperature: configuration.get<number>('largeModelTemperature', 0.5),
            maxTokens: configuration.get<number>('largeModelMaxTokens', 4096),
            streaming: configuration.get<boolean>('streaming', false),
            namingRules: configuration.get<NamingRuleType>('namingRules', 'default'),
            filterThinkingContent: configuration.get<boolean>('filterThinkingContent', false),
            problemTranslateLang: configuration.get<string>('problemTranslateLang', 'none'),
            customTranslatePrompt: configuration.get<string>('customTranslatePrompt', ''),
            customNamingPrompt: configuration.get<string>('customNamingPrompt', '')
        };
    }

    /**
     * 处理配置变更事件
     */
    private handleConfigChange(event: ConfigurationChangeEvent): void {
        if (event.affectsConfiguration(CONFIG_PREFIX)) {
            this.config = this.loadConfig();
            this.notifyListeners();
        }
    }

    /**
     * 通知所有监听器配置已变更
     */
    private notifyListeners(): void {
        for (const listener of Array.from(this.changeListeners)) {
            try {
                listener();
            } catch (error) {
                console.error('配置变更监听器执行失败：', error);
            }
        }
    }

    /**
     * 释放资源
     */
    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.changeListeners.clear();
    }
}
