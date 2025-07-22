import { db } from '../../utils/dbc.js'

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

export const findById = (id) => {
  // Alias for findByHash for backward compatibility
  return findByHash(id)
}

export const findAll = () => {
  return db.prepare('SELECT * FROM subtitles ORDER BY first_uploaded DESC').all()
}

export const findByMovieName = (movieName) => {
  return db.prepare('SELECT * FROM subtitles WHERE movie_name LIKE ?').all(`%${movieName}%`)
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

export const getStats = () => {
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total_subtitles,
      SUM(ref_count) as total_references,
      COUNT(DISTINCT movie_name) as unique_movies
    FROM subtitles
  `).get()
  return result
} 