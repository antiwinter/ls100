import { q } from '../../utils/dbc/index.js'

const generateId = () => {
  return `shard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const create = async (data) => {
  const shard = {
    id: generateId(),
    type: data.type, // Type should be provided by caller (API layer handles defaults)
    name: data.name,
    owner_id: data.owner_id,
    description: data.description || '',
    cover: data.cover || '',
    metadata: JSON.stringify(data.metadata || {}),
    public: data.public ? 1 : 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  await q('INSERT INTO shards (id, type, name, owner_id, description, cover, metadata, public, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [
    shard.id, shard.type, shard.name, shard.owner_id, shard.description, shard.cover, shard.metadata, shard.public, shard.created_at, shard.updated_at
  ])

  return shard
}

export const findById = async (id) => {
  const r = await q('SELECT * FROM shards WHERE id = $1', [id])
  return r.rows?.[0] || null
}

export const findByOwner = async (userId) => {
  const r = await q('SELECT * FROM shards WHERE owner_id = $1', [userId])
  return r.rows
}

export const findByOwnerWithProgress = async (userId, sortBy = 'last_used') => {
  let orderClause = 'ORDER BY COALESCE(p.updated_at, s.created_at) DESC'
  
  if (sortBy === 'name') {
    orderClause = 'ORDER BY s.name ASC'
  } else if (sortBy === 'progress') {
    orderClause = 'ORDER BY COALESCE(p.completion_rate, 0) DESC, COALESCE(p.updated_at, s.created_at) DESC'
  }
  
  const r = await q(`
    SELECT s.*, 
           p.updated_at as last_used,
           COALESCE(p.completion_rate, 0) as completion_rate,
           COALESCE(p.study_time, 0) as study_time
    FROM shards s
    LEFT JOIN progress p ON s.id = p.shard_id AND p.user_id = ?
    WHERE s.owner_id = ?
    ${orderClause}
  `, [userId, userId])
  return r.rows
}

export const updateProgress = async (userId, shardId) => {
  const now = new Date().toISOString()
  
  await q(`
    INSERT INTO progress (user_id, shard_id, timestamp, updated_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(user_id, shard_id) DO UPDATE SET
      updated_at = $5,
      timestamp = $6
  `, [userId, shardId, now, now, now, now])
}

export const findPublic = async () => {
  const r = await q('SELECT * FROM shards WHERE public = TRUE')
  return r.rows
}

export const update = async (id, updates) => {
  const updateFields = []
  const values = []
  
  if (updates.name !== undefined) {
    updateFields.push('name = ?')
    values.push(updates.name)
  }
  if (updates.description !== undefined) {
    updateFields.push('description = ?')
    values.push(updates.description)
  }
  if (updates.cover !== undefined) {
    updateFields.push('cover = ?')
    values.push(updates.cover)
  }
  if (updates.metadata !== undefined) {
    updateFields.push('metadata = ?')
    values.push(JSON.stringify(updates.metadata))
  }
  if (updates.public !== undefined) {
    updateFields.push('public = ?')
    values.push(updates.public ? 1 : 0)
  }
  
  updateFields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(id)
  
  let paramIndex = 1
  const setClause = updateFields.join(', ').replaceAll('?', () => `$${paramIndex++}`)
  const sql = `UPDATE shards SET ${setClause} WHERE id = $${values.length}`
  await q(sql, values)
}

export const remove = async (id) => {
  await q('DELETE FROM shards WHERE id = $1', [id])
}

// Note: Subtitle-specific functions moved to server/shards/subtitle/data.js

export const getStats = async () => {
  const r = await q(`
    SELECT 
      COUNT(*) as total_shards,
      SUM(CASE WHEN public = TRUE THEN 1 ELSE 0 END) as public_shards,
      SUM(CASE WHEN public = FALSE THEN 1 ELSE 0 END) as private_shards
    FROM shards
  `)
  return r.rows?.[0] || { total_shards: 0, public_shards: 0, private_shards: 0 }
}