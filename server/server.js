import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import authRoutes from './modules/auth/api.js'
import shardsRoutes from './modules/shard/api.js'
import subtitleRoutes from './modules/subtitle/api.js'
import subtitleWordsRoutes from './shards/subtitle/words-api.js'
import { runMigrations } from './utils/dbc.js'
import { log, loggerMiddleware } from './utils/logger.js'
import { httpLogger } from './utils/httpLogger.js'
import { ProxyClient } from '../infra/deploy/proxy-client.js'
import packageJson from './package.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
const port = process.env.PORT || 3001
const isDev = process.env.NODE_ENV !== 'production'

// Initialize database
try {
  runMigrations()
  log.info('Database initialized')
} catch (error) {
  log.error({ error }, 'Database initialization failed')
  process.exit(1)
}

// CORS only needed in development
if (isDev) {
  app.use(cors())
}

// HTTP request logging
app.use(httpLogger)

// Only parse JSON for requests with application/json content type
app.use(express.json({ 
  limit: '500KB',
  type: 'application/json'
}))
app.use(express.urlencoded({ extended: true, limit: '500KB' }))

// Add request context for logs (must be after body parsing for auth to work)
app.use(loggerMiddleware)

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/shards', shardsRoutes)
app.use('/api/subtitles', subtitleRoutes)
app.use('/api/subtitle-shards', subtitleWordsRoutes)
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello from backend!',
    timestamp: new Date().toISOString(),
    server: 'Express.js',
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3001
  })
})

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'Server is running!',
    env: process.env.NODE_ENV || 'development',
    hasSecret: !!process.env.API_SECRET
  })
})

app.get('/api/version', (req, res) => {
  res.json({
    version: packageJson.version,
    name: packageJson.name,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  })
})

// In production, serve static files from client build
if (!isDev) {
  const clientBuildPath = path.join(__dirname, '../client/dist')
  app.use(express.static(clientBuildPath))
  
  // Handle React Router (SPA)
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'))
  })
}

app.listen(port, '0.0.0.0', async () => {
  log.info({ port, environment: process.env.NODE_ENV || 'development' }, 'Server started')
  log.debug({ envFile: path.join(__dirname, '.env') }, 'Environment configuration loaded')
  
  // Register with proxy in production/staging environments
  if (process.env.NODE_ENV !== 'development') {
    try {
      await ProxyClient.autoRegister()
    } catch (error) {
      log.warn({ error: error.message }, 'Failed to register with proxy, continuing without reverse proxy')
    }
  }
}) 