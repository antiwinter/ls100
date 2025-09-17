
// Parse template into Abastract Strutural Tree (AST)
// with support for nesting
// Nodes:
// - { type: 'text', value }
// - { type: 'block', name, inverted, children: Node[] }
// - { type: 'token', token } // raw token string inside text
// normalizeFilters is available if needed when promoting tokens later
// import { normalizeFilters } from './filters/index.js'
export function parseTemplate(str) {
  if (!str) return [{ type: 'text', value: '' }]

  const root = { type: 'block', name: '__root__', inverted: false, children: [] }
  const stack = [root]
  let cur = root.children
  let pos = 0

  const re = /\{\{\s*(#|\^|\/)\s*([^}]*)\}\}/g
  let m

  const clozy = new RegExp('\\{\\{c[0-9]+::') // matches "{{cN::"


  const pushText = (s) => {
    if (!s) return
    // split text by inline tokens {{...}}
    let i = 0
    while (i < s.length) {
      const start = s.indexOf('{{', i)
      if (start === -1) {
        cur.push({ type: 'text', value: s.slice(i) })
        break
      }
      if (start > i) cur.push({ type: 'text', value: s.slice(i, start) })
      const end = s.indexOf('}}', start + 2)
      if (end === -1) {
        cur.push({ type: 'text', value: s.slice(start) })
        break
      }
      const raw = s.slice(start + 2, end).trim()
      cur.push({ type: 'token', token: raw })
      i = end + 2
    }
  }

  while ((m = re.exec(str)) !== null) {
    const idx = m.index
    pushText(str.slice(pos, idx))
    pos = idx + m[0].length

    const sig = m[1]
    const name = (m[2] || '').trim()

    if (sig === '#' || sig === '^') {
      const node = {
        type: 'block',
        name,
        isCloze: !!clozy.test(name),
        inverted: sig === '^',
        children: []
      }
      cur.push(node)
      stack.push(node)
      cur = node.children
      continue
    }

    if (sig === '/') {
      // Close block
      const top = stack.pop()
      if (!top || top.name !== name) {
        // Malformed; bail out and return raw text as single node
        return [{ type: 'text', value: str }]
      }
      const parent = stack[stack.length - 1]
      cur = parent.children
      continue
    }
  }

  // Trailing text
  pushText(str.slice(pos))

  // Unbalanced blocks -> fallback to raw
  if (stack.length !== 1) return [{ type: 'text', value: str }]

  return root.children
}
