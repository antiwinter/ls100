import 'fake-indexeddb/auto'

// Minimal DOM globals can be added here if needed

// Fix missing Blob methods for tests
// Node.js Blob sometimes doesn't have all methods in test environments
if (typeof globalThis.Blob !== 'undefined') {
  const OriginalBlob = globalThis.Blob
  
  // Store original parts from constructor
  const getBlobParts = (blob) => {
    // Extract original content from blob constructor
    // This is a hack for test blobs created with new Blob([content])
    return blob[Symbol.for('blob-parts')] || []
  }
  
  // Enhanced Blob constructor that preserves parts for testing
  globalThis.Blob = function(parts = [], options = {}) {
    const blob = new OriginalBlob(parts, options)
    // Store parts for later retrieval in polyfill methods
    blob[Symbol.for('blob-parts')] = parts
    return blob
  }
  globalThis.Blob.prototype = OriginalBlob.prototype
  
  // Polyfill text() method if not available
  if (!OriginalBlob.prototype.text) {
    OriginalBlob.prototype.text = function() {
      const parts = getBlobParts(this)
      if (parts.length > 0) {
        // Convert parts to text
        return Promise.resolve(parts.map(p => 
          typeof p === 'string' ? p : new TextDecoder().decode(p)
        ).join(''))
      }
      return Promise.resolve('')
    }
  }
  
  // Polyfill arrayBuffer() if not available
  if (!OriginalBlob.prototype.arrayBuffer) {
    OriginalBlob.prototype.arrayBuffer = async function() {
      const parts = getBlobParts(this)
      if (parts.length > 0) {
        // Convert parts to ArrayBuffer
        const text = parts.map(p => 
          typeof p === 'string' ? p : new TextDecoder().decode(p)
        ).join('')
        const encoder = new TextEncoder()
        return encoder.encode(text).buffer
      }
      
      // Try stream approach if available
      if (this.stream) {
        const reader = this.stream().getReader()
        const chunks = []
        let done = false
        
        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) chunks.push(value)
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
        const result = new Uint8Array(totalLength)
        let offset = 0
        for (const chunk of chunks) {
          result.set(chunk, offset)
          offset += chunk.length
        }
        return result.buffer
      }
      
      // Fallback: empty buffer
      return new ArrayBuffer(0)
    }
  }
}

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
  } catch {
    // Ignore fetch errors for WASM loading
  }
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



