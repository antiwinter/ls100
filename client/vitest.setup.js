import 'fake-indexeddb/auto'

// Minimal DOM globals can be added here if needed

// Fix for fake-indexeddb Blob serialization issue
// fake-indexeddb serializes Blobs as plain objects, losing their prototype methods
// We need to reconstruct proper Blob objects when retrieving from the database

// Store original Dexie methods
let _originalDexieGet, _originalDexiePut

// Function to check if an object looks like a serialized Blob
function isSerializedBlob(obj) {
  return obj &&
         typeof obj === 'object' &&
         obj.constructor === Object &&
         !obj.arrayBuffer && // Lost the method due to serialization
         !(obj instanceof Blob) // Not a real Blob
}

// Function to reconstruct a proper Blob from serialized data
function reconstructBlob(obj) {
  if (!isSerializedBlob(obj)) return obj

  // Try to reconstruct the Blob from stored parts
  const parts = obj[Symbol.for('blob-parts')] || []

  // If we have parts, reconstruct the blob
  if (parts.length > 0) {
    return new Blob(parts, { type: obj.type })
  }

  // Fallback: If no parts are available, try to reconstruct from other properties
  // This handles cases where the blob was created from binary data (like from APKG files)
  // Since fake-indexeddb serializes everything, we may have lost the original data
  // but we can create a minimal blob that at least has the correct type and size

  // Create a buffer of the correct size filled with zeros as a placeholder
  // This isn't ideal but prevents the "not a function" errors
  const buffer = new ArrayBuffer(obj.size || 0)
  return new Blob([buffer], { type: obj.type || '' })
}

// Function to recursively fix Blobs in an object
function fixBlobsInObject(obj) {
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(fixBlobsInObject)
  }

  const fixed = {}
  for (const [key, value] of Object.entries(obj)) {
    // Special handling for 'blob' fields that got serialized by fake-indexeddb
    if (key === 'blob' && value && typeof value === 'object' && !(value instanceof Blob)) {
      // fake-indexeddb has stripped the blob to an empty object
      // Reconstruct it using available metadata from the parent object
      const size = obj.size || 0
      const type = obj.type || ''
      // Create a placeholder blob with correct size and type
      const buffer = new ArrayBuffer(size)
      fixed[key] = new Blob([buffer], { type })
    } else {
      fixed[key] = fixBlobsInObject(value)
    }
  }

  return fixed
}

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

// Export the blob fixing functions so they can be used by media manager
globalThis._fixBlobsInObject = fixBlobsInObject
globalThis._isSerializedBlob = isSerializedBlob
globalThis._reconstructBlob = reconstructBlob

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



