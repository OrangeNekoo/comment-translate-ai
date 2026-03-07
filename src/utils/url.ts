// src/utils/url.ts

/**
 * 标准化API端点URL
 */
export function normalizeApiUrl(endpoint: string, path: string = '/chat/completions'): string {
    if (!endpoint) {
        return '';
    }

    let url = endpoint.trim();
    
    // 修复http:/和https:/格式错误
    url = url.replace(/^http:\/(?!\/)/, 'http://');
    url = url.replace(/^https:\/(?!\/)/, 'https://');
    
    // 标准化协议和路径中的多个斜杠
    const parts = url.split('://');
    if (parts.length === 2) {
        const protocol = parts[0];
        const rest = parts[1].replace(/\/+/g, '/');
        url = `${protocol}://${rest}`;
    }
    
    // 如果URL已经包含路径，直接返回
    if (url.endsWith(path)) {
        return url;
    }
    
    // 移除末尾斜杠并添加路径
    url = url.replace(/\/$/, '');
    return `${url}${path}`;
}

/**
 * 验证URL格式
 */
export function isValidUrl(url: string): boolean {
    if (!url) {
        return false;
    }
    
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

/**
 * 验证HTTP/HTTPS URL
 */
export function isValidHttpUrl(url: string): boolean {
    if (!isValidUrl(url)) {
        return false;
    }
    
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * 从URL提取域名
 */
export function extractDomain(url: string): string | null {
    if (!isValidUrl(url)) {
        return null;
    }
    
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return null;
    }
}

/**
 * 安全地拼接URL路径
 */
export function safeUrlJoin(base: string, ...paths: string[]): string {
    if (!base) {
        return paths.join('/');
    }
    
    const normalizedBase = base.replace(/\/$/, '');
    const normalizedPaths = paths.map(p => p.replace(/^\//, '').replace(/\/$/, ''));
    
    return [normalizedBase, ...normalizedPaths].join('/');
}
