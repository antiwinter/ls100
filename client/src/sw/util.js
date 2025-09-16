// Service worker logging utility using postMessage
/* eslint-disable no-console */

const createLogger = (level, consoleFn) => (...args) => {
  // Log in SW console
  consoleFn(`[${level.toUpperCase()}]`, ...args)

  // Send to main thread via postMessage
  try {
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg)
        } catch {
          return String(arg)
        }
      }
      return String(arg)
    }).join(' ')

    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'sw-log',
          level,
          message,
          timestamp: Date.now()
        })
      })
    }).catch(() => {
      // Ignore postMessage errors
    })
  } catch {
    // Ignore logging errors
  }
}

export const log = {
  info: createLogger('info', console.log),
  warn: createLogger('warn', console.warn),
  debug: createLogger('debug', console.log),
  error: createLogger('error', console.error)
}
