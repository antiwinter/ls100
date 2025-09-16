// Simple filter registry. Keep it minimal for now.

const REG = new Map()

export function registerFilter(name, fn) {
  if (!name || typeof fn !== 'function') return
  REG.set(name, fn)
}

export function applyFilters(fieldName, filters, ctx) {
  const { fieldNames, noteFields } = ctx || {}
  const i = Array.isArray(fieldNames) ? fieldNames.findIndex(n => (n?.toLowerCase?.() || n) === (fieldName || '').toLowerCase()) : -1
  const value = i !== -1 ? (noteFields?.[i] || '') : ''
  if (!filters || filters.length === 0) return value
  let v = value
  for (const f of filters) {
    const fn = REG.get(f)
    if (fn) v = fn(v, ctx)
  }
  return v
}

// Built-ins: identity only (others to be added later)
registerFilter('text', (v) => v)

// Convert kanji[reading] sequences into ruby HTML
registerFilter('furigana', (v) => {
  if (!v) return ''
  return String(v).replace(/([^\[\]\s]+)\[([^\]]+)\]/g, (_m, kanji, reading) => {
    return `<ruby>${kanji}<rt>${reading}</rt></ruby>`
  })
})

// Strip bracketed readings to plain kana text (kanji[reading] -> reading)
registerFilter('kana', (v) => {
  if (!v) return ''
  return String(v).replace(/([^\[\]\s]+)\[([^\]]+)\]/g, (_m, _kanji, reading) => reading)
})

// Placeholders for future implementation
registerFilter('tts', (v) => v)
registerFilter('cloze', (v) => v)


