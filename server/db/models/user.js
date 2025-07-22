import bcrypt from 'bcryptjs'
import { db } from '../connection.js'

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