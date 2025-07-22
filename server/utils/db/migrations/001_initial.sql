-- Users table (auth module)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Subtitles table (subtitle module)
CREATE TABLE IF NOT EXISTS subtitles (
  subtitle_id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  movie_name TEXT NOT NULL,
  language TEXT NOT NULL,
  duration TEXT NOT NULL,
  ref_count INTEGER DEFAULT 1,
  first_uploaded TEXT NOT NULL
);

-- Shards table (shard module)
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

-- Shard-Subtitle links (many-to-many)
CREATE TABLE IF NOT EXISTS shard_subtitles (
  shard_id TEXT NOT NULL,
  subtitle_id TEXT NOT NULL,
  PRIMARY KEY (shard_id, subtitle_id),
  FOREIGN KEY (shard_id) REFERENCES shards(id) ON DELETE CASCADE,
  FOREIGN KEY (subtitle_id) REFERENCES subtitles(subtitle_id)
);

-- Progress tracking (shard module)
CREATE TABLE IF NOT EXISTS progress (
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