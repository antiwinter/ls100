const { URL } = require('url');

/**
 * Get proxy configuration from environment variables
 * Supports HTTP_PROXY, HTTPS_PROXY, and NO_PROXY
 */
function getProxyConfig() {
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;

    const config = {
        proxy: false,
        noProxy: []
    };

    // Parse NO_PROXY list
    if (noProxy) {
        config.noProxy = noProxy.split(',').map(host => host.trim());
    }

    // Configure proxy if available
    if (httpProxy || httpsProxy) {
        const proxyUrl = httpsProxy || httpProxy; // Prefer HTTPS proxy
        
        try {
            const url = new URL(proxyUrl);
            config.proxy = {
                protocol: url.protocol.replace(':', ''),
                host: url.hostname,
                port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
                auth: url.username && url.password ? {
                    username: url.username,
                    password: url.password
                } : undefined
            };
            
            console.log(`   🌐 Using proxy: ${url.protocol}//${url.hostname}:${config.proxy.port}`);
            if (config.noProxy.length > 0) {
                console.log(`   ⚪ No proxy for: ${config.noProxy.join(', ')}`);
            }
        } catch (error) {
            console.log(`   ⚠️  Invalid proxy URL: ${proxyUrl}`);
            config.proxy = false;
        }
    }

    return config;
}

/**
 * Check if a URL should bypass proxy based on NO_PROXY settings
 */
function shouldBypassProxy(url, noProxyList) {
    if (!noProxyList || noProxyList.length === 0) return false;
    
    try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname;
        
        return noProxyList.some(pattern => {
            // Exact match
            if (pattern === hostname) return true;
            
            // Wildcard match (*.example.com)
            if (pattern.startsWith('*')) {
                const domain = pattern.substring(1);
                return hostname.endsWith(domain);
            }
            
            // Domain suffix match (.example.com)
            if (pattern.startsWith('.')) {
                return hostname.endsWith(pattern);
            }
            
            return false;
        });
    } catch {
        return false;
    }
}

/**
 * Create axios config with proxy settings
 */
function createAxiosConfig(targetUrl, additionalConfig = {}) {
    const proxyConfig = getProxyConfig();
    const config = { ...additionalConfig };
    
    // Apply proxy if configured and not bypassed
    if (proxyConfig.proxy && !shouldBypassProxy(targetUrl, proxyConfig.noProxy)) {
        config.proxy = proxyConfig.proxy;
    }
    
    return config;
}

/**
 * Log proxy configuration for debugging
 */
function logProxyInfo() {
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;
    
    console.log('🌐 Proxy Configuration:');
    console.log(`   HTTP_PROXY: ${httpProxy || 'not set'}`);
    console.log(`   HTTPS_PROXY: ${httpsProxy || 'not set'}`);
    console.log(`   NO_PROXY: ${noProxy || 'not set'}`);
}

module.exports = {
    getProxyConfig,
    shouldBypassProxy,
    createAxiosConfig,
    logProxyInfo
}; 