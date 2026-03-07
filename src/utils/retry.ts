// src/utils/retry.ts
import { TranslationError, ErrorCode } from '../errors/TranslationError';
import { RetryConfig } from '../types';

const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    jitter: true
};

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * 2^attempt
    let delay = config.baseDelay * Math.pow(2, attempt);
    
    // Cap at maxDelay
    delay = Math.min(delay, config.maxDelay);
    
    // Add random jitter (±25%)
    if (config.jitter) {
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        delay = delay + jitter;
    }
    
    return Math.max(0, Math.floor(delay));
}

/**
 * Sleep function
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retry logic
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
            // Convert error
            if (error instanceof TranslationError) {
                lastError = error;
            } else {
                lastError = TranslationError.fromAxiosError(error);
            }
            
            // If this is the last attempt, throw the error
            if (attempt === retryConfig.maxRetries) {
                break;
            }
            
            // If error is not retryable, throw immediately
            if (!lastError.retryable) {
                throw lastError;
            }
            
            // Calculate and wait for delay
            const delay = calculateBackoff(attempt, retryConfig);
            console.log(`${operationName} failed, retrying in ${delay}ms (${attempt + 1}/${retryConfig.maxRetries})`);
            await sleep(delay);
        }
    }
    
    // All retries failed
    throw lastError || new TranslationError(ErrorCode.UNKNOWN_ERROR);
}

/**
 * Create a retryable function wrapper
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
