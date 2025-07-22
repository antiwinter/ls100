-- Auth module migration
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Auth indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email); 