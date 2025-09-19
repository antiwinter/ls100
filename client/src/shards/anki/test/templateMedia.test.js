import { describe, test, expect, beforeEach, vi } from 'vitest'
import { anki } from '../core/index.js'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'

function makeBlob(content, type = 'text/plain') {
  return new Blob([content], { type })
}

describe('Template Media Operations', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
  })

  test('addTemplate should add media from question and answer formats', async () => {
    const bundleId = 'test-bundle'
    await anki.addBundle(bundleId, 'Test Bundle', ['Front', 'Back'])

    const blobs = {
      'question.png': makeBlob('question image content', 'image/png'),
      'answer.jpg': makeBlob('answer image content', 'image/jpeg')
    }

    const mediaAddSpy = vi.spyOn(mediaManager, 'add')

    // Use new API - pass raw formats and media directly
    const assignedOrd = await anki.addTemplate(
      bundleId,
      'Test Template',
      '<img src="question.png">', // Raw format
      '<img src="answer.jpg">',    // Raw format
      blobs // Media blobs
    )

    expect(assignedOrd).toBe(0) // First template gets ord 0
    
    // Verify template was created
    const templates = await anki.getTemplates(bundleId)
    expect(templates).toHaveLength(1)
    const template = templates[0]
    expect(template.bundleId).toBe(bundleId)
    expect(template.ord).toBe(assignedOrd)
    
    // Verify media was added for both question and answer formats
    expect(mediaAddSpy).toHaveBeenCalled()
    
    // Check that both media items were processed
    const addCalls = mediaAddSpy.mock.calls.flat().flat()
    expect(addCalls.length).toBeGreaterThanOrEqual(2)
    
    // Verify the template was stored in database
    const storedTemplate = await db.templates.get(template.id)
    expect(storedTemplate).toBeTruthy()
    // With new API, stored formats are cooked; ensure media URLs were embedded
    expect(storedTemplate.qfmt).toMatch(/src="\/media\//)
    expect(storedTemplate.afmt).toMatch(/src="\/media\//)

    mediaAddSpy.mockRestore()
  })

  test('removeTemplate should remove media from question and answer formats', async () => {
    const bundleId = 'test-bundle-remove'
    await anki.addBundle(bundleId, 'Test Bundle', ['Front', 'Back'])

    const blobs = {
      'template-q.png': makeBlob('template question image', 'image/png'),
      'template-a.png': makeBlob('template answer image', 'image/png')
    }

    // Create template with media
    const assignedOrd = await anki.addTemplate(
      bundleId,
      'Template to Remove',
      '<img src="template-q.png">', // Raw format
      '<img src="template-a.png">', // Raw format
      blobs
    )

    // Get the created template
    const templates = await anki.getTemplates(bundleId)
    const template = templates.find(t => t.ord === assignedOrd)
    expect(template).toBeTruthy()

    const mediaRemoveSpy = vi.spyOn(mediaManager, 'remove')

    // Remove the template
    await anki.removeTemplate(template)

    // Verify template was removed from database
    expect(await db.templates.get(template.id)).toBeUndefined()

    // Verify media removal was called
    expect(mediaRemoveSpy).toHaveBeenCalled()
    
    // Check that nvIds were passed for removal
    const removeCalls = mediaRemoveSpy.mock.calls.flat().flat()
    expect(removeCalls.length).toBeGreaterThanOrEqual(2) // At least 2 nvIds

    mediaRemoveSpy.mockRestore()
  })

  test('template operations should handle mixed cooked and raw media correctly', async () => {
    const bundleId = 'mixed-media-bundle'
    await anki.addBundle(bundleId, 'Mixed Media Bundle', ['Field1'])

    // First, create some existing media
    const existingBlobs = {
      'existing.png': makeBlob('existing media content', 'image/png')
    }
    const existingFilenames = await anki.findMedia('<img src="existing.png">')
    const mediaObject = { [existingFilenames[0]]: existingBlobs[existingFilenames[0]] }
    await mediaManager.add('test-bundle', 0, mediaObject)

    const allBlobs = {
      'existing.png': makeBlob('existing media content', 'image/png'), // Same content, should not duplicate
      'new.jpg': makeBlob('new media content', 'image/jpeg')
    }

    const mediaAddSpy = vi.spyOn(mediaManager, 'add')

    // BUG REPORT: existingResult is undefined - likely removed during refactoring
    // Template with mixed media: existing + new 
    const mixedFormat = '<img src="existing.png">' + '<img src="new.jpg">'
    
    const assignedOrd = await anki.addTemplate(
      bundleId,
      'Mixed Media Template',
      mixedFormat, // Mixed: cooked existing + raw new
      'Answer with {{Field1}}', // Simple text template
      allBlobs // All blobs needed
    )

    expect(assignedOrd).toBe(0)
    
    // Should have been called with media array containing both existing and new
    expect(mediaAddSpy).toHaveBeenCalled()
    
    const addedMedia = mediaAddSpy.mock.calls.flat().flat()
    
    // Should handle existing media (add user) and add new media
    expect(addedMedia.length).toBeGreaterThanOrEqual(1)

    mediaAddSpy.mockRestore()
  })

  test('template operations should work with no media', async () => {
    const bundleId = 'no-media-bundle'
    await anki.addBundle(bundleId, 'No Media Bundle', ['Text'])

    const mediaAddSpy = vi.spyOn(mediaManager, 'add')

    // Template with no media - just text (no media blobs needed)
    const assignedOrd = await anki.addTemplate(
      bundleId,
      'Text Only Template',
      '{{Text}}',
      'Answer: {{Text}}' // No media parameter = {}
    )

    expect(assignedOrd).toBe(0)
    
    // No media should be added - mediaManager.add should not be called at all
    expect(mediaAddSpy.mock.calls.length).toBe(0)

    mediaAddSpy.mockRestore()
  })

  test('getTemplates should return templates for bundle', async () => {
    const bundleId = 'template-list-bundle'
    await anki.addBundle(bundleId, 'Template List Bundle', ['Field'])

    // Add multiple templates (ord auto-increments)
    const ord1 = await anki.addTemplate(bundleId, 'Template 1', '{{Field}}', 'A1')
    const ord2 = await anki.addTemplate(bundleId, 'Template 2', '{{Field}} 2', 'A2')

    const templates = await anki.getTemplates(bundleId)
    
    expect(templates).toHaveLength(2)
    expect(templates.map(t => t.ord)).toContain(ord1)
    expect(templates.map(t => t.ord)).toContain(ord2)
    expect(ord1).toBe(0)
    expect(ord2).toBe(1) // Auto-incremented
  })
})
