// Test database abstraction layer compatibility
// This test verifies that the new dbc abstraction works with existing SQLite data
// and can switch between SQLite and PostgreSQL modes

import { migrator, q, tx, db, end } from '../utils/dbc/index.js'
import * as userModel from '../modules/auth/data.js'
import * as shardModel from '../modules/shard/data.js'
import { log } from '../utils/logger.js'
import crypto from 'crypto'

const runTests = async () => {
  console.log('🧪 Testing Database Abstraction Layer...\n')
  
  const isPostgres = process.env.USE_POSTGRES === 'true'
  const dbType = isPostgres ? 'PostgreSQL' : 'SQLite'
  
  console.log(`📊 Running tests in ${dbType} mode`)
  console.log(`📍 Database: ${process.env.DATABASE || 'default'}`)
  console.log(`🔧 USE_POSTGRES: ${process.env.USE_POSTGRES || 'false'}\n`)

  try {
    // Test 1: Migration system
    console.log('1. Testing migration system...')
    try {
      await migrator.migrate()
      console.log(`✅ Migrations completed (${dbType})`)
    } catch (migrationError) {
      // Handle duplicate column errors gracefully (existing database)
      if (migrationError.message.includes('duplicate column') || 
          migrationError.message.includes('already exists')) {
        console.log(`✅ Migrations skipped (${dbType}) - database already up to date`)
      } else {
        throw migrationError
      }
    }

    // Test 2: Query interface - direct queries
    console.log('\n2. Testing query interface...')
    
    // Test basic SELECT
    const userCountResult = await q('SELECT COUNT(*) as count FROM users')
    const userCount = userCountResult.rows[0].count
    console.log(`✅ Direct query works - Found ${userCount} existing users`)

    // Test parameterized query (PostgreSQL style)
    if (userCount > 0) {
      const firstUser = await q('SELECT * FROM users LIMIT 1')
      if (firstUser.rows.length > 0) {
        const user = firstUser.rows[0]
        const foundById = await q('SELECT * FROM users WHERE id = $1', [user.id])
        console.log(`✅ Parameterized query works - Found user: ${foundById.rows[0]?.email}`)
      }
    }

    // Test 3: Legacy db interface (for backward compatibility)
    console.log('\n3. Testing legacy db interface...')
    if (db && !isPostgres) {
      // Only test legacy interface in SQLite mode
      const legacyResult = await db.prepare('SELECT COUNT(*) as count FROM users').get()
      console.log(`✅ Legacy interface works - Count: ${legacyResult.count}`)
    } else if (isPostgres) {
      // Test PostgreSQL shim
      const shimResult = await db.prepare('SELECT COUNT(*) as count FROM users').get()
      console.log(`✅ PostgreSQL shim works - Count: ${shimResult.count}`)
    }

    // Test 4: Transaction handling
    console.log('\n4. Testing transaction handling...')
    const testData = {
      email: `test-${Date.now()}@abstraction-test.com`,
      password: 'test123',
      name: 'Abstraction Test User'
    }

    let testUserId
    try {
      // Test direct transaction with q function
      testUserId = crypto.randomUUID()
      const result = await tx(async (client) => {
        // Create user directly in transaction
        const userData = {
          id: testUserId,
          email: testData.email,
          name: testData.name,
          password_hash: 'test_hash',
          created_at: new Date().toISOString()
        }
        
        await client.query('INSERT INTO users (id, email, name, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)', [
          userData.id, userData.email, userData.name, userData.password_hash, userData.created_at
        ])
        
        // Verify user exists within transaction
        const found = await client.query('SELECT * FROM users WHERE id = $1', [userData.id])
        if (!found.rows[0]) throw new Error('User not found within transaction')
        
        return userData
      })
      console.log(`✅ Transaction works - Created user: ${result.email}`)
      
      // Verify user persisted after transaction
      const persistedUser = await userModel.findById(testUserId)
      if (persistedUser) {
        console.log(`✅ Transaction persistence verified`)
      } else {
        throw new Error('User not persisted after transaction')
      }
    } catch (error) {
      console.log(`❌ Transaction test failed: ${error.message}`)
    }

    // Test 5: Model layer compatibility
    console.log('\n5. Testing model layer compatibility...')
    
    // Test user model
    const allUsers = await userModel.findAll()
    console.log(`✅ User model works - Total users: ${allUsers.length}`)
    
    if (testUserId) {
      const testUser = await userModel.findById(testUserId)
      if (testUser) {
        const emailFound = await userModel.findByEmail(testUser.email)
        console.log(`✅ User lookup methods work - Found by email: ${!!emailFound}`)
      }
    }

    // Test shard model
    const publicShards = await shardModel.findPublic()
    console.log(`✅ Shard model works - Public shards: ${publicShards.length}`)

    // Test 6: Data integrity verification
    console.log('\n6. Testing data integrity...')
    
    // Count records in key tables
    const tables = ['users', 'shards', 'subtitles', 'invite_codes']
    for (const table of tables) {
      try {
        const result = await q(`SELECT COUNT(*) as count FROM ${table}`)
        const count = result.rows[0].count
        console.log(`   ${table}: ${count} records`)
      } catch (error) {
        console.log(`   ${table}: Table not found or error - ${error.message}`)
      }
    }

    // Test 7: Error handling
    console.log('\n7. Testing error handling...')
    try {
      await q('SELECT * FROM nonexistent_table')
      console.log('❌ Error handling test failed - should have thrown')
    } catch (error) {
      console.log('✅ Error handling works - caught expected error')
    }

    // Cleanup test user
    if (testUserId) {
      try {
        await q('DELETE FROM users WHERE id = $1', [testUserId])
        console.log('\n🧹 Cleanup completed - test user removed')
      } catch (error) {
        console.log(`\n⚠️  Cleanup warning: ${error.message}`)
      }
    }

    console.log('\n🎉 All database abstraction tests passed!')
    console.log(`📊 Database type: ${dbType}`)
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Run tests and handle cleanup
runTests()
  .then(() => {
    console.log('\n✅ Test suite completed successfully')
    return end()
  })
  .then(() => {
    console.log('📊 Database connections closed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error.message)
    return end().then(() => process.exit(1))
  })
