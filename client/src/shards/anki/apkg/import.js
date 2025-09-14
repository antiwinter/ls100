import anki from '../core/index.js'
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

  // Track ord mappings for preserveScheduling (bundleId -> originalOrd -> newOrd)
  const bundleOrdMappings = new Map()

  // 1. Create Bundles and Templates (one bundle per Anki note type)
  for (const [modelId, model] of Object.entries(bundles)) {
    const bundleId = genId('bundle', `${model.name}-${JSON.stringify(model.flds.map(f => f.name))}`)
    bundleMap.set(modelId, bundleId)
    bundleIds.push(bundleId)

    // Extract field names
    const fields = model.flds.map(field => field.name)

    // Create bundle
    await anki.addBundle(bundleId, model.name, fields)
    log.debug(`Created bundle: ${model.name}`)

    // Create templates with cooked formats and track ord mapping for preserveScheduling
    const ordMapping = new Map() // originalOrd -> newOrd
    for (const template of model.tmpls) {
      // Validate template formats
      if (typeof template.qfmt !== 'string' || typeof template.afmt !== 'string') {
        throw new Error(`Invalid template format: qfmt and afmt must be strings, got qfmt: ${typeof template.qfmt}, afmt: ${typeof template.afmt}`)
      }
      const qfmt = template.qfmt
      const afmt = template.afmt

      // addTemplate will handle both raw formats and media processing
      const assignedOrd = await anki.addTemplate(
        bundleId,
        template.name,
        qfmt, // Raw format with filenames
        afmt, // Raw format with filenames
        media // Blob data for processing
      )

      // Map original ord to new ord for preserveScheduling
      ordMapping.set(template.ord, assignedOrd)
      log.debug(`Created template: ${template.name}, original ord: ${template.ord} -> new ord: ${assignedOrd}`)
    }

    // Store ord mapping for this bundle
    bundleOrdMappings.set(bundleId, ordMapping)
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

    // Convert tags to array (Anki stores tags as space-separated string, tests might pass arrays)
    const tagsArray = Array.isArray(ankiNote.tags)
      ? ankiNote.tags
      : ankiNote.tags ? ankiNote.tags.trim().split(/\s+/).filter(Boolean) : []

    // noteManager.create will handle both raw fields and media processing
    const result = await anki.noteManager.create(
      bundleId,
      ankiNote.flds, // Raw fields with filenames
      tagsArray,
      media // Blob data for processing
    )

    // If preserveScheduling is enabled, update cards with original scheduling data
    if (preserveScheduling && result.cards) {
      const originalCards = parsedData.cards?.filter(card => card.nid === ankiNote.id) || []
      const ordMapping = bundleOrdMappings.get(bundleId)

      for (const generatedCard of result.cards) {
        // Find matching original card using ord mapping
        const originalCard = originalCards.find(c => ordMapping.get(c.ord)
        === generatedCard.templateOrd)

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

  log.debug('✅ Import complete:', { bundles, notes: createdNotes,
    templates: await anki.getTemplates(bundleIds[0]),
    cards: await anki.getCardsForBundles(bundleIds) })

  return {
    bundleIds,
    noteIds: createdNotes.map(note => note.id),
    bundles: bundleIds.length,
    notes: createdNotes.length,
    cards: createdNotes.reduce((sum, note) => sum + (note.cards?.length || 0), 0)
  }
}
