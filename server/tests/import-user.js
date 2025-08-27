import { migrator, db } from '../utils/dbc/index.js'
import * as userModel from '../modules/auth/data.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log('🔄 Importing users from users.json to SQLite...\n')

try {
  // Initialize database
  console.log('1. Initializing database...')
  await migrator.migrate()
  console.log('✅ Module-based migrations completed\n')

  // Read users.json
  const usersJsonPath = path.join(__dirname, '../data/users.json')
  console.log('2. Reading users.json...')
  
  let usersData
  try {
    const fileContent = await fs.readFile(usersJsonPath, 'utf8')
    usersData = JSON.parse(fileContent)
    console.log(`✅ Found ${usersData.length} users in JSON file\n`)
  } catch (error) {
    console.log('❌ users.json not found or empty, skipping import')
    process.exit(0)
  }

  // Import each user
  console.log('3. Importing users...')
  let imported = 0
  let skipped = 0

  for (const user of usersData) {
    try {
      // Check if user already exists
      const existing = userModel.findByEmail(user.email)
      if (existing) {
        console.log(`⚠️  User ${user.email} already exists, skipping`)
        skipped++
        continue
      }

      // Map JSON structure to SQLite structure
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        password_hash: user.password, // JSON uses 'password', SQLite uses 'password_hash'
        created_at: user.createdAt    // JSON uses 'createdAt', SQLite uses 'created_at'
      }

      // Insert directly using prepared statement (password already hashed)
      db.prepare(`
        INSERT INTO users VALUES (?, ?, ?, ?, ?)
      `).run(userData.id, userData.email, userData.name, userData.password_hash, userData.created_at)

      console.log(`✅ Imported user: ${user.email}`)
      imported++
    } catch (error) {
      console.log(`❌ Failed to import user ${user.email}: ${error.message}`)
    }
  }

  console.log('\n📊 Import Summary:')
  console.log(`✅ Imported: ${imported} users`)
  console.log(`⚠️  Skipped: ${skipped} users`)
  console.log(`📁 Total in database: ${userModel.findAll().length} users`)

  // Verify import
  console.log('\n4. Verifying imported data...')
  const allUsers = userModel.findAll()
  allUsers.forEach(user => {
    console.log(`👤 ${user.email} (ID: ${user.id}, Created: ${user.created_at})`)
  })

  console.log('\n🎉 User import completed successfully!')

} catch (error) {
  console.error('💥 Import failed:', error)
  process.exit(1)
} 