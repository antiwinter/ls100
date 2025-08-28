import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { q } from '../../utils/dbc/index.js'

export const create = async (userData) => {
  const hash = await bcrypt.hash(userData.password, 10)
  
  const user = {
    id: crypto.randomUUID(),
    email: userData.email,
    name: userData.name,
    password_hash: hash,
    created_at: new Date().toISOString()
  }

  await q('INSERT INTO users (id, email, name, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)', [
    user.id, user.email, user.name, user.password_hash, user.created_at
  ])

  return user
}

export const findByEmail = async (email) => {
  const r = await q('SELECT * FROM users WHERE email = $1', [email])
  return r.rows?.[0] || null
}

export const findById = async (id) => {
  const r = await q('SELECT * FROM users WHERE id = $1', [id])
  return r.rows?.[0] || null
}

export const verifyPassword = async (user, password) => {
  return await bcrypt.compare(password, user.password_hash)
}

export const findAll = async () => {
  const r = await q('SELECT * FROM users ORDER BY created_at DESC')
  return r.rows
}

// Invite Code Functions

// Generate a random invite code
const generateInviteCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

// Create a new invite code
export const createInviteCode = async (createdBy, options = {}) => {
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

  await q('INSERT INTO invite_codes (id, code, created_by, created_at, used_by, used_at, expires_at, max_uses, current_uses) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [
    inviteCode.id,
    inviteCode.code,
    inviteCode.created_by,
    inviteCode.created_at,
    inviteCode.used_by,
    inviteCode.used_at,
    inviteCode.expires_at,
    inviteCode.max_uses,
    inviteCode.current_uses
  ])

  return inviteCode
}

// Find invite code by code string
export const findInviteByCode = async (code) => {
  const r = await q('SELECT * FROM invite_codes WHERE code = $1', [code])
  return r.rows?.[0] || null
}

// Validate if invite code can be used
export const validateInviteCode = async (code) => {
  const invite = await findInviteByCode(code)
  
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
export const useInviteCode = async (code, usedBy) => {
  const validation = await validateInviteCode(code)
  
  if (!validation.valid) {
    throw new Error(validation.reason)
  }

  const { invite } = validation
  const now = new Date().toISOString()

  // Update invite code
  await q('UPDATE invite_codes SET used_by = $1, used_at = $2, current_uses = current_uses + 1 WHERE code = $3', [usedBy, now, code])

  return {
    ...invite,
    used_by: usedBy,
    used_at: now,
    current_uses: invite.current_uses + 1
  }
}

// Get invite codes created by a user
export const getInviteCodesByUser = async (userId) => {
  const r = await q(`
    SELECT ic.*, u.name as used_by_name 
    FROM invite_codes ic
    LEFT JOIN users u ON ic.used_by = u.id
    WHERE ic.created_by = $1
    ORDER BY ic.created_at DESC
  `, [userId])
  return r.rows
}

// Get invite code usage stats
export const getInviteCodeStats = async (userId) => {
  const r = await q(`
    SELECT 
      COUNT(*) as total_codes,
      COUNT(used_by) as used_codes,
      SUM(current_uses) as total_uses
    FROM invite_codes 
    WHERE created_by = $1
  `, [userId])
  const stats = r.rows?.[0] || {}

  return {
    totalCodes: stats.total_codes || 0,
    usedCodes: stats.used_codes || 0,
    totalUses: stats.total_uses || 0,
    availableCodes: (stats.total_codes || 0) - (stats.used_codes || 0)
  }
} 