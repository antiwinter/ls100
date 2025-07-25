import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'

// Middleware to verify JWT token and add user info to request
export const requireAuth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' })
    }
    
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    req.userId = decoded.userId  // For backward compatibility
    next()
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' })
  }
}

// Export JWT_SECRET for modules that need to create tokens
export { JWT_SECRET } 