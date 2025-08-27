import { db } from './dbc/index.js'

// Create OSS file record (for new content)
export const create = (oss_id, file_size, meta_data = null) => {
  const now = new Date().toISOString()
  
  db.prepare(`
    INSERT INTO oss_files (oss_id, ref_count, file_size, meta_data, created_at, updated_at)
    VALUES (?, 1, ?, ?, ?, ?)
  `).run(oss_id, file_size, meta_data, now, now)
  
  return { oss_id, ref_count: 1, file_size, meta_data, created_at: now, updated_at: now }
}

// Find OSS file by hash
export const findById = (oss_id) => {
  return db.prepare('SELECT * FROM oss_files WHERE oss_id = ?').get(oss_id)
}

// Increment reference count (when subtitle references existing file)
export const incrementRef = (oss_id) => {
  const now = new Date().toISOString()
  
  db.prepare(`
    UPDATE oss_files 
    SET ref_count = ref_count + 1, updated_at = ?
    WHERE oss_id = ?
  `).run(now, oss_id)
  
  return findById(oss_id)
}

// Decrement reference count (when subtitle is deleted)
export const decrementRef = (oss_id) => {
  const now = new Date().toISOString()
  
  const _result = db.prepare(`
    UPDATE oss_files 
    SET ref_count = ref_count - 1, updated_at = ?
    WHERE oss_id = ?
  `).run(now, oss_id)
  
  const file = findById(oss_id)
  
  // Return whether file should be deleted (ref_count = 0)
  return {
    ...file,
    shouldDelete: file?.ref_count === 0
  }
}

// Get files with zero references (for cleanup)
export const getOrphanedFiles = () => {
  return db.prepare('SELECT * FROM oss_files WHERE ref_count = 0').all()
}

// Remove OSS file record (after physical file deletion)
export const remove = (oss_id) => {
  return db.prepare('DELETE FROM oss_files WHERE oss_id = ?').run(oss_id)
}

// Get storage statistics
export const getStats = () => {
  return db.prepare(`
    SELECT 
      COUNT(*) as total_files,
      SUM(ref_count) as total_references,
      SUM(file_size) as total_storage_bytes,
      AVG(ref_count) as avg_references_per_file
    FROM oss_files
  `).get()
} 