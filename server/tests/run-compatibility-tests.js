#!/usr/bin/env node
// Test runner for database abstraction layer compatibility
// Usage: node run-compatibility-tests.js [test-name]

import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const testDir = path.dirname(import.meta.filename)

// Available tests
const tests = {
  'abstraction': {
    file: 'test-db-abstraction.js',
    description: 'Database abstraction layer functionality'
  },
  'auth': {
    file: 'test-auth-compatibility.js', 
    description: 'Auth module compatibility with new abstraction'
  },
  'switching': {
    file: 'test-db-switching.js',
    description: 'Database switching between SQLite and PostgreSQL (skip for now)',
    skip: true
  }
}

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

const log = (color, message) => console.log(`${colors[color]}${message}${colors.reset}`)

// Environment setup check
const checkEnvironment = () => {
  log('cyan', '\n🔍 Checking Environment Setup...')
  
  const dbPath = process.env.DATABASE
  const usePg = process.env.USE_POSTGRES
  
  if (!dbPath) {
    log('red', '❌ DATABASE environment variable not set')
    log('yellow', '📝 Add DATABASE=/path/to/database.sqlite to your .env file')
    return false
  }
  
  log('green', `✅ DATABASE: ${dbPath}`)
  log('blue', `🔧 USE_POSTGRES: ${usePg || 'false (SQLite mode)'}`)
  
  // Check if database file exists (for SQLite)
  if (!dbPath.startsWith('postgresql://')) {
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath)
      log('green', `✅ SQLite database found (${Math.round(stats.size / 1024)} KB)`)
    } else {
      log('yellow', '⚠️  SQLite database file not found - will be created by migration')
    }
  }
  
  return true
}

// Run a single test
const runTest = async (testName, testInfo) => {
  log('cyan', `\n🧪 Running ${testInfo.description}...`)
  log('blue', `📁 File: ${testInfo.file}`)
  
  try {
    const result = execSync(`node ${testInfo.file}`, {
      cwd: testDir,
      encoding: 'utf8',
      stdio: 'pipe'
    })
    
    log('green', `✅ ${testName} test PASSED`)
    
    // Show last few lines of output
    const lines = result.trim().split('\n')
    const summary = lines.slice(-3)
    summary.forEach(line => log('green', `   ${line}`))
    
    return { success: true, output: result }
  } catch (error) {
    log('red', `❌ ${testName} test FAILED`)
    log('red', `   Error: ${error.message}`)
    
    // Show relevant output
    if (error.stdout) {
      const lines = error.stdout.trim().split('\n')
      const errorLines = lines.slice(-5)
      errorLines.forEach(line => log('yellow', `   ${line}`))
    }
    
    return { success: false, error: error.message, output: error.stdout }
  }
}

// Main test runner
const runTests = async () => {
  log('magenta', '🚀 Database Compatibility Test Suite')
  log('magenta', '=' .repeat(50))
  
  // Check environment
  if (!checkEnvironment()) {
    process.exit(1)
  }
  
  // Get test to run
  const testArg = process.argv[2]
  const testsToRun = testArg && tests[testArg] 
    ? { [testArg]: tests[testArg] }
    : Object.fromEntries(Object.entries(tests).filter(([name, test]) => !test.skip))
  
  log('cyan', `\n📋 Running ${Object.keys(testsToRun).length} test(s)...`)
  
  const results = {}
  let passCount = 0
  let totalCount = 0
  
  // Run tests sequentially
  for (const [testName, testInfo] of Object.entries(testsToRun)) {
    totalCount++
    const result = await runTest(testName, testInfo)
    results[testName] = result
    
    if (result.success) {
      passCount++
    }
    
    // Add some spacing between tests
    if (totalCount < Object.keys(testsToRun).length) {
      console.log('\n' + '-'.repeat(40))
    }
  }
  
  // Final results
  log('magenta', '\n' + '='.repeat(50))
  log('magenta', '📊 Test Results Summary')
  log('magenta', '='.repeat(50))
  
  for (const [testName, result] of Object.entries(results)) {
    const status = result.success ? '✅ PASS' : '❌ FAIL'
    const color = result.success ? 'green' : 'red'
    log(color, `${status} - ${testName}: ${tests[testName].description}`)
  }
  
  log('cyan', `\n📈 Results: ${passCount}/${totalCount} tests passed`)
  
  if (passCount === totalCount) {
    log('green', '🎉 All tests passed! Database abstraction layer is working correctly.')
    
    if (process.env.USE_POSTGRES === 'true') {
      log('green', '🚀 PostgreSQL mode verified - ready for production!')
    } else {
      log('blue', '📝 SQLite mode verified. To test PostgreSQL:')
      log('blue', '   1. Set up PostgreSQL database')
      log('blue', '   2. Update DATABASE to postgresql://...')
      log('blue', '   3. Run: USE_POSTGRES=true node run-compatibility-tests.js')
    }
    
    process.exit(0)
  } else {
    log('red', '💥 Some tests failed. Please check the output above.')
    process.exit(1)
  }
}

// Help text
const showHelp = () => {
  log('cyan', 'Database Compatibility Test Runner')
  log('cyan', '='.repeat(40))
  console.log('\nUsage: node run-compatibility-tests.js [test-name]')
  console.log('\nAvailable tests:')
  
  for (const [name, info] of Object.entries(tests)) {
    console.log(`  ${name.padEnd(12)} - ${info.description}`)
  }
  
  console.log('\nExamples:')
  console.log('  node run-compatibility-tests.js           # Run all tests')
  console.log('  node run-compatibility-tests.js auth      # Run only auth test')
  console.log('  USE_POSTGRES=true node run-compatibility-tests.js  # Test PostgreSQL mode')
  
  console.log('\nEnvironment variables:')
  console.log('  DATABASE      - Database connection (file path or postgresql://...)')
  console.log('  USE_POSTGRES  - Set to "true" to use PostgreSQL mode')
}

// Handle help and invalid arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp()
  process.exit(0)
}

if (process.argv[2] && !tests[process.argv[2]]) {
  log('red', `❌ Unknown test: ${process.argv[2]}`)
  console.log('\nAvailable tests:', Object.keys(tests).join(', '))
  process.exit(1)
}

// Run the tests
runTests().catch((error) => {
  log('red', `💥 Test runner failed: ${error.message}`)
  process.exit(1)
})
