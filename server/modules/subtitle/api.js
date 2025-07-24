import express from 'express'
import multer from 'multer'
import chalk from 'chalk'
import * as subtitleModel from './data.js'
import { uploadSubtitle, computeHash, getSubtitle } from './storage.js'
import { requireAuth } from '../../utils/auth-middleware.js'

const router = express.Router()

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 } // 500KB limit
})

// Upload subtitle with lightning deduplication and auto-detection
router.post('/upload', requireAuth, upload.single('subtitle'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No subtitle file provided' })
    }

    const { movie_name, language } = req.body
    const filename = req.file.originalname
    
    // Prepare metadata (language detection now handled in frontend)
    const metadata = {
      movie_name: movie_name || 'Unknown Movie',
      language: language || 'en', // Frontend should provide this
      filename: filename
    }

    // Compute hash
    const hash = computeHash(req.file.buffer)
    
    // Upload subtitle with enhanced metadata
    const enhancedMetadata = {
      ...metadata,
      filename: filename
    }
    const result = await uploadSubtitle(hash, req.file.buffer, enhancedMetadata)
    
    // Log import summary (one-line style)
    const emoji = result.lightning ? '⚡' : '➕'
    const sizeKB = (req.file.buffer.length / 1024).toFixed(1)
    const hashDigest = hash.substring(0, 6)
    const languageStr = metadata.language || 'unknown'
    
    console.log(
      `${emoji} ${chalk.green('imported')} ${metadata.movie_name} ` +
      `${chalk.yellow(`[${languageStr}], ${sizeKB}KB, ${hashDigest}`)}`
    )
    
    // Include detection suggestions in response
    result.suggestions = {
      movie_name: movie_name,
      language: {
        from_content: [metadata.language || 'en']
      }
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message })
  }
})

// Analyze file for duplicates (language detection now handled in frontend)
router.post('/analyze', requireAuth, upload.single('subtitle'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No subtitle file provided' })
    }

    const filename = req.file.originalname
    
    // Compute hash for duplicate check
    const hash = computeHash(req.file.buffer)
    const existingFiles = subtitleModel.findByOssId(hash)
    
    res.json({
      filename: filename,
      hash: hash,
      existing_files: existingFiles.length,
      existing_samples: existingFiles.slice(0, 3).map(f => ({
        movie_name: f.movie_name,
        language: f.language,
        filename: f.filename
      }))
    })
  } catch (error) {
    res.status(500).json({ message: 'Analysis failed', error: error.message })
  }
})

// Get subtitle metadata by ID
router.get('/:id', requireAuth, (req, res) => {
  try {
    const subtitle = subtitleModel.findById(req.params.id)
    if (!subtitle) {
      return res.status(404).json({ message: 'Subtitle not found' })
    }
    res.json(subtitle)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Get subtitle file content by ID
router.get('/:id/content', requireAuth, async (req, res) => {
  try {
    const subtitle = subtitleModel.findById(req.params.id)
    if (!subtitle) {
      return res.status(404).json({ message: 'Subtitle not found' })
    }

    const content = await getSubtitle(subtitle.oss_id)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(content)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Get parsed subtitle lines by ID
router.get('/:id/lines', requireAuth, async (req, res) => {
  try {
    const subtitle = subtitleModel.findById(req.params.id)
    if (!subtitle) {
      return res.status(404).json({ message: 'Subtitle not found' })
    }

    console.log(`📖 Loading subtitle lines for: ${req.params.id} (oss_id: ${subtitle.oss_id})`)
    
    const content = await getSubtitle(subtitle.oss_id)
    const { parseSrt } = await import('./storage.js')
    const { parsed } = parseSrt(content.toString('utf8'))
    
    console.log(`📄 Parsed ${parsed.length} subtitle lines`)
    
    res.json({ lines: parsed })
  } catch (error) {
    console.error('Lines endpoint error:', error)
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

export default router 