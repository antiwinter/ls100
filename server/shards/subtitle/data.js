import { q } from '../../utils/dbc/index.js'

// Link subtitle to shard with main language flag
export const linkSubtitle = async (shardId, subtitleId, isMain = false) => {
  await q('INSERT OR REPLACE INTO shard_subtitles (shard_id, subtitle_id, is_main) VALUES ($1, $2, $3)', [shardId, subtitleId, isMain ? 1 : 0])
}

// Get all subtitles linked to a shard, ordered by main language first
export const getSubtitles = async (shardId) => {
  const r = await q(`
    SELECT s.*, ss.is_main
    FROM subtitles s
    JOIN shard_subtitles ss ON s.subtitle_id = ss.subtitle_id
    WHERE ss.shard_id = ?
    ORDER BY ss.is_main DESC, s.language ASC
  `, [shardId])
  return r.rows
}

// Unlink subtitle from shard (for future use)
export const unlinkSubtitle = async (shardId, subtitleId) => {
  await q('DELETE FROM shard_subtitles WHERE shard_id = $1 AND subtitle_id = $2', [shardId, subtitleId])
}

// Get all shards that use a specific subtitle
export const getShardsForSubtitle = async (subtitleId) => {
  const r = await q(`
    SELECT s.* FROM shards s
    JOIN shard_subtitles ss ON s.id = ss.shard_id
    WHERE ss.subtitle_id = $1
  `, [subtitleId])
  return r.rows
}

// Subtitle-specific word selection management
export const getWords = async (userId, shardId) => {
  const r = await q('SELECT words FROM subtitle_progress WHERE user_id = $1 AND shard_id = $2', [userId, shardId])
  const result = r.rows?.[0]
  
  if (!result) return []
  
  try {
    return JSON.parse(result.words || '[]')
  } catch {
    return []
  }
}

export const updateWords = async (userId, shardId, words) => {
  // Ensure uniqueness and filter out empty values
  const uniqueWords = [...new Set(words.filter(w => w && typeof w === 'string'))]
  const wordsJson = JSON.stringify(uniqueWords)
  const now = new Date().toISOString()
  
  const r = await q('SELECT id FROM subtitle_progress WHERE user_id = $1 AND shard_id = $2', [userId, shardId])
  const existing = r.rows?.[0]
  
  if (existing) {
    // Update existing record
    return await q('UPDATE subtitle_progress SET words = $1, updated_at = $2 WHERE user_id = $3 AND shard_id = $4', [wordsJson, now, userId, shardId])
  } else {
    // Create new record
    return await q('INSERT INTO subtitle_progress (user_id, shard_id, words, timestamp, updated_at) VALUES ($1, $2, $3, $4, $5)', [userId, shardId, wordsJson, now, now])
  }
}

export const addWords = async (userId, shardId, newWords) => {
  const words = await getWords(userId, shardId)
  // Add new words that aren't already present
  const wordsToAdd = Array.isArray(newWords) ? newWords : [newWords]
  const updated = [...words, ...wordsToAdd.filter(w => !words.includes(w))]
  await updateWords(userId, shardId, updated)
  return updated
}

export const removeWords = async (userId, shardId, wordsToRemove) => {
  const words = await getWords(userId, shardId)
  const removeList = Array.isArray(wordsToRemove) ? wordsToRemove : [wordsToRemove]
  const filtered = words.filter(w => !removeList.includes(w))
  await updateWords(userId, shardId, filtered)
  return filtered
} 

// Position helpers
export const getPosition = async (userId, shardId) => {
  const r = await q('SELECT current_line FROM subtitle_progress WHERE user_id = $1 AND shard_id = $2', [userId, shardId])
  const row = r.rows?.[0]
  if (!row || typeof row.current_line !== 'number') return 0
  return row.current_line || 0
}

export const setPosition = async (userId, shardId, line) => {
  const now = new Date().toISOString()
  const r = await q('SELECT id FROM subtitle_progress WHERE user_id = $1 AND shard_id = $2', [userId, shardId])
  const existing = r.rows?.[0]

  if (existing) {
    return await q('UPDATE subtitle_progress SET current_line = $1, updated_at = $2 WHERE user_id = $3 AND shard_id = $4', [line, now, userId, shardId])
  } else {
    return await q('INSERT INTO subtitle_progress (user_id, shard_id, timestamp, updated_at, current_line) VALUES ($1, $2, $3, $4, $5)', [userId, shardId, now, now, line])
  }
}

// Bookmark helpers
export const getBookmarks = async (userId, shardId) => {
  const r = await q('SELECT bookmarks FROM subtitle_progress WHERE user_id = $1 AND shard_id = $2', [userId, shardId])
  const result = r.rows?.[0]
  
  if (!result) return []
  
  try {
    return JSON.parse(result.bookmarks || '[]')
  } catch {
    return []
  }
}

const saveBookmarks = async (userId, shardId, bookmarks) => {
  const validBookmarks = bookmarks.filter(b => b && typeof b === 'object' && Number.isFinite(b.gid))
  const bookmarksJson = JSON.stringify(validBookmarks)
  const now = new Date().toISOString()
  
  const r = await q('SELECT id FROM subtitle_progress WHERE user_id = $1 AND shard_id = $2', [userId, shardId])
  const existing = r.rows?.[0]
  
  if (existing) {
    return await q('UPDATE subtitle_progress SET bookmarks = $1, updated_at = $2 WHERE user_id = $3 AND shard_id = $4', [bookmarksJson, now, userId, shardId])
  } else {
    return await q('INSERT INTO subtitle_progress (user_id, shard_id, bookmarks, timestamp, updated_at) VALUES ($1,$2,$3,$4,$5)', [userId, shardId, bookmarksJson, now, now])
  }
}

export const addBookmark = async (userId, shardId, bookmark) => {
  const bookmarks = await getBookmarks(userId, shardId)
  const newBookmark = {
    gid: Number.isFinite(bookmark.gid) ? bookmark.gid : 0,
    sec: Number.isFinite(bookmark.sec) ? bookmark.sec : 0,
    line: bookmark.line || '',
    timestamp: new Date().toISOString()
  }
  // Idempotency: if a bookmark already exists at the same gid, do not duplicate
  const existsAtGid = bookmarks.some(b => Number.isFinite(b.gid) && b.gid === newBookmark.gid)
  const updated = existsAtGid ? bookmarks : [...bookmarks, newBookmark]
  await saveBookmarks(userId, shardId, updated)
  return updated
}

export const removeBookmarks = async (userId, shardId, gids) => {
  const bookmarks = await getBookmarks(userId, shardId)
  const gidsToRemove = Array.isArray(gids) ? gids : [gids]
  const updated = bookmarks.filter(b => !gidsToRemove.includes(b.gid))
  await saveBookmarks(userId, shardId, updated)
  return updated
}

export const updateBookmarks = async (userId, shardId, updates) => {
  const bookmarks = await getBookmarks(userId, shardId)
  const updatesArray = Array.isArray(updates) ? updates : [updates]
  
  const updated = bookmarks.map(bookmark => {
    const update = updatesArray.find(u => u.gid === bookmark.gid)
    return update ? { ...bookmark, ...update } : bookmark
  })
  
  await saveBookmarks(userId, shardId, updated)
  return updated
}

// Keep single versions for backwards compatibility
export const removeBookmark = async (userId, shardId, gid) => {
  return await removeBookmarks(userId, shardId, [gid])
}

export const updateBookmark = async (userId, shardId, gid, updates) => {
  return await updateBookmarks(userId, shardId, [{ gid, ...updates }])
}