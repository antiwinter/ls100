
import { detectLanguageWithConfidence } from '../../utils/languageDetection'
import { SubtitleShardEditor } from './SubtitleShardEditor.jsx'
import { SubtitleCover } from './SubtitleCover.jsx'
import { SubtitleReader } from './reader/SubtitleReader.jsx'
import { log } from '../../utils/logger'


// Content detector with confidence scoring
export const detect = (filename, buffer) => {
  log.debug('Detecting subtitle file:', filename, 'size:', buffer.byteLength || buffer.length)

  // Handle both ArrayBuffer (browser) and Buffer (Node.js)
  let content
  if (buffer instanceof ArrayBuffer) {
    content = new TextDecoder('utf-8').decode(buffer)
  } else {
    content = buffer.toString('utf8')
  }

  log.debug('🔍 Content preview (first 200 chars):', content.substring(0, 200))

  // Check file extension
  const hasExt = /\.(srt|vtt|ass|ssa|sub)$/i.test(filename)

  // Check content pattern (timestamps + text)
  const hasPattern = /\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(content)

  log.debug('🔍 File validation:', { hasExt, hasPattern })

  // Extract movie info for metadata
  const metadata = parseMovieInfo(filename)
  log.debug('🔍 Parsed metadata from filename:', metadata)

  // For subtitle files, also detect language from content
  if (hasExt || hasPattern) {
    try {
      const langDetection = detectLanguageWithConfidence(content)
      log.debug('🔍 Language detection result:', langDetection)

      // Enhance metadata with detected language (overrides filename-based detection)
      metadata.language = langDetection.language
      metadata.languageConfidence = langDetection.confidence
      metadata.textLinesCount = langDetection.textLinesCount

      log.debug('🔍 Final metadata after language detection:', metadata)
    } catch (langError) {
      log.warn('❌ Language detection failed:', langError)
      // Keep filename-based language detection as fallback
      metadata.languageConfidence = 0.3
    }
  }

  const result = {
    match: hasExt || hasPattern,
    confidence: hasExt ? 0.9 : hasPattern ? 0.7 : 0.0,
    metadata: {
      ...metadata,
      // Include suggested name from movie parsing (null if not found)
      suggestedName: metadata?.movieName || null
    }
  }

  log.debug('🔍 Final detection result:', result)

  return result
}

// Parse movie info from filename (moved from backend)
const parseMovieInfo = (filename) => {
  if (!filename) return { movieName: null, language: null, year: null }

  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')

  // Common language patterns (more comprehensive)
  const langPatterns = [
    /\.([a-z]{2})$/i, // .en, .zh, .es
    /\.([a-z]{2}-[A-Z]{2})$/i, // .en-US, .zh-CN, .pt-BR
    /\[([a-z]{2})\]/i, // [en], [zh]
    /\[([a-z]{2}-[A-Z]{2})\]/i, // [en-US], [zh-CN]
    /\b([a-z]{2})\b(?=\.[^/.]*$)/i // standalone language before extension
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

  // Extract year first as it's a good separator
  const yearMatch = cleanName.match(/\b(19|20)\d{2}\b/)
  const year = yearMatch ? parseInt(yearMatch[0]) : null

  // Smart movie title extraction
  let movieTitle = cleanName

  // If we found a year, take everything before it as the movie title
  if (yearMatch) {
    const yearIndex = cleanName.indexOf(yearMatch[0])
    movieTitle = cleanName.substring(0, yearIndex)
  } else {
    // If no year, look for common quality indicators and stop there
    const qualityMarkers = /\b(720p|1080p|2160p|4K|BluRay|WEBRip|HDRip|CAMRip|DVDRip|BRRip|WEB-DL|HDTV|REMASTERED|EXTENDED|UNRATED|DIRECTORS?\s*CUT|PROPER|REPACK)\b/i
    const qualityMatch = movieTitle.match(qualityMarkers)
    if (qualityMatch) {
      const qualityIndex = movieTitle.indexOf(qualityMatch[0])
      movieTitle = movieTitle.substring(0, qualityIndex)
    }
  }

  // log.debug('🔍 Movie title:', movieTitle)
  // Clean up the movie title
  let movieName = movieTitle
    // Replace dots, underscores, and dashes with spaces
    .replace(/[._-]/g, ' ')
    // Remove brackets and their contents (both complete pairs and dangling ones)
    .replace(/\([^)]*\)/g, '')  // Remove complete parentheses pairs
    .replace(/[()]/g, '')       // Remove any remaining dangling parentheses
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim()
  // log.debug({ movieName })

  // Capitalize words properly
  movieName = movieName
    .split(' ')
    .filter(word => word.length > 0) // Remove empty words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')

  return {
    movieName: movieName || 'Unknown Movie',
    language: language || 'en',
    year: year
  }
}

// Deprecated attribute-based cover generator removed; use CoverComponent instead

// Shard type metadata
export const shardTypeInfo = {
  name: 'subtitle',
  displayName: 'Subtitle Shard',
  color: '#4facfe'
}

// Engine components
export const EditorComponent = SubtitleShardEditor
export const ReaderComponent = SubtitleReader
export const CoverComponent = SubtitleCover



// Store NEW files locally (migration already happened during list/read)
export const processData = async (shard, fileStore) => {
  const languages = shard.meta?.languages

  if (languages && Array.isArray(languages)) {
    for (const language of languages) {
      // Only process NEW file uploads (user adding new subtitle)
      if (language.file && language.file instanceof Blob) {
        log.info('📤 Storing new file locally:', language.filename)

        const nvId = await fileStore.store(
          language.filename,
          language.file,
          shard.id || 'temp'
        )

        log.info('✅ File stored locally, nvId:', nvId)

        // Replace file with nvId
        delete language.file
        language.nvId = nvId
      }
      // Note: Old files with subtitle_id will be migrated by fileStore.get() when reader opens them
    }
  }
}

// Cleanup function called when shard is deleted
export const cleanup = async (_shard, _allShards) => {
  // No cleanup needed for subtitle shards - files are managed server-side
}
