import { db } from '../../utils/dbc.js'

const generateId = () => {
  return `shard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const create = (data) => {
  const shard = {
    id: generateId(),
    type: data.type || 'subtitle',
    name: data.name,
    owner_id: data.owner_id,
    description: data.description || '',
    cover: data.cover || '',
    metadata: JSON.stringify(data.metadata || {}),
    public: data.public ? 1 : 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  db.prepare(`
    INSERT INTO shards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    shard.id, shard.type, shard.name, shard.owner_id, 
    shard.description, shard.cover, shard.metadata, 
    shard.public, shard.created_at, shard.updated_at
  )

  return shard
}

export const findById = (id) => {
  return db.prepare('SELECT * FROM shards WHERE id = ?').get(id)
}

export const findByOwner = (userId) => {
  return db.prepare('SELECT * FROM shards WHERE owner_id = ?').all(userId)
}

export const findByOwnerWithProgress = (userId, sortBy = 'last_used') => {
  let orderClause = 'ORDER BY COALESCE(p.updated_at, s.created_at) DESC'
  
  if (sortBy === 'name') {
    orderClause = 'ORDER BY s.name ASC'
  } else if (sortBy === 'progress') {
    orderClause = 'ORDER BY COALESCE(p.completion_rate, 0) DESC, COALESCE(p.updated_at, s.created_at) DESC'
  }
  
  return db.prepare(`
    SELECT s.*, 
           p.updated_at as last_used,
           COALESCE(p.completion_rate, 0) as completion_rate,
           COALESCE(p.study_time, 0) as study_time
    FROM shards s
    LEFT JOIN progress p ON s.id = p.shard_id AND p.user_id = ?
    WHERE s.owner_id = ?
    ${orderClause}
  `).all(userId, userId)
}

export const updateProgress = (userId, shardId) => {
  const now = new Date().toISOString()
  
  return db.prepare(`
    INSERT INTO progress (user_id, shard_id, timestamp, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, shard_id) DO UPDATE SET
      updated_at = ?,
      timestamp = ?
  `).run(userId, shardId, now, now, now, now)
}

export const findPublic = () => {
  return db.prepare('SELECT * FROM shards WHERE public = TRUE').all()
}

export const update = (id, updates) => {
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
  
  return db.prepare(`
    UPDATE shards SET ${updateFields.join(', ')} WHERE id = ?
  `).run(...values)
}

export const remove = (id) => {
  return db.prepare('DELETE FROM shards WHERE id = ?').run(id)
}

export const linkSubtitle = (shardId, subtitleId) => {
  return db.prepare(`
    INSERT OR IGNORE INTO shard_subtitles VALUES (?, ?)
  `).run(shardId, subtitleId)
}

export const getSubtitles = (shardId) => {
  return db.prepare(`
    SELECT s.* FROM subtitles s
    JOIN shard_subtitles ss ON s.subtitle_id = ss.subtitle_id
    WHERE ss.shard_id = ?
  `).all(shardId)
}

export const getStats = () => {
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total_shards,
      SUM(CASE WHEN public = TRUE THEN 1 ELSE 0 END) as public_shards,
      SUM(CASE WHEN public = FALSE THEN 1 ELSE 0 END) as private_shards
    FROM shards
  `).get()
  return result
} 