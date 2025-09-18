
// Parse template into Abastract Strutural Tree (AST)
// with support for nesting
//

//
// Key Features Covered:
// Nested blocks: {{#Front}} containing {{#Extra}}
// Inverted blocks: {{^Front}}
// Field tokens: {{Front}}
// Filtered tokens: {{hint:Extra}}, {{cloze:Text}}
// Cloze conditionals: {{#c1}} (marked with isCloze: true)
// Mixed content: HTML, text, comments, whitespace
// Complex nesting: Multiple levels of conditions
// During Evaluation:
// Blocks check field presence/cloze existence → include/exclude children
// Tokens get field values and apply filters
// Text nodes pass through unchanged
// Result: flattened string ready for display

// import { log } from '../../../utils/logger.js'
const _ast = {
  type: 'block', // block, text, field
  name: 'Front', // block, field name
  cloze: 1,
  inv: 1,
  sub : []
}

export function parseTemplate(str) {
  if (!str) return [{ type: 'text', value: '' }]

  const stack = [{ sub:[] }]

  let pos = 0
  let m = null
  let re = /\{\{\s*([^}]*)\}\}/g
  let _collect = p1 => {
    let text = str.slice(pos, p1)?.replace(/\r|\n/g, '').trim()
    // log.warn('collect', text)
    if (text) stack[0].sub.push({ type: 'text', text })
  }

  for (;
    (m = re.exec(str)) !== null;
    pos = m.index + m[0].length) {
    // log.warn('match', m.index, m[1])
    _collect(m.index)
    let sig = m[1].slice(0,1)
    let _n = {
      type: 'block',
      inv: sig === '^',
      name: m[1].slice(1),
      sub: []
    }
    switch (sig) {
    case '^':
    case '#':
      stack[0]?.sub.push(_n)
      stack.unshift(_n)
      break
    case '/':
      stack.shift()
      break
    default:
      sig = ''
    }

    if (!sig) {
      if (m[1].includes('::')) {
        throw ('invalid cloze desc in template:', m[1], str)
        // continue
      }
      const filters = m[1].split(':')
      stack[0]?.sub.push({
        type: 'field',
        name:filters.pop(),
        filters
      })
    }
  }

  // Trailing text
  _collect()

  return stack[stack.length - 1]?.sub
}
