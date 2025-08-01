// Single source of truth for app metadata (runtime)
// Note: PWA manifest values are duplicated in vite.config.js for build-time

export const APP_CONFIG = {
  // Core Identity
  name: {
    full: 'LS100 - Learn English with Movies',
    short: 'LS100',
    slug: 'ls100'
  },
  
  // Descriptions
  description: {
    short: 'Interactive English learning using movie subtitles',
    long: 'Learn English naturally by watching movies with interactive subtitles, vocabulary building, and spaced repetition.',
    tagline: 'Learn English with movie subtitles'
  },
  

  
  // Technical
  version: '1.0.0',
  build: typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_BUILD_ID || 'dev') : 'dev',
  environment: typeof import.meta !== 'undefined' ? (import.meta.env?.MODE || 'development') : 'development',
  
  // URLs & Domains
  urls: {
    app: typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_APP_URL || 'http://localhost:5173') : 'http://localhost:5173',
    api: typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_API_URL || 'http://localhost:3001') : 'http://localhost:3001',
    support: 'mailto:support@ls100.app',
    github: 'https://github.com/yourusername/ls100'
  },
  
  // Feature Flags
  features: {
    pwa: true,
    offline: true,
    social: false,
    discovery: false,
    analytics: false
  },
  
  // Storage Keys
  storage: {
    auth: 'ls100-auth',
    theme: 'ls100-mode',
    colorScheme: 'ls100-color-scheme',
    sortPreference: 'ls100-shard-sort',
    userPreferences: 'ls100-prefs'
  },
  
  // Learning Content
  content: {
    supportedFormats: ['srt', 'vtt', 'ass', 'ssa', 'sub'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    languages: {
      ui: ['en'],
      content: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh']
    }
  }
}

// Helper functions for common use cases
export const getAppTitle = (pageTitle = '') => {
  return pageTitle 
    ? `${pageTitle} | ${APP_CONFIG.name.short}`
    : APP_CONFIG.name.full
}

export const getStorageKey = (key) => {
  return APP_CONFIG.storage[key] || `${APP_CONFIG.name.slug}-${key}`
}

export const isDevelopment = () => APP_CONFIG.environment === 'development'
export const isProduction = () => APP_CONFIG.environment === 'production'

// Default export for convenience
export default APP_CONFIG