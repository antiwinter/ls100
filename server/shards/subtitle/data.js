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