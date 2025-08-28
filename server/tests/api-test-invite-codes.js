// Force production mode for proper JWT authentication
process.env.NODE_ENV = 'production'

import express from 'express'
import request from 'supertest'
import { migrator, db } from '../utils/dbc/index.js'
import authRoutes from '../modules/auth/api.js'
import * as userModel from '../modules/auth/data.js'

console.log('🧪 Testing Invite Code API Endpoints...\n')

// Create test app
const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)

let testUser, authToken

try {
  // Test 1: Setup - Database and test user
  console.log('1. Setting up test environment...')
  runMigrations()
  
  // Clear tables
  db.pragma('foreign_keys = OFF')
  db.prepare('DELETE FROM invite_codes').run()
  db.prepare('DELETE FROM users').run()
  db.pragma('foreign_keys = ON')

  // Create test user
  testUser = await userModel.create({
    email: 'testuser@example.com',
    password: 'password123',
    name: 'Test User'
  })
  
  console.log('✅ Test environment setup complete')
  console.log(`   Test user: ${testUser.name} (${testUser.id})\n`)

  // Test 2: User login to get auth token
  console.log('2. Testing user login for auth token...')
  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'testuser@example.com',
      password: 'password123'
    })
    .expect(200)

  authToken = loginResponse.body.token
  if (authToken) {
    console.log('✅ Login successful, token received')
    console.log(`   Token prefix: ${authToken.substring(0, 20)}...\n`)
  } else {
    throw new Error('No auth token received')
  }

  // Test 3: Generate invite code (protected endpoint)
  console.log('3. Testing invite code generation API...')
  const generateResponse = await request(app)
    .post('/api/auth/invite/generate')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      maxUses: 2,
      expiresAt: null
    })
    .expect(200)

  const generatedCode = generateResponse.body.code
  if (generatedCode && generatedCode.length === 8) {
    console.log('✅ Invite code generated via API')
    console.log(`   Code: ${generatedCode}`)
    console.log(`   Max uses: ${generateResponse.body.maxUses}`)
    console.log(`   Created at: ${generateResponse.body.createdAt}\n`)
  } else {
    throw new Error('Invalid invite code generation response')
  }

  // Test 4: Generate invite code without auth (should fail)
  console.log('4. Testing unauthorized invite code generation...')
  const unauthorizedResponse = await request(app)
    .post('/api/auth/invite/generate')
    .send({ maxUses: 1 })
    .expect(401)

  if (unauthorizedResponse.body.error) {
    console.log('✅ Unauthorized request correctly rejected')
    console.log(`   Error: ${unauthorizedResponse.body.error}\n`)
  } else {
    throw new Error('Unauthorized request should have failed')
  }

  // Test 5: Validate invite code
  console.log('5. Testing invite code validation API...')
  const validateResponse = await request(app)
    .post('/api/auth/invite/validate')
    .send({ code: generatedCode })
    .expect(200)

  if (validateResponse.body.valid === true) {
    console.log('✅ Invite code validation successful')
    console.log(`   Valid: ${validateResponse.body.valid}`)
    console.log(`   Created by: ${validateResponse.body.createdBy}`)
    console.log(`   Max uses: ${validateResponse.body.maxUses}`)
    console.log(`   Current uses: ${validateResponse.body.currentUses}\n`)
  } else {
    throw new Error('Invite code validation failed')
  }

  // Test 6: Validate non-existent invite code
  console.log('6. Testing validation of non-existent code...')
  const invalidValidateResponse = await request(app)
    .post('/api/auth/invite/validate')
    .send({ code: 'INVALID1' })
    .expect(200)

  if (invalidValidateResponse.body.valid === false) {
    console.log('✅ Invalid code validation successful')
    console.log(`   Valid: ${invalidValidateResponse.body.valid}`)
    console.log(`   Reason: ${invalidValidateResponse.body.reason}\n`)
  } else {
    throw new Error('Invalid code should have failed validation')
  }

  // Test 7: Register with invite code
  console.log('7. Testing registration with invite code...')
  const registerResponse = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'New User',
      email: 'newuser@example.com',
      password: 'password123',
      inviteCode: generatedCode
    })
    .expect(200)

  if (registerResponse.body.user && registerResponse.body.inviteUsed === true) {
    console.log('✅ Registration with invite code successful')
    console.log(`   User: ${registerResponse.body.user.name}`)
    console.log(`   Email: ${registerResponse.body.user.email}`)
    console.log(`   Invite used: ${registerResponse.body.inviteUsed}\n`)
  } else {
    throw new Error('Registration with invite code failed')
  }

  // Test 8: Register with invalid invite code
  console.log('8. Testing registration with invalid invite code...')
  const invalidRegisterResponse = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Another User',
      email: 'anotheruser@example.com',
      password: 'password123',
      inviteCode: 'INVALID1'
    })
    .expect(400)

  if (invalidRegisterResponse.body.error && invalidRegisterResponse.body.error.includes('Invalid invite code')) {
    console.log('✅ Registration with invalid code correctly rejected')
    console.log(`   Error: ${invalidRegisterResponse.body.error}\n`)
  } else {
    throw new Error('Registration with invalid code should have failed')
  }

  // Test 9: Register with valid invite code (second use of multi-use code)
  console.log('9. Testing second use of multi-use invite code...')
  const secondRegisterResponse = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Second User',
      email: 'seconduser@example.com',
      password: 'password123',
      inviteCode: generatedCode
    })
    .expect(200)

  if (secondRegisterResponse.body.user && secondRegisterResponse.body.inviteUsed === true) {
    console.log('✅ Second use of multi-use code successful')
    console.log(`   User: ${secondRegisterResponse.body.user.name}`)
    console.log(`   Email: ${secondRegisterResponse.body.user.email}\n`)
  } else {
    throw new Error('Second use of multi-use code failed')
  }

  // Test 10: Try to use exhausted invite code
  console.log('10. Testing exhausted invite code...')
  const exhaustedRegisterResponse = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Third User',
      email: 'thirduser@example.com',
      password: 'password123',
      inviteCode: generatedCode
    })
    .expect(400)

  if (exhaustedRegisterResponse.body.error && exhaustedRegisterResponse.body.error.includes('Code already used')) {
    console.log('✅ Exhausted invite code correctly rejected')
    console.log(`   Error: ${exhaustedRegisterResponse.body.error}\n`)
  } else {
    throw new Error('Exhausted invite code should have failed')
  }

  // Test 11: Get user's invite codes
  console.log('11. Testing get user invite codes API...')
  const myCodesResponse = await request(app)
    .get('/api/auth/invite/my-codes')
    .set('Authorization', `Bearer ${authToken}`)
    .expect(200)

  if (myCodesResponse.body.codes && myCodesResponse.body.stats) {
    console.log('✅ User invite codes retrieved successfully')
    console.log(`   Total codes: ${myCodesResponse.body.codes.length}`)
    console.log(`   Stats: ${JSON.stringify(myCodesResponse.body.stats)}`)
    
    myCodesResponse.body.codes.forEach((code, index) => {
      console.log(`   Code ${index + 1}: ${code.code} (${code.current_uses}/${code.max_uses} uses)`)
    })
    console.log('')
  } else {
    throw new Error('Failed to get user invite codes')
  }

  // Test 12: Get user invite codes without auth (should fail)
  console.log('12. Testing unauthorized access to invite codes...')
  const unauthorizedCodesResponse = await request(app)
    .get('/api/auth/invite/my-codes')
    .expect(401)

  if (unauthorizedCodesResponse.body.error) {
    console.log('✅ Unauthorized access correctly rejected')
    console.log(`   Error: ${unauthorizedCodesResponse.body.error}\n`)
  } else {
    throw new Error('Unauthorized access should have failed')
  }

  // Test 13: Generate invite code with invalid max uses
  console.log('13. Testing invite code generation with invalid max uses...')
  const invalidMaxUsesResponse = await request(app)
    .post('/api/auth/invite/generate')
    .set('Authorization', `Bearer ${authToken}`)
    .send({ maxUses: 150 }) // Over the limit of 100
    .expect(400)

  if (invalidMaxUsesResponse.body.error && invalidMaxUsesResponse.body.error.includes('Max uses must be between 1 and 100')) {
    console.log('✅ Invalid max uses correctly rejected')
    console.log(`   Error: ${invalidMaxUsesResponse.body.error}\n`)
  } else {
    throw new Error('Invalid max uses should have failed')
  }

  // Test 14: Registration without invite code (should still work)
  console.log('14. Testing registration without invite code...')
  const normalRegisterResponse = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Normal User',
      email: 'normaluser@example.com',
      password: 'password123'
    })
    .expect(200)

  if (normalRegisterResponse.body.user && normalRegisterResponse.body.inviteUsed === false) {
    console.log('✅ Registration without invite code successful')
    console.log(`   User: ${normalRegisterResponse.body.user.name}`)
    console.log(`   Invite used: ${normalRegisterResponse.body.inviteUsed}\n`)
  } else {
    throw new Error('Registration without invite code failed')
  }

  console.log('🎉 All invite code API tests passed!')

} catch (error) {
  console.error('💥 Invite code API test failed:', error)
  process.exit(1)
}
