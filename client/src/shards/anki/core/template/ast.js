
// Parse template into Abastract Strutural Tree (AST)
// with support for nesting
//
// {{#Front}}
//   <div class="question">{{Front}}</div>
//   {{#Extra}}
//     <p>{{hint:Extra}}</p>
//   {{/Extra}}
// {{/Front}}

// {{^Front}}
//   <span>No front content</span>
// {{/Front}}

// <!-- This is a comment -->
// {{cloze:Text}}

// {{#c1}}
//   <div class="cloze-card">{{c1::deletion}}</div>
// {{/c1}}

// [
//   {
//     type: 'block',
//     name: 'Front',
//     isCloze: false,
//     inverted: false,
//     children: [
//       { type: 'text', value: '\n  <div class="question">' },
//       { type: 'token', token: 'Front' },
//       { type: 'text', value: '</div>\n  ' },
//       {
//         type: 'block',
//         name: 'Extra',
//         isCloze: false,
//         inverted: false,
//         children: [
//           { type: 'text', value: '\n    <p>' },
//           { type: 'token', token: 'hint:Extra' },
//           { type: 'text', value: '</p>\n  ' }
//         ]
//       },
//       { type: 'text', value: '\n' }
//     ]
//   },
//   { type: 'text', value: '\n\n' },
//   {
//     type: 'block',
//     name: 'Front',
//     isCloze: false,
//     inverted: true,  // {{^Front}}
//     children: [
//       { type: 'text', value: '\n  <span>No front content</span>\n' }
//     ]
//   },
//   { type: 'text', value: '\n\n<!-- This is a comment -->\n' },
//   { type: 'token', token: 'cloze:Text' },
//   { type: 'text', value: '\n\n' },
//   {
//     type: 'block',
//     name: 'c1',
//     isCloze: true,   // Recognized cloze conditional
//     inverted: false,
//     children: [
//       { type: 'text', value: '\n  <div class="cloze-card">' },
//       { type: 'token', token: 'c1::deletion' },  // This would be processed as text, not cloze
//       { type: 'text', value: '</div>\n' }
//     ]
//   }
// ]
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
