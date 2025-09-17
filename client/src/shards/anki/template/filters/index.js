// Simple filter registry. Keep it minimal for now.

export const Filters = new Map()

export function registerFilter(name, fn) {
  if (!name || typeof fn !== 'function') return
  Filters.set(name, fn)
}

// Built-ins: identity only (others to be added later)
registerFilter('text', (v) => v)

// Convert kanji[reading] sequences into ruby HTML
registerFilter('furigana', (v) => {
  if (!v) return ''
  return String(v).replace(/([^\]\s[]+)\[([^]]+)\]/g, (_m, kanji, reading) => {
    return `<ruby>${kanji}<rt>${reading}</rt></ruby>`
  })
})

// Strip bracketed readings to plain kana text (kanji[reading] -> reading)
registerFilter('kana', (v) => {
  if (!v) return ''
  return String(v).replace(/([^\]\s[]+)\[([^]]+)\]/g, (_m, _kanji, reading) => reading)
})

// Placeholders for future implementation
registerFilter('tts', (v) => v)


