// src/utils/debounce.ts
import { DebounceOptions } from '../types';

// 防抖函数类型
export type DebouncedFunction<T extends (...args: any[]) => any> = {
    (...args: Parameters<T>): ReturnType<T>;
    cancel(): void;
    flush(): ReturnType<T> | undefined;
};

/**
 * 创建防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    options: DebounceOptions = {}
): DebouncedFunction<T> {
    const { leading = false, trailing = true, maxWait } = options;
    
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let maxTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastArgs: Parameters<T> | undefined;
    let lastCallTime: number | undefined;
    let lastThis: any;
    let result: ReturnType<T>;

    const clearTimeouts = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
        }
        if (maxTimeoutId) {
            clearTimeout(maxTimeoutId);
            maxTimeoutId = undefined;
        }
    };

    const invokeFunc = (): ReturnType<T> => {
        const args = lastArgs!;
        const thisArg = lastThis;
        
        lastArgs = undefined;
        lastThis = undefined;
        
        result = func.apply(thisArg, args);
        return result;
    };

    const leadingEdge = (time: number): ReturnType<T> | undefined => {
        lastCallTime = time;
        timeoutId = setTimeout(timerExpired, wait);
        return leading ? invokeFunc() : result;
    };

    const remainingWait = (time: number): number => {
        const timeSinceLastCall = time - (lastCallTime || 0);
        return wait - timeSinceLastCall;
    };

    const shouldInvoke = (time: number): boolean => {
        const timeSinceLastCall = time - (lastCallTime || 0);
        return (
            lastCallTime === undefined ||
            timeSinceLastCall >= wait ||
            timeSinceLastCall < 0
        );
    };

    const timerExpired = (): void => {
        const time = Date.now();
        if (shouldInvoke(time)) {
            return trailingEdge();
        }
        timeoutId = setTimeout(timerExpired, remainingWait(time));
    };

    const trailingEdge = (): ReturnType<T> => {
        timeoutId = undefined;
        if (trailing && lastArgs) {
            return invokeFunc();
        }
        lastArgs = undefined;
        lastThis = undefined;
        return result;
    };

    const debounced = function(this: any, ...args: Parameters<T>): ReturnType<T> {
        const time = Date.now();
        const isInvoking = shouldInvoke(time);
        
        lastArgs = args;
        lastThis = this;
        lastCallTime = time;

        if (isInvoking) {
            if (!timeoutId) {
                return leadingEdge(lastCallTime);
            }
            if (maxWait) {
                maxTimeoutId = setTimeout(invokeFunc, maxWait);
            }
        }
        
        if (!timeoutId) {
            timeoutId = setTimeout(timerExpired, wait);
        }
        
        return result;
    };

    debounced.cancel = () => {
        clearTimeouts();
        lastArgs = undefined;
        lastThis = undefined;
        lastCallTime = undefined;
    };

    debounced.flush = () => {
        if (!timeoutId) {
            return result;
        }
        clearTimeouts();
        return invokeFunc();
    };

    return debounced as DebouncedFunction<T>;
}

/**
 * 创建节流函数（使用防抖实现）
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    options: DebounceOptions = {}
): DebouncedFunction<T> {
    return debounce(func, wait, {
        ...options,
        leading: true,
        trailing: false
    });
}
