// ID generation utilities with proper crypto APIs

// Convert input to string for hashing
const toString = (input) => {
  if (input instanceof ArrayBuffer) {
    return new TextDecoder().decode(input)
  }
  return String(input)
}

// Generate proper hash using crypto.subtle
const sha256Hash = async (input) => {
  const str = toString(input)
  const encoder = new TextEncoder()
  const data = encoder.encode(str)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Generate short hash (first 8 chars of SHA-256)
const shortHash = async (input) => {
  const hash = await sha256Hash(input)
  return hash.substring(0, 8)
}

// Generate proper UUID using crypto.randomUUID()
const genUUID = () => {
  if (crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 8) // Short version
  }
  // Fallback for older browsers
  return 'xxxxxxxx'.replace(/[x]/g, () =>
    (Math.random() * 16 | 0).toString(16)
  )
}

// Generate ID: prefix-shortHash(seed)-shortUUID
export const genId = async (prefix, seed) => {
  const hash = await shortHash(seed)
  const uuid = genUUID()
  return `${prefix}-${hash}-${uuid}`
}

// Generate non-volatile ID: prefix-longHash(seed)
export const genNvId = async (prefix, seed) => {
  const hash = await sha256Hash(seed)
  return `${prefix}-${hash}`
}
