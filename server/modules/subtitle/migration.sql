-- Subtitle module migration  
-- Subtitles table
CREATE TABLE IF NOT EXISTS subtitles (
  subtitle_id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  movie_name TEXT NOT NULL,
  language TEXT NOT NULL,
  duration TEXT NOT NULL,
  ref_count INTEGER DEFAULT 1,
  first_uploaded TEXT NOT NULL
);

-- Subtitle indexes
CREATE INDEX IF NOT EXISTS idx_subtitles_movie ON subtitles(movie_name); 