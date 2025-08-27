#!/usr/bin/env node

const { execSync } = require('child_process')
const { existsSync, mkdirSync, readdirSync, copyFileSync, lstatSync, readlinkSync, writeFileSync, unlinkSync } = require('fs')
const path = require('path')
const ecosystemConfig = require('./ecosystem.config.js')
const { ProxyClient } = require('./proxy-client.js')

// args: env sha [repoUrl]
const env = process.argv[2]
const sha = process.argv[3]
const repo = process.argv[4] || process.env.REPO_URL

if (!env || !sha) {
  console.error('❌ Usage: node deploy.js <environment> <commitSha> [repoUrl]')
  console.error('Available environments: staging, production')
  process.exit(1)
}

const app = ecosystemConfig.apps.find(a => a.env.NODE_ENV === env)
if (!app) {
  console.error(`❌ Environment '${env}' not found in ecosystem config`)
  process.exit(1)
}

const { name: appName, env: { DOMAIN: domain, PORT: port } } = app

const ROOT = '/home/ls100'
const ENV_DIR = `${ROOT}/${env}`
const LOGS_DIR = `${ROOT}/logs`
const COLLINS_SRC = path.join(ROOT, 'collins')
const YARN_CACHE = path.join(ROOT, '.yarn-cache')
const BLUE_DIR = path.join(ENV_DIR, 'blue')
const GREEN_DIR = path.join(ENV_DIR, 'green')
const CURRENT = path.join(ENV_DIR, 'current')

const CMD_TIMEOUT = 520000
const run = (cmd) => execSync(cmd, { stdio: 'inherit', timeout: CMD_TIMEOUT })
const out = (cmd) => execSync(cmd, { encoding: 'utf8', timeout: CMD_TIMEOUT }).trim()

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function verifyPm2Online(name, retries = 5, delayMs = 800) {
  for (let i = 0; i < retries; i++) {
    try {
      const d = out(`pm2 describe "${name}"`)
      if (d.includes('online')) return true
    } catch {}
    await sleep(delayMs)
  }
  return false
}

async function rollbackToPrevious(previousDir, currentLink, appName) {
  try {
    if (existsSync(previousDir)) {
      run(`ln -sfn "${previousDir}" "${currentLink}"`)
      run(`pm2 reload "${appName}"`)
      const ok = await verifyPm2Online(appName)
      if (ok) console.log('✅ Rollback successful (pm2 online)')
      else console.error('❌ Rollback failed (pm2 not online)')
    } else {
      console.error('❌ Rollback unavailable (no previous deployment)')
    }
  } catch (rerr) {
    console.error(`❌ Rollback error: ${rerr.message}`)
  }
}

function isSymlink(p) {
  try { return lstatSync(p).isSymbolicLink() } catch { return false }
}

function getActiveColor() {
  if (isSymlink(CURRENT)) {
    try {
      const t = readlinkSync(CURRENT)
      if (t.endsWith('/blue')) return 'blue'
      if (t.endsWith('/green')) return 'green'
    } catch {}
  }
  return 'blue'
}

async function deploy() {
  console.log(`🚀 Deploy ${env} @ ${sha}`)

  mkdirSync(ENV_DIR, { recursive: true })
  mkdirSync(LOGS_DIR, { recursive: true })
  mkdirSync(YARN_CACHE, { recursive: true })

  const active = getActiveColor()
  const next = active === 'blue' ? 'green' : 'blue'
  const nextDir = next === 'blue' ? BLUE_DIR : GREEN_DIR
  const prevDir = active === 'blue' ? BLUE_DIR : GREEN_DIR

  try {
    // ensure clone
    if (!existsSync(nextDir)) {
      if (!repo) {
        console.error('❌ repoUrl required on first deploy of this color')
        process.exit(1)
      }
      console.log(`📥 Cloning ${repo} into ${next}...`)
      run(`git clone ${repo} "${nextDir}"`)
    } else {
      console.log('🔁 Fetching updates...')
      run(`git -C "${nextDir}" fetch --all --prune`)
    }

    console.log(`📦 Checkout ${sha}...`)
    run(`git -C "${nextDir}" reset --hard`)
    run(`git -C "${nextDir}" checkout --force ${sha}`)
    const head = out(`git -C "${nextDir}" rev-parse HEAD`)
    if (head !== sha) {
      console.error(`❌ Head ${head} != ${sha}`)
      process.exit(1)
    }
    // ensure clean workspace before install/build
    run(`git -C "${nextDir}" clean -xdf`)

    console.log('📥 Installing deps...')
    try {
      // verify cache is writable
      const testFile = path.join(YARN_CACHE, '.w')
      writeFileSync(testFile, '1')
      unlinkSync(testFile)
    } catch (e) {
      console.warn(`⚠️ Yarn cache not writable at ${YARN_CACHE}: ${e.message}`)
    }

    try {
      run(`cd "${nextDir}" && YARN_CACHE_FOLDER="${YARN_CACHE}" yarn install --frozen-lockfile`)

      console.log('🏗️ Building client...')
      run(`cd "${nextDir}" && yarn workspace client build`)
    } catch (buildErr) {
      console.error(`❌ Install/build failed: ${buildErr.message}`)
      try {
        run(`git -C "${nextDir}" reset --hard`)
        run(`git -C "${nextDir}" clean -xdf`)
      } catch {}
      throw buildErr
    }

    // collins assets
    try {
      console.log('📚 Sync Collins assets...')
      const dst = path.join(nextDir, 'server', 'lib', 'collins')
      mkdirSync(dst, { recursive: true })
      if (existsSync(COLLINS_SRC)) {
        const files = readdirSync(COLLINS_SRC).filter(f => /\.(mdx|mdd|txt)$/i.test(f))
        files.forEach(f => copyFileSync(path.join(COLLINS_SRC, f), path.join(dst, f)))
      } else {
        console.warn(`⚠️ Collins not found at ${COLLINS_SRC}`)
      }
    } catch (e) {
      console.warn(`⚠️ Collins sync failed: ${e.message}`)
    }

    // env file
    const envSrc = path.join(ENV_DIR, 'secrets', '.env')
    const envDst = path.join(nextDir, 'server', '.env')
    try {
      if (existsSync(envSrc)) copyFileSync(envSrc, envDst)
    } catch (e) {
      console.warn(`⚠️ .env copy failed: ${e.message}`)
    }

    // record revision
    try { writeFileSync(path.join(nextDir, 'REV'), `${sha}\n`) } catch {}

    // switch symlink then pm2 reload; if reload fails, rollback symlink immediately
    console.log('🔄 Switching current...')
    run(`ln -sfn "${nextDir}" "${CURRENT}"`)

    console.log(`♻️ Reload ${appName}...`)
    try {
      run(`pm2 reload "${appName}"`)
    } catch (e) {
      console.error(`❌ pm2 reload failed: ${e.message}`)
      console.log('↩️  Attempting immediate rollback...')
      await rollbackToPrevious(prevDir, CURRENT, appName)
      process.exit(1)
    }

    // proxy
    try {
      const client = new ProxyClient('http://localhost:6000')
      await client.register(domain, port, env)
    } catch (e) {
      console.warn(`⚠️ Proxy register failed: ${e.message}`)
    }

    // verify
    try {
      const ok = await verifyPm2Online(appName)
      if (!ok) throw new Error('pm2 not online')
      console.log(`✅ ${env} deploy ok`)
    } catch (e) {
      console.error(`❌ Verify failed: ${e.message}`)
      console.log('↩️  Rolling back to previous revision...')
      await rollbackToPrevious(prevDir, CURRENT, appName)
      process.exit(1)
    }
  } catch (e) {
    console.error(`❌ Deploy failed: ${e.message}`)
    process.exit(1)
  }
}

deploy().catch(e => {
  console.error(`❌ Deployment failed: ${e.message}`)
  process.exit(1)
})