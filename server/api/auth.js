import express from 'express'
import jwt from 'jsonwebtoken'
import * as userModel from '../db/models/user.js'

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'

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
    console.error('Register error:', error)
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
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Get current user (protected route)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const decoded = jwt.verify(token, JWT_SECRET)
    const user = userModel.findById(decoded.userId)

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Return user without password
    const { password_hash, ...userInfo } = user
    res.json({ user: userInfo })
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router 