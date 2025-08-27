import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '../../utils/dbc/index.js'

export const create = async (userData) => {
  const hash = await bcrypt.hash(userData.password, 10)
  
  const user = {
    id: crypto.randomUUID(),
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

export const findAll = () => {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
}

// Invite Code Functions

// Generate a random invite code
const generateInviteCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

// Create a new invite code
export const createInviteCode = (createdBy, options = {}) => {
  const {
    maxUses = 1,
    expiresAt = null
  } = options

  const inviteCode = {
    id: crypto.randomUUID(),
    code: generateInviteCode(),
    created_by: createdBy,
    created_at: new Date().toISOString(),
    used_by: null,
    used_at: null,
    expires_at: expiresAt,
    max_uses: maxUses,
    current_uses: 0
  }

  db.prepare(`
    INSERT INTO invite_codes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inviteCode.id,
    inviteCode.code,
    inviteCode.created_by,
    inviteCode.created_at,
    inviteCode.used_by,
    inviteCode.used_at,
    inviteCode.expires_at,
    inviteCode.max_uses,
    inviteCode.current_uses
  )

  return inviteCode
}

// Find invite code by code string
export const findInviteByCode = (code) => {
  return db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code)
}

// Validate if invite code can be used
export const validateInviteCode = (code) => {
  const invite = findInviteByCode(code)
  
  if (!invite) {
    return { valid: false, reason: 'Code not found' }
  }

  // Check if expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { valid: false, reason: 'Code expired' }
  }

  // Check if max uses reached
  if (invite.current_uses >= invite.max_uses) {
    return { valid: false, reason: 'Code already used' }
  }

  return { valid: true, invite }
}

// Use an invite code (mark as used)
export const useInviteCode = (code, usedBy) => {
  const validation = validateInviteCode(code)
  
  if (!validation.valid) {
    throw new Error(validation.reason)
  }

  const { invite } = validation
  const now = new Date().toISOString()

  // Update invite code
  db.prepare(`
    UPDATE invite_codes 
    SET used_by = ?, used_at = ?, current_uses = current_uses + 1
    WHERE code = ?
  `).run(usedBy, now, code)

  return {
    ...invite,
    used_by: usedBy,
    used_at: now,
    current_uses: invite.current_uses + 1
  }
}

// Get invite codes created by a user
export const getInviteCodesByUser = (userId) => {
  return db.prepare(`
    SELECT ic.*, u.name as used_by_name 
    FROM invite_codes ic
    LEFT JOIN users u ON ic.used_by = u.id
    WHERE ic.created_by = ?
    ORDER BY ic.created_at DESC
  `).all(userId)
}

// Get invite code usage stats
export const getInviteCodeStats = (userId) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_codes,
      COUNT(used_by) as used_codes,
      SUM(current_uses) as total_uses
    FROM invite_codes 
    WHERE created_by = ?
  `).get(userId)

  return {
    totalCodes: stats.total_codes || 0,
    usedCodes: stats.used_codes || 0,
    totalUses: stats.total_uses || 0,
    availableCodes: (stats.total_codes || 0) - (stats.used_codes || 0)
  }
} 