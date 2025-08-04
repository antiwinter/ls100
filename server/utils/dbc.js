import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { getEngineTypes } from '../shards/engines.js'
import { log } from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '../data/database.sqlite')

// Create database connection
export const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// WAL mode for better performance
db.pragma('journal_mode = WAL')

// Initialize database with module-based migrations
export const runMigrations = () => {
  // Module migration order (auth first due to foreign key dependencies)
  const modules = ['auth', 'subtitle', 'shard']
  
  modules.forEach(module => {
    try {
      const migrationPath = path.join(__dirname, '../modules', module, 'migration.sql')
      const sql = fs.readFileSync(migrationPath, 'utf8')
      db.exec(sql)
      log.info({ module }, 'Module migration completed')
    } catch (error) {
      log.error({ module, error: error.message }, 'Module migration error')
    }
  })
  
  // Engine-specific migrations (shard engines)
  const engines = getEngineTypes()
  
  engines.forEach(engine => {
    try {
      const migrationPath = path.join(__dirname, '../shards', engine, 'migration.sql')
      const sql = fs.readFileSync(migrationPath, 'utf8')
      db.exec(sql)
      log.info({ engine }, 'Engine migration completed')
    } catch (error) {
      log.error({ engine, error: error.message }, 'Engine migration error')
    }
  })
}

// Close database connection
export const closeDb = () => {
  db.close()
} 