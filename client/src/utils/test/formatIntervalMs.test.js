// Enhanced test suite for formatIntervalMs function
// KEEP THIS FILE: Contains 55 comprehensive test cases including debug print values
// Tests the actual formatIntervalMs function from dateFormat.js

import { describe, it, expect } from 'vitest'
import { formatIntervalMs } from '../dateFormat.js'

describe('formatIntervalMs', () => {
  // Comprehensive test cases (51 original + 4 from debug values)
  const testCases = [
  // Seconds (< 1 minute)
  [0, '<1m'],
  [30000, '<1m'],        // 30 seconds
  [45000, '<1m'],        // 45 seconds
  [59999, '<1m'],        // 59.999 seconds
  
  // Minutes (1m - 59m)
  [60000, '1m'],         // exactly 1 minute
  [90000, '1.5m'],       // 1.5 minutes
  [120000, '2m'],        // exactly 2 minutes
  [150000, '2.5m'],      // 2.5 minutes
  [180000, '3m'],        // exactly 3 minutes
  [300000, '5m'],        // 5 minutes
  [600000, '10m'],       // 10 minutes
  [1800000, '30m'],      // 30 minutes
  [3540000, '59m'],      // 59 minutes
  [3594000, '59.9m'],    // 59.9 minutes
  
  // Hours (1h - 23h)
  [3600000, '1h'],       // exactly 1 hour
  [5400000, '1.5h'],     // 1.5 hours
  [7200000, '2h'],       // exactly 2 hours
  [10800000, '3h'],      // 3 hours
  [14400000, '4h'],      // 4 hours
  [21600000, '6h'],      // 6 hours
  [43200000, '12h'],     // 12 hours
  [82800000, '23h'],     // 23 hours
  [84600000, '23.5h'],   // 23.5 hours
  
  // Days (1d - 29d)
  [86400000, '1d'],      // exactly 1 day
  [129600000, '1.5d'],   // 1.5 days
  [172800000, '2d'],     // exactly 2 days
  [259200000, '3d'],     // 3 days
  [345600000, '4d'],     // 4 days
  [604800000, '7d'],     // 7 days
  [1209600000, '14d'],   // 14 days
  [1814400000, '21d'],   // 21 days
  [2505600000, '29d'],   // 29 days
  [2419200000, '28d'],   // 28 days
  [2462400000, '28.5d'], // 28.5 days
  
  // Months (1mo - 11mo)
  [2592000000, '1mo'],   // exactly 30 days = 1 month
  [3888000000, '1.5mo'], // 45 days = 1.5 months
  [5184000000, '2mo'],   // 60 days = 2 months
  [7776000000, '3mo'],   // 90 days = 3 months
  [10368000000, '4mo'],  // 120 days = 4 months
  [15552000000, '6mo'],  // 180 days = 6 months
  [20736000000, '8mo'],  // 240 days = 8 months
  [23328000000, '9mo'],  // 270 days = 9 months
  [28512000000, '11mo'], // 330 days = 11 months
  [27216000000, '10.5mo'], // 315 days = 10.5 months
  
  // Years (1y+)
  [31536000000, '1y'],   // exactly 365 days = 1 year
  [47304000000, '1.5y'], // 547.5 days = 1.5 years
  [63072000000, '2y'],   // 730 days = 2 years
  [94608000000, '3y'],   // 1095 days = 3 years
  [126144000000, '4y'],  // 1460 days = 4 years
  [315360000000, '10y'], // 3650 days = 10 years
  [331776000000, '10.5y'], // 3838.5 days = 10.5 years
  
  // Test cases from debug print values (estimated based on common FSRS intervals)
  [691200000, '8d'],     // ~8 days (from 8.0d in screenshot)
  [360000, '6m'],        // 6 minutes (from 6.0m in screenshot) 
  [600000, '10m'],       // 10 minutes (from 10.0m in screenshot)
    [259200000, '3d'],     // ~3 days (realistic FSRS interval)
  ]

  it('should format all 55 test cases correctly', () => {
    testCases.forEach(([ms, expected]) => {
      expect(formatIntervalMs(ms)).toBe(expected)
    })
  })

  describe('.0 elimination', () => {
    it('should eliminate .0 from whole numbers but keep meaningful decimals', () => {
      const eliminationTests = [
        [120000, '2m'],      // Should NOT show 2.0m
        [7200000, '2h'],     // Should NOT show 2.0h  
        [172800000, '2d'],   // Should NOT show 2.0d
        [5184000000, '2mo'], // Should NOT show 2.0mo
        [63072000000, '2y'], // Should NOT show 2.0y
        [90000, '1.5m'],     // Should show 1.5m (keep meaningful decimals)
        [5400000, '1.5h'],   // Should show 1.5h (keep meaningful decimals)
      ]

      eliminationTests.forEach(([ms, expected]) => {
        expect(formatIntervalMs(ms)).toBe(expected)
      })
    })
  })

  describe('debug values from app', () => {
    it('should format realistic FSRS intervals correctly', () => {
      const debugExamples = [
        [600000, '10m'],     // 10 minutes - Again rating
        [3600000, '1h'],     // 1 hour - Hard rating  
        [691200000, '8d'],   // 8 days - Good rating
        [2592000000, '1mo'], // 1 month - Easy rating
      ]

      debugExamples.forEach(([ms, expected]) => {
        expect(formatIntervalMs(ms)).toBe(expected)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle very small values', () => {
      expect(formatIntervalMs(0)).toBe('<1m')
      expect(formatIntervalMs(30000)).toBe('<1m')
      expect(formatIntervalMs(59999)).toBe('<1m')
    })

    it('should handle very large values', () => {
      expect(formatIntervalMs(315360000000)).toBe('10y')  // 10 years
      expect(formatIntervalMs(331776000000)).toBe('10.5y') // 10.5 years
    })
  })
})
