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

    const fuzzyAddSpy = vi.spyOn(mediaManager, 'fuzzyAdd')

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
    
    // Verify media was processed using fuzzyAdd
    expect(fuzzyAddSpy).toHaveBeenCalled()
    
    // Check that fuzzyAdd was called with correct parameters
    const fuzzyAddCalls = fuzzyAddSpy.mock.calls
    expect(fuzzyAddCalls).toHaveLength(1)
    expect(fuzzyAddCalls[0][0]).toBe(bundleId) // bundleId
    expect(fuzzyAddCalls[0][1]).toBe(assignedOrd) // template ord as userId
    expect(fuzzyAddCalls[0][2]).toContain('question.png') // combined formats
    expect(fuzzyAddCalls[0][2]).toContain('answer.jpg')
    
    // Verify the template was stored in database
    const storedTemplate = await db.templates.get(template.id)
    expect(storedTemplate).toBeTruthy()
    // With current API, stored formats are raw; media URLs are replaced at render time
    expect(storedTemplate.qfmt).toContain('question.png')
    expect(storedTemplate.afmt).toContain('answer.jpg')

    fuzzyAddSpy.mockRestore()
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

    const fuzzyRemoveSpy = vi.spyOn(mediaManager, 'fuzzyRemove')

    // Remove the template
    await anki.removeTemplate(template)

    // Verify template was removed from database
    expect(await db.templates.get(template.id)).toBeUndefined()

    // Verify media removal was called via fuzzyRemove
    expect(fuzzyRemoveSpy).toHaveBeenCalled()
    
    // Check that fuzzyRemove was called with correct parameters
    const removeCalls = fuzzyRemoveSpy.mock.calls
    expect(removeCalls).toHaveLength(1)
    expect(removeCalls[0][0]).toBe(bundleId) // bundleId
    expect(removeCalls[0][1]).toBe(assignedOrd) // template ord as userId
    expect(removeCalls[0][2]).toContain('template-q.png') // combined formats
    expect(removeCalls[0][2]).toContain('template-a.png')
    fuzzyRemoveSpy.mockRestore()
  })

  test('template operations should handle mixed cooked and raw media correctly', async () => {
    const bundleId = 'mixed-media-bundle'
    await anki.addBundle(bundleId, 'Mixed Media Bundle', ['Field1'])

    // First, create some existing media using fuzzyAdd
    const existingBlobs = {
      'existing.png': makeBlob('existing media content', 'image/png')
    }
    await mediaManager.fuzzyAdd('test-bundle', 0, '<img src="existing.png">', existingBlobs)

    const allBlobs = {
      'existing.png': makeBlob('existing media content', 'image/png'), // Same content, should not duplicate
      'new.jpg': makeBlob('new media content', 'image/jpeg')
    }

    const fuzzyAddSpy = vi.spyOn(mediaManager, 'fuzzyAdd')

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
    
    // Should have been called with fuzzyAdd for processing media
    expect(fuzzyAddSpy).toHaveBeenCalled()
    
    const fuzzyAddCalls = fuzzyAddSpy.mock.calls
    expect(fuzzyAddCalls).toHaveLength(1)
    expect(fuzzyAddCalls[0][0]).toBe(bundleId) // bundleId
    expect(fuzzyAddCalls[0][1]).toBe(assignedOrd) // template ord as userId
    expect(fuzzyAddCalls[0][2]).toContain('existing.png') // combined formats
    expect(fuzzyAddCalls[0][2]).toContain('new.jpg')

    fuzzyAddSpy.mockRestore()
  })

  test('template operations should work with no media', async () => {
    const bundleId = 'no-media-bundle'
    await anki.addBundle(bundleId, 'No Media Bundle', ['Text'])

    const fuzzyAddSpy = vi.spyOn(mediaManager, 'fuzzyAdd')

    // Template with no media - just text (no media blobs needed)
    const assignedOrd = await anki.addTemplate(
      bundleId,
      'Text Only Template',
      '{{Text}}',
      'Answer: {{Text}}' // No media parameter = {}
    )

    expect(assignedOrd).toBe(0)
    
    // fuzzyAdd should still be called but should find no media and return early
    expect(fuzzyAddSpy).toHaveBeenCalled()
    const fuzzyAddCalls = fuzzyAddSpy.mock.calls
    expect(fuzzyAddCalls).toHaveLength(1)
    expect(fuzzyAddCalls[0][2]).not.toContain('.png') // Should contain no media references
    expect(fuzzyAddCalls[0][2]).not.toContain('.jpg')

    fuzzyAddSpy.mockRestore()
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
