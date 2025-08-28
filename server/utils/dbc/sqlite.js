import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { log } from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = process.env.DATABASE
const dbPath = envPath && (envPath.includes('/') || /\.sqlite$|\.db$/i.test(envPath))
  ? envPath
  : path.join(__dirname, '../../data/database.sqlite')
const db = new Database(dbPath)

db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')

const fromPgPlaceholders = (sql, params = []) => {
  const matches = [...sql.matchAll(/\$([1-9][0-9]*)/g)]
  if (matches.length === 0) return { text: sql, params }
  const newParams = []
  const text = sql.replace(/\$([1-9][0-9]*)/g, (_m, idx) => {
    const i = parseInt(idx, 10) - 1
    newParams.push(params[i])
    return '?'
  })
  return { text, params: newParams }
}

export const q = async (sql, params = []) => {
  const { text, params: mapped } = fromPgPlaceholders(sql, params)
  const trimmed = text.trim().toLowerCase()
  if (trimmed.startsWith('select')) {
    const stmt = db.prepare(text)
    const rows = stmt.all(...mapped)
    return { rows, rowCount: rows.length }
  } else {
    const stmt = db.prepare(text)
    const info = stmt.run(...mapped)
    return { rows: [], rowCount: info.changes || 0 }
  }
}

export const tx = async fn => {
  const wrap = db.transaction((cb) => cb(db))
  return wrap((c) => fn({
    query: async (text, params = []) => {
      const { text: t, params: mapped } = fromPgPlaceholders(text, params)
      const trimmed = t.trim().toLowerCase()
      if (trimmed.startsWith('select')) {
        const stmt = c.prepare(t)
        const rows = stmt.all(...mapped)
        return { rows, rowCount: rows.length }
      } else {
        const stmt = c.prepare(t)
        const info = stmt.run(...mapped)
        return { rows: [], rowCount: info.changes || 0 }
      }
    }
  }))
}

export const end = async () => {
  db.close()
}

// sqlite migrator with same behavior as pg migrator
const MIG_TABLE = 'schema_migrations'

const ensureMigTable = () => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS ${MIG_TABLE} (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run()
}

const listSqlFiles = () => {
  const bases = [
    path.join(__dirname, '../../modules'),
    path.join(__dirname, '../../shards')
  ]
  const files = []
  for (const d of bases) {
    if (!fs.existsSync(d)) continue
    const stack = [d]
    while (stack.length) {
      const cur = stack.pop()
      const ents = fs.readdirSync(cur, { withFileTypes: true })
      for (const e of ents) {
        const p = path.join(cur, e.name)
        if (e.isDirectory()) stack.push(p)
        else if (e.isFile() && e.name.endsWith('.sql')) files.push(p)
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b))
}

const readApplied = () => {
  ensureMigTable()
  return new Set(db.prepare(`SELECT version FROM ${MIG_TABLE}`).all().map(x => x.version))
}

const splitConcurrent = sql => {
  const lines = sql.split('\n')
  const regular = []
  let buf = []
  const flush = () => {
    if (!buf.length) return
    const stmt = buf.join('\n').trim()
    if (!stmt) return
    regular.push(stmt)
    buf = []
  }
  for (const line of lines) {
    buf.push(line)
    if (line.trim().endsWith(';')) flush()
  }
  flush()
  return { regular }
}

const migrateSqlite = async () => {
  ensureMigTable()
  const files = listSqlFiles()
  const applied = readApplied()

  for (const f of files) {
    const ver = path.relative(path.join(__dirname, '../..'), f)
    if (applied.has(ver)) continue
    const sql = fs.readFileSync(f, 'utf8')
    const { regular } = splitConcurrent(sql)
    const trx = db.transaction(() => {
      for (const stmt of regular) {
        try {
          db.exec(stmt)
        } catch (stmtError) {
          // Ignore "duplicate column" errors for ALTER TABLE ADD COLUMN
          if (stmtError.code === 'SQLITE_ERROR' && 
              stmtError.message.includes('duplicate column name') &&
              stmt.trim().toUpperCase().includes('ADD COLUMN')) {
            continue
          }
          throw stmtError
        }
      }
      db.prepare(`INSERT INTO ${MIG_TABLE} (version) VALUES (?)`).run(ver)
    })
    trx()
    log.info({ file: ver }, 'migration applied (sqlite)')
  }
}

export const migrator = { migrate: migrateSqlite }


