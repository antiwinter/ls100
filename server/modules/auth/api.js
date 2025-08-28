import express from 'express'
import jwt from 'jsonwebtoken'
import * as userModel from './data.js'
import { requireAuth, JWT_SECRET } from '../../utils/auth-middleware.js'
import { log } from '../../utils/logger.js'

const router = express.Router()

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, inviteCode } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' })
    }

    // Check if user exists
    const existingUser = await userModel.findByEmail(email)
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Validate invite code if provided
    if (inviteCode) {
      const validation = await userModel.validateInviteCode(inviteCode)
      if (!validation.valid) {
        return res.status(400).json({ error: `Invalid invite code: ${validation.reason}` })
      }
    }

    // Create user
    const user = await userModel.create({ email, password, name })

    // Use invite code if provided
    if (inviteCode) {
      try {
        await userModel.useInviteCode(inviteCode, user.id)
        log.info({ userId: user.id, inviteCode }, 'Invite code used successfully')
      } catch (error) {
        log.error({ error, userId: user.id, inviteCode }, 'Failed to use invite code')
        // Don't fail registration if invite code usage fails
      }
    }

    // Return user without password
    const { password_hash: __drop, ...userInfo } = user
    res.json({ user: userInfo, inviteUsed: !!inviteCode })
  } catch (error) {
    log.error({ error, email: req.body?.email }, 'Registration failed')
    res.status(500).json({ error: 'Registration failed' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' })
    }

    const user = await userModel.findByEmail(email)
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check password
    const isValid = await userModel.verifyPassword(user, password)
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Return user without password
    const { password_hash: _password_hash, ...userInfo } = user
    res.json({ user: userInfo, token })
  } catch (error) {
    log.error({ error, email: req.body?.email }, 'Login failed')
    res.status(500).json({ error: 'Login failed' })
  }
})

// Get current user (protected route)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await userModel.findById(req.userId)

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Return user without password
    const { password_hash: _password_hash, ...userInfo } = user
    res.json({ user: userInfo })
  } catch (error) {
    log.error({ error }, 'Auth me endpoint failed')
    res.status(500).json({ error: 'Server error' })
  }
})

// Validate invite code
router.post('/invite/validate', async (req, res) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Invite code required' })
    }

    const validation = await userModel.validateInviteCode(code)
    
    if (validation.valid) {
      const { invite } = validation
      const creator = await userModel.findById(invite.created_by)
      
      res.json({ 
        valid: true, 
        createdBy: creator?.name || 'Unknown',
        createdAt: invite.created_at,
        maxUses: invite.max_uses,
        currentUses: invite.current_uses,
        expiresAt: invite.expires_at
      })
    } else {
      res.json({ valid: false, reason: validation.reason })
    }
  } catch (error) {
    log.error({ error }, 'Invite code validation failed')
    res.status(500).json({ error: 'Validation failed' })
  }
})

// Generate invite code (protected route)
router.post('/invite/generate', requireAuth, async (req, res) => {
  try {
    const { maxUses = 1, expiresAt = null } = req.body

    if (maxUses < 1 || maxUses > 100) {
      return res.status(400).json({ error: 'Max uses must be between 1 and 100' })
    }

    const inviteCode = await userModel.createInviteCode(req.userId, {
      maxUses,
      expiresAt
    })

    res.json({ 
      code: inviteCode.code,
      id: inviteCode.id,
      maxUses: inviteCode.max_uses,
      expiresAt: inviteCode.expires_at,
      createdAt: inviteCode.created_at
    })
  } catch (error) {
    log.error({ error, userId: req.userId }, 'Invite code generation failed')
    res.status(500).json({ error: 'Generation failed' })
  }
})

// Get user's invite codes (protected route)
router.get('/invite/my-codes', requireAuth, async (req, res) => {
  try {
    const inviteCodes = await userModel.getInviteCodesByUser(req.userId)
    const stats = await userModel.getInviteCodeStats(req.userId)

    res.json({ 
      codes: inviteCodes,
      stats
    })
  } catch (error) {
    log.error({ error, userId: req.userId }, 'Failed to get invite codes')
    res.status(500).json({ error: 'Failed to retrieve codes' })
  }
})

export default router 