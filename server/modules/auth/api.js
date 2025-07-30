import express from 'express'
import jwt from 'jsonwebtoken'
import * as userModel from './data.js'
import { requireAuth, JWT_SECRET } from '../../utils/auth-middleware.js'
import { log } from '../../utils/logger.js'

const router = express.Router()

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' })
    }

    // Check if user exists
    const existingUser = userModel.findByEmail(email)
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Create user
    const user = await userModel.create({ email, password, name })

    // Return user without password
    const { password_hash, ...userInfo } = user
    res.json({ user: userInfo })
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

    const user = userModel.findByEmail(email)
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
    const { password_hash, ...userInfo } = user
    res.json({ user: userInfo, token })
  } catch (error) {
    log.error({ error, email: req.body?.email }, 'Login failed')
    res.status(500).json({ error: 'Login failed' })
  }
})

// Get current user (protected route)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = userModel.findById(req.userId)

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Return user without password
    const { password_hash, ...userInfo } = user
    res.json({ user: userInfo })
  } catch (error) {
    log.error({ error }, 'Auth me endpoint failed')
    res.status(500).json({ error: 'Server error' })
  }
})

export default router 