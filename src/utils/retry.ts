// src/utils/retry.ts
import { TranslationError, ErrorCode } from '../errors/TranslationError';
import { RetryConfig } from '../types';

// 默认重试配置
const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    jitter: true
};

/**
 * 计算指数退避延迟
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
    // 指数退避：baseDelay * 2^attempt
    let delay = config.baseDelay * Math.pow(2, attempt);
    
    // 限制最大延迟
    delay = Math.min(delay, config.maxDelay);
    
    // 添加随机抖动（±25%）
    if (config.jitter) {
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        delay = delay + jitter;
    }
    
    return Math.max(0, Math.floor(delay));
}

/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 使用重试逻辑执行函数
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    operationName: string = '操作'
): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: TranslationError | undefined;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
        try {
            const result = await fn();
            return result;
        } catch (error) {
            // 转换错误
            if (error instanceof TranslationError) {
                lastError = error;
            } else {
                lastError = TranslationError.fromAxiosError(error);
            }
            
            // 如果是最后一次尝试，抛出错误
            if (attempt === retryConfig.maxRetries) {
                break;
            }
            
            // 如果错误不可重试，立即抛出
            if (!lastError.retryable) {
                throw lastError;
            }
            
            // 计算并等待延迟
            const delay = calculateBackoff(attempt, retryConfig);
            console.log(`${operationName}失败，${delay}ms后重试（${attempt + 1}/${retryConfig.maxRetries}）`);
            await sleep(delay);
        }
    }
    
    // 所有重试都失败了
    throw lastError || new TranslationError(ErrorCode.UNKNOWN_ERROR);
}

/**
 * 创建可重试的函数包装器
 */
export function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    config: Partial<RetryConfig> = {},
    operationName?: string
): T {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        return withRetry(() => fn(...args), config, operationName);
    }) as T;
}
