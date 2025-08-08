#!/usr/bin/env node

const { execSync } = require('child_process')
const { existsSync, mkdirSync } = require('fs')
const path = require('path')
const ecosystemConfig = require('./ecosystem.config.js')
const { ProxyClient } = require('./proxy-client.js')

// __dirname is available in CommonJS

// Get environment from command line
const environment = process.argv[2]
if (!environment) {
  console.error('❌ Usage: node deploy.js <environment>')
  console.error('Available environments: staging, production')
  process.exit(1)
}

// Find app config from ecosystem
const app = ecosystemConfig.apps.find(a => a.env.NODE_ENV === environment)
if (!app) {
  console.error(`❌ Environment '${environment}' not found in ecosystem config`)
  console.error('Available environments: staging, production')
  process.exit(1)
}

// Extract config values
const { name: appName, env: { DOMAIN: domain, PORT: port } } = app
const envName = environment

// Set deployment-specific values
const config = {
  backupRetention: environment === 'production' ? 5 : 3,
  verifyDelay: environment === 'production' ? 5 : 3
}

// Set up paths
const ROOT = '/home/ls100'
const ENV_DIR = `${ROOT}/${envName}`
const BACKUP_DIR = `${ROOT}/backups/${envName}`
const LOGS_DIR = `${ROOT}/logs`
const COLLINS_SRC = path.join(ROOT, 'collins')

async function deploy() {
  console.log(`🚀 Deploying LS100 ${envName}...`)
  console.log(`📋 Config: ${appName} → ${domain}:${port}`)

  try {
    // Create directories
    mkdirSync(ENV_DIR, { recursive: true })
    mkdirSync(BACKUP_DIR, { recursive: true })
    mkdirSync(LOGS_DIR, { recursive: true })

    // Backup current deployment
    if (existsSync(`${ENV_DIR}/current`)) {
      console.log('📦 Creating backup...')
      const backupName = `${envName}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
      execSync(`cp -r "${ENV_DIR}/current" "${BACKUP_DIR}/${backupName}"`)
      
      // Keep only specified number of backups
      const retentionPlusOne = config.backupRetention + 1
      execSync(`cd "${BACKUP_DIR}" && ls -t | tail -n +${retentionPlusOne} | xargs rm -rf`)
    }

    // Extract new deployment
    console.log('📂 Extracting deployment...')
    execSync(`rm -rf "${ENV_DIR}/staging"`)
    mkdirSync(`${ENV_DIR}/staging`, { recursive: true })
    execSync(`tar -xzf /tmp/ls100-deploy/deployment.tar.gz -C "${ENV_DIR}/staging"`)

    // Copy infra directory to correct location
    console.log('📁 Setting up infra directory...')
    execSync(`rm -rf "${ROOT}/infra"`)
    execSync(`cp -r /tmp/ls100-deploy/infra "${ROOT}/"`)

    // Sync Collins dictionary assets from shared location (~/collins)
    try {
      console.log('📚 Syncing Collins dictionary assets...')
      const COLLINS_DST = path.join(ENV_DIR, 'staging', 'server', 'lib', 'collins')
      mkdirSync(COLLINS_DST, { recursive: true })
      if (existsSync(COLLINS_SRC)) {
        // Copy .mdx/.mdd if present; ignore if none
        execSync(`find "${COLLINS_SRC}" -maxdepth 1 -type f \\\(
          -name '*.mdx' -o -name '*.mdd' \\\) -exec cp -f {} "${COLLINS_DST}/" \\;`)
      } else {
        console.warn(`⚠️ Collins source not found at ${COLLINS_SRC}`)
      }
    } catch (e) {
      console.warn(`⚠️ Failed to sync Collins dictionaries: ${e.message}`)
    }

    // Install dependencies
    console.log('📥 Installing dependencies...')
    execSync(`cd "${ENV_DIR}/staging" && yarn install --production --frozen-lockfile`)

    // Switch to new deployment
    console.log('🔄 Switching deployment...')
    execSync(`rm -rf "${ENV_DIR}/previous"`)
    if (existsSync(`${ENV_DIR}/current`)) {
      execSync(`mv "${ENV_DIR}/current" "${ENV_DIR}/previous"`)
    }
    execSync(`mv "${ENV_DIR}/staging" "${ENV_DIR}/current"`)

    // Restart app with PM2
    console.log(`🔄 Restarting ${appName}...`)
    try {
      execSync(`pm2 reload "${appName}"`)
    } catch {
      execSync(`pm2 start "${ENV_DIR}/current/infra/deploy/ecosystem.config.js" --only "${appName}"`)
    }

    // Register with proxy
    console.log('🌐 Registering with proxy...')
    try {
      const client = new ProxyClient('http://localhost:6000')
      await client.register(domain, port, environment)
      console.log(`✅ Registered ${domain}:${port} with proxy`)
    } catch (error) {
      console.warn(`⚠️ Proxy registration failed: ${error.message}`)
    }

    // Verify deployment
    await new Promise(resolve => setTimeout(resolve, config.verifyDelay * 1000))
    
    try {
      const result = execSync(`pm2 describe "${appName}"`, { encoding: 'utf8' })
      if (result.includes('online')) {
        console.log(`✅ ${envName} deployment successful!`)
      } else {
        throw new Error('App not online')
      }
    } catch {
      console.error(`❌ ${envName} deployment failed!`)
      process.exit(1)
    }

  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`)
    process.exit(1)
  }
}

// Run the deployment
deploy().catch(error => {
  console.error(`❌ Deployment failed: ${error.message}`)
  process.exit(1)
})