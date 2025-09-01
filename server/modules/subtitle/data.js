import { q } from '../../utils/dbc/index.js'

const generateId = () => {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const create = async (subtitleData) => {
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
  
  await q('INSERT INTO subtitles (subtitle_id, filename, movie_name, language, duration, oss_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
    subtitle.subtitle_id,
    subtitle.filename,
    subtitle.movie_name,
    subtitle.language,
    subtitle.duration,
    subtitle.oss_id,
    subtitle.created_at,
    subtitle.updated_at
  ])
  
  return subtitle
}

export const findById = async (subtitle_id) => {
  const r = await q('SELECT * FROM subtitles WHERE subtitle_id = $1', [subtitle_id])
  return r.rows?.[0] || null
}

export const findByOssId = async (oss_id) => {
  const r = await q('SELECT * FROM subtitles WHERE oss_id = $1', [oss_id])
  return r.rows
}

// Check if exact same metadata already exists for this content
export const findDuplicate = async (filename, movie_name, language, oss_id) => {
  const r = await q('SELECT * FROM subtitles WHERE filename = $1 AND movie_name = $2 AND language = $3 AND oss_id = $4', [filename, movie_name, language, oss_id])
  return r.rows?.[0] || null
}

export const findAll = async () => {
  const r = await q('SELECT * FROM subtitles ORDER BY created_at DESC')
  return r.rows
}

export const findByMovieName = async (movieName) => {
  const r = await q('SELECT * FROM subtitles WHERE movie_name LIKE $1', [`%${movieName}%`])
  return r.rows
}

export const update = async (subtitle_id, updates) => {
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
  
  let paramIndex = 1
  const setClause = updateFields.join(', ').replaceAll('?', () => `$${paramIndex++}`)
  const sql = `UPDATE subtitles SET ${setClause} WHERE subtitle_id = $${values.length}`
  await q(sql, values)
}

export const remove = async (subtitle_id) => {
  await q('DELETE FROM subtitles WHERE subtitle_id = $1', [subtitle_id])
}

export const getStats = async () => {
  const r = await q(`
    SELECT 
      COUNT(*) as total_subtitles,
      COUNT(DISTINCT oss_id) as unique_files,
      COUNT(DISTINCT movie_name) as unique_movies
    FROM subtitles
  `)
  return r.rows?.[0] || { total_subtitles: 0, unique_files: 0, unique_movies: 0 }
}