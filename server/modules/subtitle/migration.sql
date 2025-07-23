-- Subtitle module migration (updated architecture)
-- Subtitles table - each record represents a unique subtitle with metadata
CREATE TABLE IF NOT EXISTS subtitles (
  subtitle_id TEXT PRIMARY KEY,      -- Unique ID (not hash)
  filename TEXT NOT NULL,            -- Original filename
  movie_name TEXT NOT NULL,          -- Extracted or provided movie name
  language TEXT NOT NULL,            -- Language code (en, zh, etc.)
  duration TEXT NOT NULL,            -- Parsed duration (HH:MM:SS)
  oss_id TEXT NOT NULL,              -- References oss_files.oss_id for actual content
  created_at TEXT NOT NULL,          -- ISO timestamp when created
  updated_at TEXT NOT NULL           -- ISO timestamp when last updated
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_subtitles_movie ON subtitles(movie_name);
CREATE INDEX IF NOT EXISTS idx_subtitles_language ON subtitles(language);
CREATE INDEX IF NOT EXISTS idx_subtitles_oss_id ON subtitles(oss_id);
CREATE INDEX IF NOT EXISTS idx_subtitles_created ON subtitles(created_at); 