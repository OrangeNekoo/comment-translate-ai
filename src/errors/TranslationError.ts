// src/errors/TranslationError.ts

// 错误代码枚举
export enum ErrorCode {
    CONFIG_MISSING_API_KEY = 'CONFIG_MISSING_API_KEY',
    CONFIG_INVALID_ENDPOINT = 'CONFIG_INVALID_ENDPOINT',
    CONFIG_INVALID_MODEL = 'CONFIG_INVALID_MODEL',
    NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
    NETWORK_OFFLINE = 'NETWORK_OFFLINE',
    NETWORK_DNS_ERROR = 'NETWORK_DNS_ERROR',
    API_RATE_LIMIT = 'API_RATE_LIMIT',
    API_INVALID_RESPONSE = 'API_INVALID_RESPONSE',
    API_AUTHENTICATION = 'API_AUTHENTICATION',
    API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
    CACHE_ERROR = 'CACHE_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误详情接口
export interface ErrorDetails {
    code: ErrorCode;
    retryable: boolean;
    userMessage: string;
}

// 错误代码映射表
export const ErrorCodeMap: Record<ErrorCode, ErrorDetails> = {
    [ErrorCode.CONFIG_MISSING_API_KEY]: {
        code: ErrorCode.CONFIG_MISSING_API_KEY,
        retryable: false,
        userMessage: '请配置 API Key'
    },
    [ErrorCode.CONFIG_INVALID_ENDPOINT]: {
        code: ErrorCode.CONFIG_INVALID_ENDPOINT,
        retryable: false,
        userMessage: 'API 端点配置无效'
    },
    [ErrorCode.CONFIG_INVALID_MODEL]: {
        code: ErrorCode.CONFIG_INVALID_MODEL,
        retryable: false,
        userMessage: '模型配置无效'
    },
    [ErrorCode.NETWORK_TIMEOUT]: {
        code: ErrorCode.NETWORK_TIMEOUT,
        retryable: true,
        userMessage: '网络超时，正在重试...'
    },
    [ErrorCode.NETWORK_OFFLINE]: {
        code: ErrorCode.NETWORK_OFFLINE,
        retryable: true,
        userMessage: '网络连接失败，正在重试...'
    },
    [ErrorCode.NETWORK_DNS_ERROR]: {
        code: ErrorCode.NETWORK_DNS_ERROR,
        retryable: true,
        userMessage: 'DNS解析失败，正在重试...'
    },
    [ErrorCode.API_RATE_LIMIT]: {
        code: ErrorCode.API_RATE_LIMIT,
        retryable: true,
        userMessage: '请求过于频繁，请稍后再试'
    },
    [ErrorCode.API_INVALID_RESPONSE]: {
        code: ErrorCode.API_INVALID_RESPONSE,
        retryable: false,
        userMessage: 'API返回格式异常'
    },
    [ErrorCode.API_AUTHENTICATION]: {
        code: ErrorCode.API_AUTHENTICATION,
        retryable: false,
        userMessage: 'API认证失败，请检查API Key'
    },
    [ErrorCode.API_QUOTA_EXCEEDED]: {
        code: ErrorCode.API_QUOTA_EXCEEDED,
        retryable: false,
        userMessage: 'API配额已用完'
    },
    [ErrorCode.CACHE_ERROR]: {
        code: ErrorCode.CACHE_ERROR,
        retryable: false,
        userMessage: '缓存操作失败'
    },
    [ErrorCode.UNKNOWN_ERROR]: {
        code: ErrorCode.UNKNOWN_ERROR,
        retryable: false,
        userMessage: '发生未知错误'
    }
};

// 翻译错误类
export class TranslationError extends Error {
    public readonly code: ErrorCode;
    public readonly retryable: boolean;
    public readonly userMessage: string;
    public readonly originalError?: Error;
    public readonly timestamp: number;

    constructor(
        code: ErrorCode,
        originalError?: Error,
        customMessage?: string
    ) {
        const details = ErrorCodeMap[code];
        const message = customMessage || details.userMessage;
        
        super(message);
        this.name = 'TranslationError';
        this.code = code;
        this.retryable = details.retryable;
        this.userMessage = message;
        this.originalError = originalError;
        this.timestamp = Date.now();

        // 修复原型链，以便instanceof检查正常工作
        Object.setPrototypeOf(this, TranslationError.prototype);
    }

    // 从Axios错误创建翻译错误
    static fromAxiosError(error: any): TranslationError {
        if (!error) {
            return new TranslationError(ErrorCode.UNKNOWN_ERROR);
        }

        // 网络错误
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return new TranslationError(ErrorCode.NETWORK_TIMEOUT, error);
        }
        if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            return new TranslationError(ErrorCode.NETWORK_DNS_ERROR, error);
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            return new TranslationError(ErrorCode.NETWORK_OFFLINE, error);
        }

        // HTTP错误
        const status = error.response?.status;
        if (status === 401) {
            return new TranslationError(ErrorCode.API_AUTHENTICATION, error);
        }
        if (status === 429) {
            return new TranslationError(ErrorCode.API_RATE_LIMIT, error);
        }
        if (status === 402 || status === 403) {
            return new TranslationError(ErrorCode.API_QUOTA_EXCEEDED, error);
        }

        // API响应错误
        if (error.response?.data?.error) {
            return new TranslationError(
                ErrorCode.API_INVALID_RESPONSE,
                error,
                error.response.data.error.message || 'API返回错误'
            );
        }

        return new TranslationError(ErrorCode.UNKNOWN_ERROR, error);
    }

    // 转换为JSON对象
    toJSON(): object {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            userMessage: this.userMessage,
            retryable: this.retryable,
            timestamp: this.timestamp,
            originalError: this.originalError?.message
        };
    }
}
