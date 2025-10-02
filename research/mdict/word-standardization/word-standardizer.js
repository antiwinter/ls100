/**
 * Word Standardizer - Lemmatize words for dictionary lookup
 * 
 * Based on research showing 95-99% success rate with wink-lemmatizer
 * See WORD_STANDARDIZATION.md for full research results
 */

import lemmatizer from 'wink-lemmatizer'

// Cache for performance
const cache = new Map()

/**
 * Standardize a word to its base form for dictionary lookup
 * 
 * @param {string} word - The word to standardize
 * @returns {string} - The standardized (lemmatized) word
 * 
 * @example
 * standardizeWord('books') // 'book'
 * standardizeWord('children') // 'child'
 * standardizeWord('going') // 'go'
 * standardizeWord('better') // 'good'
 * standardizeWord("people's") // 'people'
 */
export function standardizeWord(word) {
  if (!word) return ''
  
  // Check cache first
  if (cache.has(word)) {
    return cache.get(word)
  }
  
  // Remove possessive 's first
  let cleaned = word.replace(/'s$/i, '')
  
  // Convert to lowercase for lemmatization
  cleaned = cleaned.toLowerCase()
  
  // Try all forms and pick the shortest (most likely to be base form)
  const candidates = [
    lemmatizer.noun(cleaned),
    lemmatizer.verb(cleaned),
    lemmatizer.adjective(cleaned)
  ].filter(w => w !== cleaned) // Only consider if it changed
  
  const result = candidates.length > 0
    ? candidates.reduce((a, b) => a.length <= b.length ? a : b)
    : cleaned
  
  // Cache the result
  cache.set(word, result)
  
  return result
}

/**
 * Standardize multiple words at once
 * 
 * @param {string[]} words - Array of words to standardize
 * @returns {string[]} - Array of standardized words
 */
export function standardizeWords(words) {
  return words.map(standardizeWord)
}

/**
 * Clear the standardization cache
 */
export function clearCache() {
  cache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: cache.size,
    maxSize: 10000 // Arbitrary limit for safety
  }
}

// Optional: Limit cache size to prevent memory issues
setInterval(() => {
  if (cache.size > 10000) {
    // Keep only the most recent 5000 entries (simple LRU-like behavior)
    const entries = Array.from(cache.entries())
    cache.clear()
    entries.slice(-5000).forEach(([key, value]) => {
      cache.set(key, value)
    })
  }
}, 60000) // Check every minute

