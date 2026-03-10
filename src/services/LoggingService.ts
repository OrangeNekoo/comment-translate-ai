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
        const argsStr = args.length > 0 ? args.map(a => JSON.stringify(a)).join(' ') : '';
        const fullMessage = `[${timestamp}] [${level}] ${message} ${argsStr}`.trim();
        this.outputChannel.appendLine(fullMessage);
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}
