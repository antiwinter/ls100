import { migrator, db } from '../utils/dbc/index.js'
import * as userModel from '../modules/auth/data.js'
import * as shardModel from '../modules/shard/data.js'

console.log('🧪 Testing Shard Module...\n')

try {
  // Test 1: Database initialization
  console.log('1. Testing database initialization...')
  await migrator.migrate()
  console.log('✅ Module-based migrations completed')

  // Clear tables for clean test
  db.prepare('DELETE FROM shards').run()
  db.prepare('DELETE FROM users').run()
  console.log('✅ Tables cleared for testing\n')

  // Test 2: Create test user (needed for shard ownership)
  console.log('2. Creating test user...')
  const testUser = await userModel.create({
    email: 'shardowner@example.com',
    password: 'password123',
    name: 'Shard Owner'
  })
  console.log(`✅ Test user created: ${testUser.email} (ID: ${testUser.id})\n`)

  // Test 3: Create shard
  console.log('3. Testing shard creation...')
  const shardData = {
    name: 'Matrix Learning Shard',
    owner_id: testUser.id,
    description: 'Learn English with The Matrix',
    type: 'subtitle',
    public: false,
    metadata: { movie: 'The Matrix', year: 1999 }
  }

  const createdShard = await shardModel.create(shardData)
  console.log('✅ Shard created')
  console.log(`   ID: ${createdShard.id}`)
  console.log(`   Name: ${createdShard.name}`)
  console.log(`   Owner: ${createdShard.owner_id}`)
  console.log(`   Type: ${createdShard.type}`)
  console.log(`   Public: ${createdShard.public}\n`)

  // Test 4: Find shard by ID
  console.log('4. Testing findById...')
  const foundShard = await shardModel.findById(createdShard.id)
  if (foundShard && foundShard.name === createdShard.name) {
    console.log('✅ Shard found by ID')
    console.log(`   Found: ${foundShard.name}`)
    console.log(`   Description: ${foundShard.description}`)
  } else {
    throw new Error('Shard not found by ID')
  }

  // Test 5: Find shards by owner
  console.log('\n5. Testing findByOwner...')
  const userShards = await shardModel.findByOwner(testUser.id)
  console.log(`✅ Found ${userShards.length} shards for user`)
  userShards.forEach(shard => {
    console.log(`   📁 ${shard.name} (${shard.type}, public: ${shard.public})`)
  })

  // Test 6: Create public shard
  console.log('\n6. Testing public shard creation...')
  const publicShardData = {
    id: `shard_${Date.now()}_public`,
    name: 'Public English Lessons',
    owner_id: testUser.id,
    description: 'Free English learning content',
    type: 'subtitle',
    public: true,
    metadata: { level: 'beginner' }
  }

  await shardModel.create(publicShardData)
  console.log('✅ Public shard created')
  console.log(`   Name: ${publicShardData.name}`)
  console.log(`   Public: ${publicShardData.public}\n`)

  // Test 7: Find public shards
  console.log('7. Testing findPublic...')
  const publicShards = await shardModel.findPublic()
  console.log(`✅ Found ${publicShards.length} public shards`)
  publicShards.forEach(shard => {
    console.log(`   🌐 ${shard.name} by ${shard.owner_id}`)
  })

  // Test 8: Update shard
  console.log('\n8. Testing shard updates...')
  const updateData = {
    name: 'Updated Matrix Learning',
    description: 'Enhanced learning experience with The Matrix',
    public: true
  }
  
  const updateResult = await shardModel.update(createdShard.id, updateData)
  if (updateResult.changes > 0) {
    console.log('✅ Shard updated successfully')
    
    // Verify update
    const updatedShard = await shardModel.findById(createdShard.id)
    console.log(`   New name: ${updatedShard.name}`)
    console.log(`   New description: ${updatedShard.description}`)
    console.log(`   Now public: ${updatedShard.public}`)
  } else {
    throw new Error('Shard update failed')
  }

  // Test 9: Shard statistics
  console.log('\n9. Testing shard statistics...')
  const stats = await shardModel.getStats()
  console.log('✅ Shard statistics:')
  console.log(`   Total shards: ${stats.total_shards}`)
  console.log(`   Public shards: ${stats.public_shards}`)
  console.log(`   Private shards: ${stats.private_shards}`)

  // Test 10: Delete shard
  console.log('\n10. Testing shard deletion...')
  const deleteResult = await shardModel.remove(createdShard.id)
  if (deleteResult.changes > 0) {
    console.log('✅ Shard deleted successfully')
    
    // Verify deletion
    const deletedShard = await shardModel.findById(createdShard.id)
    if (!deletedShard) {
      console.log('✅ Shard confirmed deleted from database')
    } else {
      throw new Error('Shard still exists after deletion')
    }
  } else {
    throw new Error('Shard deletion failed')
  }

  console.log('\n🎉 All shard module tests passed!')

} catch (error) {
  console.error('💥 Shard module test failed:', error)
  process.exit(1)
} 