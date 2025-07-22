import crypto from 'crypto'
import path from 'path'
import subtitle from 'subtitle'
import { fileURLToPath } from 'url'
import { Storage } from '../../utils/storage.js'
import * as subtitleModel from './data.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const storage = new Storage({
  type: 'local',
  basePath: path.join(__dirname, '../data/subtitles')
})

export const computeHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export const parseSrt = (content) => {
  try {
    const parsed = subtitle.parse(content)
    
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
    throw new Error('Failed to parse SRT content')
  }
}

export const uploadSubtitle = async (hash, buffer, metadata) => {
  // Check if exists
  const existing = subtitleModel.findByHash(hash)
  if (existing) {
    subtitleModel.incrementRef(hash)
    return { subtitle_id: hash, lightning: true, metadata: existing }
  }

  // Store file via abstract storage
  const filename = `${hash}.srt`
  await storage.put(filename, buffer)

  // Parse subtitle content
  const content = buffer.toString('utf8')
  const parsed = parseSrt(content)

  // Store metadata in database
  const subtitleData = {
    subtitle_id: hash,
    filename,
    movie_name: metadata.movie_name || 'Unknown Movie',
    language: metadata.language || 'en',
    duration: parsed.duration,
    ref_count: 1,
    first_uploaded: new Date().toISOString()
  }

  subtitleModel.create(subtitleData)
  return { subtitle_id: hash, lightning: false, metadata: subtitleData }
}

export const getSubtitle = async (hash) => {
  const filename = `${hash}.srt`
  return await storage.get(filename)
}

export const deleteSubtitle = async (hash) => {
  const filename = `${hash}.srt`
  await storage.delete(filename)
  subtitleModel.remove(hash)
} 