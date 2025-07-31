import express from 'express'
import multer from 'multer'
import chalk from 'chalk'
import * as subtitleModel from './data.js'
import { uploadSubtitle, computeHash, getSubtitle } from './storage.js'
import { requireAuth } from '../../utils/auth-middleware.js'
import { log } from '../../utils/logger.js'

const router = express.Router()

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 } // 500KB limit
})

// Upload subtitle with lightning deduplication and auto-detection
router.post('/upload', requireAuth, upload.single('subtitle'), async (req, res) => {
  log.debug({ 
    hasFile: !!req.file,
    filename: req.file?.originalname,
    fileSize: req.file?.size,
    body: req.body
  }, 'Subtitle upload request')
  
  try {
    if (!req.file) {
      log.warn('No file provided in upload request')
      return res.status(400).json({ message: 'No subtitle file provided' })
    }

    const { movie_name, language } = req.body
    const filename = req.file.originalname
    
    log.debug({
      filename,
      movie_name,
      language,
      fileSize: req.file.size
    }, 'Processing subtitle upload')
    
    // Prepare metadata (language detection now handled in frontend)
    const metadata = {
      movie_name: movie_name || 'Unknown Movie',
      language: language || 'en', // Frontend should provide this
      filename: filename
    }
    
    log.debug({ metadata }, 'Prepared subtitle metadata')

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
    
    log.info({
      movieName: metadata.movie_name,
      language: languageStr,
      sizeKB: parseFloat(sizeKB),
      hash: hashDigest,
      lightning: result.lightning
    }, `Subtitle imported: ${metadata.movie_name}`)
    
    // Include detection suggestions in response
    result.suggestions = {
      movie_name: movie_name,
      language: {
        from_content: [metadata.language || 'en']
      }
    }

    log.debug({
      subtitle_id: result.subtitle_id,
      lightning: result.lightning,
      hash: hash.substring(0, 8)
    }, 'Subtitle upload successful')
    
    res.json(result)
  } catch (error) {
    log.error({
      error,
      filename: req.file?.originalname,
      body: req.body
    }, 'Subtitle upload failed')
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

// Get parsed subtitle lines by ID with line-based pagination support
router.get('/:id/lines', requireAuth, async (req, res) => {
  try {
    const subtitle = subtitleModel.findById(req.params.id)
    if (!subtitle) {
      return res.status(404).json({ message: 'Subtitle not found' })
    }

    // Parse line-based pagination params
    const start = Math.max(parseInt(req.query.start) || 0, 0)
    const requestedCount = parseInt(req.query.count) || 200
    const count = requestedCount === -1 ? -1 : Math.min(requestedCount, 200) // count=-1 means all lines

    log.debug({ 
      subtitleId: req.params.id, 
      ossId: subtitle.oss_id,
      start,
      count 
    }, 'Loading subtitle lines')
    
    const content = await getSubtitle(subtitle.oss_id)
    const { parseSrt } = await import('./storage.js')
    const { parsed } = parseSrt(content.toString('utf8'))
    
    // Apply line-based pagination
    const total = parsed.length
    const endIndex = count === -1 ? total : Math.min(start + count, total)
    const lines = parsed.slice(start, endIndex)
    
    log.debug({ 
      total,
      returned: lines.length,
      start,
      count,
      endIndex
    }, 'Parsed subtitle lines with line-based pagination')
    
    res.json({ 
      lines,
      total,
      start,
      count: lines.length,
      hasMore: endIndex < total
    })
  } catch (error) {
    log.error({ error, subtitleId: req.params.id }, 'Failed to load subtitle lines')
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

export default router 