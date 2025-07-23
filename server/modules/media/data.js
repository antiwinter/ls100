// Media scraping and filename parsing module
import fs from 'fs'

// Simple filename parser (fallback if external lib not available)
const parseFilename = (filename) => {
  // Remove extension
  const name = filename.replace(/\.(srt|vtt|ass|ssa|sub)$/i, '')
  
  // Extract year
  const yearMatch = name.match(/[.(](\d{4})[.)]/)
  const year = yearMatch ? parseInt(yearMatch[1]) : null
  
  // Extract resolution
  const resMatch = name.match(/(\d{3,4}p)/i)
  const resolution = resMatch ? resMatch[1] : null
  
  // Extract season/episode for TV shows
  const seasonMatch = name.match(/s(\d+)e(\d+)/i)
  const season = seasonMatch ? parseInt(seasonMatch[1]) : null
  const episode = seasonMatch ? parseInt(seasonMatch[2]) : null
  
  // Clean title (remove year, quality markers, etc.)
  let title = name
    .replace(/[.(]\d{4}[.)]/, '') // year
    .replace(/\d{3,4}p/i, '') // resolution
    .replace(/s\d+e\d+/i, '') // season/episode
    .replace(/\.(BluRay|WEB-?DL|HDRip|BRRip|DVDRip)/i, '') // source
    .replace(/\.(x264|x265|h264|h265|HEVC)/i, '') // codec
    .replace(/[._-]+/g, ' ') // separators to spaces
    .trim()
  
  return {
    title,
    year,
    resolution,
    season,
    episode,
    isTV: season !== null && episode !== null
  }
}

// TMDb API integration
class TMDbClient {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.baseUrl = 'https://api.themoviedb.org/3'
  }
  
  async search(query, type = 'movie') {
    if (!this.apiKey) {
      console.debug('TMDb API key not configured')
      return null
    }
    
    try {
      const axios = await import('axios').then(m => m.default).catch(() => null)
      if (!axios) {
        console.debug('axios not available, skipping TMDb search')
        return null
      }
      
      const url = `${this.baseUrl}/search/${type}`
      const res = await axios.get(url, {
        params: {
          api_key: this.apiKey,
          query
        }
      })
      
      return res.data.results[0] || null
    } catch (err) {
      console.debug('TMDb search failed:', err.message)
      return null
    }
  }
  
  async getDetails(id, type = 'movie') {
    if (!this.apiKey) return null
    
    try {
      const axios = await import('axios').then(m => m.default).catch(() => null)
      if (!axios) return null
      
      const url = `${this.baseUrl}/${type}/${id}`
      const res = await axios.get(url, {
        params: { api_key: this.apiKey }
      })
      
      return res.data
    } catch (err) {
      console.debug('TMDb details failed:', err.message)
      return null
    }
  }
}

// Main media info extraction
const extractMediaInfo = async (filename, apiKey = null) => {
  console.debug('Extracting media info for:', filename)
  
  // Parse filename first
  const parsed = parseFilename(filename)
  console.debug('Parsed:', parsed)
  
  // If no API key, return parsed info only
  if (!apiKey) {
    return { ...parsed, source: 'filename' }
  }
  
  // Search TMDb for enhanced metadata
  const tmdb = new TMDbClient(apiKey)
  const searchType = parsed.isTV ? 'tv' : 'movie'
  
  let result = await tmdb.search(parsed.title, searchType)
  
  // If no results and has year, try without year
  if (!result && parsed.year) {
    const titleOnly = parsed.title
    result = await tmdb.search(titleOnly, searchType)
  }
  
  if (result) {
    console.debug('TMDb match found:', result.title || result.name)
    
    // Get detailed info
    const details = await tmdb.getDetails(result.id, searchType)
    
    return {
      ...parsed,
      tmdbId: result.id,
      title: result.title || result.name,
      overview: result.overview,
      poster: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : null,
      backdrop: result.backdrop_path ? `https://image.tmdb.org/t/p/w1280${result.backdrop_path}` : null,
      releaseDate: result.release_date || result.first_air_date,
      rating: result.vote_average,
      genres: details?.genres?.map(g => g.name) || [],
      source: 'tmdb'
    }
  }
  
  return { ...parsed, source: 'filename' }
}

// Batch process multiple files
const batchExtract = async (filenames, apiKey = null) => {
  const results = []
  
  for (const filename of filenames) {
    try {
      const info = await extractMediaInfo(filename, apiKey)
      results.push({ filename, ...info })
      
      // Small delay to respect API limits
      if (apiKey) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (err) {
      console.debug('Failed to extract info for', filename, err.message)
      results.push({ filename, error: err.message })
    }
  }
  
  return results
}

export {
  parseFilename,
  extractMediaInfo,
  batchExtract,
  TMDbClient
}