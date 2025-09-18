import { Filters } from './filters/index.js'
import { parseTemplate } from './ast2.js'

// Public surface, small and focused
export class AnkiRender {
  constructor({ fieldDefs, css, templates, f2nvid }) {
    this.fieldDefs = fieldDefs
    this.fieldIdx = {}
    this.css = css
    this.ast = []
    this.f2nvid = f2nvid || {}

    templates.forEach(({ qfmt, afmt }) => {
      this.ast.push({
        q: parseTemplate(qfmt),
        a: parseTemplate(afmt)
      })
    })

    fieldDefs.forEach((f, i) => this.fieldIdx[f] = i)
  }

  _getField(f, k) {
    const i = this.fieldIdx[k]
    return (i !== undefined && f[i]) || ''
  }

  _applyFilters(token, fields) {
    const segs = token.split(':')

    let v = this._getField(fields, segs.pop())
    segs.forEach(f => {
      const fn = Filters.get(f)
      if (fn) v = fn(v)
    } )

    return v
  }

  render(note, ord) {
    const renderNodes = (tree, fields, front) => {
      let out = ''
      for (const n of tree) {
        const f = this._getField(fields, n.name)
        switch (n.type) {
        case 'block':
          out += !!f === !n.inv ? renderNodes(n.sub, fields, front) : ''
          break
        case 'text':
          out += n.text
          break
        case 'field':
          out += n.name === 'FrontSide' ? front
            : this._applyFilters(n.token, fields)
        }
      }
      return out
    }

    const { q, a } = this.ast[ord]
    const front = renderNodes(q, note.fields)
    const back = front && renderNodes(a, note.fields, front)
    return  { front, back, css: this.css, meta: {} }
  }
}
