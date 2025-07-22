# Auth Module

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
```

## API Endpoints

### POST /api/auth/register
Register new user.

**Body:**
```js
{
  name: "John Doe",
  email: "john@example.com", 
  password: "password123"
}
```

**Response:**
```js
{ user: { id, email, name, created_at } }
```

### POST /api/auth/login
User login.

**Body:**
```js
{
  email: "john@example.com",
  password: "password123"
}
```

**Response:**
```js
{
  user: { id, email, name, created_at },
  token: "jwt.token.here"
}
```

### GET /api/auth/me
Get current user (requires auth).

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```js
{ user: { id, email, name, created_at } }
```

## Model Operations

```js
// modules/auth/data.js
export const create = async (userData) => {
  const hash = await bcrypt.hash(userData.password, 10)
  
  const user = {
    id: Date.now().toString(),
    email: userData.email,
    name: userData.name,
    password_hash: hash,
    created_at: new Date().toISOString()
  }

  db.prepare(`
    INSERT INTO users VALUES (?, ?, ?, ?, ?)
  `).run(user.id, user.email, user.name, user.password_hash, user.created_at)

  return user
}

export const findByEmail = (email) => {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email)
}

export const findById = (id) => {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
}

export const verifyPassword = async (user, password) => {
  return await bcrypt.compare(password, user.password_hash)
}
```

## JWT Utilities & Middleware

```js
// utils/auth-middleware.js
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
```

## Security Features

- **Password hashing**: bcryptjs with salt rounds
- **JWT tokens**: 7-day expiration
- **Email uniqueness**: Database constraint
- **Input validation**: Required fields checking
- **Error handling**: Consistent error responses 