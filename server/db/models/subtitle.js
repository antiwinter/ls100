import { db } from '../connection.js'

export const create = (data) => {
  return db.prepare(`
    INSERT INTO subtitles VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.subtitle_id, data.filename, data.movie_name,
    data.language, data.duration, data.ref_count, data.first_uploaded
  )
}

export const findByHash = (hash) => {
  return db.prepare('SELECT * FROM subtitles WHERE subtitle_id = ?').get(hash)
}

export const incrementRef = (hash) => {
  return db.prepare('UPDATE subtitles SET ref_count = ref_count + 1 WHERE subtitle_id = ?').run(hash)
}

export const decrementRef = (hash) => {
  return db.prepare('UPDATE subtitles SET ref_count = ref_count - 1 WHERE subtitle_id = ?').run(hash)
}

export const remove = (hash) => {
  return db.prepare('DELETE FROM subtitles WHERE subtitle_id = ?').run(hash)
} 