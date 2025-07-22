import express from 'express'
import multer from 'multer'
import jwt from 'jsonwebtoken'
import * as shardModel from '../db/models/shard.js'
import { uploadSubtitle, computeHash } from '../utils/subtitle-storage.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
})

// Auth middleware
const requireAuth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }
    
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// GET /api/shards - Get user's shards or public shards
router.get('/', requireAuth, async (req, res) => {
  try {
    const { type = 'user' } = req.query
    
    let shards
    if (type === 'public') {
      shards = shardModel.findPublic()
    } else {
      shards = shardModel.findByOwner(req.userId)
    }
    
    res.json({ shards })
  } catch (error) {
    console.error('Get shards error:', error)
    res.status(500).json({ error: 'Failed to get shards' })
  }
})

// GET /api/shards/:id - Get specific shard
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const shard = shardModel.findById(req.params.id)
    
    if (!shard) {
      return res.status(404).json({ error: 'Shard not found' })
    }
    
    // Check if user can access this shard
    if (!shard.public && shard.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    // Get linked subtitles
    const subtitles = shardModel.getSubtitles(shard.id)
    
    res.json({ 
      shard: {
        ...shard,
        metadata: JSON.parse(shard.metadata),
        subtitles
      }
    })
  } catch (error) {
    console.error('Get shard error:', error)
    res.status(500).json({ error: 'Failed to get shard' })
  }
})

// POST /api/shards - Create new shard
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, cover, metadata, subtitles, public: isPublic } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Shard name is required' })
    }
    
    const shard = shardModel.create({
      name,
      description,
      cover,
      metadata,
      public: isPublic || false,
      owner_id: req.userId
    })
    
    // Link subtitles if provided
    if (subtitles && subtitles.length > 0) {
      subtitles.forEach(subtitleId => {
        shardModel.linkSubtitle(shard.id, subtitleId)
      })
    }
    
    res.json({ 
      shard: {
        ...shard,
        metadata: JSON.parse(shard.metadata)
      }
    })
  } catch (error) {
    console.error('Create shard error:', error)
    res.status(500).json({ error: 'Failed to create shard' })
  }
})

// PUT /api/shards/:id - Update shard
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const shard = shardModel.findById(req.params.id)
    
    if (!shard) {
      return res.status(404).json({ error: 'Shard not found' })
    }
    
    if (shard.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    const { name, description, cover, metadata, public: isPublic } = req.body
    const updates = {}
    
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (cover !== undefined) updates.cover = cover
    if (metadata !== undefined) updates.metadata = metadata
    if (isPublic !== undefined) updates.public = isPublic
    
    shardModel.update(req.params.id, updates)
    const updated = shardModel.findById(req.params.id)
    
    res.json({ 
      shard: {
        ...updated,
        metadata: JSON.parse(updated.metadata)
      }
    })
  } catch (error) {
    console.error('Update shard error:', error)
    res.status(500).json({ error: 'Failed to update shard' })
  }
})

// DELETE /api/shards/:id - Delete shard
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const shard = shardModel.findById(req.params.id)
    
    if (!shard) {
      return res.status(404).json({ error: 'Shard not found' })
    }
    
    if (shard.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    shardModel.remove(req.params.id)
    res.json({ message: 'Shard deleted successfully' })
  } catch (error) {
    console.error('Delete shard error:', error)
    res.status(500).json({ error: 'Failed to delete shard' })
  }
})

// POST /api/shards/subtitle/upload - Upload subtitle with lightning upload
router.post('/subtitle/upload', requireAuth, upload.single('subtitle'), async (req, res) => {
  try {
    const { hash, movie_name, language } = req.body
    
    if (!hash) {
      return res.status(400).json({ error: 'Hash is required' })
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Subtitle file is required' })
    }
    
    // Verify hash matches file content
    const fileHash = computeHash(req.file.buffer)
    if (fileHash !== hash) {
      return res.status(400).json({ error: 'Hash does not match file content' })
    }
    
    // Upload subtitle using new storage system
    const result = await uploadSubtitle(hash, req.file.buffer, {
      movie_name: movie_name || 'Unknown Movie',
      language: language || 'en'
    })
    
    res.json(result)
  } catch (error) {
    console.error('Upload subtitle error:', error)
    res.status(500).json({ error: error.message || 'Failed to upload subtitle' })
  }
})

export default router 