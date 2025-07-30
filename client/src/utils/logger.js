import loglevel from 'loglevel'

// Set level based on environment
if (import.meta.env.DEV) {
  loglevel.setLevel('debug')
} else {
  loglevel.setLevel('warn')
}

// Export the default logger directly
export const log = loglevel

// Export the raw loglevel for edge cases
export default log 