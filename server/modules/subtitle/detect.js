// parseMovieInfo function moved to frontend (SubtitleShard.js)

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