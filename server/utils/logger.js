import pino from 'pino'
import { AsyncLocalStorage } from 'async_hooks'

// Context storage for request-specific info (user, request ID, etc.)
export const logContext = new AsyncLocalStorage()

// Auto-detect calling file name
const getCallerFile = () => {
  const stack = (new Error()).stack
  if (!stack) return 'unknown'
  
  // Find the first stack line that's not this file or node internals
  const lines = stack.split('\n')
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('/server/') && !line.includes('logger.js')) {
      const match = line.match(/\/([^/]+\.js)/)
      if (match) return match[1]
    }
  }
  return 'unknown'
}

// Create base Pino logger
const createBaseLogger = () => {
  return pino({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:HH:MM:ss'
      }
    } : undefined
  })
}

// Create contextual logger with file and request context
const createContextualLogger = () => {
  const file = getCallerFile()
  const context = logContext.getStore() || {}
  
  const baseLogger = createBaseLogger()
  return baseLogger.child({ file, ...context })
}

// Export logger as a proxy that auto-detects context on each call
export const log = new Proxy({}, {
  get(target, prop) {
    const logger = createContextualLogger()
    return logger[prop]?.bind(logger)
  }
})

// Middleware to add request context to logs
export const loggerMiddleware = (req, res, next) => {
  const context = {
    requestId: crypto.randomUUID().slice(0, 8), // Short request ID
    method: req.method,
    path: req.path
  }
  
  // Add user info if authenticated
  if (req.user) {
    context.userId = req.user.id
    context.userName = req.user.name || req.user.email || 'unknown'
  }
  
  // Run the rest of the request in this context
  logContext.run(context, () => next())
} 