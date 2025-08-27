import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { log } from '../logger.js'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})

pool.on('connect', () => log.debug('pg connected'))
pool.on('error', err => log.error({ err: err.message }, 'pg error'))

export const q = async (text, params = []) => {
  const t0 = Date.now()
  try {
    const res = await pool.query(text, params)
    const ms = Date.now() - t0
    log.debug({ ms, rows: res.rowCount }, 'pg query')
    return res
  } catch (err) {
    log.error({ err: err.message, text }, 'pg query failed')
    throw err
  }
}

export const tx = async fn => {
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    const r = await fn(c)
    await c.query('COMMIT')
    return r
  } catch (err) {
    await c.query('ROLLBACK')
    throw err
  } finally {
    c.release()
  }
}

export const end = async () => {
  await pool.end()
}

// pg migrator (SQL-first)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MIG_TABLE = 'schema_migrations'

const ensureMigTable = async () => {
  await q(`
    CREATE TABLE IF NOT EXISTS ${MIG_TABLE} (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
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

const readApplied = async () => {
  const r = await q(`SELECT version FROM ${MIG_TABLE}`)
  return new Set(r.rows.map(x => x.version))
}

const splitConcurrent = sql => {
  const lines = sql.split('\n')
  const regular = []
  const concurrent = []
  let buf = []
  const flush = () => {
    if (!buf.length) return
    const stmt = buf.join('\n').trim()
    if (!stmt) return
    if (/^create\s+index\s+concurrently/i.test(stmt)) concurrent.push(stmt)
    else regular.push(stmt)
    buf = []
  }
  for (const line of lines) {
    buf.push(line)
    if (line.trim().endsWith(';')) flush()
  }
  flush()
  return { regular, concurrent }
}

const migratePg = async () => {
  await ensureMigTable()
  const files = listSqlFiles()
  const applied = await readApplied()

  for (const f of files) {
    const ver = path.relative(path.join(__dirname, '../..'), f)
    if (applied.has(ver)) continue
    const sql = fs.readFileSync(f, 'utf8')
    const { regular, concurrent } = splitConcurrent(sql)

    if (regular.length) {
      await tx(async c => {
        for (const stmt of regular) await c.query(stmt)
        await c.query(`INSERT INTO ${MIG_TABLE} (version) VALUES ($1)`, [ver])
      })
      log.info({ file: ver }, 'migration applied')
    }

    for (const stmt of concurrent) {
      await q(stmt)
      log.info({ file: ver }, 'concurrent index created')
    }
  }
}

export const migrator = { migrate: migratePg }


