// Centralized API configuration
const getApiBaseUrl = () => {
  // Environment variable takes precedence (works in both dev and prod)
  if (window.location.hostname.includes('vercel.app')) {
    return 'http://8.153.193.204:9666'
  }
  
  // Production: same origin (no CORS needed)
  if (import.meta.env.PROD) {
    return ''
  }
  
  // Development fallback: auto-detect from current hostname
  return `http://${window.location.hostname}:3001`
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl()
}

// Helper function to build full URLs
export const buildApiUrl = (endpoint) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`
}

// Helper for making API calls with consistent error handling
export const apiCall = async (endpoint, options = {}) => {
  const url = buildApiUrl(endpoint)
  const token = localStorage.getItem('token')
  
  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  }
  
  // Don't set Content-Type for FormData (browser sets multipart automatically)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  
  const config = {
    cache: options.cache || 'no-store',
    ...options,
    headers
  }
  
  let response = await fetch(url, config)
  
  // Safari/iOS may return 304 for API GETs due to ETag; refetch with cache-buster
  const method = (options.method || 'GET').toUpperCase()
  if (response.status === 304 && method === 'GET') {
    const ts = Date.now()
    const sep = url.includes('?') ? '&' : '?'
    const bustUrl = `${url}${sep}_ts=${ts}`
    response = await fetch(bustUrl, { ...config, cache: 'no-store' })
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || 'Request failed')
  }
  
  return response.json()
} 