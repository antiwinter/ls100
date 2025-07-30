-- Shard module migration
-- Shards table
CREATE TABLE IF NOT EXISTS shards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'subtitle',
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  public BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Note: shard_subtitles table moved to server/shards/subtitle/migration.sql
-- Note: progress tracking moved to engine-specific modules (e.g., subtitle_progress)

-- Shard indexes
CREATE INDEX IF NOT EXISTS idx_shards_owner ON shards(owner_id);
CREATE INDEX IF NOT EXISTS idx_shards_public ON shards(public); 