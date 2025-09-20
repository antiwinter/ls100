import { Filters } from './filters/index.js'
import { parseTemplate } from './ast2.js'
import db from '../db.js'
import mediaManager from '../mediaManager.js'
import { log } from '../../../../utils/logger.js'
import { genId } from '../../../../utils/idGenerator.js'

// Add template to bundle - handles both raw and cooked formats
export async function addTemplate(bundleId, name, qfmt, afmt, media = {}) {
  // Auto-increment ord
  const existingTemplates = await db.templates.where('bundleId').equals(bundleId).toArray()
  const maxOrd = existingTemplates.length > 0
    ? Math.max(...existingTemplates.map(t => t.ord)) : -1
  const ord = maxOrd + 1

  // Add media using fuzzy pattern
  await mediaManager.fuzzyAdd(bundleId, ord, qfmt + afmt, media)
  const template = {
    id: genId('template', bundleId + name + qfmt + afmt),
    bundleId,
    name,
    qfmt,
    afmt,
    ord,
    vdeck: null,
    created: Date.now()
  }
  await db.templates.put(template)

  return ord // Return the assigned ord for mapping
}

// Get all templates for bundle
export async function getTemplates(bundleId) {
  return await db.templates.where('bundleId').equals(bundleId).toArray()
}

// Get template by bundleId and ord
export async function getTemplate(bundleId, ord) {
  return await db.templates.where('bundleId').equals(bundleId).and(t => t.ord === ord).first()
}
// Remove a template and its media references
export async function removeTemplate(template) {
  if (!template) return false

  const { qfmt, afmt, bundleId, ord } = template
  // Remove media references using fuzzy pattern
  await mediaManager.fuzzyRemove(bundleId, ord, qfmt + afmt)

  // Remove template from database
  await db.templates.delete(template.id)
  log.debug('Removed template:', template.id)
  return true
}


// Public surface, small and focused
export class AnkiRender {
  constructor({ fieldDefs, css, templates, f2nvid }) {
    this.fieldDefs = fieldDefs
    this.fieldIdx = {}
    this.ast = []
    this.f2nvid = f2nvid || {}

    templates.forEach(({ qfmt, afmt }) => {
      this.ast.push({
        q: parseTemplate(qfmt),
        a: parseTemplate(afmt)
      })
    })

    fieldDefs.forEach((f, i) => this.fieldIdx[f] = i)

    // Replace filenames in CSS url() declarations with /media/nvid
    this.css = css.replace(/url\(['"]?([^'")]+)['"]?\)/gi, (match, filename) => {
      const nvId = this.f2nvid[filename]
      return nvId ? `url("/media/${nvId}")` : match
    })
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
