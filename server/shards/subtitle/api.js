import express from 'express'
import * as subtitleData from './data.js'
import * as shardModel from '../../modules/shard/data.js'
import { requireAuth } from '../../utils/auth-middleware.js'
import { log } from '../../utils/logger.js'

const router = express.Router()

// Reusable shard access validation
const validateShardAccess = async (req, res, next) => {
  try {
    const shardId = req.params.shardId
    const shard = shardModel.findById(shardId)
    
    if (!shard) {
      return res.status(404).json({ error: 'Shard not found' })
    }
    
    if (shard.owner_id !== req.userId && !shard.public) {
      return res.status(403).json({ error: 'Access denied' })
    }
    
    if (shard.type !== 'subtitle') {
      return res.status(400).json({ error: 'Not a subtitle shard' })
    }
    
    req.shard = shard
    next()
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to validate shard access')
    res.status(500).json({ error: 'Failed to validate shard access' })
  }
}

// GET /api/subtitle-shards/:shardId/words - Get selected words
router.get('/:shardId/words', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const words = subtitleData.getWords(req.userId, req.params.shardId)
    res.json({ words })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to get selected words')
    res.status(500).json({ error: 'Failed to get selected words' })
  }
})

// POST /api/subtitle-shards/:shardId/words - Add word to selection
router.post('/:shardId/words', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const { word } = req.body
    
    if (!word || typeof word !== 'string') {
      return res.status(400).json({ error: 'Word is required' })
    }
    
    const words = subtitleData.addWords(req.userId, req.params.shardId, [word.toLowerCase()])
    res.json({ words })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to add selected word')
    res.status(500).json({ error: 'Failed to add selected word' })
  }
})

// DELETE /api/subtitle-shards/:shardId/words/:word - Remove word from selection
router.delete('/:shardId/words/:word', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const word = req.params.word
    const words = subtitleData.removeWords(req.userId, req.params.shardId, [word.toLowerCase()])
    res.json({ words })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to remove selected word')
    res.status(500).json({ error: 'Failed to remove selected word' })
  }
})

// PUT /api/subtitle-shards/:shardId/words - Batch update selected words
router.put('/:shardId/words', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const { additions = [], removals = [] } = req.body
    
    if (!Array.isArray(additions) || !Array.isArray(removals)) {
      return res.status(400).json({ error: 'Additions and removals must be arrays' })
    }
    
    // Process arrays for consistency
    const cleanAdditions = additions.filter(w => typeof w === 'string').map(w => w.toLowerCase())
    const cleanRemovals = removals.filter(w => typeof w === 'string').map(w => w.toLowerCase())
    
    // Add words
    if (cleanAdditions.length > 0) {
      subtitleData.addWords(req.userId, req.params.shardId, cleanAdditions)
    }
    
    // Remove words  
    if (cleanRemovals.length > 0) {
      subtitleData.removeWords(req.userId, req.params.shardId, cleanRemovals)
    }
    
    const words = subtitleData.getWords(req.userId, req.params.shardId)
    res.json({ words })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to batch update selected words')
    res.status(500).json({ error: 'Failed to batch update selected words' })
  }
})

// GET /api/subtitle-shards/:shardId/position - Get current viewing position
router.get('/:shardId/position', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const position = subtitleData.getPosition(req.userId, req.params.shardId)
    res.json({ position })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to get position')
    res.status(500).json({ error: 'Failed to get position' })
  }
})

// PUT /api/subtitle-shards/:shardId/position - Update current viewing position
router.put('/:shardId/position', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const { position } = req.body
    const line = Number.isFinite(position) ? Math.max(0, Math.floor(position)) : 0
    subtitleData.setPosition(req.userId, req.params.shardId, line)
    res.json({ position: line })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to update position')
    res.status(500).json({ error: 'Failed to update position' })
  }
})

// GET /api/subtitle-shards/:shardId/bookmarks - Get bookmarks
router.get('/:shardId/bookmarks', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const bookmarks = subtitleData.getBookmarks(req.userId, req.params.shardId)
    res.json({ bookmarks })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to get bookmarks')
    res.status(500).json({ error: 'Failed to get bookmarks' })
  }
})

// POST /api/subtitle-shards/:shardId/bookmarks - Add bookmark
router.post('/:shardId/bookmarks', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const { position, note } = req.body
    
    if (!Number.isFinite(position)) {
      return res.status(400).json({ error: 'Position is required' })
    }
    
    const bookmarks = subtitleData.addBookmark(req.userId, req.params.shardId, { position, note })
    res.json({ bookmarks })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId }, 'Failed to add bookmark')
    res.status(500).json({ error: 'Failed to add bookmark' })
  }
})

// DELETE /api/subtitle-shards/:shardId/bookmarks - Batch delete bookmarks
router.delete('/:shardId/bookmarks', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const { bookmarkIds } = req.body
    
    if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) {
      return res.status(400).json({ error: 'Bookmark IDs array is required' })
    }
    
    const bookmarks = subtitleData.removeBookmarks(req.userId, req.params.shardId, bookmarkIds)
    res.json({ bookmarks })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId, bookmarkIds: req.body.bookmarkIds }, 'Failed to delete bookmarks')
    res.status(500).json({ error: 'Failed to delete bookmarks' })
  }
})

// PUT /api/subtitle-shards/:shardId/bookmarks - Batch update bookmarks
router.put('/:shardId/bookmarks', requireAuth, validateShardAccess, async (req, res) => {
  try {
    const { updates } = req.body
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Updates array is required' })
    }
    
    // Validate each update has id and valid fields
    for (const update of updates) {
      if (!update.id) {
        return res.status(400).json({ error: 'Each update must have an id' })
      }
    }
    
    const bookmarks = subtitleData.updateBookmarks(req.userId, req.params.shardId, updates)
    res.json({ bookmarks })
  } catch (error) {
    log.error({ error, shardId: req.params.shardId, updates: req.body.updates }, 'Failed to update bookmarks')
    res.status(500).json({ error: 'Failed to update bookmarks' })
  }
})

export default router
