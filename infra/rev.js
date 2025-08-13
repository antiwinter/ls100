#!/usr/bin/env node
/*
  rev.js — bump client/server versions based on git diff, commit, optionally tag, and push.
  Usage:
    yarn rev                      # auto-detect changed packages; bump MINOR by default
    yarn rev major                # force MAJOR bump for all changed packages
    yarn rev --base <sha-or-ref>  # diff base..HEAD to detect changes (default HEAD~1)
    yarn rev --tag                # create a repo tag summarizing bumped versions and push
    yarn rev --dry-run            # write package.json changes only, no git add/commit/push/tag
*/

import { execSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', ...opts }).trim()
}

function runOk(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts })
  if (res.status !== 0) {
    process.exit(res.status || 1)
  }
}

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

function bumpSemver(version, kind) {
  const m = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-.*)?$/)
  if (!m) fail(`Unsupported version format: ${version}`)
  let [major, minor, patch] = m.slice(1).map((n) => parseInt(n, 10))
  if (kind === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (kind === 'minor') {
    minor += 1
    patch = 0
  } else if (kind === 'patch') {
    patch += 1
  } else {
    fail(`Unknown bump kind: ${kind}`)
  }
  return `${major}.${minor}.${patch}`
}

function parseArgs(argv) {
  const args = { kind: 'minor', base: null, tag: false, dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === 'major' || a === 'minor') {
      args.kind = a
    } else if (a === '--base') {
      args.base = argv[++i] || null
    } else if (a === '--tag') {
      args.tag = true
    } else if (a === '--dry-run' || a === '-n') {
      args.dryRun = true
    } else {
      fail(`Unknown argument: ${a}`)
    }
  }
  return args
}

function ensureCleanAndUpToDate() {
  const status = run('git status --porcelain')
  if (status) fail('Working tree not clean. Commit or stash changes first.')
  run('git fetch origin')
  const branch = run('git rev-parse --abbrev-ref HEAD')
  const counts = run(`git rev-list --left-right --count origin/${branch}...HEAD`).split(/\s+/)
  const behind = parseInt(counts[0] || '0', 10)
  const ahead = parseInt(counts[1] || '0', 10)
  if (behind !== 0) fail(`Local branch is behind origin/${branch} by ${behind} commit(s). Pull first.`)
  if (ahead !== 0) fail(`Local branch is ahead of origin/${branch} by ${ahead} commit(s). Push or reset first.`)
}

function main() {
  const { kind, base, tag, dryRun } = parseArgs(process.argv.slice(2))

  ensureCleanAndUpToDate()

  const baseRef = base || 'HEAD~1'
  let changedFiles = ''
  try {
    changedFiles = run(`git diff --name-only ${baseRef}..HEAD`)
  } catch (_) {
    // ignore
  }

  const changed = new Set(
    changedFiles
      .split(/\r?\n/)
      .filter(Boolean)
  )

  const touchedClient = Array.from(changed).some((p) => p.startsWith('client/'))
  const touchedServer = Array.from(changed).some((p) => p.startsWith('server/'))

  if (!touchedClient && !touchedServer) {
    console.log('No changes in client/ or server/ since', baseRef, '- nothing to bump.')
    process.exit(0)
  }

  const updates = []
  const results = {}

  if (touchedClient) {
    const clientPkgPath = resolve(process.cwd(), 'client', 'package.json')
    const clientPkg = JSON.parse(readFileSync(clientPkgPath, 'utf8'))
    const current = clientPkg.version
    const next = bumpSemver(current, kind)
    clientPkg.version = next
    writeFileSync(clientPkgPath, JSON.stringify(clientPkg, null, 2) + '\n', 'utf8')
    updates.push(clientPkgPath)
    results.client = { current, next }
  }

  if (touchedServer) {
    const serverPkgPath = resolve(process.cwd(), 'server', 'package.json')
    const serverPkg = JSON.parse(readFileSync(serverPkgPath, 'utf8'))
    const current = serverPkg.version
    const next = bumpSemver(current, kind)
    serverPkg.version = next
    writeFileSync(serverPkgPath, JSON.stringify(serverPkg, null, 2) + '\n', 'utf8')
    updates.push(serverPkgPath)
    results.server = { current, next }
  }

  if (updates.length === 0) {
    console.log('No package.json updated.')
    process.exit(0)
  }

  // Show stat for visibility
  try {
    const stat = run(`git diff --stat ${baseRef}..HEAD`)
    if (stat) {
      console.log('Changed files since', baseRef)
      console.log(stat)
    }
  } catch (_) {}

  if (dryRun) {
    console.log('[dry-run] wrote package.json updates; skipping git add/commit/push/tag')
  } else {
    runOk('git', ['add', ...updates])
    const parts = []
    if (results.client) parts.push(`client to ${results.client.next}`)
    if (results.server) parts.push(`server to ${results.server.next}`)
    runOk('git', ['commit', '-m', `chore(rev): bump ${parts.join('; ')}`])
    runOk('git', ['push'])

    if (tag) {
      const tagName = `rev@${results.client ? 'c' + results.client.next : ''}${results.client && results.server ? '-' : ''}${results.server ? 's' + results.server.next : ''}`
      runOk('git', ['tag', tagName])
      runOk('git', ['push', 'origin', tagName])
    }
  }

  if (results.client) console.log(`client: ${results.client.current} -> ${results.client.next}`)
  if (results.server) console.log(`server: ${results.server.current} -> ${results.server.next}`)
}

main()


