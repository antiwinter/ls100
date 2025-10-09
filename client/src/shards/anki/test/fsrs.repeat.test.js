import { describe, test, expect } from 'vitest'
import { FSRS, createEmptyCard, Rating } from 'ts-fsrs'

describe('FSRS repeat method output analysis', () => {
  test('stringify next.card from fsrs.repeat with different inputs', () => {
    const fsrs = new FSRS()
    const now = new Date('2025-10-09T12:00:00Z')
    
    console.log('=== Testing fsrs.repeat() output ===')
    console.log('Current time:', now.toISOString())
    
    // Test 1: Using createEmptyCard with Date object
    console.log('\n--- Test 1: createEmptyCard(new Date()) ---')
    const emptyCardFromDate = createEmptyCard(now)
    console.log('Empty card from Date:', JSON.stringify(emptyCardFromDate, null, 2))
    
    const nextFromDate = fsrs.repeat(emptyCardFromDate, now)
    console.log('Rating.Good result:', JSON.stringify(nextFromDate[Rating.Good].card, null, 2))
    
    // Test 2: Using createEmptyCard with timestamp
    console.log('\n--- Test 2: createEmptyCard(timestamp) ---')
    const timestamp = now.getTime()
    const emptyCardFromTimestamp = createEmptyCard(timestamp)
    console.log('Empty card from timestamp:', JSON.stringify(emptyCardFromTimestamp, null, 2))
    
    const nextFromTimestamp = fsrs.repeat(emptyCardFromTimestamp, now)
    console.log('Rating.Good result:', JSON.stringify(nextFromTimestamp[Rating.Good].card, null, 2))
    
    // Test 3: Simulate the actual code pattern from studyEngine2.js
    console.log('\n--- Test 3: Simulate studyEngine2.js pattern ---')
    const existingFsrsCard = null // Simulate card.fsrs?.[0] being null
    const baseCard = existingFsrsCard || createEmptyCard(now)
    console.log('Base card (existingFsrsCard || createEmptyCard(now)):', JSON.stringify(baseCard, null, 2))
    
    const next = fsrs.repeat(baseCard, now)
    console.log('All rating results:')
    console.log('Rating.Again (1):', JSON.stringify(next[Rating.Again].card, null, 2))
    console.log('Rating.Hard (2):', JSON.stringify(next[Rating.Hard].card, null, 2))
    console.log('Rating.Good (3):', JSON.stringify(next[Rating.Good].card, null, 2))
    console.log('Rating.Easy (4):', JSON.stringify(next[Rating.Easy].card, null, 2))
    
    // Test 4: Test with existing FSRS card (simulate a card that has been rated before)
    console.log('\n--- Test 4: With existing FSRS history ---')
    const firstRating = fsrs.repeat(createEmptyCard(now), now)[Rating.Good]
    console.log('After first rating (Good):', JSON.stringify(firstRating.card, null, 2))
    
    // Rate it again
    const laterTime = new Date('2025-10-10T12:00:00Z')
    const secondRating = fsrs.repeat(firstRating.card, laterTime)[Rating.Good]
    console.log('After second rating (Good):', JSON.stringify(secondRating.card, null, 2))
    
    // Test 5: Compare due field formats
    console.log('\n--- Test 5: Due field format comparison ---')
    const cards = [
      { name: 'Empty from Date', card: createEmptyCard(now) },
      { name: 'Empty from timestamp', card: createEmptyCard(timestamp) },
      { name: 'After Good rating', card: next[Rating.Good].card },
      { name: 'After Again rating', card: next[Rating.Again].card }
    ]
    
    cards.forEach(({ name, card }) => {
      console.log(`${name}:`)
      console.log(`  due type: ${typeof card.due}`)
      console.log(`  due value: ${card.due}`)
      console.log(`  due.getTime(): ${card.due.getTime()}`)
      console.log(`  JSON.stringify(due): ${JSON.stringify(card.due)}`)
    })
    
    // Just to make the test pass
    expect(true).toBe(true)
  })
  
  test('verify fsrs.repeat returns expected structure', () => {
    const fsrs = new FSRS()
    const now = new Date()
    const emptyCard = createEmptyCard(now)
    
    const result = fsrs.repeat(emptyCard, now)
    
    // Should have results for all 4 ratings
    expect(result[Rating.Again]).toBeDefined()
    expect(result[Rating.Hard]).toBeDefined()
    expect(result[Rating.Good]).toBeDefined()
    expect(result[Rating.Easy]).toBeDefined()
    
    // Each result should have card and log properties
    Object.values(result).forEach(ratingResult => {
      expect(ratingResult).toHaveProperty('card')
      expect(ratingResult).toHaveProperty('log')
      expect(ratingResult.card).toHaveProperty('due')
      expect(ratingResult.card.due).toBeInstanceOf(Date)
    })
  })

  test('due field stringification summary table', () => {
    const fsrs = new FSRS()
    const now = new Date('2025-10-09T12:00:00Z')
    
    console.log('\n=== DUE FIELD STRINGIFICATION SUMMARY ===')
    console.log('Input Type | JSON.stringify(card.due) Output')
    console.log('-----------|----------------------------------')
    
    // Test different inputs
    const testCases = [
      { 
        name: 'new Date()', 
        input: now,
        description: 'Date object'
      },
      { 
        name: 'Date.now()', 
        input: now.getTime(),
        description: 'Timestamp number'
      },
      { 
        name: 'null', 
        input: null,
        description: 'null (uses current time)'
      },
      { 
        name: 'undefined', 
        input: undefined,
        description: 'undefined (uses current time)'
      }
    ]
    
    testCases.forEach(({ name, input, description }) => {
      const card = createEmptyCard(input)
      const stringifiedDue = JSON.stringify(card.due)
      console.log(`${name.padEnd(11)}| ${stringifiedDue}`)
    })
    
    console.log('\n=== FSRS.REPEAT() OUTPUT FORMATS ===')
    const emptyCard = createEmptyCard(now)
    const ratingResults = fsrs.repeat(emptyCard, now)
    
    console.log('Rating     | Due Time (JSON.stringify)')
    console.log('-----------|---------------------------')
    console.log(`Again (1)  | ${JSON.stringify(ratingResults[Rating.Again].card.due)}`)
    console.log(`Hard (2)   | ${JSON.stringify(ratingResults[Rating.Hard].card.due)}`)
    console.log(`Good (3)   | ${JSON.stringify(ratingResults[Rating.Good].card.due)}`)
    console.log(`Easy (4)   | ${JSON.stringify(ratingResults[Rating.Easy].card.due)}`)
    
    // All due fields should be Date objects that stringify to ISO format
    Object.values(ratingResults).forEach(result => {
      expect(result.card.due).toBeInstanceOf(Date)
      expect(JSON.stringify(result.card.due)).toMatch(/^\"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\"$/)
    })
  })
})