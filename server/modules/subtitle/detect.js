// Auto-detect movie name and language from filename
export const parseMovieInfo = (filename) => {
  if (!filename) return { movieName: null, language: null, year: null }
  
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Common language patterns
  const langPatterns = [
    /\.([a-z]{2})$/i,                    // .en, .zh, .es
    /\.([a-z]{2}-[A-Z]{2})$/i,          // .en-US, .zh-CN, .pt-BR
    /\[([a-z]{2})\]/i,                   // [en], [zh]
    /\[([a-z]{2}-[A-Z]{2})\]/i,         // [en-US], [zh-CN]
    /\b([a-z]{2})\b(?=\.[^/.]*$)/i      // standalone language before extension
  ]
  
  // Extract language
  let language = null
  let cleanName = nameWithoutExt
  
  for (const pattern of langPatterns) {
    const match = nameWithoutExt.match(pattern)
    if (match) {
      language = match[1].toLowerCase()
      cleanName = nameWithoutExt.replace(pattern, '')
      break
    }
  }
  
  // Extract year
  const yearMatch = cleanName.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? parseInt(yearMatch[0]) : null
  
  // Clean up movie name
  let movieName = cleanName
    // Remove year
    .replace(/\b(19|20)\d{2}\b/g, '')
    // Remove quality/format markers
    .replace(/\b(720p|1080p|4K|BluRay|WEBRip|HDRip|CAMRip|DVDRip|BRRip)\b/gi, '')
    // Remove codec info
    .replace(/\b(x264|x265|H\.264|H\.265|HEVC|AVC)\b/gi, '')
    // Remove group tags in brackets/parentheses
    .replace(/[\[\(][^\]\)]*[\]\)]/g, '')
    // Replace dots and underscores with spaces
    .replace(/[._-]/g, ' ')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim()
  
  // Capitalize words
  movieName = movieName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
  
  return {
    movieName: movieName || null,
    language: language,
    year: year
  }
}

import { franc } from 'franc'

// Small lang name map for common ones
const langNames = {
  en: 'English',
  es: 'Spanish', 
  fr: 'French',
  zh: 'Chinese',
  ja: 'Japanese'
}

// Detect languages from subtitle content - returns array of franc codes
export const detectLang = (content) => {
  const lines = content.split('\n')
  const textLines = lines.filter(line => 
    !line.match(/^\d+$/) &&                    // Not subtitle number
    !line.match(/\d{2}:\d{2}:\d{2}/) &&       // Not timestamp
    !line.match(/^-->\s*$/) &&                // Not arrow
    line.trim().length > 3                    // Has meaningful content
  )
  
  if (textLines.length === 0) return []
  
  const langs = new Set()
  
  // Process each line to collect language tags
  for (const line of textLines) {
    if (line.length < 5) continue  // Skip very short lines
    
    try {
      const detected = franc(line)
      if (detected !== 'und') {
        langs.add(detected)
      }
    } catch (error) {
      // Skip failed detections
    }
  }
  
  // Return array of detected languages, fallback to English
  return langs.size > 0 ? Array.from(langs) : ['en']
} 