import { db } from '../../utils/dbc/index.js'

const generateId = () => {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const create = (subtitleData) => {
  const subtitle = {
    subtitle_id: generateId(),
    filename: subtitleData.filename,
    movie_name: subtitleData.movie_name,
    language: subtitleData.language,
    duration: subtitleData.duration,
    oss_id: subtitleData.oss_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  db.prepare(`
    INSERT INTO subtitles VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subtitle.subtitle_id,
    subtitle.filename,
    subtitle.movie_name,
    subtitle.language,
    subtitle.duration,
    subtitle.oss_id,
    subtitle.created_at,
    subtitle.updated_at
  )
  
  return subtitle
}

export const findById = (subtitle_id) => {
  return db.prepare('SELECT * FROM subtitles WHERE subtitle_id = ?').get(subtitle_id)
}

export const findByOssId = (oss_id) => {
  return db.prepare('SELECT * FROM subtitles WHERE oss_id = ?').all(oss_id)
}

// Check if exact same metadata already exists for this content
export const findDuplicate = (filename, movie_name, language, oss_id) => {
  return db.prepare(`
    SELECT * FROM subtitles 
    WHERE filename = ? AND movie_name = ? AND language = ? AND oss_id = ?
  `).get(filename, movie_name, language, oss_id)
}

export const findAll = () => {
  return db.prepare('SELECT * FROM subtitles ORDER BY created_at DESC').all()
}

export const findByMovieName = (movieName) => {
  return db.prepare('SELECT * FROM subtitles WHERE movie_name LIKE ?').all(`%${movieName}%`)
}

export const update = (subtitle_id, updates) => {
  const updateFields = []
  const values = []
  
  if (updates.filename !== undefined) {
    updateFields.push('filename = ?')
    values.push(updates.filename)
  }
  if (updates.movie_name !== undefined) {
    updateFields.push('movie_name = ?')
    values.push(updates.movie_name)
  }
  if (updates.language !== undefined) {
    updateFields.push('language = ?')
    values.push(updates.language)
  }
  
  updateFields.push('updated_at = ?')
  values.push(new Date().toISOString())
  values.push(subtitle_id)
  
  return db.prepare(`
    UPDATE subtitles SET ${updateFields.join(', ')} WHERE subtitle_id = ?
  `).run(...values)
}

export const remove = (subtitle_id) => {
  return db.prepare('DELETE FROM subtitles WHERE subtitle_id = ?').run(subtitle_id)
}

export const getStats = () => {
  const result = db.prepare(`
    SELECT 
      COUNT(*) as total_subtitles,
      COUNT(DISTINCT oss_id) as unique_files,
      COUNT(DISTINCT movie_name) as unique_movies
    FROM subtitles
  `).get()
  return result
} 