import ankiApi from '../core/ankiApi'
import mediaManager from '../core/mediaManager'
import { log } from '../../../utils/logger'
import { genNvId } from '../../../utils/idGenerator.js'

// Setup basic note types and templates for demo
async function setupBasicTypes() {
  // Basic Q&A type
  const basicTypeId = await genNvId('notetype', 'basic-qa')
  const basicType = await ankiApi.noteManager.createType(
    basicTypeId,
    'Basic',
    ['Question', 'Answer']
  )

  await ankiApi.noteManager.createTemplate(
    basicTypeId,
    'Card 1',
    '{{Question}}',
    '{{FrontSide}}<hr>{{Answer}}',
    0
  )

  // Geography type (example multi-field)
  const geoTypeId = await genNvId('notetype', 'geography-multi')
  const geoType = await ankiApi.noteManager.createType(
    geoTypeId,
    'Geography',
    ['Country', 'Capital', 'Flag', 'Location']
  )

  const geoTemplates = [
    ['Country → Capital', '{{Country}}', '{{FrontSide}}<hr>{{Capital}}'],
    ['Capital → Country', '{{Capital}}', '{{FrontSide}}<hr>{{Country}}'],
    ['Flag → Country', '{{Flag}}', '{{FrontSide}}<hr>{{Country}}'],
    ['Country → Location', '{{Country}}', '{{FrontSide}}<hr>{{Location}}']
  ]

  for (let i = 0; i < geoTemplates.length; i++) {
    const [name, qfmt, afmt] = geoTemplates[i]
    await ankiApi.noteManager.createTemplate(geoTypeId, name, qfmt, afmt, i)
  }

  log.debug('Basic note types setup completed')
  return { basicType, geoType, basicTypeId, geoTypeId }
}

// Demo setup script for new Anki architecture
export async function setupDemo() {
  try {
    log.info('🎯 Setting up Anki demo...')

    // Setup basic note types and templates
    const { basicTypeId, geoTypeId } = await setupBasicTypes()

    // Create sample geography notes
    const geoNotes = [
      {
        bundleId: geoTypeId,
        fields: ['France', 'Paris', '🇫🇷', 'Western Europe'],
        tags: ['europe', 'country']
      },
      {
        bundleId: geoTypeId,
        fields: ['Japan', 'Tokyo', '🇯🇵', 'East Asia'],
        tags: ['asia', 'country']
      },
      {
        bundleId: geoTypeId,
        fields: ['Brazil', 'Brasília', '🇧🇷', 'South America'],
        tags: ['south-america', 'country']
      }
    ]

    // Create sample basic notes
    const basicNotes = [
      {
        bundleId: basicTypeId,
        fields: ['What is the capital of Australia?', 'Canberra'],
        tags: ['geography', 'basic']
      },
      {
        bundleId: basicTypeId,
        fields: ['2 + 2 = ?', '4'],
        tags: ['math', 'basic']
      }
    ]

    // Demo bundle and shard IDs
    const bundleId = 'demo-bundle'
    const shardId = 'demo-shard'

    // Create geography notes (each generates 4 cards)
    log.info('📝 Creating geography notes...')
    for (const noteData of geoNotes) {
      const result = await ankiApi.createNote(
        noteData.bundleId,
        noteData.fields,
        noteData.tags,
        bundleId,
        shardId
      )
      log.debug(`Created note ${result.note.id} with ${result.cards.length} cards`)
    }

    // Create basic notes (each generates 1 card)
    log.info('📝 Creating basic notes...')
    for (const noteData of basicNotes) {
      const result = await ankiApi.createNote(
        noteData.bundleId,
        noteData.fields,
        noteData.tags,
        bundleId,
        shardId
      )
      log.debug(`Created note ${result.note.id} with ${result.cards.length} cards`)
    }

    // Get stats
    const cards = await ankiApi.getCardsForBundle(bundleId)
    const totalCards = cards.length
    const geoCards = geoNotes.length * 4 // 4 templates per geography note
    const basicCards = basicNotes.length * 1 // 1 template per basic note

    log.info('✅ Demo setup complete!')
    log.info(`📊 Created ${totalCards} cards:`)
    log.info(`   • ${geoCards} geography cards (from ${geoNotes.length} notes)`)
    log.info(`   • ${basicCards} basic cards (from ${basicNotes.length} notes)`)

    return {
      bundleId,
      shardId,
      totalCards,
      cards
    }

  } catch (err) {
    log.error('❌ Demo setup failed:', err)
    throw err
  }
}

// Demo function to show multi-card features
export async function demoMultiCard() {
  log.info('🔍 Demonstrating multi-card feature...')

  try {
    const bundleId = 'demo-bundle'
    const cards = await ankiApi.getCardsForBundle(bundleId)

    // Find cards from same note (same noteId)
    const cardsByNote = new Map()
    for (const card of cards) {
      if (!cardsByNote.has(card.noteId)) {
        cardsByNote.set(card.noteId, [])
      }
      cardsByNote.get(card.noteId).push(card)
    }

    log.info('📋 Cards by note:')
    for (const [noteId, noteCards] of cardsByNote) {
      if (noteCards.length > 1) {
        log.info(`  Note ${noteId}: ${noteCards.length} cards`)

        // Render each card to show different Q/A pairs
        for (const card of noteCards.slice(0, 2)) { // Show first 2 cards
          const rendered = await ankiApi.getStudyCard(card.id)
          log.info(`    • ${rendered.template}: "${rendered.question}" → "${rendered.answer}"`)
        }
      }
    }

    return { cardsByNote }

  } catch (err) {
    log.error('❌ Multi-card demo failed:', err)
    throw err
  }
}

// Cleanup demo data
export async function cleanupDemo() {
  log.info('🧹 Cleaning up demo data...')

  try {
    const bundleId = 'demo-bundle'
    // const shardId = 'demo-shard'

    const cards = await ankiApi.getCardsForBundle(bundleId)
    const noteIds = [...new Set(cards.map(c => c.noteId))]

    // Remove all notes (triggers cleanup)
    for (const noteId of noteIds) {
      await ankiApi.noteManager.delete(noteId)
    }

    log.info(`✅ Cleaned up ${noteIds.length} notes and ${cards.length} cards`)

  } catch (err) {
    log.error('❌ Cleanup failed:', err)
    throw err
  }
}

// Demo media functionality
export async function demoMedia() {
  try {
    log.info('🎨 Testing media functionality...')

    const shardId = 'demo-shard'

    // Create a note with media references
    const { basicTypeId } = await setupBasicTypes()
    const result = await ankiApi.createNote(
      basicTypeId,
      [
        'What does this image show?<br><img src="demo-image.jpg">',
        'A demo image with <img src="demo-icon.png"> icon'
      ],
      ['media', 'demo'],
      'demo-bundle',
      shardId
    )

    log.info('📝 Created note with media references')

    // Test media URL replacement
    const testHtml = '<img src="test.jpg"> and <img src="another.png">'
    const processedHtml = await mediaManager.replaceMediaUrls(testHtml, 'demo-bundle')
    log.info('🔄 Media replacement test:', { original: testHtml, processed: processedHtml })

    // Get media statistics
    const mediaStats = await ankiApi.getMediaStatsForBundles(['demo-bundle'])
    log.info('📊 Media statistics:', mediaStats)

    // Test card rendering with media
    if (result.cards.length > 0) {
      const cardId = result.cards[0].id
      const renderedCard = await ankiApi.getStudyCard(cardId)
      log.info('🎴 Rendered card with media processing:', {
        cardId,
        question: renderedCard.question,
        answer: renderedCard.answer
      })
    }

    log.info('✅ Media demo completed')
    return result

  } catch (err) {
    log.error('❌ Media demo failed:', err)
    throw err
  }
}

// Export for browser console
if (typeof window !== 'undefined') {
  window.ankiDemo = {
    setup: setupDemo,
    multiCard: demoMultiCard,
    media: demoMedia,
    cleanup: cleanupDemo,
    api: ankiApi,
    mediaManager
  }
  log.info('🎮 Anki Demo available: window.ankiDemo')
}
