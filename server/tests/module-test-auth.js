import { runMigrations, db } from '../utils/db/connection.js'
import * as userModel from '../modules/auth/data.js'
import { requireAuth, JWT_SECRET } from '../utils/auth-middleware.js'
import jwt from 'jsonwebtoken'

console.log('🧪 Testing Auth Module...\n')

try {
  // Test 1: Database initialization
  console.log('1. Testing database initialization...')
  runMigrations()
  console.log('✅ Module-based migrations completed')

  // Clear users table for clean test
  db.prepare('DELETE FROM users').run()
  console.log('✅ Users table cleared for testing\n')

  // Test 2: User creation
  console.log('2. Testing user creation...')
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    name: 'Test User'
  }

  const createdUser = await userModel.create(testUser)
  console.log('✅ User created:', createdUser.email)
  console.log(`   ID: ${createdUser.id}`)
  console.log(`   Name: ${createdUser.name}`)
  console.log(`   Created: ${createdUser.created_at}\n`)

  // Test 3: Find user by email
  console.log('3. Testing findByEmail...')
  const foundUser = userModel.findByEmail('test@example.com')
  if (foundUser && foundUser.email === testUser.email) {
    console.log('✅ User found by email')
    console.log(`   Found: ${foundUser.name} (${foundUser.email})`)
  } else {
    throw new Error('User not found by email')
  }

  // Test 4: Find user by ID
  console.log('\n4. Testing findById...')
  const foundById = userModel.findById(createdUser.id)
  if (foundById && foundById.id === createdUser.id) {
    console.log('✅ User found by ID')
    console.log(`   Found: ${foundById.name} (ID: ${foundById.id})`)
  } else {
    throw new Error('User not found by ID')
  }

  // Test 5: Password verification
  console.log('\n5. Testing password verification...')
  const isValidPassword = await userModel.verifyPassword(foundUser, 'password123')
  const isInvalidPassword = await userModel.verifyPassword(foundUser, 'wrongpassword')
  
  if (isValidPassword && !isInvalidPassword) {
    console.log('✅ Password verification working correctly')
    console.log(`   Valid password: ${isValidPassword}`)
    console.log(`   Invalid password: ${isInvalidPassword}`)
  } else {
    throw new Error('Password verification failed')
  }

  // Test 6: Duplicate email handling
  console.log('\n6. Testing duplicate email handling...')
  try {
    await userModel.create({
      email: 'test@example.com', // Same email
      password: 'different123',
      name: 'Different User'
    })
    throw new Error('Should have failed with duplicate email')
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      console.log('✅ Duplicate email correctly rejected')
      console.log(`   Error: ${error.message}`)
    } else {
      throw error
    }
  }

  // Test 7: JWT middleware testing
  console.log('\n7. Testing JWT middleware...')
  
  // Create a test token
  const tokenPayload = { userId: createdUser.id, email: createdUser.email }
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' })
  console.log('✅ JWT token created')

  // Mock request/response for middleware testing
  const mockReq = {
    header: (name) => name === 'Authorization' ? `Bearer ${token}` : null,
    headers: { authorization: `Bearer ${token}` }
  }
  const mockRes = {
    status: (code) => ({ json: (data) => ({ statusCode: code, data }) })
  }
  
  let middlewareResult = null
  const mockNext = () => { middlewareResult = 'success' }

  // Test valid token
  requireAuth(mockReq, mockRes, mockNext)
  if (middlewareResult === 'success' && mockReq.userId === createdUser.id) {
    console.log('✅ JWT middleware validates token correctly')
    console.log(`   Decoded userId: ${mockReq.userId}`)
    console.log(`   Decoded user: ${JSON.stringify(mockReq.user)}`)
  } else {
    throw new Error('JWT middleware failed')
  }

  // Test 8: Find all users
  console.log('\n8. Testing findAll...')
  const allUsers = userModel.findAll()
  console.log(`✅ Found ${allUsers.length} total users`)
  allUsers.forEach(user => {
    console.log(`   👤 ${user.email} (${user.name})`)
  })

  console.log('\n🎉 All auth module tests passed!')

} catch (error) {
  console.error('💥 Auth module test failed:', error)
  process.exit(1)
} 