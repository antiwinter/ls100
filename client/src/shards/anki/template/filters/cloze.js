// registerFilter('cloze', (v, ctx) => {
//     if (!v) return ''
//     const side = ctx?.side || 'front'
//     const str = String(v)
//     // Replace Anki cloze deletions: {{cN::text}} or {{cN::text::hint}}
//     // Minimal implementation: hide on front, reveal on back
//     return str.replace(/\{\{c(\d+)::([^:}]+?)(?::([^}]*))?\}\}/g, (_m, _n, text, hint) => {
//       if (side === 'back') {
//         return `<span class="cloze-answer">${text}</span>`
//       }
//       const label = (hint && String(hint).trim()) ? hint : '...'
//       return `<span class="cloze-deletion">${label}</span>`
//     })
//   })

// TODO: cloze are special filers, should be managed separately
