import { describe, test, expect } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'

describe('ts-fsrs createEmptyCard date format compatibility', () => {
  test('accepts new Date() object', () => {
    const now = new Date()
    const card = createEmptyCard(now)
    
    expect(card).toBeDefined()
    expect(card.due).toBeDefined()
    expect(card.stability).toBeDefined()
    expect(card.difficulty).toBeDefined()
    expect(card.elapsed_days).toBeDefined()
    expect(card.scheduled_days).toBeDefined()
    expect(card.reps).toBeDefined()
    expect(card.lapses).toBeDefined()
    expect(card.state).toBeDefined()
    expect(card.learning_steps).toBeDefined()
    // Note: last_review is NOT a property of empty cards
  })

  test('accepts Date.now() timestamp', () => {
    const timestamp = Date.now()
    const card = createEmptyCard(timestamp)
    
    expect(card).toBeDefined()
    expect(card.due).toBeDefined()
    expect(card.stability).toBeDefined()
    expect(card.difficulty).toBeDefined()
    expect(card.elapsed_days).toBeDefined()
    expect(card.scheduled_days).toBeDefined()
    expect(card.reps).toBeDefined()
    expect(card.lapses).toBeDefined()
    expect(card.state).toBeDefined()
    expect(card.learning_steps).toBeDefined()
    // Note: last_review is NOT a property of empty cards
  })

  test('accepts specific Date object', () => {
    const specificDate = new Date('2025-10-09T12:00:00Z')
    const card = createEmptyCard(specificDate)
    
    expect(card).toBeDefined()
    expect(card.due).toBeDefined()
    // The due date should match the input date
    expect(card.due.getTime()).toBe(specificDate.getTime())
  })

  test('accepts specific timestamp number', () => {
    const specificTimestamp = new Date('2025-10-09T12:00:00Z').getTime()
    const card = createEmptyCard(specificTimestamp)
    
    expect(card).toBeDefined()
    expect(card.due).toBeDefined()
    // The due date should match the input timestamp
    expect(card.due.getTime()).toBe(specificTimestamp)
  })

  test('compares cards created with Date vs timestamp', () => {
    const date = new Date('2025-10-09T12:00:00Z')
    const timestamp = date.getTime()
    
    const cardFromDate = createEmptyCard(date)
    const cardFromTimestamp = createEmptyCard(timestamp)
    
    // Both should have the same due time
    expect(cardFromDate.due.getTime()).toBe(cardFromTimestamp.due.getTime())
    
    // Other properties should be identical for new cards
    expect(cardFromDate.stability).toBe(cardFromTimestamp.stability)
    expect(cardFromDate.difficulty).toBe(cardFromTimestamp.difficulty)
    expect(cardFromDate.elapsed_days).toBe(cardFromTimestamp.elapsed_days)
    expect(cardFromDate.scheduled_days).toBe(cardFromTimestamp.scheduled_days)
    expect(cardFromDate.reps).toBe(cardFromTimestamp.reps)
    expect(cardFromDate.lapses).toBe(cardFromTimestamp.lapses)
    expect(cardFromDate.state).toBe(cardFromTimestamp.state)
  })

  test('handles edge cases', () => {
    // Test with very old date
    const oldDate = new Date('1970-01-01T00:00:00Z')
    const cardFromOldDate = createEmptyCard(oldDate)
    expect(cardFromOldDate).toBeDefined()
    expect(cardFromOldDate.due.getTime()).toBe(oldDate.getTime())

    // Test with timestamp 0 - Note: createEmptyCard ignores 0 and uses current time
    const cardFromZero = createEmptyCard(0)
    expect(cardFromZero).toBeDefined()
    // The due time will be current time, not 0
    expect(cardFromZero.due.getTime()).toBeGreaterThan(0)

    // Test with future date
    const futureDate = new Date('2030-12-31T23:59:59Z')
    const cardFromFuture = createEmptyCard(futureDate)
    expect(cardFromFuture).toBeDefined()
    expect(cardFromFuture.due.getTime()).toBe(futureDate.getTime())
  })

  test('validates card structure matches expected FSRS format', () => {
    const card = createEmptyCard(new Date())
    
    // Check that the card has all expected FSRS properties
    const expectedProperties = [
      'due',
      'stability', 
      'difficulty',
      'elapsed_days',
      'scheduled_days',
      'reps',
      'lapses',
      'state',
      'learning_steps'
    ]
    
    expectedProperties.forEach(prop => {
      expect(card).toHaveProperty(prop)
    })

    // Check initial values for new card
    expect(card.reps).toBe(0)
    expect(card.lapses).toBe(0)
    expect(card.elapsed_days).toBe(0)
    expect(card.scheduled_days).toBe(0)
    expect(card.state).toBe(0) // New state
    expect(card.learning_steps).toBe(0)
  })

  test('handles null and undefined gracefully', () => {
    // createEmptyCard with null/undefined uses current time instead of throwing
    const cardFromNull = createEmptyCard(null)
    expect(cardFromNull).toBeDefined()
    expect(cardFromNull.due.getTime()).toBeGreaterThan(0)

    const cardFromUndefined = createEmptyCard(undefined)
    expect(cardFromUndefined).toBeDefined()
    expect(cardFromUndefined.due.getTime()).toBeGreaterThan(0)
  })

  test('throws error for invalid string input', () => {
    // Only invalid string dates throw errors
    expect(() => createEmptyCard('invalid-string')).toThrow('Invalid date')
    expect(() => createEmptyCard('not-a-date')).toThrow('Invalid date')
    
    // Valid date strings should work
    expect(() => createEmptyCard('2025-10-09T12:00:00Z')).not.toThrow()
  })
})
