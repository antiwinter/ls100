import { describe, test, expect } from 'vitest'
import * as engine21b from '../apkg/engine-21b.js'
import * as defaultEngine from '../apkg/engine-default.js'

const makeZipData = (files) => ({ files })

describe('APKG engine selection helpers', () => {
  test('engine-21b.compatible detects collection.anki21b', () => {
    const zip = makeZipData({ 'collection.anki21b': {} })
    expect(engine21b.compatible(zip)).toBe(true)
  })

  test('defaultEngine.compatible detects legacy collection files', () => {
    const zip = makeZipData({ 'collection.anki21': {}, 'media': {} })
    expect(defaultEngine.compatible(zip)).toBeTruthy()
  })

  test('defaultEngine.getCollectionFile prefers collection.anki2 when both present', () => {
    const zip = makeZipData({ 'collection.anki21': { name: '21' }, 'collection.anki2': { name: '2' } })
    const file = defaultEngine.getCollectionFile(zip)
    expect(file).toBe(zip.files['collection.anki2'])
  })
})


