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
registerFilter('cloze', (v, ctx) => {
  if (!v) return ''
  const side = ctx?.side || 'front'
  const str = String(v)
  // Replace Anki cloze deletions: {{cN::text}} or {{cN::text::hint}}
  // Minimal implementation: hide on front, reveal on back
  return str.replace(/\{\{c(\d+)::([^:}]+?)(?::([^}]*))?\}\}/g, (_m, _n, text, hint) => {
    if (side === 'back') {
      return `<span class="cloze-answer">${text}</span>`
    }
    const label = (hint && String(hint).trim()) ? hint : '...'
    return `<span class="cloze-deletion">${label}</span>`
  })
})


