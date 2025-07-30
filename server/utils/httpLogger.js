import morgan from 'morgan'

// Add custom tokens for user information
morgan.token('user-id', (req) => {
  return req.user ? req.user.id : 'anonymous'
})

morgan.token('user-name', (req) => {
  if (!req.user) return 'anonymous'
  return req.user.name || req.user.email || 'unknown'
})

morgan.token('user-info', (req) => {
  if (!req.user) return 'anonymous'
  const name = req.user.name || req.user.email || 'unknown'
  return `${name}(${req.user.id})`
})

// Different formats for different environments
const developmentFormat = ':method :url :status :user-info :response-time ms'
const productionFormat = ':remote-addr - :user-info [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms'

// Export configured morgan middleware
export const httpLogger = process.env.NODE_ENV === 'development' 
  ? morgan(developmentFormat)
  : morgan(productionFormat)

// Export individual components for custom usage
export { morgan }
export const formats = {
  dev: developmentFormat,
  prod: productionFormat
} 