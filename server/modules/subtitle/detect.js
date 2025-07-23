// parseMovieInfo function moved to frontend (SubtitleShard.js)

import { franc } from 'franc'

// Map franc 3-letter codes to readable 2-letter codes
const francToLang = {
  eng: 'en',
  spa: 'es', 
  fra: 'fr',
  cmn: 'zh',  // Chinese Mandarin
  jpn: 'ja',
  kor: 'ko',
  deu: 'de',  // German
  rus: 'ru',
  por: 'pt',  // Portuguese
  ita: 'it',  // Italian
  nld: 'nl',  // Dutch
  tha: 'th',  // Thai
  vie: 'vi',  // Vietnamese
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
  
  if (textLines.length === 0) return ['en']
  
  const langCounts = {}
  
  // Process each line to collect language frequencies
  for (const line of textLines) {
    if (line.length < 5) continue  // Skip very short lines
    
    try {
      const detected = franc(line)
      if (detected !== 'und') {
        // Map franc code to readable language
        const lang = francToLang[detected] || detected
        langCounts[lang] = (langCounts[lang] || 0) + 1
      }
    } catch (error) {
      // Skip failed detections
    }
  }
  
  if (Object.keys(langCounts).length === 0) return ['en']
  
  // Sort by frequency (highest first)
  const sortedLangs = Object.entries(langCounts)
    .sort(([,a], [,b]) => b - a)
  
  const results = []
  const [topLang, topCount] = sortedLangs[0]
  
  // Always include top language
  results.push(topLang)
  
  // Include secondary languages if they reach 90% of top frequency
  for (let i = 1; i < sortedLangs.length; i++) {
    const [lang, count] = sortedLangs[i]
    const ratio = count / topCount
    
    if (ratio >= 0.9) {
      results.push(lang)
    } else {
      break  // Stop at first language below threshold
    }
  }
  
  return results
} 