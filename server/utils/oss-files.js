import { q } from './dbc/index.js'

// Create OSS file record (for new content)
export const create = async (oss_id, file_size, meta_data = null) => {
  const now = new Date().toISOString()
  
  await q('INSERT INTO oss_files (oss_id, ref_count, file_size, meta_data, created_at, updated_at) VALUES ($1, 1, $2, $3, $4, $5)', [oss_id, file_size, meta_data, now, now])
  
  return { oss_id, ref_count: 1, file_size, meta_data, created_at: now, updated_at: now }
}

// Find OSS file by hash
export const findById = async (oss_id) => {
  const r = await q('SELECT * FROM oss_files WHERE oss_id = $1', [oss_id])
  return r.rows?.[0] || null
}

// Increment reference count (when subtitle references existing file)
export const incrementRef = async (oss_id) => {
  const now = new Date().toISOString()
  await q('UPDATE oss_files SET ref_count = ref_count + 1, updated_at = $1 WHERE oss_id = $2', [now, oss_id])
  return findById(oss_id)
}

// Decrement reference count (when subtitle is deleted)
export const decrementRef = async (oss_id) => {
  const now = new Date().toISOString()
  await q('UPDATE oss_files SET ref_count = ref_count - 1, updated_at = $1 WHERE oss_id = $2', [now, oss_id])
  const file = findById(oss_id)
  
  // Return whether file should be deleted (ref_count = 0)
  return {
    ...file,
    shouldDelete: file?.ref_count === 0
  }
}

// Get files with zero references (for cleanup)
export const getOrphanedFiles = async () => {
  const r = await q('SELECT * FROM oss_files WHERE ref_count = 0')
  return r.rows
}

// Remove OSS file record (after physical file deletion)
export const remove = async (oss_id) => {
  await q('DELETE FROM oss_files WHERE oss_id = $1', [oss_id])
}

// Get storage statistics
export const getStats = async () => {
  const r = await q(`
    SELECT 
      COUNT(*) as total_files,
      SUM(ref_count) as total_references,
      SUM(file_size) as total_storage_bytes,
      AVG(ref_count) as avg_references_per_file
    FROM oss_files
  `)
  return r.rows?.[0] || { total_files: 0, total_references: 0, total_storage_bytes: 0, avg_references_per_file: 0 }
}