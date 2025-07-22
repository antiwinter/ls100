import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '../data/database.sqlite')

// Create database connection
export const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// WAL mode for better performance
db.pragma('journal_mode = WAL')

// Initialize database with migrations
export const runMigrations = () => {
  const migrations = [
    '001_initial.sql',
    '002_indexes.sql'
  ]
  
  migrations.forEach(migration => {
    try {
      const migrationPath = path.join(__dirname, 'migrations', migration)
      const sql = fs.readFileSync(migrationPath, 'utf8')
      db.exec(sql)
      console.log(`✅ Migration ${migration} completed`)
    } catch (error) {
      console.log(`⚠️ Migration ${migration} already applied or error:`, error.message)
    }
  })
}

// Close database connection
export const closeDb = () => {
  db.close()
} 