import { db } from '../../utils/dbc.js'

// Link subtitle to shard with main language flag
export const linkSubtitle = (shardId, subtitleId, isMain = false) => {
  return db.prepare(`
    INSERT OR REPLACE INTO shard_subtitles (shard_id, subtitle_id, is_main) VALUES (?, ?, ?)
  `).run(shardId, subtitleId, isMain ? 1 : 0)  // Convert boolean to integer
}

// Get all subtitles linked to a shard, ordered by main language first
export const getSubtitles = (shardId) => {
  return db.prepare(`
    SELECT s.*, ss.is_main
    FROM subtitles s
    JOIN shard_subtitles ss ON s.subtitle_id = ss.subtitle_id
    WHERE ss.shard_id = ?
    ORDER BY ss.is_main DESC, s.language ASC
  `).all(shardId)
}

// Unlink subtitle from shard (for future use)
export const unlinkSubtitle = (shardId, subtitleId) => {
  return db.prepare(`
    DELETE FROM shard_subtitles WHERE shard_id = ? AND subtitle_id = ?
  `).run(shardId, subtitleId)
}

// Get all shards that use a specific subtitle
export const getShardsForSubtitle = (subtitleId) => {
  return db.prepare(`
    SELECT s.* FROM shards s
    JOIN shard_subtitles ss ON s.id = ss.shard_id
    WHERE ss.subtitle_id = ?
  `).all(subtitleId)
}

// Subtitle-specific word selection management
export const getWords = (userId, shardId) => {
  const result = db.prepare(`
    SELECT words FROM subtitle_progress WHERE user_id = ? AND shard_id = ?
  `).get(userId, shardId)
  
  if (!result) return []
  
  try {
    return JSON.parse(result.words || '[]')
  } catch {
    return []
  }
}

export const updateWords = (userId, shardId, words) => {
  // Ensure uniqueness and filter out empty values
  const uniqueWords = [...new Set(words.filter(w => w && typeof w === 'string'))]
  const wordsJson = JSON.stringify(uniqueWords)
  const now = new Date().toISOString()
  
  const existing = db.prepare(`
    SELECT id FROM subtitle_progress WHERE user_id = ? AND shard_id = ?
  `).get(userId, shardId)
  
  if (existing) {
    // Update existing record
    return db.prepare(`
      UPDATE subtitle_progress SET words = ?, updated_at = ? 
      WHERE user_id = ? AND shard_id = ?
    `).run(wordsJson, now, userId, shardId)
  } else {
    // Create new record
    return db.prepare(`
      INSERT INTO subtitle_progress (user_id, shard_id, words, timestamp, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, shardId, wordsJson, now, now)
  }
}

export const addWords = (userId, shardId, newWords) => {
  const words = getWords(userId, shardId)
  // Add new words that aren't already present
  const wordsToAdd = Array.isArray(newWords) ? newWords : [newWords]
  const updated = [...words, ...wordsToAdd.filter(w => !words.includes(w))]
  updateWords(userId, shardId, updated)
  return updated
}

export const removeWords = (userId, shardId, wordsToRemove) => {
  const words = getWords(userId, shardId)
  const removeList = Array.isArray(wordsToRemove) ? wordsToRemove : [wordsToRemove]
  const filtered = words.filter(w => !removeList.includes(w))
  updateWords(userId, shardId, filtered)
  return filtered
} 

// Position helpers
export const getPosition = (userId, shardId) => {
  const row = db.prepare(`
    SELECT current_line FROM subtitle_progress WHERE user_id = ? AND shard_id = ?
  `).get(userId, shardId)
  if (!row || typeof row.current_line !== 'number') return 0
  return row.current_line || 0
}

export const setPosition = (userId, shardId, line) => {
  const now = new Date().toISOString()
  const existing = db.prepare(`
    SELECT id FROM subtitle_progress WHERE user_id = ? AND shard_id = ?
  `).get(userId, shardId)

  if (existing) {
    return db.prepare(`
      UPDATE subtitle_progress SET current_line = ?, updated_at = ?
      WHERE user_id = ? AND shard_id = ?
    `).run(line, now, userId, shardId)
  } else {
    return db.prepare(`
      INSERT INTO subtitle_progress (user_id, shard_id, timestamp, updated_at, current_line)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, shardId, now, now, line)
  }
}

// Bookmark helpers
export const getBookmarks = (userId, shardId) => {
  const result = db.prepare(`
    SELECT bookmarks FROM subtitle_progress WHERE user_id = ? AND shard_id = ?
  `).get(userId, shardId)
  
  if (!result) return []
  
  try {
    return JSON.parse(result.bookmarks || '[]')
  } catch {
    return []
  }
}

export const addBookmark = (userId, shardId, bookmark) => {
  const bookmarks = getBookmarks(userId, shardId)
  const now = new Date().toISOString()
  
  // Create bookmark with timestamp
  const newBookmark = {
    position: bookmark.position || 0,
    note: bookmark.note || '',
    created_at: now,
    ...bookmark
  }
  
  bookmarks.push(newBookmark)
  const bookmarksJson = JSON.stringify(bookmarks)
  
  const existing = db.prepare(`
    SELECT id FROM subtitle_progress WHERE user_id = ? AND shard_id = ?
  `).get(userId, shardId)
  
  if (existing) {
    return db.prepare(`
      UPDATE subtitle_progress SET bookmarks = ?, updated_at = ?
      WHERE user_id = ? AND shard_id = ?
    `).run(bookmarksJson, now, userId, shardId)
  } else {
    return db.prepare(`
      INSERT INTO subtitle_progress (user_id, shard_id, bookmarks, timestamp, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, shardId, bookmarksJson, now, now)
  }
}