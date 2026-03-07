// src/utils/url.ts

/**
 * Normalize API endpoint URL
 */
export function normalizeApiUrl(endpoint: string, path: string = '/chat/completions'): string {
    if (!endpoint) {
        return '';
    }

    let url = endpoint.trim();
    
    // Fix http:/ and https:/ format errors
    url = url.replace(/^http:\/(?!\/)/, 'http://');
    url = url.replace(/^https:\/(?!\/)/, 'https://');
    
    // Normalize multiple slashes in protocol and path
    const parts = url.split('://');
    if (parts.length === 2) {
        const protocol = parts[0];
        const rest = parts[1].replace(/\/+/g, '/');
        url = `${protocol}://${rest}`;
    }
    
    // If URL already contains the path, return as is
    if (url.endsWith(path)) {
        return url;
    }
    
    // Remove trailing slash and add path
    url = url.replace(/\/$/, '');
    return `${url}${path}`;
}

/**
 * Validate URL format
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
 * Validate HTTP/HTTPS URL
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
 * Extract domain from URL
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
 * Safely join URL parts
 */
export function safeUrlJoin(base: string, ...paths: string[]): string {
    if (!base) {
        return paths.join('/');
    }
    
    const normalizedBase = base.replace(/\/$/, '');
    const normalizedPaths = paths.map(p => p.replace(/^\//, '').replace(/\/$/, ''));
    
    return [normalizedBase, ...normalizedPaths].join('/');
}
