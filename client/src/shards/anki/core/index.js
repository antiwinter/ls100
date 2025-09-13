import db from './db.js'
import noteManager from './noteManager.js'
import mediaManager from '../../../utils/mediaManager.js'
import { render } from './renderDefault.js'
import { StudyEngine } from './studyEngine.js'
import { log } from '../../../utils/logger.js'
import { genId } from '../../../utils/idGenerator.js'

// Parse HTML content and extract media references
async function parseFields(fields, blobs = {}) {
  if (!Array.isArray(fields)) fields = [fields]

  const media = []
  const cooked = []

  for (const field of fields) {
    if (!field) {
      cooked.push('')
      continue
    }

    let result = field

    // Handle [sound:filename] tags (for audio/video)
    result = await _replaceAsync(result, /\[sound:([^\]]+)\]/g, async (match, filename) => {
      const nvId = await _processMediaFile(filename, blobs, media)
      return nvId ? `<audio controls><source src="/media/${nvId}"></audio>` : match
    })

    // Handle HTML media tags: <img>, <audio>, <video>, <source>, <object>
    result = await _replaceAsync(result,
      /<(img|audio|video|source|object)\b[^>]*\b(?:src|data)=["']?([^"'\s>]+)["']?[^>]*>/gi,
      async (match, tag, filename) => {
        const nvId = await _processMediaFile(filename, blobs, media)
        if (!nvId) return match

        // Replace src/data attribute with /media/ URL
        return match.replace(/\b(?:src|data)=["']?[^"'\s>]+["']?/, `src="/media/${nvId}"`)
      }
    )

    cooked.push(result)
  }

  return {
    cooked: cooked.length === 1 ? cooked[0] : cooked,
    media
  }
}

// Process individual media file (internal)
async function _processMediaFile(filename, blobs, mediaArray) {
  if (!filename || !blobs[filename]) return null

  const blob = blobs[filename]
  const nvId = await genNvId('media', filename + blob.size + blob.type)

  // Add to media array (avoid duplicates)
  if (!mediaArray.find(m => m.nvId === nvId)) {
    mediaArray.push({
      nvId,
      filename,
      blob,
      type: blob.type,
      size: blob.size
    })
  }

  return nvId
}

// Helper for async string replacement
async function _replaceAsync(str, regex, asyncFn) {
  const matches = []
  let match

  while ((match = regex.exec(str)) !== null) {
    matches.push(match)
    if (!regex.global) break
  }

  const replacements = await Promise.all(
    matches.map(match => asyncFn(match[0], match[1], match[2], match.index))
  )

  let result = str
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i]
    const replacement = replacements[i]
    result = result.substring(0, match.index) + replacement +
      result.substring(match.index + match[0].length)
  }

  return result
}


// Remove a template and its media references
async function _removeTemplate(template) {
  if (!template) return false

  // Remove media references from template formats
  const qResult = await parseFields(template.qfmt, {})
  const aResult = await parseFields(template.afmt, {})
  const allNvIds = [...qResult.media.map(m => m.nvId), ...aResult.media.map(m => m.nvId)]
  if (allNvIds.length > 0) {
    await mediaManager.remove(allNvIds)
  }
  // Remove template from database
  await db.templates.delete(template.id)
  log.debug('Removed template:', template.id)
  return true
}

// Clean up orphaned data whose bundles no longer exist (internal)
async function _cleanupOrphans() {
  // Get all remaining bundle IDs using iteration
  const validBundleIds = new Set()
  await db.bundles.each((bundle) => {
    validBundleIds.add(bundle.id)
  })

  const stats = {
    templatesRemoved: 0,
    notesRemoved: 0,
    cardsRemoved: 0
  }

  // Clean up orphaned templates using iteration
  await db.templates.each(async (template) => {
    if (!validBundleIds.has(template.bundleId)) {
      await _removeTemplate(template)
      stats.templatesRemoved++
    }
  })

  // Clean up orphaned notes using iteration
  await db.notes.each(async (note) => {
    if (!validBundleIds.has(note.bundleId)) {
      await noteManager.delete(note) // Handles media cleanup
      stats.notesRemoved++
      log.debug('Removed orphaned note:', note)
    }
  })

  // Clean up orphaned cards using iteration
  await db.cards.each(async (card) => {
    if (!validBundleIds.has(card.bundleId)) {
      await db.cards.delete(card.id)
      stats.cardsRemoved++
      log.debug('Removed orphaned card:', card)
    }
  })

  return stats
}

export const anki = {
  noteManager,
  mediaManager,
  render,
  StudyEngine,
  parseFields,

  // Add template to bundle
  async  addTemplate(bundleId, name, qfmt, afmt, ord = 0, vdeck = null) {
    const template = {
      id: await genId('template', bundleId + name + qfmt + afmt),
      bundleId,
      name,
      qfmt,
      afmt,
      ord,
      vdeck,
      created: Date.now()
    }
    await db.templates.put(template)

    // Add media references from cooked template formats
    const qResult = await parseFields(qfmt, {})
    const aResult = await parseFields(afmt, {})
    const allMedia = [...qResult.media, ...aResult.media]
    if (allMedia.length > 0) {
      await mediaManager.add(allMedia)
    }

    return template
  },

  async  getTemplates(bundleId) {
    return await db.templates.where('bundleId').equals(bundleId).toArray()
  },

  async removeTemplate(tp) {
    _removeTemplate(tp)
  },

  async  getBundle(bundleId) {
    return await db.bundles.get(bundleId)
  },

  // Get cards for bundles (supports both single bundleId and array)
  async  getCardsForBundles(bundleIds) {
    const normalizedBundleIds = [].concat(bundleIds || [])
    if (normalizedBundleIds.length === 0) {
      return []
    }
    return await db.cards.where('bundleId').anyOf(normalizedBundleIds).toArray()
  },

  // Remove bundles and clean up orphaned data
  async  removeBundles(bundleIds) {
    const normalizedBundleIds = [].concat(bundleIds || [])
    let bundlesRemoved = 0

    for (const bundleId of normalizedBundleIds) {
      const bundleExists = await db.bundles.get(bundleId)
      if (bundleExists) {
        await db.bundles.delete(bundleId)
        bundlesRemoved++
      }
    }

    const orphanStats = await _cleanupOrphans()
    const totalStats = { bundlesRemoved, ...orphanStats }
    log.debug('Bundles removal completed:', { bundleIds: normalizedBundleIds, ...totalStats })

    return totalStats
  },


  // Add bundle/NoteType
  async  addBundle(id, name, fields) {
    const bundle = {
      id,
      name,
      fields, // Array of field definitions
      created: Date.now(),
      modified: Date.now()
    }
    await db.bundles.put(bundle)
    log.debug('Bundle created:', id)
    return bundle
  }

  // No default export needed - use named exports directly
}
