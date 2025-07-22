-- Auth module indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Subtitle module indexes
CREATE INDEX IF NOT EXISTS idx_subtitles_movie ON subtitles(movie_name);

-- Shard module indexes
CREATE INDEX IF NOT EXISTS idx_shards_owner ON shards(owner_id);
CREATE INDEX IF NOT EXISTS idx_shards_public ON shards(public);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id); 