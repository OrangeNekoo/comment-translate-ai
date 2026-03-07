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
     * Get current configuration
     */
    getConfig(): Readonly<AiTranslateConfig> {
        return Object.freeze({ ...this.config });
    }

    /**
     * Refresh configuration from VS Code settings
     */
    refresh(): void {
        this.config = this.loadConfig();
        this.notifyListeners();
    }

    /**
     * Listen for configuration changes
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
     * Validate current configuration
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
     * Get default model name for model type
     */
    getDefaultModelName(_modelType: ModelType): string {
        return 'gpt-3.5-turbo';
    }

    /**
     * Get default API endpoint for model type
     */
    getDefaultApiEndpoint(_modelType: ModelType): string {
        return 'https://api.openai.com/v1';
    }

    /**
     * Load configuration from VS Code settings
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
     * Handle configuration change event
     */
    private handleConfigChange(event: ConfigurationChangeEvent): void {
        if (event.affectsConfiguration(CONFIG_PREFIX)) {
            this.config = this.loadConfig();
            this.notifyListeners();
        }
    }

    /**
     * Notify all listeners of configuration change
     */
    private notifyListeners(): void {
        for (const listener of Array.from(this.changeListeners)) {
            try {
                listener();
            } catch (error) {
                console.error('配置变更监听器执行失败:', error);
            }
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.changeListeners.clear();
    }
}
