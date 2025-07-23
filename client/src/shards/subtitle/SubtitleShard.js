import { apiCall } from '../../config/api'

// Content detector with confidence scoring
export const detect = (filename, buffer) => {
  const content = buffer.toString('utf8')
  
  // Check file extension
  const hasExt = /\.(srt|vtt|ass|ssa|sub)$/i.test(filename)
  
  // Check content pattern (timestamps + text)
  const hasPattern = /\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(content)
  
  // Extract movie info for metadata
  const metadata = parseMovieInfo(filename)
  
  return {
    match: hasExt || hasPattern,
    confidence: hasExt ? 0.9 : (hasPattern ? 0.7 : 0.0),
    metadata
  }
}

// Parse movie info from filename (moved from backend)
const parseMovieInfo = (filename) => {
  if (!filename) return { movieName: null, language: null, year: null }
  
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')
  
  // Common language patterns (more comprehensive)
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
  
  // Clean up movie name (more comprehensive)
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
    movieName: movieName || 'Unknown Movie',
    language: language || 'en',
    year: year
  }
}

// Generate text-based cover
export const generateCover = (title) => ({
  type: 'text',
  title,
  style: 'movie-poster',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  textColor: '#ffffff',
  fontSize: 'clamp(16px, 4vw, 24px)'
})

// Create shard with full flow
export const createShard = async (file, user) => {
  // 1. Upload subtitle file
  const formData = new FormData()
  formData.append('subtitle', file)
  
  const uploadResult = await apiCall('/api/subtitles/upload', {
    method: 'POST',
    body: formData
  })
  
  // 2. Create shard with auto-detected metadata
  const { metadata } = uploadResult
  const cover = generateCover(metadata.movie_name)
  
  const shard = await apiCall('/api/shards', {
    method: 'POST',
    body: JSON.stringify({
      name: metadata.movie_name,
      description: `Movie: ${metadata.movie_name} (${metadata.language})`,
      subtitles: [uploadResult.subtitle_id],
      cover: JSON.stringify(cover),
      public: false
    })
  })
  
  return shard
} 