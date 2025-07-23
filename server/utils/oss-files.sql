-- OSS Files table for content deduplication
-- This table tracks actual file storage by content hash
CREATE TABLE IF NOT EXISTS oss_files (
  oss_id TEXT PRIMARY KEY,           -- SHA256 hash of file content
  ref_count INTEGER DEFAULT 1,       -- Number of subtitle records referencing this file
  file_size INTEGER NOT NULL,        -- File size in bytes
  created_at TEXT NOT NULL,          -- When first uploaded
  updated_at TEXT NOT NULL           -- Last reference update
);

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_oss_files_ref_count ON oss_files(ref_count);
CREATE INDEX IF NOT EXISTS idx_oss_files_created ON oss_files(created_at); 