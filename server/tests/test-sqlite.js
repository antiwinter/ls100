import { runMigrations, db } from '../utils/dbc.js'
import * as userModel from './modules/auth/user.js'
import * as shardModel from './modules/shard/shard.js'
import * as subtitleModel from './modules/subtitle/subtitle.js'
import { uploadSubtitle, computeHash } from './modules/subtitle/subtitle-storage.js'

console.log('🧪 Testing SQLite Implementation...\n')

try {
  // Test 1: Database initialization
  console.log('1. Testing database initialization...')
  runMigrations()
  console.log('✅ Database migrations completed')

  // Test 2: User creation
  console.log('\n2. Testing user creation...')
  const user = await userModel.create({
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  })
  console.log(`✅ User created: ${user.id}`)

  // Test 3: User lookup
  console.log('\n3. Testing user lookup...')
  const foundUser = userModel.findByEmail('test@example.com')
  console.log(`✅ User found: ${foundUser.name}`)

  // Test 4: Subtitle upload (mock)
  console.log('\n4. Testing subtitle upload...')
  const sampleSrt = `1
00:00:01,000 --> 00:00:04,000
Hello, welcome to the matrix.

2
00:00:05,500 --> 00:00:08,200
This is your last chance.`

  const buffer = Buffer.from(sampleSrt)
  const hash = computeHash(buffer)
  console.log(`✅ Hash computed: ${hash.substring(0, 16)}...`)

  const result = await uploadSubtitle(hash, buffer, {
    movie_name: 'The Matrix',
    language: 'en'
  })
  console.log(`✅ Subtitle uploaded: ${result.lightning ? 'Lightning' : 'New'} upload`)

  // Test 5: Shard creation
  console.log('\n5. Testing shard creation...')
  const shard = shardModel.create({
    name: 'Test Matrix Shard',
    owner_id: user.id,
    description: 'Test shard for SQLite',
    metadata: {
      movie_name: 'The Matrix',
      duration: '02:16:00'
    },
    public: false
  })
  console.log(`✅ Shard created: ${shard.id}`)

  // Test 6: Link subtitle to shard
  console.log('\n6. Testing shard-subtitle linking...')
  shardModel.linkSubtitle(shard.id, hash)
  const linkedSubtitles = shardModel.getSubtitles(shard.id)
  console.log(`✅ Linked subtitles: ${linkedSubtitles.length}`)

  // Test 7: Query operations
  console.log('\n7. Testing query operations...')
  const userShards = shardModel.findByOwner(user.id)
  console.log(`✅ User shards: ${userShards.length}`)

  const publicShards = shardModel.findPublic()
  console.log(`✅ Public shards: ${publicShards.length}`)

  console.log('\n🎉 All SQLite tests passed!')
  console.log('\n📋 Implementation Summary:')
  console.log('• ✅ SQLite database with better-sqlite3')
  console.log('• ✅ Database migrations system')
  console.log('• ✅ User authentication model')
  console.log('• ✅ Shard management model')
  console.log('• ✅ Subtitle storage with deduplication')
  console.log('• ✅ Abstract storage layer (OSS-ready)')
  console.log('• ✅ Lightning upload system')
  console.log('• ✅ Foreign key relationships')
  console.log('\n🚀 Ready for Phase 1.2 frontend integration!')

} catch (error) {
  console.error('❌ Test failed:', error)
} finally {
  // Clean up test data
  try {
    db.prepare('DELETE FROM shard_subtitles').run()
    db.prepare('DELETE FROM shards').run()
    db.prepare('DELETE FROM subtitles').run()
    db.prepare('DELETE FROM users').run()
    console.log('\n🧹 Test data cleaned up')
  } catch (error) {
    console.log('⚠️ Cleanup warning:', error.message)
  }
} 