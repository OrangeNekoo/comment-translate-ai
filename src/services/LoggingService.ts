import { window, OutputChannel, Disposable } from 'vscode';

export enum LogLevel {
    Error = 0,
    Warn = 1,
    Info = 2,
    Debug = 3
}

export class LoggingService implements Disposable {
    private outputChannel: OutputChannel;
    private logLevel: LogLevel;

    constructor(logLevel: LogLevel = LogLevel.Info) {
        this.logLevel = logLevel;
        this.outputChannel = window.createOutputChannel('Comment Translate AI');
    }

    error(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.Error) {
            this.log('ERROR', message, args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.Warn) {
            this.log('WARN', message, args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.Info) {
            this.log('INFO', message, args);
        }
    }

    debug(message: string, ...args: unknown[]): void {
        if (this.logLevel >= LogLevel.Debug) {
            this.log('DEBUG', message, args);
        }
    }

    private log(level: string, message: string, args: unknown[]): void {
        const timestamp = new Date().toISOString();
        // 替换占位符 %d, %s, %o 等
        let formattedMessage = message;
        if (args.length > 0) {
            let argIndex = 0;
            formattedMessage = message.replace(/%[dssoj]/g, (match) => {
                if (argIndex >= args.length) {
                    return match;
                }
                const arg = args[argIndex++];
                switch (match) {
                    case '%d':
                        return String(typeof arg === 'number' ? arg : JSON.stringify(arg));
                    case '%s':
                        return String(arg);
                    case '%o':
                    case '%j':
                        return JSON.stringify(arg);
                    default:
                        return String(arg);
                }
            });
        }
        const fullMessage = `[${timestamp}] [${level}] ${formattedMessage}`.trim();
        this.outputChannel.appendLine(fullMessage);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
