import { Filters } from './filters/index.js'
import { parseTemplate } from './ast.js'

function processToken(token) {
  const segs = token.split(':')

  let v = segs.pop()
  segs.forEach(f => {
    const fn = Filters.get(f)
    if (fn) v = fn(v)
  } )

  return v
}

function processCloze(token) {
  return token?.split('::').pop()
}

// Public surface, small and focused
export class AnkiRender {
  constructor({ fieldDefs, css, templates }) {
    this.fieldDefs = fieldDefs
    this.fieldIdx = {}
    this.css = css
    this.ast = []

    templates.forEach(({ qfmt, afmt }) => {
      this.ast.push({
        q: parseTemplate(qfmt),
        a: parseTemplate(afmt)
      })
    })

    fieldDefs.forEach((f, i) => this.fieldIdx[f] = i)
  }

  getField(f, k) {
    const i = this.fieldIdx[k]
    return (i ?? f[i]) || ''
  }

  render(note) {
    function renderNodes(nodes, fields, front) {
      let out = ''
      for (const n of nodes) {
        const f = this.getField(fields, n.name)
        switch (n.type) {
        case 'block':
          out += !!f === !n.inverted ? renderNodes(n.children, fields, front) : ''
          break
        case 'text':
          out += n.value
          break
        case 'token':
          out += n.token === 'FrontSide' ? front :
            n.isCloze ? processCloze(n.token)
              : processToken(n.token)
        }
      }
      return out
    }

    const { q, a } = this.ast[note.templateOrd]
    const front = renderNodes(q, note.fields)
    const back = front && renderNodes(a, note.fields, front)
    return  { front, back, css: this.css, meta: {} }
  }
}
