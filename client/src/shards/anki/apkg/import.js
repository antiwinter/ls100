import anki from '../core/index.js'
import mediaManager from '../../../utils/mediaManager.js'
import db from '../core/db.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'

// Convert parsed Anki data to internal format and import to database
export const importApkgData = async (parsedData, options = {}) => {
  const {
    preserveScheduling = false // Option to import scheduling data
  } = options
  const { bundles, notes: ankiNotes, media, reviewHistory = {} } = parsedData
  const createdNotes = []
  const bundleIds = []
  const bundleMap = new Map() // modelId -> bundleId

  log.debug(`Import: Processing ${Object.keys(bundles).length} bundles`)
  log.debug('Bundle IDs available:', Object.keys(bundles))

  // 1. Create Bundles and Templates (one bundle per Anki note type)
  for (const [modelId, model] of Object.entries(bundles)) {
    const bundleId = await genId('bundle', `${model.name}-${JSON.stringify(model.flds.map(f => f.name))}`)
    bundleMap.set(modelId, bundleId)
    bundleIds.push(bundleId)

    // Extract field names
    const fields = model.flds.map(field => field.name)

    // Create bundle
    await anki.addBundle(bundleId, model.name, fields)
    log.debug(`Created bundle: ${model.name}`)

    // Create templates with cooked formats
    for (const template of model.tmpls) {
      // Validate template formats
      if (typeof template.qfmt !== 'string' || typeof template.afmt !== 'string') {
        throw new Error(`Invalid template format: qfmt and afmt must be strings, got qfmt: ${typeof template.qfmt}, afmt: ${typeof template.afmt}`)
      }
      const qfmt = template.qfmt
      const afmt = template.afmt

      // Parse template formats: filename → NvId + extract media
      const qResult = await anki.parseFields(qfmt, media)
      const aResult = await anki.parseFields(afmt, media)
      
      // Add all media found in templates
      const templateMedia = [...qResult.media, ...aResult.media]
      if (templateMedia.length > 0) {
        await mediaManager.add(templateMedia)
      }
      
      const cookedQfmt = qResult.cooked
      const cookedAfmt = aResult.cooked

      await anki.addTemplate(
        bundleId,
        template.name,
        cookedQfmt,
        cookedAfmt,
        template.ord
      )
      log.debug(`Created template: ${template.name}`)
    }
  }

  // 2. Import Notes with cooked fields
  for (const ankiNote of ankiNotes) {
    const bundleId = bundleMap.get(ankiNote.mid.toString())

    if (!bundleId) {
      log.error(`No bundle found for note model ID: ${ankiNote.mid}`)
      log.debug('Available bundle IDs:', Array.from(bundleMap.keys()))
      log.debug('Note details:', { id: ankiNote.id, mid: ankiNote.mid })
      continue // Skip this note
    }

    // Parse fields: filename → NvId + extract media
    const fieldsResult = await anki.parseFields(ankiNote.flds, media)
    
    // Add all media found in note fields
    if (fieldsResult.media.length > 0) {
      await mediaManager.add(fieldsResult.media)
    }
    
    const cookedFields = fieldsResult.cooked

    // Convert tags to array (Anki stores tags as space-separated string, tests might pass arrays)
    const tagsArray = Array.isArray(ankiNote.tags)
      ? ankiNote.tags
      : ankiNote.tags ? ankiNote.tags.trim().split(/\s+/).filter(Boolean) : []

    const result = await anki.noteManager.create(
      bundleId,
      cookedFields,
      tagsArray
    )

    // If preserveScheduling is enabled, update cards with original scheduling data
    if (preserveScheduling && result.cards) {
      const originalCards = parsedData.cards?.filter(card => card.nid === ankiNote.id) || []

      for (const generatedCard of result.cards) {
        // Find matching original card by template ordinal
        const originalCard = originalCards.find(c => c.ord === generatedCard.templateOrd)

        if (originalCard && reviewHistory[originalCard.id]) {
          // Convert Anki scheduling to FSRS format
          const fsrsHistory = reviewHistory[originalCard.id]

          // Update card with scheduling data
          await db.cards.update(generatedCard.id, {
            due: originalCard.due > 1000000000 ? originalCard.due :
              Date.now() + originalCard.due * 24 * 60 * 60 * 1000,
            state: originalCard.type === 0 ? 'New' :
              originalCard.type === 1 ? 'Learning' : 'Review',
            fsrs: fsrsHistory // Store the converted FSRS history
          })

          log.debug(`Updated card ${generatedCard.id} with ${fsrsHistory.length} review entries`)
        }
      }
    }

    createdNotes.push(result)
  }

  log.debug('✅ Import complete:')
  log.debug(`   • NoteTypes: ${bundleIds.length}`)
  log.debug(`   • Notes: ${createdNotes.length}`)
  log.debug(`   • Cards: ${createdNotes.reduce((sum, note) => sum + (note.cards?.length || 0), 0)}`)

  return {
    bundleIds,
    noteIds: createdNotes.map(note => note.id),
    bundles: bundleIds.length,
    notes: createdNotes.length,
    cards: createdNotes.reduce((sum, note) => sum + (note.cards?.length || 0), 0)
  }
}
