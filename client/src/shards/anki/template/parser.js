// Minimal Anki template parser with support for:
// - {{Field}}, {{FrontSide}}
// - {{filter:Field}} and simple filter chains {{a:b:Field}}
// - Conditional presence check during preflight (handled elsewhere)

// Parse tokens from a template string
// Returns an array of parts: { type: 'text'|'token', value?, token? }
export function parseTemplate(str) {
  if (!str) return []
  const parts = []
  let i = 0

  while (i < str.length) {
    const start = str.indexOf('{{', i)
    if (start === -1) {
      parts.push({ type: 'text', value: str.slice(i) })
      break
    }
    if (start > i) parts.push({ type: 'text', value: str.slice(i, start) })

    const end = str.indexOf('}}', start + 2)
    if (end === -1) {
      parts.push({ type: 'text', value: str.slice(start) })
      break
    }

    const raw = str.slice(start + 2, end).trim()
    parts.push({ type: 'token', token: raw })
    i = end + 2
  }

  return parts
}

// Extract token info
// token may be 'FrontSide', 'Field', or 'filter:Field' (chain supported)
export function parseToken(token) {
  const name = token.trim()
  if (name === 'FrontSide') return { kind: 'front' }

  const segs = name.split(':')
  if (segs.length === 1) return { kind: 'field', field: segs[0] }

  const field = segs[segs.length - 1]
  const filters = segs.slice(0, -1)
  return { kind: 'filtered', field, filters }
}


