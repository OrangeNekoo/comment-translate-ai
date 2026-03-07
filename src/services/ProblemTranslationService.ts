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

export interface ProblemTranslationEntry {
    originalMessage: string;
    translatedMessage: string;
    language: string;
    timestamp: number;
}

export class ProblemTranslationService implements Disposable {
    private config: AiTranslateConfig;
    private translationService: TranslationService;
    private diagnosticCollection: DiagnosticCollection;
    private messageCache: Map<string, ProblemTranslationEntry> = new Map();
    private disposables: Disposable[] = [];
    private debouncedTranslate: ReturnType<typeof debounce>;

    constructor(config: AiTranslateConfig, translationService: TranslationService) {
        this.config = config;
        this.translationService = translationService;
        this.diagnosticCollection = languages.createDiagnosticCollection('ai-translator');
        
        // Debounced translation function (500ms)
        this.debouncedTranslate = debounce(
            () => this.performTranslation(),
            500,
            { leading: false, trailing: true }
        );
    }

    /**
     * Start listening for diagnostic changes
     */
    start(): void {
        // Listen for diagnostic changes
        const disposable = languages.onDidChangeDiagnostics(() => {
            this.debouncedTranslate();
        });
        this.disposables.push(disposable);
        
        // Initial translation
        this.performTranslation();
    }

    /**
     * Update configuration
     */
    updateConfig(config: AiTranslateConfig): void {
        const oldLang = this.config.problemTranslateLang;
        this.config = config;
        
        // If language changed, clear and re-translate
        if (oldLang !== config.problemTranslateLang) {
            this.messageCache.clear();
            this.diagnosticCollection.clear();
            this.performTranslation();
        }
    }

    /**
     * Perform translation of diagnostics
     */
    private async performTranslation(): Promise<void> {
        const lang = this.config.problemTranslateLang;
        
        // If translation is disabled, clear collection
        if (!lang || lang === 'none') {
            this.diagnosticCollection.clear();
            return;
        }

        const allDiagnostics = languages.getDiagnostics();
        const diagnosticsToUpdate = new Map<string, Diagnostic[]>();

        for (const [uri, diagnostics] of allDiagnostics) {
            // Filter out diagnostics from our own collection to avoid cycles
            const originalDiagnostics = diagnostics.filter(d => d.source !== 'ai-translator');

            if (originalDiagnostics.length === 0) {
                // Clear our translation for this URI if no original diagnostics
                if (this.diagnosticCollection.has(uri)) {
                    this.diagnosticCollection.delete(uri);
                }
                continue;
            }

            const translatedDiagnostics: Diagnostic[] = [];
            for (const diag of originalDiagnostics) {
                const translatedDiag = await this.translateDiagnostic(diag, lang);
                translatedDiagnostics.push(translatedDiag);
            }

            diagnosticsToUpdate.set(uri.toString(), translatedDiagnostics);
        }

        // Clear URIs that no longer have diagnostics
        this.diagnosticCollection.forEach((uri, _diags) => {
            if (!diagnosticsToUpdate.has(uri.toString())) {
                this.diagnosticCollection.delete(uri);
            }
        });

        // Update diagnostics
        for (const [uriStr, diags] of Array.from(diagnosticsToUpdate)) {
            this.diagnosticCollection.set(Uri.parse(uriStr), diags);
        }
    }

    /**
     * Translate a single diagnostic
     */
    private async translateDiagnostic(diag: Diagnostic, lang: string): Promise<Diagnostic> {
        const cacheKey = `${diag.message}__${lang}`;
        
        // Check cache
        if (this.messageCache.has(cacheKey)) {
            const entry = this.messageCache.get(cacheKey)!;
            const newDiag = new Diagnostic(diag.range, entry.translatedMessage, diag.severity);
            newDiag.source = 'ai-translator';
            newDiag.code = diag.code;
            return newDiag;
        }

        // Translate
        let translatedMsg: string;
        try {
            translatedMsg = await this.translationService.translate(
                diag.message,
                { to: lang, suppressError: true }
            );
            
            // Cache the result
            this.messageCache.set(cacheKey, {
                originalMessage: diag.message,
                translatedMessage: translatedMsg,
                language: lang,
                timestamp: Date.now()
            });
        } catch {
            translatedMsg = diag.message; // Use original if translation fails
        }

        const newDiag = new Diagnostic(diag.range, translatedMsg, diag.severity);
        newDiag.source = 'ai-translator';
        newDiag.code = diag.code;
        return newDiag;
    }

    /**
     * Clear all translations
     */
    clear(): void {
        this.diagnosticCollection.clear();
        this.messageCache.clear();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.diagnosticCollection.dispose();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.messageCache.clear();
    }
}
