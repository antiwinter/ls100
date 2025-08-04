import { log } from '../../server/utils/logger.js'

export class ProxyClient {
  constructor(apiUrl = 'http://localhost:6000') {
    this.apiUrl = apiUrl
  }

  async register(domain, port, environment) {
    try {
      const response = await fetch(`${this.apiUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, port, environment })
      })

      if (!response.ok) {
        throw new Error('Registration failed', { status: response.status })
      }

      const result = await response.json()
      log.info('Registered with proxy', { domain, port, environment })
      return result
    } catch (error) {
      log.error('Proxy registration failed', { error: error.message, domain, port })
      throw error
    }
  }

  async unregister(domain) {
    try {
      const response = await fetch(`${this.apiUrl}/register`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      })

      if (!response.ok) {
        throw new Error('Unregistration failed', { status: response.status })
      }

      log.info('Unregistered from proxy', { domain })
    } catch (error) {
      log.error('Proxy unregistration failed', { error: error.message, domain })
    }
  }

  // Auto-register based on environment variables
  static async autoRegister() {
    const { PORT, DOMAIN, NODE_ENV, PROXY_API } = process.env
    
    if (!PORT || !DOMAIN) {
      log.warn('Missing PORT or DOMAIN environment variables, skipping proxy registration', { PORT, DOMAIN })
      return
    }

    const client = new ProxyClient(PROXY_API)
    await client.register(DOMAIN, PORT, NODE_ENV || 'development')
    
    // Register cleanup on shutdown
    const cleanup = async () => {
      await client.unregister(DOMAIN)
      process.exit(0)
    }
    
    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)
  }
}