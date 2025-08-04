import express from 'express'
import * as shardModel from './data.js'
// Removed subtitle-specific imports - now handled via engine abstraction
import { requireAuth } from '../../utils/auth-middleware.js'
import { engineProcessCreate, engineProcessUpdate, engineValidateData, getDefaultEngineType, engineGetData } from '../../shards/engines.js'
import { log } from '../../utils/logger.js'

const router = express.Router()

// Multer removed - file uploads now handled by specific engine modules

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
    
    // Include engine-specific data for each shard
    const shardsWithData = shards.map(shard => ({
      ...shard,
      data: engineGetData(shard.type, shard.id)
    }))
    
    res.json({ shards: shardsWithData })
  } catch (error) {
    log.error({ error }, 'Failed to get shards')
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
    
    // Get engine-specific data
    const data = engineGetData(shard.type, shard.id)
    
    log.debug({ shardId: req.params.id, data }, 'Fetching shard data')
    
    // Track progress when user opens shard
    if (shard.owner_id === req.userId) {
      shardModel.updateProgress(req.userId, shard.id)
    }
    
    const responseData = {
      shard: {
        ...shard,
        metadata: JSON.parse(shard.metadata),
        data
      }
    }
    
    log.debug({ shardId: req.params.id, name: shard.name }, 'Sending shard response')
    
    res.json(responseData)
  } catch (error) {
    log.error({ error, shardId: req.params.id }, 'Failed to get shard')
    res.status(500).json({ error: 'Failed to get shard' })
  }
})

// POST /api/shards - Create new shard
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, cover, metadata, public: isPublic, type, data } = req.body
    
    // Use default engine type if none specified (handled by getEngine)
    const finalType = type || getDefaultEngineType()
    
    if (!name) {
      return res.status(400).json({ error: 'Shard name is required' })
    }
    
    // Validate engine-specific data
    if (data) {
      const validation = engineValidateData(finalType, data)
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error })
      }
    }
    
    log.info({ type: finalType, data }, 'Creating shard with engine processing')
    
    // Create basic shard record
    const shard = shardModel.create({
      type: finalType,
      name,
      description,
      cover, // URL string for custom cover
      metadata,
      public: isPublic || false,
      owner_id: req.userId
    })
    
    // Process with engine-specific logic
    const processedShard = await engineProcessCreate(shard, data || {})
    
    res.json({ 
      shard: {
        ...processedShard,
        metadata: JSON.parse(processedShard.metadata)
      }
    })
  } catch (error) {
    log.error({ error }, 'Failed to create shard')
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
    
    const { name, description, cover, metadata, public: isPublic, data } = req.body
    
    // Validate engine-specific data
    if (data) {
      const validation = engineValidateData(shard.type, data)
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
    
    // Process with engine-specific logic if data provided
    let processedShard = updated
    if (data) {
      log.info({ shardId: req.params.id, type: shard.type, data }, 'Updating shard with engine processing')
      processedShard = await engineProcessUpdate(updated, data, updates)
    }
    
    res.json({ 
      shard: {
        ...processedShard,
        metadata: JSON.parse(processedShard.metadata)
      }
    })
  } catch (error) {
    log.error({ error, shardId: req.params.id }, 'Failed to update shard')
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
    log.error({ error, shardId: req.params.id }, 'Failed to delete shard')
    res.status(500).json({ error: 'Failed to delete shard' })
  }
})

// Any Engine-specific functionality should NOT be put here

export default router 