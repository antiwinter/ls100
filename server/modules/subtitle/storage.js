import crypto from 'crypto'
import path from 'path'
import { parseSync as parseSubtitle } from 'subtitle'
import { fileURLToPath } from 'url'
import { Storage } from '../../utils/storage.js'
import * as subtitleModel from './data.js'
import * as ossModel from '../../utils/oss-files.js'
import { log } from '../../utils/logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const storage = new Storage({
  type: 'local',
  basePath: path.join(__dirname, '../../data/subtitles')
})

export const computeHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export const parseSrt = (content) => {
  try {
    const parsed = parseSubtitle(content)
    
    const lines = parsed.length
    const firstTime = parsed[0]?.start || 0
    const lastTime = parsed[parsed.length - 1]?.end || 0
    const duration = Math.floor((lastTime - firstTime) / 1000)
    
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const seconds = duration % 60
    const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    
    return { lines, duration: durationStr, parsed }
  } catch (error) {
    log.error({ error }, 'SRT Parse Error')
    throw new Error(`Failed to parse SRT content: ${error.message}`)
  }
}



export const uploadSubtitle = async (oss_id, buffer, metadata) => {
  // Check for exact duplicate (same content + same metadata)
  const duplicate = await subtitleModel.findDuplicate(
    metadata.filename,
    metadata.movie_name,
    metadata.language,
    oss_id
  )
  
  if (duplicate) {
    // Verify physical file exists before claiming lightning
    const filename = `${oss_id}.srt`
    const fileExists = await storage.exists(filename)
    
    if (!fileExists) {
      log.warn({ oss_id, filename }, 'Database record exists but physical file missing - will recreate file')
      await storage.put(filename, buffer)
      log.info({ filename }, 'Recreated missing subtitle file')
    }
    
    return { subtitle_id: duplicate.subtitle_id, lightning: true, metadata: duplicate }
  }

  // Check if OSS file already exists
  let ossFile = await ossModel.findById(oss_id)
  if (!ossFile) {
    // New file content - store it
    const filename = `${oss_id}.srt`
    await storage.put(filename, buffer)
    
    // Create OSS file record (keep meta_data for future use, but don't populate for now)
    ossFile = await ossModel.create(oss_id, buffer.length)
  } else {
    // OSS file record exists, but verify physical file exists
    const filename = `${oss_id}.srt`
    const fileExists = await storage.exists(filename)
    
    if (!fileExists) {
      log.warn({ oss_id, filename }, 'OSS record exists but physical file missing - recreating file')
      await storage.put(filename, buffer)
      log.info({ filename }, 'Recreated missing subtitle file for existing OSS record')
    }
    
    // File content exists (or recreated), increment reference
    ossFile = await ossModel.incrementRef(oss_id)
  }

  // Parse subtitle content for duration
  const content = buffer.toString('utf8')
  const parsed = parseSrt(content)

  // Create new subtitle record with unique metadata
  const subtitleData = {
    filename: metadata.filename,
    movie_name: metadata.movie_name || 'Unknown Movie',
    language: metadata.language || 'en',
    duration: parsed.duration,
    oss_id: oss_id
  }

  const subtitle = await subtitleModel.create(subtitleData)
  
  // Lightning if file content existed (but different metadata)
  const isLightning = ossFile.ref_count > 1
  
  return { 
    subtitle_id: subtitle.subtitle_id, 
    lightning: isLightning, 
    metadata: subtitle 
  }
}

export const getSubtitle = async (hash) => {
  const filename = `${hash}.srt`
  try {
    return await storage.get(filename)
  } catch (error) {
    log.error({ filename, hash, error: error.message }, 'Failed to retrieve subtitle file')
    throw error
  }
}

export const deleteSubtitle = async (hash) => {
  const filename = `${hash}.srt`
  await storage.delete(filename)
  await subtitleModel.remove(hash)
} 