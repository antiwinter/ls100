import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { AnkiRender } from '../core/template/index.js'
import { parseTemplate } from '../core/template/ast2.js'
import { Filters, registerFilter } from '../core/template/filters/index.js'

describe('Template System - AST Parser', () => {
  describe('Basic Parsing', () => {
    test('parses simple field tokens', () => {
      const ast = parseTemplate('{{Front}}')
      expect(ast).toEqual([{
        type: 'field',
        name: 'Front',
        filters: []
      }])
    })

    test('parses text content', () => {
      const ast = parseTemplate('Hello World')
      expect(ast).toEqual([{
        type: 'text',
        text: 'Hello World'
      }])
    })

    test('parses mixed text and fields', () => {
      const ast = parseTemplate('Q: {{Front}} A: {{Back}}')
      expect(ast).toHaveLength(4)
      expect(ast[0]).toEqual({ type: 'text', text: 'Q:' })
      expect(ast[1]).toEqual({ type: 'field', name: 'Front', filters: [] })
      expect(ast[2]).toEqual({ type: 'text', text: 'A:' })
      expect(ast[3]).toEqual({ type: 'field', name: 'Back', filters: [] })
    })

    test('handles empty template', () => {
      const ast = parseTemplate('')
      expect(ast).toEqual([{ type: 'text', value: '' }])
    })

    test('handles null/undefined template', () => {
      const ast1 = parseTemplate(null)
      const ast2 = parseTemplate(undefined)
      expect(ast1).toEqual([{ type: 'text', value: '' }])
      expect(ast2).toEqual([{ type: 'text', value: '' }])
    })
  })

  describe('Conditional Blocks', () => {
    test('parses simple conditional block', () => {
      const ast = parseTemplate('{{#Front}}Show this{{/Front}}')
      expect(ast).toHaveLength(1)
      expect(ast[0]).toMatchObject({
        type: 'block',
        name: 'Front',
        inv: false,
        sub: [{ type: 'text', text: 'Show this' }]
      })
    })

    test('parses inverted conditional block', () => {
      const ast = parseTemplate('{{^Front}}Show when empty{{/Front}}')
      expect(ast[0]).toMatchObject({
        type: 'block',
        name: 'Front',
        inv: true,
        sub: [{ type: 'text', text: 'Show when empty' }]
      })
    })

    test('parses nested conditional blocks', () => {
      const template = '{{#Front}}{{#Back}}Both exist{{/Back}}{{/Front}}'
      const ast = parseTemplate(template)
      
      expect(ast[0]).toMatchObject({
        type: 'block',
        name: 'Front',
        inv: false
      })
      expect(ast[0].sub[0]).toMatchObject({
        type: 'block', 
        name: 'Back',
        inv: false,
        sub: [{ type: 'text', text: 'Both exist' }]
      })
    })

    test('parses multiple nested levels', () => {
      const template = '{{#A}}{{#B}}{{#C}}Deep{{/C}}{{/B}}{{/A}}'
      const ast = parseTemplate(template)
      
      // Traverse 3 levels deep
      const level1 = ast[0]
      const level2 = level1.sub[0] 
      const level3 = level2.sub[0]
      
      expect(level1.name).toBe('A')
      expect(level2.name).toBe('B')
      expect(level3.name).toBe('C')
      expect(level3.sub[0].text).toBe('Deep')
    })

    test('handles mixed conditional and inverted blocks', () => {
      const template = '{{#Front}}Has front{{/Front}}{{^Back}}No back{{/Back}}'
      const ast = parseTemplate(template)
      
      expect(ast).toHaveLength(2)
      expect(ast[0].inv).toBe(false)
      expect(ast[1].inv).toBe(true)
    })
  })

  describe('Filters', () => {
    test('parses single filter', () => {
      const ast = parseTemplate('{{text:Front}}')
      expect(ast[0]).toMatchObject({
        type: 'field',
        name: 'Front',
        filters: ['text']
      })
    })

    test('parses multiple filters', () => {
      const ast = parseTemplate('{{hint:text:Front}}')
      expect(ast[0]).toMatchObject({
        type: 'field',
        name: 'Front', 
        filters: ['hint', 'text']
      })
    })

    test('handles filters in conditional blocks', () => {
      const template = '{{#Front}}{{furigana:Reading}}{{/Front}}'
      const ast = parseTemplate(template)
      
      expect(ast[0].sub[0]).toMatchObject({
        type: 'field',
        name: 'Reading',
        filters: ['furigana']
      })
    })
  })

  describe('Edge Cases', () => {
    test('handles malformed blocks (unclosed)', () => {
      const ast = parseTemplate('{{#Front}}Unclosed block')
      // Should handle gracefully - creates nested structure
      expect(ast[0]).toMatchObject({
        type: 'block',
        name: 'Front'
      })
    })

    test('handles extra closing blocks', () => {
      const ast = parseTemplate('Text{{/Front}}')
    // 🚨 BUG: Parser should handle malformed input gracefully
    expect(ast).toBeTruthy()
    expect(Array.isArray(ast)).toBe(true)
    expect(ast[0].text).toBe('Text')
    })

    test('strips newlines and whitespace', () => {
      const ast = parseTemplate(`
        {{Front}}
        {{Back}}
      `)
      expect(ast).toHaveLength(2)
      expect(ast[0].name).toBe('Front')
      expect(ast[1].name).toBe('Back')
    })

    test('handles special characters in field names', () => {
      const ast = parseTemplate('{{Front_123}}{{Back-Side}}')
      expect(ast[0].name).toBe('Front_123')
      expect(ast[1].name).toBe('Back-Side')
    })

    test('rejects cloze syntax in templates', () => {
      expect(() => {
        parseTemplate('{{c1::Answer}}')
      }).toThrow()
    })

    test('handles empty field names', () => {
      const ast = parseTemplate('{{}}')
      expect(ast[0]).toMatchObject({
        type: 'field',
        name: '',
        filters: []
      })
    })

    test('handles whitespace in braces', () => {
      const ast = parseTemplate('{{ Front }}{{ Back }}')
    // 🚨 BUG: Parser should trim whitespace in field names
    expect(ast[0].name).toBe('Front') // Should be trimmed
    expect(ast[1].name).toBe('Back')  // Should be trimmed
    })
  })
})

describe('Template System - AnkiRender Class', () => {
  let renderer

  beforeEach(() => {
    const fieldDefs = ['Front', 'Back', 'Extra']
    const css = 'body { font-family: Arial; }'
    const templates = [
      { qfmt: '{{Front}}', afmt: '{{Back}}' },
      { qfmt: '{{#Extra}}{{Extra}}{{/Extra}}', afmt: '{{Front}}<hr>{{Back}}' }
    ]
    const f2nvid = {
      'test.png': 'obj-abc123',
      'audio.mp3': 'obj-def456'
    }

    renderer = new AnkiRender({ fieldDefs, css, templates, f2nvid })
  })

  describe('Field Resolution', () => {
    test('resolves fields by index', () => {
      const note = { fields: ['Question', 'Answer', 'Hint'] }
      
      expect(renderer._getField(note.fields, 'Front')).toBe('Question')
      expect(renderer._getField(note.fields, 'Back')).toBe('Answer') 
      expect(renderer._getField(note.fields, 'Extra')).toBe('Hint')
    })

    test('returns empty string for missing fields', () => {
      const note = { fields: ['Question'] }
      
      expect(renderer._getField(note.fields, 'Missing')).toBe('')
      expect(renderer._getField(note.fields, 'Back')).toBe('')
    })

    test('handles empty field values', () => {
      const note = { fields: ['Question', '', 'Hint'] }
      
      expect(renderer._getField(note.fields, 'Back')).toBe('')
    })

    test('handles undefined/null field arrays', () => {
    // 🚨 BUG: _getField should handle null arrays safely
    expect(renderer._getField(undefined, 'Front')).toBe('')
    expect(renderer._getField(null, 'Front')).toBe('')
    expect(renderer._getField([], 'Front')).toBe('')
    })
  })

  describe('Basic Rendering', () => {
    test('renders simple field substitution', () => {
      const note = { fields: ['Question', 'Answer', ''] }
      const result = renderer.render(note, 0)
      
      expect(result.front).toBe('Question')
      expect(result.back).toBe('Answer')
      expect(result.css).toBe('body { font-family: Arial; }')
    })

    test('renders conditional blocks correctly', () => {
      const note = { fields: ['Q', 'A', 'Extra Info'] }
      const result = renderer.render(note, 1) // Template with {{#Extra}}
      
      expect(result.front).toBe('Extra Info')
      expect(result.back).toBe('Q<hr>A')
    })

    test('skips conditional blocks when field is empty', () => {
      const note = { fields: ['Q', 'A', ''] } // Empty Extra field
      const result = renderer.render(note, 1)
      
      expect(result.front).toBe('')
    })

    test('renders inverted blocks when field is empty', () => {
      const templates = [{ qfmt: '{{^Extra}}No extra{{/Extra}}', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({ 
        fieldDefs: ['Front', 'Back', 'Extra'], 
        css: '', 
        templates,
        f2nvid: {} 
      })
      
      const note = { fields: ['Q', 'A', ''] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('No extra')
    })

    test('handles FrontSide in back template', () => {
      const templates = [{ qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr>{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['Question', 'Answer'] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('Question')
      expect(result.back).toBe('Question<hr>Answer')
    })
  })

  describe('Filter Application', () => {
    test('applies single filter', () => {
      const templates = [{ qfmt: '{{text:Front}}', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['Question', 'Answer'] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('Question') // text filter is identity
    })

    test('applies furigana filter', () => {
      const templates = [{ qfmt: '{{furigana:Front}}', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['漢字[かんじ]', 'Answer'] }
      const result = testRenderer.render(note, 0)
      
    // 🚨 BUG: Filters completely broken - should transform Japanese text
    expect(result.front).toBe('<ruby>漢字<rt>かんじ</rt></ruby>')
    })

    test('applies kana filter', () => {
      const templates = [{ qfmt: '{{kana:Front}}', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['漢字[かんじ]', 'Answer'] }
      const result = testRenderer.render(note, 0)
      
    // 🚨 BUG: Kana filter completely broken - should extract readings
    expect(result.front).toBe('かんじ')
    })

    test('applies multiple filters in sequence', () => {
      // Register a test filter
      registerFilter('upper', (v) => v.toUpperCase())
      
      const templates = [{ qfmt: '{{upper:text:Front}}', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['question', 'answer'] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('QUESTION')
    })

    test('handles unknown filters gracefully', () => {
      const templates = [{ qfmt: '{{unknown:Front}}', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['Question', 'Answer'] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('Question') // Should pass through unchanged
    })
  })

  describe('Media URL Tuning', () => {
    test('converts sound tags to audio elements', () => {
      const templates = [{ qfmt: '[sound:audio.mp3]', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: { 'audio.mp3': 'obj-def456' }
      })
      
      const note = { fields: ['', ''] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toContain('<audio controls>')
      expect(result.front).toContain('src="/media/obj-def456"')
    })

    test('converts img src to media URLs', () => {
      const templates = [{ qfmt: '<img src="test.png">', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: { 'test.png': 'obj-abc123' }
      })
      
      const note = { fields: ['', ''] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('<img src="/media/obj-abc123">')
    })

    test('leaves unknown media files unchanged', () => {
      const templates = [{ qfmt: '<img src="unknown.png">', afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['', ''] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('<img src="unknown.png">')
    })

    test('handles multiple media elements', () => {
      const templates = [{ 
        qfmt: '<img src="test.png">[sound:audio.mp3]<video src="unknown.mp4">', 
        afmt: '{{Back}}' 
      }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: { 'test.png': 'obj-abc123', 'audio.mp3': 'obj-def456' }
      })
      
      const note = { fields: ['', ''] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toContain('src="/media/obj-abc123"')
      expect(result.front).toContain('src="/media/obj-def456"')
      expect(result.front).toContain('src="unknown.mp4"') // Unchanged
    })
  })

  describe('Edge Cases', () => {
    test('handles invalid template ordinal', () => {
      const note = { fields: ['Q', 'A'] }
      
      expect(() => {
        renderer.render(note, 999) // Non-existent template
      }).toThrow()
    })

    test('handles note with insufficient fields', () => {
      const note = { fields: ['Q'] } // Missing Back field
      const result = renderer.render(note, 0)
      
      expect(result.front).toBe('Q')
      expect(result.back).toBe('') // Empty back since Back field is missing
    })

    test('handles note with extra fields', () => {
      const note = { fields: ['Q', 'A', 'Extra', 'More', 'Even More'] }
      const result = renderer.render(note, 0)
      
      expect(result.front).toBe('Q')
      expect(result.back).toBe('A')
    })

    test('handles null/undefined note fields', () => {
      const note1 = { fields: null }
      const note2 = { fields: undefined }
      const note3 = {}
      
    // 🚨 BUG: Should handle null fields gracefully without crashing
    expect(() => renderer.render(note1, 0)).not.toThrow()
    expect(() => renderer.render(note2, 0)).not.toThrow()
    expect(() => renderer.render(note3, 0)).not.toThrow()
    })

    test('handles complex nested conditionals with missing fields', () => {
      const templates = [{ 
        qfmt: '{{#Front}}{{#Missing}}Never shown{{/Missing}}{{^Missing}}Front only{{/Missing}}{{/Front}}',
        afmt: '{{Back}}'
      }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back', 'Missing'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['Has front', 'Has back', ''] } // Missing field is empty
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('Front only')
    })

    test('handles very large templates', () => {
      const largeTemplate = '{{Front}}' + ' Large text content'.repeat(1000)
      const templates = [{ qfmt: largeTemplate, afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['Q', 'A'] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toContain('Q')
      expect(result.front.length).toBeGreaterThan(10000)
    })

    test('handles circular-like conditions', () => {
      const templates = [{ 
        qfmt: '{{#A}}{{#B}}{{#A}}Nested A{{/A}}{{/B}}{{/A}}',
        afmt: '{{Back}}'
      }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['A', 'B', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['Has A', 'Has B', 'Back'] }
      const result = testRenderer.render(note, 0)
      
      expect(result.front).toBe('Nested A')
    })
  })

  describe('Performance Edge Cases', () => {
    test('handles many conditional blocks efficiently', () => {
      const manyConditions = Array.from({ length: 100 }, (_, i) => 
        `{{#Front}}Block ${i}{{/Front}}`
      ).join('')
      
      const templates = [{ qfmt: manyConditions, afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['Q', 'A'] }
      const start = performance.now()
      const result = testRenderer.render(note, 0)
      const duration = performance.now() - start
      
      expect(result.front).toContain('Block 0')
      expect(result.front).toContain('Block 99')
      expect(duration).toBeLessThan(100) // Should complete in <100ms
    })

    test('handles many field substitutions efficiently', () => {
      const manyFields = Array.from({ length: 1000 }, () => '{{Front}}').join(' ')
      const templates = [{ qfmt: manyFields, afmt: '{{Back}}' }]
      const testRenderer = new AnkiRender({
        fieldDefs: ['Front', 'Back'],
        css: '',
        templates,
        f2nvid: {}
      })
      
      const note = { fields: ['Q', 'A'] }
      const start = performance.now()
      const result = testRenderer.render(note, 0)
      const duration = performance.now() - start
      
      expect(result.front.split('Q')).toHaveLength(1001) // 1000 'Q's + 1 split
      expect(duration).toBeLessThan(50) // Should complete in <50ms
    })
  })
})

describe('Template System - Filter System', () => {
  afterEach(() => {
    // Clean up custom filters
    Filters.delete('testFilter')
    Filters.delete('upper')
    Filters.delete('invalid')
  })

  test('registers new filters correctly', () => {
    registerFilter('testFilter', (v) => `filtered: ${v}`)
    
    expect(Filters.has('testFilter')).toBe(true)
    expect(Filters.get('testFilter')('test')).toBe('filtered: test')
  })

  test('rejects invalid filter registrations', () => {
    const initialSize = Filters.size
    
    registerFilter('', (v) => v) // Empty name
    registerFilter('valid', null) // Invalid function
    registerFilter(null, (v) => v) // Null name
    registerFilter('valid2') // Missing function
    
    expect(Filters.size).toBe(initialSize) // No filters added
  })

  test('built-in filters work correctly', () => {
    expect(Filters.get('text')('hello')).toBe('hello')
    expect(Filters.get('tts')('hello')).toBe('hello') // Placeholder
    
    // 🚨 BUG: Furigana and kana filters completely broken
    expect(Filters.get('furigana')('漢字[かんじ]')).toBe('<ruby>漢字<rt>かんじ</rt></ruby>')
    expect(Filters.get('kana')('漢字[かんじ]')).toBe('かんじ')
  })

  test('furigana filter handles multiple readings', () => {
    const input = '今日[きょう]は良[よ]い天気[てんき]です'
    const expected = '<ruby>今日<rt>きょう</rt></ruby>は<ruby>良<rt>よ</rt></ruby>い<ruby>天気<rt>てんき</rt></ruby>です'
    
    // 🚨 BUG: Furigana filter should handle multiple readings
    expect(Filters.get('furigana')(input)).toBe(expected)
  })

  test('furigana filter handles empty/invalid input', () => {
    expect(Filters.get('furigana')('')).toBe('')
    expect(Filters.get('furigana')(null)).toBe('')
    expect(Filters.get('furigana')(undefined)).toBe('')
    expect(Filters.get('furigana')('no brackets')).toBe('no brackets')
  })

  test('kana filter handles multiple readings', () => {
    const input = '今日[きょう]は良[よ]い天気[てんき]です'
    const expected = 'きょうはよいてんきです'
    
    // 🚨 BUG: Kana filter should handle multiple readings
    expect(Filters.get('kana')(input)).toBe(expected)
  })

  test('filters handle edge cases', () => {
    const furiganaFilter = Filters.get('furigana')
    const kanaFilter = Filters.get('kana')
    
    // Malformed brackets
    expect(furiganaFilter('漢字[incomplete')).toBe('漢字[incomplete')
    expect(furiganaFilter('incomplete]reading')).toBe('incomplete]reading')
    
    // 🚨 BUG: Filters should handle empty readings
    expect(furiganaFilter('漢字[]')).toBe('<ruby>漢字<rt></rt></ruby>')
    expect(kanaFilter('漢字[]')).toBe('')
    
    // 🚨 BUG: Filter should handle nested brackets gracefully
    expect(furiganaFilter('test[a[b]c]')).toContain('ruby')
  })
})
