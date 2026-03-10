// src/services/ProblemTranslationService.ts
import {
    languages,
    Diagnostic,
    DiagnosticCollection,
    Uri,
    Disposable
} from 'vscode';
import { AiTranslateConfig } from '../types';
import { TranslationService } from './TranslationService';
import { debounce } from '../utils/debounce';

// 问题翻译条目接口
export interface ProblemTranslationEntry {
    originalMessage: string;
    translatedMessage: string;
    language: string;
    timestamp: number;
}

// 问题翻译服务类
export class ProblemTranslationService implements Disposable {
    private config: AiTranslateConfig;
    private translationService: TranslationService;
    private diagnosticCollection: DiagnosticCollection;
    private messageCache: Map<string, ProblemTranslationEntry> = new Map();
    private disposables: Disposable[] = [];
    private debouncedTranslate: ReturnType<typeof debounce>;
    // 记录原始诊断的签名，用于判断诊断是否是新的
    private originalDiagnosticSignatures: Set<string> = new Set();

    constructor(config: AiTranslateConfig, translationService: TranslationService) {
        this.config = config;
        this.translationService = translationService;
        this.diagnosticCollection = languages.createDiagnosticCollection('ai-translator');

        // 防抖翻译函数（500ms）
        this.debouncedTranslate = debounce(
            () => this.performTranslation(),
            500,
            { leading: false, trailing: true }
        );
    }

    /**
     * 开始监听诊断信息变化
     */
    start(): void {
        // 监听诊断信息变化
        const disposable = languages.onDidChangeDiagnostics(() => {
            this.debouncedTranslate();
        });
        this.disposables.push(disposable);

        // 执行初始翻译
        this.performTranslation();
    }

    /**
     * 更新配置
     */
    updateConfig(config: AiTranslateConfig): void {
        const oldLang = this.config.problemTranslateLang;
        this.config = config;

        // 如果语言发生变化，清空缓存并重新翻译
        if (oldLang !== config.problemTranslateLang) {
            this.messageCache.clear();
            this.originalDiagnosticSignatures.clear();
            this.diagnosticCollection.clear();
            this.performTranslation();
        }
    }

    /**
     * 执行诊断信息翻译
     */
    private async performTranslation(): Promise<void> {
        const lang = this.config.problemTranslateLang;

        // 如果翻译被禁用，清空集合
        if (!lang || lang === 'none') {
            this.diagnosticCollection.clear();
            this.originalDiagnosticSignatures.clear();
            return;
        }

        const allDiagnostics = languages.getDiagnostics();
        const currentOriginalSignatures = new Set<string>();
        const diagnosticsToUpdate = new Map<string, Diagnostic[]>();

        for (const [uri, diagnostics] of allDiagnostics) {
            const uriStr = uri.toString();

            // 过滤掉来自我们自己集合的诊断信息，避免循环处理
            const originalDiagnostics = diagnostics.filter(d => d.source !== 'ai-translator');

            if (originalDiagnostics.length === 0) {
                // 如果该 URI 没有原始诊断，清除我们之前设置的翻译诊断
                this.diagnosticCollection.delete(uri);
                continue;
            }

            const translatedDiagnostics: Diagnostic[] = [];
            for (let i = 0; i < originalDiagnostics.length; i++) {
                const diag = originalDiagnostics[i];
                // 创建诊断签名（用于判断是否是同一个诊断）
                const signature = `${uriStr}:${i}:${diag.severity}:${diag.range.start.line}:${diag.range.start.character}:${diag.message}`;
                currentOriginalSignatures.add(signature);

                const translatedDiag = await this.translateDiagnostic(diag, lang, signature);
                translatedDiagnostics.push(translatedDiag);
            }

            diagnosticsToUpdate.set(uriStr, translatedDiagnostics);
        }

        // 清理过期的签名（只保留当前存在的原始诊断）
        this.originalDiagnosticSignatures = currentOriginalSignatures;

        // 更新诊断信息：先清空所有，然后重新设置
        this.diagnosticCollection.clear();

        for (const [uriStr, diags] of Array.from(diagnosticsToUpdate)) {
            const uri = Uri.parse(uriStr);
            this.diagnosticCollection.set(uri, diags);
        }
    }

    /**
     * 翻译单个诊断信息
     */
    private async translateDiagnostic(diag: Diagnostic, lang: string, signature: string): Promise<Diagnostic> {
        // 快速路径：如果目标语言是日语，且消息中包含日语字符，跳过翻译
        if (lang === 'ja' && this.containsJapaneseCharacters(diag.message)) {
            const newDiag = new Diagnostic(diag.range, diag.message, diag.severity);
            newDiag.source = 'ai-translator';
            newDiag.code = diag.code;
            return newDiag;
        }

        // 快速路径：如果目标语言是中文，且消息中包含中文字符，跳过翻译
        if ((lang === 'zh-CN' || lang === 'zh-TW' || lang === 'zh') && this.containsChineseCharacters(diag.message)) {
            const newDiag = new Diagnostic(diag.range, diag.message, diag.severity);
            newDiag.source = 'ai-translator';
            newDiag.code = diag.code;
            return newDiag;
        }

        // 快速路径：如果目标语言是英语，且消息主要是英语字符，跳过翻译
        if (lang.startsWith('en') && this.isPrimarilyEnglish(diag.message)) {
            const newDiag = new Diagnostic(diag.range, diag.message, diag.severity);
            newDiag.source = 'ai-translator';
            newDiag.code = diag.code;
            return newDiag;
        }

        const cacheKey = `${diag.message}__${lang}`;

        // 检查缓存
        if (this.messageCache.has(cacheKey)) {
            const entry = this.messageCache.get(cacheKey)!;
            const newDiag = new Diagnostic(diag.range, entry.translatedMessage, diag.severity);
            newDiag.source = 'ai-translator';
            newDiag.code = diag.code;
            return newDiag;
        }

        // 检测诊断信息的语言
        const detectedLang = await this.detectLanguage(diag.message);

        // 如果检测到的语言与目标语言相同，则返回原始诊断信息（不翻译）
        if (this.isSameLanguage(detectedLang, lang)) {
            const newDiag = new Diagnostic(diag.range, diag.message, diag.severity);
            newDiag.source = 'ai-translator';
            newDiag.code = diag.code;
            return newDiag;
        }

        // 执行翻译
        let translatedMsg: string;
        try {
            translatedMsg = await this.translationService.translate(
                diag.message,
                { to: lang, suppressError: true }
            );

            // 缓存结果
            this.messageCache.set(cacheKey, {
                originalMessage: diag.message,
                translatedMessage: translatedMsg,
                language: lang,
                timestamp: Date.now()
            });
        } catch {
            translatedMsg = diag.message; // 如果翻译失败，使用原始消息
        }

        const newDiag = new Diagnostic(diag.range, translatedMsg, diag.severity);
        newDiag.source = 'ai-translator';
        newDiag.code = diag.code;
        return newDiag;
    }

    /**
     * 检查字符串是否包含日语字符
     */
    private containsJapaneseCharacters(text: string): boolean {
        // 日语平假名、片假名范围
        const hiraganaRange = /[\u3040-\u309F]/;
        const katakanaRange = /[\u30A0-\u30FF]/;
        return hiraganaRange.test(text) || katakanaRange.test(text);
    }

    /**
     * 检查字符串是否包含中文字符
     */
    private containsChineseCharacters(text: string): boolean {
        // 中日韩统一表意文字范围
        const cjkRange = /[\u4E00-\u9FFF]/;
        return cjkRange.test(text);
    }

    /**
     * 检查字符串是否主要是英语字符
     */
    private isPrimarilyEnglish(text: string): boolean {
        // 移除所有 ASCII 字符（包括标点符号）
        const nonAscii = text.replace(/[\x00-\x7F]/g, '');
        // 如果非 ASCII 字符少于 20%，认为是英语
        return nonAscii.length / text.length < 0.2;
    }

    /**
     * 检测文本语言
     */
    private async detectLanguage(text: string): Promise<string> {
        try {
            // 使用翻译服务检测语言
            return await this.translationService.detectLanguage(text);
        } catch {
            return 'unknown';
        }
    }

    /**
     * 判断两种语言是否相同
     */
    private isSameLanguage(lang1: string, lang2: string): boolean {
        // 标准化语言代码
        const normalizeLang = (lang: string): string => {
            return lang.toLowerCase().replace(/[_-]/g, '');
        };

        const normalizedLang1 = normalizeLang(lang1);
        const normalizedLang2 = normalizeLang(lang2);

        // 直接匹配
        if (normalizedLang1 === normalizedLang2) {
            return true;
        }

        // 处理中文变体（zh, zh-cn, zh-tw 等）
        const isChinese1 = normalizedLang1.startsWith('zh');
        const isChinese2 = normalizedLang2.startsWith('zh');

        if (isChinese1 && isChinese2) {
            // 如果都是中文，检查具体变体
            const isSimplified1 = normalizedLang1 === 'zh' || normalizedLang1 === 'zhcn';
            const isSimplified2 = normalizedLang2 === 'zh' || normalizedLang2 === 'zhcn';
            const isTraditional1 = normalizedLang1 === 'zhtw' || normalizedLang1 === 'zhhk';
            const isTraditional2 = normalizedLang2 === 'zhtw' || normalizedLang2 === 'zhhk';

            // 同为简体中文或同为繁体中文
            if ((isSimplified1 && isSimplified2) || (isTraditional1 && isTraditional2)) {
                return true;
            }
        }

        // 处理英语变体（en, en-us, en-gb 等）
        const isEnglish1 = normalizedLang1.startsWith('en');
        const isEnglish2 = normalizedLang2.startsWith('en');

        if (isEnglish1 && isEnglish2) {
            return true;
        }

        return false;
    }

    /**
     * 清除所有翻译
     */
    clear(): void {
        this.diagnosticCollection.clear();
        this.messageCache.clear();
        this.originalDiagnosticSignatures.clear();
    }

    /**
     * 释放资源
     */
    dispose(): void {
        this.diagnosticCollection.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.messageCache.clear();
        this.originalDiagnosticSignatures.clear();
    }
}
