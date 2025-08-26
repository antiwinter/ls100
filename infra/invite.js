#!/usr/bin/env node
/*
  invite.js — Simple CLI tool to manage invite codes
*/

import { runMigrations, db } from '../server/utils/dbc.js'
import * as userModel from '../server/modules/auth/data.js'
import { Command } from 'commander'

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

function formatTable(codes) {
  if (codes.length === 0) {
    console.log('No invite codes found')
    return
  }
  
  console.log('CODE     │ STATUS  │ USES  │ CREATOR    │ CREATED')
  console.log('─────────┼─────────┼───────┼────────────┼──────────────────')
  
  codes.forEach(code => {
    const status = code.current_uses >= code.max_uses ? 'USED' : 
                  code.expires_at && new Date(code.expires_at) < new Date() ? 'EXPIRED' : 
                  'ACTIVE'
    const uses = `${code.current_uses}/${code.max_uses}`
    const creator = code.creator_name || 'unknown'
    const created = new Date(code.created_at).toLocaleDateString()
    
    console.log(`${code.code} │ ${status.padEnd(7)} │ ${uses.padEnd(5)} │ ${creator.padEnd(10)} │ ${created}`)
  })
}

async function generateCodes(count = 1, options = {}) {
  console.log('🔧 Initializing database...')
  runMigrations()
  
  // Use a default admin user ID - you can change this
  const adminUserId = '1753068359234' // antiwinter's ID for now
  
  console.log(`🎫 Generating ${count} invite code(s)...`)
  
  const generated = []
  for (let i = 0; i < count; i++) {
    const inviteCode = userModel.createInviteCode(adminUserId, {
      maxUses: options.maxUses || 1,
      expiresAt: options.expires || null
    })
    generated.push(inviteCode)
  }
  
  console.log('\n✅ Generated codes:')
  generated.forEach(code => {
    console.log(`   ${code.code} (max uses: ${code.max_uses})`)
  })
  
  return generated
}

async function listCodes(options = {}) {
  console.log('🔧 Initializing database...')
  runMigrations()
  
  const codes = db.prepare(`
    SELECT ic.*, u.name as creator_name
    FROM invite_codes ic
    LEFT JOIN users u ON ic.created_by = u.id
    ORDER BY ic.created_at DESC
    LIMIT 50
  `).all()
  
  console.log(`\n📋 Found ${codes.length} invite codes:\n`)
  formatTable(codes)
}

async function revokeCodes(codeList) {
  if (!codeList || codeList.length === 0) {
    fail('No codes specified to revoke')
  }
  
  console.log('🔧 Initializing database...')
  runMigrations()
  
  console.log(`🗑️  Revoking ${codeList.length} code(s)...`)
  
  let revokedCount = 0
  for (const code of codeList) {
    const result = db.prepare('DELETE FROM invite_codes WHERE code = ?').run(code)
    if (result.changes > 0) {
      console.log(`   ✅ Revoked: ${code}`)
      revokedCount++
    } else {
      console.log(`   ❌ Not found: ${code}`)
    }
  }
  
  console.log(`\n🎉 Revoked ${revokedCount}/${codeList.length} codes`)
}

function main() {
  const program = new Command()
  
  program
    .name('invite')
    .description('Simple CLI tool to manage invite codes')
    .version('1.0.0')

  // Generate command
  program
    .command('gen')
    .description('Generate new invite codes')
    .argument('[count]', 'Number of codes to generate', '1')
    .option('--max-uses <number>', 'Maximum uses per code', '1')
    .option('--expires <date>', 'Expiration date (YYYY-MM-DD)')
    .action(async (count, options) => {
      try {
        const numCount = parseInt(count, 10)
        if (isNaN(numCount) || numCount < 1) {
          fail('Count must be a positive number')
        }
        
        const genOptions = {
          maxUses: parseInt(options.maxUses, 10)
        }
        
        if (options.expires) {
          genOptions.expires = new Date(options.expires).toISOString()
        }
        
        await generateCodes(numCount, genOptions)
      } catch (error) {
        fail(`Error generating codes: ${error.message}`)
      }
    })

  // List command  
  program
    .command('list')
    .description('List existing invite codes')
    .action(async () => {
      try {
        await listCodes()
      } catch (error) {
        fail(`Error listing codes: ${error.message}`)
      }
    })

  // Revoke command
  program
    .command('revoke')
    .description('Revoke invite codes')
    .argument('<codes...>', 'Codes to revoke')
    .action(async (codes) => {
      try {
        await revokeCodes(codes)
      } catch (error) {
        fail(`Error revoking codes: ${error.message}`)
      }
    })

  program.parse()
}

main()
