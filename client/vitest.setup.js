import 'fake-indexeddb/auto'

// Minimal DOM globals can be added here if needed

// Serve sql.js WASM from local node_modules during tests
import fs from 'fs'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const sqlWasmPath = (() => {
  try { return require.resolve('sql.js/dist/sql-wasm.wasm') } catch { return null }
})()

const originalFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  try {
    const url = typeof input === 'string' ? input : (input?.url || '')
    if (sqlWasmPath && typeof url === 'string' && url.startsWith('https://sql.js.org/dist/')) {
      const bytes = await fs.promises.readFile(sqlWasmPath)
      return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/wasm' } })
    }
  } catch {}
  return originalFetch(input, init)
}

// Patch fs methods to redirect url-like paths used by sql.js under Node
const mapWasmPath = (p) => (sqlWasmPath && typeof p === 'string' && p.startsWith('https://sql.js.org/dist/')) ? sqlWasmPath : p

const _open = fs.open
fs.open = function(path, flags, mode, callback) {
  return _open.call(this, mapWasmPath(path), flags, mode, callback)
}
const _openSync = fs.openSync
fs.openSync = function(path, flags, mode) {
  return _openSync.call(this, mapWasmPath(path), flags, mode)
}
const _readFile = fs.readFile
fs.readFile = function(path, options, callback) {
  return _readFile.call(this, mapWasmPath(path), options, callback)
}
const _readFileSync = fs.readFileSync
fs.readFileSync = function(path, options) {
  return _readFileSync.call(this, mapWasmPath(path), options)
}
const _createReadStream = fs.createReadStream
fs.createReadStream = function(path, options) {
  return _createReadStream.call(this, mapWasmPath(path), options)
}



