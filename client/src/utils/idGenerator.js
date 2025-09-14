// ID generation utilities with standards-compliant crypto
import { v4 as uuid } from 'uuid'
import { hash } from 'fast-sha256'

// Convert input to string for hashing
const toString = (input) => {
  if (input instanceof ArrayBuffer) {
    return new TextDecoder().decode(input)
  }
  return String(input)
}

// Generate SHA-256 hash
const sha256Hash = (input) => {
  const str = toString(input)
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashArray = Array.from(hash(data))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Generate short hash (first 8 chars of SHA-256)
const shortHash = (input) => {
  const hashResult = sha256Hash(input)
  return hashResult.substring(0, 8)
}

// Generate UUID (short version)
const genUUID = () => {
  return uuid().replace(/-/g, '').substring(0, 8)
}

// Generate ID: prefix-shortHash(seed)-shortUUID
export const genId = (prefix, seed) => {
  const x = [prefix, seed && shortHash(seed), genUUID()]
  return x.filter(y => y).join('-')
}

// Generate non-volatile ID: prefix-longHash(seed)
export const genNvId = (prefix, seed) => {
  const hash = sha256Hash(seed)
  return `${prefix}-${hash}`
}
