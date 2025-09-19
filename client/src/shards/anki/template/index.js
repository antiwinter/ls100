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
    return (i !== undefined && f && f[i]) || ''
  }

  _applyFilters(v, filters) {
    filters.forEach(f => {
      const fn = Filters.get(f)
      if (fn) v = fn(v)
    } )

    return v
  }

  _tune(str) {
    // Replace [sound:filename] with <audio> tags
    str = str.replace(/\[sound:([^\]]+)\]/g, (match, filename) => {
      const nvId = this.f2nvid[filename]
      return nvId ? `<audio controls><source src="/media/${nvId}"></audio>` : match
    })

    // Replace filename references in HTML media tags with /media/nvid
    str = str.replace(/<(img|audio|video|source|object)\b[^>]*\b(?:src|data)=["']?([^"'\s>]+)["']?[^>]*>/gi, (match, tag, src) => {
      const nvId = this.f2nvid[src]
      return nvId ? match.replace(/\b(?:src|data)=["']?[^"'\s>]+["']?/, `src="/media/${nvId}"`) : match
    })

    return str
  }

  render(note, ord) {
    const renderNodes = (tree, fields, front) => {
      let out = ''
      for (const n of tree) {
        const v = this._getField(fields, n.name)
        switch (n.type) {
        case 'block':
          out += !!v === !n.inv ? renderNodes(n.sub, fields, front) : ''
          break
        case 'text':
          out += n.text
          break
        case 'field':
          out += n.name === 'FrontSide' ? front
            : this._applyFilters(v, n.filters)
        }
      }

      return this._tune(out)
    }

    const { q, a } = this.ast[ord]
    const front = renderNodes(q, note.fields)
    const back = front && renderNodes(a, note.fields, front)
    return  { front, back, css: this.css, meta: {} }
  }
}
