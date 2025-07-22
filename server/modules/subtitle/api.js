import express from 'express'
import * as subtitleModel from './data.js'
import { uploadSubtitle, computeHash } from './storage.js'
import { requireAuth } from '../../utils/auth-middleware.js'

const router = express.Router()

// Get subtitle by ID
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

export default router 