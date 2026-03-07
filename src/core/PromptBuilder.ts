// src/core/PromptBuilder.ts
import { PromptType, NamingRuleType } from '../types';

export class PromptBuilder {
    private static readonly DEFAULT_TEMPLATES: Record<PromptType, string> = {
        [PromptType.TRANSLATE]: 'Translate the following text to ${targetLang}. Only return the translated content, without any explanations or extra text.\n\nInput: "${content}"',
        
        [PromptType.NAMING]: 'Based on the programming language "${languageId}" and the code context "${paragraph}", determine if "${variableName}" is a class, method, function, or variable. Then, translate "${variableName}" into English following ${namingRule}. Return only the translated variable name, with no other text or explanation.',
        
        [PromptType.LANGUAGE_DETECTION]: 'Your task is to identify the language of the given text. You must respond with ONLY the BCP 47 language code and nothing else. For example, for "你好", respond "zh-CN". For "Hello", respond "en". Do not add any explanation or surrounding text. The text to analyze is: """${text}"""'
    };

    private static readonly NAMING_RULE_DESCRIPTIONS: Record<NamingRuleType | 'custom', string> = {
        'default': 'the standard naming conventions for "${languageId}"',
        'Camel Case': 'the Camel Case naming convention (e.g., myVariableName)',
        'Kernighan and Ritchie': 'the K&R style naming convention (e.g., my_variable)',
        'Snake Case': 'the Snake Case naming convention (e.g., my_variable_name)',
        'Hungarian Notation': 'the Hungarian Notation naming convention (e.g., strMyVariable)',
        'custom': 'the naming convention "${namingRules}"'
    };

    /**
     * Build translation prompt
     */
    buildTranslatePrompt(content: string, targetLang: string, customPrompt?: string): string {
        if (customPrompt && customPrompt.trim()) {
            if (!this.validateCustomPrompt(PromptType.TRANSLATE, customPrompt)) {
                throw new Error('翻译提示词格式错误：必须包含 ${targetLang} 和 ${content} 参数');
            }
            return this.fillTemplate(customPrompt, { targetLang, content });
        }

        return this.fillTemplate(
            PromptBuilder.DEFAULT_TEMPLATES[PromptType.TRANSLATE],
            { targetLang, content }
        );
    }

    /**
     * Build naming prompt
     */
    buildNamingPrompt(variableName: string, paragraph: string, languageId: string, namingRules: NamingRuleType = 'default', customPrompt?: string): string {
        if (customPrompt && customPrompt.trim()) {
            if (!this.validateCustomPrompt(PromptType.NAMING, customPrompt)) {
                throw new Error('命名提示词格式错误：必须包含 ${variableName}、${paragraph}、${languageId} 参数');
            }
            return this.fillTemplate(customPrompt, { variableName, paragraph, languageId, namingRules });
        }

        const namingRuleKey = namingRules === 'default' ? 'default' : 
                             (PromptBuilder.NAMING_RULE_DESCRIPTIONS[namingRules] ? namingRules : 'custom');
        
        const namingRule = this.fillTemplate(
            PromptBuilder.NAMING_RULE_DESCRIPTIONS[namingRuleKey],
            { languageId, namingRules }
        );

        return this.fillTemplate(
            PromptBuilder.DEFAULT_TEMPLATES[PromptType.NAMING],
            { languageId, paragraph, variableName, namingRule }
        );
    }

    /**
     * Build language detection prompt
     */
    buildLanguageDetectionPrompt(text: string): string {
        return this.fillTemplate(
            PromptBuilder.DEFAULT_TEMPLATES[PromptType.LANGUAGE_DETECTION],
            { text }
        );
    }

    /**
     * Validate custom prompt format
     */
    validateCustomPrompt(type: PromptType, prompt: string): boolean {
        switch (type) {
            case PromptType.TRANSLATE:
                return prompt.includes('${targetLang}') && prompt.includes('${content}');
            case PromptType.NAMING:
                return prompt.includes('${variableName}') && 
                       prompt.includes('${paragraph}') && 
                       prompt.includes('${languageId}');
            default:
                return true;
        }
    }

    /**
     * Fill template with variables
     */
    private fillTemplate(template: string, variables: Record<string, string>): string {
        return template.replace(/\$\{(\w+)\}/g, (match, key) => {
            return variables[key] !== undefined ? variables[key] : match;
        });
    }

    /**
     * Get default template
     */
    static getDefaultTemplate(type: PromptType): string {
        return PromptBuilder.DEFAULT_TEMPLATES[type];
    }
}
