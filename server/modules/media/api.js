// Media API routes
import express from 'express'
import { extractMediaInfo, batchExtract } from './data.js'

const router = express.Router()

// Extract media info from filename
router.post('/extract', async (req, res) => {
  try {
    const { filename, apiKey } = req.body
    
    if (!filename) {
      return res.status(400).json({ error: 'filename required' })
    }
    
    const info = await extractMediaInfo(filename, apiKey)
    res.json(info)
  } catch (err) {
    console.error('Media extract error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Batch extract media info
router.post('/batch', async (req, res) => {
  try {
    const { filenames, apiKey } = req.body
    
    if (!Array.isArray(filenames)) {
      return res.status(400).json({ error: 'filenames array required' })
    }
    
    const results = await batchExtract(filenames, apiKey)
    res.json({ results })
  } catch (err) {
    console.error('Media batch error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'media' })
})

export default router