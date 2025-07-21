import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const USERS_FILE = path.join(__dirname, '../data/users.json')
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'

// Helper to read users
const readUsers = async () => {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    // File doesn't exist yet
    return []
  }
}

// Helper to write users
const writeUsers = async (users) => {
  // Ensure data directory exists
  const dataDir = path.dirname(USERS_FILE)
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' })
    }

    const users = await readUsers()
    
    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' })
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10)
    
    // Create user
    const user = {
      id: Date.now().toString(),
      email,
      name,
      password: hash,
      createdAt: new Date().toISOString()
    }

    users.push(user)
    await writeUsers(users)

    // Return user without password
    const { password: _, ...userInfo } = user
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

    const users = await readUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password)
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
    const { password: _, ...userInfo } = user
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
    const users = await readUsers()
    const user = users.find(u => u.id === decoded.userId)

    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }

    // Return user without password
    const { password: _, ...userInfo } = user
    res.json({ user: userInfo })
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ error: 'Invalid token' })
  }
})

export default router 