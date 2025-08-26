import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key'
// Middleware to verify JWT token and add user info to request
export const requireAuth = (req, res, next) => {
  // In dev mode, bypass authentication (check dynamically)
  if (process.env.NODE_ENV !== 'production') {
    // If in test mode and we have a token, try to decode it for more realistic testing
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.headers.authorization?.replace('Bearer ', '')
    
    if (token && process.env.NODE_ENV === 'development') {
      try {
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        req.userId = decoded.userId
        return next()
      } catch {
        // Fall back to hardcoded dev user if token verification fails
      }
    }
    
    req.user = { userId: '1753068359234', username: 'antiwinter' }
    req.userId = '1753068359234'  // For backward compatibility
    return next()
  }

  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || 
                  req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' })
    }
    
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    req.userId = decoded.userId  // For backward compatibility
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Export JWT_SECRET for modules that need to create tokens
export { JWT_SECRET } 