-- Migration: Add meta_data column to oss_files table
-- Date: 2024-12-19

-- Add meta_data column to oss_files table
ALTER TABLE oss_files ADD COLUMN meta_data TEXT;

-- Update existing records with generated filenames based on movie_name and language
-- Format: movie_name_lang_autonamed.srt
UPDATE oss_files 
SET meta_data = (
  SELECT JSON_OBJECT('filename', 
    COALESCE(s.movie_name, 'Unknown') || '_' || 
    COALESCE(s.language, 'auto') || '_autonamed.srt'
  )
  FROM subtitles s 
  WHERE s.oss_id = oss_files.oss_id 
  LIMIT 1
)
WHERE meta_data IS NULL; 