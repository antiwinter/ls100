import ankiApi from '../core/ankiApi'
import noteManager from '../core/noteManager'
import mediaManager from '../core/mediaManager'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'

// Convert parsed Anki data to internal format and import to database
export const importApkgData = async (parsedData) => {
  const { bundles, notes: ankiNotes, media } = parsedData
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
    await noteManager.createType(bundleId, model.name, fields)
    log.debug(`Created bundle: ${model.name}`)

    // Create templates with cooked formats
    for (const template of model.tmpls) {
      // Ensure template formats are strings
      const qfmt = typeof template.qfmt === 'string' ? template.qfmt : String(template.qfmt || '')
      const afmt = typeof template.afmt === 'string' ? template.afmt : String(template.afmt || '')

      // Cook template formats: filename → NvId + increment refCount
      const cookedQfmt = await mediaManager.addMedia(qfmt, media)
      const cookedAfmt = await mediaManager.addMedia(afmt, media)

      await noteManager.createTemplate(
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

    // Cook fields: filename → NvId + increment refCount
    const cookedFields = []
    for (const field of ankiNote.flds) {
      const cookedField = await mediaManager.addMedia(field, media)
      cookedFields.push(cookedField)
    }

    // Convert tags to array (Anki stores tags as space-separated string, tests might pass arrays)
    const tagsArray = Array.isArray(ankiNote.tags)
      ? ankiNote.tags
      : ankiNote.tags ? ankiNote.tags.trim().split(/\s+/).filter(Boolean) : []

    const result = await ankiApi.createNote(
      bundleId,
      cookedFields,
      tagsArray
    )

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
