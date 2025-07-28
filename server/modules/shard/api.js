import express from 'express'
import multer from 'multer'
import * as shardModel from './data.js'
import { uploadSubtitle, computeHash } from '../subtitle/storage.js'
import { requireAuth } from '../../utils/auth-middleware.js'
import { processShardCreate, processShardUpdate, validateShardData, getEngineTypes, getDefaultEngineType } from '../../shards/engines.js'
import { getSubtitles } from '../../shards/subtitle/data.js'

const router = express.Router()

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 } // 500KB limit
})

// GET /api/shards - Get user's shards or public shards
router.get('/', requireAuth, async (req, res) => {
  try {
    const { type = 'user', sort = 'last_used' } = req.query
    
    let shards
    if (type === 'public') {
      shards = shardModel.findPublic()
    } else {
      shards = shardModel.findByOwnerWithProgress(req.userId, sort)
    }
    
    // Include subtitles data for each shard (needed for movie names in covers)
    const shardsWithSubtitles = shards.map(shard => ({
      ...shard,
      subtitles: getSubtitles(shard.id)
    }))
    
    res.json({ shards: shardsWithSubtitles })
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
    const subtitles = getSubtitles(shard.id)
    
    console.log(`🔍 [API] Fetching subtitles for shard ${req.params.id}:`)
    console.log(`📋 [API] Raw subtitles query result:`, subtitles)
    
    // Track progress when user opens shard
    if (shard.owner_id === req.userId) {
      shardModel.updateProgress(req.userId, shard.id)
    }
    
    console.log(`📖 [API] Loading shard ${req.params.id}:`, {
      name: shard.name,
      subtitles: subtitles.length,
      subtitleDetails: subtitles.map(s => ({ 
        id: s.subtitle_id, 
        lang: s.language, 
        movie: s.movie_name, 
        filename: s.filename 
      }))
    })
    
    const responseData = {
      shard: {
        ...shard,
        metadata: JSON.parse(shard.metadata),
        subtitles
      }
    }
    
    console.log(`📤 [API] Sending response:`, responseData)
    
    res.json(responseData)
  } catch (error) {
    console.error('Get shard error:', error)
    res.status(500).json({ error: 'Failed to get shard' })
  }
})

// POST /api/shards - Create new shard
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, cover, metadata, subtitles, public: isPublic, type, shard_data } = req.body
    
    // Use default engine type if none specified (handled by getEngine)
    const finalType = type || getDefaultEngineType()
    
    if (!name) {
      return res.status(400).json({ error: 'Shard name is required' })
    }
    
    // Validate engine-specific shard data
    if (shard_data) {
      const validation = validateShardData(finalType, shard_data)
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }
    }
    
    console.log('🎯 [API] Creating shard with engine processing:', { type: finalType, shard_data })
    
    // Create basic shard record
    const shard = shardModel.create({
      type: finalType,
      name,
      description,
      cover,
      metadata,
      public: isPublic || false,
      owner_id: req.userId
    })
    
    // Process with engine-specific logic (handles subtitle linking, etc.)
    const processedShard = await processShardCreate(shard, shard_data || { subtitles })
    
    res.json({ 
      shard: {
        ...processedShard,
        metadata: JSON.parse(processedShard.metadata)
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
    
    const { name, description, cover, metadata, public: isPublic, shard_data } = req.body
    
    // Validate engine-specific shard data
    if (shard_data) {
      const validation = validateShardData(shard.type, shard_data)
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }
    }
    
    const updates = {}
    
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (cover !== undefined) updates.cover = cover
    if (metadata !== undefined) updates.metadata = metadata
    if (isPublic !== undefined) updates.public = isPublic
    
    shardModel.update(req.params.id, updates)
    const updated = shardModel.findById(req.params.id)
    
    // Process with engine-specific logic if shard_data provided
    let processedShard = updated
    if (shard_data) {
      console.log('🎯 [API] Updating shard with engine processing:', { type: shard.type, shard_data })
      processedShard = await processShardUpdate(updated, shard_data, updates)
    }
    
    res.json({ 
      shard: {
        ...processedShard,
        metadata: JSON.parse(processedShard.metadata)
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

// POST /api/shards/:id/subtitles - Link subtitle to shard (legacy - use shard_data in PUT instead)
router.post('/:id/subtitles', requireAuth, async (req, res) => {
  try {
    const { subtitle_id } = req.body
    
    if (!subtitle_id) {
      return res.status(400).json({ error: 'subtitle_id is required' })
    }
    
    const shard = shardModel.findById(req.params.id)
    
    if (!shard) {
      return res.status(404).json({ error: 'Shard not found' })
    }
    
    // Check if user owns this shard
    if (shard.owner_id !== req.userId) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    console.log(`🔗 [API] Legacy subtitle linking: ${subtitle_id} to shard ${req.params.id}`)
    
    // Use engine system for linking
    await processShardUpdate(shard, { subtitles: [subtitle_id] }, {})
    
    console.log(`✅ [API] Successfully linked subtitle to shard`)
    
    res.json({ success: true })
  } catch (error) {
    console.error('Link subtitle to shard error:', error)
    res.status(500).json({ error: 'Failed to link subtitle to shard' })
  }
})

export default router 