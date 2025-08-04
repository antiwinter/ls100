// Simple console logging for deployment context
const log = {
  info: (msg, meta) => console.log(`✅ ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`, meta || ''),
  warn: (msg, meta) => console.warn(`⚠️ ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`, meta || ''),
  error: (msg, meta) => console.error(`❌ ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`, meta || '')
}

class ProxyClient {
  constructor(apiUrl = 'http://localhost:6000') {
    this.apiUrl = apiUrl
  }

  async register(domain, port, environment) {
    return new Promise((resolve, reject) => {
      const http = require('http')
      const url = require('url')
      
      const parsedUrl = url.parse(this.apiUrl)
      const postData = JSON.stringify({ domain, port: String(port), env: environment })
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 6000,
        path: '/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const result = JSON.parse(data)
            log.info('Registered with proxy', { domain, port, env: environment })
            resolve(result)
          } else {
            log.error('Proxy registration failed', { status: res.statusCode, response: data })
            reject(new Error(`Registration failed: ${res.statusCode}`))
          }
        })
      })

      req.on('error', (error) => {
        log.error('Proxy registration failed', { error: error.message, domain, port })
        reject(error)
      })

      req.write(postData)
      req.end()
    })
  }

  async unregister(domain) {
    return new Promise((resolve, reject) => {
      const http = require('http')
      const url = require('url')
      
      const parsedUrl = url.parse(this.apiUrl)
      const postData = JSON.stringify({ domain })
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 6000,
        path: '/register',
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => data += chunk)
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            log.info('Unregistered from proxy', { domain })
            resolve()
          } else {
            log.error('Proxy unregistration failed', { status: res.statusCode, response: data })
            reject(new Error(`Unregistration failed: ${res.statusCode}`))
          }
        })
      })

      req.on('error', (error) => {
        log.error('Proxy unregistration failed', { error: error.message, domain })
        reject(error)
      })

      req.write(postData)
      req.end()
    })
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

module.exports = { ProxyClient }