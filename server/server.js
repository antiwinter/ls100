import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import authRoutes from './modules/auth/api.js'
import shardsRoutes from './modules/shard/api.js'
import subtitleRoutes from './modules/subtitle/api.js'
import { runMigrations } from './utils/dbc.js'

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
  console.log('✅ Database initialized')
} catch (error) {
  console.error('❌ Database initialization failed:', error)
  process.exit(1)
}

// CORS only needed in development
if (isDev) {
  app.use(cors())
}

// Only parse JSON for requests with application/json content type
app.use(express.json({ 
  limit: '500KB',
  type: 'application/json'
}))
app.use(express.urlencoded({ extended: true, limit: '500KB' }))

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/shards', shardsRoutes)
app.use('/api/subtitles', subtitleRoutes)
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

// In production, serve static files from client build
if (!isDev) {
  const clientBuildPath = path.join(__dirname, '../client/dist')
  app.use(express.static(clientBuildPath))
  
  // Handle React Router (SPA)
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'))
  })
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Loaded .env from: ${path.join(__dirname, '.env')}`)
}) 