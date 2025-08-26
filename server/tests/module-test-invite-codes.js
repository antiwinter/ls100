import { runMigrations, db } from '../utils/dbc.js'
import * as userModel from '../modules/auth/data.js'

console.log('🧪 Testing Invite Code Module...\n')

let testUser1, testUser2

try {
  // Test 1: Database initialization
  console.log('1. Testing database initialization...')
  runMigrations()
  console.log('✅ Module-based migrations completed')

  // Clear tables for clean test (order matters due to foreign keys)
  // Temporarily disable foreign key constraints for cleanup
  db.pragma('foreign_keys = OFF')
  db.prepare('DELETE FROM invite_codes').run()
  db.prepare('DELETE FROM users').run()
  db.pragma('foreign_keys = ON')
  console.log('✅ Tables cleared for testing\n')

  // Test 2: Create test users
  console.log('2. Creating test users...')
  testUser1 = await userModel.create({
    email: 'creator@example.com',
    password: 'password123',
    name: 'Code Creator'
  })

  testUser2 = await userModel.create({
    email: 'inviter@example.com',
    password: 'password123',
    name: 'Inviter User'
  })
  
  console.log('✅ Test users created')
  console.log(`   Creator: ${testUser1.name} (${testUser1.id})`)
  console.log(`   Inviter: ${testUser2.name} (${testUser2.id})\n`)

  // Test 3: Generate invite code
  console.log('3. Testing invite code generation...')
  const inviteCode1 = userModel.createInviteCode(testUser1.id)
  
  if (inviteCode1 && inviteCode1.code && inviteCode1.code.length === 8) {
    console.log('✅ Invite code generated successfully')
    console.log(`   Code: ${inviteCode1.code}`)
    console.log(`   Created by: ${inviteCode1.created_by}`)
    console.log(`   Max uses: ${inviteCode1.max_uses}`)
    console.log(`   Current uses: ${inviteCode1.current_uses}`)
  } else {
    throw new Error('Invite code generation failed')
  }

  // Test 4: Generate invite code with options
  console.log('\n4. Testing invite code with custom options...')
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 7) // 7 days from now
  
  const inviteCode2 = userModel.createInviteCode(testUser2.id, {
    maxUses: 3,
    expiresAt: futureDate.toISOString()
  })
  
  if (inviteCode2 && inviteCode2.max_uses === 3 && inviteCode2.expires_at) {
    console.log('✅ Custom invite code generated successfully')
    console.log(`   Code: ${inviteCode2.code}`)
    console.log(`   Max uses: ${inviteCode2.max_uses}`)
    console.log(`   Expires at: ${inviteCode2.expires_at}`)
  } else {
    throw new Error('Custom invite code generation failed')
  }

  // Test 5: Find invite code by code
  console.log('\n5. Testing findInviteByCode...')
  const foundCode = userModel.findInviteByCode(inviteCode1.code)
  
  if (foundCode && foundCode.code === inviteCode1.code) {
    console.log('✅ Invite code found successfully')
    console.log(`   Found code: ${foundCode.code}`)
    console.log(`   Created by: ${foundCode.created_by}`)
  } else {
    throw new Error('Invite code not found')
  }

  // Test 6: Validate unused invite code
  console.log('\n6. Testing invite code validation (unused)...')
  const validation1 = userModel.validateInviteCode(inviteCode1.code)
  
  if (validation1.valid === true && validation1.invite) {
    console.log('✅ Unused invite code validation passed')
    console.log(`   Valid: ${validation1.valid}`)
    console.log(`   Code: ${validation1.invite.code}`)
  } else {
    throw new Error('Unused invite code validation failed')
  }

  // Test 7: Validate non-existent invite code
  console.log('\n7. Testing validation of non-existent code...')
  const validation2 = userModel.validateInviteCode('INVALID1')
  
  if (validation2.valid === false && validation2.reason === 'Code not found') {
    console.log('✅ Non-existent code validation passed')
    console.log(`   Valid: ${validation2.valid}`)
    console.log(`   Reason: ${validation2.reason}`)
  } else {
    throw new Error('Non-existent code validation failed')
  }

  // Test 8: Use invite code
  console.log('\n8. Testing invite code usage...')
  const newUser = await userModel.create({
    email: 'newuser@example.com',
    password: 'password123',
    name: 'New User'
  })

  const usedCode = userModel.useInviteCode(inviteCode1.code, newUser.id)
  
  if (usedCode && usedCode.used_by === newUser.id && usedCode.current_uses === 1) {
    console.log('✅ Invite code used successfully')
    console.log(`   Used by: ${usedCode.used_by}`)
    console.log(`   Used at: ${usedCode.used_at}`)
    console.log(`   Current uses: ${usedCode.current_uses}`)
  } else {
    throw new Error('Invite code usage failed')
  }

  // Test 9: Validate used invite code (single use)
  console.log('\n9. Testing validation of used code (single use)...')
  const validation3 = userModel.validateInviteCode(inviteCode1.code)
  
  if (validation3.valid === false && validation3.reason === 'Code already used') {
    console.log('✅ Used code validation passed')
    console.log(`   Valid: ${validation3.valid}`)
    console.log(`   Reason: ${validation3.reason}`)
  } else {
    throw new Error('Used code validation failed')
  }

  // Test 10: Use multi-use invite code
  console.log('\n10. Testing multi-use invite code...')
  const newUser2 = await userModel.create({
    email: 'newuser2@example.com',
    password: 'password123',
    name: 'New User 2'
  })

  const usedCode2 = userModel.useInviteCode(inviteCode2.code, newUser2.id)
  
  if (usedCode2 && usedCode2.current_uses === 1) {
    console.log('✅ Multi-use code first usage successful')
    console.log(`   Current uses: ${usedCode2.current_uses}`)
    console.log(`   Max uses: ${usedCode2.max_uses}`)
  } else {
    throw new Error('Multi-use code first usage failed')
  }

  // Test 11: Use multi-use code again
  console.log('\n11. Testing multi-use code second usage...')
  const newUser3 = await userModel.create({
    email: 'newuser3@example.com',
    password: 'password123',
    name: 'New User 3'
  })

  const usedCode3 = userModel.useInviteCode(inviteCode2.code, newUser3.id)
  
  if (usedCode3 && usedCode3.current_uses === 2) {
    console.log('✅ Multi-use code second usage successful')
    console.log(`   Current uses: ${usedCode3.current_uses}`)
    console.log(`   Max uses: ${usedCode3.max_uses}`)
  } else {
    throw new Error('Multi-use code second usage failed')
  }

  // Test 12: Validate multi-use code (still valid)
  console.log('\n12. Testing validation of partially used multi-use code...')
  const validation4 = userModel.validateInviteCode(inviteCode2.code)
  
  if (validation4.valid === true) {
    console.log('✅ Partially used multi-use code validation passed')
    console.log(`   Valid: ${validation4.valid}`)
    console.log(`   Remaining uses: ${validation4.invite.max_uses - validation4.invite.current_uses}`)
  } else {
    throw new Error('Partially used multi-use code validation failed')
  }

  // Test 13: Create expired invite code
  console.log('\n13. Testing expired invite code...')
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 1) // Yesterday
  
  const expiredCode = userModel.createInviteCode(testUser1.id, {
    expiresAt: pastDate.toISOString()
  })

  const validation5 = userModel.validateInviteCode(expiredCode.code)
  
  if (validation5.valid === false && validation5.reason === 'Code expired') {
    console.log('✅ Expired code validation passed')
    console.log(`   Valid: ${validation5.valid}`)
    console.log(`   Reason: ${validation5.reason}`)
  } else {
    throw new Error('Expired code validation failed')
  }

  // Test 14: Try to use expired code
  console.log('\n14. Testing usage of expired code...')
  try {
    userModel.useInviteCode(expiredCode.code, newUser.id)
    throw new Error('Should have failed with expired code')
  } catch (error) {
    if (error.message === 'Code expired') {
      console.log('✅ Expired code usage correctly rejected')
      console.log(`   Error: ${error.message}`)
    } else {
      throw error
    }
  }

  // Test 15: Get invite codes by user
  console.log('\n15. Testing getInviteCodesByUser...')
  const user1Codes = userModel.getInviteCodesByUser(testUser1.id)
  
  if (user1Codes && user1Codes.length >= 2) {
    console.log('✅ User invite codes retrieved successfully')
    console.log(`   Total codes for user1: ${user1Codes.length}`)
    user1Codes.forEach((code, index) => {
      console.log(`   Code ${index + 1}: ${code.code} (uses: ${code.current_uses}/${code.max_uses})`)
    })
  } else {
    throw new Error('Failed to get user invite codes')
  }

  // Test 16: Get invite code stats
  console.log('\n16. Testing getInviteCodeStats...')
  const stats1 = userModel.getInviteCodeStats(testUser1.id)
  const stats2 = userModel.getInviteCodeStats(testUser2.id)
  
  if (stats1 && stats1.totalCodes >= 2) {
    console.log('✅ Invite code stats retrieved successfully')
    console.log(`   User1 stats: ${JSON.stringify(stats1)}`)
    console.log(`   User2 stats: ${JSON.stringify(stats2)}`)
  } else {
    throw new Error('Failed to get invite code stats')
  }

  // Test 17: Registration with invite code (integration test)
  console.log('\n17. Testing registration with invite code...')
  
  // Create a fresh invite code for registration test
  const regInviteCode = userModel.createInviteCode(testUser1.id)
  
  // Validate code before registration
  const regValidation = userModel.validateInviteCode(regInviteCode.code)
  if (!regValidation.valid) {
    throw new Error('Registration invite code validation failed')
  }

  // Create user (simulating registration)
  const regUser = await userModel.create({
    email: 'registered@example.com',
    password: 'password123',
    name: 'Registered User'
  })

  // Use the code during registration
  const regUsage = userModel.useInviteCode(regInviteCode.code, regUser.id)
  
  if (regUsage && regUsage.used_by === regUser.id) {
    console.log('✅ Registration with invite code successful')
    console.log(`   User: ${regUser.name} (${regUser.email})`)
    console.log(`   Used code: ${regUsage.code}`)
    console.log(`   Code creator: ${regUsage.created_by}`)
  } else {
    throw new Error('Registration with invite code failed')
  }

  console.log('\n🎉 All invite code tests passed!')

} catch (error) {
  console.error('💥 Invite code test failed:', error)
  process.exit(1)
}
