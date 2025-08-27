I'll help you evaluate the current SQLite setup and create a migration plan to PostgreSQL. Let me start by reading the key server files to understand the current database structure and usage.

[19 tools called]

Based on my analysis of your server files, here's a comprehensive evaluation and migration plan for moving from SQLite to PostgreSQL:

## Current SQLite Setup Analysis

### Database Structure
- **Connection**: Uses `better-sqlite3` with WAL mode and foreign keys enabled
- **Migration System**: Module-based migrations (`auth`, `subtitle`, `shard`) + engine-specific migrations
- **Tables**: 6 core tables with clear relationships and proper indexing
- **Data Access**: Uses prepared statements throughout with custom ID generation

### Key Tables Identified:
1. **users** - User authentication and profiles
2. **invite_codes** - Invitation system with usage tracking
3. **subtitles** - Subtitle metadata with OSS file references
4. **shards** - Content collections with ownership
5. **shard_subtitles** - Many-to-many relationship table
6. **subtitle_progress** - User progress tracking with JSON fields
7. **oss_files** - File storage deduplication

## PostgreSQL Migration Plan

### Phase 1: Infrastructure Setup

[1 tool called]

#### 1.1 Dependencies & Package Changes
```json
// Remove from package.json
"better-sqlite3": "^12.2.0"

// Add to package.json  
"pg": "^8.11.3",
"@types/pg": "^8.10.9" // if using TypeScript
```

#### 1.2 Environment Variables
```bash
# Add to .env
DATABASE_URL=postgresql://username:password@localhost:5432/ls100_db
# For production
DATABASE_URL=postgresql://username:password@prod-host:5432/ls100_prod

# Keep for migration period
SQLITE_PATH=./data/database.sqlite
```

### Phase 2: Database Connection Refactor

#### 2.1 Create New Database Connection Module
**Location**: `server/utils/pgc.js` (PostgreSQL Connection)

```javascript
import pg from 'pg'
import { log } from './logger.js'

const { Pool } = pg

// PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Test connection
pool.on('connect', () => {
  log.debug('PostgreSQL client connected')
})

pool.on('error', (err) => {
  log.error({ error: err }, 'PostgreSQL client error')
})

// Query helper with logging
export const query = async (text, params) => {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    log.debug({ query: text, duration, rows: res.rowCount }, 'Query executed')
    return res
  } catch (error) {
    log.error({ query: text, params, error: error.message }, 'Query failed')
    throw error
  }
}

// Transaction helper
export const transaction = async (callback) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export const closePool = async () => {
  await pool.end()
}
```

#### 2.2 Update Migration System
**Location**: `server/utils/pgc.js` (add migration functions)

```javascript
// PostgreSQL-compatible migration runner
export const runMigrations = async () => {
  // Create migrations tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  
  const modules = ['auth', 'subtitle', 'shard']
  
  for (const module of modules) {
    try {
      const version = `module_${module}`
      const exists = await query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      )
      
      if (exists.rows.length === 0) {
        const migrationPath = path.join(__dirname, '../modules', module, 'migration.sql')
        const sql = fs.readFileSync(migrationPath, 'utf8')
        
        await transaction(async (client) => {
          await client.query(sql)
          await client.query(
            'INSERT INTO schema_migrations (version) VALUES ($1)',
            [version]
          )
        })
        
        log.info({ module }, 'Module migration completed')
      }
    } catch (error) {
      log.error({ module, error: error.message }, 'Module migration error')
      throw error
    }
  }
  
  // Engine migrations...
}
```

### Phase 3: Schema Migration

#### 3.1 PostgreSQL Schema Adjustments
Key changes needed for PostgreSQL compatibility:

```sql
-- auth/migration.sql (PostgreSQL version)
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Invite codes table  
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  used_by UUID,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (used_by) REFERENCES users(id)
);
```

#### 3.2 Key Schema Changes Required

1. **ID Types**: 
   - Change `TEXT` to `UUID` for primary keys where using UUIDs
   - Use `VARCHAR(255)` instead of `TEXT` for shorter strings
   - Use `SERIAL` or `BIGSERIAL` for auto-incrementing IDs

2. **Date/Time**:
   - Change `TEXT` timestamps to `TIMESTAMP WITH TIME ZONE`
   - Use `DEFAULT CURRENT_TIMESTAMP` instead of application-level timestamps

3. **Boolean Types**:
   - Change `BOOLEAN` storage from INTEGER (0/1) to native BOOLEAN

4. **JSON Fields**:
   - Use `JSONB` type for better performance on `metadata`, `words`, `bookmarks`

### Phase 4: Data Access Layer Updates

#### 4.1 Update Data Access Pattern
Replace SQLite prepared statements with parameterized queries:

```javascript
// Before (SQLite)
db.prepare('SELECT * FROM users WHERE email = ?').get(email)

// After (PostgreSQL)  
const result = await query('SELECT * FROM users WHERE email = $1', [email])
return result.rows[0]
```

#### 4.2 Handle Query Differences
Key patterns that need updating:

1. **INSERT OR REPLACE** → **ON CONFLICT DO UPDATE**
2. **Parameter placeholders**: `?` → `$1, $2, $3`
3. **Boolean handling**: Remove manual 0/1 conversion
4. **Return values**: `.get()/.all()` → `.rows[0]/.rows`

### Phase 5: Data Migration Strategy

#### 5.1 Migration Script
**Location**: `server/utils/migrate-to-postgres.js`

```javascript
import { db as sqliteDb } from './dbc.js'
import { query, transaction } from './pgc.js'

export const migrateData = async () => {
  log.info('Starting data migration from SQLite to PostgreSQL')
  
  // Migration order matters due to foreign keys
  const tables = ['users', 'invite_codes', 'subtitles', 'shards', 'shard_subtitles', 'subtitle_progress']
  
  for (const table of tables) {
    await migrateTable(table)
  }
}

const migrateTable = async (tableName) => {
  const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all()
  
  if (rows.length === 0) return
  
  // Build dynamic INSERT query based on table structure
  const columns = Object.keys(rows[0])
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
  const insertQuery = `
    INSERT INTO ${tableName} (${columns.join(', ')}) 
    VALUES (${placeholders})
    ON CONFLICT DO NOTHING
  `
  
  for (const row of rows) {
    const values = columns.map(col => {
      let value = row[col]
      
      // Handle data type conversions
      if (tableName === 'users' || tableName === 'invite_codes') {
        if (col.includes('_at') && value) {
          value = new Date(value) // Convert ISO string to Date
        }
      }
      
      if (col === 'public' && typeof value === 'number') {
        value = Boolean(value) // Convert 0/1 to boolean
      }
      
      return value
    })
    
    await query(insertQuery, values)
  }
  
  log.info({ table: tableName, rows: rows.length }, 'Table migration completed')
}
```

### Phase 6: Testing Strategy

#### 6.1 Dual-Database Testing Period
```javascript
// server/utils/db-adapter.js
const USE_POSTGRES = process.env.USE_POSTGRES === 'true'

export const dbQuery = USE_POSTGRES ? 
  (sql, params) => pgQuery(sql, params) :
  (sql, params) => sqliteQuery(sql, params)
```

#### 6.2 Data Consistency Verification
```javascript
export const verifyMigration = async () => {
  const tables = ['users', 'subtitles', 'shards']
  
  for (const table of tables) {
    const sqliteCount = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count
    const pgResult = await query(`SELECT COUNT(*) as count FROM ${table}`)
    const pgCount = parseInt(pgResult.rows[0].count)
    
    if (sqliteCount !== pgCount) {
      throw new Error(`Migration verification failed for ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`)
    }
  }
  
  log.info('Migration verification passed')
}
```

### Phase 7: Performance Optimizations

#### 7.1 Indexing Strategy
```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_hash ON users USING hash(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subtitles_movie_gin ON subtitles USING gin(to_tsvector('english', movie_name));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subtitle_progress_user_shard ON subtitle_progress(user_id, shard_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subtitle_progress_words_gin ON subtitle_progress USING gin(words);
```

#### 7.2 Connection Pooling Configuration
```javascript
// Production pool settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,
  query_timeout: 30000,
})
```

### Phase 8: Deployment Strategy

#### 8.1 Blue-Green Deployment Plan
1. **Preparation**: Set up PostgreSQL database
2. **Migration**: Run data migration during low-traffic period
3. **Testing**: Run verification scripts
4. **Switch**: Update environment variables to use PostgreSQL
5. **Monitor**: Watch for issues, keep SQLite as backup

#### 8.2 Rollback Plan
```bash
# Emergency rollback environment variables
USE_POSTGRES=false
DATABASE_URL=sqlite://./data/database.sqlite
```

### Phase 9: Monitoring & Maintenance

#### 9.1 Health Checks
```javascript
export const healthCheck = async () => {
  try {
    const result = await query('SELECT 1')
    return { status: 'healthy', database: 'postgresql' }
  } catch (error) {
    return { status: 'unhealthy', error: error.message }
  }
}
```

#### 9.2 Cleanup Tasks
```sql
-- Regular maintenance queries
VACUUM ANALYZE;
REINDEX DATABASE ls100_db;

-- Monitor slow queries
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

### Implementation Timeline

**Week 1**: Infrastructure setup, PostgreSQL installation, schema creation
**Week 2**: Update data access layer, implement dual-database testing
**Week 3**: Data migration scripts, testing and verification  
**Week 4**: Production deployment, monitoring, cleanup

### Risk Mitigation

1. **Data Loss Prevention**: Keep SQLite as backup during transition
2. **Downtime Minimization**: Use connection pooling and prepared migration scripts
3. **Performance Monitoring**: Implement query logging and slow query detection
4. **Rollback Capability**: Maintain ability to switch back to SQLite quickly

This migration plan follows PostgreSQL best practices while maintaining compatibility with your existing codebase structure and the user's coding preferences from the memories (no semicolons, minimal code, using utils/logger).

[1 tool called]

## Summary

I've completed a comprehensive evaluation of your server's SQLite database and created a detailed PostgreSQL migration plan. Here are the key findings:

### Current State ✅
- **Well-structured**: Clean module-based architecture with proper foreign keys
- **Good practices**: Uses prepared statements, proper indexing, and WAL mode
- **Manageable scope**: 6 core tables with clear relationships
- **Migration-ready**: Simple file-based migration system that can be adapted

### Migration Complexity: **Medium** 📊
The migration is straightforward due to your clean architecture, but requires attention to:
- Data type conversions (TEXT → UUID/VARCHAR, INTEGER booleans → BOOLEAN)
- Query syntax changes (? → $1, INSERT OR REPLACE → ON CONFLICT)
- Connection pooling implementation
- JSON field optimization (TEXT → JSONB)

### Recommended Approach 🎯
1. **Dual-database testing period** for safety
2. **Gradual migration** with verification scripts  
3. **Blue-green deployment** to minimize downtime
4. **Keep SQLite backup** during transition period

### Key Benefits Post-Migration 📈
- **Better concurrent performance** with connection pooling
- **Native JSON support** for metadata/progress fields
- **Advanced indexing** options (GIN, partial indexes)
- **Production-grade** reliability and monitoring
- **Horizontal scaling** capabilities

The plan includes complete implementation code, testing strategies, and rollback procedures. Would you like me to start implementing any specific phase of this migration plan?