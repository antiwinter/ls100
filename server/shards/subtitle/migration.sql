-- Subtitle Shard Engine Migration
-- This handles subtitle-specific database structures

-- Shard-Subtitle links (many-to-many)
-- This table links shards to subtitles and is subtitle-specific
CREATE TABLE IF NOT EXISTS shard_subtitles (
  shard_id TEXT NOT NULL,
  subtitle_id TEXT NOT NULL,
  is_main BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (shard_id, subtitle_id),
  FOREIGN KEY (shard_id) REFERENCES shards(id) ON DELETE CASCADE,
  FOREIGN KEY (subtitle_id) REFERENCES subtitles(subtitle_id) ON DELETE CASCADE
);

-- Set the first subtitle of each shard as main (for existing data)
-- Only run if there are no main languages set yet
UPDATE shard_subtitles 
SET is_main = TRUE 
WHERE (shard_id, subtitle_id) IN (
  SELECT shard_id, MIN(subtitle_id) 
  FROM shard_subtitles 
  GROUP BY shard_id
) AND NOT EXISTS (
  SELECT 1 FROM shard_subtitles ss2 
  WHERE ss2.shard_id = shard_subtitles.shard_id 
  AND ss2.is_main = TRUE
);

-- Subtitle-specific progress tracking
CREATE TABLE IF NOT EXISTS subtitle_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  shard_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  words TEXT DEFAULT '[]',
  bookmarks TEXT DEFAULT '[]',
  study_time INTEGER DEFAULT 0,
  completion_rate REAL DEFAULT 0.0,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, shard_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shard_id) REFERENCES shards(id) ON DELETE CASCADE
);

-- Add dedicated current_line column for viewing progress
-- Note: SQLite doesn't support IF NOT EXISTS for ADD COLUMN.
-- Our migration runner will ignore duplicate column errors safely.
ALTER TABLE subtitle_progress ADD COLUMN current_line INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shard_subtitles_shard ON shard_subtitles(shard_id);
CREATE INDEX IF NOT EXISTS idx_shard_subtitles_subtitle ON shard_subtitles(subtitle_id);
CREATE INDEX IF NOT EXISTS idx_shard_subtitles_main ON shard_subtitles(shard_id, is_main);
CREATE INDEX IF NOT EXISTS idx_subtitle_progress_user ON subtitle_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_subtitle_progress_shard ON subtitle_progress(shard_id); 