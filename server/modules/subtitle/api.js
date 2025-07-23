import express from 'express'
import multer from 'multer'
import * as subtitleModel from './data.js'
import { uploadSubtitle, computeHash, getSubtitle } from './storage.js'
import { detectLang } from './detect.js'
import { requireAuth } from '../../utils/auth-middleware.js'

const router = express.Router()

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
})

// Upload subtitle with lightning deduplication and auto-detection
router.post('/upload', requireAuth, upload.single('subtitle'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No subtitle file provided' })
    }

    const { movie_name, language, auto_detect = true } = req.body
    const filename = req.file.originalname

    // Movie info parsing moved to frontend
    
    // Auto-detect language from content
    const content = req.file.buffer.toString('utf8')
    const detectedLangs = detectLang(content)
    
    // Prepare metadata with auto-detection fallbacks
    const metadata = {
      movie_name: movie_name || filenameInfo.movieName || 'Unknown Movie',
      language: language || filenameInfo.language || detectedLangs[0] || 'en',
      filename: filename,
      // Store auto-detection info for user review
      auto_detected: {
        filename_parsing: filenameInfo,
        detected_langs: detectedLangs,
        used_auto_detection: !movie_name || !language
      }
    }

    // Compute hash
    const hash = computeHash(req.file.buffer)
    
    // Upload subtitle
    const result = await uploadSubtitle(hash, req.file.buffer, metadata)
    
    // Include detection suggestions in response
    result.suggestions = {
      movie_name: filenameInfo.movieName,
      language: {
        from_filename: filenameInfo.language,
        from_content: detectedLangs
      },
      year: filenameInfo.year
    }

    res.json(result)
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message })
  }
})

// Get detection suggestions for a file (without uploading)
router.post('/analyze', requireAuth, upload.single('subtitle'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No subtitle file provided' })
    }

    const filename = req.file.originalname
    const content = req.file.buffer.toString('utf8')
    
    // Detect language from content
    const detectedLangs = detectLang(content)
    
    // Compute hash for duplicate check
    const hash = computeHash(req.file.buffer)
    const existing = subtitleModel.findByHash(hash)
    
    res.json({
      filename: filename,
      hash: hash,
      existing: existing ? {
        movie_name: existing.movie_name,
        language: existing.language,
        ref_count: existing.ref_count
      } : null,
      suggestions: {
        language: {
          from_content: detectedLangs
        }
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Analysis failed', error: error.message })
  }
})

// Get subtitle metadata by hash
router.get('/:hash', requireAuth, (req, res) => {
  try {
    const subtitle = subtitleModel.findByHash(req.params.hash)
    if (!subtitle) {
      return res.status(404).json({ message: 'Subtitle not found' })
    }
    res.json(subtitle)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Get subtitle file content by hash
router.get('/:hash/content', requireAuth, async (req, res) => {
  try {
    const subtitle = subtitleModel.findByHash(req.params.hash)
    if (!subtitle) {
      return res.status(404).json({ message: 'Subtitle not found' })
    }

    const content = await getSubtitle(req.params.hash)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.send(content)
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

// Get parsed subtitle lines by hash
router.get('/:hash/lines', requireAuth, async (req, res) => {
  try {
    const subtitle = subtitleModel.findByHash(req.params.hash)
    if (!subtitle) {
      return res.status(404).json({ message: 'Subtitle not found' })
    }

    const content = await getSubtitle(req.params.hash)
    const { parseSrt } = await import('./storage.js')
    const { parsed } = parseSrt(content.toString('utf8'))
    
    res.json({ lines: parsed })
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message })
  }
})

export default router 